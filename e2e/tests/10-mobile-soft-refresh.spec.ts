import { canAuthenticateAdminPage, expect, test } from "../fixtures/auth";

type SoftRefreshWindow = Window & {
  __bellaSoftRefreshProbe?: string;
};

type SoftRefreshRoute = {
  name: string;
  path: string;
  content: RegExp;
};

const softRefreshRoutes: SoftRefreshRoute[] = [
  {
    name: "dashboard",
    path: "/dashboard",
    content: /dashboard|tong quan/i,
  },
  {
    name: "customers",
    path: "/dashboard/customers",
    content: /khach hang|customer/i,
  },
  {
    name: "bookings",
    path: "/dashboard/bookings",
    content: /lich hen|timeline|booking/i,
  },
  {
    name: "sessions",
    path: "/dashboard/sessions",
    content: /the lieu trinh|sessions/i,
  },
  {
    name: "inventory",
    path: "/dashboard/inventory",
    content: /kho vat tu|inventory/i,
  },
  {
    name: "finance",
    path: "/dashboard/finance",
    content: /tai chinh|finance/i,
  },
  {
    name: "accounting-journals",
    path: "/dashboard/accounting/journals",
    content: /nhat ky|journal/i,
  },
];

function normalizeVietnamese(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Ä‘/g, "d")
    .replace(/Ä/g, "D");
}

test.describe("Mobile soft refresh", () => {
  test.setTimeout(120_000);

  test.skip(
    !canAuthenticateAdminPage(),
    "Requires E2E admin credentials or localhost Supabase admin env.",
  );

  for (const route of softRefreshRoutes) {
    test(`${route.name} refreshes without hard page reload`, async ({ adminPage }) => {
      await adminPage.setViewportSize({ width: 390, height: 844 });

      const response = await adminPage.goto(route.path, { waitUntil: "domcontentloaded" });
      await adminPage.waitForLoadState("load", { timeout: 8_000 }).catch(() => {});
      await adminPage.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});

      if ((response?.status() ?? 0) >= 400) {
        test.skip(true, `${route.name} is not accessible for the configured E2E admin account.`);
      }

      const routePattern = new RegExp(route.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      if (!routePattern.test(adminPage.url())) {
        test.skip(true, `${route.name} is not accessible for the configured E2E admin account.`);
      }

      const normalizedText = normalizeVietnamese(await adminPage.locator("body").innerText());
      expect(normalizedText, `${route.name} should render expected page content`).toMatch(route.content);

      await adminPage.evaluate(() => {
        (window as SoftRefreshWindow).__bellaSoftRefreshProbe = String(Date.now());
      });

      const urlBefore = adminPage.url();
      const searchInput = adminPage.locator('input[type="text"], input[type="search"]').first();
      const hasSearchInput = await searchInput.isVisible().catch(() => false);

      if (hasSearchInput) {
        await searchInput.fill("soft-refresh-probe");
        await expect(searchInput).toHaveValue("soft-refresh-probe");
      }

      await adminPage.keyboard.press("Escape").catch(() => {});
      await adminPage.locator(".fixed.inset-0").first().waitFor({ state: "detached", timeout: 1_000 }).catch(() => {});

      await adminPage.getByRole("button", { name: /làm mới dữ liệu/i }).click({ force: true });
      await adminPage.waitForTimeout(1_000);

      await expect(adminPage).toHaveURL(urlBefore);
      await expect
        .poll(
          async () => adminPage.evaluate(() => (window as SoftRefreshWindow).__bellaSoftRefreshProbe ?? null),
          { timeout: 5_000 },
        )
        .not.toBeNull();

      if (hasSearchInput) {
        await expect(searchInput).toHaveValue("soft-refresh-probe");
      }
    });
  }
});
