import { canAuthenticateAdminPage, expect, test } from "../fixtures/auth";
import type { Page } from "@playwright/test";

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
    name: "services",
    path: "/dashboard/services",
    content: /quan ly dich vu|dich vu|services/i,
  },
  {
    name: "finance",
    path: "/dashboard/finance",
    content: /tai chinh|finance/i,
  },
  {
    name: "finance-reconciliation",
    path: "/dashboard/finance/reconciliation",
    content: /doi soat|cong no|reconciliation/i,
  },
  {
    name: "accounting-journals",
    path: "/dashboard/accounting/journals",
    content: /nhat ky|journal/i,
  },
  {
    name: "accounting-reports",
    path: "/dashboard/accounting/reports",
    content: /bao cao|trial|financial|ket qua/i,
  },
  {
    name: "accounting-outbox",
    path: "/dashboard/accounting/outbox",
    content: /outbox|hang doi|event/i,
  },
  {
    name: "accounting-periods",
    path: "/dashboard/accounting/periods",
    content: /ky ke toan|period|dong ky/i,
  },
  {
    name: "accounting-manual-entry",
    path: "/dashboard/accounting/manual-entry",
    content: /but toan|manual|dinh khoan/i,
  },
  {
    name: "salary",
    path: "/dashboard/salary",
    content: /luong ktv|bang tinh luong|salary/i,
  },
  {
    name: "salary-reconciliation",
    path: "/dashboard/accounting/salary-reconciliation",
    content: /doi soat luong|luong ktv|salary/i,
  },
  {
    name: "crm",
    path: "/dashboard/crm",
    content: /crm|zalo|marketing|chien dich|khach hang/i,
  },
  {
    name: "ai-salary-reconciliation",
    path: "/dashboard/ai-copilot/salary-reconciliation",
    content: /doi soat bang luong|ai tinh|salary/i,
  },
  {
    name: "audit",
    path: "/dashboard/audit",
    content: /audit|nhat ky|he thong/i,
  },
  {
    name: "settings",
    path: "/dashboard/settings",
    content: /cai dat|settings|cau hinh/i,
  },
  {
    name: "customer-profile",
    path: "/dashboard/customer/profile",
    content: /ho so|profile|ca nhan/i,
  },
  {
    name: "customer-history",
    path: "/dashboard/customer/history",
    content: /lich su|history|lieu trinh/i,
  },
  {
    name: "customer-notifications",
    path: "/dashboard/customer/notifications",
    content: /thong bao|notifications/i,
  },
];

const coreSoftRefreshRouteNames = new Set([
  "dashboard",
  "customers",
  "services",
  "finance",
  "finance-reconciliation",
  "accounting-journals",
  "accounting-reports",
  "salary",
  "settings",
  "customer-profile",
]);

const scopedSoftRefreshRoutes = process.env.E2E_VISUAL_SMOKE_SCOPE === "core"
  ? softRefreshRoutes.filter((route) => coreSoftRefreshRouteNames.has(route.name))
  : softRefreshRoutes;

function normalizeVietnamese(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Ä‘/g, "d")
    .replace(/Ä/g, "D");
}

const isVisualSmokeRunner = process.env.E2E_VISUAL_SMOKE_RUNNER === "1";
const navigationTimeoutMs = Number(process.env.E2E_NAVIGATION_TIMEOUT_MS || 60_000);
const hasExplicitE2eTarget = Boolean(
  process.env.E2E_BASE_URL ||
  process.env.E2E_PORT ||
  process.env.E2E_REUSE_SERVER === "0",
);
const isUnsafeImplicitLocalRun = !isVisualSmokeRunner && !hasExplicitE2eTarget;

const appErrorPatterns = [
  /application error/i,
  /an error occurred in the server components render/i,
  /unhandled runtime error/i,
  /this page could not be found/i,
];

async function expectNoDocumentHorizontalOverflow(page: Page, routeName: string, phase: string) {
  const overflow = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));

  expect(
    overflow.documentWidth,
    `${routeName} should not create document-level horizontal scroll ${phase}`,
  ).toBeLessThanOrEqual(overflow.viewportWidth + 8);
}

async function expectMobileRefreshButtonFitsViewport(page: Page, routeName: string) {
  const button = page.getByRole("button", { name: /làm mới dữ liệu|lam moi du lieu/i }).first();

  await expect(button, `${routeName} should expose the mobile refresh button`).toBeVisible();
  await expect(button, `${routeName} mobile refresh button should be enabled`).toBeEnabled();

  const box = await button.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const styles = window.getComputedStyle(element);

    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      pointerEvents: styles.pointerEvents,
      visibility: styles.visibility,
    };
  });

  expect(box.visibility, `${routeName} refresh button should be visible`).toBe("visible");
  expect(box.pointerEvents, `${routeName} refresh button should receive taps`).not.toBe("none");
  expect(box.left, `${routeName} refresh button should stay inside the viewport`).toBeGreaterThanOrEqual(0);
  expect(box.top, `${routeName} refresh button should stay inside the viewport`).toBeGreaterThanOrEqual(0);
  expect(box.right, `${routeName} refresh button should not overflow the viewport`).toBeLessThanOrEqual(
    box.viewportWidth + 1,
  );
  expect(box.bottom, `${routeName} refresh button should not be clipped vertically`).toBeLessThanOrEqual(
    box.viewportHeight + 1,
  );
  expect(box.width, `${routeName} refresh button should keep a tappable width`).toBeGreaterThanOrEqual(36);
  expect(box.height, `${routeName} refresh button should keep a tappable height`).toBeGreaterThanOrEqual(36);
}

async function closeMobileOverlayIfPresent(page: Page) {
  await page.keyboard.press("Escape").catch(() => {});

  const backdrop = page.locator(".fixed.inset-0").first();
  const isBackdropVisible = await backdrop.isVisible({ timeout: 500 }).catch(() => false);
  if (isBackdropVisible) {
    await backdrop.click({ position: { x: 4, y: 4 }, timeout: 2_000 }).catch(async () => {
      await page.evaluate(() => {
        const overlay = document.querySelector<HTMLElement>(".fixed.inset-0");
        overlay?.click();
      });
    });
  }

  await backdrop.waitFor({ state: "hidden", timeout: 2_000 }).catch(() => {});
}

test.describe("Mobile soft refresh", () => {
  test.setTimeout(120_000);

  test.skip(
    isUnsafeImplicitLocalRun,
    "Run mobile soft refresh with `npm run e2e:visual` so it uses an isolated port and cannot reuse a stale dev server.",
  );

  test.skip(
    !canAuthenticateAdminPage(),
    "Requires E2E admin credentials or localhost Supabase admin env.",
  );

  for (const route of scopedSoftRefreshRoutes) {
    test(`${route.name} refreshes without hard page reload`, async ({ adminPage }) => {
      await adminPage.setViewportSize({ width: 390, height: 844 });
      await adminPage
        .evaluate(() => {
          window.localStorage.setItem("bella_onboarding_completed", "true");
        })
        .catch(() => {});
      const auditConsoleErrors: string[] = [];

      if (route.name === "audit") {
        adminPage.on("console", (message) => {
          if (message.type() !== "error") return;

          const text = message.text();
          if (/AuthSessionMissingError|Error fetching logs/i.test(text)) {
            auditConsoleErrors.push(text);
          }
        });
      }

      const response = await adminPage.goto(route.path, {
        waitUntil: "domcontentloaded",
        timeout: navigationTimeoutMs,
      });
      await adminPage.waitForLoadState("load", { timeout: 8_000 }).catch(() => {});
      await adminPage.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});

      expect(response?.status() ?? 0, `${route.name} must not return HTTP errors`).toBeLessThan(400);

      const routePattern = new RegExp(route.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      await expect(adminPage).toHaveURL(routePattern);

      const normalizedText = normalizeVietnamese(await adminPage.locator("body").innerText());
      expect(normalizedText, `${route.name} should render expected page content`).toMatch(route.content);
      for (const pattern of appErrorPatterns) {
        expect(normalizedText, `${route.name} should not show ${pattern}`).not.toMatch(pattern);
      }

      await expectNoDocumentHorizontalOverflow(adminPage, route.name, "before soft refresh");
      await expectMobileRefreshButtonFitsViewport(adminPage, route.name);

      await adminPage.evaluate(() => {
        (window as SoftRefreshWindow).__bellaSoftRefreshProbe = String(Date.now());
      });

      const urlBefore = adminPage.url();
      const searchInput = adminPage.locator('input[type="text"], input[type="search"]').first();
      const hasSearchInput = await searchInput.evaluate((input) => {
        if (!(input instanceof HTMLInputElement)) return false;
        const hint = `${input.type} ${input.placeholder} ${input.getAttribute("aria-label") ?? ""}`.toLowerCase();
        return input.offsetParent !== null && /search|tim|tìm/.test(hint);
      }).catch(() => false);

      if (hasSearchInput) {
        await searchInput.fill("soft-refresh-probe");
        await expect(searchInput).toHaveValue("soft-refresh-probe");
      }

      await closeMobileOverlayIfPresent(adminPage);

      await adminPage.getByRole("button", { name: /làm mới dữ liệu|lam moi du lieu/i }).first().click();
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

      await expectNoDocumentHorizontalOverflow(adminPage, route.name, "after soft refresh");
      await expectMobileRefreshButtonFitsViewport(adminPage, route.name);

      const refreshedText = normalizeVietnamese(await adminPage.locator("body").innerText());
      for (const pattern of appErrorPatterns) {
        expect(refreshedText, `${route.name} should not show ${pattern} after soft refresh`).not.toMatch(pattern);
      }

      if (route.name === "audit") {
        expect(auditConsoleErrors).toEqual([]);
      }
    });
  }
});
