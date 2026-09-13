/**
 * E3 — English Center Class Types
 */

export interface EnglishCenterClass {
  readonly id: string;
  readonly tenantId: string;
  readonly branchId: string;
  readonly courseId: string;
  readonly code: string;
  readonly name: string;
  readonly capacity: number;
  readonly enrolledCount: number;
  readonly teacherId: string | null;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly scheduleDays: string[] | null;
  readonly scheduleTime: string | null;
  readonly status: 'planned' | 'active' | 'completed' | 'cancelled';
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateClassInput {
  readonly branchId: string;
  readonly courseId: string;
  readonly code: string;
  readonly name: string;
  readonly capacity?: number;
  readonly teacherId?: string;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly scheduleDays?: string[];
  readonly scheduleTime?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface UpdateClassInput {
  readonly name?: string;
  readonly capacity?: number;
  readonly teacherId?: string;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly scheduleDays?: string[];
  readonly scheduleTime?: string;
  readonly status?: 'planned' | 'active' | 'completed' | 'cancelled';
  readonly metadata?: Record<string, unknown>;
}

export interface ClassRow {
  id: string;
  tenant_id: string;
  branch_id: string;
  course_id: string;
  code: string;
  name: string;
  capacity: number;
  enrolled_count: number;
  teacher_id: string | null;
  start_date: string | null;
  end_date: string | null;
  schedule_days: string[] | null;
  schedule_time: string | null;
  status: 'planned' | 'active' | 'completed' | 'cancelled';
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
