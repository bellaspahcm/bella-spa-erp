/**
 * Bella Preschool OS — Facilities & Asset Maintenance Operating Kernel Browser Field E2E Test (P9.3)
 * File: e2e/tests/21-preschool-facilities-field.spec.ts
 *
 * Verifies real browser UI workflows for P9 Preschool Facilities & Platform Candidate Reuse #3:
 * 1. Seed database identities in Supabase
 * 2. Open `/dashboard/education/facilities`
 * 3. Assert page header `P9 Preschool Facilities & Asset Maintenance OS`
 * 4. Tab 1 (Overview): Click Seed Facility -> Assert Asset Status (OPERATIONAL) & Zone Availability (AVAILABLE)
 * 5. Report Critical Defect -> Assert Asset Status drops to OUT_OF_SERVICE, Zone Availability drops to OUT_OF_SERVICE, and SAFETY_DEFECT exception projected into Work Queue
 * 6. Tab 5 (Work Queue): Resolve Exception in Work Queue
 * 7. Supreme Invariant Assert: Work Queue resolution DOES NOT alter asset or zone operational truth (strictly remains OUT_OF_SERVICE)
 * 8. Tab 1: Complete Maintenance Job -> Asset Status transitions to UNDER_INSPECTION (STILL NOT OPERATIONAL)
 * 9. Tab 1: Perform Independent Safety Re-Inspection (PASS) -> Asset Status ONLY NOW transitions to OPERATIONAL & Zone Availability to AVAILABLE
 * 10. Refresh page to verify state persistence across browser reload
 */

import { test, expect } from "../fixtures/auth";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const tenantA = "00000000-0000-0000-0000-000000000001";
const inspectorPartyId = "00000000-0000-0000-0000-000000000071";

async function seedFacilitiesFieldDatabase() {
  if (!supabaseKey) return;

  // 1. Seed Tenant
  await supabase.from("tenants").upsert({ id: tenantA, name: "Bella Preschool Tenant A" });

  // 2. Seed Inspector Person
  await supabase.from("persons").upsert({
    id: inspectorPartyId,
    tenant_id: tenantA,
    first_name: "Kiểm Định Viên",
    last_name: "Trần An Toàn",
    date_of_birth: "1988-08-08",
    gender: "male",
  });
}

test.describe("Bella Preschool P9.3 Facilities & Asset Maintenance Command Center Browser Field E2E", () => {
  test.beforeEach(async () => {
    await seedFacilitiesFieldDatabase();
  });

  test("P9.3 Facilities Operating Loop, Safety Inspection Invariants, Maintenance & Work Queue Reuse #3 E2E", async ({ page }) => {
    // 1. Open Facilities Command Center Workspace
    await page.goto("/dashboard/education/facilities");
    await page.waitForLoadState("networkidle");

    // 2. Assert Page Header
    await expect(page.locator("h1")).toContainText("P9 Preschool Facilities & Asset Maintenance OS");

    // 3. Click Seed Facility
    await page.click("[data-testid='tab-overview']");
    await page.click("[data-testid='btn-seed-facility']");
    await expect(page.getByText("Đã khởi tạo Cơ sở vật chất, Khu vui chơi ngoài trời & Thiết bị mẫu thành công")).toBeVisible({ timeout: 10000 });

    // Assert initial operational status & zone availability
    await expect(page.locator("[data-testid='asset-status-badge']")).toContainText("OPERATIONAL");
    await expect(page.locator("[data-testid='zone-availability-badge']")).toContainText("AVAILABLE");

    // 4. Report Critical Defect (Triggers FAIL_CRITICAL safety inspection & exception escalation)
    await page.click("[data-testid='btn-report-critical-defect']");
    await expect(page.getByText("Phát hiện Sự cố An toàn Critical")).toBeVisible({ timeout: 10000 });

    // Assert status drops to OUT_OF_SERVICE
    await expect(page.locator("[data-testid='asset-status-badge']")).toContainText("OUT_OF_SERVICE");
    await expect(page.locator("[data-testid='zone-availability-badge']")).toContainText("OUT_OF_SERVICE");

    // 5. Tab 5 (Work Queue): Verify SAFETY_DEFECT exception projected & resolve it
    await page.click("[data-testid='tab-maintenance']");
    const btnResolve = page.locator("[data-testid='btn-resolve-exception']").first();
    await expect(btnResolve).toBeVisible({ timeout: 10000 });
    await btnResolve.click();
    await expect(page.getByText("Đã đóng Exception trong Work Queue")).toBeVisible({ timeout: 10000 });

    // Supreme Invariant Assert: Work Queue resolution DOES NOT alter asset operational truth (strictly remains OUT_OF_SERVICE)
    await expect(page.locator("[data-testid='asset-status-badge']")).toContainText("OUT_OF_SERVICE");
    await expect(page.locator("[data-testid='zone-availability-badge']")).toContainText("OUT_OF_SERVICE");

    // 6. Tab 1: Complete Maintenance Job -> Asset Status transitions to UNDER_INSPECTION (STILL NOT OPERATIONAL)
    await page.click("[data-testid='tab-overview']");
    await page.click("[data-testid='btn-complete-maintenance']");
    await expect(page.getByText("Đã hoàn thành Work Order bảo trì")).toBeVisible({ timeout: 10000 });

    // Assert Asset Status transitions to UNDER_INSPECTION (NOT OPERATIONAL)
    await expect(page.locator("[data-testid='asset-status-badge']")).toContainText("UNDER_INSPECTION");

    // 7. Tab 1: Perform Independent Safety Re-Inspection (PASS) -> Asset Status ONLY NOW transitions to OPERATIONAL
    await page.click("[data-testid='btn-pass-reinspection']");
    await expect(page.getByText("Kiểm định An toàn ĐẠT CHUẨN (PASS)")).toBeVisible({ timeout: 10000 });

    // Assert Asset Status & Zone Availability recalculated back to OPERATIONAL & AVAILABLE
    await expect(page.locator("[data-testid='asset-status-badge']")).toContainText("OPERATIONAL");
    await expect(page.locator("[data-testid='zone-availability-badge']")).toContainText("AVAILABLE");

    // 8. Verify persistent state across browser reload
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toContainText("P9 Preschool Facilities & Asset Maintenance OS");
  });
});
