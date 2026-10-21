"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createPromotionAction, setPromotionActiveAction, updatePromotionAction } from "@/app/(admin)/admin/promotions/actions";
import type { PromoCodeRow } from "@/server/db/schema";

function toLocalInput(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toInput(form: HTMLFormElement) {
  const fields = new FormData(form);
  const localExpiry = String(fields.get("expiresAt") ?? "");
  const expiry = new Date(localExpiry);
  return {
    code: String(fields.get("code") ?? ""),
    kind: String(fields.get("kind") ?? ""),
    value: String(fields.get("value") ?? ""),
    expiresAt: Number.isNaN(expiry.getTime()) ? localExpiry : expiry.toISOString(),
    usageLimit: String(fields.get("usageLimit") ?? ""),
    active: fields.get("active") === "on",
  };
}

function PromotionForm({ promotion }: { promotion?: PromoCodeRow }) {
  const router = useRouter();
  const [kind, setKind] = useState<"percentage" | "fixed">(promotion?.kind ?? "percentage");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const input = toInput(event.currentTarget);
    const form = event.currentTarget;
    try {
      const result = promotion
        ? await updatePromotionAction({ ...input, id: promotion.id })
        : await createPromotionAction(input);
      setMessage(result.ok ? promotion ? "Changes saved." : "Promo code created." : result.message);
      if (result.ok) {
        if (!promotion) form.reset();
        router.refresh();
      }
    } catch {
      setMessage("The promo code could not be saved. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle() {
    if (!promotion) return;
    setBusy(true);
    try {
      const result = await setPromotionActiveAction(promotion.id, !promotion.active);
      setMessage(result.ok ? promotion.active ? "Code disabled." : "Code activated." : result.message);
      if (result.ok) router.refresh();
    } catch {
      setMessage("The promo code could not be updated. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="admin-panel promo-form" onSubmit={save} noValidate>
    <div className="promo-form-heading">
      <h2>{promotion ? promotion.code : "Create a promo code"}</h2>
      {promotion ? <span>{promotion.usageCount} of {promotion.usageLimit} uses · {promotion.active ? "Active" : "Disabled"}</span> : null}
    </div>
    <div className="promo-fields">
      <div className="admin-field"><label htmlFor={`promo-code-${promotion?.id ?? "new"}`}>Code</label>
        <input id={`promo-code-${promotion?.id ?? "new"}`} name="code" defaultValue={promotion?.code ?? ""} required maxLength={32} autoComplete="off" /></div>
      <div className="admin-field"><label htmlFor={`promo-kind-${promotion?.id ?? "new"}`}>Discount type</label>
        <select id={`promo-kind-${promotion?.id ?? "new"}`} name="kind" value={kind} onChange={(event) => setKind(event.target.value as "percentage" | "fixed")}>
          <option value="percentage">Percentage</option><option value="fixed">Fixed rupees</option>
        </select></div>
      <div className="admin-field"><label htmlFor={`promo-value-${promotion?.id ?? "new"}`}>{kind === "percentage" ? "Percent off" : "Rupees off"}</label>
        <input id={`promo-value-${promotion?.id ?? "new"}`} name="value" inputMode="decimal" required
          defaultValue={promotion ? promotion.kind === "fixed" ? (promotion.value / 100).toFixed(2) : String(promotion.value) : ""} /></div>
      <div className="admin-field"><label htmlFor={`promo-expiry-${promotion?.id ?? "new"}`}>Expires at (your local time)</label>
        <input id={`promo-expiry-${promotion?.id ?? "new"}`} name="expiresAt" type="datetime-local" required
          defaultValue={promotion ? toLocalInput(promotion.expiresAt) : ""} /></div>
      <div className="admin-field"><label htmlFor={`promo-limit-${promotion?.id ?? "new"}`}>Total uses allowed</label>
        <input id={`promo-limit-${promotion?.id ?? "new"}`} name="usageLimit" type="number" min={promotion ? Math.max(1, promotion.usageCount) : 1}
          max={1_000_000} defaultValue={promotion?.usageLimit ?? ""} required /></div>
    </div>
    <label className="admin-checkbox"><input name="active" type="checkbox" defaultChecked={promotion?.active ?? true} /> Active</label>
    <div className="admin-actions"><button className="admin-button admin-button--primary" disabled={busy} type="submit">{busy ? "Saving…" : promotion ? "Save changes" : "Create code"}</button>
      {promotion ? <button className="admin-button" disabled={busy} type="button" onClick={toggle}>{promotion.active ? "Disable code" : "Activate code"}</button> : null}</div>
    {message ? <p className="promo-message" role="status">{message}</p> : null}
  </form>;
}

export function PromoManager({ promotions }: { promotions: PromoCodeRow[] }) {
  return <div className="promo-manager">
    <PromotionForm />
    <section aria-labelledby="promo-existing-title"><h2 id="promo-existing-title">Existing codes</h2>
      {promotions.length === 0 ? <p className="admin-empty">No promo codes yet. Create the first code above.</p> :
        <div className="promo-existing">{promotions.map((promotion) => <PromotionForm key={`${promotion.id}-${promotion.updatedAt}`} promotion={promotion} />)}</div>}
    </section>
  </div>;
}
