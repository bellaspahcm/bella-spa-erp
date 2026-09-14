/**
 * English Center Post-RC browser validation.
 *
 * This is intentionally read-only. It opens the RC dashboard surfaces, verifies
 * they render without browser/runtime errors, and exercises safe GET API paths
 * through the authenticated browser context.
 */

import { canAuthenticateAdminPage, expect, getE2eBaseUrl, test } from "../fixtures/auth";
import type { ConsoleMessage, Request } from "@playwright/test";

type EnglishCenterRoute = {
  name: string;
  path: string;
  content: RegExp;
};

type EnglishCenterApiProbe = {
  name: string;
  path: string;
  allowedStatuses: readonly number[];
};

const englishCenterRoutes: EnglishCenterRoute[] = [
  { name: "learning", path: "/dashboard/english-center/learning", content: /learning|attendance|diem danh|progress/i },
  { name: "tuition", path: "/dashboard/english-center/tuition", content: /tuition|billing|hoc phi|invoice/i },
  { name: "engagement", path: "/dashboard/english-center/engagement", content: /engagement|message|parent|template/i },
  { name: "command-center", path: "/dashboard/english-center/command-center", content: /command center|chain|branch|work queue/i },
];

const apiProbes: EnglishCenterApiProbe[] = [
  { name: "learning-attendance-validation", path: "/api/english-center/learning/attendance", allowedStatuses: [400] },
  { name: "learning-progress-validation", path: "/api/english-center/learning/progress", allowedStatuses: [400] },
  { name: "tuition-invoice-validation", path: "/api/english-center/tuition/invoices", allowedStatuses: [400] },
  { name: "command-center", path: "/api/english-center/command-center", allowedStatuses: [200] },
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
  /TypeError: Failed to fetch/i,
  /vercel\.live\/_next-live\/feedback\/feedback\.js.*Content Security Policy/i,
];

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

function escapePath(path: string): RegExp {
  return new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}

function appOrigin(): string {
  try {
    return new URL(getE2eBaseUrl()).origin;
  } catch {
    return "http://localhost:3000";
  }
}

function collectRuntimeErrors(pageErrors: string[], origin: string) {
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
      if (!url.startsWith(origin) && !url.startsWith("/")) return;
      const failureText = request.failure()?.errorText || "";
      if (resourceType === "fetch" && failureText === "net::ERR_ABORTED") return;
      pageErrors.push(`requestfailed ${resourceType}: ${url} ${failureText}`.trim());
    },
  };
}

test.describe("English Center Post-RC browser validation", () => {
  test.setTimeout(180_000);

  test.skip(
    !canAuthenticateAdminPage(),
    "Requires E2E admin credentials or localhost Supabase admin env; no live browser PASS is claimed without it.",
  );

  test("RC dashboard routes render without runtime errors", async ({ adminPage }) => {
    const pageErrors: string[] = [];
    const collectors = collectRuntimeErrors(pageErrors, appOrigin());
    adminPage.on("console", collectors.console);
    adminPage.on("pageerror", collectors.pageerror);
    adminPage.on("requestfailed", collectors.requestfailed);

    for (const route of englishCenterRoutes) {
      pageErrors.length = 0;

      const response = await adminPage.goto(route.path, { waitUntil: "domcontentloaded" });
      await adminPage.waitForLoadState("load", { timeout: 10_000 }).catch(() => {});

      expect(response?.status() ?? 0, `${route.name} must not return an HTTP error`).toBeLessThan(400);
      await expect(adminPage, `${route.name} should stay on the requested route`).toHaveURL(escapePath(route.path));

      const body = adminPage.locator("body");
      await expect
        .poll(
          async () => normalizeText(await body.innerText({ timeout: 5_000 }).catch(() => "")),
          { message: `${route.name} should render expected English Center content`, timeout: 20_000 },
        )
        .toMatch(route.content);

      await adminPage.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
      const bodyText = normalizeText(await body.innerText({ timeout: 8_000 }));

      for (const pattern of appErrorPatterns) {
        expect(bodyText, `${route.name} should not show ${pattern}`).not.toMatch(pattern);
      }
      expect(pageErrors, `${route.name} should not emit browser/runtime errors`).toEqual([]);
    }
  });

  test("safe English Center API probes keep authenticated tenant context", async ({ adminPage }) => {
    for (const probe of apiProbes) {
      const response = await adminPage.request.get(probe.path);
      expect(
        probe.allowedStatuses,
        `${probe.name} returned unexpected status ${response.status()}`,
      ).toContain(response.status());

      const contentType = response.headers()["content-type"] || "";
      expect(contentType, `${probe.name} should return JSON`).toContain("application/json");
    }
  });
});
