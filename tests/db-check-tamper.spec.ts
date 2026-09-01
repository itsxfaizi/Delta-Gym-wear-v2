import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { REPO_ROOT } from "./qa-source";

/**
 * Contract F: "`db:check` opens and validates every migration SQL file. It must fail on: a
 * journal entry with no matching `.sql`, a `.sql` with no journal entry, a file whose content
 * changed after journaling, and a snapshot/schema drift. Today it passes with
 * `0001_rls_tenant_isolation.sql` deleted — that is the bar to clear."
 *
 * `db:check` is exercised as a black box: the repo is copied to a scratch tree OUTSIDE the
 * repository, `node_modules` is symlinked in, and every tamper is applied to the copy. The
 * real `db/migrations` is never touched.
 */

const SCRATCH = "/Users/devs/.claude/jobs/7d90bd74/tmp/qa2-dbcheck";
const SANDBOX = path.join(SCRATCH, "repo");
const PRISTINE_DB = path.join(SCRATCH, "pristine-db");
const JOURNALLED_SQL = "0001_rls_tenant_isolation.sql";
const ORPHAN_SQL = "9999_unjournalled_orphan.sql";

type CheckResult = { code: number; output: string };

function runDbCheck(): CheckResult {
  const result = spawnSync("npm", ["run", "--silent", "db:check"], {
    cwd: SANDBOX,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
    timeout: 120_000,
  });
  return { code: result.status ?? 1, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

function restoreMigrations(): void {
  fs.rmSync(path.join(SANDBOX, "db"), { recursive: true, force: true });
  fs.cpSync(PRISTINE_DB, path.join(SANDBOX, "db"), { recursive: true });
}

const migrations = (): string => path.join(SANDBOX, "db", "migrations");

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  fs.rmSync(SCRATCH, { recursive: true, force: true });
  fs.mkdirSync(SCRATCH, { recursive: true });
  // Real copy, not a symlink farm: a check script that resolves paths from `import.meta.url`
  // would otherwise walk back into the real repository and validate the untampered files.
  execFileSync(
    "rsync",
    [
      "-a",
      "--exclude=node_modules",
      "--exclude=.next",
      "--exclude=output",
      "--exclude=test-results",
      "--exclude=design-reference",
      "--exclude=public",
      "--exclude=.swc",
      "--exclude=tsconfig.tsbuildinfo",
      "--exclude=*.png",
      `${REPO_ROOT}/`,
      `${SANDBOX}/`,
    ],
    { stdio: "pipe" },
  );
  fs.symlinkSync(path.join(REPO_ROOT, "node_modules"), path.join(SANDBOX, "node_modules"));
  fs.cpSync(path.join(SANDBOX, "db"), PRISTINE_DB, { recursive: true });
});

test.afterAll(() => {
  fs.rmSync(SCRATCH, { recursive: true, force: true });

  // Runs even when a tamper case fails, unlike a trailing test in a serial describe: the
  // real migrations must be provably untouched whatever happened above.
  const real = path.join(REPO_ROOT, "db", "migrations");
  assert.ok(fs.existsSync(path.join(real, JOURNALLED_SQL)), "the real migration file is missing");
  assert.ok(!fs.existsSync(path.join(real, ORPHAN_SQL)), "the orphan file was written into the real migrations");
  assert.ok(
    !fs.readFileSync(path.join(real, JOURNALLED_SQL), "utf8").includes("QA tamper"),
    "the real migration file was mutated",
  );
  assert.ok(
    JSON.parse(fs.readFileSync(path.join(real, "meta", "_journal.json"), "utf8")).entries.length > 1,
    "the real journal was corrupted",
  );
});

/**
 * Control. Fails if the untampered copy does not pass, which would make every tamper result
 * below meaningless — a check that fails on everything detects nothing.
 */
test("control: db:check passes on an untampered copy", () => {
  restoreMigrations();
  const result = runDbCheck();
  expect(result.code, `db:check failed on a pristine copy:\n${result.output}`).toBe(0);
});

/**
 * Fails if a journal entry whose `.sql` file has been deleted is not detected. This is the
 * documented bar: today `drizzle-kit check` reports "Everything's fine" with this file gone,
 * because it compares snapshots and never opens a SQL file.
 */
test("db:check fails when a journalled migration file is deleted", () => {
  restoreMigrations();
  fs.rmSync(path.join(migrations(), JOURNALLED_SQL));

  const result = runDbCheck();
  expect(result.code, `db:check passed with ${JOURNALLED_SQL} deleted:\n${result.output}`).not.toBe(0);
  expect(result.output, "the failure message does not name the missing migration").toContain(
    "0001_rls_tenant_isolation",
  );
});

/** Fails if a `.sql` file with no journal entry is accepted — an unjournalled migration never runs. */
test("db:check fails on a SQL file with no journal entry", () => {
  restoreMigrations();
  fs.writeFileSync(
    path.join(migrations(), ORPHAN_SQL),
    "-- QA tamper: this file is on disk and absent from _journal.json\nSELECT 1;\n",
  );

  const result = runDbCheck();
  expect(result.code, `db:check accepted an unjournalled migration:\n${result.output}`).not.toBe(0);
  expect(result.output, "the failure message does not name the orphan file").toContain("9999_unjournalled_orphan");
});

/**
 * Fails if the contents of an already-journalled migration can be changed without detection —
 * the case where a reviewed migration is edited after the fact and the deployed database and
 * the repository silently disagree.
 */
test("db:check fails when a journalled migration's contents change", () => {
  restoreMigrations();
  const target = path.join(migrations(), JOURNALLED_SQL);
  fs.appendFileSync(target, "\n-- QA tamper: appended after journalling\nDROP POLICY IF EXISTS products_public_read ON products;\n");

  const result = runDbCheck();
  expect(result.code, `db:check accepted a mutated migration:\n${result.output}`).not.toBe(0);
  expect(result.output, "the failure message does not name the mutated migration").toContain(
    "0001_rls_tenant_isolation",
  );
});

/** Fails if a corrupt journal is not reported as such — a check that cannot read its own index is not a check. */
test("db:check fails on a corrupt journal", () => {
  restoreMigrations();
  fs.writeFileSync(path.join(migrations(), "meta", "_journal.json"), '{"version":"7","entries":[{"idx":0,');

  const result = runDbCheck();
  expect(result.code, `db:check accepted a corrupt journal:\n${result.output}`).not.toBe(0);
  // A non-zero exit reached by crashing is not a report. The output must name the journal or
  // carry the check's own diagnostic prefix, not just a Node stack trace from JSON.parse.
  expect(result.output, "db:check crashed instead of reporting the corrupt journal").toMatch(
    /_journal|db:check FAIL/,
  );
});
