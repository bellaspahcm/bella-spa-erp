/**
 * Bella Preschool — Actions Unit Tests
 *
 * Tests for preschool management server actions
 */

import { describe, it, expect, beforeAll } from '@jest/globals';

describe('Bella Preschool Actions', () => {
  describe('Student Actions', () => {
    it('should have listStudentsAction function', async () => {
      const { listStudentsAction } = await import('../actions/student-actions');
      expect(typeof listStudentsAction).toBe('function');
    });

    it('should have getStudentAction function', async () => {
      const { getStudentAction } = await import('../actions/student-actions');
      expect(typeof getStudentAction).toBe('function');
    });

    it('should have createStudentAction function', async () => {
      const { createStudentAction } = await import('../actions/student-actions');
      expect(typeof createStudentAction).toBe('function');
    });

    it('should have updateStudentAction function', async () => {
      const { updateStudentAction } = await import('../actions/student-actions');
      expect(typeof updateStudentAction).toBe('function');
    });
  });

  describe('Classroom Actions', () => {
    it('should have listClassroomsAction function', async () => {
      const { listClassroomsAction } = await import('../actions/classroom-actions');
      expect(typeof listClassroomsAction).toBe('function');
    });

    it('should have getClassroomAction function', async () => {
      const { getClassroomAction } = await import('../actions/classroom-actions');
      expect(typeof getClassroomAction).toBe('function');
    });

    it('should have createClassroomAction function', async () => {
      const { createClassroomAction } = await import('../actions/classroom-actions');
      expect(typeof createClassroomAction).toBe('function');
    });

    it('should have enrollStudentAction function', async () => {
      const { enrollStudentAction } = await import('../actions/classroom-actions');
      expect(typeof enrollStudentAction).toBe('function');
    });
  });

  describe('Attendance Actions', () => {
    it('should have listAttendanceAction function', async () => {
      const { listAttendanceAction } = await import('../actions/attendance-actions');
      expect(typeof listAttendanceAction).toBe('function');
    });

    it('should have checkInStudentAction function', async () => {
      const { checkInStudentAction } = await import('../actions/attendance-actions');
      expect(typeof checkInStudentAction).toBe('function');
    });

    it('should have checkOutStudentAction function', async () => {
      const { checkOutStudentAction } = await import('../actions/attendance-actions');
      expect(typeof checkOutStudentAction).toBe('function');
    });

    it('should have markAbsentAction function', async () => {
      const { markAbsentAction } = await import('../actions/attendance-actions');
      expect(typeof markAbsentAction).toBe('function');
    });
  });

  describe('Action Return Types', () => {
    it('should return ActionResult structure from student actions', async () => {
      const { listStudentsAction } = await import('../actions/student-actions');
      // Note: This will fail without auth, but we're testing the structure
      const result = await listStudentsAction();
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
      
      if (!result.success) {
        expect(result).toHaveProperty('error');
        expect(typeof result.error).toBe('string');
      }
    });

    it('should return ActionResult structure from classroom actions', async () => {
      const { listClassroomsAction } = await import('../actions/classroom-actions');
      const result = await listClassroomsAction();
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
      
      if (!result.success) {
        expect(result).toHaveProperty('error');
        expect(typeof result.error).toBe('string');
      }
    });

    it('should return ActionResult structure from attendance actions', async () => {
      const { listAttendanceAction } = await import('../actions/attendance-actions');
      const result = await listAttendanceAction();
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
      
      if (!result.success) {
        expect(result).toHaveProperty('error');
        expect(typeof result.error).toBe('string');
      }
    });
  });

  describe('Validation', () => {
    it('should require tenant context for listStudentsAction', async () => {
      const { listStudentsAction } = await import('../actions/student-actions');
      const result = await listStudentsAction();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      // Platform getCurrentUser returns error when no auth context
      expect(typeof result.error).toBe('string');
    });

    it('should require tenant context for listClassroomsAction', async () => {
      const { listClassroomsAction } = await import('../actions/classroom-actions');
      const result = await listClassroomsAction();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
    });

    it('should require tenant context for listAttendanceAction', async () => {
      const { listAttendanceAction } = await import('../actions/attendance-actions');
      const result = await listAttendanceAction();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
    });
  });
});
