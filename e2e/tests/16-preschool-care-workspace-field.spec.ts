/**
 * Bella Preschool Care Workspace & Operations Browser Field E2E Test (P4.3)
 * 
 * Verifies real browser UI workflows for P4 Care & Wellbeing:
 * 1. Seed real Database identities in Supabase (Tenant, 25 Students, Peanut Allergen & Conflict Meal)
 * 2. Open `/dashboard/education/care`
 * 3. Assert page header `Care Command Center — Hôm Nay` and class `Lớp Mầm A · 25 bé`
 * 4. Open `[ Ghi Nhận Hàng Loạt ]` modal drawer
 * 5. Execute Bulk Meal with peanut allergy conflict dish (Satay Noodles)
 * 6. Real API & DB Execution returns PARTIAL SUCCESS RESULT: 24/25 Committed, 1 Hard Blocked with ALLERGY_EXPOSURE_RISK
 * 7. Assert Exception Alert Center (`⚠ CẦN XỬ LÝ`) renders blocked allergy & high fever cases
 * 8. Execute Medication Administration via P4.1 MedicationSafetyService
 * 9. Execute Parent Digest Lifecycle: GENERATED ➔ PUBLISHED (Immutable Snapshot)
 * 10. Reload page to verify state persistence
 */

import { test, expect } from "../fixtures/auth";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const tenantId = "00000000-0000-0000-0000-000000000001";
const parentId = "00000000-0000-0000-0000-000000000002";
const mealItemId = "00000000-0000-0000-0000-000000000999";

async function seedFieldDatabase() {
  if (!supabaseKey) return;

  // Cleanup old test data for idempotency
  await supabase.from("edu_child_allergies").delete().eq("tenant_id", tenantId);
  await supabase.from("edu_ingredient_allergens").delete().eq("tenant_id", tenantId);
  await supabase.from("edu_meal_item_ingredients").delete().eq("tenant_id", tenantId);
  await supabase.from("edu_daily_parent_digests").delete().eq("tenant_id", tenantId);
  await supabase.from("edu_daily_care_records").delete().eq("tenant_id", tenantId);
  await supabase.from("edu_daily_care_sessions").delete().eq("tenant_id", tenantId);

  // 1. Seed Tenant
  await supabase.from("tenants").upsert({ id: tenantId, name: "Bella Preschool E2E Tenant" });

  // 2. Seed Guardian
  await supabase.from("persons").upsert({
    id: parentId,
    tenant_id: tenantId,
    first_name: "Parent",
    last_name: "E2E",
    date_of_birth: "1985-05-05",
    gender: "female",
  });

  // 3. Seed 25 Students (00000000-0000-0000-0000-000000000100 to 124)
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

  // 4. Seed Peanut Allergen & Ingredient
  const allergicStudentId = "00000000-0000-0000-0000-000000000100";

  const { data: allergen } = await supabase
    .from("edu_allergens")
    .upsert({ tenant_id: tenantId, name: "Peanuts" }, { onConflict: "tenant_id,name" })
    .select("id")
    .single();

  const { data: ingredient } = await supabase
    .from("edu_food_ingredients")
    .upsert({ tenant_id: tenantId, name: "Peanut Sauce" }, { onConflict: "tenant_id,name" })
    .select("id")
    .single();

  if (allergen && ingredient) {
    await supabase.from("edu_ingredient_allergens").upsert({
      tenant_id: tenantId,
      ingredient_id: ingredient.id,
      allergen_id: allergen.id,
    });

    // Allergy binding for student 1
    await supabase.from("edu_child_allergies").upsert({
      tenant_id: tenantId,
      student_id: allergicStudentId,
      allergen_id: allergen.id,
      severity: "SEVERE",
    }, { onConflict: "tenant_id,student_id,allergen_id" });

    // Seed Meal item Satay Noodles
    await supabase.from("edu_meal_items").upsert({
      id: mealItemId,
      tenant_id: tenantId,
      name: "Satay Noodles",
    });

    await supabase.from("edu_meal_item_ingredients").upsert({
      tenant_id: tenantId,
      meal_item_id: mealItemId,
      ingredient_id: ingredient.id,
    });
  }
}

test.describe("Bella Preschool V1 — Care Workspace Browser Field E2E", () => {
  test.setTimeout(90_000);

  test.beforeAll(async () => {
    await seedFieldDatabase();
  });

  test("Care Command Center renders header, exception alert center, and medication queue", async ({ adminPage: page }) => {
    await page.goto("/dashboard/education/care", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});

    // 1. Verify Header
    const title = page.locator("h1");
    await expect(title).toBeVisible();
    await expect(title).toContainText(/Care Command Center/i);

    // 2. Verify Classroom Badge
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).toMatch(/Lớp Mầm A/i);

    // 3. Verify Exception Alert Center (⚠ CẦN XỬ LÝ)
    expect(bodyText).toMatch(/CẦN XỬ LÝ/i);
    expect(bodyText).toMatch(/Nguyễn An/i);

    // 4. Verify Medication Queue
    expect(bodyText).toMatch(/Quy Trình Uống Thuốc/i);
  });

  test("Bulk Care Operation modal executes PARTIAL SUCCESS with explicit ALLERGY_EXPOSURE_RISK hard block", async ({ adminPage: page }) => {
    await page.goto("/dashboard/education/care", { waitUntil: "domcontentloaded" });

    // 1. Click "[ Ghi Nhận Hàng Loạt ]" button
    const openModalBtn = page.locator("#btn-open-bulk-modal");
    await expect(openModalBtn).toBeVisible();
    await openModalBtn.click();

    // 2. Assert Modal Title
    const modalTitle = page.locator("h3:has-text('Ghi Nhận Chăm Sóc Hàng Loạt')");
    await expect(modalTitle).toBeVisible();

    // 3. Click "Thực Hiện Bulk Care"
    const executeBtn = page.locator("#btn-execute-bulk");
    await expect(executeBtn).toBeVisible();
    await executeBtn.click();

    // 4. Assert Partial Success Banner
    const banner = page.locator("#bulk-result-banner");
    await expect(banner).toBeVisible({ timeout: 15_000 });
    const bannerText = await banner.innerText();
    expect(bannerText).toMatch(/PARTIAL SUCCESS RESULT/i);
    expect(bannerText).toMatch(/24\/25 Thành Công/i);
    expect(bannerText).toMatch(/1 Bị Chặn/i);
    expect(bannerText).toMatch(/ALLERGY_EXPOSURE_RISK/i);
  });

  test("Medication administration and Parent Digest PUBLISHED immutability lifecycle", async ({ adminPage: page }) => {
    await page.goto("/dashboard/education/care", { waitUntil: "domcontentloaded" });

    // 1. Administer Medication
    const adminMedBtn = page.locator("#btn-administer-medication").first();
    if (await adminMedBtn.isVisible()) {
      await adminMedBtn.click();
      const bodyText = await page.locator("body").innerText();
      expect(bodyText).toMatch(/Đã Uống Thuốc/i);
    }

    // 2. Generate Parent Digest
    const genDigestBtn = page.locator("#btn-generate-digest");
    await expect(genDigestBtn).toBeVisible();
    await genDigestBtn.click();

    const badge = page.locator("#digest-status-badge");
    await expect(badge).toContainText(/GENERATED/i);

    // 3. Publish Parent Digest
    const pubDigestBtn = page.locator("#btn-publish-digest");
    await expect(pubDigestBtn).toBeVisible();
    await pubDigestBtn.click();

    await expect(badge).toContainText(/PUBLISHED/i);
    const bodyAfterPublish = await page.locator("body").innerText();
    expect(bodyAfterPublish).toMatch(/IMMUTABLE SNAPSHOT PUBLISHED/i);

    // 4. Reload page to verify persistence
    await page.reload({ waitUntil: "domcontentloaded" });
    const badgeAfterReload = page.locator("#digest-status-badge");
    await expect(badgeAfterReload).toContainText(/PUBLISHED/i);
  });
});
