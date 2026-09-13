/**
 * E3 — English Center Course Service
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { CourseRepository } from '../repositories/course.repository';
import {
  CreateCourseInput,
  UpdateCourseInput,
  EnglishCenterCourse,
} from '../types/course.types';

export class CourseService {
  private readonly repository: CourseRepository;

  constructor(supabase: SupabaseClient) {
    this.repository = new CourseRepository(supabase);
  }

  async createCourse(
    tenantId: string,
    input: CreateCourseInput
  ): Promise<EnglishCenterCourse> {
    return this.repository.create(tenantId, input);
  }

  async getCourse(
    tenantId: string,
    courseId: string
  ): Promise<EnglishCenterCourse | null> {
    return this.repository.getById(tenantId, courseId);
  }

  async listCourses(
    tenantId: string,
    filters?: {
      programId?: string;
      status?: 'active' | 'inactive';
      limit?: number;
      offset?: number;
    }
  ): Promise<{ courses: EnglishCenterCourse[]; total: number }> {
    return this.repository.list(tenantId, filters);
  }

  async updateCourse(
    tenantId: string,
    courseId: string,
    input: UpdateCourseInput
  ): Promise<EnglishCenterCourse> {
    return this.repository.update(tenantId, courseId, input);
  }
}
