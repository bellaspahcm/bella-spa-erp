import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { DailyCareService } from "@/products/bella-education/care-wellbeing/daily-care/daily-care.service";

describe("P4.2 Daily Care Operations - Classroom Bulk Workflow & Partial Success", () => {
  let supabase: SupabaseClient;
  let dailyCareService: DailyCareService;

  let tenantId: string;
  let classId: string;
  let parentId: string;
  let studentSafe1: string;
  let studentSafe2: string;
  let studentAllergic: string;
  let peanutMealId: string;
  const testDate = "2026-09-09";

  beforeAll(async () => {
    require("dotenv").config({ path: ".env.test" });
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase credentials in .env.test");
    }

    supabase = createClient(supabaseUrl, supabaseKey);
    dailyCareService = new DailyCareService(supabase);

    // 1. Seed Tenant
    const { data: tenant } = await supabase.from("tenants").insert({ name: "P42 Bulk Test Tenant" }).select("id").single();
    tenantId = tenant!.id;
    classId = "00000000-0000-0000-0000-000000000420";

    // 2. Seed Guardian
    const { data: parent } = await supabase
      .from("persons")
      .insert({
        tenant_id: tenantId,
        first_name: "Parent",
        last_name: "P42",
        date_of_birth: "1985-05-05",
        gender: "female",
      })
      .select("id")
      .single();
    parentId = parent!.id;

    // 2a. Create Party for parent (R4: Required for party_id FK)
    const { data: parentParty, error: partyError } = await supabase
      .from("party_parties")
      .insert({
        tenant_id: tenantId,
        party_type: 'person',
        display_name: 'Parent P42',
      })
      .select("id")
      .single();
    
    if (partyError) {
      console.error('Failed to create parent Party:', partyError);
      throw partyError;
    }
    
    const parentPartyId = parentParty!.id;

    // 3. Seed 3 Students using Party semantics
    const createStudent = async (code: string) => {
      const { data: s, error: studentError } = await supabase
        .from("students")
        .insert({
          tenant_id: tenantId,
          party_id: parentPartyId,   // R4: Use Party FK
          person_id: parentId,       // LEGACY FK (still required until R5)
          student_code: code,
          academic_status: "enrolled",
          enrollment_type: "full_time",
          program_id: "PRESCHOOL",
          enrollment_date: new Date().toISOString(),
        })
        .select("student_id")
        .single();
      
      if (studentError) {
        console.error(`Failed to create student ${code}:`, studentError);
        throw studentError;
      }
      
      return s!.student_id;
    };

    studentSafe1 = await createStudent("P42-S1");
    studentSafe2 = await createStudent("P42-S2");
    studentAllergic = await createStudent("P42-S3");

    // 4. Seed Peanut Allergen, Ingredient & Binding for studentAllergic
    const { data: allergen } = await supabase
      .from("edu_allergens")
      .insert({ tenant_id: tenantId, name: "Peanuts" })
      .select("id")
      .single();

    const { data: ingredient } = await supabase
      .from("edu_food_ingredients")
      .insert({ tenant_id: tenantId, name: "Peanut Sauce" })
      .select("id")
      .single();

    await supabase.from("edu_ingredient_allergens").insert({
      tenant_id: tenantId,
      ingredient_id: ingredient!.id,
      allergen_id: allergen!.id,
    });

    // Allergy binding for studentAllergic
    await supabase.from("edu_child_allergies").insert({
      tenant_id: tenantId,
      student_id: studentAllergic,
      allergen_id: allergen!.id,
      severity: "SEVERE",
    });

    // 5. Seed Peanut Meal Item
    const { data: meal } = await supabase
      .from("edu_meal_items")
      .insert({ tenant_id: tenantId, name: "Satay Noodles" })
      .select("id")
      .single();
    peanutMealId = meal!.id;

    await supabase.from("edu_meal_item_ingredients").insert({
      tenant_id: tenantId,
      meal_item_id: peanutMealId,
      ingredient_id: ingredient!.id,
    });
  });

  afterAll(async () => {
    await supabase.from("tenants").delete().eq("id", tenantId);
  });

  it("should record bulk arrival for the classroom", async () => {
    const res = await dailyCareService.recordBulkArrival({
      tenantId,
      classId,
      date: testDate,
      arrivals: [
        { studentId: studentSafe1, status: "PRESENT", condition: "GOOD" },
        { studentId: studentSafe2, status: "PRESENT", condition: "GOOD" },
        { studentId: studentAllergic, status: "PRESENT", condition: "SLIGHT_COUGH" },
      ],
    });

    expect(res.requested).toBe(3);
    expect(res.committed).toBe(3);
    expect(res.blocked).toBe(0);
    expect(res.successfulStudentIds).toHaveLength(3);
  });

  it("should execute PARTIAL SUCCESS when recording bulk meal containing an allergen", async () => {
    const res = await dailyCareService.recordBulkMeals({
      tenantId,
      classId,
      date: testDate,
      mealItemId: peanutMealId,
      mealType: "LUNCH",
      students: [
        { studentId: studentSafe1, portion: "ALL" },
        { studentId: studentAllergic, portion: "ALL" }, // Allergic child
        { studentId: studentSafe2, portion: "HALF" },
      ],
    });

    // VERIFY PARTIAL SUCCESS SEMANTICS
    expect(res.requested).toBe(3);
    expect(res.committed).toBe(2);
    expect(res.blocked).toBe(1);
    expect(res.successfulStudentIds).toEqual([studentSafe1, studentSafe2]);
    
    // EXCEPTION DETAILS
    expect(res.exceptions).toHaveLength(1);
    expect(res.exceptions[0].studentId).toBe(studentAllergic);
    expect(res.exceptions[0].errorCode).toBe("ALLERGY_EXPOSURE_RISK");
    expect(res.exceptions[0].requiresAction).toBe(true);
    expect(res.exceptions[0].errorMessage).toContain("Peanuts");
  });

  it("should record bulk hygiene and nap tracking", async () => {
    const hygieneRes = await dailyCareService.recordBulkHygiene({
      tenantId,
      classId,
      date: testDate,
      hygieneEntries: [
        { studentId: studentSafe1, type: "TOILET" },
        { studentId: studentSafe2, type: "DIAPER", notes: "Wet diaper changed" },
      ],
    });
    expect(hygieneRes.committed).toBe(2);

    const napRes = await dailyCareService.recordBulkNap({
      tenantId,
      classId,
      date: testDate,
      napEntries: [
        { studentId: studentSafe1, quality: "DEEP" },
        { studentId: studentSafe2, quality: "RESTLESS" },
      ],
    });
    expect(napRes.committed).toBe(2);
  });

  it("should generate and publish parent digest with immutability lifecycle", async () => {
    // 1. Generate Draft/Generated Digest
    const digest = await dailyCareService.generateParentDigest(tenantId, classId, studentSafe1, testDate);
    expect(digest.status).toBe("GENERATED");
    expect(digest.payload.arrivalStatus).toBe("PRESENT");
    expect(digest.payload.meals).toHaveLength(1);

    // 2. Publish Digest
    const published = await dailyCareService.publishParentDigest(tenantId, digest.digestId);
    expect(published.status).toBe("PUBLISHED");
    expect(published.publishedAt).toBeDefined();

    // 3. Attempting to regenerate a PUBLISHED digest must be HARD BLOCKED
    await expect(
      dailyCareService.generateParentDigest(tenantId, classId, studentSafe1, testDate)
    ).rejects.toThrow(/DIGEST_IMMUTABLE_ERROR/);
  });
});
