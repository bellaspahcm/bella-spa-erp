/**
 * Read-only authenticated production smoke for Hospitality Operations UI.
 *
 * This spec proves that a real E2E admin account can open the production
 * Hospitality console after app authentication. It must not submit the Hotel
 * Core form or mutate production data.
 */

import { canAuthenticateAdminPage, expect, getE2eBaseUrl, test } from "../fixtures/auth";
import type { ConsoleMessage, Request, Response } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

type NetworkEvidence = {
  method: string;
  resourceType: string;
  status: number;
  path: string;
};

const routePath = "/hospitality/hotel-core-chain";

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
      pushCapped(pageErrors, "console.error detected");
    },
    pageerror: (error: Error) => {
      pushCapped(pageErrors, `pageerror: ${error.name || "Error"}`);
    },
    response: (response: Response) => {
      const request = response.request();
      const resourceType = request.resourceType();
      if (!["document", "fetch", "xhr", "script"].includes(resourceType)) return;

      const path = getAppPath(response.url(), appOrigin);
      if (!path) return;

      pushCapped(networkEvidence, {
        method: request.method(),
        resourceType,
        status: response.status(),
        path,
      });
    },
    requestfailed: (request: Request) => {
      const resourceType = request.resourceType();
      if (!["document", "fetch", "xhr", "script"].includes(resourceType)) return;
      const path = getAppPath(request.url(), appOrigin);
      if (!path) return;
      const failureText = request.failure()?.errorText || "";
      if (resourceType === "fetch" && failureText === "net::ERR_ABORTED") return;
      pushCapped(pageErrors, `requestfailed ${resourceType}: ${path}`);
    },
  };
}

async function writeSanitizedEvidence(evidence: Record<string, unknown>): Promise<void> {
  const artifactDir = process.env.HOSPITALITY_PRODUCTION_SMOKE_ARTIFACT_DIR;
  if (!artifactDir) return;

  await mkdir(artifactDir, { recursive: true });
  await writeFile(
    join(artifactDir, "hospitality-production-smoke.json"),
    `${JSON.stringify(evidence, null, 2)}\n`,
    "utf8",
  );
}

test.describe("Hospitality production authenticated UI smoke", () => {
  test.beforeAll(() => {
    if (getE2eBaseUrl() !== "https://bella-spa-erp.vercel.app") {
      throw new Error("Hospitality production smoke must target https://bella-spa-erp.vercel.app.");
    }

    if (!canAuthenticateAdminPage()) {
      throw new Error("Hospitality production smoke requires production E2E admin credentials.");
    }
  });

  test("renders Operations Console read-only after real app authentication", async ({ adminPage, browser }) => {
    const appOrigin = getAppOrigin();

    const unauthenticatedContext = await browser.newContext({
      baseURL: getE2eBaseUrl(),
      locale: "vi-VN",
      timezoneId: "Asia/Ho_Chi_Minh",
      viewport: { width: 1440, height: 900 },
    });
    try {
      const unauthenticatedPage = await unauthenticatedContext.newPage();
      await unauthenticatedPage.goto(routePath, { waitUntil: "domcontentloaded" });
      await unauthenticatedPage.waitForLoadState("load", { timeout: 8_000 }).catch(() => {});
      await expect(
        unauthenticatedPage,
        "Unauthenticated Hospitality route should be challenged by app auth",
      ).toHaveURL(/\/login(?:\?|$)/);
    } finally {
      await unauthenticatedContext.close();
    }

    const pageErrors: string[] = [];
    const networkEvidence: NetworkEvidence[] = [];
    const collectors = attachRuntimeCollectors(pageErrors, networkEvidence, appOrigin);
    adminPage.on("console", collectors.console);
    adminPage.on("pageerror", collectors.pageerror);
    adminPage.on("response", collectors.response);
    adminPage.on("requestfailed", collectors.requestfailed);

    const response = await adminPage.goto(routePath, { waitUntil: "domcontentloaded" });
    await adminPage.waitForLoadState("load", { timeout: 8_000 }).catch(() => {});

    expect(response?.status() ?? 0, "Hospitality route must not return an HTTP error").toBeLessThan(400);
    await expect(adminPage, "Authenticated user should stay on Hospitality route").toHaveURL(/\/hospitality\/hotel-core-chain/);
    expect(adminPage.url(), "Authenticated Hospitality route must not redirect to login").not.toMatch(/\/login(?:\?|$)/);

    await expect(adminPage.locator("header").getByText("Bella Hospitality")).toBeVisible();
    await expect(adminPage.getByRole("heading", { name: "Hotel Operations Console" })).toBeVisible();
    await expect(adminPage.getByTestId("hotel-operations-dashboard")).toContainText("NOT_PROVEN");
    await expect(adminPage.getByTestId("hotel-operations-dashboard")).toContainText("Phòng trống");
    await expect(adminPage.getByTestId("hotel-operations-room-reservation")).toContainText("Phòng và đặt phòng");
    await expect(adminPage.getByTestId("hotel-operations-front-office-folio")).toContainText("Lễ tân và thanh toán");
    await expect(adminPage.getByTestId("hotel-operations-housekeeping")).toContainText("Buồng phòng");
    await expect(adminPage.getByTestId("hotel-operations-maintenance")).toContainText("Bảo trì");

    await adminPage.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

    const normalizedText = normalizeVietnamese(
      await adminPage.locator("body").innerText({ timeout: 8_000 }),
    );
    for (const pattern of appErrorPatterns) {
      expect(normalizedText, `Hospitality production smoke should not show ${pattern}`).not.toMatch(pattern);
    }

    const mutatingRequests = networkEvidence.filter((event) => !["GET", "HEAD", "OPTIONS"].includes(event.method));
    const failedAppResponses = networkEvidence.filter((event) => event.status >= 400);

    expect(mutatingRequests, "Hospitality production smoke must not issue same-origin mutations").toEqual([]);
    expect(failedAppResponses, "Hospitality production smoke should not see same-origin HTTP errors").toEqual([]);
    expect(pageErrors, "Hospitality production smoke should not emit browser/runtime errors").toEqual([]);

    await writeSanitizedEvidence({
      baseUrl: getE2eBaseUrl(),
      route: routePath,
      finalPath: getAppPath(adminPage.url(), appOrigin),
      routeStatus: response?.status() ?? null,
      githubSha: process.env.GITHUB_SHA ?? null,
      githubRunId: process.env.GITHUB_RUN_ID ?? null,
      renderedSections: [
        "hotel-operations-dashboard",
        "hotel-operations-room-reservation",
        "hotel-operations-front-office-folio",
        "hotel-operations-housekeeping",
        "hotel-operations-maintenance",
      ],
      authChallenge: "unauthenticated route redirected to /login",
      readOnly: true,
      sameOriginMutations: mutatingRequests.length,
      sameOriginHttpErrors: failedAppResponses.length,
      runtimeErrors: pageErrors.length,
      recentNetwork: networkEvidence.slice(-20),
    });
  });
});
