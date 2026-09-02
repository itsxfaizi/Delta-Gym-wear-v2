/**
 * RLS assertions from docs/pass-2-contracts.md section G, positive and negative.
 *
 * Runs against a throwaway database provisioned by ./harness.mjs, which also
 * creates the Supabase shim (anon/authenticated/service_role + auth.uid()).
 * READ THE HARNESS HEADER: that shim is test scaffolding. A green run proves
 * the migrations behave correctly on a runtime shaped like Supabase's; it is
 * not evidence that the production project is configured identically.
 *
 *   npm run db:test:rls
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import { asPersona, provision, teardown } from "./harness.mjs";

const T_A = "11111111-1111-1111-1111-111111111111";
const T_B = "22222222-2222-2222-2222-222222222222";
const U = {
  ownerA: "a0000000-0000-0000-0000-000000000001",
  editorA: "a0000000-0000-0000-0000-000000000002",
  publisherA: "a0000000-0000-0000-0000-000000000003",
  auditorA: "a0000000-0000-0000-0000-000000000004",
  inactiveA: "a0000000-0000-0000-0000-000000000005",
  ownerB: "b0000000-0000-0000-0000-000000000001",
  editorB: "b0000000-0000-0000-0000-000000000002",
  outsider: "c0000000-0000-0000-0000-000000000001",
};
const O = {
  alpha: "e0000000-0000-0000-0000-000000000001",
  beta: "e0000000-0000-0000-0000-000000000002",
};
/** src/features/catalog/seed.ts. The number the overflow report is written in. */
const SEEDED_PRICE = 599900;
const P = {
  published: "d0000000-0000-0000-0000-000000000001",
  draft: "d0000000-0000-0000-0000-000000000002",
  unpublished: "d0000000-0000-0000-0000-000000000003",
  archived: "d0000000-0000-0000-0000-000000000004",
  bPublished: "d0000000-0000-0000-0000-000000000005",
};

let harness;
let sql;

const anon = { role: "anon" };
const service = { role: "service_role" };
const as = (userId) => ({ role: "authenticated", userId });

/** Assert a statement is refused, and hand back the PostgreSQL error. */
async function refused(persona, fn) {
  try {
    await asPersona(sql, persona, fn);
  } catch (error) {
    return error;
  }
  throw new assert.AssertionError({ message: "expected the statement to be refused" });
}

/** Rows visible to a persona, treating "permission denied" as zero rows: both
 *  mean the caller cannot see the table's contents. */
async function visible(persona, fn) {
  try {
    return await asPersona(sql, persona, fn);
  } catch (error) {
    if (error.code === "42501") return [];
    throw error;
  }
}

/** Assert a statement is refused for the table OWNER too, and hand back the
 *  error. The owner bypasses RLS, so this reaches the constraints themselves. */
async function ownerRefused(statement) {
  try {
    await sql.unsafe(statement);
  } catch (error) {
    return error;
  }
  throw new assert.AssertionError({ message: `expected the statement to be refused: ${statement}` });
}

const ROLLBACK = new Error("rollback");
/** Owner-level work that must not survive the test. */
async function inRollback(fn) {
  let out;
  await sql
    .begin(async (tx) => {
      out = await fn(tx);
      throw ROLLBACK;
    })
    .catch((error) => {
      if (error !== ROLLBACK) throw error;
    });
  return out;
}

before(async () => {
  harness = await provision();
  sql = harness.sql;

  // Fixtures are written as the table owner, which bypasses RLS on purpose:
  // the tests must exercise the policies, not the seeding.
  await sql`INSERT INTO tenants (id, slug, name) VALUES (${T_A}, 'alpha', 'Alpha'), (${T_B}, 'beta', 'Beta')`;
  await sql`
    INSERT INTO memberships (tenant_id, auth_user_id, role, status) VALUES
      (${T_A}, ${U.ownerA},     'owner',          'active'),
      (${T_A}, ${U.editorA},    'catalog_editor', 'active'),
      (${T_A}, ${U.publisherA}, 'publisher',      'active'),
      (${T_A}, ${U.auditorA},   'auditor',        'active'),
      (${T_A}, ${U.inactiveA},  'owner',          'inactive'),
      (${T_B}, ${U.ownerB},     'owner',          'active'),
      (${T_B}, ${U.editorB},    'catalog_editor', 'active')`;

  // Every product starts in draft; the 0000 transition trigger forbids anything
  // else, so the other statuses are walked through the approved workflow.
  await sql`
    INSERT INTO products (id, tenant_id, handle, title) VALUES
      (${P.published},   ${T_A}, 'alpha-published',   'Alpha Published'),
      (${P.draft},       ${T_A}, 'alpha-draft',       'Alpha Draft'),
      (${P.unpublished}, ${T_A}, 'alpha-unpublished', 'Alpha Unpublished'),
      (${P.archived},    ${T_A}, 'alpha-archived',    'Alpha Archived'),
      (${P.bPublished},  ${T_B}, 'beta-published',    'Beta Published')`;
  await sql`UPDATE products SET status = 'published' WHERE id IN (${P.published}, ${P.unpublished}, ${P.archived}, ${P.bPublished})`;
  await sql`UPDATE products SET status = 'unpublished' WHERE id IN (${P.unpublished}, ${P.archived})`;
  await sql`UPDATE products SET status = 'archived' WHERE id = ${P.archived}`;

  for (const [productId, sku] of [
    [P.published, "PUB-1"],
    [P.unpublished, "UNPUB-1"],
  ]) {
    await sql`INSERT INTO product_variants (tenant_id, product_id, sku, price_amount, currency) VALUES (${T_A}, ${productId}, ${sku}, 1000, 'GBP')`;
    await sql`INSERT INTO media_references (tenant_id, product_id, object_key) VALUES (${T_A}, ${productId}, ${`key-${sku}`})`;
  }

  await sql`INSERT INTO product_revisions (tenant_id, product_id, revision_number, status, snapshot, author_user_id) VALUES (${T_A}, ${P.published}, 1, 'published', '{"status":"published"}'::jsonb, ${U.ownerA})`;
  await sql`INSERT INTO audit_events (tenant_id, actor_user_id, action, target_type, target_id, outcome, before, after) VALUES (${T_A}, ${U.ownerA}, 'product.status_transition', 'product', ${P.published}, 'success', '{"status":"draft"}'::jsonb, '{"status":"published"}'::jsonb)`;

  // One COD order per tenant. The payload is invented but shaped like the real
  // thing on purpose - a name, a Pakistani mobile number and a street address
  // are exactly what makes these two tables worth an anon key.
  await sql`
    INSERT INTO orders (id, tenant_id, order_token, order_reference, customer_full_name, customer_phone,
                        address_line_1, city, subtotal_amount, shipping_amount, total_amount, currency)
    VALUES
      (${O.alpha}, ${T_A}, ${"a".repeat(64)}, 'ALPHA-1', 'Alpha Buyer', '03001234567', '1 Alpha Road', 'Karachi', ${SEEDED_PRICE}, 25000, ${SEEDED_PRICE + 25000}, 'PKR'),
      (${O.beta},  ${T_B}, ${"b".repeat(64)}, 'BETA-1',  'Beta Buyer',  '03007654321', '2 Beta Road',  'Lahore',  ${SEEDED_PRICE}, 25000, ${SEEDED_PRICE + 25000}, 'PKR')`;
  await sql`
    INSERT INTO order_items (order_id, product_handle, product_title, variant_id, sku,
                             unit_price_amount, quantity, line_total_amount, currency)
    VALUES
      (${O.alpha}, 'ease-fit-trouser', 'Ease Fit Trouser', 'dev-ease-black-m', 'DEV-EFT-BLK-M', ${SEEDED_PRICE}, 1, ${SEEDED_PRICE}, 'PKR'),
      (${O.beta},  'ease-fit-trouser', 'Ease Fit Trouser', 'dev-ease-black-m', 'DEV-EFT-BLK-M', ${SEEDED_PRICE}, 1, ${SEEDED_PRICE}, 'PKR')`;
});

after(async () => {
  await teardown(harness);
});

describe("anon and the public storefront", () => {
  it("reads published products", async () => {
    const rows = await visible(anon, (tx) => tx`SELECT id FROM products`);
    assert.deepEqual(
      rows.map((r) => r.id).sort(),
      [P.published, P.bPublished].sort(),
      "anon should see exactly the published products",
    );
  });

  it("cannot read draft, unpublished or archived products", async () => {
    const rows = await visible(
      anon,
      (tx) => tx`SELECT id FROM products WHERE id IN (${P.draft}, ${P.unpublished}, ${P.archived})`,
    );
    assert.equal(rows.length, 0);
  });

  it("reads variants and media of a published product", async () => {
    const variants = await visible(anon, (tx) => tx`SELECT id FROM product_variants WHERE product_id = ${P.published}`);
    const media = await visible(anon, (tx) => tx`SELECT id FROM media_references WHERE product_id = ${P.published}`);
    assert.equal(variants.length, 1);
    assert.equal(media.length, 1);
  });

  it("cannot read variants or media of an unpublished product", async () => {
    const variants = await visible(anon, (tx) => tx`SELECT id FROM product_variants WHERE product_id = ${P.unpublished}`);
    const media = await visible(anon, (tx) => tx`SELECT id FROM media_references WHERE product_id = ${P.unpublished}`);
    assert.equal(variants.length, 0);
    assert.equal(media.length, 0);
  });

  it("cannot read media whose status is not exactly 'active'", async () => {
    await sql`UPDATE media_references SET status = 'archived' WHERE product_id = ${P.published}`;
    const media = await visible(anon, (tx) => tx`SELECT id FROM media_references WHERE product_id = ${P.published}`);
    await sql`UPDATE media_references SET status = 'active' WHERE product_id = ${P.published}`;
    assert.equal(media.length, 0);
  });

  it("gets nothing from tenants, memberships, product_revisions and audit_events", async () => {
    for (const table of ["tenants", "memberships", "product_revisions", "audit_events"]) {
      const rows = await visible(anon, (tx) => tx.unsafe(`SELECT 1 FROM ${table}`));
      assert.equal(rows.length, 0, `anon saw rows in ${table}`);
    }
  });

  it("cannot write a product", async () => {
    const error = await refused(
      anon,
      (tx) => tx`INSERT INTO products (tenant_id, handle, title) VALUES (${T_A}, 'anon-made-this', 'x')`,
    );
    assert.equal(error.code, "42501");
  });
});

describe("tenant isolation", () => {
  it("a member sees their own tenant's private rows", async () => {
    const rows = await visible(as(U.ownerA), (tx) => tx`SELECT id FROM products WHERE tenant_id = ${T_A}`);
    assert.equal(rows.length, 4);
  });

  it("an authenticated non-member sees no private row of a tenant they do not belong to", async () => {
    for (const [table, where] of [
      ["tenants", `id = '${T_B}'`],
      ["memberships", `tenant_id = '${T_B}'`],
      ["product_revisions", `tenant_id = '${T_A}'`],
      ["audit_events", `tenant_id = '${T_A}'`],
      // products_public_select is deliberately open to everyone, so the
      // assertion for products is "nothing beyond what anon already sees".
      ["products", `tenant_id = '${T_B}' AND status <> 'published'`],
      ["product_variants", `tenant_id = '${T_A}' AND product_id = '${P.unpublished}'`],
      ["media_references", `tenant_id = '${T_A}' AND product_id = '${P.unpublished}'`],
    ]) {
      const rows = await visible(as(U.outsider), (tx) => tx.unsafe(`SELECT 1 FROM ${table} WHERE ${where}`));
      assert.equal(rows.length, 0, `non-member saw rows in ${table}`);
    }
  });

  it("a catalog_editor of tenant A can write in tenant A", async () => {
    const rows = await asPersona(sql, as(U.editorA), (tx) =>
      tx`INSERT INTO products (tenant_id, handle, title) VALUES (${T_A}, 'editor-a-new', 'New') RETURNING id`);
    assert.equal(rows.length, 1);
  });

  it("a catalog_editor of tenant A cannot INSERT into tenant B", async () => {
    const error = await refused(as(U.editorA), (tx) =>
      tx`INSERT INTO products (tenant_id, handle, title) VALUES (${T_B}, 'cross-tenant', 'x')`);
    assert.equal(error.code, "42501");
  });

  it("a catalog_editor of tenant A cannot UPDATE a row in tenant B", async () => {
    const rows = await asPersona(sql, as(U.editorA), (tx) =>
      tx`UPDATE products SET title = 'hijacked' WHERE id = ${P.bPublished} RETURNING id`);
    assert.equal(rows.length, 0, "the update must match zero rows, not raise");
  });

  it("a catalog_editor of tenant A cannot DELETE a row in tenant B", async () => {
    // The DELETE privilege on product_variants is held by `authenticated` as a
    // database role, so the refusal is RLS filtering the row set to nothing
    // rather than a privilege error. Zero rows is the whole point: the editor
    // cannot tell whether tenant B has variants at all.
    const rows = await asPersona(sql, as(U.editorA), (tx) =>
      tx`DELETE FROM product_variants WHERE tenant_id = ${T_B} RETURNING id`);
    assert.equal(rows.length, 0);
    const [row] = await sql`SELECT count(*)::int AS n FROM product_variants WHERE tenant_id = ${T_B}`;
    assert.equal(row.n, 0, "fixture sanity: tenant B has no variants to delete");
  });
});

describe("membership escalation", () => {
  it("an owner can insert a membership in their own tenant", async () => {
    const rows = await asPersona(sql, as(U.ownerA), (tx) =>
      tx`INSERT INTO memberships (tenant_id, auth_user_id, role) VALUES (${T_A}, ${U.outsider}, 'auditor') RETURNING auth_user_id`);
    assert.equal(rows.length, 1);
  });

  it("a non-owner cannot grant itself a membership", async () => {
    for (const user of [U.editorA, U.publisherA, U.auditorA, U.outsider]) {
      const error = await refused(as(user), (tx) =>
        tx`INSERT INTO memberships (tenant_id, auth_user_id, role) VALUES (${T_B}, ${user}, 'owner')`);
      assert.equal(error.code, "42501", `${user} was able to self-grant`);
    }
  });
});

describe("append-only tables", () => {
  it("an editor can INSERT a product revision authored by itself", async () => {
    const rows = await asPersona(sql, as(U.editorA), (tx) =>
      tx`INSERT INTO product_revisions (tenant_id, product_id, revision_number, status, snapshot, author_user_id)
         VALUES (${T_A}, ${P.published}, 2, 'published', '{"status":"published"}'::jsonb, ${U.editorA}) RETURNING id`);
    assert.equal(rows.length, 1);
  });

  it("an editor cannot forge another user's authorship", async () => {
    const error = await refused(as(U.editorA), (tx) =>
      tx`INSERT INTO product_revisions (tenant_id, product_id, revision_number, status, snapshot, author_user_id)
         VALUES (${T_A}, ${P.published}, 3, 'published', '{}'::jsonb, ${U.ownerA})`);
    assert.equal(error.code, "42501");
  });

  it("UPDATE and DELETE on product_revisions and audit_events are refused", async () => {
    for (const table of ["product_revisions", "audit_events"]) {
      const update = await refused(as(U.ownerA), (tx) => tx.unsafe(`UPDATE ${table} SET tenant_id = tenant_id`));
      assert.equal(update.code, "42501", `${table} UPDATE`);
      const del = await refused(as(U.ownerA), (tx) => tx.unsafe(`DELETE FROM ${table}`));
      assert.equal(del.code, "42501", `${table} DELETE`);
    }
  });

  it("UPDATE and DELETE are refused even for the table owner, by trigger", async () => {
    for (const table of ["product_revisions", "audit_events"]) {
      await assert.rejects(
        () => sql.unsafe(`UPDATE ${table} SET tenant_id = tenant_id`),
        (error) => error.code === "23001" && /immutable/.test(error.message),
        `${table} UPDATE`,
      );
      await assert.rejects(
        () => sql.unsafe(`DELETE FROM ${table}`),
        (error) => error.code === "23001",
        `${table} DELETE`,
      );
    }
  });

  it("TRUNCATE is refused on product_revisions and audit_events", async () => {
    // A bare `TRUNCATE product_revisions` is refused earlier, by the FK from
    // products.current_revision_id (SQLSTATE 0A000). CASCADE is the statement
    // that gets far enough to need the trigger, so that is what is asserted.
    for (const statement of ["TRUNCATE product_revisions CASCADE", "TRUNCATE audit_events"]) {
      await assert.rejects(
        () => sql.unsafe(statement),
        (error) => error.code === "23001" && /immutable/.test(error.message),
        statement,
      );
    }
  });

  it("TRUNCATE products CASCADE cannot launder the append-only tables", async () => {
    await assert.rejects(
      () => sql.unsafe("TRUNCATE products CASCADE"),
      (error) => error.code === "23001",
    );
  });

  it("service_role holds no TRUNCATE privilege on the append-only tables", async () => {
    const [row] = await sql`
      SELECT count(*)::int AS n FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND grantee = 'service_role'
        AND privilege_type = 'TRUNCATE'
        AND table_name IN ('product_revisions', 'audit_events')`;
    assert.equal(row.n, 0);
  });
});

describe("current_tenant_role", () => {
  it("returns the role for an active membership", async () => {
    const [row] = await asPersona(sql, as(U.publisherA), (tx) =>
      tx`SELECT public.current_tenant_role(${T_A}) AS role`);
    assert.equal(row.role, "publisher");
  });

  it("returns NULL when the membership is not active", async () => {
    const [row] = await asPersona(sql, as(U.inactiveA), (tx) =>
      tx`SELECT public.current_tenant_role(${T_A}) AS role`);
    assert.equal(row.role, null);
  });

  it("returns NULL for a tenant the caller does not belong to", async () => {
    const [row] = await asPersona(sql, as(U.ownerA), (tx) =>
      tx`SELECT public.current_tenant_role(${T_B}) AS role`);
    assert.equal(row.role, null);
  });
});

describe("publisher is scoped to the status column", () => {
  it("can move a product's status through the approved workflow", async () => {
    const rows = await asPersona(sql, as(U.publisherA), (tx) =>
      tx`UPDATE products SET status = 'unpublished' WHERE id = ${P.published} RETURNING status`);
    assert.equal(rows[0].status, "unpublished");
  });

  it("cannot change a product's title", async () => {
    const error = await refused(as(U.publisherA), (tx) =>
      tx`UPDATE products SET title = 'renamed by publisher' WHERE id = ${P.published}`);
    assert.equal(error.code, "42501");
    assert.match(error.message, /publisher may only change a product status/);
  });

  it("cannot change a product's handle or description either", async () => {
    for (const statement of ["handle = 'renamed'", "description = 'injected'"]) {
      const error = await refused(as(U.publisherA), (tx) =>
        tx.unsafe(`UPDATE products SET ${statement} WHERE id = '${P.published}'`));
      assert.equal(error.code, "42501");
    }
  });

  it("a catalog_editor may still change the title", async () => {
    const rows = await asPersona(sql, as(U.editorA), (tx) =>
      tx`UPDATE products SET title = 'renamed by editor' WHERE id = ${P.published} RETURNING title`);
    assert.equal(rows[0].title, "renamed by editor");
  });
});

describe("hard delete is not a launch operation", () => {
  it("no database role holds DELETE on products", async () => {
    const rows = await sql`
      SELECT grantee FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND table_name = 'products' AND privilege_type = 'DELETE'
        AND grantee IN ('anon', 'authenticated', 'service_role')`;
    assert.equal(rows.length, 0, `DELETE still granted to: ${JSON.stringify(rows)}`);
  });

  it("no DELETE policy exists on products", async () => {
    const rows = await sql`SELECT policyname FROM pg_policies WHERE tablename = 'products' AND cmd = 'DELETE'`;
    assert.equal(rows.length, 0, `DELETE policy still present: ${JSON.stringify(rows)}`);
  });

  it("an owner's DELETE is refused", async () => {
    const error = await refused(as(U.ownerA), (tx) => tx`DELETE FROM products WHERE id = ${P.draft}`);
    assert.equal(error.code, "42501");
  });

  it("the table owner's DELETE is refused by name, not by a cascade into another table", async () => {
    await assert.rejects(
      () => sql`DELETE FROM products WHERE id = ${P.published}`,
      (error) => error.code === "23001" && /products cannot be hard deleted/.test(error.message),
    );
  });
});

describe("column constraints the storefront and the audit trail depend on", () => {
  it("media_references.status accepts 'active'", async () => {
    const rows = await sql`INSERT INTO media_references (tenant_id, product_id, object_key, status)
      VALUES (${T_A}, ${P.draft}, 'ok-key', 'active') RETURNING id`;
    assert.equal(rows.length, 1);
  });

  it("media_references.status rejects 'Active' and ' active '", async () => {
    for (const status of ["Active", " active "]) {
      await assert.rejects(
        () => sql`INSERT INTO media_references (tenant_id, product_id, object_key, status)
                  VALUES (${T_A}, ${P.draft}, ${`bad-${status}`}, ${status})`,
        (error) => error.code === "23514" && /media_references_status_check/.test(error.message),
        status,
      );
    }
  });

  it("audit_events accepts exactly the shape in contract D", async () => {
    const rows = await sql`
      INSERT INTO audit_events (tenant_id, actor_user_id, action, target_type, target_id, request_id, correlation_id, outcome, before, after)
      VALUES (${T_A}, ${U.ownerA}, 'product.status_transition', 'product', ${P.draft}, 'req-1', 'req-1', 'denied', '{"status":"draft"}'::jsonb, '{"status":"draft"}'::jsonb)
      RETURNING id`;
    assert.equal(rows.length, 1);
  });

  it("audit_events rejects an unattributed row", async () => {
    await assert.rejects(
      () => sql`INSERT INTO audit_events (tenant_id, action, target_type, outcome) VALUES (${T_A}, 'x', 'product', 'denied')`,
      (error) => error.code === "23502" && /actor_user_id/.test(error.message),
    );
  });

  it("audit_events rejects an outcome outside the contract vocabulary", async () => {
    await assert.rejects(
      () => sql`INSERT INTO audit_events (tenant_id, actor_user_id, action, target_type, outcome)
                VALUES (${T_A}, ${U.ownerA}, 'x', 'product', 'partially-ok')`,
      (error) => error.code === "23514" && /audit_events_outcome_check/.test(error.message),
    );
  });

  it("audit_events rejects a before/after payload carrying anything but status", async () => {
    await assert.rejects(
      () => sql`INSERT INTO audit_events (tenant_id, actor_user_id, action, target_type, outcome, before)
                VALUES (${T_A}, ${U.ownerA}, 'x', 'product', 'success', '{"status":"draft","email":"a@b.c"}'::jsonb)`,
      (error) => error.code === "23514" && /audit_events_before_shape_check/.test(error.message),
    );
    await assert.rejects(
      () => sql`INSERT INTO audit_events (tenant_id, actor_user_id, action, target_type, outcome, after)
                VALUES (${T_A}, ${U.ownerA}, 'x', 'product', 'success', '{"title":"leaked"}'::jsonb)`,
      (error) => error.code === "23514" && /audit_events_after_shape_check/.test(error.message),
    );
  });

  it("an auditor can read audit_events; an editor cannot", async () => {
    const auditor = await visible(as(U.auditorA), (tx) => tx`SELECT id FROM audit_events WHERE tenant_id = ${T_A}`);
    const editor = await visible(as(U.editorA), (tx) => tx`SELECT id FROM audit_events WHERE tenant_id = ${T_A}`);
    assert.ok(auditor.length > 0);
    assert.equal(editor.length, 0);
  });

  it("no authenticated role can INSERT an audit event", async () => {
    const error = await refused(as(U.ownerA), (tx) =>
      tx`INSERT INTO audit_events (tenant_id, actor_user_id, action, target_type, outcome) VALUES (${T_A}, ${U.ownerA}, 'x', 'product', 'success')`);
    assert.equal(error.code, "42501");
  });
});

describe("RLS coverage", () => {
  it("every table in public has row level security enabled", async () => {
    const rows = await sql`
      SELECT relname FROM pg_class
      WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND NOT relrowsecurity`;
    assert.equal(rows.length, 0, `RLS disabled on: ${JSON.stringify(rows)}`);
  });

  it("every anon/authenticated grant has a policy for the same table and command", async () => {
    const rows = await sql`
      SELECT g.table_name, g.grantee, g.privilege_type
      FROM information_schema.role_table_grants g
      WHERE g.table_schema = 'public'
        AND g.grantee IN ('anon', 'authenticated')
        AND g.privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
        AND NOT EXISTS (
          SELECT 1 FROM pg_policies p
          WHERE p.tablename = g.table_name
            AND (p.cmd = g.privilege_type OR p.cmd = 'ALL')
            AND g.grantee = ANY (p.roles))`;
    assert.equal(rows.length, 0, `grant with no policy: ${JSON.stringify(rows)}`);
  });

  it("every policy has a matching grant", async () => {
    const rows = await sql`
      SELECT p.tablename, p.policyname, p.cmd, r.rolname
      FROM pg_policies p
      CROSS JOIN LATERAL unnest(p.roles) AS r(rolname)
      WHERE r.rolname IN ('anon', 'authenticated')
        AND NOT EXISTS (
          SELECT 1 FROM information_schema.role_table_grants g
          WHERE g.table_schema = 'public' AND g.table_name = p.tablename
            AND g.grantee = r.rolname AND g.privilege_type = p.cmd)`;
    assert.equal(rows.length, 0, `policy with no grant: ${JSON.stringify(rows)}`);
  });
});

// ---------------------------------------------------------------------------
// COD order tables. Supabase publishes every table in `public` over PostgREST
// with the anon key, which ships to every browser; `orders` holds a customer's
// name, Pakistani mobile number and home address, and `order_items` holds what
// they bought. 0003 answered that by granting anon and authenticated nothing
// at all. These assertions are what stops a later migration handing it back.
// ---------------------------------------------------------------------------

/** One statement per SQL command, per table, all of them harmless if they
 *  somehow succeed - the point is the privilege check, not the effect. */
const ORDER_STATEMENTS = {
  orders: {
    SELECT: `SELECT customer_phone, address_line_1 FROM orders`,
    INSERT:
      `INSERT INTO orders (tenant_id, order_token, order_reference, customer_full_name, customer_phone,` +
      ` address_line_1, city, subtotal_amount, shipping_amount, total_amount, currency)` +
      ` VALUES ('${T_A}', 'probe-token', 'PROBE-1', 'Probe', '03000000000', 'probe road', 'Karachi', 1, 0, 1, 'PKR')`,
    UPDATE: `UPDATE orders SET city = city`,
    DELETE: `DELETE FROM orders`,
  },
  order_items: {
    SELECT: `SELECT sku, quantity FROM order_items`,
    INSERT:
      `INSERT INTO order_items (order_id, product_handle, product_title, variant_id, sku,` +
      ` unit_price_amount, quantity, line_total_amount, currency)` +
      ` VALUES ('${O.alpha}', 'h', 't', 'v', 's', 1, 1, 1, 'PKR')`,
    UPDATE: `UPDATE order_items SET quantity = quantity`,
    DELETE: `DELETE FROM order_items`,
  },
};

const UNPRIVILEGED = [
  ["anon", anon],
  ["authenticated member of the order's tenant", as(U.ownerA)],
  ["authenticated member of another tenant", as(U.editorB)],
  ["authenticated non-member", as(U.outsider)],
];

describe("orders and order_items are unreachable by anon and authenticated", () => {
  for (const [label, persona] of UNPRIVILEGED) {
    for (const [table, statements] of Object.entries(ORDER_STATEMENTS)) {
      for (const [command, statement] of Object.entries(statements)) {
        it(`${label} cannot ${command} ${table}`, async () => {
          const error = await refused(persona, (tx) => tx.unsafe(statement));
          assert.equal(error.code, "42501", `${command} ${table} as ${label}: ${error.message}`);
        });
      }
    }
  }

  it("holds no privilege on either table in the catalog, not merely in practice", async () => {
    const rows = await sql`
      SELECT table_name, grantee, privilege_type FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND table_name IN ('orders', 'order_items')
        AND grantee IN ('anon', 'authenticated')`;
    assert.equal(rows.length, 0, `unexpected grant: ${JSON.stringify(rows)}`);
  });

  it("has no policy on either table either, so RLS is default-deny", async () => {
    const rows = await sql`
      SELECT policyname, tablename FROM pg_policies
      WHERE schemaname = 'public' AND tablename IN ('orders', 'order_items')`;
    assert.equal(rows.length, 0, `unexpected policy: ${JSON.stringify(rows)}`);
  });

  it("keeps row level security enabled on both tables after 0004", async () => {
    const rows = await sql`
      SELECT relname FROM pg_class
      WHERE relnamespace = 'public'::regnamespace
        AND relname IN ('orders', 'order_items') AND NOT relrowsecurity`;
    assert.equal(rows.length, 0, `RLS disabled on: ${JSON.stringify(rows)}`);
  });

  it("service_role can read and write both tables", async () => {
    // BYPASSRLS is a Supabase deployment fact reproduced by the harness shim,
    // not something these migrations can assert. Checked explicitly so that a
    // shim that quietly loses it fails here instead of turning the reads below
    // into a silent zero-row pass.
    const [role] = await sql`SELECT rolbypassrls FROM pg_roles WHERE rolname = 'service_role'`;
    assert.equal(
      role.rolbypassrls,
      true,
      "harness shim: service_role must bypass RLS, as Supabase's does. A stale cluster-wide " +
        "role from an older run is the usual cause - `DROP ROLE service_role` and re-run.",
    );

    await asPersona(sql, service, async (tx) => {
      const orders = await tx`SELECT id FROM orders`;
      const items = await tx`SELECT id FROM order_items`;
      assert.equal(orders.length, 2, "service_role should see both tenants' orders");
      assert.equal(items.length, 2);
    });
    // One persona per statement: asPersona rolls back, so DELETE FROM orders
    // does not cascade the row the next INSERT INTO order_items needs.
    for (const [table, statements] of Object.entries(ORDER_STATEMENTS)) {
      for (const [command, statement] of Object.entries(statements)) {
        if (command === "SELECT") continue;
        await asPersona(sql, service, (tx) => tx.unsafe(statement)).catch((error) => {
          throw new assert.AssertionError({ message: `service_role ${command} ${table}: ${error.message}` });
        });
      }
    }
  });

  it("cross-tenant: a member of tenant B cannot reach tenant A's order by id", async () => {
    for (const statement of [
      `SELECT customer_phone FROM orders WHERE id = '${O.alpha}'`,
      `SELECT sku FROM order_items WHERE order_id = '${O.alpha}'`,
      `UPDATE orders SET city = 'x' WHERE id = '${O.alpha}'`,
      `DELETE FROM order_items WHERE order_id = '${O.alpha}'`,
    ]) {
      const error = await refused(as(U.ownerB), (tx) => tx.unsafe(statement));
      assert.equal(error.code, "42501", statement);
    }
  });
});

describe("overflow is a database problem, not an application one", () => {
  // 100 cart lines x 99 units is legal input (src/features/catalog/cart.ts);
  // at the seeded price that is 5,939,010,000 minor units, which int4 cannot
  // hold. 0004 widens the money columns to int8 and bounds them.
  const OVERFLOWING_SUBTOTAL = 100 * 99 * SEEDED_PRICE;

  it("the reported cart really does exceed int4", async () => {
    assert.equal(OVERFLOWING_SUBTOTAL, 5_939_010_000);
    await assert.rejects(
      () => sql`SELECT ${OVERFLOWING_SUBTOTAL}::integer`,
      (error) => error.code === "22003",
      "the pre-0004 column type would still refuse this value",
    );
  });

  it("stores the overflowing order exactly, and reads it back exactly", async () => {
    const stored = await inRollback(async (tx) => {
      const [order] = await tx`
        INSERT INTO orders (tenant_id, order_token, order_reference, customer_full_name, customer_phone,
                            address_line_1, city, subtotal_amount, shipping_amount, total_amount, currency)
        VALUES (${T_A}, ${"c".repeat(64)}, 'BIG-1', 'Bulk Buyer', '03009999999', '3 Bulk Road', 'Karachi',
                ${OVERFLOWING_SUBTOTAL}, 0, ${OVERFLOWING_SUBTOTAL}, 'PKR')
        RETURNING id, subtotal_amount, total_amount`;
      // The whole cart, one row per line, so the sum is exercised too.
      await tx`
        INSERT INTO order_items (order_id, product_handle, product_title, variant_id, sku,
                                 unit_price_amount, quantity, line_total_amount, currency)
        SELECT ${order.id}, 'ease-fit-trouser', 'Ease Fit Trouser', 'dev-ease-black-m',
               'DEV-EFT-BLK-M', ${SEEDED_PRICE}, 99, ${99 * SEEDED_PRICE}, 'PKR'
        FROM generate_series(1, 100)`;
      const [sum] = await tx`SELECT sum(line_total_amount)::bigint AS total FROM order_items WHERE order_id = ${order.id}`;
      return { order, sum };
    });
    assert.equal(Number(stored.order.subtotal_amount), OVERFLOWING_SUBTOTAL, "no truncation on the way in or out");
    assert.equal(Number(stored.order.total_amount), OVERFLOWING_SUBTOTAL);
    assert.equal(Number(stored.sum.total), OVERFLOWING_SUBTOTAL, "100 lines x 99 units sums to the order subtotal");
  });

  it("int8 would still overflow, which is why the bounds exist", async () => {
    await assert.rejects(
      () => sql`SELECT 100000000000000000::bigint * 99`,
      (error) => error.code === "22003",
      "widening alone only moves the cliff",
    );
  });

  it("refuses a unit price that would overflow int8 when multiplied out, as a check violation and not an arithmetic error", async () => {
    // 1e17 * 99 is 9.9e18, past int8's 9.223e18. Before the ::numeric rebuild
    // in 0004 this insert came back as 22003 numeric_value_out_of_range raised
    // from inside order_items_amounts_nonnegative - a refusal the application
    // cannot tell apart from a driver bug. It is now a named check violation.
    const error = await ownerRefused(
      `INSERT INTO order_items (order_id, product_handle, product_title, variant_id, sku,` +
        ` unit_price_amount, quantity, line_total_amount, currency)` +
        ` VALUES ('${O.alpha}', 'h', 't', 'v', 's', 100000000000000000, 99, 0, 'PKR')`,
    );
    assert.equal(error.code, "23514", error.message);
    assert.ok(
      ["order_items_line_bounded", "order_items_amounts_nonnegative"].includes(error.constraint_name),
      `unexpected constraint ${error.constraint_name}`,
    );
  });

  it("names the bound when the bound is the only thing violated", async () => {
    // Arithmetic deliberately correct, so only order_items_line_bounded can
    // fail and PostgreSQL's free choice of constraint order cannot make this
    // assertion flaky.
    const error = await ownerRefused(
      `INSERT INTO order_items (order_id, product_handle, product_title, variant_id, sku,` +
        ` unit_price_amount, quantity, line_total_amount, currency)` +
        ` VALUES ('${O.alpha}', 'h', 't', 'v', 's', 2000000000000, 2, 4000000000000, 'PKR')`,
    );
    assert.equal(error.code, "23514", error.message);
    assert.equal(error.constraint_name, "order_items_line_bounded");
  });

  it("refuses a quantity above the cart contract's own ceiling of 99", async () => {
    const error = await ownerRefused(
      `INSERT INTO order_items (order_id, product_handle, product_title, variant_id, sku,` +
        ` unit_price_amount, quantity, line_total_amount, currency)` +
        ` VALUES ('${O.alpha}', 'h', 't', 'v', 's', ${SEEDED_PRICE}, 100, ${100 * SEEDED_PRICE}, 'PKR')`,
    );
    assert.equal(error.code, "23514", error.message);
    assert.equal(error.constraint_name, "order_items_line_bounded");
  });

  it("refuses an order total above the bound, by name rather than by overflow", async () => {
    const error = await ownerRefused(
      `INSERT INTO orders (tenant_id, order_token, order_reference, customer_full_name, customer_phone,` +
        ` address_line_1, city, subtotal_amount, shipping_amount, total_amount, currency)` +
        ` VALUES ('${T_A}', 'over-token', 'OVER-1', 'X', '03000000000', 'r', 'Karachi',` +
        ` 2000000000000000, 0, 2000000000000000, 'PKR')`,
    );
    assert.equal(error.code, "23514", error.message);
    assert.equal(error.constraint_name, "orders_amounts_bounded");
  });

  it("every bounded amount stays inside int8 through its own arithmetic", async () => {
    // The closure argument the bounds are chosen for, checked rather than
    // asserted in a comment: the largest product and the largest sum the
    // schema can be asked to evaluate both fit.
    const [row] = await sql`
      SELECT 1000000000000::bigint * 99 AS max_line,
             1000000000000000::bigint + 1000000000000::bigint AS max_total`;
    assert.ok(Number(row.max_line) < Number.MAX_SAFE_INTEGER);
    assert.equal(Number(row.max_line), 99_000_000_000_000);
    assert.equal(Number(row.max_total), 1_001_000_000_000_000);
  });
});

describe("the price arithmetic the buyer is charged on", () => {
  it("refuses a total that disagrees with subtotal plus shipping", async () => {
    const error = await ownerRefused(
      `INSERT INTO orders (tenant_id, order_token, order_reference, customer_full_name, customer_phone,` +
        ` address_line_1, city, subtotal_amount, shipping_amount, total_amount, currency)` +
        ` VALUES ('${T_A}', 'bad-sum', 'BAD-1', 'X', '03000000000', 'r', 'Karachi', 100, 25, 1, 'PKR')`,
    );
    assert.equal(error.code, "23514");
    assert.equal(error.constraint_name, "orders_amounts_nonnegative");
  });

  it("refuses a negative subtotal or shipping fee", async () => {
    for (const [subtotal, shipping, total] of [[-1, 0, -1], [0, -1, -1]]) {
      const error = await ownerRefused(
        `INSERT INTO orders (tenant_id, order_token, order_reference, customer_full_name, customer_phone,` +
          ` address_line_1, city, subtotal_amount, shipping_amount, total_amount, currency)` +
          ` VALUES ('${T_A}', 'neg-${subtotal}-${shipping}', 'NEG-${subtotal}${shipping}', 'X', '03000000000',` +
          ` 'r', 'Karachi', ${subtotal}, ${shipping}, ${total}, 'PKR')`,
      );
      assert.equal(error.code, "23514");
      assert.equal(error.constraint_name, "orders_amounts_nonnegative");
    }
  });

  it("refuses a line total that disagrees with unit price times quantity", async () => {
    const error = await ownerRefused(
      `INSERT INTO order_items (order_id, product_handle, product_title, variant_id, sku,` +
        ` unit_price_amount, quantity, line_total_amount, currency)` +
        ` VALUES ('${O.alpha}', 'h', 't', 'v', 's', ${SEEDED_PRICE}, 3, ${SEEDED_PRICE}, 'PKR')`,
    );
    assert.equal(error.code, "23514");
    assert.equal(error.constraint_name, "order_items_amounts_nonnegative");
  });

  it("refuses a zero or negative quantity", async () => {
    for (const quantity of [0, -1]) {
      const error = await ownerRefused(
        `INSERT INTO order_items (order_id, product_handle, product_title, variant_id, sku,` +
          ` unit_price_amount, quantity, line_total_amount, currency)` +
          ` VALUES ('${O.alpha}', 'h', 't', 'v', 's', ${SEEDED_PRICE}, ${quantity}, ${quantity * SEEDED_PRICE}, 'PKR')`,
      );
      assert.equal(error.code, "23514");
      assert.equal(error.constraint_name, "order_items_quantity_positive");
    }
  });

  it("accepts the arithmetic when it is right", async () => {
    const rows = await inRollback(
      (tx) => tx`
        INSERT INTO order_items (order_id, product_handle, product_title, variant_id, sku,
                                 unit_price_amount, quantity, line_total_amount, currency)
        VALUES (${O.alpha}, 'h', 't', 'v', 's', ${SEEDED_PRICE}, 3, ${3 * SEEDED_PRICE}, 'PKR')
        RETURNING line_total_amount`,
    );
    assert.equal(Number(rows[0].line_total_amount), 3 * SEEDED_PRICE);
  });
});

describe("mixed currency is refused by the database, not only by the action", () => {
  // A CHECK cannot see another table, so the constraint is a composite FOREIGN
  // KEY on (order_id, currency) into orders(id, currency). Until 0004 this was
  // an application rule in src/features/orders/actions.ts alone.
  it("refuses a line whose currency is not its order's currency", async () => {
    const error = await ownerRefused(
      `INSERT INTO order_items (order_id, product_handle, product_title, variant_id, sku,` +
        ` unit_price_amount, quantity, line_total_amount, currency)` +
        ` VALUES ('${O.alpha}', 'h', 't', 'v', 's', 100, 1, 100, 'USD')`,
    );
    assert.equal(error.code, "23503", error.message);
    assert.equal(error.constraint_name, "order_items_order_currency_fk");
  });

  it("accepts a line in the order's own currency", async () => {
    const rows = await inRollback(
      (tx) => tx`
        INSERT INTO order_items (order_id, product_handle, product_title, variant_id, sku,
                                 unit_price_amount, quantity, line_total_amount, currency)
        VALUES (${O.alpha}, 'h', 't', 'v', 's', 100, 1, 100, 'PKR') RETURNING currency`,
    );
    assert.equal(rows[0].currency, "PKR");
  });

  it("refuses changing an order's currency out from under its lines", async () => {
    const error = await ownerRefused(`UPDATE orders SET currency = 'USD' WHERE id = '${O.alpha}'`);
    assert.equal(error.code, "23503", error.message);
    assert.equal(error.constraint_name, "order_items_order_currency_fk");
  });
});

describe("the COD tables fail closed", () => {
  it("refuses a payment method other than cod and a country other than PK", async () => {
    for (const [column, value, constraint] of [
      ["payment_method", "card", "orders_payment_method_cod"],
      ["country", "US", "orders_country_pk"],
    ]) {
      const error = await ownerRefused(
        `INSERT INTO orders (tenant_id, order_token, order_reference, customer_full_name, customer_phone,` +
          ` address_line_1, city, subtotal_amount, shipping_amount, total_amount, currency, ${column})` +
          ` VALUES ('${T_A}', 'fc-${column}', 'FC-${column}', 'X', '03000000000', 'r', 'Karachi', 1, 0, 1, 'PKR', '${value}')`,
      );
      assert.equal(error.code, "23514");
      assert.equal(error.constraint_name, constraint);
    }
  });

  it("refuses an order with no currency, amount, or delivery address", async () => {
    for (const column of ["currency", "total_amount", "address_line_1", "customer_phone", "tenant_id"]) {
      const [row] = await sql`
        SELECT is_nullable FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = ${column}`;
      assert.equal(row.is_nullable, "NO", `orders.${column} must be NOT NULL`);
    }
    const error = await ownerRefused(
      `INSERT INTO orders (tenant_id, order_token, order_reference, customer_full_name, customer_phone,` +
        ` address_line_1, city, subtotal_amount, shipping_amount, total_amount)` +
        ` VALUES ('${T_A}', 'nn-currency', 'NN-1', 'X', '03000000000', 'r', 'Karachi', 1, 0, 1)`,
    );
    assert.equal(error.code, "23502", error.message);
    assert.equal(error.column_name, "currency");
  });

  it("refuses a duplicate order token or reference", async () => {
    for (const [column, value, constraint] of [
      ["order_token", "a".repeat(64), "orders_order_token_unique"],
      ["order_reference", "ALPHA-1", "orders_order_reference_unique"],
    ]) {
      const other = column === "order_token" ? `order_reference` : `order_token`;
      const otherValue = column === "order_token" ? "DUP-1" : "d".repeat(64);
      const error = await ownerRefused(
        `INSERT INTO orders (tenant_id, ${column}, ${other}, customer_full_name, customer_phone,` +
          ` address_line_1, city, subtotal_amount, shipping_amount, total_amount, currency)` +
          ` VALUES ('${T_A}', '${value}', '${otherValue}', 'X', '03000000000', 'r', 'Karachi', 1, 0, 1, 'PKR')`,
      );
      assert.equal(error.code, "23505");
      assert.equal(error.constraint_name, constraint);
    }
  });

  it("refuses an order for a tenant that does not exist", async () => {
    const error = await ownerRefused(
      `INSERT INTO orders (tenant_id, order_token, order_reference, customer_full_name, customer_phone,` +
        ` address_line_1, city, subtotal_amount, shipping_amount, total_amount, currency)` +
        ` VALUES ('99999999-9999-9999-9999-999999999999', 'ghost', 'GHOST-1', 'X', '03000000000', 'r',` +
        ` 'Karachi', 1, 0, 1, 'PKR')`,
    );
    assert.equal(error.code, "23503");
  });

  it("refuses an order line with no order", async () => {
    const error = await ownerRefused(
      `INSERT INTO order_items (order_id, product_handle, product_title, variant_id, sku,` +
        ` unit_price_amount, quantity, line_total_amount, currency)` +
        ` VALUES ('99999999-9999-9999-9999-999999999999', 'h', 't', 'v', 's', 1, 1, 1, 'PKR')`,
    );
    assert.equal(error.code, "23503");
  });
});

describe("placing an order writes no audit row", () => {
  // docs/pass-2-contracts.md section D: anonymous callers are deliberately not
  // audited, because a row-per-request write on an unauthenticated endpoint is
  // a denial-of-service amplifier. Pinned here so that adding an audit trigger
  // to `orders` is a decision someone has to make on purpose.
  it("no trigger on orders or order_items writes to audit_events", async () => {
    const [before] = await sql`SELECT count(*)::int AS n FROM audit_events`;
    await inRollback(
      (tx) => tx`
        INSERT INTO orders (tenant_id, order_token, order_reference, customer_full_name, customer_phone,
                            address_line_1, city, subtotal_amount, shipping_amount, total_amount, currency)
        VALUES (${T_A}, ${"e".repeat(64)}, 'AUDIT-1', 'X', '03000000000', 'r', 'Karachi', 1, 0, 1, 'PKR')`,
    );
    const [after] = await sql`SELECT count(*)::int AS n FROM audit_events`;
    assert.equal(after.n, before.n, "an anonymous endpoint must not write a row per request");

    const triggers = await sql`
      SELECT tgname, c.relname FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      WHERE NOT t.tgisinternal AND c.relname IN ('orders', 'order_items')`;
    assert.equal(triggers.length, 0, `unexpected trigger: ${JSON.stringify(triggers)}`);
  });
});
