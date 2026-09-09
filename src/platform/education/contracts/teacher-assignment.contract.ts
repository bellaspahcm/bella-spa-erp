/**
 * Education OS — Teacher Assignment Public Contract Interface
 * 
 * Provides strict public contracts for assigning teachers to course/classrooms,
 * preventing lead teacher conflicts, and querying teacher rosters.
 * Canonical persistence: teacher_assignments table.
 * 
 * @module platform/education/contracts/teacher-assignment.contract
 */

import { TeacherRole, TeacherAssignmentStatus } from '../domain/teacher-assignment.entity';

export interface TeacherAssignmentDTO {
  readonly assignmentId: string;
  readonly tenantId: string;
  readonly courseId: string;
  readonly teacherPartyId: string;
  readonly role: TeacherRole;
  readonly academicYear: string;
  readonly effectiveStartDate: string;
  readonly effectiveEndDate: string | null;
  readonly status: TeacherAssignmentStatus;
}

export interface AssignTeacherInput {
  readonly tenantId: string;
  readonly courseId: string;
  readonly teacherPartyId: string;
  readonly role: TeacherRole;
  readonly academicYear: string;
  readonly effectiveStartDate?: string;
}

export interface TerminateTeacherAssignmentInput {
  readonly tenantId: string;
  readonly assignmentId: string;
  readonly endDate?: string;
}

export interface ITeacherAssignmentContract {
  assignTeacher(input: AssignTeacherInput): Promise<TeacherAssignmentDTO>;
  terminateAssignment(input: TerminateTeacherAssignmentInput): Promise<TeacherAssignmentDTO>;
  getCourseTeachers(tenantId: string, courseId: string, academicYear?: string): Promise<readonly TeacherAssignmentDTO[]>;
  getTeacherAssignments(tenantId: string, teacherPartyId: string, academicYear?: string): Promise<readonly TeacherAssignmentDTO[]>;
}
