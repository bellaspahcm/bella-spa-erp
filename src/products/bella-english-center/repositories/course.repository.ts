/**
 * E3 — English Center Course Repository
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  EnglishCenterCourse,
  CreateCourseInput,
  UpdateCourseInput,
  CourseRow,
} from '../types/course.types';

export class CourseRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async create(
    tenantId: string,
    input: CreateCourseInput
  ): Promise<EnglishCenterCourse> {
    const { data: row, error } = await this.supabase
      .from('english_center_courses')
      .insert({
        tenant_id: tenantId,
        program_id: input.programId,
        code: input.code,
        name: input.name,
        level: input.level || null,
        duration_hours: input.durationHours || null,
        description: input.description || null,
        metadata: input.metadata || {},
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapRowToDomain(row);
  }

  async getById(
    tenantId: string,
    courseId: string
  ): Promise<EnglishCenterCourse | null> {
    const { data: row, error } = await this.supabase
      .from('english_center_courses')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', courseId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return this.mapRowToDomain(row);
  }

  async list(
    tenantId: string,
    filters?: { programId?: string; status?: 'active' | 'inactive'; limit?: number; offset?: number }
  ): Promise<{ courses: EnglishCenterCourse[]; total: number }> {
    let query = this.supabase
      .from('english_center_courses')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId);

    if (filters?.programId) {
      query = query.eq('program_id', filters.programId);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;
    query = query.range(offset, offset + limit - 1).order('name', { ascending: true });

    const { data: rows, error, count } = await query;

    if (error) throw error;

    return {
      courses: (rows || []).map((row) => this.mapRowToDomain(row)),
      total: count || 0,
    };
  }

  async update(
    tenantId: string,
    courseId: string,
    input: UpdateCourseInput
  ): Promise<EnglishCenterCourse> {
    const updateData: Partial<CourseRow> = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.level !== undefined) updateData.level = input.level || null;
    if (input.durationHours !== undefined) updateData.duration_hours = input.durationHours || null;
    if (input.description !== undefined) updateData.description = input.description || null;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.metadata !== undefined) updateData.metadata = input.metadata;

    const { data: row, error } = await this.supabase
      .from('english_center_courses')
      .update(updateData)
      .eq('tenant_id', tenantId)
      .eq('id', courseId)
      .select()
      .single();

    if (error) throw error;
    return this.mapRowToDomain(row);
  }

  private mapRowToDomain(row: CourseRow): EnglishCenterCourse {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      programId: row.program_id,
      code: row.code,
      name: row.name,
      level: row.level,
      durationHours: row.duration_hours,
      description: row.description,
      status: row.status,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
