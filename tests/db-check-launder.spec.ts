import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { REPO_ROOT } from "./qa-source";

/**
 * `db:check` must not be able to launder tampering.
 *
 * `db:check:write` regenerates `db/migrations.lock` from whatever is on disk, so
 * "edit a migration, then run --write" produces a clean check by design. That is
 * the intended workflow for a legitimately regenerated migration, and it is also
 * the laundering vector. The property that keeps it honest is that the plain,
 * unflagged `db:check` - the one CI and reviewers run - never touches the lock,
 * so a tampered tree can never become a passing tree by being checked.
 *
 * Everything runs against a copy OUTSIDE the repository. `afterAll` re-hashes the
 * real `db/` and fails if a single byte moved, whatever happened above.
 */

const SCRATCH = "/Users/devs/.claude/jobs/7d90bd74/tmp/qa3-dbcheck";
const SANDBOX = path.join(SCRATCH, "repo");
const PRISTINE_DB = path.join(SCRATCH, "pristine-db");
const TAMPER_TARGET = "0001_rls_tenant_isolation.sql";

const sha256 = (file: string): string => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const lockPath = (): string => path.join(SANDBOX, "db", "migrations.lock");
const migration = (): string => path.join(SANDBOX, "db", "migrations", TAMPER_TARGET);

function runDbCheck(...args: string[]): { code: number; output: string } {
  const result = spawnSync("npm", ["run", "--silent", ...args], {
    cwd: SANDBOX,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
    timeout: 180_000,
  });
  return { code: result.status ?? 1, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

function restoreDb(): void {
  fs.rmSync(path.join(SANDBOX, "db"), { recursive: true, force: true });
  fs.cpSync(PRISTINE_DB, path.join(SANDBOX, "db"), { recursive: true });
}

/** Recursive content fingerprint: file list plus each file's SHA-256. */
function fingerprint(root: string): string {
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? walk(full) : [`${path.relative(root, full)}:${sha256(full)}`];
    });
  return walk(root).sort().join("\n");
}

const realDbDir = path.join(REPO_ROOT, "db");
let realDbFingerprint = "";

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  realDbFingerprint = fingerprint(realDbDir);

  fs.rmSync(SCRATCH, { recursive: true, force: true });
  fs.mkdirSync(SCRATCH, { recursive: true });
  // A real copy, not symlinks: `check.mjs` resolves its root from
  // `import.meta.url`, so a symlinked db/ would send it back into the real repo.
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
  // Runs even if a case above threw, unlike a trailing test in a serial describe.
  assert.equal(fingerprint(realDbDir), realDbFingerprint, "the real db/ directory was modified by this spec");
});

/**
 * Fails if a passing `db:check` rewrites `db/migrations.lock`. A check that
 * normalises its own baseline on every green run cannot detect the run after it,
 * because the recorded hashes would always already match whatever is on disk.
 */
test("a passing db:check leaves db/migrations.lock byte-identical", () => {
  restoreDb();
  const before = sha256(lockPath());

  const result = runDbCheck("db:check");
  expect(result.code, `db:check failed on an untampered copy, so this case proves nothing:\n${result.output}`).toBe(0);
  expect(sha256(lockPath()), "a passing db:check rewrote db/migrations.lock").toBe(before);
});

/**
 * The laundering case. Fails if editing a journalled migration and then running
 * the plain `db:check` either passes, or silently re-records the new hash so that
 * the next run would pass.
 */
test("a tampered migration still fails plain db:check, and the lock is not re-recorded", () => {
  restoreDb();
  const before = sha256(lockPath());
  const lockBytes = fs.readFileSync(lockPath(), "utf8");

  fs.appendFileSync(
    migration(),
    "\n-- QA tamper: appended after journalling\nDROP POLICY IF EXISTS products_public_read ON products;\n",
  );

  const first = runDbCheck("db:check");
  expect(first.code, `db:check accepted a tampered migration:\n${first.output}`).not.toBe(0);
  expect(first.output, "the failure does not name the tampered migration").toContain("0001_rls_tenant_isolation");
  expect(sha256(lockPath()), "a failing db:check rewrote db/migrations.lock").toBe(before);
  expect(fs.readFileSync(lockPath(), "utf8"), "the lock file content changed during a failing run").toBe(lockBytes);

  // Run it a second time: a check that laundered on the first run would go green here.
  const second = runDbCheck("db:check");
  expect(second.code, `db:check went green on the second run over the same tampered tree:\n${second.output}`).not.toBe(0);
  expect(sha256(lockPath()), "the second db:check rewrote db/migrations.lock").toBe(before);
});

/**
 * Control, and the documented laundering vector. Fails if `--write` does NOT
 * rewrite the lock - which would mean the byte-identity assertions above pass for
 * the trivial reason that nothing can ever change this file, making them vacuous.
 * It also pins the fact that `--write` records the tampered hash rather than
 * rejecting it, so reviewers know `db:check:write` is a privileged operation.
 */
test("control: db:check:write does re-record the tampered hash, so the checks above are not vacuous", () => {
  restoreDb();
  const before = sha256(lockPath());
  fs.appendFileSync(migration(), "\n-- QA tamper: appended after journalling\n");
  const tamperedHash = sha256(migration());

  const result = runDbCheck("db:check:write");
  expect(result.code, `db:check:write failed:\n${result.output}`).toBe(0);
  expect(sha256(lockPath()), "db:check:write did not rewrite the lock - the immutability assertions are vacuous").not.toBe(
    before,
  );

  const recorded = JSON.parse(fs.readFileSync(lockPath(), "utf8")) as Record<string, string>;
  expect(
    recorded[`db/migrations/${TAMPER_TARGET}`],
    "db:check:write did not record the tampered file's new hash",
  ).toBe(tamperedHash);
});
