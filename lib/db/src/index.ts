import fs from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.ts";

const { Pool } = pg;

declare global {
  var _postgresPool: pg.Pool | undefined;
}

function resolveSqlHost(rawHost?: string): string | undefined {
  if (!rawHost) return undefined;
  if (rawHost.startsWith("/")) {
    if (fs.existsSync(rawHost)) return rawHost;
    const base = path.basename(rawHost);
    if (fs.existsSync(`/cloudsql/${base}`)) return `/cloudsql/${base}`;
    if (fs.existsSync(`/app/cloudsql/${base}`)) return `/app/cloudsql/${base}`;
  }
  return rawHost;
}

export const createPool = () => {
  if (!global._postgresPool) {
    const resolvedHost = resolveSqlHost(process.env.SQL_HOST);
    if (resolvedHost) {
      global._postgresPool = new Pool({
        host: resolvedHost,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DB_NAME,
        max: 10,
        connectionTimeoutMillis: 15000,
      });
    } else if (process.env.DATABASE_URL) {
      global._postgresPool = new Pool({ connectionString: process.env.DATABASE_URL });
    } else {
      global._postgresPool = new Pool({ connectionString: "postgres://dummy:dummy@localhost:5432/dummy" });
    }

    global._postgresPool.on("error", (err) => {
      console.error("Unexpected error on idle SQL pool client:", err);
    });
  }
  return global._postgresPool;
};

export const pool = createPool();
export const db = drizzle(pool, { schema });

export * from "./schema/index.ts";
