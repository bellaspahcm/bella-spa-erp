/**
 * E3 — English Center Program Repository
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  EnglishCenterProgram,
  CreateProgramInput,
  UpdateProgramInput,
  ProgramRow,
} from '../types/program.types';

export class ProgramRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async create(
    tenantId: string,
    input: CreateProgramInput
  ): Promise<EnglishCenterProgram> {
    const { data: row, error } = await this.supabase
      .from('english_center_programs')
      .insert({
        tenant_id: tenantId,
        branch_id: input.branchId || null,
        code: input.code,
        name: input.name,
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
    programId: string
  ): Promise<EnglishCenterProgram | null> {
    const { data: row, error } = await this.supabase
      .from('english_center_programs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', programId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return this.mapRowToDomain(row);
  }

  async list(
    tenantId: string,
    filters?: { status?: 'active' | 'inactive'; limit?: number; offset?: number }
  ): Promise<{ programs: EnglishCenterProgram[]; total: number }> {
    let query = this.supabase
      .from('english_center_programs')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId);

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;
    query = query.range(offset, offset + limit - 1).order('name', { ascending: true });

    const { data: rows, error, count } = await query;

    if (error) throw error;

    return {
      programs: (rows || []).map((row) => this.mapRowToDomain(row)),
      total: count || 0,
    };
  }

  async update(
    tenantId: string,
    programId: string,
    input: UpdateProgramInput
  ): Promise<EnglishCenterProgram> {
    const updateData: Partial<ProgramRow> = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description || null;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.metadata !== undefined) updateData.metadata = input.metadata;

    const { data: row, error } = await this.supabase
      .from('english_center_programs')
      .update(updateData)
      .eq('tenant_id', tenantId)
      .eq('id', programId)
      .select()
      .single();

    if (error) throw error;
    return this.mapRowToDomain(row);
  }

  private mapRowToDomain(row: ProgramRow): EnglishCenterProgram {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id,
      code: row.code,
      name: row.name,
      description: row.description,
      status: row.status,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
