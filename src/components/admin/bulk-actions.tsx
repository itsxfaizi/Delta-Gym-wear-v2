"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { StatusSelect } from "@/components/admin/status-select";
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
} from "@/features/admin/bulk-actions";
import { bulkChangeOrderStatus, type BulkOrderResult } from "@/features/admin/customer-actions";
import { ORDER_STATUS_META, isCodStatus, type CodStatus } from "@/features/orders/status";

/**
 * The plan is computed client-side only to show it; the server re-derives every
 * order's eligibility from its real status before writing anything.
 */
export function BulkActions({ selected, onApplied }: { selected: BulkOrder[]; onApplied: () => void }) {
  const router = useRouter();
  const [target, setTarget] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [results, setResults] = useState<BulkOrderResult[] | null>(null);
  const [isPending, startTransition] = useTransition();

  const targets = availableTargets(selected);
  const plan = isCodStatus(target) ? planBulkStatusChange(selected, target) : null;

  function apply(next: CodStatus) {
    startTransition(async () => {
      const result = await bulkChangeOrderStatus({
        orderIds: plan?.eligible.map((order) => order.id) ?? [],
        target: next,
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

  return (
    <section className="bulk-bar" aria-label="Bulk actions">
      <p className="bulk-count" role="status">
        {selected.length} selected on this page
      </p>

      {selected.length === 0 ? (
        <p className="admin-hint">Tick an order to act on it. Selection covers this page only and clears when you filter or paginate.</p>
      ) : targets.length === 0 ? (
        <p className="admin-hint">Every selected order is in a final status, so there is no move to make.</p>
      ) : (
        <div className="admin-filters">
          <div className="admin-field">
            <label htmlFor="bulk-target">Move selected to</label>
            <StatusSelect
              id="bulk-target"
              value={target}
              options={targets.map((status) => ({ value: status, label: ORDER_STATUS_META[status].label }))}
              disabled={isPending}
              placeholder="Choose a status"
              onValueChange={(value) => {
                setTarget(value);
                setConfirming(false);
                setResults(null);
              }}
            />
          </div>
          <button
            className="admin-button admin-button--primary"
            type="button"
            disabled={!plan || plan.eligible.length === 0 || isPending}
            onClick={() => {
              if (!plan) return;
              if (isConsequential(plan.target)) setConfirming(true);
              else apply(plan.target);
            }}
          >
            {isPending ? "Working…" : "Review and apply"}
          </button>
        </div>
      )}

      {plan && selected.length > 0 ? (
        <div className="bulk-plan">
          <p>{plan.summary}</p>
          {plan.skipped.length > 0 ? (
            <ul className="bulk-reasons">
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
              onClick={() => plan && apply(plan.target)}
              disabled={isPending}
            >
              {isPending ? "Working…" : "Yes, move them"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {results ? (
        <ul className="bulk-results">
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
