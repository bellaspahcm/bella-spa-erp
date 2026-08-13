/**
 * BELLA EDUCATION — MULTI-TENANT CUSTOMIZATION INTEGRATION TESTS
 *
 * Verifies that the tenant customization features are fully isolated and compliant:
 * - Rule A: Zero Tenant Hardcoding (configuration-driven)
 * - Rule B: Invariant Supremacy (Platform Cap of 30 credits overrides unlimited settings)
 * - Rule D: Configuration Context Isolation (A cannot read B)
 * - Workflow Customization (Standard: active, Strict: pending_approval)
 * - Corporate Accounting (corporate funded accounting lines routed via IAccountingContract)
 *
 * @module src/products/bella-education/__tests__/bella-education-customization-conformance.integration.test
 */

import { EducationEngineService } from '../../../platform/education/education-engine.service';
import { PolicyRegistryContractImpl } from '../../../platform/education/contracts/policy-registry.contract.impl';
import { WorkflowRegistryContractImpl } from '../../../platform/education/contracts/workflow-registry.contract.impl';
import { EducationEnrollmentExtensionContractImpl } from '../../../platform/education/contracts/extension.contract.impl';
import { EnrollmentProductService } from '../services/enrollment.service';
import { MemoryEventBusAdapter } from '../../../platform/core/events';

describe('BELLA EDUCATION V1 — MULTI-TENANT CUSTOMIZATION INTEGRATION TESTS', () => {
  let eventBus: MemoryEventBusAdapter;
  let policyRegistry: PolicyRegistryContractImpl;
  let workflowRegistry: WorkflowRegistryContractImpl;
  let extensionContract: EducationEnrollmentExtensionContractImpl;
  let engineService: EducationEngineService;

  // Mock repository with configurable enrollment count
  let activeEnrollmentCount = 0;
  const mockRepository: any = {
    verifyStudentRole: jest.fn().mockResolvedValue({ isValid: true }),
    findCourseById: jest.fn().mockImplementation((courseId, tenantId) =>
      Promise.resolve({
        id: courseId,
        tenantId,
        courseCode: 'CSE-101',
        title: 'Intro to Programming',
        status: 'active',
        prerequisiteCourseCodes: [],
      })
    ),
    findCourseByCode: jest.fn(),
    saveEnrollment: jest.fn(),
    findEnrollmentById: jest.fn().mockImplementation((id, tenantId) =>
      Promise.resolve({
        id,
        tenantId,
        studentPartyId: 'person-101',
        courseId: 'course-101',
        status: 'active',
        requestId: 'req-1',
        enrolledAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    ),
    executeEnrollStudentTransaction: jest.fn().mockImplementation((params) =>
      Promise.resolve({
        isDuplicate: false,
        enrollmentId: params.enrollmentId,
      })
    ),
    getStudentScores: jest.fn().mockResolvedValue([]),
    getActiveEnrollmentsCount: jest.fn().mockImplementation(() => Promise.resolve(activeEnrollmentCount)),
  };

  const mockAccountingContract: any = {
    postJournalEntry: jest.fn().mockResolvedValue({ success: true, entryId: 'jr-101' }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    activeEnrollmentCount = 0;
    eventBus = new MemoryEventBusAdapter();
    policyRegistry = new PolicyRegistryContractImpl();
    workflowRegistry = new WorkflowRegistryContractImpl();
    extensionContract = new EducationEnrollmentExtensionContractImpl();

    engineService = new EducationEngineService(
      mockRepository,
      eventBus,
      undefined,
      policyRegistry,
      workflowRegistry
    );
  });

  // Rule D: Configuration Context Isolation
  test('Rule D: PolicyRegistry throws error if Tenant A requests policy of Tenant B', async () => {
    await expect(
      policyRegistry.getPolicy('tenant-strict', 'education.max_credits', 'tenant-standard')
    ).rejects.toThrow('CONFIGURATION_CONTEXT_ISOLATION_VIOLATION');
  });

  test('Rule D: WorkflowRegistry throws error if Tenant A requests workflow of Tenant B', async () => {
    await expect(
      workflowRegistry.getWorkflow('tenant-strict', 'student_enrollment', 'tenant-standard')
    ).rejects.toThrow('CONFIGURATION_CONTEXT_ISOLATION_VIOLATION');
  });

  // Credit Cap Validation (Standard vs. Strict)
  test('Tenant Standard credit limit (24 credits / 8 courses) allows 8th but blocks 9th course', async () => {
    // 7 courses * 3 = 21 credits. Next course will make it 24 credits (allowed).
    activeEnrollmentCount = 7;
    const res = await engineService.enrollStudent({
      tenantId: 'tenant-standard',
      studentPartyId: 'person-101',
      courseId: 'course-101',
      requestId: 'req-standard-1',
    });
    expect(res.success).toBe(true);

    // 8 courses * 3 = 24 credits. Next course will make it 27 credits (blocked).
    activeEnrollmentCount = 8;
    await expect(
      engineService.enrollStudent({
        tenantId: 'tenant-standard',
        studentPartyId: 'person-101',
        courseId: 'course-101',
        requestId: 'req-standard-2',
      })
    ).rejects.toThrow('Platform credit limit exceeded');
  });

  test('Tenant Strict credit limit (18 credits / 6 courses) allows 6th but blocks 7th course', async () => {
    // 5 courses * 3 = 15 credits. Next course makes it 18 credits (allowed).
    activeEnrollmentCount = 5;
    const res = await engineService.enrollStudent({
      tenantId: 'tenant-strict',
      studentPartyId: 'person-101',
      courseId: 'course-101',
      requestId: 'req-strict-1',
    });
    expect(res.success).toBe(true);

    // 6 courses * 3 = 18 credits. Next course makes it 21 credits (blocked).
    activeEnrollmentCount = 6;
    await expect(
      engineService.enrollStudent({
        tenantId: 'tenant-strict',
        studentPartyId: 'person-101',
        courseId: 'course-101',
        requestId: 'req-strict-2',
      })
    ).rejects.toThrow('Platform credit limit exceeded');
  });

  // Rule B: Invariant Supremacy
  test('Rule B: Corporate Tenant requested "unlimited" credit limit is capped at 30 credits (Platform Cap)', async () => {
    // 9 courses * 3 = 27 credits. Next course makes it 30 credits (allowed).
    activeEnrollmentCount = 9;
    const res = await engineService.enrollStudent({
      tenantId: 'tenant-corporate',
      studentPartyId: 'person-101',
      courseId: 'course-101',
      requestId: 'req-corp-1',
    });
    expect(res.success).toBe(true);

    // 10 courses * 3 = 30 credits. Next course makes it 33 credits (blocked by Supreme 30 credits Platform Invariant).
    activeEnrollmentCount = 10;
    await expect(
      engineService.enrollStudent({
        tenantId: 'tenant-corporate',
        studentPartyId: 'person-101',
        courseId: 'course-101',
        requestId: 'req-corp-2',
      })
    ).rejects.toThrow('Platform credit limit exceeded');
  });

  // Workflow Customization (Standard: active vs. Strict: pending_approval)
  test('Standard Tenant enrollment is created immediately in ACTIVE status', async () => {
    const res = await engineService.enrollStudent({
      tenantId: 'tenant-standard',
      studentPartyId: 'person-101',
      courseId: 'course-101',
      requestId: 'req-workflow-std',
    });
    expect(res.success).toBe(true);
    expect(res.enrollment?.status).toBe('active');
  });

  test('Strict Tenant enrollment is routed to PENDING_APPROVAL status initially', async () => {
    const res = await engineService.enrollStudent({
      tenantId: 'tenant-strict',
      studentPartyId: 'person-101',
      courseId: 'course-101',
      requestId: 'req-workflow-strict',
    });
    expect(res.success).toBe(true);
    expect(res.enrollment?.status).toBe('pending_approval');
  });

  // Corporate Accounting & Tuition Calculation Extensions
  test('Approved Extensions compute early registration discount (10% off) for Strict Tenant', async () => {
    const tuition = await extensionContract.calculateTuition({
      tenantId: 'tenant-strict',
      studentPartyId: 'person-101',
      courseId: 'course-101',
      baseTuitionFee: 5000000,
    });

    expect(tuition.finalTuitionFee).toBe(4500000); // 10% discount
    expect(tuition.isCorporateFunded).toBe(false);
  });

  test('Approved Extensions route corporate-funded tuition calculations for Corporate Tenant', async () => {
    const tuition = await extensionContract.calculateTuition({
      tenantId: 'tenant-corporate',
      studentPartyId: 'person-101',
      courseId: 'course-101',
      baseTuitionFee: 5000000,
    });

    expect(tuition.finalTuitionFee).toBe(0);
    expect(tuition.isCorporateFunded).toBe(true);
    expect(tuition.corporateClientPartyId).toBe('corp-client-partner-99');
  });

  test('Corporate Tenant enrollment maps tuition payments to corporate ledgers (no accounting bypass)', async () => {
    const mockEnrollmentContract: any = {
      enrollStudent: jest.fn().mockResolvedValue({
        id: 'enroll-101',
        tenantId: 'tenant-corporate',
        studentPartyId: 'person-101',
        courseId: 'course-101',
        status: 'active',
        enrolledAt: new Date().toISOString(),
      }),
    };

    const enrollmentProductService = new EnrollmentProductService(mockEnrollmentContract, mockAccountingContract);

    // Enrolling in corporate-funded tenant with fee amount
    await enrollmentProductService.enrollStudent({
      tenantId: 'tenant-corporate',
      studentPartyId: 'person-101',
      courseId: 'course-101',
      requestId: 'req-1',
      tuitionFeeAmount: 5000000, // Corporate funded fee
    });

    // Check that accounting was called with corporate funded ledger lines: Debit 1111 (Cash) / Credit 5111 (Tuition Revenue)
    expect(mockAccountingContract.postJournalEntry).toHaveBeenCalledWith({
      tenantId: 'tenant-corporate',
      description: expect.any(String),
      referenceType: 'enrollment',
      referenceId: 'enroll-101',
      lines: [
        { accountCode: '1111', debitAmount: 5000000, creditAmount: 0 },
        { accountCode: '5111', debitAmount: 0, creditAmount: 5000000 },
      ],
    });
  });
});
