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
