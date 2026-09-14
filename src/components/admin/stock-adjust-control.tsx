"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PackagePlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { StatusSelect } from "@/components/admin/status-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  STOCK_ADJUSTMENT_MODES,
  stockAdjustmentSchema,
  type StockAdjustmentInput,
  type StockAdjustmentMode,
  type StockAdjustmentValues,
} from "@/features/admin/stock";
import { adjustVariantStockAction } from "@/features/admin/stock-actions";

const MODE_LABEL: Record<StockAdjustmentMode, string> = {
  set: "Set to",
  add: "Add",
  subtract: "Subtract",
};

const MODE_OPTIONS = STOCK_ADJUSTMENT_MODES.map((value) => ({ value, label: MODE_LABEL[value] }));

const EMPTY: StockAdjustmentValues = { mode: "add", amount: "", reason: "" };

/**
 * Adjusts a variant's stock outside the product form's own save flow, so an
 * operator can correct a count without touching every other field. Validation is
 * the same zod schema the server re-parses; writes are audited server-side.
 */
export function StockAdjustControl({
  variantId,
  sku,
  stockQuantity,
  onAdjusted,
}: {
  variantId: string | null;
  sku: string;
  stockQuantity: number;
  onAdjusted?: (nextQuantity: number) => void;
}) {
  const router = useRouter();
  const [isOpen, setOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<StockAdjustmentValues, unknown, StockAdjustmentInput>({
    resolver: zodResolver(stockAdjustmentSchema),
    defaultValues: EMPTY,
  });

  if (!variantId) return null;

  async function onSubmit(values: StockAdjustmentInput) {
    // A parameter's narrowing does not reach this closure, so re-check here.
    if (!variantId) return;

    const result = await adjustVariantStockAction(variantId, values);
    if (!result.ok) {
      setError("root", { message: result.message });
      toast.error(result.message);
      return;
    }

    toast.success(`${sku} stock is now ${result.stockQuantity}.`);
    reset(EMPTY);
    setOpen(false);
    if (result.stockQuantity !== undefined && onAdjusted) onAdjusted(result.stockQuantity);
    else router.refresh();
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setOpen(open);
        if (!open) reset(EMPTY);
      }}
    >
      <DialogTrigger asChild>
        <button className="admin-button" type="button">
          <PackagePlus aria-hidden size={14} /> Adjust stock
        </button>
      </DialogTrigger>
      <DialogContent className="ops-dialog">
        <DialogHeader>
          <DialogTitle>Adjust stock — {sku}</DialogTitle>
          <DialogDescription>
            Currently {stockQuantity} in stock. A reason is required for the audit log.
          </DialogDescription>
        </DialogHeader>

        <form className="admin-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          {errors.root ? (
            <p className="admin-field-error" role="alert">
              {errors.root.message}
            </p>
          ) : null}

          <div className="admin-form-row">
            <div className="admin-field">
              <label htmlFor={`stock-mode-${variantId}`}>Mode</label>
              <Controller
                control={control}
                name="mode"
                render={({ field }) => (
                  <StatusSelect
                    id={`stock-mode-${variantId}`}
                    value={field.value}
                    options={MODE_OPTIONS}
                    disabled={isSubmitting}
                    onValueChange={field.onChange}
                  />
                )}
              />
            </div>
            <div className="admin-field">
              <label htmlFor={`stock-amount-${variantId}`}>Amount</label>
              <input
                id={`stock-amount-${variantId}`}
                inputMode="numeric"
                aria-invalid={errors.amount ? "true" : "false"}
                aria-describedby={errors.amount ? `stock-amount-${variantId}-error` : undefined}
                {...register("amount")}
              />
              {errors.amount ? (
                <span className="admin-field-error" id={`stock-amount-${variantId}-error`} role="alert">
                  {errors.amount.message}
                </span>
              ) : null}
            </div>
          </div>

          <div className="admin-field admin-field--wide">
            <label htmlFor={`stock-reason-${variantId}`}>Reason</label>
            <input
              id={`stock-reason-${variantId}`}
              placeholder="e.g. stock count correction"
              aria-invalid={errors.reason ? "true" : "false"}
              aria-describedby={errors.reason ? `stock-reason-${variantId}-error` : undefined}
              {...register("reason")}
            />
            {errors.reason ? (
              <span className="admin-field-error" id={`stock-reason-${variantId}-error`} role="alert">
                {errors.reason.message}
              </span>
            ) : null}
          </div>

          <DialogFooter>
            <button className="admin-button" type="button" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Cancel
            </button>
            <button className="admin-button admin-button--primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
