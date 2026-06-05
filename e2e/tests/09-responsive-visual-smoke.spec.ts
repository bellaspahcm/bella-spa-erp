/**
 * Responsive visual smoke for high-risk dashboard surfaces.
 *
 * This is intentionally not a pixel-perfect baseline test yet. It captures
 * screenshots as CI artifacts and asserts the layout does not create page-level
 * horizontal overflow on mobile/desktop, which catches the table/filter/chat
 * clipping regressions Bella ERP has been seeing.
 */

import { canAuthenticateAdminPage, test, expect } from "../fixtures/auth";

type VisualRoute = {
  name: string;
  path: string;
  content: RegExp;
};

const visualRoutes: VisualRoute[] = [
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
    name: "finance",
    path: "/dashboard/finance",
    content: /tai chinh|giao dich|finance/i,
  },
  {
    name: "finance-reconciliation",
    path: "/dashboard/finance/reconciliation",
    content: /doi soat|cong no|reconciliation/i,
  },
  {
    name: "dashboard-chat",
    path: "/dashboard/chat",
    content: /trung tam tin nhan|hoi thoai|tin nhan/i,
  },
  {
    name: "customers",
    path: "/dashboard/customers",
    content: /khach hang|ho so|customer/i,
  },
  {
    name: "ai-copilot",
    path: "/dashboard/ai-copilot",
    content: /ai coo|copilot|tong giam doc/i,
  },
];

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

const appErrorPatterns = [
  /application error/i,
  /an error occurred in the server components render/i,
  /unhandled runtime error/i,
  /this page could not be found/i,
];

function normalizeVietnamese(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

test.describe("Responsive visual smoke", () => {
  test.setTimeout(180_000);

  test.skip(
    !canAuthenticateAdminPage(),
    "Requires E2E admin credentials or localhost Supabase admin env.",
  );

  for (const viewport of viewports) {
    for (const route of visualRoutes) {
      test(`${viewport.name} ${route.name} renders without clipped page layout`, async ({
        adminPage,
      }, testInfo) => {
        await adminPage.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });

        const response = await adminPage.goto(route.path, { waitUntil: "domcontentloaded" });
        await adminPage.waitForLoadState("load", { timeout: 8_000 }).catch(() => {});
        await adminPage.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});

        expect(response?.status() ?? 0, `${route.name} HTTP status`).toBeLessThan(400);
        const routePattern = new RegExp(route.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
        if (!routePattern.test(adminPage.url())) {
          test.skip(true, `${route.name} is not accessible for the configured E2E admin account.`);
        }
        await expect(adminPage).toHaveURL(routePattern);

        const body = adminPage.locator("body");
        const normalizedText = normalizeVietnamese(await body.innerText({ timeout: 10_000 }));
        expect(normalizedText, `${route.name} should render expected content`).toMatch(route.content);
        for (const pattern of appErrorPatterns) {
          expect(normalizedText, `${route.name} should not show ${pattern}`).not.toMatch(pattern);
        }

        const pageOverflow = await adminPage.evaluate(() => ({
          viewportWidth: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
        }));

        expect(
          pageOverflow.documentWidth,
          `${route.name} should not create document-level horizontal scroll`,
        ).toBeLessThanOrEqual(pageOverflow.viewportWidth + 8);

        await testInfo.attach(`${viewport.name}-${route.name}.png`, {
          body: await adminPage.screenshot({ fullPage: true }),
          contentType: "image/png",
        });
      });
    }
  }
});
