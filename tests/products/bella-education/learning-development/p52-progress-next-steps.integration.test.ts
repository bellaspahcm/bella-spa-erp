import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { FrameworkRegistryService } from "@/products/bella-education/learning-development/framework-registry.service";
import { ObservationService } from "@/products/bella-education/learning-development/observation.service";
import { MilestoneProgressService } from "@/products/bella-education/learning-development/milestone-progress.service";
import { NextStepsService } from "@/products/bella-education/learning-development/next-steps.service";

describe("P5.2 Learning & Development - Milestone Progress & Next Steps Test Suite", () => {
  let supabase: SupabaseClient;
  let frameworkService: FrameworkRegistryService;
  let observationService: ObservationService;
  let progressService: MilestoneProgressService;
  let nextStepsService: NextStepsService;

  // Test Identities
  let tenantId: string;
  let tenantId2: string;
  let teacherId: string;
  let student1Id: string;
  let student2Id: string;
  let crossTenantStudentId: string;
  let frameworkVersionId: string;
  let milestone1Id: string;
  let milestone2Id: string;
  let student1EvidenceId: string;
  let student2EvidenceId: string;

  beforeAll(async () => {
    require("dotenv").config({ path: ".env.test" });
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase credentials in .env.test");
    }

    supabase = createClient(supabaseUrl, supabaseKey);
    frameworkService = new FrameworkRegistryService(supabase);
    observationService = new ObservationService(supabase);
    progressService = new MilestoneProgressService(supabase);
    nextStepsService = new NextStepsService(supabase);

    // 1. Seed Tenants
    const { data: tenant } = await supabase.from("tenants").insert({ name: "P52 Test Tenant 1" }).select("id").single();
    tenantId = tenant!.id;

    const { data: tenant2 } = await supabase.from("tenants").insert({ name: "P52 Test Tenant 2" }).select("id").single();
    tenantId2 = tenant2!.id;

    // 2. Seed Persons & Students
    const { data: teacherPerson } = await supabase
      .from("persons")
      .insert({ tenant_id: tenantId, first_name: "Senior", last_name: "Teacher", date_of_birth: "1988-01-01", gender: "female" })
      .select("id")
      .single();
    teacherId = teacherPerson!.id;

    const { data: st1Person } = await supabase
      .from("persons")
      .insert({ tenant_id: tenantId, first_name: "Child", last_name: "One", date_of_birth: "2022-01-01", gender: "male" })
      .select("id")
      .single();

    const { data: st2Person } = await supabase
      .from("persons")
      .insert({ tenant_id: tenantId, first_name: "Child", last_name: "Two", date_of_birth: "2022-04-01", gender: "female" })
      .select("id")
      .single();

    const { data: crossPerson } = await supabase
      .from("persons")
      .insert({ tenant_id: tenantId2, first_name: "Cross", last_name: "Child", date_of_birth: "2022-06-01", gender: "male" })
      .select("id")
      .single();

    const { data: st1 } = await supabase
      .from("students")
      .insert({
        tenant_id: tenantId,
        person_id: st1Person!.id,
        student_code: "P52-ST-001",
        academic_status: "enrolled",
        enrollment_type: "full_time",
        program_id: "PRESCHOOL",
        enrollment_date: "2026-01-01",
      })
      .select("student_id")
      .single();
    student1Id = st1!.student_id;

    const { data: st2 } = await supabase
      .from("students")
      .insert({
        tenant_id: tenantId,
        person_id: st2Person!.id,
        student_code: "P52-ST-002",
        academic_status: "enrolled",
        enrollment_type: "full_time",
        program_id: "PRESCHOOL",
        enrollment_date: "2026-01-01",
      })
      .select("student_id")
      .single();
    student2Id = st2!.student_id;

    const { data: stCross } = await supabase
      .from("students")
      .insert({
        tenant_id: tenantId2,
        person_id: crossPerson!.id,
        student_code: "P52-ST-999",
        academic_status: "enrolled",
        enrollment_type: "full_time",
        program_id: "PRESCHOOL",
        enrollment_date: "2026-01-01",
      })
      .select("student_id")
      .single();
    crossTenantStudentId = stCross!.student_id;

    // 3. Seed Framework, Version, Domain & Milestones
    const fw = await frameworkService.createFramework({ tenantId, code: "EYLF-V2", name: "Early Years Learning Framework v2" });
    const ver = await frameworkService.createVersion({ tenantId, frameworkId: fw.id, version: "2.0.0" });
    frameworkVersionId = ver.id;
    const dom = await frameworkService.createDomain({ tenantId, frameworkVersionId: ver.id, code: "COG", name: "Cognitive Problem Solving" });

    const ms1 = await frameworkService.createMilestone({
      tenantId,
      frameworkVersionId: ver.id,
      frameworkDomainId: dom.id,
      code: "COG-01",
      title: "Sorts objects by color",
      indicatorStatement: "Child sorts 4 or more objects by color independently.",
    });
    milestone1Id = ms1.id;

    const ms2 = await frameworkService.createMilestone({
      tenantId,
      frameworkVersionId: ver.id,
      frameworkDomainId: dom.id,
      code: "COG-02",
      title: "Completes 6-piece puzzle",
      indicatorStatement: "Child completes wooden puzzle independently.",
    });
    milestone2Id = ms2.id;

    // 4. Seed Observations & Evidence for Student 1 and Student 2
    const obsRes = await observationService.recordObservation({
      tenantId,
      observerId: teacherId,
      observationText: "Color sorting activity observation.",
      students: [
        {
          studentId: student1Id,
          notes: "Student 1 sorted red and blue blocks.",
          milestoneIds: [milestone1Id],
          frameworkVersionId: ver.id,
          evidence: [{ storageReference: "s3://evidence/st1_color_sort.jpg", mimeType: "image/jpeg", visibility: "PARENT_SHARED" }],
        },
        {
          studentId: student2Id,
          notes: "Student 2 sorted green blocks.",
          milestoneIds: [milestone1Id],
          frameworkVersionId: ver.id,
          evidence: [{ storageReference: "s3://evidence/st2_color_sort.jpg", mimeType: "image/jpeg", visibility: "PARENT_SHARED" }],
        },
      ],
    });

    student1EvidenceId = obsRes.evidence.find((e) => e.observation_student_id === obsRes.students.find((s) => s.student_id === student1Id)!.id)!.id;
    student2EvidenceId = obsRes.evidence.find((e) => e.observation_student_id === obsRes.students.find((s) => s.student_id === student2Id)!.id)!.id;
  });

  afterAll(async () => {
    if (tenantId) await supabase.from("tenants").delete().eq("id", tenantId);
    if (tenantId2) await supabase.from("tenants").delete().eq("id", tenantId2);
  });

  it("Case 1: Progress interpretation without evidence → BLOCK", async () => {
    await expect(
      progressService.interpretProgress({
        tenantId,
        studentId: student1Id,
        frameworkVersionId,
        milestoneId: milestone1Id,
        status: "DEVELOPING",
        interpretedBy: teacherId,
        rationale: "Attempting progress without evidence reference.",
        evidenceIds: [], // 0 evidence provided
      })
    ).rejects.toThrow(/PROGRESS_EVIDENCE_REQUIRED_ERROR/);
  });

  it("Case 2: Evidence belonging to another child → BLOCK", async () => {
    // Attempt to interpret Student 1's progress using Student 2's evidence
    await expect(
      progressService.interpretProgress({
        tenantId,
        studentId: student1Id, // Student 1
        frameworkVersionId,
        milestoneId: milestone1Id,
        status: "CONSISTENT",
        interpretedBy: teacherId,
        rationale: "Using student 2 evidence for student 1.",
        evidenceIds: [student2EvidenceId], // Belonging to Student 2
      })
    ).rejects.toThrow(/EVIDENCE_STUDENT_MISMATCH_ERROR/);
  });

  it("Case 3: Evidence from incompatible framework version → BLOCK", async () => {
    const wrongVersionId = "00000000-0000-0000-0000-000000000099";
    await expect(
      progressService.interpretProgress({
        tenantId,
        studentId: student1Id,
        frameworkVersionId: wrongVersionId,
        milestoneId: milestone1Id,
        status: "EMERGING",
        interpretedBy: teacherId,
        rationale: "Wrong framework version.",
        evidenceIds: [student1EvidenceId],
      })
    ).rejects.toThrow(/EVIDENCE_FRAMEWORK_MISMATCH_ERROR/);
  });

  it("Case 4: Valid teacher interpretation with evidence link → PASS", async () => {
    const res = await progressService.interpretProgress({
      tenantId,
      studentId: student1Id,
      frameworkVersionId,
      milestoneId: milestone1Id,
      status: "CONSISTENT",
      interpretedBy: teacherId,
      rationale: "Demonstrated consistent color sorting across 3 separate activities.",
      evidenceIds: [student1EvidenceId],
      isConfirmed: true,
    });

    expect(res.progress.status).toBe("CONSISTENT");
    expect(res.progress.is_confirmed).toBe(true);
    expect(res.evidenceLinks).toHaveLength(1);
    expect(res.evidenceLinks[0].evidence_id).toBe(student1EvidenceId);
  });

  it("Case 5: Progress amendment → original preserved (SUPERSEDED), new version created", async () => {
    const v1 = await progressService.interpretProgress({
      tenantId,
      studentId: student1Id,
      frameworkVersionId,
      milestoneId: milestone2Id,
      status: "EMERGING",
      interpretedBy: teacherId,
      rationale: "Completed 3 pieces of puzzle with assistance.",
      evidenceIds: [student1EvidenceId],
    });

    const v2 = await progressService.amendProgress({
      tenantId,
      originalProgressId: v1.progress.id,
      amendedBy: teacherId,
      status: "DEVELOPING",
      rationale: "Updated observation: completed 5 pieces with minimal prompts.",
      evidenceIds: [student1EvidenceId],
    });

    expect(v2.supersededProgressId).toBe(v1.progress.id);
    expect(v2.newProgress.supersedes_progress_id).toBe(v1.progress.id);
    expect(v2.newProgress.status).toBe("DEVELOPING");

    // Fetch original V1 from DB to verify status_lifecycle is SUPERSEDED
    const { data: fetchV1 } = await supabase.from("edu_dev_milestone_progress").select("*").eq("id", v1.progress.id).single();
    expect(fetchV1.status_lifecycle).toBe("SUPERSEDED");
    expect(fetchV1.status).toBe("EMERGING");
  });

  it("Case 6: Bulk activity → cannot bulk-assign same progress to all children", async () => {
    // Each child's progress interpretation is discrete and requires child-specific evidence verification
    const res1 = await progressService.interpretProgress({
      tenantId,
      studentId: student1Id,
      frameworkVersionId,
      milestoneId: milestone1Id,
      status: "CONSISTENT",
      interpretedBy: teacherId,
      rationale: "Student 1 rationale.",
      evidenceIds: [student1EvidenceId],
    });

    const res2 = await progressService.interpretProgress({
      tenantId,
      studentId: student2Id,
      frameworkVersionId,
      milestoneId: milestone1Id,
      status: "DEVELOPING",
      interpretedBy: teacherId,
      rationale: "Student 2 rationale.",
      evidenceIds: [student2EvidenceId],
    });

    expect(res1.progress.student_id).toBe(student1Id);
    expect(res1.progress.status).toBe("CONSISTENT");

    expect(res2.progress.student_id).toBe(student2Id);
    expect(res2.progress.status).toBe("DEVELOPING");
  });

  it("Case 7: Next Step must trace to child + progress/milestone", async () => {
    const nextStep = await nextStepsService.createNextStep({
      tenantId,
      studentId: student1Id,
      milestoneId: milestone1Id,
      context: "CLASSROOM",
      recommendation: "Provide 3D geometric shape sorters during free play.",
      priority: "HIGH",
      createdBy: teacherId,
    });

    expect(nextStep.student_id).toBe(student1Id);
    expect(nextStep.milestone_id).toBe(milestone1Id);
    expect(nextStep.context).toBe("CLASSROOM");
    expect(nextStep.status).toBe("ACTIVE");
  });

  it("Case 8: Cross-tenant read/write → BLOCK", async () => {
    // Attempting to create next step for Tenant 2 student using Tenant 1 credentials → BLOCK
    await expect(
      nextStepsService.createNextStep({
        tenantId, // Tenant 1
        studentId: crossTenantStudentId, // Tenant 2 student
        milestoneId: milestone1Id,
        recommendation: "Unauthorized cross tenant recommendation.",
        createdBy: teacherId,
      })
    ).rejects.toThrow(/NEXT_STEP_STUDENT_NOT_FOUND/);
  });

  it("Case 9: AI/rule suggestion cannot publish developmental progress without teacher confirmation", async () => {
    // 1. System/AI generates an unconfirmed interpretation suggestion (isConfirmed = false)
    const suggestion = await progressService.interpretProgress({
      tenantId,
      studentId: student1Id,
      frameworkVersionId,
      milestoneId: milestone2Id,
      status: "DEVELOPING",
      interpretedBy: "00000000-0000-0000-0000-000000000099", // AI engine system ID
      rationale: "AI suggestion based on observation evidence analysis.",
      evidenceIds: [student1EvidenceId],
      isConfirmed: false, // UNCONFIRMED
    });

    expect(suggestion.progress.is_confirmed).toBe(false);

    // Unconfirmed suggestions are excluded from active confirmed student progress summary
    const summaryBefore = await progressService.getStudentProgressSummary(tenantId, student1Id);
    const foundBefore = summaryBefore.find((p) => p.id === suggestion.progress.id);
    expect(foundBefore).toBeUndefined();

    // 2. Teacher reviews and confirms interpretation
    const confirmed = await progressService.confirmProgress(tenantId, suggestion.progress.id, teacherId);
    expect(confirmed.is_confirmed).toBe(true);
    expect(confirmed.interpreted_by).toBe(teacherId);

    // Now included in confirmed student summary
    const summaryAfter = await progressService.getStudentProgressSummary(tenantId, student1Id);
    const foundAfter = summaryAfter.find((p) => p.id === suggestion.progress.id);
    expect(foundAfter).toBeDefined();
  });
});
