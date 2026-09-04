import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const iniciarServidor =
  !process.env.PLAYWRIGHT_BASE_URL ||
  process.env.PLAYWRIGHT_START_SERVER === "1";
const puerto = new URL(baseURL).port || "3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  use: { baseURL, trace: "on-first-retry" },
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
