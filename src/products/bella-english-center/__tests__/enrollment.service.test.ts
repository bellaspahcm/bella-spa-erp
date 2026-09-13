/**
 * E2 — English Center Enrollment Service Tests
 */

import { EnglishCenterEnrollmentService } from '../services/enrollment.service';
import { SupabaseClient } from '@supabase/supabase-js';

// Mock Platform Enrollment Contract
jest.mock('@/platform/education/contracts/enrollment.contract.impl', () => ({
  EnrollmentContractImpl: jest.fn().mockImplementation(() => ({
    enrollStudent: jest.fn().mockResolvedValue({
      id: 'canonical-enrollment-123',
      tenantId: 'tenant-1',
      studentPartyId: 'student-1',
      courseId: 'course-1',
      status: 'active',
      enrolledAt: '2026-09-13T10:00:00Z',
    }),
    getEnrollment: jest.fn().mockResolvedValue({
      id: 'canonical-enrollment-123',
      tenantId: 'tenant-1',
      studentPartyId: 'student-1',
      courseId: 'course-1',
      status: 'active',
      enrolledAt: '2026-09-13T10:00:00Z',
    }),
  })),
}));

// Mock Supabase client
const createMockSupabase = () => {
  const mockSupabase = {
    from: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    range: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
  } as unknown as SupabaseClient;

  return mockSupabase;
};

describe('EnglishCenterEnrollmentService', () => {
  let service: EnglishCenterEnrollmentService;
  let mockSupabase: SupabaseClient;

  beforeEach(() => {
    mockSupabase = createMockSupabase();
    service = new EnglishCenterEnrollmentService(mockSupabase);
    jest.clearAllMocks();
  });

  describe('createEnrollment', () => {
    it('should create enrollment via Platform contract and create extension', async () => {
      const mockExtension = {
        id: 'english-enrollment-1',
        tenant_id: 'tenant-1',
        canonical_enrollment_id: 'canonical-enrollment-123',
        branch_id: 'branch-1',
        program_id: 'program-1',
        class_id: null,
        intake: '2026-Q3',
        english_level_at_enrollment: 'B1',
        metadata: {},
        created_at: '2026-09-13T10:00:00Z',
        updated_at: '2026-09-13T10:00:00Z',
      };

      (mockSupabase.single as jest.Mock).mockResolvedValueOnce({
        data: mockExtension,
        error: null,
      });

      const result = await service.createEnrollment('tenant-1', {
        studentPartyId: 'student-1',
        courseId: 'course-1',
        branchId: 'branch-1',
        programId: 'program-1',
        intake: '2026-Q3',
        englishLevelAtEnrollment: 'B1',
      });

      expect(result).toMatchObject({
        id: 'english-enrollment-1',
        tenantId: 'tenant-1',
        canonicalEnrollmentId: 'canonical-enrollment-123',
        branchId: 'branch-1',
        enrollmentStatus: 'active',
        studentPartyId: 'student-1',
        courseId: 'course-1',
      });
    });

    it('should throw error if Platform enrollment fails', async () => {
      const mockError = new Error('Platform enrollment failed');
      jest.spyOn(service['enrollmentContract'], 'enrollStudent').mockRejectedValueOnce(mockError);

      await expect(
        service.createEnrollment('tenant-1', {
          studentPartyId: 'student-1',
          courseId: 'course-1',
          branchId: 'branch-1',
        })
      ).rejects.toThrow('Platform enrollment failed');
    });
  });

  describe('getEnrollment', () => {
    it('should fetch enrollment with canonical data', async () => {
      const mockExtension = {
        id: 'english-enrollment-1',
        tenant_id: 'tenant-1',
        canonical_enrollment_id: 'canonical-enrollment-123',
        branch_id: 'branch-1',
        program_id: null,
        class_id: null,
        intake: null,
        english_level_at_enrollment: null,
        metadata: {},
        created_at: '2026-09-13T10:00:00Z',
        updated_at: '2026-09-13T10:00:00Z',
      };

      (mockSupabase.single as jest.Mock).mockResolvedValueOnce({
        data: mockExtension,
        error: null,
      });

      const result = await service.getEnrollment('tenant-1', 'english-enrollment-1');

      expect(result).toMatchObject({
        id: 'english-enrollment-1',
        enrollmentStatus: 'active',
        studentPartyId: 'student-1',
        courseId: 'course-1',
      });
    });

    it('should return null if enrollment not found', async () => {
      (mockSupabase.single as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });

      const result = await service.getEnrollment('tenant-1', 'nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('listEnrollments', () => {
    it('should list enrollments with branch filter', async () => {
      const mockExtensions = [
        {
          id: 'english-enrollment-1',
          tenant_id: 'tenant-1',
          canonical_enrollment_id: 'canonical-1',
          branch_id: 'branch-1',
          program_id: null,
          class_id: null,
          intake: null,
          english_level_at_enrollment: null,
          metadata: {},
          created_at: '2026-09-13T10:00:00Z',
          updated_at: '2026-09-13T10:00:00Z',
        },
      ];

      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockExtensions,
          error: null,
          count: 1,
        }),
      });

      const result = await service.listEnrollments('tenant-1', {
        branchId: 'branch-1',
        limit: 20,
        offset: 0,
      });

      expect(result.enrollments).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('updateEnrollmentContext', () => {
    it('should update English Center context only', async () => {
      const mockExtension = {
        id: 'english-enrollment-1',
        tenant_id: 'tenant-1',
        canonical_enrollment_id: 'canonical-enrollment-123',
        branch_id: 'branch-1',
        program_id: 'program-1',
        class_id: 'class-1',
        intake: null,
        english_level_at_enrollment: null,
        metadata: { updated: true },
        created_at: '2026-09-13T10:00:00Z',
        updated_at: '2026-09-13T10:01:00Z',
      };

      (mockSupabase.single as jest.Mock).mockResolvedValueOnce({
        data: mockExtension,
        error: null,
      });

      const result = await service.updateEnrollmentContext('tenant-1', 'english-enrollment-1', {
        classId: 'class-1',
        metadata: { updated: true },
      });

      expect(result.classId).toBe('class-1');
      expect(result.metadata).toEqual({ updated: true });
    });
  });

  describe('activateEnrollment', () => {
    it('should delegate activation to Platform contract', async () => {
      const mockExtension = {
        id: 'english-enrollment-1',
        tenant_id: 'tenant-1',
        canonical_enrollment_id: 'canonical-enrollment-123',
        branch_id: 'branch-1',
        program_id: null,
        class_id: null,
        intake: null,
        english_level_at_enrollment: null,
        metadata: {},
        created_at: '2026-09-13T10:00:00Z',
        updated_at: '2026-09-13T10:00:00Z',
      };

      (mockSupabase.single as jest.Mock).mockResolvedValueOnce({
        data: mockExtension,
        error: null,
      });

      const result = await service.activateEnrollment('tenant-1', 'english-enrollment-1');

      expect(result.enrollmentStatus).toBe('active');
    });

    it('should throw error if already active', async () => {
      const mockExtension = {
        id: 'english-enrollment-1',
        tenant_id: 'tenant-1',
        canonical_enrollment_id: 'canonical-enrollment-123',
        branch_id: 'branch-1',
        program_id: null,
        class_id: null,
        intake: null,
        english_level_at_enrollment: null,
        metadata: {},
        created_at: '2026-09-13T10:00:00Z',
        updated_at: '2026-09-13T10:00:00Z',
      };

      (mockSupabase.single as jest.Mock).mockResolvedValueOnce({
        data: mockExtension,
        error: null,
      });

      await expect(service.activateEnrollment('tenant-1', 'english-enrollment-1')).rejects.toThrow(
        'Enrollment already active'
      );
    });
  });
});
