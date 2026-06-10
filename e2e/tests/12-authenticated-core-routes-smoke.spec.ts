/**
 * Fast authenticated smoke for core operating pages.
 *
 * The test is intentionally read-only: it only opens routes and checks that the
 * shell/content renders without App Router, permission, or server digest errors.
 */

import { canAuthenticateAdminPage, expect, getE2eBaseUrl, test } from "../fixtures/auth";
import type { ConsoleMessage, Request } from "@playwright/test";

type CoreRoute = {
  name: string;
  path: string;
  content: RegExp;
};

const coreRoutes: CoreRoute[] = [
  { name: "dashboard", path: "/dashboard", content: /dashboard|tong quan|bella spa/i },
  { name: "ai-copilot", path: "/dashboard/ai-copilot", content: /ai copilot|tro ly|phan tich/i },
  { name: "customers", path: "/dashboard/customers", content: /khach hang|ho so|customer/i },
  { name: "bookings", path: "/dashboard/bookings", content: /lich hen|timeline|booking/i },
  { name: "sessions", path: "/dashboard/sessions", content: /the lieu trinh|lo trinh|sessions/i },
  { name: "chat", path: "/dashboard/chat", content: /tin nhan|hoi thoai|message/i },
  { name: "crm", path: "/dashboard/crm", content: /crm|zalo|marketing/i },
  { name: "meta-ads", path: "/dashboard/marketing", content: /meta ads|quang cao|insight/i },
  { name: "finance", path: "/dashboard/finance", content: /tai chinh|giao dich|finance/i },
  { name: "financial-reconciliation", path: "/dashboard/finance/reconciliation", content: /doi soat|cong no|reconciliation/i },
  { name: "salary", path: "/dashboard/salary", content: /luong ktv|bang luong|salary/i },
  { name: "accounting", path: "/dashboard/accounting", content: /ke toan|so cai|accounting/i },
  { name: "inventory", path: "/dashboard/inventory", content: /kho|ton kho|inventory/i },
  { name: "services", path: "/dashboard/services", content: /dich vu|services/i },
  { name: "system-monitor", path: "/dashboard/system-monitor", content: /trung tam giam sat|system monitor|cron|worker/i },
  { name: "audit", path: "/dashboard/audit", content: /nhat ky|audit|he thong/i },
  { name: "settings", path: "/dashboard/settings", content: /cai dat|settings|goi dich vu/i },
];

const appErrorPatterns = [
  /application error/i,
  /an error occurred in the server components render/i,
  /digest property is included/i,
  /permission denied for table/i,
  /this page could not be found/i,
  /unhandled runtime error/i,
];

const benignConsoleErrorPatterns = [
  /TypeError: Failed to fetch\s+at fetchServerAction/i,
  /(?:Failed to load|Error (?:fetching|loading)).*TypeError: Failed to fetch/i,
  /vercel\.live\/_next-live\/feedback\/feedback\.js.*Content Security Policy/i,
];

function normalizeVietnamese(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

function getAppOrigin(): string {
  try {
    return new URL(getE2eBaseUrl()).origin;
  } catch {
    return "http://localhost:3000";
  }
}

function attachRuntimeCollectors(pageErrors: string[], appOrigin: string) {
  return {
    console: (message: ConsoleMessage) => {
      if (message.type() !== "error") return;
      const text = message.text();
      if (benignConsoleErrorPatterns.some((pattern) => pattern.test(text))) return;
      pageErrors.push(`console.error: ${text}`);
    },
    pageerror: (error: Error) => {
      pageErrors.push(`pageerror: ${error.message}`);
    },
    requestfailed: (request: Request) => {
      const resourceType = request.resourceType();
      if (!["document", "fetch", "xhr", "script"].includes(resourceType)) return;
      const url = request.url();
      if (!url.startsWith(appOrigin) && !url.startsWith("/")) return;
      const failureText = request.failure()?.errorText || "";
      if (resourceType === "fetch" && failureText === "net::ERR_ABORTED") return;
      pageErrors.push(`requestfailed ${resourceType}: ${url} ${failureText}`.trim());
    },
  };
}

test.describe("Authenticated core route smoke", () => {
  test.setTimeout(180_000);

  test.skip(
    !canAuthenticateAdminPage(),
    "Requires E2E admin credentials or localhost Supabase admin env.",
  );

  test("core operating pages render read-only without production errors", async ({ adminPage }) => {
    const pageErrors: string[] = [];
    const collectors = attachRuntimeCollectors(pageErrors, getAppOrigin());
    adminPage.on("console", collectors.console);
    adminPage.on("pageerror", collectors.pageerror);
    adminPage.on("requestfailed", collectors.requestfailed);

    for (const route of coreRoutes) {
      pageErrors.length = 0;

      const response = await adminPage.goto(route.path, { waitUntil: "domcontentloaded" });
      await adminPage.waitForLoadState("load", { timeout: 8_000 }).catch(() => {});

      expect(response?.status() ?? 0, `${route.name} must not return HTTP errors`).toBeLessThan(400);
      await expect(adminPage, `${route.name} should stay on the requested route`).toHaveURL(
        new RegExp(route.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      );

      const body = adminPage.locator("body");
      await expect
        .poll(
          async () => normalizeVietnamese(await body.innerText({ timeout: 5_000 }).catch(() => "")),
          { message: `${route.name} should render expected content`, timeout: 18_000 },
        )
        .toMatch(route.content);

      await adminPage.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

      const normalizedText = normalizeVietnamese(await body.innerText({ timeout: 8_000 }));
      for (const pattern of appErrorPatterns) {
        expect(normalizedText, `${route.name} should not show ${pattern}`).not.toMatch(pattern);
      }

      expect(pageErrors, `${route.name} should not emit browser/runtime errors`).toEqual([]);
    }
  });
});
