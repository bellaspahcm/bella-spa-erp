/**
 * Enrollment Service - Orchestration Layer
 */

import { EnrollmentAggregate } from './enrollment.aggregate';
import { EnrollmentRepository } from './enrollment.repository';
import { Enrollment, CreateEnrollmentRequest, UpdateEnrollmentRequest } from '../shared-kernel/enrollment-types';
import { StudentRepository } from '../student/student.repository';

export class EnrollmentService {
  /**
   * Create new enrollment
   * Validates Student exists before creating Enrollment
   */
  static async createEnrollment(request: CreateEnrollmentRequest): Promise<Enrollment> {
    // Validate Student exists
    const student = await StudentRepository.findById(request.studentId, request.tenantId);
    if (!student) {
      throw new Error(`Student with ID ${request.studentId} does not exist`);
    }

    // Business rule: Cannot enroll inactive/graduated student
    if (student.academicStatus === 'graduated') {
      throw new Error('Cannot enroll graduated student');
    }
    if (student.academicStatus === 'expelled') {
      throw new Error('Cannot enroll expelled student');
    }

    // Create aggregate (business logic + validation)
    const aggregate = EnrollmentAggregate.create(request);
    const enrollment = aggregate.getEnrollment();

    // Persist to database (will validate Course FK at DB level)
    return await EnrollmentRepository.create(enrollment);
  }

  static async getEnrollmentById(enrollmentId: string, tenantId: string): Promise<Enrollment | null> {
    return await EnrollmentRepository.findById(enrollmentId, tenantId);
  }

  static async getEnrollmentsByStudent(studentId: string, tenantId: string): Promise<Enrollment[]> {
    return await EnrollmentRepository.findByStudent(studentId, tenantId);
  }

  static async getEnrollmentsByCourse(courseId: string, tenantId: string): Promise<Enrollment[]> {
    return await EnrollmentRepository.findByCourse(courseId, tenantId);
  }

  static async updateEnrollment(request: UpdateEnrollmentRequest): Promise<Enrollment> {
    const existing = await EnrollmentRepository.findById(request.enrollmentId, request.tenantId);
    if (!existing) {
      throw new Error('Enrollment not found');
    }

    const aggregate = EnrollmentAggregate.fromDatabase(existing);
    const updated = aggregate.update(request);
    return await EnrollmentRepository.update(updated.getEnrollment());
  }

  static async activateEnrollment(
    enrollmentId: string,
    tenantId: string,
    updatedBy?: string
  ): Promise<Enrollment> {
    const existing = await EnrollmentRepository.findById(enrollmentId, tenantId);
    if (!existing) {
      throw new Error('Enrollment not found');
    }

    const aggregate = EnrollmentAggregate.fromDatabase(existing);
    const activated = aggregate.activate(updatedBy);
    return await EnrollmentRepository.update(activated.getEnrollment());
  }

  static async completeEnrollment(
    enrollmentId: string,
    tenantId: string,
    completionDate: string,
    updatedBy?: string
  ): Promise<Enrollment> {
    const existing = await EnrollmentRepository.findById(enrollmentId, tenantId);
    if (!existing) {
      throw new Error('Enrollment not found');
    }

    const aggregate = EnrollmentAggregate.fromDatabase(existing);
    const completed = aggregate.complete(completionDate, updatedBy);
    return await EnrollmentRepository.update(completed.getEnrollment());
  }

  static async withdrawEnrollment(
    enrollmentId: string,
    tenantId: string,
    withdrawalDate: string,
    updatedBy?: string
  ): Promise<Enrollment> {
    const existing = await EnrollmentRepository.findById(enrollmentId, tenantId);
    if (!existing) {
      throw new Error('Enrollment not found');
    }

    const aggregate = EnrollmentAggregate.fromDatabase(existing);
    const withdrawn = aggregate.withdraw(withdrawalDate, updatedBy);
    return await EnrollmentRepository.update(withdrawn.getEnrollment());
  }

  static async assignGrade(
    enrollmentId: string,
    tenantId: string,
    grade: string,
    gradePoints: number,
    creditsEarned: number,
    updatedBy?: string
  ): Promise<Enrollment> {
    const existing = await EnrollmentRepository.findById(enrollmentId, tenantId);
    if (!existing) {
      throw new Error('Enrollment not found');
    }

    const aggregate = EnrollmentAggregate.fromDatabase(existing);
    const graded = aggregate.assignGrade(grade, gradePoints, creditsEarned, updatedBy);
    return await EnrollmentRepository.update(graded.getEnrollment());
  }

  static async deleteEnrollment(enrollmentId: string, tenantId: string): Promise<void> {
    await EnrollmentRepository.delete(enrollmentId, tenantId);
  }
}
