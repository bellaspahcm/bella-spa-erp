import { SupabaseClient } from "@supabase/supabase-js";

export type NextStepContext = "CLASSROOM" | "HOME";
export type NextStepPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type NextStepStatus = "ACTIVE" | "COMPLETED" | "CANCELLED";

export interface INextStep {
  id: string;
  tenant_id: string;
  student_id: string;
  milestone_progress_id?: string;
  milestone_id: string;
  context: NextStepContext;
  recommendation: string;
  priority: NextStepPriority;
  target_review_date?: string;
  status: NextStepStatus;
  created_by: string;
  created_at: string;
}

export interface ICreateNextStepDto {
  tenantId: string;
  studentId: string;
  milestoneProgressId?: string;
  milestoneId: string;
  context?: NextStepContext;
  recommendation: string;
  priority?: NextStepPriority;
  targetReviewDate?: string;
  createdBy: string;
}

export class NextStepsService {
  constructor(private readonly supabase: SupabaseClient) {}

  async createNextStep(dto: ICreateNextStepDto): Promise<INextStep> {
    // 1. Verify student exists and belongs to tenant
    const { data: student, error: stErr } = await this.supabase
      .from("students")
      .select("student_id")
      .eq("student_id", dto.studentId)
      .eq("tenant_id", dto.tenantId)
      .single();

    if (stErr || !student) {
      throw new Error("NEXT_STEP_STUDENT_NOT_FOUND: Target student not found for this tenant.");
    }

    // 2. Insert Next Step record
    const { data, error } = await this.supabase
      .from("edu_dev_next_steps")
      .insert({
        tenant_id: dto.tenantId,
        student_id: dto.studentId,
        milestone_progress_id: dto.milestoneProgressId ?? null,
        milestone_id: dto.milestoneId,
        context: dto.context ?? "CLASSROOM",
        recommendation: dto.recommendation,
        priority: dto.priority ?? "MEDIUM",
        target_review_date: dto.targetReviewDate ?? null,
        status: "ACTIVE",
        created_by: dto.createdBy,
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(`NEXT_STEP_CREATE_FAILED: ${error?.message || "Failed to create next step"}`);
    }

    return data as INextStep;
  }

  async updateStatus(tenantId: string, id: string, status: NextStepStatus): Promise<INextStep> {
    const { data, error } = await this.supabase
      .from("edu_dev_next_steps")
      .update({ status })
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(`NEXT_STEP_UPDATE_FAILED: ${error?.message || "Failed to update next step status"}`);
    }

    return data as INextStep;
  }

  async getStudentNextSteps(tenantId: string, studentId: string, context?: NextStepContext): Promise<INextStep[]> {
    let query = this.supabase
      .from("edu_dev_next_steps")
      .select("*")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .eq("status", "ACTIVE");

    if (context) {
      query = query.eq("context", context);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`FETCH_NEXT_STEPS_FAILED: ${error.message}`);
    }

    return (data || []) as INextStep[];
  }
}
