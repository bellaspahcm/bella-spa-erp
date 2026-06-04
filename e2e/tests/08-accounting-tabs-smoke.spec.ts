/**
 * Authenticated smoke coverage for every Accounting ledger tab.
 *
 * This catches the production-only class of failures where a route renders the
 * App Router Server Component digest overlay after auth/RPC/tenant context breaks.
 */

import { canAuthenticateAdminPage, getE2eBaseUrl, test, expect } from "../fixtures/auth";
import type { ConsoleMessage, Request } from "@playwright/test";

const accountingTabs = [
  { name: "Tong quan", path: "/dashboard/accounting", text: /tong quan|he thong ke toan so cai/i },
  { name: "Nhat ky chung", path: "/dashboard/accounting/journals", text: /nhat ky chung|journal/i },
  { name: "But toan thu cong", path: "/dashboard/accounting/manual-entry", text: /but toan thu cong/i },
  { name: "Ky ke toan", path: "/dashboard/accounting/periods", text: /ky ke toan|khoa so|period/i },
  { name: "Suc khoe so", path: "/dashboard/accounting/health", text: /suc khoe so|health/i },
  { name: "Hang cho hach toan", path: "/dashboard/accounting/outbox", text: /hang cho hach toan|outbox/i },
  { name: "Doi soat cheo", path: "/dashboard/accounting/reconciliation", text: /doi soat cheo|reconciliation/i },
  {
    name: "Doi soat luong",
    path: "/dashboard/accounting/salary-reconciliation",
    text: /doi soat luong|salary/i,
  },
  {
    name: "Bao cao tai chinh",
    path: "/dashboard/accounting/reports",
    text: /bang can doi phat sinh|bao cao ket qua|luu chuyen tien te|trial|financial/i,
  },
  {
    name: "He thong tai khoan",
    path: "/dashboard/accounting/chart-of-accounts",
    text: /he thong tai khoan|coa|chart/i,
  },
  { name: "San sang du lieu", path: "/dashboard/accounting/readiness", text: /san sang du lieu|readiness/i },
] as const;

const appErrorPatterns = [
  /an error occurred in the server components render/i,
  /application error/i,
  /unhandled runtime error/i,
  /this page could not be found/i,
  /digest property is included/i,
];

const runtimeWarningPatterns = [
  /AnimatePresence.*mode=["']wait["']/i,
  /width\(-?\d+\).*height\(-?\d+\).*chart/i,
  /ResponsiveContainer/i,
];

const benignConsoleErrorPatterns = [
  /TypeError: Failed to fetch\s+at fetchServerAction/i,
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

function attachFailureCollectors(pageErrors: string[], appOrigin: string) {
  return {
    console: (message: ConsoleMessage) => {
      const text = message.text();
      if (message.type() === "error") {
        if (benignConsoleErrorPatterns.some((pattern) => pattern.test(text))) return;
        pageErrors.push(`console.error: ${text}`);
        return;
      }

      if (message.type() === "warning" && runtimeWarningPatterns.some((pattern) => pattern.test(text))) {
        pageErrors.push(`console.warning: ${text}`);
      }
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

test.describe("Accounting ledger tabs authenticated smoke", () => {
  test.setTimeout(180_000);

  test.skip(
    !canAuthenticateAdminPage(),
    "Requires E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD for non-local smoke, or Supabase admin env for localhost dev-bypass.",
  );

  test("every accounting tab renders without App Router/RPC errors", async ({ adminPage }) => {
    const pageErrors: string[] = [];
    const collectors = attachFailureCollectors(pageErrors, getAppOrigin());
    adminPage.on("console", collectors.console);
    adminPage.on("pageerror", collectors.pageerror);
    adminPage.on("requestfailed", collectors.requestfailed);

    for (const tab of accountingTabs) {
      pageErrors.length = 0;

      const response = await adminPage.goto(tab.path, { waitUntil: "domcontentloaded" });
      await adminPage.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

      expect(response?.status() ?? 0, `${tab.name} must not return HTTP errors`).toBeLessThan(400);
      await expect(adminPage, `${tab.name} should stay on the requested route`).toHaveURL(
        new RegExp(tab.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      );

      const visibleText = await adminPage.locator("body").innerText({ timeout: 10_000 });
      const normalizedText = normalizeVietnamese(visibleText);
      for (const pattern of appErrorPatterns) {
        expect(normalizedText, `${tab.name} should not show ${pattern}`).not.toMatch(pattern);
      }

      await expect(
        adminPage.locator("[data-testid='accounting-error-boundary']"),
        `${tab.name} should not hit the accounting error boundary`,
      ).toHaveCount(0);

      expect(normalizedText, `${tab.name} should render expected accounting content`).toMatch(tab.text);

      expect(pageErrors, `${tab.name} should not emit browser/runtime errors`).toEqual([]);
    }
  });
});
