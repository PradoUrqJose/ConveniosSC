import { config } from "dotenv";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL_UNPOOLED;

if (!url) {
  console.error("Falta DATABASE_URL_UNPOOLED en .env.local");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("✓ Migración generada aplicada");

  const manualPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "drizzle",
    "manual.sql",
  );
  const manualSql = readFileSync(manualPath, "utf8");
  await client.query(manualSql);
  console.log("✓ Migración manual aplicada");
} catch (err) {
  console.error("✗ Falló la migración:", err);
  process.exitCode = 1;
} finally {
  await client.end();
}
