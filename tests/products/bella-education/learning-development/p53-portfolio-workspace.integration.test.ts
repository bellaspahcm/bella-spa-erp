import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { FrameworkRegistryService } from "@/products/bella-education/learning-development/framework-registry.service";
import { ObservationService } from "@/products/bella-education/learning-development/observation.service";
import { MilestoneProgressService } from "@/products/bella-education/learning-development/milestone-progress.service";
import { NextStepsService } from "@/products/bella-education/learning-development/next-steps.service";
import { PortfolioService } from "@/products/bella-education/learning-development/portfolio.service";
import { LearningWorkspaceService } from "@/products/bella-education/learning-development/learning-workspace.service";

describe("P5.3 Learning & Development - Developmental Portfolio & Workspace Test Suite", () => {
  let supabase: SupabaseClient;
  let frameworkService: FrameworkRegistryService;
  let observationService: ObservationService;
  let progressService: MilestoneProgressService;
  let nextStepsService: NextStepsService;
  let portfolioService: PortfolioService;
  let workspaceService: LearningWorkspaceService;

  // Test Identities
  let tenantId: string;
  let tenantId2: string;
  let teacherId: string;
  let student1Id: string;
  let frameworkVersionId: string;
  let milestoneId: string;
  let observationId: string;
  let sharedEvidenceId: string;
  let internalEvidenceId: string;
  let optOutEvidenceId: string;
  let progressId: string;
  let nextStepId: string;
  let classId: string;

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
    portfolioService = new PortfolioService(supabase);
    workspaceService = new LearningWorkspaceService(supabase);

    // 1. Seed Tenant 1 & 2
    const { data: tenant } = await supabase.from("tenants").insert({ name: "P53 Test Tenant 1" }).select("id").single();
    tenantId = tenant!.id;

    const { data: tenant2 } = await supabase.from("tenants").insert({ name: "P53 Test Tenant 2" }).select("id").single();
    tenantId2 = tenant2!.id;

    classId = "00000000-0000-0000-0000-000000000001";

    // 2. Seed Teacher & Student
    const { data: teacherPerson } = await supabase
      .from("persons")
      .insert({ tenant_id: tenantId, first_name: "Master", last_name: "Teacher", date_of_birth: "1985-01-01", gender: "female" })
      .select("id")
      .single();
    teacherId = teacherPerson!.id;

    const { data: st1Person } = await supabase
      .from("persons")
      .insert({ tenant_id: tenantId, first_name: "Portfolio", last_name: "Student", date_of_birth: "2022-01-01", gender: "male" })
      .select("id")
      .single();

    const { data: st1 } = await supabase
      .from("students")
      .insert({
        tenant_id: tenantId,
        person_id: st1Person!.id,
        student_code: "P53-ST-001",
        academic_status: "enrolled",
        enrollment_type: "full_time",
        program_id: "PRESCHOOL",
        enrollment_date: "2026-01-01",
      })
      .select("student_id")
      .single();
    student1Id = st1!.student_id;

    // 3. Seed Framework, Version, Domain & Milestone
    const fw = await frameworkService.createFramework({ tenantId, code: "PORT-FW", name: "Portfolio Test Framework" });
    const ver = await frameworkService.createVersion({ tenantId, frameworkId: fw.id, version: "1.0.0" });
    frameworkVersionId = ver.id;
    const dom = await frameworkService.createDomain({ tenantId, frameworkVersionId: ver.id, code: "ART", name: "Creative Arts" });
    const ms = await frameworkService.createMilestone({
      tenantId,
      frameworkVersionId: ver.id,
      frameworkDomainId: dom.id,
      code: "ART-01",
      title: "Paints with primary colors",
      indicatorStatement: "Child paints using red, yellow, and blue paint.",
    });
    milestoneId = ms.id;

    // 4. Seed Observations & Evidence Items with various privacy/consent scopes
    const obsRes = await observationService.recordObservation({
      tenantId,
      observerId: teacherId,
      observationText: "Creative arts painting session.",
      students: [
        {
          studentId: student1Id,
          notes: "Painted colorful picture.",
          milestoneIds: [milestoneId],
          frameworkVersionId: ver.id,
          evidence: [
            { storageReference: "s3://photos/parent_shared_paint.jpg", mimeType: "image/jpeg", visibility: "PARENT_SHARED", consentScope: "CONSENT_VERIFIED" },
            { storageReference: "s3://photos/internal_notes.jpg", mimeType: "image/jpeg", visibility: "INTERNAL_TEACHER", consentScope: "CONSENT_VERIFIED" },
            { storageReference: "s3://photos/opt_out_photo.jpg", mimeType: "image/jpeg", visibility: "PARENT_SHARED", consentScope: "OPT_OUT" },
          ],
        },
      ],
    });

    observationId = obsRes.observation.id;
    const studentMembershipId = obsRes.students[0].id;
    const evList = obsRes.evidence.filter((e) => e.observation_student_id === studentMembershipId);

    sharedEvidenceId = evList.find((e) => e.visibility === "PARENT_SHARED" && e.consent_scope === "CONSENT_VERIFIED")!.id;
    internalEvidenceId = evList.find((e) => e.visibility === "INTERNAL_TEACHER")!.id;
    optOutEvidenceId = evList.find((e) => e.consent_scope === "OPT_OUT")!.id;

    // 5. Seed Milestone Progress & Next Step
    const progRes = await progressService.interpretProgress({
      tenantId,
      studentId: student1Id,
      frameworkVersionId,
      milestoneId,
      status: "CONSISTENT",
      interpretedBy: teacherId,
      rationale: "Consistently identifies and uses primary colors.",
      evidenceIds: [sharedEvidenceId],
    });
    progressId = progRes.progress.id;

    const ns = await nextStepsService.createNextStep({
      tenantId,
      studentId: student1Id,
      milestoneProgressId: progressId,
      milestoneId,
      context: "HOME",
      recommendation: "Explore secondary color mixing with finger paints at home.",
      priority: "MEDIUM",
      createdBy: teacherId,
    });
    nextStepId = ns.id;
  });

  afterAll(async () => {
    if (tenantId) await supabase.from("tenants").delete().eq("id", tenantId);
    if (tenantId2) await supabase.from("tenants").delete().eq("id", tenantId2);
  });

  it("Case 1: Compile portfolio version (DRAFT) with valid evidence & progress items → PASS", async () => {
    const res = await portfolioService.compilePortfolioVersion({
      tenantId,
      studentId: student1Id,
      periodLabel: "Term 1 2026",
      compiledBy: teacherId,
      items: [
        { itemType: "OBSERVATION", referenceId: observationId },
        { itemType: "EVIDENCE", referenceId: sharedEvidenceId },
        { itemType: "MILESTONE_PROGRESS", referenceId: progressId },
        { itemType: "NEXT_STEP", referenceId: nextStepId },
      ],
    });

    expect(res.version.version_number).toBe(1);
    expect(res.version.status).toBe("DRAFT");
    expect(res.items).toHaveLength(4);
  });

  it("Case 2: Attempt to compile portfolio version with INTERNAL_TEACHER evidence → BLOCK", async () => {
    await expect(
      portfolioService.compilePortfolioVersion({
        tenantId,
        studentId: student1Id,
        periodLabel: "Term 1 2026",
        compiledBy: teacherId,
        items: [{ itemType: "EVIDENCE", referenceId: internalEvidenceId }],
      })
    ).rejects.toThrow(/PORTFOLIO_PRIVACY_VIOLATION_ERROR/);
  });

  it("Case 3: Attempt to compile portfolio version with OPT_OUT / invalid consent evidence → BLOCK", async () => {
    await expect(
      portfolioService.compilePortfolioVersion({
        tenantId,
        studentId: student1Id,
        periodLabel: "Term 1 2026",
        compiledBy: teacherId,
        items: [{ itemType: "EVIDENCE", referenceId: optOutEvidenceId }],
      })
    ).rejects.toThrow(/PORTFOLIO_CONSENT_VIOLATION_ERROR/);
  });

  it("Case 4: Publish portfolio version → status becomes PUBLISHED & SHA-256 publication checksum generated", async () => {
    const res = await portfolioService.compilePortfolioVersion({
      tenantId,
      studentId: student1Id,
      periodLabel: "Term 1 2026",
      compiledBy: teacherId,
      items: [
        { itemType: "EVIDENCE", referenceId: sharedEvidenceId },
        { itemType: "MILESTONE_PROGRESS", referenceId: progressId },
      ],
    });

    const pub = await portfolioService.publishPortfolioVersion(tenantId, res.version.id, teacherId);

    expect(pub.portfolio_version_id).toBe(res.version.id);
    expect(pub.publication_checksum).toBeDefined();
    expect(pub.publication_checksum).toHaveLength(64); // SHA-256 length

    // Fetch updated version to verify status is PUBLISHED
    const { data: ver } = await supabase.from("edu_dev_portfolio_versions").select("status").eq("id", res.version.id).single();
    expect(ver.status).toBe("PUBLISHED");
  });

  it("Case 5: Attempt to mutate items of a PUBLISHED portfolio version → BLOCK (Immutable DB Lock Trigger)", async () => {
    // 1. Compile & publish a version
    const res = await portfolioService.compilePortfolioVersion({
      tenantId,
      studentId: student1Id,
      periodLabel: "Term 1 2026",
      compiledBy: teacherId,
      items: [{ itemType: "EVIDENCE", referenceId: sharedEvidenceId }],
    });
    await portfolioService.publishPortfolioVersion(tenantId, res.version.id, teacherId);

    // 2. Attempt direct DB insertion of new item into published version → SHOULD BLOCK BY DB TRIGGER
    const { error } = await supabase.from("edu_dev_portfolio_items").insert({
      tenant_id: tenantId,
      portfolio_version_id: res.version.id,
      item_type: "NEXT_STEP",
      reference_id: nextStepId,
    });

    expect(error).toBeDefined();
    expect(error?.message).toContain("PORTFOLIO_PUBLISHED_IMMUTABLE_ERROR");
  });

  it("Case 6: Editing a published portfolio requires compiling a NEW version (Version 2) → PASS", async () => {
    // Compile Version 2
    const v2Res = await portfolioService.compilePortfolioVersion({
      tenantId,
      studentId: student1Id,
      periodLabel: "Term 1 2026 - Amended",
      compiledBy: teacherId,
      items: [
        { itemType: "EVIDENCE", referenceId: sharedEvidenceId },
        { itemType: "MILESTONE_PROGRESS", referenceId: progressId },
        { itemType: "NEXT_STEP", referenceId: nextStepId },
      ],
    });

    expect(v2Res.version.version_number).toBeGreaterThan(1);
    expect(v2Res.version.status).toBe("DRAFT");
  });

  it("Case 7: Parent read projection strictly filters out INTERNAL_TEACHER content → ALLOW allowed items ONLY", async () => {
    // Compile & publish version with allowed items
    const res = await portfolioService.compilePortfolioVersion({
      tenantId,
      studentId: student1Id,
      periodLabel: "Spring 2026",
      compiledBy: teacherId,
      items: [
        { itemType: "OBSERVATION", referenceId: observationId },
        { itemType: "EVIDENCE", referenceId: sharedEvidenceId },
        { itemType: "MILESTONE_PROGRESS", referenceId: progressId },
      ],
    });
    await portfolioService.publishPortfolioVersion(tenantId, res.version.id, teacherId);

    const parentView = await portfolioService.getParentPortfolioProjection(tenantId, student1Id);

    expect(parentView.publishedVersion.id).toBe(res.version.id);
    expect(parentView.allowedItems.length).toBeGreaterThan(0);

    // Verify no INTERNAL_TEACHER content is present
    const hasInternalEvidence = parentView.allowedItems.some((item) => item.referenceId === internalEvidenceId);
    expect(hasInternalEvidence).toBe(false);
  });

  it("Case 8: Teacher Work Queue query returns accurate work items for teacher dashboard → PASS", async () => {
    const queue = await workspaceService.getTeacherWorkQueue(tenantId, classId);

    expect(queue.classId).toBe(classId);
    expect(queue.totalStudents).toBeGreaterThan(0);
    expect(queue.studentsWithoutObservationThisWeekCount).toBeDefined();
    expect(queue.unconfirmedProgressCount).toBeDefined();
    expect(queue.nextStepsDueCount).toBeDefined();
    expect(queue.portfoliosReadyForPublishCount).toBeDefined();
  });

  it("Case 9: Cross-tenant portfolio access → BLOCK", async () => {
    await expect(portfolioService.getParentPortfolioProjection(tenantId2, student1Id)).rejects.toThrow(/PORTFOLIO_NOT_FOUND/);
  });
});
