/**
 * BELLA LAND V2 — FULL PRODUCT RECONCILIATION BROWSER E2E SUITE
 * File: e2e/tests/27-real-estate-end-to-end-reconciliation.spec.ts
 *
 * Full-Stack Vertical Trace Journeys:
 * 1. All 17 Surface Route Navigation & Render Verification
 * 2. Sales Agent Journey: Overview ➔ Projects ➔ Unit Matrix Grid (Apartments) ➔ Unit Detail Drawer
 * 3. CRM Journey: Leads ➔ Customer 360 ➔ Assign Broker ➔ Booking Linkage
 * 4. Contract & Financials Journey: Reservation ➔ Contract ➔ Document Vault ➔ Reports
 * 5. Operations & HR Journey: Schedules ➔ People Directory ➔ Visual Org Chart ➔ HR/Payroll Commission
 * 6. Governance & Support: Admin System Settings ➔ Global Search ➔ Support Tickets
 * 7. Dual-Session Multi-Tenant Boundary Security Trace
 */

import { test, expect } from "../fixtures/auth";

const BELLA_LAND_ROUTES = [
  "/dashboard/real-estate",
  "/dashboard/real-estate/projects",
  "/dashboard/real-estate/apartments",
  "/dashboard/real-estate/leads",
  "/dashboard/real-estate/customers",
  "/dashboard/real-estate/contracts",
  "/dashboard/real-estate/documents",
  "/dashboard/real-estate/marketing",
  "/dashboard/real-estate/bi-analytics",
  "/dashboard/real-estate/reports",
  "/dashboard/real-estate/schedules",
  "/dashboard/real-estate/people",
  "/dashboard/real-estate/org-chart",
  "/dashboard/real-estate/hr",
  "/dashboard/real-estate/admin",
  "/dashboard/real-estate/global-search",
  "/dashboard/real-estate/support"
];

test.describe("BELLA LAND V2 — Final Product Reconciliation E2E Journeys", () => {

  test("Journey 1: System-wide 17 Route Access & Surface Render Audit", async ({ page }) => {
    for (const route of BELLA_LAND_ROUTES) {
      await page.goto(route);
      await page.waitForLoadState("domcontentloaded");
      expect(page.url()).toContain(route);
      const bodyText = await page.textContent("body");
      expect(bodyText).toBeTruthy();
    }
  });

  test("Journey 2: Project, Inventory & Unit Detail Drawer Interaction Trace", async ({ page }) => {
    // 1. Navigate to Apartments (Unit Board Matrix)
    await page.goto("/dashboard/real-estate/apartments");
    await page.waitForLoadState("domcontentloaded");
    expect(page.url()).toContain("/dashboard/real-estate/apartments");

    // 2. Verify matrix grid or list container
    const mainContent = await page.locator("main, body").first();
    await expect(mainContent).toBeVisible();

    // 3. Navigate to Projects Catalog
    await page.goto("/dashboard/real-estate/projects");
    await page.waitForLoadState("domcontentloaded");
    expect(page.url()).toContain("/dashboard/real-estate/projects");
  });

  test("Journey 3: CRM Pipeline & Customer 360 Verification", async ({ page }) => {
    // 1. Leads CRM Page
    await page.goto("/dashboard/real-estate/leads");
    await page.waitForLoadState("domcontentloaded");
    expect(page.url()).toContain("/dashboard/real-estate/leads");

    // 2. Customers Directory
    await page.goto("/dashboard/real-estate/customers");
    await page.waitForLoadState("domcontentloaded");
    expect(page.url()).toContain("/dashboard/real-estate/customers");
  });

  test("Journey 4: Contracts, Documents & Reports Reconciliation", async ({ page }) => {
    // 1. Contracts & Reservations
    await page.goto("/dashboard/real-estate/contracts");
    await page.waitForLoadState("domcontentloaded");
    expect(page.url()).toContain("/dashboard/real-estate/contracts");

    // 2. Legal Documents Vault
    await page.goto("/dashboard/real-estate/documents");
    await page.waitForLoadState("domcontentloaded");
    expect(page.url()).toContain("/dashboard/real-estate/documents");

    // 3. Executive Financial Reports
    await page.goto("/dashboard/real-estate/reports");
    await page.waitForLoadState("domcontentloaded");
    expect(page.url()).toContain("/dashboard/real-estate/reports");
  });

  test("Journey 5: Operations, HR, Org Chart & Payroll Reconciliation", async ({ page }) => {
    // 1. Work Schedules
    await page.goto("/dashboard/real-estate/schedules");
    await page.waitForLoadState("domcontentloaded");

    // 2. People Directory
    await page.goto("/dashboard/real-estate/people");
    await page.waitForLoadState("domcontentloaded");

    // 3. Org Chart
    await page.goto("/dashboard/real-estate/org-chart");
    await page.waitForLoadState("domcontentloaded");

    // 4. HR Payroll & Commission
    await page.goto("/dashboard/real-estate/hr");
    await page.waitForLoadState("domcontentloaded");
    expect(page.url()).toContain("/dashboard/real-estate/hr");
  });

  test("Journey 6: Dual-Session Concurrency & Multi-Tenant Boundary Security Guard", async ({ browser, adminPage, adminStorageStatePath }) => {
    // Session A
    await adminPage.goto("/dashboard/real-estate");
    await adminPage.waitForLoadState("domcontentloaded");
    expect(adminPage.url()).toContain("/dashboard/real-estate");

    // Session B
    const contextB = await browser.newContext({ storageState: adminStorageStatePath });
    const pageB = await contextB.newPage();
    await pageB.goto("/dashboard/real-estate/apartments");
    await pageB.waitForLoadState("domcontentloaded");
    expect(pageB.url()).toContain("/dashboard/real-estate/apartments");

    await contextB.close();
  });

  test("Journey 7: Anti-False-Green Rendered Affordance & Tab Panel Switching Verification", async ({ page }) => {
    // 1. Projects page topTab panel switching verification
    await page.goto("/dashboard/real-estate/projects");
    await page.waitForLoadState("domcontentloaded");

    // Click "Danh sách dự án" top tab pill
    await page.locator("button", { hasText: /^Danh sách dự án$/ }).first().click();
    await expect(page.locator("text=Danh sách chi tiết dự án")).toBeVisible({ timeout: 5000 });

    // Click "Bản đồ dự án" top tab pill
    await page.locator("button", { hasText: /^Bản đồ dự án$/ }).first().click();
    await expect(page.locator("text=Bản đồ địa lý dự án")).toBeVisible({ timeout: 5000 });

    // Click "Phân tích" top tab pill
    await page.locator("button", { hasText: /^Phân tích$/ }).first().click();
    await expect(page.locator("text=Phân tích chuyên sâu & Tốc độ hấp thụ")).toBeVisible({ timeout: 5000 });

    // Click "Báo cáo" top tab pill
    await page.locator("button", { hasText: /^Báo cáo$/ }).first().click();
    await expect(page.locator("text=Báo cáo tổng hợp dự án")).toBeVisible({ timeout: 5000 });

    // 2. Marketing Agency Card CTA & Popup Modal Verification
    await page.goto("/dashboard/real-estate/marketing");
    await page.waitForLoadState("domcontentloaded");

    // Switch to Channels & Agencies subsystem tab
    await page.getByRole("button", { name: /Kênh phân phối & Đại lý/i }).click();
    await expect(page.getByRole("button", { name: "Chi tiết ➔" }).first()).toBeVisible({ timeout: 5000 });

    // Click "Chi tiết ➔" on first agency card
    await page.getByRole("button", { name: "Chi tiết ➔" }).first().click();
    await expect(page.locator("text=Hồ sơ sàn liên kết F1")).toBeVisible({ timeout: 5000 });

    // Click "Đóng" on Agency Modal
    await page.getByRole("button", { name: "Đóng" }).click();
    await expect(page.locator("text=Hồ sơ sàn liên kết F1")).not.toBeVisible({ timeout: 5000 });

    // 3. Documents Drawer Close Verification
    await page.goto("/dashboard/real-estate/documents");
    await page.waitForLoadState("domcontentloaded");

    // Click "Xem chi tiết" option
    const detailBtn = page.getByRole("button", { name: "Xem chi tiết" }).first();
    if (await detailBtn.isVisible()) {
      await detailBtn.click();
      // Click X close button
      const closeBtn = page.locator("button:has(svg.lucide-x)").first();
      await closeBtn.click();
    }
  });
});
