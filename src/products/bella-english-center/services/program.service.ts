/**
 * E3 — English Center Program Service
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { ProgramRepository } from '../repositories/program.repository';
import {
  CreateProgramInput,
  UpdateProgramInput,
  EnglishCenterProgram,
} from '../types/program.types';

export class ProgramService {
  private readonly repository: ProgramRepository;

  constructor(supabase: SupabaseClient) {
    this.repository = new ProgramRepository(supabase);
  }

  async createProgram(
    tenantId: string,
    input: CreateProgramInput
  ): Promise<EnglishCenterProgram> {
    return this.repository.create(tenantId, input);
  }

  async getProgram(
    tenantId: string,
    programId: string
  ): Promise<EnglishCenterProgram | null> {
    return this.repository.getById(tenantId, programId);
  }

  async listPrograms(
    tenantId: string,
    filters?: { status?: 'active' | 'inactive'; limit?: number; offset?: number }
  ): Promise<{ programs: EnglishCenterProgram[]; total: number }> {
    return this.repository.list(tenantId, filters);
  }

  async updateProgram(
    tenantId: string,
    programId: string,
    input: UpdateProgramInput
  ): Promise<EnglishCenterProgram> {
    return this.repository.update(tenantId, programId, input);
  }
}
