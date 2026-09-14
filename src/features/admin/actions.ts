"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import { InvalidOrderTransitionError } from "@/features/orders/orders";
import { OrderNotFoundError } from "@/server/orders/mutations";

import { createProduct, setProductStatus, updateProduct } from "@/server/admin/mutations";
import { AuthorizationError } from "@/server/authorization";

import { type ActionResult, type ProductStatus } from "./schemas";

function toResult(error: unknown): ActionResult {
  if (error instanceof AuthorizationError) {
    return { ok: false, message: "You do not have permission to do that." };
  }
  // Only errors written for a human are echoed; a postgres/driver error would leak
  // constraint, column and table names into an admin toast.
  if (error instanceof InvalidOrderTransitionError || error instanceof OrderNotFoundError || error instanceof ZodError) {
    return { ok: false, message: error.message };
  }
  console.error("admin action failed", error);
  return { ok: false, message: "That did not work. Please try again." };
}

export async function saveProduct(rawInput: unknown): Promise<ActionResult> {
  try {
    const isUpdate = Boolean(
      rawInput && typeof rawInput === "object" && (rawInput as { id?: string }).id,
    );
    const id = isUpdate ? await updateProduct(rawInput) : await createProduct(rawInput);

    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${id}`);
    return { ok: true, id };
  } catch (error) {
    return toResult(error);
  }
}

export async function changeProductStatus(
  productId: string,
  status: ProductStatus,
): Promise<ActionResult> {
  try {
    await setProductStatus(productId, status);
    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${productId}`);
    return { ok: true, id: productId };
  } catch (error) {
    return toResult(error);
  }
}

