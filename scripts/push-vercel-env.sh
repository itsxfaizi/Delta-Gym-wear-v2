#!/usr/bin/env bash
# Pushes the runtime environment from .env.local into Vercel (production + preview).
#
# Reads the values already on your machine so no secret is ever typed or pasted.
# DELTA_DEV_ADMIN is deliberately excluded: it is a development-only bypass and
# must never exist in a deployed environment.
#
# Run from the repo root:  bash scripts/push-vercel-env.sh
set -euo pipefail

cd "$(dirname "$0")/.."
[ -f .env.local ] || { echo "No .env.local found"; exit 1; }

KEYS=(
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  DATABASE_URL
  DELTA_TENANT_ID
  NEXT_PUBLIC_APP_NAME
)

for key in "${KEYS[@]}"; do
  value="$(grep -E "^${key}=" .env.local | head -1 | cut -d= -f2- || true)"
  if [ -z "$value" ]; then
    echo "skip   $key (not set locally)"
    continue
  fi
  for target in production preview; do
    printf '%s' "$value" | npx vercel env add "$key" "$target" --force >/dev/null 2>&1 \
      && echo "set    $key ($target)" \
      || echo "FAILED $key ($target)"
  done
done

echo
echo "Now deploy:  npx vercel --prod"
echo "Afterwards set APP_URL and NEXT_PUBLIC_SITE_URL to the deployed URL and redeploy,"
echo "and add that URL plus <url>/auth/callback in Supabase → Authentication → URL Configuration."
