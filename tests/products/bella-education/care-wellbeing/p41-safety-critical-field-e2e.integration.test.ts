import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { MedicationSafetyService } from "@/products/bella-education/care-wellbeing/medication/medication-safety.service";
import { AllergySafetyService } from "@/products/bella-education/care-wellbeing/health-profile/allergy-safety.service";
import { IncidentSafetyService } from "@/products/bella-education/care-wellbeing/incidents/incident-safety.service";

describe("P4.1 Safety Critical Domains - Adversarial Gates", () => {
  let supabase: SupabaseClient;
  let medicationService: MedicationSafetyService;
  let allergyService: AllergySafetyService;
  let incidentService: IncidentSafetyService;

  // Test Entities
  let tenantId: string;
  let parentId: string;
  let teacherId: string;
  let studentId: string;

  beforeAll(async () => {
    require("dotenv").config({ path: ".env.test" });
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase credentials in .env.test");
    }

    supabase = createClient(supabaseUrl, supabaseKey);
    medicationService = new MedicationSafetyService(supabase);
    allergyService = new AllergySafetyService(supabase);
    incidentService = new IncidentSafetyService(supabase);

    // Seed test identities
    const { data: tenant } = await supabase.from("tenants").insert({ name: "P41 Test Tenant" }).select("id").single();
    tenantId = tenant!.id;

    const { data: parent, error: parentErr } = await supabase
      .from("persons")
      .insert({ 
        tenant_id: tenantId, 
        first_name: "Test", 
        last_name: "Parent",
        date_of_birth: "1980-01-01",
        gender: "male"
      })
      .select("id")
      .single();
    if (parentErr) console.error("PARENT INSERT ERR:", parentErr);
    parentId = parent!.id;

    const { data: teacher, error: teacherErr } = await supabase
      .from("persons")
      .insert({ 
        tenant_id: tenantId, 
        first_name: "Test", 
        last_name: "Teacher",
        date_of_birth: "1990-01-01",
        gender: "female"
      })
      .select("id")
      .single();
    if (teacherErr) console.error("TEACHER INSERT ERR:", teacherErr);
    teacherId = teacher!.id;

    const { data: student, error: studentErr } = await supabase
      .from("students")
      .insert({ 
        tenant_id: tenantId, 
        person_id: parentId, 
        student_code: "TEST-001", 
        academic_status: "enrolled", 
        enrollment_type: "full_time", 
        program_id: "PRESCHOOL",
        enrollment_date: new Date().toISOString()
      })
      .select("student_id")
      .single();
    if (studentErr) console.error("STUDENT INSERT ERR:", studentErr);
    studentId = student!.student_id;
  });

  afterAll(async () => {
    // Cleanup tenant and all cascaded data
    await supabase.from("tenants").delete().eq("id", tenantId);
  });

  describe("G1: Medication Anti-Double-Dose Invariant", () => {
    it("should prevent concurrent double dosing of the same scheduled occurrence", async () => {
      // 1. Setup Auth
      const { data: auth } = await supabase
        .from("edu_medication_authorizations")
        .insert({
          tenant_id: tenantId,
          student_id: studentId,
          medication_name: "Tylenol",
          authorized_dose: "5ml",
          authorized_by_guardian_id: parentId,
          authorized_at: new Date().toISOString(),
          valid_from: new Date(Date.now() - 86400000).toISOString(), // Yesterday
          valid_until: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        })
        .select("id")
        .single();

      // 2. Setup Occurrence
      const { data: occ } = await supabase
        .from("edu_medication_dose_occurrences")
        .insert({
          tenant_id: tenantId,
          authorization_id: auth!.id,
          scheduled_for: new Date().toISOString(),
          window_start: new Date(Date.now() - 3600000).toISOString(), // -1 hr
          window_end: new Date(Date.now() + 3600000).toISOString(), // +1 hr
        })
        .select("id")
        .single();

      // 3. Race condition simulation: two teachers trying to administer same dose at same time
      const command = {
        tenantId,
        studentId,
        doseOccurrenceId: occ!.id,
        administeredAt: new Date(),
        doseGiven: "5ml",
        actorId: teacherId,
      };

      const p1 = medicationService.administerDose(command);
      const p2 = medicationService.administerDose(command);

      const results = await Promise.allSettled([p1, p2]);

      const successes = results.filter((r) => r.status === "fulfilled");
      const failures = results.filter((r) => r.status === "rejected");

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(1);

      const failure = failures[0] as PromiseRejectedResult;
      expect(failure.reason.message).toContain("MEDICATION_DOUBLE_DOSE_ERROR");
    });

    it("should reject administration if authorization is expired or revoked", async () => {
      // Setup expired Auth
      const { data: expiredAuth } = await supabase
        .from("edu_medication_authorizations")
        .insert({
          tenant_id: tenantId,
          student_id: studentId,
          medication_name: "Amoxicillin",
          authorized_dose: "2.5ml",
          authorized_by_guardian_id: parentId,
          authorized_at: new Date(Date.now() - 10000000).toISOString(),
          valid_from: new Date(Date.now() - 10000000).toISOString(),
          valid_until: new Date(Date.now() - 100000).toISOString(), // Expired
        })
        .select("id")
        .single();

      const { data: expiredOcc } = await supabase
        .from("edu_medication_dose_occurrences")
        .insert({
          tenant_id: tenantId,
          authorization_id: expiredAuth!.id,
          scheduled_for: new Date().toISOString(),
          window_start: new Date(Date.now() - 3600000).toISOString(),
          window_end: new Date(Date.now() + 3600000).toISOString(),
        })
        .select("id")
        .single();

      await expect(
        medicationService.administerDose({
          tenantId,
          studentId,
          doseOccurrenceId: expiredOcc!.id,
          administeredAt: new Date(),
          doseGiven: "2.5ml",
          actorId: teacherId,
        })
      ).rejects.toThrow(/MEDICATION_AUTH_EXPIRED_ERROR/);
    });

    it("should reject administration if tenantId or studentId mismatches", async () => {
      const wrongTenantId = "00000000-0000-0000-0000-000000000999";
      await expect(
        medicationService.administerDose({
          tenantId: wrongTenantId,
          studentId,
          doseOccurrenceId: "00000000-0000-0000-0000-000000000111",
          administeredAt: new Date(),
          doseGiven: "5ml",
          actorId: teacherId,
        })
      ).rejects.toThrow(/MEDICATION_DOSE_NOT_FOUND/);
    });
  });

  describe("G2: Allergy Exposure Rule (HARD BLOCK)", () => {
    it("should block meal assignment if meal contains an allergen the student is allergic to", async () => {
      // 1. Setup Allergen & Ingredient
      const { data: allergen, error: allergenErr } = await supabase
        .from("edu_allergens")
        .insert({ tenant_id: tenantId, name: "Peanuts" })
        .select("id")
        .single();
      if (allergenErr) console.error("ALLERGEN ERR", allergenErr);

      const { data: ingredient, error: ingredientErr } = await supabase
        .from("edu_food_ingredients")
        .insert({ tenant_id: tenantId, name: "Peanut Butter" })
        .select("id")
        .single();
      if (ingredientErr) console.error("INGREDIENT ERR", ingredientErr);

      await supabase.from("edu_ingredient_allergens").insert({
        tenant_id: tenantId,
        ingredient_id: ingredient!.id,
        allergen_id: allergen!.id,
      });

      // 2. Setup Child Allergy
      await supabase.from("edu_child_allergies").insert({
        tenant_id: tenantId,
        student_id: studentId,
        allergen_id: allergen!.id,
        severity: "SEVERE",
      });

      // 3. Setup Meal
      const { data: meal } = await supabase
        .from("edu_meal_items")
        .insert({ tenant_id: tenantId, name: "PB&J Sandwich" })
        .select("id")
        .single();

      await supabase.from("edu_meal_item_ingredients").insert({
        tenant_id: tenantId,
        meal_item_id: meal!.id,
        ingredient_id: ingredient!.id,
      });

      // 4. Test Safety
      await expect(
        allergyService.checkMealSafety({
          tenantId,
          studentId,
          mealItemId: meal!.id,
        })
      ).rejects.toThrow(/ALLERGY_EXPOSURE_RISK.*Peanuts/);
    });

    it("should allow meal if no active allergies conflict", async () => {
      // Create a safe meal
      const { data: meal } = await supabase
        .from("edu_meal_items")
        .insert({ tenant_id: tenantId, name: "Apple Slices" })
        .select("id")
        .single();

      const result = await allergyService.checkMealSafety({
        tenantId,
        studentId,
        mealItemId: meal!.id,
      });

      expect(result.isSafe).toBe(true);
    });
  });

  describe("G3: Health Incident Escalation Invariant", () => {
    it("should require escalation acknowledgement for CRITICAL incidents before closure", async () => {
      // 1. Report CRITICAL incident
      const reportRes = await incidentService.reportIncident({
        tenantId,
        studentId,
        incidentTime: new Date(),
        incidentType: "Fever > 39C",
        severity: "CRITICAL",
        description: "Child has high fever.",
        actionTaken: "Administered fever reducer, called parents",
        actorId: teacherId,
      });

      expect(reportRes.escalationRequired).toBe(true);

      // 2. Attempt to close without acknowledgement (Should Fail)
      await expect(
        incidentService.closeIncident({
          tenantId,
          incidentId: reportRes.incidentId,
        })
      ).rejects.toThrow(/INCIDENT_CLOSURE_VIOLATION/);

      // 3. Close with acknowledgement (Should Succeed)
      await incidentService.closeIncident({
        tenantId,
        incidentId: reportRes.incidentId,
        acknowledgedAt: new Date(),
        escalationNotes: "Parent picked up child",
      });

      const { data: incident } = await supabase
        .from("edu_health_incidents")
        .select("status")
        .eq("id", reportRes.incidentId)
        .single();

      expect(incident?.status).toBe("CLOSED");
    });
  });
});
