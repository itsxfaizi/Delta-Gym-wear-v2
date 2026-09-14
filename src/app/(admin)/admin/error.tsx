"use client";

export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <section className="admin-panel admin-error-state">
      <h1>The dashboard could not load</h1>
      <p className="admin-hint">
        The console reached an error while reading the store. Nothing was changed — try again.
      </p>
      <button className="admin-button admin-button--primary" type="button" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
