import { transitionProductStatus } from "./actions";
import { PRODUCT_STATUSES, TENANT_ROLES, type ProductStatus, type TenantRole } from "./types";
import { resolveTenantPrincipal } from "@/server/authorization/principal";
import { createDatabase } from "@/server/db";

// Relative specifiers: jest.mock does not resolve the "@/" path alias, but both
// specifiers resolve to the same module the action imports. There is no database
// in `npm test`, so the mock boundary is the db handle, as in
// catalog-server-contracts.test.ts.
jest.mock("../../server/db", () => ({ createDatabase: jest.fn() }));
jest.mock("../../server/authorization/principal", () => ({ resolveTenantPrincipal: jest.fn() }));
// A plain function, not a jest.fn: `clearMocks` would strip the implementation.
jest.mock("../../server/observability/request-id", () => ({ getRequestId: async () => "req-fixed" }));

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_TENANT_ID = "99999999-9999-4999-8999-999999999999";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const PRODUCT_ID = "33333333-3333-4333-8333-333333333333";
const REVISION_ID = "44444444-4444-4444-8444-444444444444";
const STALE_REVISION_ID = "55555555-5555-4555-8555-555555555555";

/**
 * Walks a drizzle SQL fragment and collects the column names and bound
 * parameter values it carries. This is how the tenant filter is proved: a test
 * that only inspected the rows a fake returned would pass with the filter
 * deleted.
 */
function sqlAtoms(fragment: unknown, columns: string[] = [], values: string[] = []) {
  const chunks = (fragment as { queryChunks?: readonly unknown[] }).queryChunks;
  if (chunks) {
    for (const chunk of chunks) sqlAtoms(chunk, columns, values);
    return { columns, values };
  }
  const name = (fragment as { name?: unknown }).name;
  const value = (fragment as { value?: unknown }).value;
  if (typeof name === "string") columns.push(name);
  else if (typeof value === "string") values.push(value);
  return { columns, values };
}

type Sink = { audits: Record<string, unknown>[]; updates: Record<string, unknown>[] };
type Read = { where: unknown; locked: boolean };

/**
 * Models the two things the mutation depends on the database for: that writes
 * made inside `transaction` are discarded when the callback throws, and that
 * writes made outside it are not.
 */
function createFakeDatabase(rows: readonly unknown[], options: { auditInsertFails?: boolean; commitFails?: boolean } = {}) {
  const committed: Sink = { audits: [], updates: [] };
  const reads: Read[] = [];

  function executor(sink: Sink) {
    return {
      select() {
        const read: Read = { where: null, locked: false };
        const builder = {
          from: () => builder,
          where(fragment: unknown) {
            read.where = fragment;
            return builder;
          },
          limit: () => builder,
          for(strength: string) {
            read.locked = strength === "update";
            return builder;
          },
          then(onFulfilled: (rows: readonly unknown[]) => unknown, onRejected: (reason: unknown) => unknown) {
            reads.push(read);
            return Promise.resolve(rows).then(onFulfilled, onRejected);
          },
        };
        return builder;
      },
      update() {
        const builder = {
          set(values: Record<string, unknown>) {
            sink.updates.push(values);
            return builder;
          },
          where(fragment: unknown) {
            sink.updates[sink.updates.length - 1].where = fragment;
            return builder;
          },
          then(onFulfilled: (rows: readonly unknown[]) => unknown, onRejected: (reason: unknown) => unknown) {
            return Promise.resolve([]).then(onFulfilled, onRejected);
          },
        };
        return builder;
      },
      insert() {
        const builder = {
          values(values: Record<string, unknown>) {
            if (!options.auditInsertFails) sink.audits.push(values);
            return builder;
          },
          then(onFulfilled: (rows: readonly unknown[]) => unknown, onRejected: (reason: unknown) => unknown) {
            return (options.auditInsertFails
              ? Promise.reject(new Error('insert into "audit_events" violates append-only trigger'))
              : Promise.resolve([])
            ).then(onFulfilled, onRejected);
          },
        };
        return builder;
      },
    };
  }

  const database = {
    ...executor(committed),
    async transaction(callback: (tx: unknown) => Promise<unknown>) {
      const pending: Sink = { audits: [], updates: [] };
      const result = await callback(executor(pending));
      if (options.commitFails) throw new Error("could not serialize access due to concurrent update");
      committed.audits.push(...pending.audits);
      committed.updates.push(...pending.updates);
      return result;
    },
  };

  return { database, committed, reads };
}

function principal(role: TenantRole, tenantId = TENANT_ID) {
  return { userId: USER_ID, tenantId, role, status: "active" as const };
}

function productRow(status: ProductStatus, currentRevisionId: string | null = REVISION_ID) {
  return { status, currentRevisionId };
}

const VALID_INPUT = { productId: PRODUCT_ID, to: "published" as ProductStatus, expectedRevisionId: REVISION_ID };

function arrange(rows: readonly unknown[], role: TenantRole | null, options?: { auditInsertFails?: boolean; commitFails?: boolean }) {
  const fake = createFakeDatabase(rows, options);
  (createDatabase as jest.Mock).mockReturnValue(fake.database);
  (resolveTenantPrincipal as jest.Mock).mockResolvedValue(role === null ? null : principal(role));
  return fake;
}

/** Captures the structured server log so the failure paths can assert on it. */
function captureServerLog() {
  return jest.spyOn(console, "error").mockImplementation(() => {});
}

/**
 * Copied from the approved table in docs/admin-route-spec.md and
 * docs/pass-2-contracts.md, deliberately NOT imported from src/features/catalog/types.ts:
 * if the implementation's table is edited, this one still says what was approved.
 */
const APPROVED_MATRIX: ReadonlyArray<{ from: ProductStatus; to: ProductStatus; allowed: readonly TenantRole[] }> = [
  { from: "draft", to: "published", allowed: ["owner", "publisher"] },
  { from: "published", to: "unpublished", allowed: ["owner", "publisher"] },
  { from: "unpublished", to: "draft", allowed: ["owner", "catalog_editor"] },
  { from: "unpublished", to: "archived", allowed: ["owner"] },
  { from: "archived", to: "draft", allowed: ["owner"] },
];

describe("transitionProductStatus role matrix", () => {
  for (const { from, to, allowed } of APPROVED_MATRIX) {
    for (const role of TENANT_ROLES) {
      const permitted = allowed.includes(role);

      it(`${permitted ? "allows" : "refuses"} ${role} on ${from} -> ${to}`, async () => {
        const { committed } = arrange([productRow(from)], role);

        const result = await transitionProductStatus({ ...VALID_INPUT, to });

        if (permitted) {
          expect(result).toEqual({ ok: true, data: { productId: PRODUCT_ID, status: to, revisionId: REVISION_ID } });
          expect(committed.updates).toHaveLength(1);
          expect(committed.updates[0]).toMatchObject({ status: to });
          expect(committed.audits[0]).toMatchObject({ outcome: "success", before: { status: from }, after: { status: to } });
        } else {
          expect(result).toEqual({ ok: false, code: "FORBIDDEN", message: "You cannot make this change." });
          // The refusal is worthless if the row moved anyway.
          expect(committed.updates).toHaveLength(0);
          expect(committed.audits[0]).toMatchObject({ outcome: "denied", actorUserId: USER_ID, after: { status: to } });
        }
      });
    }
  }

  it("refuses published -> archived for every role, including the owner", async () => {
    for (const role of TENANT_ROLES) {
      const { committed } = arrange([productRow("published")], role);

      const result = await transitionProductStatus({ ...VALID_INPUT, to: "archived" });

      expect(result.ok).toBe(false);
      expect(committed.updates).toHaveLength(0);
    }
  });

  it("refuses a transition to the status the product already has", async () => {
    const { committed } = arrange([productRow("published")], "owner");

    const result = await transitionProductStatus({ ...VALID_INPUT, to: "published" });

    expect(result).toEqual({
      ok: false,
      code: "CONFLICT",
      message: "This product cannot move to that status from its current one.",
    });
    expect(committed.updates).toHaveLength(0);
  });
});

describe("transitionProductStatus non-disclosure", () => {
  it("answers NOT_FOUND identically for a missing product and for another tenant's product", async () => {
    // The tenant filter is what collapses the two cases: the read is scoped to
    // the principal's tenant, so another tenant's id simply returns no row.
    const { reads, committed } = arrange([], "owner");

    const result = await transitionProductStatus(VALID_INPUT);

    expect(result).toEqual({ ok: false, code: "NOT_FOUND", message: "That product is not available." });
    const { columns, values } = sqlAtoms(reads[0].where);
    expect(columns).toEqual(["tenant_id", "id"]);
    expect(values).toEqual([TENANT_ID, PRODUCT_ID]);
    expect(values).not.toContain(OTHER_TENANT_ID);
    expect(committed.audits[0]).toMatchObject({ outcome: "denied", before: null });
  });

  it("scopes the read to the principal's tenant, never to one the caller supplied", async () => {
    const { reads } = arrange([productRow("draft")], "owner");
    (resolveTenantPrincipal as jest.Mock).mockResolvedValue(principal("owner", OTHER_TENANT_ID));

    await transitionProductStatus(VALID_INPUT);

    expect(sqlAtoms(reads[0].where).values).toEqual([OTHER_TENANT_ID, PRODUCT_ID]);
  });

  it("gives a role that can never reach the target the same answer whether the product exists or not", async () => {
    const existing = arrange([productRow("draft")], "auditor");
    const missing = arrange([], "auditor");

    const forExisting = await transitionProductStatus(VALID_INPUT);
    const forMissing = await transitionProductStatus(VALID_INPUT);

    expect(forExisting).toEqual(forMissing);
    expect(forExisting).toEqual({ ok: false, code: "FORBIDDEN", message: "You cannot make this change." });
    // Refused before the read, so there is nothing to leak: no row was queried.
    expect(existing.reads).toHaveLength(0);
    expect(missing.reads).toHaveLength(0);
  });

  it("locks the row it authorizes against", async () => {
    const { reads } = arrange([productRow("draft")], "owner");

    await transitionProductStatus(VALID_INPUT);

    expect(reads[0].locked).toBe(true);
  });
});

describe("transitionProductStatus validation", () => {
  it("rejects a malformed input before resolving a principal or touching the database", async () => {
    arrange([productRow("draft")], "owner");

    const result = await transitionProductStatus({ productId: "not-a-uuid", to: "sideways" as ProductStatus, expectedRevisionId: "" });

    expect(result).toMatchObject({ ok: false, code: "VALIDATION", message: "The request was not valid." });
    expect(Object.keys((result as { fieldErrors: Record<string, string[]> }).fieldErrors).sort()).toEqual([
      "expectedRevisionId",
      "productId",
      "to",
    ]);
    expect(resolveTenantPrincipal).not.toHaveBeenCalled();
    expect(createDatabase).not.toHaveBeenCalled();
  });

  it("rejects every status outside the approved vocabulary", async () => {
    arrange([productRow("draft")], "owner");

    for (const to of ["", "PUBLISHED", "deleted"]) {
      const result = await transitionProductStatus({ ...VALID_INPUT, to: to as ProductStatus });
      expect(result).toMatchObject({ ok: false, code: "VALIDATION" });
    }
    // Sanity: the vocabulary the test rejects is not accidentally empty.
    expect(PRODUCT_STATUSES).toContain("published");
  });
});

describe("transitionProductStatus concurrency", () => {
  it("returns CONFLICT when the expected revision is not the current one", async () => {
    const { committed } = arrange([productRow("draft", STALE_REVISION_ID)], "owner");

    const result = await transitionProductStatus(VALID_INPUT);

    expect(result).toEqual({
      ok: false,
      code: "CONFLICT",
      message: "This product changed since you loaded it. Reload it and try again.",
    });
    expect(committed.updates).toHaveLength(0);
    expect(committed.audits[0]).toMatchObject({ outcome: "conflict", before: { status: "draft" } });
  });

  it("returns CONFLICT rather than transitioning a product that has no current revision", async () => {
    const { committed } = arrange([productRow("draft", null)], "owner");

    const result = await transitionProductStatus(VALID_INPUT);

    expect(result).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(committed.updates).toHaveLength(0);
  });
});

describe("transitionProductStatus audit events", () => {
  it("writes exactly the contract row for a successful transition", async () => {
    const { committed } = arrange([productRow("draft")], "publisher");

    await transitionProductStatus(VALID_INPUT);

    expect(committed.audits).toHaveLength(1);
    expect(committed.audits[0]).toEqual({
      tenantId: TENANT_ID,
      actorUserId: USER_ID,
      action: "product.status_transition",
      targetType: "product",
      targetId: PRODUCT_ID,
      requestId: "req-fixed",
      correlationId: "req-fixed",
      outcome: "success",
      before: { status: "draft" },
      after: { status: "published" },
    });
  });

  it("writes no row at all for an unauthenticated caller", async () => {
    const { committed } = arrange([productRow("draft")], null);

    const result = await transitionProductStatus(VALID_INPUT);

    expect(result).toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Sign in with an account that has access to this catalog.",
    });
    expect(committed.audits).toHaveLength(0);
    expect(committed.updates).toHaveLength(0);
  });

  it("rolls the transition back when the audit insert fails, and discloses nothing", async () => {
    const { committed } = arrange([productRow("draft")], "owner", { auditInsertFails: true });
    const serverLog = captureServerLog();

    const result = await transitionProductStatus(VALID_INPUT);

    expect(result).toEqual({
      ok: false,
      code: "SERVER",
      message: "The change could not be saved. Please try again.",
    });
    // The status update shared the transaction with the failed insert.
    expect(committed.updates).toHaveLength(0);
    expect(committed.audits).toHaveLength(0);
    expect(JSON.stringify(result)).not.toContain("audit_events");
    // The detail is kept, server-side only.
    expect(serverLog.mock.calls[0][0]).toContain("append-only trigger");
  });

  it("never commits an audit row for a transition that did not commit", async () => {
    // Catches an audit insert issued on the pooled handle instead of the
    // transaction: it would survive the rollback and claim a success that
    // never happened.
    const { committed } = arrange([productRow("draft")], "owner", { commitFails: true });
    const serverLog = captureServerLog();

    const result = await transitionProductStatus(VALID_INPUT);

    expect(result).toMatchObject({ ok: false, code: "SERVER" });
    expect(committed.audits).toHaveLength(0);
    expect(committed.updates).toHaveLength(0);
    expect(serverLog.mock.calls[0][0]).toContain("serialize access");
  });

  it("never lets a database failure reach the caller as an exception or a message", async () => {
    arrange([productRow("draft")], "owner");
    (createDatabase as jest.Mock).mockImplementation(() => {
      throw new Error('relation "products" does not exist');
    });
    const serverLog = captureServerLog();

    const result = await transitionProductStatus(VALID_INPUT);

    expect(result).toEqual({
      ok: false,
      code: "SERVER",
      message: "The change could not be saved. Please try again.",
    });
    expect(JSON.stringify(result)).not.toContain("products");
    expect(serverLog.mock.calls[0][0]).toContain("does not exist");
  });
});
