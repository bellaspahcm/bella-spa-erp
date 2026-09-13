/**
 * E3 — English Center Class Repository
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  EnglishCenterClass,
  CreateClassInput,
  UpdateClassInput,
  ClassRow,
} from '../types/class.types';

export class ClassRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async create(
    tenantId: string,
    input: CreateClassInput
  ): Promise<EnglishCenterClass> {
    const { data: row, error } = await this.supabase
      .from('english_center_classes')
      .insert({
        tenant_id: tenantId,
        branch_id: input.branchId,
        course_id: input.courseId,
        code: input.code,
        name: input.name,
        capacity: input.capacity || 20,
        teacher_id: input.teacherId || null,
        start_date: input.startDate || null,
        end_date: input.endDate || null,
        schedule_days: input.scheduleDays || null,
        schedule_time: input.scheduleTime || null,
        metadata: input.metadata || {},
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapRowToDomain(row);
  }

  async getById(
    tenantId: string,
    classId: string
  ): Promise<EnglishCenterClass | null> {
    const { data: row, error } = await this.supabase
      .from('english_center_classes')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', classId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return this.mapRowToDomain(row);
  }

  async list(
    tenantId: string,
    filters?: {
      branchId?: string;
      courseId?: string;
      status?: 'planned' | 'active' | 'completed' | 'cancelled';
      limit?: number;
      offset?: number;
    }
  ): Promise<{ classes: EnglishCenterClass[]; total: number }> {
    let query = this.supabase
      .from('english_center_classes')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId);

    if (filters?.branchId) {
      query = query.eq('branch_id', filters.branchId);
    }
    if (filters?.courseId) {
      query = query.eq('course_id', filters.courseId);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;
    query = query.range(offset, offset + limit - 1).order('start_date', { ascending: false });

    const { data: rows, error, count } = await query;

    if (error) throw error;

    return {
      classes: (rows || []).map((row) => this.mapRowToDomain(row)),
      total: count || 0,
    };
  }

  async update(
    tenantId: string,
    classId: string,
    input: UpdateClassInput
  ): Promise<EnglishCenterClass> {
    const updateData: Partial<ClassRow> = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.capacity !== undefined) updateData.capacity = input.capacity;
    if (input.teacherId !== undefined) updateData.teacher_id = input.teacherId || null;
    if (input.startDate !== undefined) updateData.start_date = input.startDate || null;
    if (input.endDate !== undefined) updateData.end_date = input.endDate || null;
    if (input.scheduleDays !== undefined) updateData.schedule_days = input.scheduleDays || null;
    if (input.scheduleTime !== undefined) updateData.schedule_time = input.scheduleTime || null;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.metadata !== undefined) updateData.metadata = input.metadata;

    const { data: row, error } = await this.supabase
      .from('english_center_classes')
      .update(updateData)
      .eq('tenant_id', tenantId)
      .eq('id', classId)
      .select()
      .single();

    if (error) throw error;
    return this.mapRowToDomain(row);
  }

  private mapRowToDomain(row: ClassRow): EnglishCenterClass {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id,
      courseId: row.course_id,
      code: row.code,
      name: row.name,
      capacity: row.capacity,
      enrolledCount: row.enrolled_count,
      teacherId: row.teacher_id,
      startDate: row.start_date,
      endDate: row.end_date,
      scheduleDays: row.schedule_days,
      scheduleTime: row.schedule_time,
      status: row.status,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
