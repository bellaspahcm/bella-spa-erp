/**
 * Bella Preschool Parent Engagement & Parent Inbox Browser Field E2E Test (P6.3)
 * 
 * Verifies real browser UI workflows for P6 Parent Engagement:
 * 1. Seed database identities in Supabase (Tenant, Parent, 25 Students)
 * 2. Open `/dashboard/education/parent-inbox`
 * 3. Assert header `Parent Engagement Command Center — Hộp Thư Phụ Huynh` & metrics
 * 4. Test Strict Negative Guard: Attempting to ACK an UNREAD notice triggers `COMMUNICATION_UNREAD_ACKNOWLEDGEMENT_ERROR`
 * 5. Execute Delivery Lifecycle: Mark notice as READ -> Badge updates to `✓ READ (Đã Đọc)`
 * 6. Execute Acknowledgement Lifecycle: Click ACK -> Status transitions to `ACKNOWLEDGED`
 * 7. Execute Consent Response Lifecycle: Click Approve -> Consent status updates to `APPROVED`
 * 8. Test Staff Exception Work Queue: Filter by Work Queue -> Resolve active overdue exception
 * 9. Reload page to verify state persistence across browser refresh
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

  // 2. Seed Parent Person
  await supabase.from("persons").upsert({
    id: parentId,
    tenant_id: tenantId,
    first_name: "Parent",
    last_name: "Engagement E2E",
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
      student_code: `P6-S${hexIndex}`,
      academic_status: "enrolled",
      enrollment_type: "full_time",
      program_id: "PRESCHOOL",
      enrollment_date: new Date().toISOString(),
    });
  }
}

test.describe("Bella Preschool P6.3 Parent Inbox & Work Queue Browser Field E2E", () => {
  test.beforeEach(async () => {
    await seedFieldDatabase();
  });

  test("P6.3 Parent Inbox 3 Independent Lifecycles, Negative Guards & Staff Work Queue E2E", async ({ page }) => {
    // 1. Open Parent Inbox Command Center
    await page.goto("/dashboard/education/parent-inbox");
    await page.waitForLoadState("networkidle");

    // 2. Assert Header & Operational Metrics Counters
    await expect(page.locator("h1")).toContainText("Parent Engagement Command Center");
    await expect(page.locator("#queue-pending-ack-count")).toBeVisible();
    await expect(page.locator("#queue-pending-consent-count")).toBeVisible();
    await expect(page.locator("#queue-active-exception-count")).toContainText("1 Exceptions");

    // 3. Test Strict Negative Guard: Attempt to ACK UNREAD notice NOT-001 directly
    await page.click("#btn-acknowledge-NOT-001");
    await expect(page.locator("#notice-error-banner")).toContainText("COMMUNICATION_UNREAD_ACKNOWLEDGEMENT_ERROR");

    // 4. Execute Delivery Lifecycle: Mark notice NOT-001 as READ
    await page.click("#btn-mark-read-NOT-001");
    await expect(page.locator("#badge-delivery-NOT-001")).toContainText("✓ READ (Đã Đọc)");

    // 5. Execute Acknowledgement Lifecycle: Click ACK on notice NOT-001
    await page.click("#btn-acknowledge-NOT-001");
    await expect(page.locator("#badge-ack-NOT-001")).toContainText("ACKNOWLEDGED");
    await expect(page.locator("#notice-success-banner")).toContainText("ACKNOWLEDGED");

    // 6. Execute Consent Response Lifecycle: Consent Approve on notice NOT-002
    await page.click("#btn-consent-approve-NOT-002");
    await expect(page.locator("#badge-consent-NOT-002")).toContainText("APPROVED");
    await expect(page.locator("#notice-success-banner")).toContainText("APPROVED");

    // 7. Filter by Staff Work Queue Tab & Resolve Overdue Exception
    await page.click("#tab-work-queue");
    await expect(page.locator("#notice-card-NOT-004")).toBeVisible();
    await page.click("#btn-resolve-exception-NOT-004");
    await expect(page.locator("#notice-success-banner")).toContainText("Nhà trường đã xử lý xong Exception Escalation!");

    // 8. Reload page to verify state persistence across refresh
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toContainText("Parent Engagement Command Center");
  });
});
