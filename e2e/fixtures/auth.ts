/**
 * Auth fixture cho Playwright — wrap `test` để mỗi spec nhận sẵn 1 page đã login.
 *
 * Production/external runs use E2E_ADMIN_EMAIL + E2E_ADMIN_PASSWORD.
 * Localhost runs can fall back to the dev-only mock_user_email bypass.
 *
 * Mỗi spec import { test } từ file này thay vì `@playwright/test`.
 */

import { test as base, type Page } from "@playwright/test";
import { getAnyAdminUser, hasSupabaseAdminEnv, loadE2eEnv } from "../helpers/supabase-admin";

type AdminCredentials = {
  email: string;
  password: string;
};

type Fixtures = {
  /** A page that is already authenticated as an admin user (HQ tenant). */
  adminPage: Page;
  /** Cached admin email used for login (for assertions/UI checks). */
  adminEmail: string;
};

function readEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

export function getE2eBaseUrl(): string {
  const port = readEnv("E2E_PORT") || "3000";
  return readEnv("E2E_BASE_URL") || `http://localhost:${port}`;
}

export function isLocalE2eBaseUrl(baseUrl = getE2eBaseUrl()): boolean {
  try {
    const hostname = new URL(baseUrl).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

export function getConfiguredAdminCredentials(): AdminCredentials | null {
  loadE2eEnv();

  const email = readEnv("E2E_ADMIN_EMAIL") || readEnv("E2E_PROD_ADMIN_EMAIL");
  const password = readEnv("E2E_ADMIN_PASSWORD") || readEnv("E2E_PROD_ADMIN_PASSWORD");

  return email && password ? { email, password } : null;
}

export function canAuthenticateAdminPage(): boolean {
  return Boolean(getConfiguredAdminCredentials()) || (isLocalE2eBaseUrl() && hasSupabaseAdminEnv());
}

async function loginWithConfiguredCredentials(page: Page, credentials: AdminCredentials): Promise<void> {
  await page.goto("/login", { waitUntil: "load" });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.locator('input[type="email"]').fill(credentials.email);
  await page.locator('input[type="password"]').fill(credentials.password);
  await page.locator('button[type="submit"]').click();

  try {
    await page.waitForURL(/\/dashboard(?:\/|$)/, { timeout: 30_000 });
  } catch (error) {
    const visibleText = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
    if (/nhập mã xác minh|nhap ma xac minh|2 lớp|2 lop/i.test(visibleText)) {
      throw new Error(
        "E2E_ADMIN_EMAIL account requires MFA. Use a dedicated non-MFA smoke-test admin account or add TOTP support before running production smoke.",
      );
    }

    throw new Error(
      `E2E real-auth login did not reach /dashboard. Check E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD. ${String(error)}`,
    );
  }

  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
}

async function loginWithLocalDevBypass(page: Page): Promise<void> {
  const admin = await getAnyAdminUser();

  // Inject mock_user_email cookie directly -- avoids login form + RLS issues.
  // proxy.ts allows /dashboard/:path* when this cookie is present in dev mode.
  // getCurrentUser() reads this cookie as a fallback when no Supabase session exists.
  await page.context().addCookies([
      {
        name: "mock_user_email",
        value: admin.email,
        url: getE2eBaseUrl(),
        sameSite: "Lax",
      },
  ]);
  await page.goto("/dashboard");
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
}

export const test = base.extend<Fixtures>({
  adminEmail: async ({}, use) => {
    const credentials = getConfiguredAdminCredentials();
    if (credentials) {
      await use(credentials.email);
      return;
    }

    const admin = await getAnyAdminUser();
    await use(admin.email);
  },

  adminPage: async ({ page }, use) => {
    const credentials = getConfiguredAdminCredentials();
    if (credentials) {
      await loginWithConfiguredCredentials(page, credentials);
      await use(page);
      return;
    }

    if (!isLocalE2eBaseUrl()) {
      throw new Error(
        "Non-local E2E_BASE_URL requires E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD. Refusing to use dev mock auth outside localhost.",
      );
    }

    if (!hasSupabaseAdminEnv()) {
      throw new Error(
        "Local dev-bypass E2E requires NEXT_PUBLIC_SUPABASE_URL plus SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY.",
      );
    }

    await loginWithLocalDevBypass(page);
    await use(page);
    // No teardown -- Playwright closes the context after each test.
  },
});

export { expect } from "@playwright/test";
