import { SupabaseClient } from "@supabase/supabase-js";

export type ActivityStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface IActivity {
  id: string;
  tenant_id: string;
  class_id: string;
  title: string;
  description?: string;
  planned_date: string;
  status: ActivityStatus;
  created_by?: string;
  created_at: string;
}

export interface ICreateActivityDto {
  tenantId: string;
  classId: string;
  title: string;
  description?: string;
  plannedDate?: string;
  createdBy?: string;
}

export class ActivityService {
  constructor(private readonly supabase: SupabaseClient) {}

  async createActivity(dto: ICreateActivityDto): Promise<IActivity> {
    const { data, error } = await this.supabase
      .from("edu_dev_activities")
      .insert({
        tenant_id: dto.tenantId,
        class_id: dto.classId,
        title: dto.title,
        description: dto.description ?? null,
        planned_date: dto.plannedDate ?? new Date().toISOString().split("T")[0],
        status: "PLANNED",
        created_by: dto.createdBy ?? null,
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(`ACTIVITY_CREATE_FAILED: ${error?.message || "Failed to create activity"}`);
    }

    return data as IActivity;
  }

  async updateActivityStatus(tenantId: string, activityId: string, status: ActivityStatus): Promise<IActivity> {
    const { data, error } = await this.supabase
      .from("edu_dev_activities")
      .update({ status })
      .eq("id", activityId)
      .eq("tenant_id", tenantId)
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(`ACTIVITY_STATUS_UPDATE_FAILED: ${error?.message || "Failed to update activity status"}`);
    }

    return data as IActivity;
  }

  async getActivitiesForClass(tenantId: string, classId: string, date?: string): Promise<IActivity[]> {
    let query = this.supabase
      .from("edu_dev_activities")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("class_id", classId);

    if (date) {
      query = query.eq("planned_date", date);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`FETCH_ACTIVITIES_FAILED: ${error.message}`);
    }

    return (data || []) as IActivity[];
  }
}
