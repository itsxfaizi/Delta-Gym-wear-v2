"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { changeProductStatus } from "@/features/admin/actions";
import type { ProductStatus } from "@/features/admin/schemas";

const TRANSITIONS: readonly { status: ProductStatus; label: string }[] = [
  { status: "published", label: "Publish" },
  { status: "unpublished", label: "Unpublish" },
  { status: "archived", label: "Archive" },
];

/** Publisher-only shortcuts; a non-publisher gets a refusal from the action. */
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="admin-button" disabled={isPending}>
        Status
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {TRANSITIONS.filter((transition) => transition.status !== status).map((transition) => (
          <DropdownMenuItem key={transition.status} onSelect={() => move(transition.status)}>
            {transition.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
