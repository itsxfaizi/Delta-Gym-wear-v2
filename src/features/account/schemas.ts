import { z } from "zod";

/** Shared by the client forms and the server actions; never duplicate these rules. */
export const signInSchema = z.object({
  email: z.email("Enter a valid email address.").max(320),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const signUpSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name.").max(120),
    email: z.email("Enter a valid email address.").max(320),
    password: z.string().min(8, "Password must be at least 8 characters.").max(72),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: z.email("Enter a valid email address.").max(320),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters.").max(72),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const addressSchema = z.object({
  // An empty hidden input means "new address", so "" must survive validation.
  id: z
    .uuid()
    .or(z.literal(""))
    .optional()
    .transform((value) => value || undefined),
  fullName: z.string().trim().min(2, "Enter the recipient's full name.").max(120),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+][0-9\s-]{6,19}$/, "Enter a valid phone number."),
  line1: z.string().trim().min(4, "Enter the street address.").max(200),
  line2: z.string().trim().max(200).nullable().default(null),
  city: z.string().trim().min(2, "Enter the city.").max(120),
  province: z.string().trim().min(2, "Enter the province.").max(120),
  postalCode: z.string().trim().max(20).nullable().default(null),
  country: z.string().trim().length(2, "Use a 2-letter country code.").default("PK"),
  isDefault: z.boolean().default(false),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type AddressInput = z.infer<typeof addressSchema>;

/** Server actions report failure as data so the client never sees a thrown stack. */
export type ActionResult = { ok: true } | { ok: false; message: string };

export const ACCOUNT_HOME = "/account";
export const LOGIN_PATH = "/login";

/**
 * Only same-origin absolute paths may be followed after sign-in. Anything else
 * (protocol-relative, absolute URL, whitespace-smuggled value) falls back to /account.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return ACCOUNT_HOME;
  if (next.startsWith("/\\") || /\s/.test(next)) return ACCOUNT_HOME;
  return next;
}

export function loginRedirectPath(next?: string | null): string {
  const target = safeNextPath(next);
  return target === ACCOUNT_HOME ? LOGIN_PATH : `${LOGIN_PATH}?next=${encodeURIComponent(target)}`;
}
