/**
 * Auth fixture cho Playwright — wrap `test` để mỗi spec nhận sẵn 1 page đã login.
 *
 * Dùng dev-bypass: password='password123' + bất kỳ email admin nào trong public.users
 * (xem src/app/(auth)/login/page.tsx). KHÔNG dùng bypass này trong production.
 *
 * Mỗi spec import { test } từ file này thay vì `@playwright/test`.
 */

import { test as base, type Page } from "@playwright/test";
import { getAnyAdminUser } from "../helpers/supabase-admin";

type Fixtures = {
  /** A page that is already authenticated as an admin user (HQ tenant). */
  adminPage: Page;
  /** Cached admin email used for login (for assertions/UI checks). */
  adminEmail: string;
};

export const test = base.extend<Fixtures>({
  adminEmail: async ({}, use) => {
    const admin = await getAnyAdminUser();
    await use(admin.email);
  },

  adminPage: async ({ page, adminEmail }, use) => {
    // Inject mock_user_email cookie directly — avoids login form + RLS issues.
    // proxy.ts allows /dashboard/:path* when this cookie is present (dev mode only).
    // getCurrentUser() reads this cookie as a fallback when no Supabase session exists.
    await page.context().addCookies([
      {
        name: "mock_user_email",
        value: adminEmail,
        domain: "localhost",
        path: "/",
        sameSite: "Lax",
      },
    ]);
    await page.goto("/dashboard");
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });

    await use(page);
    // No teardown — Playwright closes the context after each test.
  },
});

export { expect } from "@playwright/test";
