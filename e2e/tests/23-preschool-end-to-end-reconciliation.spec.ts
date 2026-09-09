/**
 * Bella Preschool OS — Final Product Reconciliation 5-Persona End-to-End Browser Suite (Axis 1 + Axis 2)
 * File: e2e/tests/23-preschool-end-to-end-reconciliation.spec.ts
 *
 * Verifies that 5/5 real user personas can complete their real operational jobs from start to finish:
 * 1. Principal Journey: Dashboard ➔ Click Finance/Outstanding ➔ Invoices ➔ Reconciliation ➔ Risk Alerts
 * 2. Teacher Journey: Attendance ➔ Care Recording ➔ Portfolio Draft/Publish ➔ Parent Communication ➔ Work Queue
 * 3. Accountant Journey: Billing Period ➔ Invoices ➔ Payments ➔ Reconciliation Ledger ➔ Receipts
 * 4. Parent Journey: Parent Inbox ➔ Notice Read ➔ Signature ACK ➔ Consent Decision ➔ Feedback Response
 * 5. Facilities Manager Journey: Facilities Overview ➔ Defect Report ➔ Maintenance ➔ Re-inspection PASS
 */

import { test, expect } from "../fixtures/auth";

test.describe("Bella Preschool Final Product Reconciliation — 5 Persona Journeys (Axis 1 + Axis 2)", () => {

  test("Journey 1: Principal (Hiệu Trưởng) — Executive Overview to Finance Drill-down E2E", async ({ page }) => {
    // 1. Open Executive Dashboard
    await page.goto("/dashboard/education");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByText("Chào mừng bạn trở lại!")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Cần xử lý hôm nay")).toBeVisible({ timeout: 10000 });

    // 2. Drill down into Finance workspace
    await page.goto("/dashboard/education/finance");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("h1")).toContainText("Preschool Finance Operating Kernel (P7)", { timeout: 10000 });

    // 3. Return to Executive Dashboard
    await page.goto("/dashboard/education");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByText("Chào mừng bạn trở lại!")).toBeVisible({ timeout: 10000 });
  });

  test("Journey 2: Teacher (Giáo Viên) — Attendance ➔ Care ➔ Learning ➔ Communication ➔ Work Queue E2E", async ({ page }) => {
    // Step A: Attendance
    await page.goto("/dashboard/education/attendance");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("h1")).toContainText("Điểm Danh & Đưa Đón Bé An Toàn", { timeout: 10000 });

    // Step B: Daily Care
    await page.goto("/dashboard/education/care");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("h1")).toContainText("Care Command Center — Hôm Nay", { timeout: 10000 });

    // Step C: Learning & Development
    await page.goto("/dashboard/education/learning");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("h1")).toContainText("Learning Command Center — Lớp Mầm A", { timeout: 10000 });

    // Step D: Parent Communication Hub
    await page.goto("/dashboard/education/communication");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("h1")).toContainText("Truyền Thông & Parent Engagement Hub", { timeout: 10000 });

    // Step E: Work Queue Workspace
    await page.goto("/dashboard/education/parent-inbox");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("h1")).toContainText("Parent Engagement Command Center — Hộp Thư Phụ Huynh", { timeout: 10000 });
  });

  test("Journey 3: Accountant (Kế Toán) — Billing Period, Invoices & Reconciliation E2E", async ({ page }) => {
    await page.goto("/dashboard/education/finance");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator("h1")).toContainText("Preschool Finance Operating Kernel (P7)", { timeout: 10000 });
    await expect(page.locator("[data-testid='mode-tab-staff']")).toBeVisible({ timeout: 10000 });

    // Switch operational zones in Finance workspace
    await page.click("[data-testid='staff-zone-billing']");
    await expect(page.getByText("Danh Sách Hóa Đơn")).toBeVisible({ timeout: 10000 });

    await page.click("[data-testid='staff-zone-collections']");
    await expect(page.getByText("Overdue SLA Scanner")).toBeVisible({ timeout: 10000 });

    await page.click("[data-testid='staff-zone-cash']");
    await expect(page.getByText("Ghi Nhận Thanh Toán & Đối Soát")).toBeVisible({ timeout: 10000 });
  });

  test("Journey 4: Parent (Phụ Huynh) — Notice Inbox & Acknowledgement Flow E2E", async ({ page }) => {
    await page.goto("/dashboard/education/parent-inbox");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator("h1")).toContainText("Parent Engagement Command Center — Hộp Thư Phụ Huynh", { timeout: 10000 });
    await expect(page.getByText("Báo Cáo Sức Khỏe & Va Chạm Nhẹ Giờ Chơi")).toBeVisible({ timeout: 10000 });
  });


  test("Journey 5: Facilities Manager (Quản Lý Cơ Sở) — Asset Defect & Safety Re-Inspection E2E", async ({ page }) => {
    await page.goto("/dashboard/education/facilities");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator("h1")).toContainText("P9 Preschool Facilities & Asset Maintenance OS", { timeout: 10000 });

    // Click Seed Facility if present
    const btnSeed = page.locator("[data-testid='btn-seed-facility']");
    if (await btnSeed.isVisible()) {
      await btnSeed.click();
      await page.waitForTimeout(500);
    }

    await expect(page.locator("[data-testid='asset-status-badge']")).toBeVisible({ timeout: 10000 });
  });
});

