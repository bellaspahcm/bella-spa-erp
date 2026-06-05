/**
 * Responsive visual smoke for high-risk dashboard surfaces.
 *
 * This is intentionally not a pixel-perfect baseline test yet. It captures
 * screenshots as CI artifacts and asserts the layout does not create page-level
 * horizontal overflow on mobile/desktop, which catches the table/filter/chat
 * clipping regressions Bella ERP has been seeing.
 */

import { canAuthenticateAdminPage, test, expect } from "../fixtures/auth";
import type { Page } from "@playwright/test";

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
    name: "bookings",
    path: "/dashboard/bookings",
    content: /lich hen|timeline|booking/i,
  },
  {
    name: "sessions",
    path: "/dashboard/sessions",
    content: /the lieu trinh|lo trinh|sessions/i,
  },
  {
    name: "inventory",
    path: "/dashboard/inventory",
    content: /kho vat tu|ton kho|inventory/i,
  },
  {
    name: "services",
    path: "/dashboard/services",
    content: /quan ly dich vu|dich vu|services/i,
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

async function expectDateInputsFitMobile(page: Page, routeName: string) {
  const dateInputBoxes = await page.locator('input[type="date"]').evaluateAll((inputs) =>
    inputs.map((input) => {
      const rect = input.getBoundingClientRect();
      const styles = window.getComputedStyle(input);
      return {
        left: rect.left,
        right: rect.right,
        width: rect.width,
        viewportWidth: window.innerWidth,
        minWidth: styles.minWidth,
        maxWidth: styles.maxWidth,
      };
    }),
  );

  expect(dateInputBoxes.length, `${routeName} should render date filters`).toBeGreaterThan(0);
  for (const box of dateInputBoxes) {
    expect(box.left, `${routeName} date input should stay inside viewport`).toBeGreaterThanOrEqual(0);
    expect(box.right, `${routeName} date input should not overflow viewport`).toBeLessThanOrEqual(
      box.viewportWidth + 1,
    );
    expect(box.width, `${routeName} date input should fit mobile content width`).toBeLessThanOrEqual(
      box.viewportWidth - 24,
    );
    expect(box.minWidth, `${routeName} date input should be allowed to shrink`).toBe("0px");
  }
}

async function expectFinanceTransactionCellsDoNotBleed(page: Page) {
  const result = await page.evaluate(() => {
    const table = Array.from(document.querySelectorAll("table")).find((candidate) =>
      candidate.textContent?.includes("Chi tiết nghiệp vụ"),
    );
    const row = table?.querySelector("tbody tr");
    const cells = row ? (Array.from(row.children).slice(0, 2) as HTMLElement[]) : [];

    return {
      foundTable: Boolean(table),
      foundRow: Boolean(row),
      cells: cells.map((cell) => {
        const rect = cell.getBoundingClientRect();
        const styles = window.getComputedStyle(cell);
        return {
          left: rect.left,
          right: rect.right,
          overflowX: styles.overflowX,
          textOverflow: styles.textOverflow,
        };
      }),
    };
  });

  expect(result.foundTable, "finance transaction table should render").toBe(true);
  if (!result.foundRow) {
    return;
  }
  expect(result.cells.length, "finance transaction table should expose first two data cells").toBe(2);
  expect(result.cells[0].right, "finance category cell should not overlap detail cell").toBeLessThanOrEqual(
    result.cells[1].left + 1,
  );
  for (const cell of result.cells) {
    expect(cell.overflowX, "long finance text cells should clip overflowing text").not.toBe("visible");
    expect(cell.textOverflow, "long finance text cells should ellipsize overflowing text").toBe("ellipsis");
  }
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
        let normalizedText = "";
        await expect
          .poll(
            async () => {
              normalizedText = normalizeVietnamese(await body.innerText({ timeout: 5_000 }).catch(() => ""));
              return normalizedText;
            },
            {
              message: `${route.name} should finish rendering visible page content`,
              timeout: 20_000,
            },
          )
          .toMatch(route.content);
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

        if (viewport.name === "mobile" && route.name === "accounting-journals") {
          await expectDateInputsFitMobile(adminPage, route.name);
        }

        if (viewport.name === "mobile" && route.name === "finance") {
          await expectFinanceTransactionCellsDoNotBleed(adminPage);
        }

        await testInfo.attach(`${viewport.name}-${route.name}.png`, {
          body: await adminPage.screenshot({ fullPage: true }),
          contentType: "image/png",
        });
      });
    }
  }
});
