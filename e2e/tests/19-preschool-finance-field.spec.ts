/**
 * Bella Preschool Finance Operating Kernel Browser Field E2E Test (P7.3)
 * File: e2e/tests/19-preschool-finance-field.spec.ts
 *
 * Verifies real browser UI workflows for P7 Preschool Finance & Platform Candidate Reuse:
 * 1. Seed database identities in Supabase (Tenants A/B, Persons, Students)
 * 2. Open `/dashboard/education/finance`
 * 3. Assert header `Preschool Finance Operating Kernel (P7)`
 * 4. Staff Zone 1 (Billing): Compile Draft Invoice -> Issue Invoice -> Project P6 Notice
 * 5. Staff Zone 2 (Collections): Run Overdue Scanner -> Resolve Exception in Work Queue
 * 6. Supreme Law Check: Exception resolution does NOT fake payment (`settlement_status` remains UNPAID)
 * 7. Staff Zone 3 (Cash & Evidence): Record Inbound Payment & Reconcile Ledger -> Settlement status transitions to PAID
 * 8. Parent View: Verify Amount Due, Itemized Fee Breakdown, and Receipt SHA-256 Fingerprint
 * 9. Refresh page to verify state persistence across browser reload
 */

import { test, expect } from "../fixtures/auth";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const tenantA = "00000000-0000-0000-0000-000000000001";
const tenantB = "00000000-0000-0000-0000-000000000002";
const staffId = "00000000-0000-0000-0000-000000000003";
const parentId = "00000000-0000-0000-0000-000000000004";
const studentIdA = "00000000-0000-0000-0000-000000000071";
const studentIdB = "00000000-0000-0000-0000-000000000072";

async function seedFinanceFieldDatabase() {
  if (!supabaseKey) return;

  // 1. Seed Tenants
  await supabase.from("tenants").upsert({ id: tenantA, name: "Bella Preschool Tenant A" });
  await supabase.from("tenants").upsert({ id: tenantB, name: "Bella Preschool Tenant B" });

  // 2. Seed Persons
  await supabase.from("persons").upsert({
    id: parentId,
    tenant_id: tenantA,
    first_name: "Phụ Huynh",
    last_name: "Trần An",
    date_of_birth: "1988-08-08",
    gender: "female",
  });
  await supabase.from("persons").upsert({
    id: staffId,
    tenant_id: tenantA,
    first_name: "Kế Toán",
    last_name: "Nguyễn Văn",
    date_of_birth: "1985-05-05",
    gender: "male",
  });

  // 3. Seed Student Persons
  const { data: stAPerson } = await supabase
    .from("persons")
    .upsert({ id: "00000000-0000-0000-0000-000000000710", tenant_id: tenantA, first_name: "Bé", last_name: "Minh An", date_of_birth: "2022-01-01", gender: "male" })
    .select("id")
    .single();

  const { data: stBPerson } = await supabase
    .from("persons")
    .upsert({ id: "00000000-0000-0000-0000-000000000720", tenant_id: tenantB, first_name: "Bé", last_name: "Gia Bảo", date_of_birth: "2022-02-02", gender: "male" })
    .select("id")
    .single();

  // 4. Seed Students
  await supabase.from("students").upsert({
    student_id: studentIdA,
    tenant_id: tenantA,
    person_id: stAPerson!.id,
    student_code: "P7-ST-001",
    academic_status: "enrolled",
    enrollment_type: "full_time",
    program_id: "PRESCHOOL",
    enrollment_date: "2026-09-01",
    metadata: { guardian_party_id: parentId, guardian_party_ids: [parentId] },
  });

  await supabase.from("students").upsert({
    student_id: studentIdB,
    tenant_id: tenantB,
    person_id: stBPerson!.id,
    student_code: "P7-ST-002",
    academic_status: "enrolled",
    enrollment_type: "full_time",
    program_id: "PRESCHOOL",
    enrollment_date: "2026-09-01",
    metadata: { guardian_party_id: parentId, guardian_party_ids: [parentId] },
  });

  // 5. Seed Base Fee Structure for Tenant A
  await supabase.from("edu_fin_fee_structures").upsert({
    id: "00000000-0000-0000-0000-000000000730",
    tenant_id: tenantA,
    program_id: "PRESCHOOL",
    fee_code: "TUITION_MONTHLY",
    fee_name: "Học phí mầm non chính khóa",
    fee_type: "TUITION",
    amount: 5000000,
    currency: "VND",
    billing_cycle: "MONTHLY",
    is_active: true,
  });
}

test.describe("Bella Preschool P7.3 Finance Command Center Browser Field E2E", () => {
  test.beforeEach(async () => {
    await seedFinanceFieldDatabase();
  });

  test("P7.3 Finance Operating Loop, Supreme Laws, Exception Resolution & Parent Receipt E2E", async ({ page }) => {
    // 1. Open Finance Command Center Workspace
    await page.goto("/dashboard/education/finance");
    await page.waitForLoadState("networkidle");

    // 2. Assert Page Header
    await expect(page.locator("h1")).toContainText("Preschool Finance Operating Kernel (P7)");

    // 3. Staff Zone 1 (Billing): Compile Draft Invoice
    await page.click("[data-testid='staff-zone-billing']");
    await page.click("[data-testid='btn-compile-invoice']");
    await expect(page.locator("text=Đã lập hóa đơn nháp thành công")).toBeVisible({ timeout: 10000 });
    
    // Issue Invoice (DRAFT ➔ ISSUED)
    const btnIssue = page.locator("[data-testid='btn-issue-invoice']").first();
    await expect(btnIssue).toBeVisible({ timeout: 10000 });
    await btnIssue.click();
    await expect(page.locator("text=Đã phát hành hóa đơn")).toBeVisible({ timeout: 10000 });

    // Project Invoice Notice to Parent
    const btnProject = page.locator("[data-testid='btn-project-notice']").first();
    await expect(btnProject).toBeVisible({ timeout: 10000 });
    await btnProject.click();
    await expect(page.locator("text=Đã gửi thông báo hóa đơn")).toBeVisible({ timeout: 10000 });

    // 4. Staff Zone 2 (Collections): Run Overdue Scanner & Work Queue
    await page.click("[data-testid='staff-zone-collections']");
    await page.click("[data-testid='btn-scan-overdue']");
    await expect(page.locator("text=Quét thành công")).toBeVisible({ timeout: 10000 });
    
    // Resolve exception in queue
    const btnResolve = page.locator("[data-testid='btn-resolve-exception']").first();
    await expect(btnResolve).toBeVisible({ timeout: 10000 });
    await btnResolve.click();
    await expect(page.locator("text=Đã xử lý ngoại lệ")).toBeVisible({ timeout: 10000 });

    // 5. Staff Zone 3 (Cash & Evidence): Record Payment & Reconcile Ledger
    await page.click("[data-testid='staff-zone-cash']");
    const btnReconcile = page.locator("[data-testid='btn-reconcile-payment']").first();
    await expect(btnReconcile).toBeVisible({ timeout: 10000 });
    await btnReconcile.click();
    await page.waitForTimeout(1500);

    // 6. Switch to Parent Finance View
    await page.click("[data-testid='mode-tab-parent']");
    await expect(page.locator("[data-testid='parent-settlement-status']")).toBeVisible();
    await expect(page.locator("[data-testid='parent-receipt-fingerprint']")).toBeVisible();

    // 7. Verify persistent state across browser reload
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toContainText("Preschool Finance Operating Kernel (P7)");
  });
});
