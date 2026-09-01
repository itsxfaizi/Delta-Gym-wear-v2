#!/usr/bin/env node
/**
 * Migration integrity check. `drizzle-kit check` alone never opens a .sql file:
 * it only diffs the snapshots against each other, so deleting
 * 0001_rls_tenant_isolation.sql outright still printed "Everything's fine".
 * This script adds the four checks that matter and then runs drizzle-kit as the
 * last step, so both run.
 *
 *   1. every journal entry has a .sql file          (deleted migration)
 *   2. every .sql file has a journal entry          (orphan / renamed tag)
 *   3. every journal entry has a meta snapshot      (snapshot removed)
 *   4. every file under db/migrations hashes to its recorded SHA-256
 *                                                   (edited after journaling)
 *   5. `drizzle-kit generate` against a scratch copy reports
 *      "No schema changes"                          (schema.ts / snapshot drift)
 *   6. `drizzle-kit check`                          (snapshot-to-snapshot drift)
 *
 * `node db/check.mjs --write` re-records the hashes in db/migrations.lock and
 * is the required step after generating or hand-editing a migration.
 *
 * Node stdlib plus the drizzle-kit already in devDependencies. No new package.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  cpSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(ROOT);

const MIGRATIONS = "db/migrations";
const LOCK = "db/migrations.lock";
const SCHEMA = "src/server/db/schema.ts";
const WRITE = process.argv.includes("--write");

const failures = [];
const fail = (message) => failures.push(message);
/** Report and stop. Used where continuing would mean parsing what we just rejected. */
const abort = () => {
  for (const message of failures) console.error(`db:check FAIL: ${message}`);
  process.exit(1);
};

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const sha256 = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");

/**
 * A checker that dies on its own input reports the wrong thing: the stack names
 * check.mjs, so the reader debugs the checker instead of the file that is broken.
 * Every JSON this script reads is a file it is supposed to be validating.
 */
const readJson = (file, what) => {
  let raw;
  try {
    raw = readFileSync(file, "utf8");
  } catch (error) {
    fail(`${what} could not be read: ${error.code ?? error.message}`);
    abort();
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    fail(`${what} is not valid JSON: ${error.message}`);
    abort();
  }
};

// --- 1/2/3: journal <-> files, both directions ------------------------------
const journal = readJson(join(MIGRATIONS, "meta/_journal.json"), "db/migrations/meta/_journal.json");
if (!Array.isArray(journal?.entries)) {
  fail('db/migrations/meta/_journal.json has no "entries" array');
  abort();
}
const entries = [...journal.entries].sort((a, b) => a.idx - b.idx);
const tags = new Set(entries.map((entry) => entry.tag));

for (const entry of entries) {
  if (!existsSync(join(MIGRATIONS, `${entry.tag}.sql`))) {
    fail(`journal entry ${entry.idx} "${entry.tag}" has no ${entry.tag}.sql`);
  }
  const snapshot = `meta/${String(entry.idx).padStart(4, "0")}_snapshot.json`;
  if (!existsSync(join(MIGRATIONS, snapshot))) {
    fail(`journal entry ${entry.idx} "${entry.tag}" has no ${snapshot}`);
  }
}
for (const file of readdirSync(MIGRATIONS)) {
  if (file.endsWith(".sql") && !tags.has(file.slice(0, -4))) {
    fail(`${file} has no journal entry`);
  }
}

// --- 4: content hashes ------------------------------------------------------
const actual = Object.fromEntries(
  walk(MIGRATIONS)
    .map((file) => relative(ROOT, file).split("\\").join("/"))
    .sort()
    .map((file) => [file, sha256(file)]),
);

if (WRITE) {
  writeFileSync(LOCK, `${JSON.stringify(actual, null, 2)}\n`);
  console.log(`db:check: recorded ${Object.keys(actual).length} hashes in ${LOCK}`);
} else if (!existsSync(LOCK)) {
  fail(`${LOCK} is missing; run \`node db/check.mjs --write\``);
} else {
  const recorded = readJson(LOCK, LOCK);
  for (const [file, hash] of Object.entries(actual)) {
    if (!(file in recorded)) fail(`${file} is not recorded in ${LOCK}`);
    else if (recorded[file] !== hash) fail(`${file} changed after journaling (SHA-256 mismatch)`);
  }
  for (const file of Object.keys(recorded)) {
    if (!(file in actual)) fail(`${file} is recorded in ${LOCK} but missing on disk`);
  }
}

// --- 5: schema/snapshot drift ----------------------------------------------
// `drizzle-kit generate` writes a migration when it finds a difference, so it
// runs against a scratch copy of db/migrations that is deleted either way.
// `server-only` is stripped because the Next compiler supplies it and
// drizzle-kit's loader cannot resolve it.
if (failures.length === 0) {
  const tmp = mkdtempSync("db/.check-");
  try {
    writeFileSync(
      join(tmp, "schema.ts"),
      readFileSync(SCHEMA, "utf8")
        .split("\n")
        .filter((line) => !line.includes("server-only"))
        .join("\n"),
    );
    cpSync(MIGRATIONS, join(tmp, "out"), { recursive: true });
    const out = execFileSync(
      "npx",
      // prettier-ignore
      ["drizzle-kit", "generate", "--dialect", "postgresql",
       "--schema", join(tmp, "schema.ts"), "--out", join(tmp, "out")],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    if (!out.includes("No schema changes")) {
      fail(`schema drift: ${SCHEMA} does not match the migrations\n${out.trim()}`);
    }
  } catch (error) {
    fail(`drizzle-kit generate failed: ${error.stderr || error.message}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// --- 6: drizzle-kit's own snapshot check ------------------------------------
try {
  execFileSync("npx", ["drizzle-kit", "check"], { stdio: ["ignore", "pipe", "pipe"] });
} catch (error) {
  fail(`drizzle-kit check failed: ${error.stdout || error.stderr || error.message}`);
}

if (failures.length > 0) {
  for (const message of failures) console.error(`db:check FAIL: ${message}`);
  process.exit(1);
}
console.log(`db:check ok: ${entries.length} migrations, ${Object.keys(actual).length} files`);
