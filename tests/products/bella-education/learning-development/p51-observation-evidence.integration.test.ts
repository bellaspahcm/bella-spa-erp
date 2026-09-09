import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { FrameworkRegistryService } from "@/products/bella-education/learning-development/framework-registry.service";
import { ActivityService } from "@/products/bella-education/learning-development/activity.service";
import { ObservationService } from "@/products/bella-education/learning-development/observation.service";

describe("P5.1 Learning & Development - Truth & Evidence Foundation Test Suite", () => {
  let supabase: SupabaseClient;
  let frameworkService: FrameworkRegistryService;
  let activityService: ActivityService;
  let observationService: ObservationService;

  // Test Identities
  let tenantId: string;
  let tenantId2: string;
  let teacherId: string;
  let student1Id: string;
  let student2Id: string;
  let crossTenantStudentId: string;
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
    activityService = new ActivityService(supabase);
    observationService = new ObservationService(supabase);

    // 1. Seed Tenant 1 & Tenant 2
    const { data: tenant } = await supabase.from("tenants").insert({ name: "P51 Test Tenant 1" }).select("id").single();
    tenantId = tenant!.id;

    const { data: tenant2 } = await supabase.from("tenants").insert({ name: "P51 Test Tenant 2" }).select("id").single();
    tenantId2 = tenant2!.id;

    // 2. Seed Persons & Students
    const { data: teacherPerson } = await supabase
      .from("persons")
      .insert({ tenant_id: tenantId, first_name: "Lead", last_name: "Teacher", date_of_birth: "1990-01-01", gender: "female" })
      .select("id")
      .single();
    teacherId = teacherPerson!.id;

    const { data: student1Person } = await supabase
      .from("persons")
      .insert({ tenant_id: tenantId, first_name: "Child", last_name: "Alpha", date_of_birth: "2022-01-01", gender: "male" })
      .select("id")
      .single();

    const { data: student2Person } = await supabase
      .from("persons")
      .insert({ tenant_id: tenantId, first_name: "Child", last_name: "Beta", date_of_birth: "2022-03-15", gender: "female" })
      .select("id")
      .single();

    const { data: crossPerson } = await supabase
      .from("persons")
      .insert({ tenant_id: tenantId2, first_name: "Child", last_name: "OtherTenant", date_of_birth: "2022-05-20", gender: "male" })
      .select("id")
      .single();

    const { data: st1, error: st1Err } = await supabase
      .from("students")
      .insert({
        tenant_id: tenantId,
        person_id: student1Person!.id,
        student_code: "P51-ST-001",
        academic_status: "enrolled",
        enrollment_type: "full_time",
        program_id: "PRESCHOOL",
        enrollment_date: "2026-01-01",
      })
      .select("student_id")
      .single();
    if (st1Err) console.error("ST1 INSERT ERR:", st1Err);
    student1Id = st1!.student_id;

    const { data: st2, error: st2Err } = await supabase
      .from("students")
      .insert({
        tenant_id: tenantId,
        person_id: student2Person!.id,
        student_code: "P51-ST-002",
        academic_status: "enrolled",
        enrollment_type: "full_time",
        program_id: "PRESCHOOL",
        enrollment_date: "2026-01-01",
      })
      .select("student_id")
      .single();
    if (st2Err) console.error("ST2 INSERT ERR:", st2Err);
    student2Id = st2!.student_id;

    const { data: stCross, error: stCrossErr } = await supabase
      .from("students")
      .insert({
        tenant_id: tenantId2,
        person_id: crossPerson!.id,
        student_code: "P51-ST-999",
        academic_status: "enrolled",
        enrollment_type: "full_time",
        program_id: "PRESCHOOL",
        enrollment_date: "2026-01-01",
      })
      .select("student_id")
      .single();
    if (stCrossErr) console.error("CROSS INSERT ERR:", stCrossErr);
    crossTenantStudentId = stCross!.student_id;

    classId = "00000000-0000-0000-0000-000000000001";
  });

  afterAll(async () => {
    if (tenantId) {
      await supabase.from("tenants").delete().eq("id", tenantId);
    }
    if (tenantId2) {
      await supabase.from("tenants").delete().eq("id", tenantId2);
    }
  });

  it("Case 1: ACTIVE framework version mutation → BLOCK (Immutable DB Lock)", async () => {
    // 1. Create framework & version
    const fw = await frameworkService.createFramework({ tenantId, code: "EYLF", name: "Early Years Learning Framework" });
    const ver = await frameworkService.createVersion({ tenantId, frameworkId: fw.id, version: "1.0.0" });
    const dom = await frameworkService.createDomain({ tenantId, frameworkVersionId: ver.id, code: "SOC", name: "Social Communication" });

    await frameworkService.createMilestone({
      tenantId,
      frameworkVersionId: ver.id,
      frameworkDomainId: dom.id,
      minAgeMonths: 24,
      maxAgeMonths: 36,
      code: "SOC-01",
      title: "Shares toys with peers",
      indicatorStatement: "Child demonstrates willingness to share play items during activity.",
    });

    // 2. Activate version
    await frameworkService.activateVersion(tenantId, ver.id);

    // 3. Attempt to add another milestone to active version → SHOULD BLOCK
    await expect(
      frameworkService.createMilestone({
        tenantId,
        frameworkVersionId: ver.id,
        frameworkDomainId: dom.id,
        minAgeMonths: 24,
        maxAgeMonths: 36,
        code: "SOC-02",
        title: "Takes turns",
        indicatorStatement: "Child takes turns in group activity.",
      })
    ).rejects.toThrow(/FRAMEWORK_VERSION_LOCKED_ERROR/);
  });

  it("Case 2: Planned + spontaneous observation → PASS", async () => {
    const act = await activityService.createActivity({
      tenantId,
      classId,
      title: "Morning Block Building",
      description: "Building towers with wooden blocks",
    });

    // 1. Planned observation
    const plannedObs = await observationService.recordObservation({
      tenantId,
      activityId: act.id,
      observerId: teacherId,
      observationText: "Observed block stacking skills during planned morning activity.",
      students: [{ studentId: student1Id, notes: "Stacked 5 blocks independently." }],
    });
    expect(plannedObs.observation.activity_id).toBe(act.id);
    expect(plannedObs.observation.status).toBe("RECORDED");

    // 2. Spontaneous observation (activityId = null)
    const spontaneousObs = await observationService.recordObservation({
      tenantId,
      activityId: undefined,
      observerId: teacherId,
      observationText: "Spontaneous interaction during outdoor playground time.",
      students: [{ studentId: student2Id, notes: "Initiated tag game with peer." }],
    });
    expect(spontaneousObs.observation.activity_id).toBeNull();
    expect(spontaneousObs.observation.status).toBe("RECORDED");
  });

  it("Case 3: Shared activity + multiple children → child evidence/milestones remain isolated", async () => {
    const fw = await frameworkService.createFramework({ tenantId, code: "MONT", name: "Montessori Early Years" });
    const ver = await frameworkService.createVersion({ tenantId, frameworkId: fw.id, version: "1.0.0" });
    const dom = await frameworkService.createDomain({ tenantId, frameworkVersionId: ver.id, code: "MOT", name: "Motor Skills" });
    const msA = await frameworkService.createMilestone({
      tenantId,
      frameworkVersionId: ver.id,
      frameworkDomainId: dom.id,
      code: "MOT-01",
      title: "Fine motor pincher grip",
      indicatorStatement: "Holds pencil with 3-finger pincher grip.",
    });

    const act = await activityService.createActivity({
      tenantId,
      classId,
      title: "Group Drawing Exercise",
    });

    const obsRes = await observationService.recordObservation({
      tenantId,
      activityId: act.id,
      observerId: teacherId,
      observationText: "Group drawing observation.",
      students: [
        {
          studentId: student1Id,
          notes: "Child A used pincher grip.",
          milestoneIds: [msA.id],
          frameworkVersionId: ver.id,
          evidence: [{ storageReference: "s3://photos/child_a.jpg", mimeType: "image/jpeg", visibility: "INTERNAL_TEACHER" }],
        },
        {
          studentId: student2Id,
          notes: "Child B used fist grip.",
          evidence: [{ storageReference: "s3://photos/child_b.jpg", mimeType: "image/jpeg", visibility: "PARENT_SHARED" }],
        },
      ],
    });

    expect(obsRes.students).toHaveLength(2);
    expect(obsRes.milestones).toHaveLength(1);
    
    // Verify milestone belongs strictly to Child A's observation_student_id
    const childAMembership = obsRes.students.find((s) => s.student_id === student1Id);
    expect(obsRes.milestones[0].observation_student_id).toBe(childAMembership!.id);

    // Verify Child B evidence is attached to Child B's membership
    const childBMembership = obsRes.students.find((s) => s.student_id === student2Id);
    const childBEvidence = obsRes.evidence.find((e) => e.observation_student_id === childBMembership!.id);
    expect(childBEvidence?.storage_reference).toBe("s3://photos/child_b.jpg");
  });

  it("Case 4: Parent attempts INTERNAL_TEACHER evidence read → BLOCK", async () => {
    const obsRes = await observationService.recordObservation({
      tenantId,
      observerId: teacherId,
      observationText: "Internal teacher notes on child behavior.",
      students: [
        {
          studentId: student1Id,
          evidence: [{ storageReference: "s3://photos/internal_note.jpg", mimeType: "image/jpeg", visibility: "INTERNAL_TEACHER" }],
        },
      ],
    });

    const parentView = await observationService.getObservationEvidence(tenantId, obsRes.observation.id, "PARENT");
    expect(parentView).toHaveLength(0);

    const teacherView = await observationService.getObservationEvidence(tenantId, obsRes.observation.id, "TEACHER");
    expect(teacherView).toHaveLength(1);
  });

  it("Case 5: PARENT_SHARED evidence with valid access → ALLOW", async () => {
    const obsRes = await observationService.recordObservation({
      tenantId,
      observerId: teacherId,
      observationText: "Shared activity photo for parents.",
      students: [
        {
          studentId: student1Id,
          evidence: [{ storageReference: "s3://photos/shared_event.jpg", mimeType: "image/jpeg", visibility: "PARENT_SHARED" }],
        },
      ],
    });

    const parentView = await observationService.getObservationEvidence(tenantId, obsRes.observation.id, "PARENT");
    expect(parentView).toHaveLength(1);
    expect(parentView[0].storage_reference).toBe("s3://photos/shared_event.jpg");
  });

  it("Case 6: Observation amendment → original preserved (SUPERSEDED) + new version created (RECORDED)", async () => {
    const v1 = await observationService.recordObservation({
      tenantId,
      observerId: teacherId,
      observationText: "Original observation with typo in note.",
      students: [{ studentId: student1Id, notes: "Original note" }],
    });

    const v2 = await observationService.amendObservation(tenantId, v1.observation.id, {
      amendedBy: teacherId,
      amendmentReason: "Correcting typo in observation note",
      newObservationText: "Corrected observation text after review.",
      students: [{ studentId: student1Id, notes: "Corrected note" }],
    });

    expect(v2.supersededObservationId).toBe(v1.observation.id);
    expect(v2.newObservation.supersedes_observation_id).toBe(v1.observation.id);
    expect(v2.newObservation.status).toBe("RECORDED");

    // Fetch original V1 from DB to confirm it is preserved as SUPERSEDED
    const { data: fetchV1 } = await supabase.from("edu_dev_observations").select("*").eq("id", v1.observation.id).single();
    expect(fetchV1.status).toBe("SUPERSEDED");
    expect(fetchV1.observation_text).toBe("Original observation with typo in note.");
  });

  it("Case 7: Cross-tenant student/evidence access → BLOCK", async () => {
    // Tenant 1 teacher attempts to record observation for Tenant 2 student → Foreign Key or Tenant check fail
    await expect(
      observationService.recordObservation({
        tenantId,
        observerId: teacherId,
        observationText: "Malicious cross tenant observation attempt.",
        students: [{ studentId: crossTenantStudentId }],
      })
    ).rejects.toThrow();
  });

  it("Case 8: Milestone from wrong framework version → BLOCK", async () => {
    await expect(
      observationService.recordObservation({
        tenantId,
        observerId: teacherId,
        observationText: "Tagging unmatched milestone version.",
        students: [
          {
            studentId: student1Id,
            milestoneIds: ["00000000-0000-0000-0000-000000000099"],
            frameworkVersionId: "00000000-0000-0000-0000-000000000099",
          },
        ],
      })
    ).rejects.toThrow();
  });

  it("Case 9: Bulk observation cannot implicitly assign same milestone to every child → IMPOSSIBLE BY SCHEMA", async () => {
    // Verified by schema definition: edu_dev_observation_milestones requires explicit observation_student_id.
    // Untagged children in a bulk activity observation context will have zero entries in edu_dev_observation_milestones.
    const obsRes = await observationService.recordObservation({
      tenantId,
      observerId: teacherId,
      observationText: "Bulk group observation where only Student 1 performed the milestone.",
      students: [
        { studentId: student1Id, notes: "Demonstrated milestone." },
        { studentId: student2Id, notes: "Observed only, did not perform milestone." },
      ],
    });

    expect(obsRes.milestones).toHaveLength(0); // Zero implicit milestones assigned
  });
});
