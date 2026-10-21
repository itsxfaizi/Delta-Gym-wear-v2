"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import { requireAdminPrincipal } from "@/server/admin/guard";
import { createPromotion, setPromotionActive, updatePromotion } from "@/server/promotions/mutations";

export type PromotionActionResult = { ok: true } | { ok: false; message: string };

function errorMessage(error: unknown): string {
  if (error instanceof ZodError) return error.issues[0]?.message ?? "Check the promo code details.";
  if (error instanceof Error && (error.message === "Expiry must be in the future." ||
      error.message === "Usage limit cannot be below the number already redeemed." ||
      error.message === "An active promo code needs a future expiry." ||
      error.message === "An expired promo code cannot be activated.")) return error.message;
  console.error("promotion action failed", error);
  return "The promo code could not be saved. Check for an existing code and try again.";
}

export async function createPromotionAction(input: unknown): Promise<PromotionActionResult> {
  try {
    const principal = await requireAdminPrincipal(["owner"]);
    await createPromotion(input, principal);
    revalidatePath("/admin/promotions");
    return { ok: true };
  } catch (error) { return { ok: false, message: errorMessage(error) }; }
}

export async function updatePromotionAction(input: unknown): Promise<PromotionActionResult> {
  try {
    const principal = await requireAdminPrincipal(["owner"]);
    await updatePromotion(input, principal);
    revalidatePath("/admin/promotions");
    return { ok: true };
  } catch (error) { return { ok: false, message: errorMessage(error) }; }
}

export async function setPromotionActiveAction(id: string, active: boolean): Promise<PromotionActionResult> {
  try {
    const principal = await requireAdminPrincipal(["owner"]);
    await setPromotionActive(id, active, principal);
    revalidatePath("/admin/promotions");
    return { ok: true };
  } catch (error) { return { ok: false, message: errorMessage(error) }; }
}
