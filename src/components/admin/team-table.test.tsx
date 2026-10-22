import { fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: jest.fn() }) }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/features/admin/team-actions", () => ({
  createInvitationLinkAction: jest.fn(),
  inviteMemberAction: jest.fn(),
  changeMemberRoleAction: jest.fn(),
  setMemberStatusAction: jest.fn(),
}));

import { createInvitationLinkAction, inviteMemberAction, setMemberStatusAction } from "@/features/admin/team-actions";
import { TeamTable } from "./team-table";

const TEST_INVITE_URL = "https://delta.example/auth/callback?token_hash=test-only&type=invite";

describe("staff invitation controls", () => {
  function startInvite() {
    render(<TeamTable members={[]} selfId="owner" />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "staff@example.com" } });
  }

  it("creates a link by default, supports copying, and clears it when starting another invite", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    jest.mocked(createInvitationLinkAction).mockResolvedValue({ ok: true, id: "new-staff", inviteUrl: TEST_INVITE_URL });
    startInvite();
    fireEvent.click(screen.getByRole("button", { name: "Create invitation link" }));
    const link = await screen.findByLabelText("Staff invitation link");
    expect(link).toHaveValue(TEST_INVITE_URL);
    expect(link).toHaveAttribute("readonly");
    expect(createInvitationLinkAction).toHaveBeenCalledWith({ email: "staff@example.com", role: "auditor" });
    expect(inviteMemberAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Link copied."));
    expect(writeText).toHaveBeenCalledWith(TEST_INVITE_URL);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "another@example.com" } });
    expect(screen.queryByLabelText("Staff invitation link")).not.toBeInTheDocument();
  });

  it("announces a rejected invitation and retains entered email for correction", async () => {
    jest.mocked(createInvitationLinkAction).mockResolvedValue({ ok: false, message: "That email already has a team membership on this store." });
    startInvite();
    fireEvent.submit(screen.getByRole("button", { name: "Create invitation link" }).closest("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent("That email already has a team membership");
    expect(screen.getByLabelText("Email address")).toHaveValue("staff@example.com");
    expect(screen.queryByLabelText("Staff invitation link")).not.toBeInTheDocument();
  });

  it("allows dismissal and gives manual-copy instructions when clipboard permission is denied", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: jest.fn().mockRejectedValue(new Error("denied")) } });
    jest.mocked(createInvitationLinkAction).mockResolvedValue({ ok: true, id: "new-staff", inviteUrl: TEST_INVITE_URL });
    startInvite();
    fireEvent.click(screen.getByRole("button", { name: "Create invitation link" }));
    await screen.findByLabelText("Staff invitation link");
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("copy it manually"));
    fireEvent.click(screen.getByRole("button", { name: "Dismiss link" }));
    expect(screen.queryByLabelText("Staff invitation link")).not.toBeInTheDocument();
  });

  it("explains that email delivery is disabled until it is configured", () => {
    startInvite();
    expect(screen.getByRole("button", { name: "Send invitation email" })).toBeDisabled();
    expect(screen.getByText(/Email invitations are disabled until delivery is configured/)).toBeInTheDocument();
  });

  it("keeps the explicit email action separate when delivery is enabled", async () => {
    jest.mocked(inviteMemberAction).mockResolvedValue({ ok: false, message: "Invitation email is not configured. Create an invitation link instead." });
    render(<TeamTable members={[]} selfId="owner" emailInvitesEnabled />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "staff@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send invitation email" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Create an invitation link instead");
    expect(createInvitationLinkAction).not.toHaveBeenCalled();
  });

  it("cancels a pending invitation without activating it and clears the displayed invitation link", async () => {
    jest.mocked(createInvitationLinkAction).mockResolvedValue({ ok: true, id: "new-staff", inviteUrl: TEST_INVITE_URL });
    jest.mocked(setMemberStatusAction).mockResolvedValue({ ok: true, id: "new-staff" });
    render(<TeamTable members={[{ authUserId: "new-staff", email: "staff@example.com", role: "auditor", status: "invited" }]} selfId="owner" />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "staff@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Create invitation link" }));
    await screen.findByLabelText("Staff invitation link");
    expect(screen.queryByRole("button", { name: "Restore" })).not.toBeInTheDocument();
    const cancel = screen.getByRole("button", { name: "Cancel invitation" });
    expect(cancel).toBeEnabled();
    fireEvent.click(cancel);
    await waitFor(() => expect(setMemberStatusAction).toHaveBeenCalledWith({ authUserId: "new-staff", status: "suspended" }));
    await waitFor(() => expect(screen.queryByLabelText("Staff invitation link")).not.toBeInTheDocument());
  });

  it("shows cancelled invitations as final without a restore action or editable role", () => {
    render(<TeamTable members={[{ authUserId: "cancelled-staff", email: "cancelled@example.com", role: "auditor", status: "cancelled" }]} selfId="owner" />);
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
    const cancelled = screen.getByRole("button", { name: "Invitation cancelled" });
    expect(cancelled).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Restore" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reactivate" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Role for cancelled@example.com" })).toBeDisabled();
    fireEvent.click(cancelled);
    expect(setMemberStatusAction).not.toHaveBeenCalled();
  });
});
