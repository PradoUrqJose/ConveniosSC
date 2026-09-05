import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const iniciarServidor =
  !process.env.PLAYWRIGHT_BASE_URL ||
  process.env.PLAYWRIGHT_START_SERVER === "1";
const puerto = new URL(baseURL).port || "3000";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "artifacts/playwright/test-results",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  // Un fallo de una matriz responsive sin su viewport ni una imagen obliga a
  // reproducirlo a ciegas. Estas evidencias se conservan como artefacto de CI.
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  reporter: process.env.CI
    ? [
        ["list"],
        [
          "html",
          { outputFolder: "artifacts/playwright/report", open: "never" },
        ],
      ]
    : "list",
  webServer: iniciarServidor
    ? {
        command: `npm run dev -- --port ${puerto}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        env: { ...process.env, NEXT_TEST_CACHE_COMPONENTS: "1" },
      }
    : undefined,
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 5"] } },
  ],
});
