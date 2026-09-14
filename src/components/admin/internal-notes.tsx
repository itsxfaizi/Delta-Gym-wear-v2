"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { formatDateTime } from "@/lib/datetime";
import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { addInternalNote } from "@/features/admin/order-actions";
import { internalNoteSchema } from "@/features/orders/ops-schemas";
import type { InternalNote } from "@/server/ops/types";


type NoteFormValues = z.input<typeof internalNoteSchema>;

/** Staff-only thread. Nothing here is ever projected to the storefront. */
export function InternalNotes({ orderId, notes }: { orderId: string; notes: readonly InternalNote[] }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NoteFormValues, unknown, z.output<typeof internalNoteSchema>>({
    resolver: zodResolver(internalNoteSchema),
    defaultValues: { orderId, body: "" },
  });

  async function onSubmit(values: z.output<typeof internalNoteSchema>) {
    const result = await addInternalNote(orderId, values);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    reset({ orderId, body: "" });
    router.refresh();
  }

  return (
    <div className="ops-stack">
      <p className="ops-internal-flag">
        <Lock aria-hidden="true" size={14} /> Internal only — never shown to the customer
      </p>

      {notes.length === 0 ? (
        <p className="admin-empty">No internal notes yet.</p>
      ) : (
        <ol className="ops-list">
          {notes.map((note) => (
            <li key={note.id}>
              <span className="ops-when">
                {note.authorUserId} ·{" "}
                <time dateTime={note.notedAt.toISOString()}>{formatDateTime(note.notedAt)}</time>
              </span>
              <p>{note.body}</p>
            </li>
          ))}
        </ol>
      )}

      <form className="admin-form ops-note-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="admin-field admin-field--wide">
          <label htmlFor="internal-note">Add an internal note</label>
          <textarea
            id="internal-note"
            rows={3}
            aria-invalid={errors.body ? "true" : "false"}
            {...register("body")}
          />
          {errors.body ? (
            <span className="admin-error" role="alert">
              {errors.body.message}
            </span>
          ) : null}
        </div>
        <div className="admin-actions">
          <button className="admin-button admin-button--primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Append note"}
          </button>
        </div>
      </form>
    </div>
  );
}
