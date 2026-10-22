import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";

jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }) }));
jest.mock("@/features/admin/mfa-actions", () => ({ beginMfaEnrollment: jest.fn(), verifyMfaCode: jest.fn() }));

import { verifyMfaCode } from "@/features/admin/mfa-actions";
import { MfaForm } from "./mfa-form";

describe("MFA form hydration", () => {
  it("keeps server-rendered controls disabled until client handlers are ready", () => {
    const challenge = document.createElement("div");
    challenge.innerHTML = renderToString(<MfaForm verifiedFactorId="factor-1" />);
    expect(challenge.querySelector("input")).toBeDisabled();
    expect(challenge.querySelector("button[type=submit]")).toBeDisabled();

    const enrollment = document.createElement("div");
    enrollment.innerHTML = renderToString(<MfaForm verifiedFactorId={null} />);
    expect(enrollment.querySelector("button")).toBeDisabled();
  });

  it("normalizes hydrated input, enables six-digit submission and locks input while verifying", async () => {
    let finishVerification!: (result: { ok: false; message: string }) => void;
    jest.mocked(verifyMfaCode).mockImplementation(() => new Promise((resolve) => { finishVerification = resolve; }));
    render(<MfaForm verifiedFactorId="factor-1" />);
    const input = screen.getByLabelText("Six-digit authenticator code");
    const submit = screen.getByRole("button", { name: "Verify and enter admin" });
    expect(input).toBeEnabled();
    fireEvent.change(input, { target: { value: "12x34" } });
    expect(input).toHaveValue("1234");
    expect(submit).toBeDisabled();
    fireEvent.change(input, { target: { value: "12x345678" } });
    expect(input).toHaveValue("123456");
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    expect(input).toBeDisabled();
    expect(verifyMfaCode).toHaveBeenCalledWith({ factorId: "factor-1", code: "123456" });
    finishVerification({ ok: false, message: "Invalid code. Try again." });
    await waitFor(() => expect(input).toBeEnabled());
    expect(screen.getByRole("alert")).toHaveTextContent("Invalid code. Try again.");
  });

  it("enables authenticator enrollment after hydration", () => {
    render(<MfaForm verifiedFactorId={null} />);
    expect(screen.getByRole("button", { name: "Set up authenticator" })).toBeEnabled();
  });
});
