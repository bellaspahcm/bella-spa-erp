import { defineConfig, devices } from "@playwright/test";

const baseUrl = process.env.E2E_BASE_URL?.trim() || "https://bella-spa-erp.vercel.app";

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  forbidOnly: true,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [
    ["list"],
    ["json", { outputFile: "playwright-results.json" }],
  ],
  use: {
    baseURL: baseUrl,
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    trace: "off",
    screenshot: "off",
    video: "off",
    viewport: { width: 1440, height: 900 },
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: undefined,
});
