/**
 * Local RLS test harness — TEST SCAFFOLDING, NOT PRODUCTION CONFIGURATION.
 *
 * There is no Supabase instance in this environment. This module provisions a
 * throwaway PostgreSQL database, emulates the two things Supabase supplies that
 * a bare server does not, applies db/migrations in journal order, and drops the
 * database afterwards.
 *
 * The two emulated objects are:
 *   1. the roles `anon`, `authenticated`, `service_role` (NOLOGIN);
 *   2. an `auth` schema whose `uid()` reads the `request.jwt.claims` GUC,
 *      which is how Supabase implements it.
 *
 * Creating those locally proves the migrations behave correctly GIVEN that
 * runtime. It is NOT evidence that the production Supabase project is
 * configured identically — that remains a deployment fact, not a test result.
 *
 * No connection string is stored here: postgres.js resolves host/port/user from
 * the standard libpq environment (PGHOST/PGPORT/PGUSER/...) and its own
 * localhost defaults.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const MIGRATIONS = new URL("../migrations/", import.meta.url);

/** Roles are CLUSTER-wide, not per-database. We create only what is missing and
 *  drop only what we created, so a pre-existing role of the same name survives.
 *
 *  `service_role` carries BYPASSRLS because Supabase's does: it is the key that
 *  is supposed to see everything, and without the attribute a test asserting
 *  "service_role can read orders" would pass for the wrong reason - RLS is
 *  enabled with no policy, so a grant-holding role that does not bypass RLS
 *  reads zero rows and looks indistinguishable from a role with no grant. */
export const SHIM_ROLES = [
  ["anon", "NOLOGIN"],
  ["authenticated", "NOLOGIN"],
  ["service_role", "NOLOGIN BYPASSRLS"],
];

const AUTH_SHIM = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS auth;
-- Supabase's auth.uid(), reproduced: the JWT claims arrive as a GUC.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
  LANGUAGE sql STABLE
  AS $shim$
    SELECT (nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub')::uuid
  $shim$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
`;

export function migrationFiles() {
  const journal = JSON.parse(readFileSync(new URL("meta/_journal.json", MIGRATIONS), "utf8"));
  return [...journal.entries]
    .sort((a, b) => a.idx - b.idx)
    .map((entry) => ({
      tag: entry.tag,
      path: fileURLToPath(new URL(`${entry.tag}.sql`, MIGRATIONS)),
    }));
}

const NAME_RE = /^delta_rls_test_[a-z0-9_]+$/;
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1"];

export async function provision(name = `delta_rls_test_${process.pid}`) {
  if (!NAME_RE.test(name)) throw new Error(`refusing to manage database ${name}`);
  // The harness only ever creates and drops its own `delta_rls_test_*`
  // database, but CREATE DATABASE on someone's shared cluster is still not our
  // call to make. A unix socket (PGHOST starting with /) or an unset PGHOST is
  // the local server this pass targets.
  const host = process.env.PGHOST;
  if (host && !host.startsWith("/") && !LOCAL_HOSTS.includes(host)) {
    throw new Error(`refusing to provision a test database on non-local host ${host}`);
  }

  const admin = postgres({ database: "postgres", max: 1, onnotice: () => {} });
  const created = [];
  try {
    for (const [role, attributes] of SHIM_ROLES) {
      const [existing] = await admin`SELECT 1 FROM pg_roles WHERE rolname = ${role}`;
      if (!existing) {
        await admin.unsafe(`CREATE ROLE ${role} ${attributes}`);
        created.push(role);
      }
    }
    await admin.unsafe(`DROP DATABASE IF EXISTS ${name}`);
    await admin.unsafe(`CREATE DATABASE ${name}`);
  } finally {
    await admin.end();
  }

  const sql = postgres({ database: name, max: 1, onnotice: () => {} });
  await sql.unsafe(AUTH_SHIM);
  for (const { path } of migrationFiles()) {
    await sql.unsafe(readFileSync(path, "utf8"));
  }
  return { sql, name, createdRoles: created };
}

export async function teardown({ sql, name, createdRoles }) {
  await sql.end();
  const admin = postgres({ database: "postgres", max: 1, onnotice: () => {} });
  try {
    if (!NAME_RE.test(name)) throw new Error(`refusing to drop database ${name}`);
    await admin.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    for (const role of createdRoles ?? []) await admin.unsafe(`DROP ROLE IF EXISTS ${role}`);
  } finally {
    await admin.end();
  }
}

const ROLE_RE = /^[a-z_]+$/;

/** Run `fn` inside one transaction as a Supabase persona, then roll back. */
export async function asPersona(sql, { role, userId = null }, fn) {
  if (!ROLE_RE.test(role)) throw new Error(`bad role ${role}`);
  let out;
  await sql
    .begin(async (tx) => {
      await tx.unsafe(`SET LOCAL ROLE ${role}`);
      await tx`SELECT set_config('request.jwt.claims', ${userId ? JSON.stringify({ sub: userId }) : ""}, true)`;
      out = await fn(tx);
      throw new Rollback();
    })
    .catch((error) => {
      if (!(error instanceof Rollback)) throw error;
    });
  return out;
}

class Rollback extends Error {}
