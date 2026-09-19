"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { changeProductStatus } from "@/features/admin/actions";
import type { ProductStatus } from "@/features/admin/schemas";

/**
 * The one publish toggle. Archiving stays in the product form's status field,
 * so a list row cannot archive by mis-click.
 */
const NEXT = (status: ProductStatus) =>
  status === "published"
    ? ({ status: "unpublished", label: "Unpublish" } as const)
    : ({ status: "published", label: "Publish" } as const);

/** Publisher-only shortcut; a non-publisher gets a refusal from the action. */
export function ProductStatusActions({ productId, status }: { productId: string; status: ProductStatus }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function move(next: ProductStatus) {
    startTransition(async () => {
      const result = await changeProductStatus(productId, next);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(`Product ${next}.`);
      router.refresh();
    });
  }

  const transition = NEXT(status);

  return (
    <button className="admin-button" type="button" disabled={isPending} onClick={() => move(transition.status)}>
      {transition.label}
    </button>
  );
}
