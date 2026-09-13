/**
 * E2 — English Center Enrollment Repository
 * Architecture: Product extension data access (english_center_enrollments table)
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  EnglishCenterEnrollment,
  EnglishCenterEnrollmentRow,
  UpdateEnglishEnrollmentInput,
} from '../types/enrollment.types';

export class EnglishCenterEnrollmentRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Create English Center enrollment extension
   */
  async create(data: {
    tenantId: string;
    canonicalEnrollmentId: string;
    branchId: string;
    programId?: string;
    classId?: string;
    intake?: string;
    englishLevelAtEnrollment?: string;
    metadata?: Record<string, unknown>;
  }): Promise<EnglishCenterEnrollment> {
    const { data: row, error } = await this.supabase
      .from('english_center_enrollments')
      .insert({
        tenant_id: data.tenantId,
        canonical_enrollment_id: data.canonicalEnrollmentId,
        branch_id: data.branchId,
        program_id: data.programId || null,
        class_id: data.classId || null,
        intake: data.intake || null,
        english_level_at_enrollment: data.englishLevelAtEnrollment || null,
        metadata: data.metadata || {},
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapRowToDomain(row);
  }

  /**
   * Get English Center enrollment by ID
   */
  async getById(
    tenantId: string,
    enrollmentId: string
  ): Promise<EnglishCenterEnrollment | null> {
    const { data: row, error } = await this.supabase
      .from('english_center_enrollments')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', enrollmentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return this.mapRowToDomain(row);
  }

  /**
   * Get English Center enrollment by canonical enrollment ID
   */
  async getByCanonicalId(
    tenantId: string,
    canonicalEnrollmentId: string
  ): Promise<EnglishCenterEnrollment | null> {
    const { data: row, error } = await this.supabase
      .from('english_center_enrollments')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('canonical_enrollment_id', canonicalEnrollmentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return this.mapRowToDomain(row);
  }

  /**
   * List English Center enrollments with filters
   */
  async list(filter: {
    tenantId: string;
    branchId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ enrollments: EnglishCenterEnrollment[]; total: number }> {
    let query = this.supabase
      .from('english_center_enrollments')
      .select('*', { count: 'exact' })
      .eq('tenant_id', filter.tenantId);

    if (filter.branchId) {
      query = query.eq('branch_id', filter.branchId);
    }

    const limit = filter.limit || 20;
    const offset = filter.offset || 0;

    query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });

    const { data: rows, error, count } = await query;

    if (error) throw error;

    return {
      enrollments: (rows || []).map((row) => this.mapRowToDomain(row)),
      total: count || 0,
    };
  }

  /**
   * Update English Center enrollment context
   */
  async update(
    tenantId: string,
    enrollmentId: string,
    input: UpdateEnglishEnrollmentInput
  ): Promise<EnglishCenterEnrollment> {
    const updateData: Partial<EnglishCenterEnrollmentRow> = {};

    if (input.classId !== undefined) updateData.class_id = input.classId || null;
    if (input.programId !== undefined) updateData.program_id = input.programId || null;
    if (input.metadata !== undefined) updateData.metadata = input.metadata;

    const { data: row, error } = await this.supabase
      .from('english_center_enrollments')
      .update(updateData)
      .eq('tenant_id', tenantId)
      .eq('id', enrollmentId)
      .select()
      .single();

    if (error) throw error;
    return this.mapRowToDomain(row);
  }

  /**
   * Map database row to domain model
   */
  private mapRowToDomain(row: EnglishCenterEnrollmentRow): EnglishCenterEnrollment {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      canonicalEnrollmentId: row.canonical_enrollment_id,
      branchId: row.branch_id,
      programId: row.program_id,
      classId: row.class_id,
      intake: row.intake,
      englishLevelAtEnrollment: row.english_level_at_enrollment,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
