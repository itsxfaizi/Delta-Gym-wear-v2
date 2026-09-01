import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { REPO_ROOT, relative, sourceFiles } from "./qa-source";

/**
 * Contract D. WHAT IS AND IS NOT TESTED HERE, PLAINLY:
 *
 * The audit row itself is not observable from outside this process. There is no admin UI, no
 * route handler and no client caller for `transitionProductStatus`; `DATABASE_URL` is unset in
 * this environment, so the storefront runs off the development seed and no `audit_events`
 * table is reachable over HTTP. Whether a row is actually written, and with what column
 * values, is only provable in-database — that is `db/tests/`, the Database agent's territory,
 * and this spec does not pretend otherwise.
 *
 * What IS provable from here are the properties of contract D that describe WHEN the insert is
 * issued rather than what it contains, which an in-database test cannot observe:
 *   - an unauthenticated attempt writes no row at all;
 *   - the success-path insert shares the transaction with the status update;
 *   - `before`/`after` are status-only, never a row snapshot;
 *   - nothing but the mutation writes audit rows.
 */

const MUTATION_FILE = "src/features/catalog/actions.ts";

function mutationSource(): string {
  const file = path.join(REPO_ROOT, MUTATION_FILE);
  expect(fs.existsSync(file), `${MUTATION_FILE} does not exist — contract C requires it this pass`).toBe(true);
  return fs.readFileSync(file, "utf8");
}

/**
 * Fails if an audit row can be written before a principal has been resolved. Contract D: "An
 * unauthenticated caller writes no row: we cannot attribute it, and an anonymous endpoint that
 * writes a database row per request is a denial-of-service amplifier."
 */
test("no audit row is written before a principal is resolved", async () => {
  const source = mutationSource();

  const entryAt = source.indexOf("export async function transitionProductStatus");
  expect(entryAt, "the mutation is not exported from this file").toBeGreaterThan(-1);
  const resolveAt = source.indexOf("resolveTenantPrincipal()", entryAt);
  const unauthenticatedAt = source.indexOf('code: "UNAUTHENTICATED"', entryAt);
  expect(resolveAt, "the mutation never resolves a principal").toBeGreaterThan(entryAt);
  expect(unauthenticatedAt, "the mutation has no UNAUTHENTICATED path").toBeGreaterThan(resolveAt);

  const callSites = [...source.matchAll(/writeAuditEvent\s*\(|\.insert\s*\(\s*auditEvents/g)]
    .map((match) => match.index ?? -1)
    .filter((index) => index > entryAt);
  expect(callSites.length, "no audit write site inside the mutation — this test would prove nothing").toBeGreaterThan(0);

  const early = callSites.filter((index) => index < unauthenticatedAt);
  expect(early, "an audit row is written before the UNAUTHENTICATED return").toEqual([]);
});

/**
 * Fails if the status update and its audit row stop sharing one transaction — i.e. if the
 * success-path insert is moved outside `database.transaction(...)`, so a failed audit insert
 * would no longer roll the transition back. Contract C: "The status update and the audit insert
 * share one transaction; if the audit insert fails, the transition rolls back."
 */
test("the status update and its audit row share one transaction", async () => {
  const source = mutationSource();

  const transactionAt = source.indexOf("database.transaction(");
  expect(transactionAt, "the mutation opens no transaction").toBeGreaterThan(-1);

  const updateAt = source.indexOf(".update(products)", transactionAt);
  expect(updateAt, "the mutation never updates products inside the transaction").toBeGreaterThan(transactionAt);

  // The success audit must be issued on the transaction handle, after the update. Passing the
  // top-level `database` handle here would commit the row independently of the transition.
  const successAudit = source.indexOf('writeAuditEvent(transaction, principal, request, "success"', updateAt);
  expect(
    successAudit,
    "the success audit row is not written on the transaction handle after the update",
  ).toBeGreaterThan(updateAt);
});

/**
 * Fails if `before` or `after` ever carries more than the status. Contract D: "before/after
 * carry the status only. No PII, no secrets, no full row snapshots."
 */
test("audit before and after carry the status and nothing else", async () => {
  const source = mutationSource();

  expect(source, "`after` is not a { status } literal").toMatch(/after:\s*\{\s*status:\s*[\w.]+\s*\}/);
  expect(source, "`before` is not a { status } literal").toMatch(/before:\s*[^,\n]*\{\s*status:\s*[\w.]+\s*\}/);

  // A full-row snapshot is the failure mode this guards against.
  expect(source, "`before` carries a whole row").not.toMatch(/before:\s*row\s*[,}]/);
  expect(source, "`after` carries a whole row").not.toMatch(/after:\s*row\s*[,}]/);
});

/**
 * Fails if a second module starts writing audit rows. Contract D says one row per privileged
 * mutation attempt, written by the mutation itself; a second writer means the row count is no
 * longer a count of attempts, and no in-database test would notice.
 */
test("only the mutation writes audit rows", async () => {
  const writers = sourceFiles()
    .filter((file) => !/\.test\.tsx?$/.test(file))
    .filter((file) => /\.insert\s*\(\s*auditEvents/.test(fs.readFileSync(file, "utf8")))
    .map(relative);

  expect(writers, "audit rows are written from somewhere other than the mutation").toEqual([MUTATION_FILE]);
});
