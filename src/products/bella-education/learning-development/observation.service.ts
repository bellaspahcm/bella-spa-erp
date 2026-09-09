import { SupabaseClient } from "@supabase/supabase-js";

export type ObservationStatus = "DRAFT" | "RECORDED" | "SUPERSEDED";
export type EvidenceVisibility = "INTERNAL_TEACHER" | "SCHOOL_STAFF" | "PARENT_SHARED" | "PORTFOLIO_PUBLISHED";

export interface IObservation {
  id: string;
  tenant_id: string;
  activity_id?: string;
  observer_id: string;
  status: ObservationStatus;
  supersedes_observation_id?: string;
  observation_text: string;
  amended_at?: string;
  amended_by?: string;
  amendment_reason?: string;
  created_at: string;
}

export interface IObservationStudent {
  id: string;
  tenant_id: string;
  observation_id: string;
  student_id: string;
  notes?: string;
  created_at: string;
}

export interface IObservationMilestone {
  id: string;
  tenant_id: string;
  observation_student_id: string;
  milestone_id: string;
  framework_version_id: string;
  created_at: string;
}

export interface IEvidence {
  id: string;
  tenant_id: string;
  observation_id: string;
  observation_student_id?: string;
  evidence_type: string;
  storage_reference: string;
  mime_type: string;
  visibility: EvidenceVisibility;
  consent_scope: string;
  captured_by: string;
  captured_at: string;
}

export interface IRecordStudentObservationDto {
  studentId: string;
  notes?: string;
  milestoneIds?: string[];
  frameworkVersionId?: string;
  evidence?: Array<{
    evidenceType?: string;
    storageReference: string;
    mimeType: string;
    visibility?: EvidenceVisibility;
    consentScope?: string;
  }>;
}

export interface IRecordObservationDto {
  tenantId: string;
  activityId?: string; // NULLABLE for spontaneous observations
  observerId: string;
  observationText: string;
  status?: ObservationStatus;
  students: IRecordStudentObservationDto[];
  sharedEvidence?: Array<{
    evidenceType?: string;
    storageReference: string;
    mimeType: string;
    visibility?: EvidenceVisibility;
    consentScope?: string;
  }>;
}

export interface IAmendObservationDto {
  amendedBy: string;
  amendmentReason: string;
  newObservationText: string;
  students: IRecordStudentObservationDto[];
}

export class ObservationService {
  constructor(private readonly supabase: SupabaseClient) {}

  async recordObservation(dto: IRecordObservationDto): Promise<{
    observation: IObservation;
    students: IObservationStudent[];
    milestones: IObservationMilestone[];
    evidence: IEvidence[];
  }> {
    // 1. Create main observation record
    const { data: obs, error: obsErr } = await this.supabase
      .from("edu_dev_observations")
      .insert({
        tenant_id: dto.tenantId,
        activity_id: dto.activityId ?? null,
        observer_id: dto.observerId,
        status: dto.status ?? "RECORDED",
        observation_text: dto.observationText,
      })
      .select("*")
      .single();

    if (obsErr || !obs) {
      throw new Error(`OBSERVATION_CREATE_FAILED: ${obsErr?.message || "Failed to create observation"}`);
    }

    const observation = obs as IObservation;
    const createdStudents: IObservationStudent[] = [];
    const createdMilestones: IObservationMilestone[] = [];
    const createdEvidence: IEvidence[] = [];

    // 2. Attach shared activity/context evidence (observation_student_id = NULL)
    if (dto.sharedEvidence && dto.sharedEvidence.length > 0) {
      for (const se of dto.sharedEvidence) {
        const { data: ev, error: evErr } = await this.supabase
          .from("edu_dev_evidence")
          .insert({
            tenant_id: dto.tenantId,
            observation_id: observation.id,
            observation_student_id: null,
            evidence_type: se.evidenceType ?? "PHOTO",
            storage_reference: se.storageReference,
            mime_type: se.mimeType,
            visibility: se.visibility ?? "INTERNAL_TEACHER",
            consent_scope: se.consentScope ?? "CONSENT_VERIFIED",
            captured_by: dto.observerId,
          })
          .select("*")
          .single();

        if (evErr || !ev) {
          throw new Error(`SHARED_EVIDENCE_ATTACH_FAILED: ${evErr?.message}`);
        }
        createdEvidence.push(ev as IEvidence);
      }
    }

    // 3. Process per-child observation mappings
    for (const st of dto.students) {
      // Tenant Isolation Guard: Verify student belongs to the observation tenant
      const { data: validStudent, error: vErr } = await this.supabase
        .from("students")
        .select("student_id")
        .eq("student_id", st.studentId)
        .eq("tenant_id", dto.tenantId)
        .single();

      if (vErr || !validStudent) {
        throw new Error(`TENANT_STUDENT_MISMATCH_ERROR: Student ${st.studentId} does not belong to tenant ${dto.tenantId}.`);
      }

      const { data: obsSt, error: stErr } = await this.supabase
        .from("edu_dev_observation_students")
        .insert({
          tenant_id: dto.tenantId,
          observation_id: observation.id,
          student_id: st.studentId,
          notes: st.notes ?? null,
        })
        .select("*")
        .single();

      if (stErr || !obsSt) {
        throw new Error(`OBSERVATION_STUDENT_ATTACH_FAILED: ${stErr?.message}`);
      }

      const studentMembership = obsSt as IObservationStudent;
      createdStudents.push(studentMembership);

      // 4. Tag milestones owned strictly by observation_student_id
      if (st.milestoneIds && st.milestoneIds.length > 0) {
        if (!st.frameworkVersionId) {
          throw new Error("MILESTONE_FRAMEWORK_VERSION_REQUIRED: frameworkVersionId must be provided when tagging milestones.");
        }

        for (const milestoneId of st.milestoneIds) {
          const { data: ms, error: msErr } = await this.supabase
            .from("edu_dev_observation_milestones")
            .insert({
              tenant_id: dto.tenantId,
              observation_student_id: studentMembership.id,
              milestone_id: milestoneId,
              framework_version_id: st.frameworkVersionId,
            })
            .select("*")
            .single();

          if (msErr || !ms) {
            throw new Error(`MILESTONE_TAG_FAILED: ${msErr?.message}`);
          }
          createdMilestones.push(ms as IObservationMilestone);
        }
      }

      // 5. Attach child-specific evidence (observation_student_id = studentMembership.id)
      if (st.evidence && st.evidence.length > 0) {
        for (const ce of st.evidence) {
          const { data: ev, error: evErr } = await this.supabase
            .from("edu_dev_evidence")
            .insert({
              tenant_id: dto.tenantId,
              observation_id: observation.id,
              observation_student_id: studentMembership.id,
              evidence_type: ce.evidenceType ?? "PHOTO",
              storage_reference: ce.storageReference,
              mime_type: ce.mimeType,
              visibility: ce.visibility ?? "INTERNAL_TEACHER",
              consent_scope: ce.consentScope ?? "CONSENT_VERIFIED",
              captured_by: dto.observerId,
            })
            .select("*")
            .single();

          if (evErr || !ev) {
            throw new Error(`CHILD_EVIDENCE_ATTACH_FAILED: ${evErr?.message}`);
          }
          createdEvidence.push(ev as IEvidence);
        }
      }
    }

    return {
      observation,
      students: createdStudents,
      milestones: createdMilestones,
      evidence: createdEvidence,
    };
  }

  async amendObservation(
    tenantId: string,
    originalObservationId: string,
    dto: IAmendObservationDto
  ): Promise<{
    supersededObservationId: string;
    newObservation: IObservation;
    students: IObservationStudent[];
  }> {
    // 1. Fetch original observation
    const { data: orig, error: origErr } = await this.supabase
      .from("edu_dev_observations")
      .select("*")
      .eq("id", originalObservationId)
      .eq("tenant_id", tenantId)
      .single();

    if (origErr || !orig) {
      throw new Error("OBSERVATION_NOT_FOUND: Original observation not found.");
    }

    if (orig.status === "SUPERSEDED") {
      throw new Error("OBSERVATION_ALREADY_SUPERSEDED_ERROR: Cannot amend an observation that is already superseded.");
    }

    // 2. Mark original observation as SUPERSEDED
    const { error: upErr } = await this.supabase
      .from("edu_dev_observations")
      .update({ status: "SUPERSEDED" })
      .eq("id", originalObservationId)
      .eq("tenant_id", tenantId);

    if (upErr) {
      throw new Error(`OBSERVATION_SUPERSEDE_FAILED: ${upErr.message}`);
    }

    // 3. Create new observation version preserving provenance
    const { data: newObs, error: newErr } = await this.supabase
      .from("edu_dev_observations")
      .insert({
        tenant_id: tenantId,
        activity_id: orig.activity_id,
        observer_id: orig.observer_id,
        status: "RECORDED",
        supersedes_observation_id: originalObservationId,
        observation_text: dto.newObservationText,
        amended_at: new Date().toISOString(),
        amended_by: dto.amendedBy,
        amendment_reason: dto.amendmentReason,
      })
      .select("*")
      .single();

    if (newErr || !newObs) {
      throw new Error(`AMENDED_OBSERVATION_CREATE_FAILED: ${newErr?.message}`);
    }

    const createdNewObs = newObs as IObservation;

    // 4. Re-attach per-child mappings for amended version
    const createdStudents: IObservationStudent[] = [];
    for (const st of dto.students) {
      const { data: obsSt, error: stErr } = await this.supabase
        .from("edu_dev_observation_students")
        .insert({
          tenant_id: tenantId,
          observation_id: createdNewObs.id,
          student_id: st.studentId,
          notes: st.notes ?? null,
        })
        .select("*")
        .single();

      if (stErr || !obsSt) {
        throw new Error(`AMENDMENT_STUDENT_ATTACH_FAILED: ${stErr.message}`);
      }
      createdStudents.push(obsSt as IObservationStudent);
    }

    return {
      supersededObservationId: originalObservationId,
      newObservation: createdNewObs,
      students: createdStudents,
    };
  }

  async getObservationEvidence(
    tenantId: string,
    observationId: string,
    requestorRole: "TEACHER" | "STAFF" | "PARENT"
  ): Promise<IEvidence[]> {
    const { data, error } = await this.supabase
      .from("edu_dev_evidence")
      .select("*")
      .eq("observation_id", observationId)
      .eq("tenant_id", tenantId);

    if (error) {
      throw new Error(`FETCH_EVIDENCE_FAILED: ${error.message}`);
    }

    const allEvidence = (data || []) as IEvidence[];

    // Enforce Evidence Privacy Scopes
    return allEvidence.filter((e) => {
      if (requestorRole === "TEACHER") return true;
      if (requestorRole === "STAFF") return e.visibility !== "INTERNAL_TEACHER";
      if (requestorRole === "PARENT") return e.visibility === "PARENT_SHARED" || e.visibility === "PORTFOLIO_PUBLISHED";
      return false;
    });
  }
}
