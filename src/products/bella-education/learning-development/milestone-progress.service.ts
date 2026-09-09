import { SupabaseClient } from "@supabase/supabase-js";

export type MilestoneProgressStatus = "NOT_YET_OBSERVED" | "EMERGING" | "DEVELOPING" | "CONSISTENT" | "NEEDS_SUPPORT";

export interface IMilestoneProgress {
  id: string;
  tenant_id: string;
  student_id: string;
  framework_version_id: string;
  milestone_id: string;
  status: MilestoneProgressStatus;
  interpreted_by: string;
  interpreted_at: string;
  rationale: string;
  is_confirmed: boolean;
  status_lifecycle: "ACTIVE" | "SUPERSEDED";
  supersedes_progress_id?: string;
  created_at: string;
}

export interface IProgressEvidenceLink {
  id: string;
  tenant_id: string;
  progress_id: string;
  evidence_id: string;
  created_at: string;
}

export interface IInterpretProgressDto {
  tenantId: string;
  studentId: string;
  frameworkVersionId: string;
  milestoneId: string;
  status: MilestoneProgressStatus;
  interpretedBy: string;
  rationale: string;
  evidenceIds: string[];
  isConfirmed?: boolean; // FALSE for AI/rule suggestions, TRUE for teacher confirmation
}

export interface IAmendProgressDto {
  tenantId: string;
  originalProgressId: string;
  amendedBy: string;
  status: MilestoneProgressStatus;
  rationale: string;
  evidenceIds: string[];
}

export class MilestoneProgressService {
  constructor(private readonly supabase: SupabaseClient) {}

  async interpretProgress(dto: IInterpretProgressDto): Promise<{
    progress: IMilestoneProgress;
    evidenceLinks: IProgressEvidenceLink[];
  }> {
    // INVARIANT 1: Progress interpretation MUST reference >= 1 valid evidence source
    if (!dto.evidenceIds || dto.evidenceIds.length === 0) {
      throw new Error("PROGRESS_EVIDENCE_REQUIRED_ERROR: Progress interpretation requires at least one evidence reference.");
    }

    // INVARIANT 2: Verify all evidence sources exist and belong to the correct student & tenant
    const { data: evidenceItems, error: evErr } = await this.supabase
      .from("edu_dev_evidence")
      .select(`
        *,
        observation_membership:observation_student_id (*)
      `)
      .in("id", dto.evidenceIds)
      .eq("tenant_id", dto.tenantId);

    if (evErr || !evidenceItems || evidenceItems.length !== dto.evidenceIds.length) {
      throw new Error("PROGRESS_EVIDENCE_NOT_FOUND: One or more evidence items could not be found.");
    }

    for (const ev of evidenceItems) {
      // If child-specific evidence, verify student_id matches target student
      if (ev.observation_membership) {
        if (ev.observation_membership.student_id !== dto.studentId) {
          throw new Error("EVIDENCE_STUDENT_MISMATCH_ERROR: Evidence belongs to a different student.");
        }
      }
    }

    // INVARIANT 3: Verify milestone belongs to the specified framework version
    const { data: milestone, error: msErr } = await this.supabase
      .from("edu_dev_milestones")
      .select("framework_version_id")
      .eq("id", dto.milestoneId)
      .eq("tenant_id", dto.tenantId)
      .single();

    if (msErr || !milestone) {
      throw new Error("MILESTONE_NOT_FOUND: Target milestone not found.");
    }

    if (milestone.framework_version_id !== dto.frameworkVersionId) {
      throw new Error("EVIDENCE_FRAMEWORK_MISMATCH_ERROR: Milestone does not match the specified framework version.");
    }

    // 1. Insert progress record
    const { data: progress, error: progErr } = await this.supabase
      .from("edu_dev_milestone_progress")
      .insert({
        tenant_id: dto.tenantId,
        student_id: dto.studentId,
        framework_version_id: dto.frameworkVersionId,
        milestone_id: dto.milestoneId,
        status: dto.status,
        interpreted_by: dto.interpretedBy,
        rationale: dto.rationale,
        is_confirmed: dto.isConfirmed ?? true,
        status_lifecycle: "ACTIVE",
      })
      .select("*")
      .single();

    if (progErr || !progress) {
      throw new Error(`PROGRESS_INTERPRETATION_FAILED: ${progErr?.message}`);
    }

    const createdProgress = progress as IMilestoneProgress;
    const createdLinks: IProgressEvidenceLink[] = [];

    // 2. Link evidence sources
    for (const evidenceId of dto.evidenceIds) {
      const { data: link, error: linkErr } = await this.supabase
        .from("edu_dev_progress_evidence_links")
        .insert({
          tenant_id: dto.tenantId,
          progress_id: createdProgress.id,
          evidence_id: evidenceId,
        })
        .select("*")
        .single();

      if (linkErr || !link) {
        throw new Error(`PROGRESS_EVIDENCE_LINK_FAILED: ${linkErr?.message}`);
      }
      createdLinks.push(link as IProgressEvidenceLink);
    }

    return { progress: createdProgress, evidenceLinks: createdLinks };
  }

  async confirmProgress(tenantId: string, progressId: string, teacherId: string): Promise<IMilestoneProgress> {
    const { data, error } = await this.supabase
      .from("edu_dev_milestone_progress")
      .update({
        is_confirmed: true,
        interpreted_by: teacherId,
        interpreted_at: new Date().toISOString(),
      })
      .eq("id", progressId)
      .eq("tenant_id", tenantId)
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(`PROGRESS_CONFIRMATION_FAILED: ${error?.message || "Failed to confirm progress"}`);
    }

    return data as IMilestoneProgress;
  }

  async amendProgress(dto: IAmendProgressDto): Promise<{
    supersededProgressId: string;
    newProgress: IMilestoneProgress;
    evidenceLinks: IProgressEvidenceLink[];
  }> {
    // 1. Fetch original progress
    const { data: orig, error: origErr } = await this.supabase
      .from("edu_dev_milestone_progress")
      .select("*")
      .eq("id", dto.originalProgressId)
      .eq("tenant_id", dto.tenantId)
      .single();

    if (origErr || !orig) {
      throw new Error("PROGRESS_NOT_FOUND: Original progress interpretation not found.");
    }

    // 2. Mark original progress as SUPERSEDED
    await this.supabase
      .from("edu_dev_milestone_progress")
      .update({ status_lifecycle: "SUPERSEDED" })
      .eq("id", dto.originalProgressId)
      .eq("tenant_id", dto.tenantId);

    // 3. Create amended interpretation version
    const res = await this.interpretProgress({
      tenantId: dto.tenantId,
      studentId: orig.student_id,
      frameworkVersionId: orig.framework_version_id,
      milestoneId: orig.milestone_id,
      status: dto.status,
      interpretedBy: dto.amendedBy,
      rationale: dto.rationale,
      evidenceIds: dto.evidenceIds,
      isConfirmed: true,
    });

    // Update supersedes_progress_id reference
    const { data: updatedNew } = await this.supabase
      .from("edu_dev_milestone_progress")
      .update({ supersedes_progress_id: dto.originalProgressId })
      .eq("id", res.progress.id)
      .select("*")
      .single();

    return {
      supersededProgressId: dto.originalProgressId,
      newProgress: (updatedNew || res.progress) as IMilestoneProgress,
      evidenceLinks: res.evidenceLinks,
    };
  }

  async getStudentProgressSummary(tenantId: string, studentId: string): Promise<IMilestoneProgress[]> {
    const { data, error } = await this.supabase
      .from("edu_dev_milestone_progress")
      .select("*")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .eq("status_lifecycle", "ACTIVE")
      .eq("is_confirmed", true);

    if (error) {
      throw new Error(`FETCH_PROGRESS_FAILED: ${error.message}`);
    }

    return (data || []) as IMilestoneProgress[];
  }
}
