/**
 * E3 — English Center Class Service
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { ClassRepository } from '../repositories/class.repository';
import {
  CreateClassInput,
  UpdateClassInput,
  EnglishCenterClass,
} from '../types/class.types';

export class ClassService {
  private readonly repository: ClassRepository;

  constructor(supabase: SupabaseClient) {
    this.repository = new ClassRepository(supabase);
  }

  async createClass(
    tenantId: string,
    input: CreateClassInput
  ): Promise<EnglishCenterClass> {
    return this.repository.create(tenantId, input);
  }

  async getClass(
    tenantId: string,
    classId: string
  ): Promise<EnglishCenterClass | null> {
    return this.repository.getById(tenantId, classId);
  }

  async listClasses(
    tenantId: string,
    filters?: {
      branchId?: string;
      courseId?: string;
      status?: 'planned' | 'active' | 'completed' | 'cancelled';
      limit?: number;
      offset?: number;
    }
  ): Promise<{ classes: EnglishCenterClass[]; total: number }> {
    return this.repository.list(tenantId, filters);
  }

  async updateClass(
    tenantId: string,
    classId: string,
    input: UpdateClassInput
  ): Promise<EnglishCenterClass> {
    return this.repository.update(tenantId, classId, input);
  }

  async assignTeacher(
    tenantId: string,
    classId: string,
    teacherId: string
  ): Promise<EnglishCenterClass> {
    return this.repository.update(tenantId, classId, { teacherId });
  }
}
