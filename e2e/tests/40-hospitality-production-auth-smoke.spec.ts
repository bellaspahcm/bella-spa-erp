/**
 * Read-only authenticated production smoke for Hospitality Operations UI.
 *
 * This spec proves that a real E2E admin account can open the production
 * Hospitality console after app authentication. It must not submit the Hotel
 * Core form or mutate production data.
 */

import { canAuthenticateAdminPage, expect, getE2eBaseUrl, test } from "../fixtures/auth";
import { request as playwrightRequest, type ConsoleMessage, type Request, type Response } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

type NetworkEvidence = {
  method: string;
  resourceType: string;
  status: number;
  path: string;
};

type UnauthenticatedRouteEvidence = {
  html: string;
  location: string | null;
  status: number;
  url: string;
};

const routePath = "/hospitality/hotel-core-chain";
const loginChallengePattern = /\/login(?:\?|$)/;
const loginRedirectPath = `/login?redirect=${encodeURIComponent(routePath)}`;

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

function isUnauthenticatedChallenge(url: string, location: string | null, html: string): boolean {
  const challengedByLoginPage = loginChallengePattern.test(url) || Boolean(location && loginChallengePattern.test(location));
  const challengedByServerRedirectDigest =
    html.includes("NEXT_REDIRECT") && html.includes(loginRedirectPath) && html.includes(";307;");

  return challengedByLoginPage || challengedByServerRedirectDigest;
}

async function fetchUnauthenticatedRoute(): Promise<UnauthenticatedRouteEvidence> {
  const context = await playwrightRequest.newContext({
    baseURL: getE2eBaseUrl(),
    storageState: { cookies: [], origins: [] },
  });

  try {
    const response = await context.get(routePath, {
      failOnStatusCode: false,
      maxRedirects: 0,
    });

    return {
      html: await response.text(),
      location: response.headers().location ?? null,
      status: response.status(),
      url: response.url(),
    };
  } finally {
    await context.dispose();
  }
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

  test("renders Operations Console read-only after real app authentication", async ({ adminPage }) => {
    const appOrigin = getAppOrigin();

    const unauthenticated = await fetchUnauthenticatedRoute();
    expect(unauthenticated.status, "Unauthenticated route probe must not hit an HTTP error").toBeLessThan(400);
    expect(
      unauthenticated.html,
      "Unauthenticated Hospitality route must not render the Operations Console",
    ).not.toContain("Hotel Operations Console");
    expect(
      isUnauthenticatedChallenge(unauthenticated.url, unauthenticated.location, unauthenticated.html),
      "Unauthenticated Hospitality route should be challenged by app auth",
    ).toBe(true);

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
    expect(adminPage.url(), "Authenticated Hospitality route must not redirect to login").not.toMatch(loginChallengePattern);

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
      unauthenticatedRouteStatus: unauthenticated.status,
      unauthenticatedRouteLocation: unauthenticated.location,
      githubSha: process.env.GITHUB_SHA ?? null,
      githubRunId: process.env.GITHUB_RUN_ID ?? null,
      renderedSections: [
        "hotel-operations-dashboard",
        "hotel-operations-room-reservation",
        "hotel-operations-front-office-folio",
        "hotel-operations-housekeeping",
        "hotel-operations-maintenance",
      ],
      authChallenge: "unauthenticated route challenged by /login redirect",
      readOnly: true,
      sameOriginMutations: mutatingRequests.length,
      sameOriginHttpErrors: failedAppResponses.length,
      runtimeErrors: pageErrors.length,
      recentNetwork: networkEvidence.slice(-20),
    });
  });
});
