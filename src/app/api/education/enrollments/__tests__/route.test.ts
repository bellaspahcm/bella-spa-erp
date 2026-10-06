import { describe, expect, it, jest, beforeEach } from '@jest/globals';

const mockGetUser = jest.fn();
const mockFrom = jest.fn();
const mockRegisterStudent = jest.fn();
const mockGetStudent = jest.fn();
const mockEnrollStudent = jest.fn();
const mockGetEnrollment = jest.fn();
const mockEstablishGuardianAuthorization = jest.fn();
const mockGetAuthorizedGuardians = jest.fn();
const mockAssignEnrollmentToBranch = jest.fn();
const mockGetEnrollmentChain = jest.fn();

jest.mock('@/lib/supabase-server', () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  }),
}));

jest.mock('@/platform/education/contracts/student.contract.impl', () => ({
  StudentContractImpl: jest.fn().mockImplementation(() => ({
    registerStudent: mockRegisterStudent,
    getStudent: mockGetStudent,
  })),
}));

jest.mock('@/platform/education/contracts/enrollment.contract.impl', () => ({
  EnrollmentContractImpl: jest.fn().mockImplementation(() => ({
    getEnrollment: mockGetEnrollment,
  })),
}));

jest.mock('@/products/bella-education/services/enrollment.service', () => ({
  EnrollmentProductService: jest.fn().mockImplementation(() => ({
    enrollStudent: mockEnrollStudent,
  })),
}));

jest.mock('@/products/bella-education/services/preschool-guardian-authorization.service', () => ({
  normalizePreschoolGuardianPhone: (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (!digits) throw new Error('GUARDIAN_PHONE_REQUIRED');
    return digits;
  },
  PreschoolGuardianAuthorizationService: jest.fn().mockImplementation(() => ({
    establishForEnrollment: mockEstablishGuardianAuthorization,
    getAuthorizedGuardians: mockGetAuthorizedGuardians,
  })),
}));

jest.mock('@/products/bella-education/services/preschool-chain.service', () => ({
  PreschoolChainService: jest.fn().mockImplementation(() => ({
    assignEnrollmentToBranch: mockAssignEnrollmentToBranch,
    getEnrollmentChain: mockGetEnrollmentChain,
  })),
}));

const { GET, POST } = require('../route') as typeof import('../route');

const tenantId = '00000000-0000-0000-0000-0000000000aa';
const userId = '00000000-0000-0000-0000-000000000001';
const partyId = '00000000-0000-0000-0000-0000000000bb';
const guardianPartyId = '00000000-0000-0000-0000-0000000000dd';
const courseId = '00000000-0000-0000-0000-0000000000cc';
const branchId = '00000000-0000-0000-0000-0000000000ee';

const insertedRows: unknown[] = [];
const queryFilters: Array<{ readonly table: string; readonly column: string; readonly value: unknown }> = [];

function buildRequest(body: object): Request {
  return new Request('http://localhost/api/education/enrollments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function setupSupabaseMocks() {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'users') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { tenant_id: tenantId }, error: null }),
          }),
        }),
      };
    }

    if (table === 'edu_courses') {
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          queryFilters.push({ table, column, value });
          return chain;
        },
        in: async () => ({
          data: [{ id: courseId, title: 'Lớp Mầm A1' }],
          error: null,
        }),
        maybeSingle: async () => ({ data: { id: courseId, title: 'Lớp Mầm A1' }, error: null }),
      };
      return chain;
    }

    if (table === 'party_parties') {
      const selectChain = {
        eq: (column: string, value: unknown) => {
          queryFilters.push({ table, column, value });
          return selectChain;
        },
        in: async () => ({
          data: [{
            id: partyId,
            display_name: 'Lê Hoàng Nam',
            dob: '2023-06-15',
            gender: 'male',
          }],
          error: null,
        }),
      };
      return {
        insert: (row: unknown) => {
          insertedRows.push(row);
          return {
            select: () => ({
              single: async () => ({ data: { id: partyId }, error: null }),
            }),
          };
        },
        select: () => selectChain,
      };
    }

    if (table === 'edu_enrollments') {
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          queryFilters.push({ table, column, value });
          return chain;
        },
        in: () => chain,
        order: () => chain,
        limit: async () => ({
          data: [{
            id: 'enrollment-1',
            course_id: courseId,
            student_party_id: partyId,
            status: 'active',
            enrolled_at: '2026-09-26T00:00:00.000Z',
          }],
          error: null,
        }),
      };
      return chain;
    }

    if (table === 'students') {
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          queryFilters.push({ table, column, value });
          return chain;
        },
        in: async () => ({
          data: [{
            student_id: 'student-row-1',
            party_id: partyId,
            student_code: 'EDU-2026-123456',
            metadata: { nickname: 'Bé Tôm', medicalNote: 'Dị ứng sữa bò' },
          }],
          error: null,
        }),
      };
      return chain;
    }

    throw new Error(`Unexpected table access in Preschool enrollment route test: ${table}`);
  });
}

describe('GET /api/education/enrollments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    insertedRows.length = 0;
    queryFilters.length = 0;
    setupSupabaseMocks();

    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: userId,
          user_metadata: { tenant_id: tenantId },
        },
      },
      error: null,
    });
    mockGetAuthorizedGuardians.mockResolvedValue(new Map([
      [partyId, [{
        authorizationId: 'guardian-authorization-1',
        studentPartyId: partyId,
        guardianPartyId,
        displayName: 'Lê Văn Thành',
        phone: '0989112334',
        status: 'authorized',
      }]],
    ]));
  });

  it('reads the student registry from canonical tenant-scoped enrollments and Party-backed student rows', async () => {
    const response = await GET(new Request('http://localhost/api/education/enrollments'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.students).toEqual([expect.objectContaining({
      id: 'EDU-2026-123456',
      enrollmentId: 'enrollment-1',
      studentId: 'student-row-1',
      partyId,
      name: 'Lê Hoàng Nam',
      nickname: 'Bé Tôm',
      dateOfBirth: '2023-06-15',
      gender: 'Nam',
      className: 'Lớp Mầm A1',
      parentName: 'Lê Văn Thành',
      parentPhone: '0989112334',
      hasHealthAlert: true,
      medicalNote: 'Dị ứng sữa bò',
      status: 'Đang Học',
      statusKey: 'active',
    })]);
    expect(mockGetAuthorizedGuardians).toHaveBeenCalledWith(tenantId, [partyId]);

    expect(queryFilters).toEqual(expect.arrayContaining([
      { table: 'edu_enrollments', column: 'tenant_id', value: tenantId },
      { table: 'party_parties', column: 'tenant_id', value: tenantId },
      { table: 'students', column: 'tenant_id', value: tenantId },
      { table: 'edu_courses', column: 'tenant_id', value: tenantId },
    ]));
  });
});

describe('POST /api/education/enrollments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    insertedRows.length = 0;
    queryFilters.length = 0;
    setupSupabaseMocks();

    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: userId,
          user_metadata: { tenant_id: tenantId },
        },
      },
      error: null,
    });

    mockRegisterStudent.mockResolvedValue({
      partyId,
      tenantId,
      studentCode: 'EDU-2026-123456',
      academicStatus: 'active',
    });

    mockEnrollStudent.mockResolvedValue({
      id: 'enrollment-1',
      tenantId,
      studentPartyId: partyId,
      courseId,
      status: 'active',
      enrolledAt: '2026-09-26T00:00:00.000Z',
    });

    mockGetStudent.mockResolvedValue({
      partyId,
      tenantId,
      studentCode: 'EDU-2026-123456',
      academicStatus: 'active',
    });

    mockGetEnrollment.mockResolvedValue({
      id: 'enrollment-1',
      tenantId,
      studentPartyId: partyId,
      courseId,
      status: 'active',
      enrolledAt: '2026-09-26T00:00:00.000Z',
    });

    mockEstablishGuardianAuthorization.mockResolvedValue({
      authorizationId: 'guardian-authorization-1',
      studentPartyId: partyId,
      guardianPartyId,
      displayName: 'Lê Văn Thành',
      phone: '0989112334',
      status: 'authorized',
      normalizedPhone: '0989112334',
    });
    mockGetAuthorizedGuardians.mockResolvedValue(new Map([
      [partyId, [{
        authorizationId: 'guardian-authorization-1',
        studentPartyId: partyId,
        guardianPartyId,
        displayName: 'Lê Văn Thành',
        phone: '0989112334',
        status: 'authorized',
      }]],
    ]));

    mockAssignEnrollmentToBranch.mockResolvedValue({
      tenantId,
      courseId,
      enrollmentId: 'enrollment-1',
      branchId,
      requestId: 'request-1',
      assignedBy: userId,
    });
    mockGetEnrollmentChain.mockResolvedValue({
      tenantId,
      courseId,
      enrollmentId: 'enrollment-1',
      branchId,
      requestId: 'request-1',
      assignedBy: userId,
    });
  });

  it('creates a canonical Party student, enrolls through the product service, and requires read-back before success', async () => {
    const response = await POST(buildRequest({
      childName: 'Lê Hoàng Nam',
      nickname: 'Bé Tôm',
      dateOfBirth: '2023-06-15',
      gender: 'Nam',
      guardianName: 'Lê Văn Thành',
      guardianPhone: '0989112334',
      medicalNote: 'Dị ứng sữa bò',
      courseId,
    }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.student.partyId).toBe(partyId);
    expect(body.student.guardianPartyId).toBe(guardianPartyId);
    expect(body.guardianAuthorization).toEqual(expect.objectContaining({
      id: 'guardian-authorization-1',
      guardianPartyId,
      studentPartyId: partyId,
      status: 'authorized',
    }));
    expect(body.enrollment.id).toBe('enrollment-1');

    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]).toEqual(expect.objectContaining({
      tenant_id: tenantId,
      party_type: 'person',
      display_name: 'Lê Hoàng Nam',
      dob: '2023-06-15',
      gender: 'male',
    }));

    expect(mockRegisterStudent).toHaveBeenCalledWith(expect.objectContaining({
      tenantId,
      partyId,
      guardianPartyId,
      studentCode: expect.stringMatching(/^EDU-\d{4}-\d{3,}$/),
    }));
    expect(mockEstablishGuardianAuthorization).toHaveBeenCalledWith(expect.objectContaining({
      tenantId,
      studentPartyId: partyId,
      guardianName: 'Lê Văn Thành',
      guardianPhone: '0989112334',
      actorId: userId,
    }));
    expect(mockEnrollStudent).toHaveBeenCalledWith(expect.objectContaining({
      tenantId,
      studentPartyId: partyId,
      courseId,
      requestId: expect.any(String),
    }));
    expect(mockAssignEnrollmentToBranch).not.toHaveBeenCalled();
    expect(mockGetEnrollmentChain).not.toHaveBeenCalled();
    expect(mockGetStudent).toHaveBeenCalledWith(tenantId, partyId);
    expect(mockGetEnrollment).toHaveBeenCalledWith(tenantId, 'enrollment-1');

    const accessedTables = mockFrom.mock.calls.map((call) => call[0]);
    expect(accessedTables).not.toContain('persons');
    expect(accessedTables).not.toContain('identity_migration_mapping');
  });

  it('assigns and reads back the Preschool branch chain when branchId is submitted', async () => {
    const response = await POST(buildRequest({
      childName: 'Lê Hoàng Nam',
      nickname: 'Bé Tôm',
      dateOfBirth: '2023-06-15',
      gender: 'Nam',
      guardianName: 'Lê Văn Thành',
      guardianPhone: '0989112334',
      medicalNote: 'Dị ứng sữa bò',
      courseId,
      branchId,
    }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.chain).toEqual(expect.objectContaining({
      tenantId,
      courseId,
      enrollmentId: 'enrollment-1',
      branchId,
    }));
    expect(mockAssignEnrollmentToBranch).toHaveBeenCalledWith(expect.objectContaining({
      tenantId,
      courseId,
      enrollmentId: 'enrollment-1',
      branchId,
      actorUserId: userId,
      requestId: expect.any(String),
    }));
    expect(mockGetEnrollmentChain).toHaveBeenCalledWith(tenantId, 'enrollment-1');
  });

  it('does not report success when enrollment read-back fails', async () => {
    mockGetEnrollment.mockResolvedValueOnce(null);

    const response = await POST(buildRequest({
      childName: 'Lê Hoàng Nam',
      dateOfBirth: '2023-06-15',
      gender: 'Nam',
      guardianName: 'Lê Văn Thành',
      guardianPhone: '0989112334',
      courseId,
    }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toContain('Enrollment read-back failed');
  });

  it('does not report enrollment success when required guardian authorization fails', async () => {
    mockEstablishGuardianAuthorization.mockRejectedValueOnce(new Error('Failed to create Preschool pickup authorization'));

    const response = await POST(buildRequest({
      childName: 'Lê Hoàng Nam',
      dateOfBirth: '2023-06-15',
      gender: 'Nam',
      guardianName: 'Lê Văn Thành',
      guardianPhone: '0989112334',
      courseId,
    }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toContain('Failed to create Preschool pickup authorization');
    expect(mockRegisterStudent).not.toHaveBeenCalled();
    expect(mockEnrollStudent).not.toHaveBeenCalled();
    expect(mockGetEnrollment).not.toHaveBeenCalled();
  });

  it('rejects invalid guardian phone before creating the student Party', async () => {
    const response = await POST(buildRequest({
      childName: 'Lê Hoàng Nam',
      dateOfBirth: '2023-06-15',
      gender: 'Nam',
      guardianName: 'Lê Văn Thành',
      guardianPhone: 'khong-co-so',
      courseId,
    }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toContain('GUARDIAN_PHONE_REQUIRED');
    expect(insertedRows).toHaveLength(0);
    expect(mockEstablishGuardianAuthorization).not.toHaveBeenCalled();
    expect(mockRegisterStudent).not.toHaveBeenCalled();
    expect(mockEnrollStudent).not.toHaveBeenCalled();
  });
});
