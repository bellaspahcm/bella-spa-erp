/**
 * Education OS — Assessment Domain Tests
 * 
 * Behavioral specification for Assessment aggregate.
 * Canonical schema: edu_assessments (migration 20260813000020)
 */

import { Assessment } from '../assessment.entity';

describe('Education OS — Assessment Aggregate', () => {
  describe('Creation', () => {
    it('should create valid assessment with quiz type', () => {
      const assessment = Assessment.create({
        tenantId: 'tenant-edu-1',
        enrollmentId: 'enrollment-123',
        scoreType: 'quiz',
        grade: 85.5,
        weight: 0.1,
      });

      expect(assessment.id).toBeDefined();
      expect(assessment.tenantId).toBe('tenant-edu-1');
      expect(assessment.enrollmentId).toBe('enrollment-123');
      expect(assessment.scoreType).toBe('quiz');
      expect(assessment.grade).toBe(85.5);
      expect(assessment.weight).toBe(0.1);
      expect(assessment.occurredAt).toBeInstanceOf(Date);
      expect(assessment.createdAt).toBeInstanceOf(Date);
      expect(assessment.updatedAt).toBeInstanceOf(Date);
    });

    it('should create assessment with midterm type', () => {
      const assessment = Assessment.create({
        tenantId: 'tenant-edu-1',
        enrollmentId: 'enrollment-123',
        scoreType: 'midterm',
        grade: 78.0,
        weight: 0.3,
      });

      expect(assessment.scoreType).toBe('midterm');
    });

    it('should create assessment with final type', () => {
      const assessment = Assessment.create({
        tenantId: 'tenant-edu-1',
        enrollmentId: 'enrollment-123',
        scoreType: 'final',
        grade: 92.0,
        weight: 0.5,
      });

      expect(assessment.scoreType).toBe('final');
    });

    it('should create assessment with homework type', () => {
      const assessment = Assessment.create({
        tenantId: 'tenant-edu-1',
        enrollmentId: 'enrollment-123',
        scoreType: 'homework',
        grade: 100.0,
        weight: 0.1,
      });

      expect(assessment.scoreType).toBe('homework');
    });

    it('should create assessment with explicit occurred_at', () => {
      const occurredAt = new Date('2026-09-03T10:00:00Z');
      const assessment = Assessment.create({
        tenantId: 'tenant-edu-1',
        enrollmentId: 'enrollment-123',
        scoreType: 'quiz',
        grade: 85.0,
        weight: 0.1,
        occurredAt,
      });

      expect(assessment.occurredAt).toEqual(occurredAt);
    });

    it('should reject assessment without tenantId', () => {
      expect(() => Assessment.create({
        tenantId: '',
        enrollmentId: 'enrollment-123',
        scoreType: 'quiz',
        grade: 85.0,
        weight: 0.1,
      })).toThrow('Assessment requires tenantId');
    });

    it('should reject assessment without enrollmentId', () => {
      expect(() => Assessment.create({
        tenantId: 'tenant-edu-1',
        enrollmentId: '',
        scoreType: 'quiz',
        grade: 85.0,
        weight: 0.1,
      })).toThrow('Assessment requires enrollmentId');
    });

    it('should reject assessment with invalid scoreType', () => {
      expect(() => Assessment.create({
        tenantId: 'tenant-edu-1',
        enrollmentId: 'enrollment-123',
        scoreType: 'invalid' as any,
        grade: 85.0,
        weight: 0.1,
      })).toThrow('Invalid score type');
    });

    it('should reject assessment with negative grade', () => {
      expect(() => Assessment.create({
        tenantId: 'tenant-edu-1',
        enrollmentId: 'enrollment-123',
        scoreType: 'quiz',
        grade: -10.0,
        weight: 0.1,
      })).toThrow('Grade must be between 0 and 100');
    });

    it('should reject assessment with grade over 100', () => {
      expect(() => Assessment.create({
        tenantId: 'tenant-edu-1',
        enrollmentId: 'enrollment-123',
        scoreType: 'quiz',
        grade: 105.0,
        weight: 0.1,
      })).toThrow('Grade must be between 0 and 100');
    });

    it('should reject assessment with negative weight', () => {
      expect(() => Assessment.create({
        tenantId: 'tenant-edu-1',
        enrollmentId: 'enrollment-123',
        scoreType: 'quiz',
        grade: 85.0,
        weight: -0.1,
      })).toThrow('Weight must be between 0 and 1');
    });

    it('should reject assessment with weight over 1', () => {
      expect(() => Assessment.create({
        tenantId: 'tenant-edu-1',
        enrollmentId: 'enrollment-123',
        scoreType: 'quiz',
        grade: 85.0,
        weight: 1.5,
      })).toThrow('Weight must be between 0 and 1');
    });

    it('should accept edge case: grade = 0', () => {
      const assessment = Assessment.create({
        tenantId: 'tenant-edu-1',
        enrollmentId: 'enrollment-123',
        scoreType: 'quiz',
        grade: 0,
        weight: 0.1,
      });

      expect(assessment.grade).toBe(0);
    });

    it('should accept edge case: grade = 100', () => {
      const assessment = Assessment.create({
        tenantId: 'tenant-edu-1',
        enrollmentId: 'enrollment-123',
        scoreType: 'quiz',
        grade: 100,
        weight: 0.1,
      });

      expect(assessment.grade).toBe(100);
    });

    it('should accept edge case: weight = 0', () => {
      const assessment = Assessment.create({
        tenantId: 'tenant-edu-1',
        enrollmentId: 'enrollment-123',
        scoreType: 'quiz',
        grade: 85.0,
        weight: 0,
      });

      expect(assessment.weight).toBe(0);
    });

    it('should accept edge case: weight = 1', () => {
      const assessment = Assessment.create({
        tenantId: 'tenant-edu-1',
        enrollmentId: 'enrollment-123',
        scoreType: 'final',
        grade: 85.0,
        weight: 1.0,
      });

      expect(assessment.weight).toBe(1.0);
    });
  });

  describe('Reconstitution', () => {
    it('should reconstitute assessment from persistence', () => {
      const now = new Date();
      const occurredAt = new Date('2026-09-03T10:00:00Z');
      
      const assessment = Assessment.reconstitute({
        id: 'assessment-123',
        tenantId: 'tenant-edu-1',
        enrollmentId: 'enrollment-456',
        scoreType: 'midterm',
        grade: 88.5,
        weight: 0.3,
        occurredAt,
        createdAt: now,
        updatedAt: now,
      });

      expect(assessment.id).toBe('assessment-123');
      expect(assessment.tenantId).toBe('tenant-edu-1');
      expect(assessment.enrollmentId).toBe('enrollment-456');
      expect(assessment.scoreType).toBe('midterm');
      expect(assessment.grade).toBe(88.5);
      expect(assessment.weight).toBe(0.3);
      expect(assessment.occurredAt).toEqual(occurredAt);
      expect(assessment.createdAt).toEqual(now);
      expect(assessment.updatedAt).toEqual(now);
    });
  });
});
