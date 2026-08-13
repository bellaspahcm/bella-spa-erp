/**
 * Education OS — Repository Interface
 * 
 * Defines persistence contracts for Course and Enrollment aggregate roots.
 * 
 * @module platform/education/repositories/education-repository.interface
 */

import { Course } from '../domain/course.entity';
import { Enrollment } from '../domain/enrollment.entity';

export interface IEducationRepository {
  saveCourse(course: Course): Promise<void>;
  findCourseById(id: string, tenantId: string): Promise<Course | null>;
  findCourseByCode(courseCode: string, tenantId: string): Promise<Course | null>;
  saveEnrollment(enrollment: Enrollment): Promise<void>;
  findEnrollmentById(id: string, tenantId: string): Promise<Enrollment | null>;
  findEnrollmentByStudentAndCourse(studentPartyId: string, courseId: string, tenantId: string): Promise<Enrollment | null>;
  verifyStudentRole(studentPartyId: string, tenantId: string): Promise<{ isValid: boolean; reason?: string }>;
  getStudentScores(studentPartyId: string, tenantId: string): Promise<Array<{ courseId: string; score: number }>>;
  getActiveEnrollmentsCount(studentPartyId: string, tenantId: string): Promise<number>;
  executeEnrollStudentTransaction(params: {
    tenantId: string;
    studentPartyId: string;
    courseId: string;
    enrollmentId: string;
    requestId: string;
  }): Promise<{ isDuplicate: boolean; enrollmentId: string }>;
}
