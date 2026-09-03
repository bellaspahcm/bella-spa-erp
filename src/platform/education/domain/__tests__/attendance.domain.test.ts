/**
 * Education OS — Attendance Domain Tests
 * 
 * Behavioral specification for Attendance aggregate.
 * Canonical schema: edu_attendance (migration 20260813000020)
 */

import { Attendance } from '../attendance.entity';

describe('Education OS — Attendance Aggregate', () => {
  describe('Creation', () => {
    it('should create valid attendance record with present status', () => {
      const attendance = Attendance.create({
        tenantId: 'tenant-edu-1',
        enrollmentId: 'enrollment-123',
        status: 'present',
      });

      expect(attendance.id).toBeDefined();
      expect(attendance.tenantId).toBe('tenant-edu-1');
      expect(attendance.enrollmentId).toBe('enrollment-123');
      expect(attendance.status).toBe('present');
      expect(attendance.rollCallTime).toBeInstanceOf(Date);
      expect(attendance.createdAt).toBeInstanceOf(Date);
      expect(attendance.updatedAt).toBeInstanceOf(Date);
    });

    it('should create attendance with absent status', () => {
      const attendance = Attendance.create({
        tenantId: 'tenant-edu-1',
        enrollmentId: 'enrollment-123',
        status: 'absent',
      });

      expect(attendance.status).toBe('absent');
    });

    it('should create attendance with excused status', () => {
      const attendance = Attendance.create({
        tenantId: 'tenant-edu-1',
        enrollmentId: 'enrollment-123',
        status: 'excused',
      });

      expect(attendance.status).toBe('excused');
    });

    it('should create attendance with explicit roll_call_time', () => {
      const rollCallTime = new Date('2026-09-03T08:00:00Z');
      const attendance = Attendance.create({
        tenantId: 'tenant-edu-1',
        enrollmentId: 'enrollment-123',
        status: 'present',
        rollCallTime,
      });

      expect(attendance.rollCallTime).toEqual(rollCallTime);
    });

    it('should reject attendance without tenantId', () => {
      expect(() => Attendance.create({
        tenantId: '',
        enrollmentId: 'enrollment-123',
        status: 'present',
      })).toThrow('Attendance requires tenantId');
    });

    it('should reject attendance without enrollmentId', () => {
      expect(() => Attendance.create({
        tenantId: 'tenant-edu-1',
        enrollmentId: '',
        status: 'present',
      })).toThrow('Attendance requires enrollmentId');
    });

    it('should reject attendance with invalid status', () => {
      expect(() => Attendance.create({
        tenantId: 'tenant-edu-1',
        enrollmentId: 'enrollment-123',
        status: 'invalid' as any,
      })).toThrow('Invalid attendance status');
    });
  });

  describe('Status Updates', () => {
    it('should update status from present to absent', () => {
      const attendance = Attendance.create({
        tenantId: 'tenant-edu-1',
        enrollmentId: 'enrollment-123',
        status: 'present',
      });

      const beforeUpdate = attendance.updatedAt;
      
      // Wait 1ms to ensure updatedAt changes
      setTimeout(() => {
        attendance.updateStatus('absent');
        expect(attendance.status).toBe('absent');
        expect(attendance.updatedAt.getTime()).toBeGreaterThan(beforeUpdate.getTime());
      }, 1);
    });

    it('should update status to excused', () => {
      const attendance = Attendance.create({
        tenantId: 'tenant-edu-1',
        enrollmentId: 'enrollment-123',
        status: 'absent',
      });

      attendance.updateStatus('excused');
      expect(attendance.status).toBe('excused');
    });

    it('should reject invalid status update', () => {
      const attendance = Attendance.create({
        tenantId: 'tenant-edu-1',
        enrollmentId: 'enrollment-123',
        status: 'present',
      });

      expect(() => attendance.updateStatus('invalid' as any)).toThrow('Invalid attendance status');
    });
  });

  describe('Reconstitution', () => {
    it('should reconstitute attendance from persistence', () => {
      const now = new Date();
      const rollCallTime = new Date('2026-09-03T08:00:00Z');
      
      const attendance = Attendance.reconstitute({
        id: 'attendance-123',
        tenantId: 'tenant-edu-1',
        enrollmentId: 'enrollment-456',
        status: 'present',
        rollCallTime,
        createdAt: now,
        updatedAt: now,
      });

      expect(attendance.id).toBe('attendance-123');
      expect(attendance.tenantId).toBe('tenant-edu-1');
      expect(attendance.enrollmentId).toBe('enrollment-456');
      expect(attendance.status).toBe('present');
      expect(attendance.rollCallTime).toEqual(rollCallTime);
      expect(attendance.createdAt).toEqual(now);
      expect(attendance.updatedAt).toEqual(now);
    });
  });
});
