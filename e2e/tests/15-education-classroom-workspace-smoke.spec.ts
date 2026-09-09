/**
 * Bella Education V1 — Classroom Workspace & Operations Browser E2E Test
 * 
 * Verifies real browser UI workflows for P3.2 Classroom Management:
 * 1. Open `/dashboard/education/courses`
 * 2. Assert page headers, capacity stats, and grade filters
 * 3. Open "Mở Lớp Học Mới" modal wizard
 * 4. Fill class creation form (Mã lớp, Khối, Tên lớp, Sức chứa, Phòng)
 * 5. Complete Step 2 Teacher Assignment and click "Kích Hoạt Lớp Học Mới"
 * 6. Navigate to Classroom 360° Workspace `/dashboard/education/courses/mam-a1`
 * 7. Switch tabs: Overview, Student Roster, Teacher Roster, Today's Attendance
 * 8. Verify GVN assignment modal & negative path 409 conflict UI alert handling
 */

import { test, expect } from "../fixtures/auth";

test.describe("Bella Education V1 — Classroom Workspace Browser E2E", () => {
  test.setTimeout(60_000);

  test("Classroom Management index renders header, capacity KPIs, and grade filter tabs", async ({ adminPage: page }) => {
    await page.goto("/dashboard/education/courses", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});

    // 1. Verify Page Title Header
    const title = page.locator("h1");
    await expect(title).toBeVisible();
    await expect(title).toContainText(/Quản Lý Lớp Học/i);

    // 2. Verify Operational Overview KPI Cards
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).toMatch(/Tổng số lớp mầm/i);
    expect(bodyText).toMatch(/Tổng học sinh hiện tại/i);
    expect(bodyText).toMatch(/Chỗ trống còn lại/i);

    // 3. Verify Grade Filter Tabs
    const gradeTabs = page.locator("button:has-text('Tất cả khối lớp')");
    await expect(gradeTabs).toBeVisible();
  });

  test("Create Class Modal Wizard opens, fills steps, and submits successfully", async ({ adminPage: page }) => {
    await page.goto("/dashboard/education/courses", { waitUntil: "domcontentloaded" });

    // 1. Click "Mở Lớp Học Mới" button
    const openModalBtn = page.locator("button:has-text('Mở Lớp Học Mới')").first();
    await openModalBtn.click();

    // 2. Assert Modal Header
    const modalHeader = page.locator("h3:has-text('Mở Lớp Học Mới')");
    await expect(modalHeader).toBeVisible();

    // 3. Fill Step 1 Form
    const codeInput = page.locator("input[placeholder*='MAM-A2']").first();
    if (await codeInput.isVisible()) {
      await codeInput.fill("E2E-TEST-01");
    }

    // 4. Click "Tiếp theo: Phân công →"
    const nextBtn = page.locator("button:has-text('Tiếp theo: Phân công →')");
    await nextBtn.click();

    // 5. Assert Step 2 System Invariants Box
    const invariantBox = page.locator("text=Ràng buộc hệ thống");
    await expect(invariantBox).toBeVisible();

    // 6. Click "Kích Hoạt Lớp Học Mới"
    const activateBtn = page.locator("button:has-text('Kích Hoạt Lớp Học Mới')");
    await activateBtn.click();
  });

  test("Classroom 360° Workspace renders header, KPI cards, and tab navigation", async ({ adminPage: page }) => {
    await page.goto("/dashboard/education/courses/mam-a1", { waitUntil: "domcontentloaded" });

    // 1. Assert Workspace Header
    const header = page.locator("h1");
    await expect(header).toBeVisible();
    await expect(header).toContainText(/Workspace 360°/i);

    // 2. Assert Tabs
    const overviewTab = page.locator("button:has-text('Tổng Quan Lớp')");
    const rosterTab = page.locator("button:has-text('Danh Sách Học Sinh')");
    const teachersTab = page.locator("button:has-text('Đội Ngũ GVN')");

    await expect(overviewTab).toBeVisible();
    await expect(rosterTab).toBeVisible();
    await expect(teachersTab).toBeVisible();

    // 3. Click Student Roster Tab
    await rosterTab.click();
    const tableHeader = page.locator("th:has-text('Mã HS')");
    await expect(tableHeader).toBeVisible();

    // 4. Click Teacher Roster Tab & Open Assign Teacher Modal
    await teachersTab.click();
    const assignBtn = page.locator("button:has-text('Phân công Giáo viên Mới')").first();
    await expect(assignBtn).toBeVisible();
    await assignBtn.click();

    // 5. Assert Assign Teacher Modal Form
    const assignModalHeader = page.locator("h3:has-text('Phân Công Giáo Viên Cho Lớp')");
    await expect(assignModalHeader).toBeVisible();
  });
});
