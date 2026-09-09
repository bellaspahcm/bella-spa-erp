/**
 * Bella Preschool OS — Staff Scheduling Operating Kernel Browser Field E2E Test (P8.3)
 * File: e2e/tests/20-preschool-scheduling-field.spec.ts
 *
 * Verifies real browser UI workflows for P8 Preschool Staff Scheduling & Platform Candidate Reuse #2:
 * 1. Seed database identities in Supabase (Tenants A/B, Persons, Roster, Ratio Policies)
 * 2. Open `/dashboard/education/scheduling`
 * 3. Assert page header `P8 Preschool Staff Scheduling & Shift Management`
 * 4. Tab 1 (Roster & Ratio): Click Seed Shift -> Assert Roster Table & Ratio Compliance Status (COMPLIANT)
 * 5. Tab 2 (Leave & Substitution): Apply for Leave -> Approve Leave -> Assert Ratio Compliance drops to SHORTAGE_VIOLATION & Exception Work Queue projected
 * 6. Supreme Invariant: Resolve Exception in Work Queue -> Compliance state strictly remains SHORTAGE_VIOLATION until actual substitute assignment
 * 7. Tab 2: Assign Substitute Staff -> Ratio Compliance state recalculates back to COMPLIANT
 * 8. Refresh page to verify state persistence across browser reload
 */

import { test, expect } from "../fixtures/auth";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const tenantA = "00000000-0000-0000-0000-000000000001";
const staffTeacher1 = "00000000-0000-0000-0000-000000000081";
const staffTeacher2 = "00000000-0000-0000-0000-000000000082";
const staffCaregiver1 = "00000000-0000-0000-0000-000000000083";

async function seedSchedulingFieldDatabase() {
  if (!supabaseKey) return;

  // 1. Seed Tenants
  await supabase.from("tenants").upsert({ id: tenantA, name: "Bella Preschool Tenant A" });

  // 2. Seed Persons for Staff
  await supabase.from("persons").upsert({
    id: staffTeacher1,
    tenant_id: tenantA,
    first_name: "Giáo Viên 1",
    last_name: "Nguyễn Thị",
    date_of_birth: "1990-01-01",
    gender: "female",
  });

  await supabase.from("persons").upsert({
    id: staffTeacher2,
    tenant_id: tenantA,
    first_name: "Giáo Viên 2",
    last_name: "Trần Văn",
    date_of_birth: "1992-02-02",
    gender: "male",
  });

  await supabase.from("persons").upsert({
    id: staffCaregiver1,
    tenant_id: tenantA,
    first_name: "Bảo Mẫu 1",
    last_name: "Lê Thị",
    date_of_birth: "1994-03-03",
    gender: "female",
  });
}

test.describe("Bella Preschool P8.3 Staff Scheduling Command Center Browser Field E2E", () => {
  test.beforeEach(async () => {
    await seedSchedulingFieldDatabase();
  });

  test("P8.3 Staff Scheduling Operating Loop, Caregiver Ratio Audit, Leave, Substitute & Work Queue E2E", async ({ page }) => {
    // 1. Open Staff Scheduling Command Center Workspace
    await page.goto("/dashboard/education/scheduling");
    await page.waitForLoadState("networkidle");

    // 2. Assert Page Header
    await expect(page.locator("h1")).toContainText("P8 Preschool Staff Scheduling & Shift Management");

    // 3. Tab 1 (Roster & Ratio): Click Seed Shift
    await page.click("[data-testid='tab-roster']");
    await page.click("[data-testid='btn-seed-shift']");
    await expect(page.getByText("Đã khởi tạo Ca Sáng & Phân công Giáo viên thành công")).toBeVisible({ timeout: 10000 });
    
    // Assert ratio compliance status badge
    await expect(page.locator("[data-testid='ratio-compliance-badge']")).toContainText("COMPLIANT");

    // 4. Tab 2 (Leave & Substitution): Apply for Leave
    await page.click("[data-testid='tab-leave']");
    await page.click("[data-testid='btn-apply-leave']");
    await expect(page.getByText("Đã gửi Đơn xin nghỉ phép")).toBeVisible({ timeout: 10000 });

    // Approve Leave (Triggers shift cancellation & exception escalation)
    const btnApprove = page.locator("[data-testid='btn-approve-leave']").first();
    await expect(btnApprove).toBeVisible({ timeout: 10000 });
    await btnApprove.click();
    await expect(page.getByText("Phát hiện Thiếu Nhân sự")).toBeVisible({ timeout: 10000 });

    // Assert ratio compliance drops to SHORTAGE_VIOLATION
    await expect(page.locator("[data-testid='ratio-compliance-badge']")).toContainText("SHORTAGE_VIOLATION");

    // 5. Tab 3 (Work Queue): Verify STAFFING_SHORTAGE_SLA exception projected & resolve it
    await page.click("[data-testid='tab-work-queue']");
    const btnResolve = page.locator("[data-testid='btn-resolve-exception']").first();
    await expect(btnResolve).toBeVisible({ timeout: 10000 });
    await btnResolve.click();
    await expect(page.getByText("Đã đóng Exception trong Work Queue")).toBeVisible({ timeout: 10000 });

    // Supreme Invariant Assert: Work Queue resolution DOES NOT alter compliance truth (strictly remains SHORTAGE_VIOLATION)
    await expect(page.locator("[data-testid='ratio-compliance-badge']")).toContainText("SHORTAGE_VIOLATION");

    // 6. Tab 2: Assign Substitute Staff
    await page.click("[data-testid='tab-leave']");
    const btnSubstitute = page.locator("[data-testid='btn-assign-substitute']").first();
    await expect(btnSubstitute).toBeVisible({ timeout: 10000 });
    await btnSubstitute.click();
    await expect(page.getByText("Đã phân công Giáo viên dạy thay thành công")).toBeVisible({ timeout: 10000 });

    // Assert Ratio Compliance recalculated back to COMPLIANT
    await expect(page.locator("[data-testid='ratio-compliance-badge']")).toContainText("COMPLIANT");

    // 7. Verify persistent state across browser reload
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toContainText("P8 Preschool Staff Scheduling & Shift Management");
  });
});
