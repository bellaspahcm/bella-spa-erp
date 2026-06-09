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
    name: "crm",
    path: "/dashboard/crm",
    content: /crm|zalo|marketing|chien dich|khach hang/i,
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
    name: "settings",
    path: "/dashboard/settings",
    content: /cai dat|settings|goi dich vu|nhan su|phan quyen/i,
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
    name: "ai-salary-reconciliation",
    path: "/dashboard/ai-copilot/salary-reconciliation",
    content: /doi soat bang luong|ai tinh|salary/i,
  },
];

const coreVisualRouteNames = new Set([
  "accounting-journals",
  "accounting-reports",
  "finance",
  "finance-reconciliation",
  "dashboard-chat",
  "customers",
  "inventory",
  "services",
  "settings",
  "salary",
]);

const scopedVisualRoutes = process.env.E2E_VISUAL_SMOKE_SCOPE === "core"
  ? visualRoutes.filter((route) => coreVisualRouteNames.has(route.name))
  : visualRoutes;

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

const isVisualSmokeRunner = process.env.E2E_VISUAL_SMOKE_RUNNER === "1";
const navigationTimeoutMs = Number(process.env.E2E_NAVIGATION_TIMEOUT_MS || 60_000);
const hasExplicitE2eTarget = Boolean(
  process.env.E2E_BASE_URL ||
  process.env.E2E_PORT ||
  process.env.E2E_REUSE_SERVER === "0",
);
const isUnsafeImplicitLocalRun = !isVisualSmokeRunner && !hasExplicitE2eTarget;

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
  await page.locator("table").first().waitFor({ state: "visible", timeout: 30_000 });

  const result = await page.evaluate(() => {
    const table = Array.from(document.querySelectorAll("table")).find((candidate) =>
      candidate.textContent?.includes("Chi tiết nghiệp vụ"),
    ) as HTMLTableElement | undefined;
    const row = table?.querySelector("tbody tr");
    const cells = row ? (Array.from(row.children).slice(0, 2) as HTMLElement[]) : [];

    return {
      foundTable: Boolean(table),
      isResponsiveDataTable: Boolean(table?.classList.contains("bella-data-table")),
      usesFixedLayout: Boolean(table?.classList.contains("table-fixed")),
      foundRow: Boolean(row),
      cells: cells.map((cell) => {
        const rect = cell.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
        };
      }),
    };
  });

  expect(result.foundTable, "finance transaction table should render").toBe(true);
  expect(result.isResponsiveDataTable, "finance transaction table should use horizontal data-table layout").toBe(true);
  expect(result.usesFixedLayout, "finance transaction table should not lock columns with table-fixed").toBe(false);
  if (!result.foundRow) {
    return;
  }
  expect(result.cells.length, "finance transaction table should expose first two data cells").toBe(2);
  expect(result.cells[0].right, "finance category cell should not overlap detail cell").toBeLessThanOrEqual(
    result.cells[1].left + 1,
  );
}

async function expectFinanceTransactionColumnPolish(page: Page) {
  await page.locator("table").first().waitFor({ state: "visible", timeout: 30_000 });

  const result = await page.evaluate(() => {
    const table = Array.from(document.querySelectorAll("table")).find((candidate) =>
      /chi\s*ti/i.test((candidate.textContent ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")),
    ) as HTMLTableElement | undefined;
    const headers = table ? (Array.from(table.querySelectorAll("thead th")).slice(0, 3) as HTMLElement[]) : [];
    const row = table?.querySelector("tbody tr");
    const cells = row ? (Array.from(row.children).slice(0, 2) as HTMLElement[]) : [];

    const measure = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      const styles = window.getComputedStyle(element);
      return {
        left: rect.left,
        right: rect.right,
        width: rect.width,
        whiteSpace: styles.whiteSpace,
      };
    };

    return {
      foundTable: Boolean(table),
      tableWidth: table?.getBoundingClientRect().width ?? 0,
      wrapperWidth: table?.parentElement?.getBoundingClientRect().width ?? 0,
      headers: headers.map(measure),
      cells: cells.map(measure),
    };
  });

  expect(result.foundTable, "finance transaction table should render for column polish checks").toBe(true);
  expect(result.tableWidth, "finance transaction table should scroll horizontally on mobile").toBeGreaterThan(
    result.wrapperWidth + 1,
  );
  expect(result.headers.length, "finance transaction table should expose category/detail/date headers").toBeGreaterThanOrEqual(3);
  expect(result.headers[1].width, "finance detail header should keep a readable width").toBeGreaterThanOrEqual(360);
  expect(result.headers[0].right, "finance category header should not overlap detail header").toBeLessThanOrEqual(
    result.headers[1].left + 1,
  );
  expect(result.headers[1].right, "finance detail header should not overlap date header").toBeLessThanOrEqual(
    result.headers[2].left + 1,
  );

  if (result.cells.length >= 2) {
    expect(result.cells[1].width, "finance detail cell should keep a readable width").toBeGreaterThanOrEqual(360);
    expect(result.cells[0].whiteSpace, "finance category cell should stay on one line inside horizontal scroll").toBe("nowrap");
    expect(result.cells[1].whiteSpace, "finance detail cell should stay on one line inside horizontal scroll").toBe("nowrap");
  }
}

async function expectAccountingReportsTablePolish(page: Page) {
  await page.locator("table").first().waitFor({ state: "visible", timeout: 30_000 });

  const result = await page.evaluate(() => {
    const table = document.querySelector("table") as HTMLTableElement | null;
    const firstHeaderRow = table?.querySelector("thead tr");
    const firstHeaders = firstHeaderRow ? (Array.from(firstHeaderRow.children).slice(0, 2) as HTMLElement[]) : [];
    const firstBodyRow = table?.querySelector("tbody tr");
    const firstRowCells = firstBodyRow ? (Array.from(firstBodyRow.children).slice(0, 2) as HTMLElement[]) : [];

    const measure = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      const styles = window.getComputedStyle(element);
      return {
        left: rect.left,
        right: rect.right,
        position: styles.position,
        whiteSpace: styles.whiteSpace,
      };
    };

    return {
      foundTable: Boolean(table),
      tableWidth: table?.getBoundingClientRect().width ?? 0,
      wrapperWidth: table?.parentElement?.getBoundingClientRect().width ?? 0,
      headers: firstHeaders.map(measure),
      cells: firstRowCells.map(measure),
    };
  });

  expect(result.foundTable, "accounting reports table should render").toBe(true);
  expect(result.tableWidth, "accounting reports table should scroll horizontally on mobile").toBeGreaterThan(
    result.wrapperWidth + 1,
  );
  expect(result.headers.length, "accounting reports should expose first two headers").toBeGreaterThanOrEqual(2);
  expect(result.headers[0].position, "accounting reports first header should not be sticky").toBe("static");
  expect(result.headers[0].right, "accounting reports first header should not overlap second header").toBeLessThanOrEqual(
    result.headers[1].left + 1,
  );
  expect(result.headers[0].whiteSpace, "accounting report code header should stay on one line").toBe("nowrap");

  if (result.cells.length >= 2) {
    expect(result.cells[0].position, "accounting reports first data cell should not be sticky").toBe("static");
    expect(result.cells[0].right, "accounting reports first data cell should not overlap second cell").toBeLessThanOrEqual(
      result.cells[1].left + 1,
    );
    expect(result.cells[0].whiteSpace, "accounting report code cell should stay on one line").toBe("nowrap");
  }
}

async function expectPrimaryDataTableColumnsDoNotOverlap(page: Page, routeName: string) {
  await page
    .locator('table.bella-data-table, table[class*="w-max"], table[class*="min-w-"]')
    .first()
    .waitFor({ state: "visible", timeout: 30_000 });

  const result = await page.evaluate(() => {
    const tables = Array.from(document.querySelectorAll("table"))
      .filter((table): table is HTMLTableElement => {
        const rect = table.getBoundingClientRect();
        const styles = window.getComputedStyle(table);
        return rect.width > 0 && rect.height > 0 && styles.display !== "none" && styles.visibility !== "hidden";
      })
      .map((table) => {
        const rect = table.getBoundingClientRect();
        let wrapper: HTMLElement | null = table.parentElement;
        while (wrapper && wrapper !== document.body) {
          const styles = window.getComputedStyle(wrapper);
          if (/(auto|scroll|overlay)/.test(styles.overflowX)) {
            break;
          }
          wrapper = wrapper.parentElement;
        }

        const tableClass = table.className.toString();
        const firstHeaders = Array.from(table.querySelectorAll("thead tr:first-child th")).slice(0, 3) as HTMLElement[];
        const firstBodyRow = table.querySelector("tbody tr");
        const firstCells = firstBodyRow ? (Array.from(firstBodyRow.children).slice(0, 3) as HTMLElement[]) : [];

        const measure = (element: HTMLElement) => {
          const cellRect = element.getBoundingClientRect();
          const styles = window.getComputedStyle(element);
          return {
            left: cellRect.left,
            right: cellRect.right,
            width: cellRect.width,
            position: styles.position,
            whiteSpace: styles.whiteSpace,
          };
        };

        return {
          tableClass,
          isDataTable:
            table.classList.contains("bella-data-table") ||
            tableClass.includes("w-max") ||
            tableClass.includes("min-w-"),
          width: rect.width,
          wrapperWidth: wrapper?.getBoundingClientRect().width ?? 0,
          headers: firstHeaders.map(measure),
          cells: firstCells.map(measure),
        };
      })
      .filter((table) => table.isDataTable)
      .sort((a, b) => b.width - a.width);

    return tables[0] ?? null;
  });

  expect(result, `${routeName} should expose a primary responsive data table`).not.toBeNull();
  if (!result) {
    return;
  }

  expect(result.width, `${routeName} primary data table should scroll horizontally on mobile`).toBeGreaterThan(
    result.wrapperWidth + 1,
  );
  expect(result.headers.length, `${routeName} should expose at least two data-table headers`).toBeGreaterThanOrEqual(2);

  const checkSequence = (
    items: { left: number; right: number; position: string; whiteSpace: string }[],
    label: string,
  ) => {
    for (let index = 0; index < items.length - 1; index += 1) {
      expect(items[index].position, `${routeName} ${label} ${index} should not be sticky or fixed`).toBe("static");
      expect(items[index].right, `${routeName} ${label} ${index} should not overlap the next column`).toBeLessThanOrEqual(
        items[index + 1].left + 1,
      );
      expect(items[index].whiteSpace, `${routeName} ${label} ${index} should stay in horizontal table flow`).toBe(
        "nowrap",
      );
    }
  };

  checkSequence(result.headers, "header");
  if (result.cells.length >= 2) {
    checkSequence(result.cells, "cell");
  }
}

async function expectVisibleTextStaysInsideViewport(page: Page, routeName: string) {
  const offenders = await page
    .locator("main span, main p, main a, main button, main h1, main h2, main h3, main h4, main label")
    .evaluateAll((elements) =>
      elements
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          const styles = window.getComputedStyle(element);
          if (
            rect.width <= 0 ||
            rect.height <= 0 ||
            styles.display === "none" ||
            styles.visibility === "hidden" ||
            !(element.textContent ?? "").trim()
          ) {
            return false;
          }

          if (element.closest("table")) {
            return false;
          }

          let parent = element.parentElement;
          while (parent && parent !== document.body) {
            const parentStyles = window.getComputedStyle(parent);
            if (/(auto|scroll|overlay)/.test(parentStyles.overflowX)) {
              return false;
            }
            parent = parent.parentElement;
          }

          return true;
        })
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            text: (element.textContent ?? "").trim().slice(0, 80),
            left: rect.left,
            right: rect.right,
            viewportWidth: window.innerWidth,
          };
        })
        .filter((item) => item.left < -1 || item.right > item.viewportWidth + 1),
    );

  expect(offenders, `${routeName} visible text should not bleed outside the mobile viewport`).toEqual([]);
}

async function expectNoFixedTables(page: Page, routeName: string) {
  const fixedTableCount = await page.locator("table.table-fixed").count();
  expect(fixedTableCount, `${routeName} should not use fixed table layout on responsive data tables`).toBe(0);
}

async function expectMobileTablesScrollAsWhole(page: Page, routeName: string) {
  const tableMetrics = await page.locator("table").evaluateAll((tables) =>
    tables
      .filter((table) => {
        const rect = table.getBoundingClientRect();
        const styles = window.getComputedStyle(table);
        return rect.width > 0 && rect.height > 0 && styles.display !== "none" && styles.visibility !== "hidden";
      })
      .map((table) => {
        const rect = table.getBoundingClientRect();
        const dataCells = Array.from(table.querySelectorAll("th, td"));
        const stickyCells = dataCells
          .map((cell) => {
            const styles = window.getComputedStyle(cell);
            return {
              text: (cell.textContent ?? "").trim().slice(0, 48),
              position: styles.position,
              left: styles.left,
              right: styles.right,
            };
          })
          .filter((cell) => cell.position === "sticky" || cell.position === "fixed");

        let wrapper: HTMLElement | null = table.parentElement;
        while (wrapper && wrapper !== document.body) {
          const styles = window.getComputedStyle(wrapper);
          if (/(auto|scroll|overlay)/.test(styles.overflowX)) break;
          wrapper = wrapper.parentElement;
        }

        const wrapperRect = wrapper?.getBoundingClientRect();
        const tableClass = table.className.toString();
        const isDataTable =
          table.classList.contains("bella-data-table") ||
          tableClass.includes("w-max") ||
          tableClass.includes("min-w-");

        return {
          tableClass,
          isDataTable,
          viewportWidth: window.innerWidth,
          width: rect.width,
          wrapperWidth: wrapperRect?.width ?? 0,
          hasHorizontalWrapper: Boolean(wrapper && wrapper !== document.body),
          stickyCells,
        };
      }),
  );

  for (const table of tableMetrics) {
    expect(table.stickyCells, `${routeName} tables should scroll every column together`).toEqual([]);

    if (table.isDataTable && table.width > table.viewportWidth) {
      expect(
        table.hasHorizontalWrapper,
        `${routeName} wide table should have a horizontal scroll wrapper: ${table.tableClass}`,
      ).toBe(true);
      expect(
        table.width,
        `${routeName} data table should be wider than its wrapper so columns scroll horizontally`,
      ).toBeGreaterThan(table.wrapperWidth + 1);
    }
  }
}

async function expectMobileToolbarsFitViewport(page: Page, routeName: string) {
  const boxes = await page.locator(".bella-toolbar, .bella-pagination").evaluateAll((elements) =>
    elements
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const styles = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && styles.display !== "none" && styles.visibility !== "hidden";
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          className: element.className.toString(),
          left: rect.left,
          right: rect.right,
          width: rect.width,
          viewportWidth: window.innerWidth,
        };
      }),
  );

  for (const box of boxes) {
    expect(box.left, `${routeName} toolbar should start inside viewport: ${box.className}`).toBeGreaterThanOrEqual(0);
    expect(box.right, `${routeName} toolbar should end inside viewport: ${box.className}`).toBeLessThanOrEqual(
      box.viewportWidth + 1,
    );
    expect(box.width, `${routeName} toolbar should not exceed viewport: ${box.className}`).toBeLessThanOrEqual(
      box.viewportWidth + 1,
    );
  }
}

test.describe("Responsive visual smoke", () => {
  test.setTimeout(180_000);

  test.skip(
    isUnsafeImplicitLocalRun,
    "Run responsive visual smoke with `npm run e2e:visual` so it uses an isolated port and cannot reuse a stale dev server.",
  );

  test.skip(
    !canAuthenticateAdminPage(),
    "Requires E2E admin credentials or localhost Supabase admin env.",
  );

  for (const viewport of viewports) {
    for (const route of scopedVisualRoutes) {
      test(`${viewport.name} ${route.name} renders without clipped page layout`, async ({
        adminPage,
      }, testInfo) => {
        await adminPage.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });

        await adminPage
          .evaluate(() => {
            window.localStorage.setItem("bella_onboarding_completed", "true");
          })
          .catch(() => {});

        const response = await adminPage.goto(route.path, {
          waitUntil: "domcontentloaded",
          timeout: navigationTimeoutMs,
        });
        await adminPage.waitForLoadState("load", { timeout: 8_000 }).catch(() => {});
        await adminPage.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});

        expect(response?.status() ?? 0, `${route.name} must not return HTTP errors`).toBeLessThan(400);

        const routePattern = new RegExp(route.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
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

        if (
          viewport.name === "mobile" &&
          (route.name === "accounting-journals" || route.name === "accounting-reports")
        ) {
          await expectDateInputsFitMobile(adminPage, route.name);
        }

        if (viewport.name === "mobile" && route.name === "accounting-reports") {
          await expectAccountingReportsTablePolish(adminPage);
        }

        if (viewport.name === "mobile" && route.name === "finance") {
          await expectFinanceTransactionCellsDoNotBleed(adminPage);
          await expectFinanceTransactionColumnPolish(adminPage);
        }

        if (viewport.name === "mobile" && (route.name === "inventory" || route.name === "salary")) {
          await expectPrimaryDataTableColumnsDoNotOverlap(adminPage, route.name);
        }

        if (viewport.name === "mobile" && (route.name === "customers" || route.name === "sessions")) {
          await expectVisibleTextStaysInsideViewport(adminPage, route.name);
        }

        if (viewport.name === "mobile") {
          await expectMobileToolbarsFitViewport(adminPage, route.name);
          await expectNoFixedTables(adminPage, route.name);
          await expectMobileTablesScrollAsWhole(adminPage, route.name);
        }

        await testInfo.attach(`${viewport.name}-${route.name}.png`, {
          body: await adminPage.screenshot({ fullPage: true }),
          contentType: "image/png",
        });
      });
    }
  }
});
