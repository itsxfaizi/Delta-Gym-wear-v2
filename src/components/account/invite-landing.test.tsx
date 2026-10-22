import { render, screen, waitFor } from "@testing-library/react";

jest.mock("@supabase/ssr", () => ({ createBrowserClient: jest.fn() }));
jest.mock("@/server/auth/invite", () => ({ validateStaffInvite: jest.fn() }));

import { createBrowserClient } from "@supabase/ssr";
import { validateStaffInvite } from "@/server/auth/invite";
import { InviteLanding } from "./invite-landing";

describe("default invitation landing", () => {
  const setSession = jest.fn();
  const signOut = jest.fn();
  beforeEach(() => {
    window.history.replaceState(null, "", "/auth/invite");
    jest.mocked(createBrowserClient).mockReturnValue({ auth: { setSession, signOut } } as never);
    setSession.mockResolvedValue({ error: null });
    signOut.mockResolvedValue({ error: null });
  });

  it("rejects a non-invite fragment and removes all parameters before auth", async () => {
    window.history.replaceState(null, "", "/auth/invite?next=https://evil.test#type=recovery&access_token=fake&refresh_token=fake");
    render(<InviteLanding />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(window.location.hash).toBe("");
    expect(window.location.search).toBe("");
    expect(createBrowserClient).not.toHaveBeenCalled();
  });

  it("clears credentials before persisting and denies rejected provider tokens", async () => {
    window.history.replaceState(null, "", "/auth/invite#type=invite&access_token=fake-access&refresh_token=fake-refresh");
    setSession.mockImplementation(async () => {
      expect(window.location.hash).toBe("");
      return { error: { message: "expired" } };
    });
    render(<InviteLanding />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(validateStaffInvite).not.toHaveBeenCalled();
  });

  it("clears a persisted session when server membership authorization fails", async () => {
    window.history.replaceState(null, "", "/auth/invite#type=invite&access_token=fake-access&refresh_token=fake-refresh");
    jest.mocked(validateStaffInvite).mockResolvedValue({ ok: false });
    render(<InviteLanding />);
    await waitFor(() => expect(signOut).toHaveBeenCalledWith({ scope: "local" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
