import "server-only";

import { z } from "zod";

/**
 * A key present but blank (.env.example ships every optional value empty) is the
 * same as unset. Without this an empty DATABASE_URL fails .min(1) and takes down
 * every route that reads the env, rather than falling back to the no-database path.
 */
function blankAsUndefined<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((value) => (typeof value === "string" && value.trim() === "" ? undefined : value), schema);
}

const envSchema = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    SUPABASE_SERVICE_ROLE_KEY: blankAsUndefined(z.string().min(1).optional()),
    DATABASE_URL: blankAsUndefined(z.string().min(1).optional()),
    DELTA_TENANT_ID: blankAsUndefined(z.string().uuid().optional()),
    APP_URL: z.string().url(),
    LOG_LEVEL: blankAsUndefined(z.enum(["debug", "info", "warn", "error"]).default("info")),
    NEXT_PUBLIC_APP_NAME: blankAsUndefined(z.string().min(1).default("Delta Gym Wear")),
    SAFEPAY_ENVIRONMENT: blankAsUndefined(z.enum(["sandbox", "production"]).default("sandbox")),
    SAFEPAY_API_KEY: blankAsUndefined(z.string().min(1).optional()),
    SAFEPAY_SECRET_KEY: blankAsUndefined(z.string().min(1).optional()),
    SAFEPAY_WEBHOOK_SECRET: blankAsUndefined(z.string().min(1).optional()),
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

export type SafepayConfig = {
  environment: "sandbox" | "production";
  apiKey: string;
  secretKey: string;
  webhookSecret: string | null;
  appUrl: string;
};

/** Null when Safepay keys are not set: checkout then offers cash on delivery only. */
export function getSafepayConfig(): SafepayConfig | null {
  const env = getServerEnv();
  if (!env.SAFEPAY_API_KEY || !env.SAFEPAY_SECRET_KEY) return null;

  return {
    environment: env.SAFEPAY_ENVIRONMENT,
    apiKey: env.SAFEPAY_API_KEY,
    secretKey: env.SAFEPAY_SECRET_KEY,
    webhookSecret: env.SAFEPAY_WEBHOOK_SECRET ?? null,
    appUrl: env.APP_URL,
  };
}
