"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  availableTargets,
  groupSkipReasons,
  isConsequential,
  planBulkStatusChange,
  type BulkOrder,
  type BulkPlan,
} from "@/features/admin/bulk-actions";
import { bulkChangeOrderStatus, type BulkOrderResult } from "@/features/admin/customer-actions";
import { ORDER_STATUS_META, type CodStatus } from "@/features/orders/status";

/**
 * The plan is computed client-side only to show it; the server re-derives every
 * order's eligibility from its real status before writing anything.
 */
export function BulkActions({ selected, onApplied }: { selected: BulkOrder[]; onApplied: () => void }) {
  const router = useRouter();
  const [target, setTarget] = useState<CodStatus | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [results, setResults] = useState<BulkOrderResult[] | null>(null);
  const [isPending, startTransition] = useTransition();

  // With nothing ticked there is no legal move, so the bar still offers the
  // three everyday ones as disabled buttons rather than collapsing to nothing.
  const targets = selected.length === 0 ? (["confirmed", "packed", "cancelled"] as const) : availableTargets(selected);
  const plan = target ? planBulkStatusChange(selected, target) : null;

  function apply(next: BulkPlan) {
    startTransition(async () => {
      const result = await bulkChangeOrderStatus({
        orderIds: next.eligible.map((order) => order.id),
        target: next.target,
      });
      setConfirming(false);
      setResults(result.results);
      if (result.ok) {
        toast.success(result.message);
        onApplied();
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  function choose(next: CodStatus) {
    setTarget(next);
    setResults(null);
    const nextPlan = planBulkStatusChange(selected, next);
    // Nothing eligible: the plan below says which orders were skipped and why.
    if (nextPlan.eligible.length === 0) return;
    if (isConsequential(next)) setConfirming(true);
    else apply(nextPlan);
  }

  return (
    <section aria-label="Bulk actions">
      <div className="admin-bulkbar">
        <p role="status">
          {selected.length === 0
            ? "Nothing selected — tick rows to act on them in bulk"
            : `${selected.length} selected on this page`}
        </p>
        <div className="admin-actions">
          {targets.map((status) => (
            <button
              key={status}
              className={`admin-button${status === "cancelled" ? " admin-button--danger" : ""}`}
              type="button"
              disabled={selected.length === 0 || isPending}
              onClick={() => choose(status)}
            >
              {status === "cancelled" ? "Cancel" : `Mark ${ORDER_STATUS_META[status].label.toLowerCase()}`}
            </button>
          ))}
        </div>
      </div>

      {plan && selected.length > 0 ? (
        <div className="orders-bulk-plan">
          <p>{plan.summary}</p>
          {plan.skipped.length > 0 ? (
            <ul>
              {groupSkipReasons(plan.skipped).map((group) => (
                <li key={group.reason}>
                  <strong>{group.orderNumbers.length} skipped</strong> — {group.reason} ({group.orderNumbers.join(", ")})
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <Dialog open={confirming && plan !== null} onOpenChange={(open) => !open && setConfirming(false)}>
        <DialogContent className="ops-dialog">
          <DialogHeader>
            <DialogTitle>
              Move {plan?.eligible.length ?? 0} {plan?.eligible.length === 1 ? "order" : "orders"} to{" "}
              {plan ? ORDER_STATUS_META[plan.target].label.toLowerCase() : ""}?
            </DialogTitle>
            <DialogDescription>
              {plan ? ORDER_STATUS_META[plan.target].description : ""} This is applied to each order
              one by one and reported below.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button className="admin-button" type="button" onClick={() => setConfirming(false)} disabled={isPending}>
              Cancel
            </button>
            <button
              className="admin-button admin-button--danger"
              type="button"
              onClick={() => plan && apply(plan)}
              disabled={isPending}
            >
              {isPending ? "Working…" : "Yes, move them"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {results ? (
        <ul className="orders-bulk-results">
          {results.map((result) => (
            <li key={result.orderId} data-ok={result.ok}>
              <strong>{result.orderNumber}</strong> — {result.message}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
