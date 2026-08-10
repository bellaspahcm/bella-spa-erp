/**
 * Student Service - Orchestration Layer
 * 
 * Responsibilities:
 * - Orchestrate aggregate + repository
 * - Validate Person exists before creating Student
 * - NO business logic (belongs in aggregate)
 * 
 * Constitution Compliance:
 * - Law 11: No `any` types
 * - Law 1: Validate Person (aggregate root) before Student
 */

import { StudentAggregate } from './student.aggregate';
import { StudentRepository } from './student.repository';
import { Student, CreateStudentRequest, UpdateStudentRequest } from '../shared-kernel/types';
import { PersonRepository } from '@/platform/host/person/person.repository';
import { createClient } from '@/lib/supabase-server';

export class StudentService {
  /**
   * Create new student
   * Validates Person exists before creating Student
   */
  static async createStudent(request: CreateStudentRequest): Promise<Student> {
    // Validate Person exists (aggregate root must exist first)
    const supabase = await createClient();
    const personRepo = new PersonRepository(supabase);
    const person = await personRepo.findById(request.personId, request.tenantId);
    if (!person) {
      throw new Error(`Person with ID ${request.personId} does not exist`);
    }

    // Create aggregate (business logic + validation)
    const aggregate = StudentAggregate.create(request);
    const student = aggregate.getStudent();

    // Persist to database
    return await StudentRepository.create(student);
  }

  /**
   * Get student by ID
   */
  static async getStudentById(studentId: string, tenantId: string): Promise<Student | null> {
    return await StudentRepository.findById(studentId, tenantId);
  }

  /**
   * Get student by student code
   */
  static async getStudentByCode(studentCode: string, tenantId: string): Promise<Student | null> {
    return await StudentRepository.findByStudentCode(studentCode, tenantId);
  }

  /**
   * Get students by person ID
   */
  static async getStudentsByPersonId(personId: string, tenantId: string): Promise<Student[]> {
    return await StudentRepository.findByPersonId(personId, tenantId);
  }

  /**
   * Get students by program
   */
  static async getStudentsByProgram(
    programId: string,
    tenantId: string,
    options?: { status?: string; limit?: number; offset?: number }
  ): Promise<Student[]> {
    return await StudentRepository.findByProgram(programId, tenantId, options);
  }

  /**
   * Update student
   */
  static async updateStudent(request: UpdateStudentRequest): Promise<Student> {
    // Get existing student
    const existingStudent = await StudentRepository.findById(request.studentId, request.tenantId);
    if (!existingStudent) {
      throw new Error(`Student ${request.studentId} not found`);
    }

    // Apply update via aggregate (business logic + validation)
    const aggregate = StudentAggregate.fromDatabase(existingStudent);
    const updatedAggregate = aggregate.update(request);
    const updatedStudent = updatedAggregate.getStudent();

    // Persist to database
    return await StudentRepository.update(updatedStudent);
  }

  /**
   * Mark student as graduated
   */
  static async graduateStudent(
    studentId: string,
    tenantId: string,
    graduationDate: string,
    updatedBy?: string
  ): Promise<Student> {
    // Get existing student
    const existingStudent = await StudentRepository.findById(studentId, tenantId);
    if (!existingStudent) {
      throw new Error(`Student ${studentId} not found`);
    }

    // Apply graduation via aggregate (business logic)
    const aggregate = StudentAggregate.fromDatabase(existingStudent);
    const graduatedAggregate = aggregate.markGraduated(graduationDate, updatedBy);
    const graduatedStudent = graduatedAggregate.getStudent();

    // Persist to database
    return await StudentRepository.update(graduatedStudent);
  }

  /**
   * Put student on leave
   */
  static async putStudentOnLeave(
    studentId: string,
    tenantId: string,
    updatedBy?: string
  ): Promise<Student> {
    // Get existing student
    const existingStudent = await StudentRepository.findById(studentId, tenantId);
    if (!existingStudent) {
      throw new Error(`Student ${studentId} not found`);
    }

    // Apply leave via aggregate (business logic)
    const aggregate = StudentAggregate.fromDatabase(existingStudent);
    const onLeaveAggregate = aggregate.putOnLeave(updatedBy);
    const onLeaveStudent = onLeaveAggregate.getStudent();

    // Persist to database
    return await StudentRepository.update(onLeaveStudent);
  }

  /**
   * Reinstate student from leave
   */
  static async reinstateStudent(
    studentId: string,
    tenantId: string,
    updatedBy?: string
  ): Promise<Student> {
    // Get existing student
    const existingStudent = await StudentRepository.findById(studentId, tenantId);
    if (!existingStudent) {
      throw new Error(`Student ${studentId} not found`);
    }

    // Apply reinstatement via aggregate (business logic)
    const aggregate = StudentAggregate.fromDatabase(existingStudent);
    const reinstatedAggregate = aggregate.reinstateFromLeave(updatedBy);
    const reinstatedStudent = reinstatedAggregate.getStudent();

    // Persist to database
    return await StudentRepository.update(reinstatedStudent);
  }

  /**
   * Update student academic progress
   */
  static async updateAcademicProgress(
    studentId: string,
    tenantId: string,
    gpa: number,
    totalCredits: number,
    updatedBy?: string
  ): Promise<Student> {
    // Get existing student
    const existingStudent = await StudentRepository.findById(studentId, tenantId);
    if (!existingStudent) {
      throw new Error(`Student ${studentId} not found`);
    }

    // Apply progress update via aggregate (business logic)
    const aggregate = StudentAggregate.fromDatabase(existingStudent);
    const updatedAggregate = aggregate.updateAcademicProgress(gpa, totalCredits, updatedBy);
    const updatedStudent = updatedAggregate.getStudent();

    // Persist to database
    return await StudentRepository.update(updatedStudent);
  }

  /**
   * Delete student
   */
  static async deleteStudent(studentId: string, tenantId: string): Promise<void> {
    await StudentRepository.delete(studentId, tenantId);
  }

  /**
   * Count students by status
   */
  static async countStudents(tenantId: string, status?: string): Promise<number> {
    return await StudentRepository.countByStatus(tenantId, status);
  }

  /**
   * Check if student code exists
   */
  static async studentCodeExists(studentCode: string, tenantId: string): Promise<boolean> {
    return await StudentRepository.existsByStudentCode(studentCode, tenantId);
  }
}
