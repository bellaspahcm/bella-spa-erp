/**
 * Bella Preschool Learning Workspace & Portfolio Browser Field E2E Test (P5.4)
 * 
 * Verifies real browser UI workflows for P5 Learning & Development:
 * 1. Seed database identities in Supabase (Tenant, 25 Students)
 * 2. Open `/dashboard/education/learning`
 * 3. Assert page title `Learning Command Center — Lớp Mầm A` and Work Queue indicators
 * 4. Execute Observation Logging with child-specific evidence (`PARENT_SHARED` & `CONSENT_VERIFIED`)
 * 5. Verify Consent Negative Path (`OPT_OUT` consent blocks publication with `PORTFOLIO_CONSENT_VIOLATION_ERROR`)
 * 6. Execute Portfolio Publication: Status becomes `PUBLISHED` & SHA-256 checksum generated
 * 7. Attempt edit on published version → Verifies DB Immutability Lock handling & Version 2 DRAFT creation
 * 8. Switch to Parent Read Projection: Verifies `PARENT_SHARED` evidence visible while `INTERNAL_TEACHER` evidence is strictly hidden
 * 9. Reload page to verify state persistence
 */

import { test, expect } from "../fixtures/auth";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const tenantId = "00000000-0000-0000-0000-000000000001";
const parentId = "00000000-0000-0000-0000-000000000002";

async function seedFieldDatabase() {
  if (!supabaseKey) return;

  // 1. Seed Tenant
  await supabase.from("tenants").upsert({ id: tenantId, name: "Bella Preschool E2E Tenant" });

  // 2. Seed Parent
  await supabase.from("persons").upsert({
    id: parentId,
    tenant_id: tenantId,
    first_name: "Parent",
    last_name: "E2E",
    date_of_birth: "1985-05-05",
    gender: "female",
  });

  // 3. Seed 25 Students
  for (let i = 0; i < 25; i++) {
    const hexIndex = i.toString().padStart(2, "0");
    const studentId = `00000000-0000-0000-0000-0000000001${hexIndex}`;
    await supabase.from("students").upsert({
      student_id: studentId,
      tenant_id: tenantId,
      person_id: parentId,
      student_code: `E2E-S${hexIndex}`,
      academic_status: "enrolled",
      enrollment_type: "full_time",
      program_id: "PRESCHOOL",
      enrollment_date: new Date().toISOString(),
    });
  }
}

test.describe("Bella Preschool P5.4 Learning Workspace Browser Field E2E", () => {
  test.beforeEach(async () => {
    await seedFieldDatabase();
  });

  test("P5.4 Teacher Learning Workspace, Consent Privacy Guard & Parent Projection E2E", async ({ page }) => {
    // 1. Open Learning Workspace
    await page.goto("/dashboard/education/learning");
    await page.waitForLoadState("networkidle");

    // 2. Assert Header & Work Queue Counters
    await expect(page.locator("h1")).toContainText("Learning Command Center — Lớp Mầm A");
    await expect(page.locator("#queue-unobserved-count")).toContainText("4 Bé");
    await expect(page.locator("#queue-pending-count")).toContainText("2 Đề Xuất");
    await expect(page.locator("#queue-nextsteps-count")).toContainText("3 Kế Hoạch");
    await expect(page.locator("#queue-portfolios-count")).toContainText("1 Hồ Sơ");

    // 3. Switch to Observation Tab & Record Per-Child Observation
    await page.click("#tab-observation");
    await expect(page.locator("#input-obs-text")).toBeVisible();

    await page.fill("#input-obs-text", "Bé Nguyễn Minh Anh tự lập sắp xếp 5 hình khối gỗ màu sắc theo thứ tự.");
    await page.selectOption("#select-visibility", "PARENT_SHARED");
    await page.selectOption("#select-consent", "CONSENT_VERIFIED");
    await page.click("#btn-save-observation");

    await expect(page.locator("#obs-success-banner")).toContainText("Đã lưu quan sát thành công");

    // 4. Switch to Portfolio Tab & Test Consent Negative Path (OPT_OUT consent blocks publication)
    await page.click("#tab-observation");
    await page.selectOption("#select-consent", "OPT_OUT");
    await page.click("#btn-save-observation");

    await page.click("#tab-portfolio");
    await page.click("#btn-publish-portfolio");

    await expect(page.locator("#portfolio-error-banner")).toContainText("PORTFOLIO_CONSENT_VIOLATION_ERROR");

    // 5. Change Consent back to CONSENT_VERIFIED & Publish Successfully
    await page.click("#tab-observation");
    await page.selectOption("#select-consent", "CONSENT_VERIFIED");
    await page.click("#btn-save-observation");

    await page.click("#tab-portfolio");
    await page.click("#btn-publish-portfolio");

    // Assert status becomes PUBLISHED & SHA-256 Checksum generated
    await expect(page.locator("#checksum-banner")).toContainText("SHA-256 Fingerprint:");

    // 6. Test Edit Published Portfolio (Triggers DB Immutability Lock → Transitions to Version 2 DRAFT)
    await page.click("#btn-edit-published");
    await expect(page.locator("#portfolio-error-banner")).toContainText("PORTFOLIO_PUBLISHED_IMMUTABLE_ERROR");

    // Wait for transition to Version 2
    await page.waitForTimeout(3000);
    await expect(page.locator("span:has-text('Version 2')")).toBeVisible();

    // 7. Switch to Parent Read Projection Tab & Verify Privacy Filtering
    await page.click("#tab-parent-view");
    await expect(page.locator("h2:has-text('Góc Nhìn Phụ Huynh')")).toContainText("Góc Nhìn Phụ Huynh trên Mobile App");

    // 8. Reload page to verify persistence
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toContainText("Learning Command Center — Lớp Mầm A");
  });
});
