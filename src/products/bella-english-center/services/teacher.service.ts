import { SupabaseClient } from '@supabase/supabase-js';
import { TeacherRepository } from '../repositories/teacher.repository';
import { CreateTeacherInput, UpdateTeacherInput, EnglishCenterTeacher, TeacherBranchAssignment } from '../types/teacher.types';

export class TeacherService {
  private readonly repository: TeacherRepository;

  constructor(supabase: SupabaseClient) {
    this.repository = new TeacherRepository(supabase);
  }

  async createTeacher(tenantId: string, input: CreateTeacherInput): Promise<EnglishCenterTeacher> {
    return this.repository.create(tenantId, input);
  }

  async getTeacher(tenantId: string, teacherId: string): Promise<EnglishCenterTeacher | null> {
    return this.repository.getById(tenantId, teacherId);
  }

  async listTeachers(tenantId: string, filters?: { status?: string; limit?: number; offset?: number }): Promise<{ teachers: EnglishCenterTeacher[]; total: number }> {
    return this.repository.list(tenantId, filters);
  }

  async updateTeacher(tenantId: string, teacherId: string, input: UpdateTeacherInput): Promise<EnglishCenterTeacher> {
    return this.repository.update(tenantId, teacherId, input);
  }

  async assignBranch(tenantId: string, teacherId: string, branchId: string, isPrimary: boolean = false): Promise<TeacherBranchAssignment> {
    return this.repository.assignBranch(tenantId, teacherId, branchId, isPrimary);
  }

  async listTeacherBranches(tenantId: string, teacherId: string): Promise<TeacherBranchAssignment[]> {
    return this.repository.listBranches(tenantId, teacherId);
  }
}
