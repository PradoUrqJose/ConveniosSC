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
    // Los tests de BD comparten fixtures y tablas: con RUN_DB_TESTS=1 se
    // ejecutan en serie para evitar que sus limpiezas se interfieran.
    fileParallelism: process.env.RUN_DB_TESTS !== "1",
  },
});
