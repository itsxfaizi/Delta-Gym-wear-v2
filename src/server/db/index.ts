import "server-only";

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

import { getDatabaseUrl } from "../env";
import { schema } from "./schema";

const databaseGlobal = globalThis as typeof globalThis & {
  deltaPostgresClient?: ReturnType<typeof postgres>;
  deltaDatabase?: ReturnType<typeof drizzle<typeof schema>>;
};

export function createDatabase() {
  if (databaseGlobal.deltaDatabase) return databaseGlobal.deltaDatabase;
  const client = postgres(getDatabaseUrl(), {
    prepare: false,
  });
  const database = drizzle(client, { schema });
  databaseGlobal.deltaPostgresClient = client;
  databaseGlobal.deltaDatabase = database;
  return database;
}

export type Database = ReturnType<typeof createDatabase>;
