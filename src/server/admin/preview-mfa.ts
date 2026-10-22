import "server-only";

const PRODUCTION_SUPABASE_PROJECT_REF = "imyqylzsqsupanehdnhu";
const TEST_PREVIEW_BRANCH = "codex/feedback-expansion";

/**
 * This opt-out exists only for the isolated branch preview used for manual
 * testing. It requires an explicit flag, the exact test Supabase project, the
 * exact Git branch, and a Vercel preview URL. Production and local deployments
 * always retain the normal MFA gate.
 */
export function isMfaDisabledForIsolatedPreview(): boolean {
  if (
    process.env.DELTA_PREVIEW_MFA_DISABLED !== "true" ||
    process.env.VERCEL_ENV !== "preview" ||
    process.env.VERCEL_GIT_COMMIT_REF !== TEST_PREVIEW_BRANCH
  ) {
    return false;
  }

  const expectedProjectRef = process.env.DELTA_PREVIEW_MFA_DISABLED_SUPABASE_REF;
  if (!expectedProjectRef || !/^[a-z0-9]{20}$/.test(expectedProjectRef)) return false;
  if (expectedProjectRef === PRODUCTION_SUPABASE_PROJECT_REF) return false;

  try {
    const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    const deploymentHost = process.env.VERCEL_URL ?? "";
    return (
      supabaseUrl.protocol === "https:" &&
      supabaseUrl.hostname === `${expectedProjectRef}.supabase.co` &&
      !supabaseUrl.port &&
      !supabaseUrl.username &&
      !supabaseUrl.password &&
      supabaseUrl.pathname === "/" &&
      !supabaseUrl.search &&
      !supabaseUrl.hash &&
      /^[a-z0-9.-]+\.vercel\.app$/.test(deploymentHost)
    );
  } catch {
    return false;
  }
}
