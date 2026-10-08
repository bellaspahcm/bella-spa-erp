/**
 * Hospital Browser E2E proof.
 *
 * Scope is intentionally read-only: authenticated browser rendering across the
 * Hospital command surfaces. Operational form mutation and production proof are
 * separate gates.
 */

import { canAuthenticateAdminPage, expect, getE2eBaseUrl, test } from "../fixtures/auth";
import type { ConsoleMessage, Request, Response } from "@playwright/test";

type HospitalRoute = {
  name: string;
  path: string;
  content: RegExp;
};

type NetworkEvidence = {
  method: string;
  resourceType: string;
  status: number;
  path: string;
};

const hospitalRoutes: HospitalRoute[] = [
  { name: "hospital-dashboard", path: "/dashboard/hospital", content: /benh vien da khoa bella|trung tam hanh dong lam sang|danh muc truy cap nhanh/i },
  { name: "hospital-admissions", path: "/dashboard/hospital/admissions", content: /benh an noi tru|inpatient emr|mar hom nay/i },
  { name: "hospital-beds", path: "/dashboard/hospital/beds", content: /trung tam dieu hanh giuong benh noi tru|bed command system|tong giuong/i },
  { name: "hospital-ancillary", path: "/dashboard/hospital/ancillary", content: /trung tam can lam sang|lis|ris|pacs/i },
  { name: "hospital-nursing-vitals", path: "/dashboard/hospital/nursing-vitals", content: /theo doi sinh hieu dieu duong|vital signs monitoring|news2/i },
  { name: "hospital-mar", path: "/dashboard/hospital/mar", content: /phieu thuc hien y lenh thuoc|mar management system|5 rights safety/i },
  { name: "hospital-billing", path: "/dashboard/hospital/billing", content: /vien phi noi tru|thanh toan|inpatient revenue/i },
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
  /vercel\.live\/_next-live\/feedback\/feedback\.js.*Content Security Policy/i,
];

function normalizeVietnamese(value: string): string {
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

function getAppPath(url: string, appOrigin: string): string | null {
  if (url.startsWith("/")) return url.split("?")[0] || "/";
  if (!url.startsWith(appOrigin)) return null;

  try {
    return new URL(url).pathname || "/";
  } catch {
    return null;
  }
}

function getEvidencePath(url: string, appOrigin: string): string | null {
  const appPath = getAppPath(url, appOrigin);
  if (appPath) return appPath;

  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`;
  } catch {
    return null;
  }
}

function pushCapped<T>(items: T[], item: T, maxItems = 40): void {
  items.push(item);
  if (items.length > maxItems) items.shift();
}

function attachRuntimeCollectors(pageErrors: string[], networkEvidence: NetworkEvidence[], appOrigin: string) {
  return {
    console: (message: ConsoleMessage) => {
      if (message.type() !== "error") return;
      const text = message.text();
      if (benignConsoleErrorPatterns.some((pattern) => pattern.test(text))) return;
      pushCapped(pageErrors, `console.error: ${text}`);
    },
    pageerror: (error: Error) => {
      pushCapped(pageErrors, `pageerror: ${error.message}`);
    },
    response: (response: Response) => {
      const request = response.request();
      const resourceType = request.resourceType();
      if (!["document", "fetch", "xhr", "script"].includes(resourceType)) return;

      const path = getEvidencePath(response.url(), appOrigin);
      if (!path) return;

      const event = {
        method: request.method(),
        resourceType,
        status: response.status(),
        path,
      };
      pushCapped(networkEvidence, event);

      if (response.status() >= 400) {
        pushCapped(pageErrors, `response ${event.method} ${event.path} ${event.status} ${event.resourceType}`);
      }
    },
    requestfailed: (request: Request) => {
      const resourceType = request.resourceType();
      if (!["document", "fetch", "xhr", "script"].includes(resourceType)) return;
      const path = getAppPath(request.url(), appOrigin);
      if (!path) return;
      const failureText = request.failure()?.errorText || "";
      if (resourceType === "fetch" && failureText === "net::ERR_ABORTED") return;
      pushCapped(pageErrors, `requestfailed ${resourceType}: ${path} ${failureText}`.trim());
    },
  };
}

function formatNetworkEvidence(networkEvidence: NetworkEvidence[]): string {
  if (networkEvidence.length === 0) return "none";

  return networkEvidence
    .map((event) => `${event.method} ${event.path} ${event.status} ${event.resourceType}`)
    .join(" | ");
}

function formatRouteDiagnostics(input: {
  routeName: string;
  currentUrl: string;
  normalizedText: string;
  pageErrors: string[];
  networkEvidence: NetworkEvidence[];
}): string {
  return [
    `${input.routeName} should render expected Hospital content`,
    `url=${input.currentUrl}`,
    `body=${input.normalizedText.slice(0, 300)}`,
    `recentNetwork=${formatNetworkEvidence(input.networkEvidence)}`,
    `pageErrors=${input.pageErrors.length > 0 ? input.pageErrors.join(" | ") : "none"}`,
  ].join("\n");
}

test.describe("Hospital authenticated browser E2E surface", () => {
  test.skip(
    !canAuthenticateAdminPage(),
    "Requires E2E admin credentials or localhost Supabase admin env.",
  );

  for (const route of hospitalRoutes) {
    test(`${route.name} renders through authenticated browser without runtime errors`, async ({ adminPage }) => {
      const pageErrors: string[] = [];
      const networkEvidence: NetworkEvidence[] = [];
      const collectors = attachRuntimeCollectors(pageErrors, networkEvidence, getAppOrigin());
      adminPage.on("console", collectors.console);
      adminPage.on("pageerror", collectors.pageerror);
      adminPage.on("response", collectors.response);
      adminPage.on("requestfailed", collectors.requestfailed);

      const response = await adminPage.goto(route.path, { waitUntil: "domcontentloaded" });
      await adminPage.waitForLoadState("load", { timeout: 8_000 }).catch(() => {});

      expect(response?.status() ?? 0, `${route.name} must not return HTTP errors`).toBeLessThan(400);
      await expect(adminPage, `${route.name} should stay on the requested route`).toHaveURL(
        new RegExp(route.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      );

      const body = adminPage.locator("body");
      try {
        await expect
          .poll(
            async () => normalizeVietnamese(await body.innerText({ timeout: 5_000 }).catch(() => "")),
            { message: `${route.name} should render expected Hospital content`, timeout: 18_000 },
          )
          .toMatch(route.content);
      } catch (error) {
        const normalizedText = normalizeVietnamese(await body.innerText({ timeout: 5_000 }).catch(() => ""));
        throw new Error(
          `${formatRouteDiagnostics({
            routeName: route.name,
            currentUrl: adminPage.url(),
            normalizedText,
            pageErrors,
            networkEvidence,
          })}\n${error instanceof Error ? error.message : String(error)}`,
        );
      }

      await adminPage.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

      const normalizedText = normalizeVietnamese(await body.innerText({ timeout: 8_000 }));
      for (const pattern of appErrorPatterns) {
        expect(normalizedText, `${route.name} should not show ${pattern}`).not.toMatch(pattern);
      }

      expect(
        pageErrors,
        formatRouteDiagnostics({
          routeName: route.name,
          currentUrl: adminPage.url(),
          normalizedText,
          pageErrors,
          networkEvidence,
        }),
      ).toEqual([]);
    });
  }
});
