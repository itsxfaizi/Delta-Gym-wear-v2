"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteAddress, setDefaultAddress } from "@/features/account/actions";
import type { AddressInput } from "@/features/account/schemas";

import { AddressForm } from "./address-form";

export type SavedAddress = AddressInput & { id: string };

export function AddressBook({ addresses }: { addresses: readonly SavedAddress[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<SavedAddress | "new" | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; message?: string }>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.message ?? "That did not work.");
        return;
      }
      toast.success(success);
      router.refresh();
    });
  }

  function finishEditing() {
    setEditing(null);
    router.refresh();
  }

  return (
    <div className="address-book">
      {editing ? (
        <AddressForm
          address={editing === "new" ? undefined : editing}
          onSaved={finishEditing}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <button className="account-button account-button--primary" type="button" onClick={() => setEditing("new")}>
          Add an address
        </button>
      )}

      {addresses.length === 0 ? (
        <p className="account-empty">You have not saved an address yet.</p>
      ) : (
        <ul className="address-list">
          {addresses.map((address) => (
            <li className="address-card" key={address.id}>
              {address.isDefault ? <p className="address-badge">Default</p> : null}
              <p className="address-name">{address.fullName}</p>
              <address>
                {address.line1}
                {address.line2 ? <>, {address.line2}</> : null}
                <br />
                {address.city}, {address.province}
                {address.postalCode ? ` ${address.postalCode}` : ""}
                <br />
                {address.country}
                <br />
                {address.phone}
              </address>
              <div className="address-actions">
                <button className="account-button" type="button" onClick={() => setEditing(address)} disabled={isPending}>
                  Edit
                </button>
                {address.isDefault ? null : (
                  <button
                    className="account-button"
                    type="button"
                    disabled={isPending}
                    onClick={() => run(() => setDefaultAddress(address.id), "Default address updated.")}
                  >
                    Set as default
                  </button>
                )}
                <button
                  className="account-button account-button--danger"
                  type="button"
                  disabled={isPending}
                  onClick={() => run(() => deleteAddress(address.id), "Address removed.")}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
