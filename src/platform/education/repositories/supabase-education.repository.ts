/**
 * Education OS — Supabase Education Repository Implementation
 * 
 * Extends BaseSupabaseRepositoryPrimitive from Common Core (src/platform/core/repository).
 * Preserves strict 1-way dependency rules with zero duplicated infrastructure.
 * 
 * @module platform/education/repositories/supabase-education.repository
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { BaseSupabaseRepositoryPrimitive } from '../../core/repository';
import { Course } from '../domain/course.entity';
import { Enrollment } from '../domain/enrollment.entity';
import { IEducationRepository } from './education-repository.interface';

export class SupabaseEducationRepository extends BaseSupabaseRepositoryPrimitive implements IEducationRepository {
  constructor(private readonly supabase: SupabaseClient<Record<string, unknown>>) {
    super();
  }

  public async saveCourse(course: Course): Promise<void> {
    const payload = {
      id: course.id,
      tenant_id: course.tenantId,
      course_code: course.courseCode,
      title: course.title,
      status: course.status,
      created_at: course.createdAt.toISOString(),
      updated_at: course.updatedAt.toISOString(),
    };

    const { error } = await this.supabase
      .from('edu_courses')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      throw this.mapDatabaseError(error, `Failed to save course ${course.id}`);
    }
  }

  public async findCourseById(id: string, tenantId: string): Promise<Course | null> {
    const { data, error } = await this.supabase
      .from('edu_courses')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) {
      throw this.mapDatabaseError(error, `Failed to find course ${id}`);
    }

    if (!data) return null;

    return Course.reconstitute({
      id: data.id,
      tenantId: data.tenant_id,
      courseCode: data.course_code,
      title: data.title,
      status: data.status,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    });
  }

  public async saveEnrollment(enrollment: Enrollment): Promise<void> {
    const payload = {
      id: enrollment.id,
      tenant_id: enrollment.tenantId,
      student_party_id: enrollment.studentPartyId,
      course_id: enrollment.courseId,
      status: enrollment.status,
      enrolled_at: enrollment.enrolledAt.toISOString(),
      created_at: enrollment.createdAt.toISOString(),
      updated_at: enrollment.updatedAt.toISOString(),
    };

    const { error } = await this.supabase
      .from('edu_enrollments')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      throw this.mapDatabaseError(error, `Failed to save enrollment ${enrollment.id}`);
    }
  }

  public async findEnrollmentById(id: string, tenantId: string): Promise<Enrollment | null> {
    const { data, error } = await this.supabase
      .from('edu_enrollments')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) {
      throw this.mapDatabaseError(error, `Failed to find enrollment ${id}`);
    }

    if (!data) return null;

    return Enrollment.reconstitute({
      id: data.id,
      tenantId: data.tenant_id,
      studentPartyId: data.student_party_id,
      courseId: data.course_id,
      status: data.status,
      enrolledAt: new Date(data.enrolled_at),
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    });
  }

  public async findEnrollmentByStudentAndCourse(
    studentPartyId: string,
    courseId: string,
    tenantId: string
  ): Promise<Enrollment | null> {
    const { data, error } = await this.supabase
      .from('edu_enrollments')
      .select('*')
      .eq('student_party_id', studentPartyId)
      .eq('course_id', courseId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) {
      throw this.mapDatabaseError(error, 'Failed to find enrollment by student and course');
    }

    if (!data) return null;

    return Enrollment.reconstitute({
      id: data.id,
      tenantId: data.tenant_id,
      studentPartyId: data.student_party_id,
      courseId: data.course_id,
      status: data.status,
      enrolledAt: new Date(data.enrolled_at),
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    });
  }

  public async verifyStudentRole(
    studentPartyId: string,
    tenantId: string
  ): Promise<{ isValid: boolean; reason?: string }> {
    const { data: party, error } = await this.supabase
      .from('party_parties')
      .select('id, party_type, tenant_id')
      .eq('id', studentPartyId)
      .maybeSingle();

    if (error) {
      throw this.mapDatabaseError(error, `Failed to query student party ${studentPartyId}`);
    }

    if (!party) {
      return { isValid: false, reason: `Party ${studentPartyId} not found` };
    }

    if (party.tenant_id !== tenantId) {
      return { isValid: false, reason: `Party belongs to tenant ${party.tenant_id}, expected ${tenantId}` };
    }

    if (party.party_type !== 'person') {
      return { isValid: false, reason: `Party type must be 'person', received '${party.party_type}'` };
    }

    return { isValid: true };
  }
}
