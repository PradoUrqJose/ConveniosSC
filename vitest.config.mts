import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    // Los tests de BD comparten `pg_advisory_xact_lock` de la cadena de auditoría:
    // con RUN_DB_TESTS=1 se ejecutan en serie para evitar contención entre archivos.
    fileParallelism: process.env.RUN_DB_TESTS !== "1",
  },
});
