/**
 * E3 — English Center Course Types
 */

export interface EnglishCenterCourse {
  readonly id: string;
  readonly tenantId: string;
  readonly programId: string;
  readonly code: string;
  readonly name: string;
  readonly level: string | null;
  readonly durationHours: number | null;
  readonly description: string | null;
  readonly status: 'active' | 'inactive';
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateCourseInput {
  readonly programId: string;
  readonly code: string;
  readonly name: string;
  readonly level?: string;
  readonly durationHours?: number;
  readonly description?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface UpdateCourseInput {
  readonly name?: string;
  readonly level?: string;
  readonly durationHours?: number;
  readonly description?: string;
  readonly status?: 'active' | 'inactive';
  readonly metadata?: Record<string, unknown>;
}

export interface CourseRow {
  id: string;
  tenant_id: string;
  program_id: string;
  code: string;
  name: string;
  level: string | null;
  duration_hours: number | null;
  description: string | null;
  status: 'active' | 'inactive';
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
