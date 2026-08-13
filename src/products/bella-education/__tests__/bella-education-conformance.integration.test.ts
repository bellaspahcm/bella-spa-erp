/**
 * BELLA EDUCATION — RUNTIME CONFORMANCE INTEGRATION TEST SUITE
 *
 * Verifies that the Bella Education product services satisfy the OS integration requirements:
 * - Gate 1: Manifest Alignment & Source of Truth
 * - Gate 2: Contract-Only Dependency Injection
 * - Gate 3: Tenant Isolation Boundary
 * - Gate 7: Prerequisite Overrides (Governed Overrides)
 * - Gate 10: Tuition Fee Ledger Posting (Double-entry Ledger)
 *
 * @module src/products/bella-education/__tests__/bella-education-conformance.integration.test
 */

import { CourseCatalogProductService } from '../services/course-catalog.service';
import { EnrollmentProductService } from '../services/enrollment.service';
import { AttendanceProductService } from '../services/attendance.service';
import { AssessmentProductService } from '../services/assessment.service';
import { bellaEducationManifest } from '../manifest';

describe('BELLA EDUCATION V1 — RUNTIME CONFORMANCE INTEGRATION TESTS', () => {
  let catalogService: CourseCatalogProductService;
  let enrollmentService: EnrollmentProductService;
  let attendanceService: AttendanceProductService;
  let assessmentService: AssessmentProductService;

  const mockCourseContract: any = {
    listCourses: jest.fn().mockResolvedValue([
      { id: 'course-101', tenantId: 'tenant-edu-1', courseCode: 'CSE-101', title: 'Intro to Programming', status: 'active', prerequisites: [] }
    ])
  };

  const mockEnrollmentContract: any = {
    enrollStudent: jest.fn().mockImplementation((req) => {
      if (req.courseId === 'course-adv' && !req.overrideJustification) {
        return Promise.reject(new Error('Prerequisite check failed. Missing prerequisite courses: CSE-101'));
      }
      return Promise.resolve({
        id: 'enroll-101',
        tenantId: req.tenantId,
        studentPartyId: req.studentPartyId,
        courseId: req.courseId,
        status: 'active',
        enrolledAt: new Date().toISOString()
      });
    }),
    getEnrollment: jest.fn()
  };

  const mockAttendanceContract: any = {
    recordAttendance: jest.fn().mockResolvedValue({
      id: 'att-101',
      tenantId: 'tenant-edu-1',
      enrollmentId: 'enroll-101',
      status: 'present',
      rollCallTime: new Date().toISOString()
    })
  };

  const mockAssessmentContract: any = {
    recordScore: jest.fn().mockResolvedValue({
      id: 'score-101',
      tenantId: 'tenant-edu-1',
      enrollmentId: 'enroll-101',
      scoreType: 'midterm',
      grade: 9.0,
      weight: 30,
      occurredAt: new Date().toISOString()
    }),
    calculateGpa: jest.fn().mockResolvedValue(9.0)
  };

  const mockAccountingContract: any = {
    postJournalEntry: jest.fn().mockImplementation((req) => {
      if (req.referenceId === 'enroll-ledger-fail') {
        return Promise.resolve({ success: false, error: 'BALANCE_VIOLATION' });
      }
      return Promise.resolve({ success: true, entryId: 'jr-101' });
    })
  };

  beforeEach(() => {
    jest.clearAllMocks();
    catalogService = new CourseCatalogProductService(mockCourseContract);
    enrollmentService = new EnrollmentProductService(mockEnrollmentContract, mockAccountingContract);
    attendanceService = new AttendanceProductService(mockAttendanceContract);
    assessmentService = new AssessmentProductService(mockAssessmentContract);
  });

  // Gate 1: Manifest Alignment
  test('Gate 1: Manifest lists all enabled capabilities and workflows', () => {
    expect(bellaEducationManifest.id).toBe('bella-education');
    expect(bellaEducationManifest.capabilities).toContain('course_catalog_query');
    expect(bellaEducationManifest.capabilities).toContain('student_enrollment_command');
    expect(bellaEducationManifest.capabilities).toContain('attendance_checkpoint_command');
    expect(bellaEducationManifest.capabilities).toContain('grade_reporting_command');
    expect(bellaEducationManifest.workflows).toContain('student_academic_lifecycle');
  });

  // Gate 2: Contract Dependency Injection
  test('Gate 2: Product services only invoke public Kernel contracts', async () => {
    const courses = await catalogService.getCourses('tenant-edu-1');
    expect(courses.length).toBe(1);
    expect(courses[0].id).toBe('course-101');
    expect(mockCourseContract.listCourses).toHaveBeenCalledWith('tenant-edu-1');
  });

  // Gate 3: Tenant Isolation Boundary
  test('Gate 3: Throws error when tenantId is empty (tenant boundary isolation)', async () => {
    await expect(
      catalogService.getCourses('')
    ).rejects.toThrow('TENANT_ISOLATION_VIOLATION');

    await expect(
      enrollmentService.enrollStudent({
        tenantId: '',
        studentPartyId: 'person-101',
        courseId: 'course-101',
        requestId: 'req-1'
      })
    ).rejects.toThrow('TENANT_ISOLATION_VIOLATION');
  });

  // Gate 7: Prerequisite Overrides (Governed Overrides)
  test('Gate 7: Prerequisite check blocks enrollment unless override justification is supplied', async () => {
    // Missing prerequisite without override triggers error
    await expect(
      enrollmentService.enrollStudent({
        tenantId: 'tenant-edu-1',
        studentPartyId: 'person-101',
        courseId: 'course-adv',
        requestId: 'req-1'
      })
    ).rejects.toThrow('Prerequisite check failed');

    // Works with override justification
    const enrollment = await enrollmentService.enrollStudent({
      tenantId: 'tenant-edu-1',
      studentPartyId: 'person-101',
      courseId: 'course-adv',
      requestId: 'req-2',
      overrideJustification: '{"actorId":"dean-1","reason":"Transfer credit approved"}'
    });

    expect(enrollment.id).toBe('enroll-101');
  });

  // Gate 10: Tuition Fee Ledger Posting (Double-entry Ledger)
  test('Gate 10: Enrolling with tuition fee posts balanced journal lines to ledger', async () => {
    const enrollment = await enrollmentService.enrollStudent({
      tenantId: 'tenant-edu-1',
      studentPartyId: 'person-101',
      courseId: 'course-101',
      requestId: 'req-3',
      tuitionFeeAmount: 5000000
    });

    expect(enrollment.id).toBe('enroll-101');
    expect(mockAccountingContract.postJournalEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-edu-1',
        description: expect.any(String),
        lines: [
          { accountCode: '1111', debitAmount: 5000000, creditAmount: 0 },
          { accountCode: '5111', debitAmount: 0, creditAmount: 5000000 }
        ]
      })
    );
  });

  test('Gate 10: Bubbles error if tuition ledger posting fails', async () => {
    mockEnrollmentContract.enrollStudent.mockResolvedValueOnce({
      id: 'enroll-ledger-fail',
      tenantId: 'tenant-edu-1',
      studentPartyId: 'person-101',
      courseId: 'course-101',
      status: 'active',
      enrolledAt: new Date().toISOString()
    });

    await expect(
      enrollmentService.enrollStudent({
        tenantId: 'tenant-edu-1',
        studentPartyId: 'person-101',
        courseId: 'course-101',
        requestId: 'req-4',
        tuitionFeeAmount: 5000000
      })
    ).rejects.toThrow('LEDGER_POSTING_FAILED');
  });
});
