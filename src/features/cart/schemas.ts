import { z } from "zod";

import { cartLineInputSchema } from "@/features/catalog/cart";

/** Body shape for both PUT /api/cart (replace) and POST /api/cart/merge (local lines to merge in). */
export const cartLinesRequestSchema = z.object({
  lines: z.array(cartLineInputSchema).max(100),
});

export type CartLinesRequest = z.infer<typeof cartLinesRequestSchema>;
