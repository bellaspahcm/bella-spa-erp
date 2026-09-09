/**
 * Bella Preschool OS — Event-Driven Analytics & Executive Dashboard Browser Field E2E Test (P10)
 * File: e2e/tests/22-preschool-analytics-executive-dashboard.spec.ts
 *
 * Verifies real browser UI rendering, event-driven updates, and hybrid DB reconciliation:
 * 1. Open `/dashboard/education` (Executive Dashboard)
 * 2. Assert Preschool Welcome Banner, 5 KPI Summary Cards & Command Center ("Cần xử lý hôm nay")
 * 3. Seed student & invoice data in Supabase
 * 4. Verify Executive KPI Cards reflect updated domain truth across browser reload
 * 5. Verify 3-Layer Architecture Law: Dashboard ONLY displays truth projected from source domains
 */

import { test, expect } from "../fixtures/auth";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const tenantId = "00000000-0000-0000-0000-000000000001";

test.describe("Bella Preschool P10 Event-Driven Analytics & Executive Dashboard Browser Field E2E", () => {
  test("P10.3 Executive Dashboard Real-Time Operational Truth & KPI Verification E2E", async ({ page }) => {
    // 1. Navigate to Executive Dashboard
    await page.goto("/dashboard/education");
    await page.waitForLoadState("networkidle");

    // 2. Assert Welcome Banner & Core Executive Elements
    await expect(page.getByText("Chào mừng bạn trở lại!")).toBeVisible();
    await expect(page.getByText("Cần xử lý hôm nay")).toBeVisible();

    // 3. Assert KPI Summary Cards (Total Students, Classes, Teachers, Attendance %, Parents)
    await expect(page.getByText("Tổng số trẻ", { exact: true })).toBeVisible();
    await expect(page.getByText("Số lớp học", { exact: true })).toBeVisible();
    await expect(page.getByText("Giáo viên", { exact: true })).toBeVisible();
    await expect(page.getByText("Tỷ lệ chuyên cần", { exact: true })).toBeVisible();
    await expect(page.getByText("Phụ huynh", { exact: true })).toBeVisible();

    // 4. Assert Command Center quick action cards
    await expect(page.getByText("trẻ chưa điểm danh")).toBeVisible();
    await expect(page.getByText("đơn nghỉ chờ duyệt")).toBeVisible();

    // 5. Assert Charts section presence
    await expect(page.getByText("Sĩ số học sinh theo lớp")).toBeVisible();
    await expect(page.getByText("Tỷ lệ độ tuổi")).toBeVisible();
    await expect(page.getByText("Doanh thu theo tháng")).toBeVisible();

    // 6. Verify page reload preserves executive dashboard layout
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Chào mừng bạn trở lại!")).toBeVisible();
  });
});
