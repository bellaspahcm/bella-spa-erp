/**
 * Attendance Service
 * 
 * Orchestrates attendance business logic with repository
 * 
 * Pattern: Inherited from Course service
 */

import {
  recordAttendance,
  updateAttendance as updateAttendanceAggregate,
  markPresent,
  markAbsent,
  markLate,
  markExcused,
  verifyAttendance as verifyAttendanceAggregate,
  calculateAttendanceSummary as calculateSummary,
  meetsAttendanceRequirement as checkRequirement,
  canModifyAttendance,
} from './attendance.aggregate';
import { createAttendanceRepository } from './attendance.repository';
import type {
  Attendance,
  AttendanceResult,
  AttendanceListResult,
  CreateAttendanceRequest,
  UpdateAttendanceRequest,
  MarkAttendanceRequest,
  AttendanceFilters,
  AttendanceSummary,
} from '../shared-kernel/attendance-types';

// ============================================================================
// Service Implementation
// ============================================================================

export class AttendanceService {
  private static repository = createAttendanceRepository();

  /**
   * Record attendance for a student
   */
  static async recordAttendance(request: CreateAttendanceRequest): Promise<AttendanceResult> {
    try {
      // Check if attendance already exists
      const existing = await this.repository.findByStudentAndCourseAndDate(
        request.studentId,
        request.courseId,
        request.sessionDate,
        request.tenantId
      );

      if (existing) {
        return {
          success: false,
          error: 'Attendance already recorded for this session',
        };
      }

      // Create attendance aggregate
      const attendance = recordAttendance(request);

      // Save to repository
      const created = await this.repository.create(attendance);

      return {
        success: true,
        attendance: created,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Bulk record attendance for multiple students
   */
  static async markAttendance(request: MarkAttendanceRequest): Promise<AttendanceResult> {
    try {
      const results: Attendance[] = [];
      const errors: string[] = [];

      for (const studentAttendance of request.studentAttendance) {
        const attendanceRequest: CreateAttendanceRequest = {
          tenantId: request.tenantId,
          studentId: studentAttendance.studentId,
          courseId: request.courseId,
          sessionDate: request.sessionDate,
          sessionNumber: request.sessionNumber,
          status: studentAttendance.status,
          checkInTime: studentAttendance.checkInTime,
          minutesLate: studentAttendance.minutesLate,
          notes: studentAttendance.notes,
          createdBy: request.createdBy,
        };

        const result = await this.recordAttendance(attendanceRequest);

        if (result.success && result.attendance) {
          results.push(result.attendance);
        } else {
          errors.push(`Student ${studentAttendance.studentId}: ${result.error}`);
        }
      }

      if (errors.length > 0) {
        return {
          success: false,
          error: `Failed to record some attendances: ${errors.join('; ')}`,
        };
      }

      return {
        success: true,
        attendance: results[0], // Return first for compatibility
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update attendance
   */
  static async updateAttendance(request: UpdateAttendanceRequest): Promise<AttendanceResult> {
    try {
      // Get existing attendance
      const existing = await this.repository.findById(request.attendanceId, request.tenantId);

      if (!existing) {
        return {
          success: false,
          error: 'Attendance not found',
        };
      }

      // Check if can modify
      if (!canModifyAttendance(existing)) {
        return {
          success: false,
          error: 'Cannot modify verified or old attendance records',
        };
      }

      // Update aggregate
      const updated = updateAttendanceAggregate(existing, request);

      // Save to repository
      const saved = await this.repository.update(request.attendanceId, request.tenantId, updated);

      return {
        success: true,
        attendance: saved,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Mark attendance as present
   */
  static async markPresent(
    attendanceId: string,
    tenantId: string,
    userId: string,
    checkInTime?: string
  ): Promise<AttendanceResult> {
    try {
      const existing = await this.repository.findById(attendanceId, tenantId);

      if (!existing) {
        return {
          success: false,
          error: 'Attendance not found',
        };
      }

      const updated = markPresent(existing, userId, checkInTime);
      const saved = await this.repository.update(attendanceId, tenantId, updated);

      return {
        success: true,
        attendance: saved,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Mark attendance as absent
   */
  static async markAbsent(
    attendanceId: string,
    tenantId: string,
    userId: string,
    notes?: string
  ): Promise<AttendanceResult> {
    try {
      const existing = await this.repository.findById(attendanceId, tenantId);

      if (!existing) {
        return {
          success: false,
          error: 'Attendance not found',
        };
      }

      const updated = markAbsent(existing, userId, notes);
      const saved = await this.repository.update(attendanceId, tenantId, updated);

      return {
        success: true,
        attendance: saved,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Mark attendance as late
   */
  static async markLate(
    attendanceId: string,
    tenantId: string,
    userId: string,
    minutesLate: number,
    checkInTime?: string
  ): Promise<AttendanceResult> {
    try {
      const existing = await this.repository.findById(attendanceId, tenantId);

      if (!existing) {
        return {
          success: false,
          error: 'Attendance not found',
        };
      }

      const updated = markLate(existing, userId, minutesLate, checkInTime);
      const saved = await this.repository.update(attendanceId, tenantId, updated);

      return {
        success: true,
        attendance: saved,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Mark attendance as excused
   */
  static async markExcused(
    attendanceId: string,
    tenantId: string,
    userId: string,
    excuseReason: string,
    excuseDocumentUrl?: string
  ): Promise<AttendanceResult> {
    try {
      const existing = await this.repository.findById(attendanceId, tenantId);

      if (!existing) {
        return {
          success: false,
          error: 'Attendance not found',
        };
      }

      const updated = markExcused(existing, userId, excuseReason, excuseDocumentUrl);
      const saved = await this.repository.update(attendanceId, tenantId, updated);

      return {
        success: true,
        attendance: saved,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Verify attendance
   */
  static async verifyAttendance(
    attendanceId: string,
    tenantId: string,
    userId: string
  ): Promise<AttendanceResult> {
    try {
      const existing = await this.repository.findById(attendanceId, tenantId);

      if (!existing) {
        return {
          success: false,
          error: 'Attendance not found',
        };
      }

      const updated = verifyAttendanceAggregate(existing, userId);
      const saved = await this.repository.update(attendanceId, tenantId, updated);

      return {
        success: true,
        attendance: saved,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get attendance by ID
   */
  static async getAttendanceById(
    attendanceId: string,
    tenantId: string
  ): Promise<AttendanceResult> {
    try {
      const attendance = await this.repository.findById(attendanceId, tenantId);

      if (!attendance) {
        return {
          success: false,
          error: 'Attendance not found',
        };
      }

      return {
        success: true,
        attendance,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Query attendances
   */
  static async queryAttendances(filters: AttendanceFilters): Promise<AttendanceListResult> {
    try {
      const attendances = await this.repository.findAll(filters);

      return {
        success: true,
        attendances,
        total: attendances.length,
      };
    } catch (error) {
      return {
        success: false,
        attendances: [],
        total: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get attendance summary for student in course
   */
  static async getAttendanceSummary(
    studentId: string,
    courseId: string,
    tenantId: string
  ): Promise<{ success: boolean; summary?: AttendanceSummary; error?: string }> {
    try {
      const result = await this.queryAttendances({
        tenantId,
        studentId,
        courseId,
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error,
        };
      }

      const summary = calculateSummary(studentId, courseId, result.attendances);

      return {
        success: true,
        summary,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if student meets attendance requirement
   */
  static async meetsAttendanceRequirement(
    studentId: string,
    courseId: string,
    tenantId: string,
    minimumPercentage: number
  ): Promise<{ success: boolean; meets?: boolean; error?: string }> {
    try {
      const summaryResult = await this.getAttendanceSummary(studentId, courseId, tenantId);

      if (!summaryResult.success || !summaryResult.summary) {
        return {
          success: false,
          error: summaryResult.error,
        };
      }

      const meets = checkRequirement(summaryResult.summary, minimumPercentage);

      return {
        success: true,
        meets,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Delete attendance
   */
  static async deleteAttendance(
    attendanceId: string,
    tenantId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = await this.repository.findById(attendanceId, tenantId);

      if (!existing) {
        return {
          success: false,
          error: 'Attendance not found',
        };
      }

      if (!canModifyAttendance(existing)) {
        return {
          success: false,
          error: 'Cannot delete verified or old attendance records',
        };
      }

      await this.repository.delete(attendanceId, tenantId);

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
