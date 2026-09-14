"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { isConsequential } from "@/features/admin/bulk-actions";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { moveOrderStatus } from "@/features/admin/order-actions";
import {
  ORDER_STATUS_META,
  describeStatus,
  isCodStatus,
  isTerminal,
  nextStatuses,
  type CodStatus,
} from "@/features/orders/status";

/**
 * Every button here comes from COD_STATUS_FLOW, so an illegal transition is
 * never offered. The server action re-derives the current status and re-checks.
 */
export function OrderStatusControl({ orderId, status }: { orderId: string; status: string }) {
  const router = useRouter();
  const [pendingTarget, setPendingTarget] = useState<CodStatus | null>(null);
  const [isPending, startTransition] = useTransition();
  const current = describeStatus(status);

  if (!isCodStatus(status)) {
    return (
      <p className="admin-hint">
        “{current.label}” is not part of the current lifecycle, so no transitions are offered.
      </p>
    );
  }

  if (isTerminal(status)) {
    return (
      <p className="admin-hint">
        This order is {current.label.toLowerCase()} — {current.description} It is the end of the
        line, so there is nothing further to move it to.
      </p>
    );
  }

  function move(target: CodStatus) {
    startTransition(async () => {
      const result = await moveOrderStatus(orderId, target);
      setPendingTarget(null);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(`Order moved to ${ORDER_STATUS_META[target].label.toLowerCase()}.`);
      router.refresh();
    });
  }

  return (
    <div className="ops-stack">
      <p className="admin-hint">{current.description}</p>
      <div className="admin-actions">
        {nextStatuses(status).map((target) => (
          <button
            key={target}
            className={`admin-button${isConsequential(target) ? " admin-button--danger" : " admin-button--primary"}`}
            type="button"
            disabled={isPending}
            onClick={() => (isConsequential(target) ? setPendingTarget(target) : move(target))}
          >
            {ORDER_STATUS_META[target].label}
          </button>
        ))}
      </div>

      <Dialog open={pendingTarget !== null} onOpenChange={(open) => !open && setPendingTarget(null)}>
        <DialogContent className="ops-dialog">
          <DialogHeader>
            <DialogTitle>
              Mark this order {pendingTarget ? ORDER_STATUS_META[pendingTarget].label.toLowerCase() : ""}?
            </DialogTitle>
            <DialogDescription>
              {pendingTarget ? ORDER_STATUS_META[pendingTarget].description : ""} Nothing moves an
              order out of this status afterwards.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button className="admin-button" type="button" onClick={() => setPendingTarget(null)}>
              Keep it as is
            </button>
            <button
              className="admin-button admin-button--danger"
              type="button"
              disabled={isPending}
              onClick={() => pendingTarget && move(pendingTarget)}
            >
              {isPending ? "Updating…" : "Yes, continue"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
