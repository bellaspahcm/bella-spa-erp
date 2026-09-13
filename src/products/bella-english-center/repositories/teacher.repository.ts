import { SupabaseClient } from '@supabase/supabase-js';
import { EnglishCenterTeacher, CreateTeacherInput, UpdateTeacherInput, TeacherRow, TeacherBranchAssignment, TeacherBranchRow } from '../types/teacher.types';

export class TeacherRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async create(tenantId: string, input: CreateTeacherInput): Promise<EnglishCenterTeacher> {
    const { data: row, error } = await this.supabase.from('english_center_teachers').insert({
      tenant_id: tenantId,
      party_id: input.partyId,
      employee_code: input.employeeCode || null,
      certifications: input.certifications || [],
      specializations: input.specializations || null,
      languages: input.languages || null,
      metadata: input.metadata || {},
    }).select().single();
    if (error) throw error;
    return this.mapRowToDomain(row);
  }

  async getById(tenantId: string, teacherId: string): Promise<EnglishCenterTeacher | null> {
    const { data: row, error } = await this.supabase.from('english_center_teachers')
      .select('*').eq('tenant_id', tenantId).eq('id', teacherId).single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return this.mapRowToDomain(row);
  }

  async list(tenantId: string, filters?: { status?: string; limit?: number; offset?: number }): Promise<{ teachers: EnglishCenterTeacher[]; total: number }> {
    let query = this.supabase.from('english_center_teachers').select('*', { count: 'exact' }).eq('tenant_id', tenantId);
    if (filters?.status) query = query.eq('status', filters.status);
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;
    query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });
    const { data: rows, error, count } = await query;
    if (error) throw error;
    return { teachers: (rows || []).map(r => this.mapRowToDomain(r)), total: count || 0 };
  }

  async update(tenantId: string, teacherId: string, input: UpdateTeacherInput): Promise<EnglishCenterTeacher> {
    const updateData: Partial<TeacherRow> = {};
    if (input.employeeCode !== undefined) updateData.employee_code = input.employeeCode || null;
    if (input.certifications !== undefined) updateData.certifications = input.certifications;
    if (input.specializations !== undefined) updateData.specializations = input.specializations || null;
    if (input.languages !== undefined) updateData.languages = input.languages || null;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.metadata !== undefined) updateData.metadata = input.metadata;
    const { data: row, error } = await this.supabase.from('english_center_teachers')
      .update(updateData).eq('tenant_id', tenantId).eq('id', teacherId).select().single();
    if (error) throw error;
    return this.mapRowToDomain(row);
  }

  async assignBranch(tenantId: string, teacherId: string, branchId: string, isPrimary: boolean = false): Promise<TeacherBranchAssignment> {
    const { data: row, error } = await this.supabase.from('english_center_teacher_branches').insert({
      tenant_id: tenantId,
      teacher_id: teacherId,
      branch_id: branchId,
      is_primary: isPrimary,
    }).select().single();
    if (error) throw error;
    return this.mapBranchRowToDomain(row);
  }

  async listBranches(tenantId: string, teacherId: string): Promise<TeacherBranchAssignment[]> {
    const { data: rows, error } = await this.supabase.from('english_center_teacher_branches')
      .select('*').eq('tenant_id', tenantId).eq('teacher_id', teacherId).eq('status', 'active');
    if (error) throw error;
    return (rows || []).map(r => this.mapBranchRowToDomain(r));
  }

  private mapRowToDomain(row: TeacherRow): EnglishCenterTeacher {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      partyId: row.party_id,
      employeeCode: row.employee_code,
      certifications: row.certifications,
      specializations: row.specializations,
      languages: row.languages,
      status: row.status,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapBranchRowToDomain(row: TeacherBranchRow): TeacherBranchAssignment {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      teacherId: row.teacher_id,
      branchId: row.branch_id,
      isPrimary: row.is_primary,
      status: row.status,
      assignedAt: row.assigned_at,
      createdAt: row.created_at,
    };
  }
}
