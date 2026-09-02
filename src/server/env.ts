import "server-only";

import { z } from "zod";

const envSchema = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
    DATABASE_URL: z.string().min(1).optional(),
    DELTA_TENANT_ID: z.string().uuid().optional(),
    APP_URL: z.string().url(),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    NEXT_PUBLIC_APP_NAME: z.string().min(1).default("Delta Gym Wear"),
  })
  .superRefine((env, context) => {
    if (
      env.SUPABASE_SERVICE_ROLE_KEY &&
      env.SUPABASE_SERVICE_ROLE_KEY === env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      context.addIssue({
        code: "custom",
        path: ["SUPABASE_SERVICE_ROLE_KEY"],
        message: "The service role key must not equal the public anon key.",
      });
    }
  });

export type ServerEnv = z.infer<typeof envSchema>;

/**
 * Parse the environment at the operation boundary. This is intentionally lazy
 * so a static Next.js build can complete without production secrets.
 */
export function getServerEnv(): ServerEnv {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    throw new Error(`Invalid server environment: ${result.error.message}`);
  }

  return result.data;
}

export function getDatabaseUrl(): string {
  const databaseUrl = getServerEnv().DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for database operations.");
  }

  return databaseUrl;
}

export function getCatalogTenantId(): string {
  const tenantId = getServerEnv().DELTA_TENANT_ID;
  if (!tenantId) throw new Error("DELTA_TENANT_ID is required for database-backed catalog reads.");
  return tenantId;
}

export function getServiceRoleKey(): string {
  const serviceRoleKey = getServerEnv().SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for this operation.");
  }

  return serviceRoleKey;
}

export function getCodShippingFeeAmount(): number | null {
  const raw = process.env.DELTA_COD_SHIPPING_FEE_AMOUNT;
  if (!raw) return null;

  const amount = Number(raw);
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error("DELTA_COD_SHIPPING_FEE_AMOUNT must be a nonnegative integer minor-unit amount.");
  }

  return amount;
}

export function getPublicSupabaseConfig(): {
  url: string;
  anonKey: string;
} {
  const env = getServerEnv();

  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}
