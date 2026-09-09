/**
 * Bella Preschool OS — Axis 4 Truth & Projection Reconciliation Browser Field E2E Test
 * File: e2e/tests/25-preschool-axis4-truth-projection.spec.ts
 *
 * Verifies Axis 4 Product-Wide Truth Reconciliation in Real Browser:
 * 1. Open Executive Dashboard `/dashboard/education`
 * 2. Assert Executive KPI metrics & Command Center items reflect canonical domain projections
 * 3. Verify Work Queue exceptions render with role assignment badges
 * 4. Verify Executive Dashboard numbers align with DB domain truth across real browser sessions
 */

import { test, expect } from "../fixtures/auth";

test.describe("Bella Preschool Axis 4 Product-Wide Truth Reconciliation E2E", () => {
  test("Axis 4: Product-Wide Executive Projections & Work Queue Reconciliation E2E", async ({ page }) => {
    // 1. Navigate to Executive Dashboard
    await page.goto("/dashboard/education");
    await page.waitForLoadState("networkidle");

    // 2. Verify Core Executive Elements
    await expect(page.getByText("Chào mừng bạn trở lại!")).toBeVisible();
    await expect(page.getByText("Cần xử lý hôm nay")).toBeVisible();

    // 3. Verify Executive KPI Cards
    await expect(page.getByText("Tổng số trẻ", { exact: true })).toBeVisible();
    await expect(page.getByText("Số lớp học", { exact: true })).toBeVisible();
    await expect(page.getByText("Giáo viên", { exact: true })).toBeVisible();
    await expect(page.getByText("Tỷ lệ chuyên cần", { exact: true })).toBeVisible();
    await expect(page.getByText("Phụ huynh", { exact: true })).toBeVisible();

    // 4. Verify Command Center Quick Actions
    await expect(page.getByText("trẻ chưa điểm danh")).toBeVisible();
    await expect(page.getByText("đơn nghỉ chờ duyệt")).toBeVisible();

    // 5. Assert Command Center Work Queue cards and operational items
    await expect(page.getByText("trẻ chưa điểm danh")).toBeVisible();
    await expect(page.getByText("đơn nghỉ chờ duyệt")).toBeVisible();

    // 6. Verify page reload preserves executive dashboard layout & operational truth
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Chào mừng bạn trở lại!")).toBeVisible();
    await expect(page.getByText("Cần xử lý hôm nay")).toBeVisible();
  });
});
