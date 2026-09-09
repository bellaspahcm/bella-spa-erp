import { SupabaseClient } from "@supabase/supabase-js";

export interface ITeacherWorkQueue {
  classId: string;
  totalStudents: number;
  studentsWithoutObservationThisWeekCount: number;
  studentsWithoutObservationThisWeekIds: string[];
  unconfirmedProgressCount: number;
  nextStepsDueCount: number;
  portfoliosReadyForPublishCount: number;
}

export class LearningWorkspaceService {
  constructor(private readonly supabase: SupabaseClient) {}

  async getTeacherWorkQueue(tenantId: string, classId: string): Promise<ITeacherWorkQueue> {
    // 1. Get total students in class
    const { data: students, error: stErr } = await this.supabase
      .from("students")
      .select("student_id")
      .eq("tenant_id", tenantId)
      .eq("academic_status", "enrolled");

    if (stErr) {
      throw new Error(`FETCH_STUDENTS_FAILED: ${stErr.message}`);
    }

    const allStudentIds = (students || []).map((s) => s.student_id);
    const totalStudents = allStudentIds.length;

    // 2. Identify students with observation in the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: recentObs } = await this.supabase
      .from("edu_dev_observation_students")
      .select("student_id")
      .eq("tenant_id", tenantId)
      .gte("created_at", sevenDaysAgo.toISOString());

    const observedStudentIds = new Set((recentObs || []).map((o) => o.student_id));
    const studentsWithoutObs = allStudentIds.filter((id) => !observedStudentIds.has(id));

    // 3. Count unconfirmed proposed progress interpretations
    const { count: unconfirmedCount } = await this.supabase
      .from("edu_dev_milestone_progress")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("is_confirmed", false)
      .eq("status_lifecycle", "ACTIVE");

    // 4. Count next steps due today or past target review date
    const todayStr = new Date().toISOString().split("T")[0];
    const { count: dueNextStepsCount } = await this.supabase
      .from("edu_dev_next_steps")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "ACTIVE")
      .lte("target_review_date", todayStr);

    // 5. Count portfolios ready for publication
    const { count: readyPortfoliosCount } = await this.supabase
      .from("edu_dev_portfolio_versions")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "READY_TO_PUBLISH");

    return {
      classId,
      totalStudents,
      studentsWithoutObservationThisWeekCount: studentsWithoutObs.length,
      studentsWithoutObservationThisWeekIds: studentsWithoutObs,
      unconfirmedProgressCount: unconfirmedCount || 0,
      nextStepsDueCount: dueNextStepsCount || 0,
      portfoliosReadyForPublishCount: readyPortfoliosCount || 0,
    };
  }
}
