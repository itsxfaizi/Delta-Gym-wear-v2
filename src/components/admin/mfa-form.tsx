"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import { beginMfaEnrollment, verifyMfaCode } from "@/features/admin/mfa-actions";

type Enrollment = { factorId: string; qrCode: string; secret: string };

const subscribeToHydration = () => () => {};
const getClientHydration = () => true;
const getServerHydration = () => false;

export function MfaForm({ verifiedFactorId }: { verifiedFactorId: string | null }) {
  const router = useRouter();
  const hydrated = useSyncExternalStore(subscribeToHydration, getClientHydration, getServerHydration);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function startEnrollment() {
    if (!hydrated || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await beginMfaEnrollment();
      if (result.ok) setEnrollment(result);
      else setError(result.message);
    } catch {
      setError("Authenticator setup is unavailable. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hydrated || busy || code.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      const result = await verifyMfaCode({ factorId: enrollment?.factorId ?? verifiedFactorId, code });
      if (result.ok) {
        router.refresh();
        router.push("/admin");
        return;
      }
      setError(result.message);
    } catch {
      setError("Could not verify the code. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-form">
      {error ? <p className="auth-form-error" role="alert">{error}</p> : null}
      {!verifiedFactorId && !enrollment ? (
        <button className="auth-submit" type="button" onClick={startEnrollment} disabled={!hydrated || busy}>
          {busy ? "Starting setup…" : "Set up authenticator"}
        </button>
      ) : null}
      {enrollment ? (
        <div className="mfa-enrollment">
          {/* Supabase provides this QR as a data URL. It is never persisted by this app. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="mfa-qr" src={enrollment.qrCode} alt="Scan this QR code with your authenticator app" />
          <p className="auth-intro">Or enter this setup key manually:</p>
          <code className="mfa-secret">{enrollment.secret}</code>
          <p className="auth-form-note">Keep this key private. It will not be shown again after you leave this page.</p>
          <button className="account-button" type="button" onClick={startEnrollment} disabled={!hydrated || busy}>
            Restart setup
          </button>
        </div>
      ) : null}
      {verifiedFactorId || enrollment ? (
        <form className="auth-form" onSubmit={submitCode}>
          <div className="auth-field">
            <label htmlFor="mfa-code">Six-digit authenticator code</label>
            <input
              id="mfa-code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              disabled={!hydrated || busy}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              aria-invalid={error ? "true" : "false"}
            />
          </div>
          <button className="auth-submit" type="submit" disabled={!hydrated || busy || code.length !== 6}>
            {busy ? "Verifying…" : "Verify and enter admin"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
