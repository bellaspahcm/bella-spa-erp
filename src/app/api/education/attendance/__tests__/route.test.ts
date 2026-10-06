import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockFrom = jest.fn();
const mockGetCurrentUser = jest.fn();
const mockGetCourseDailyAttendance = jest.fn();
const mockSetDailyAttendance = jest.fn();
const mockGetAuthorizedGuardians = jest.fn();
const mockGetLatestHandovers = jest.fn();

jest.mock('@/lib/supabase-server', () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}));

jest.mock('@/services/user-actions', () => ({
  getCurrentUser: mockGetCurrentUser,
}));

jest.mock('@/platform/education/contracts/attendance.contract.impl', () => ({
  AttendanceContractImpl: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@/products/bella-education/services/attendance.service', () => ({
  AttendanceProductService: jest.fn().mockImplementation(() => ({
    getCourseDailyAttendance: mockGetCourseDailyAttendance,
    setDailyAttendance: mockSetDailyAttendance,
  })),
}));

jest.mock('@/products/bella-education/services/preschool-guardian-authorization.service', () => ({
  PreschoolGuardianAuthorizationService: jest.fn().mockImplementation(() => ({
    getAuthorizedGuardians: mockGetAuthorizedGuardians,
  })),
}));

jest.mock('@/products/bella-education/services/preschool-safe-pickup-handover.service', () => ({
  PreschoolSafePickupHandoverService: jest.fn().mockImplementation(() => ({
    getLatestHandovers: mockGetLatestHandovers,
  })),
}));

const { GET, POST } = require('../route') as typeof import('../route');

const tenantId = '00000000-0000-0000-0000-0000000000aa';
const userId = '00000000-0000-0000-0000-000000000001';
const courseId = '00000000-0000-0000-0000-0000000000cc';
const enrollmentId = '00000000-0000-0000-0000-0000000000ee';

function attendancePostRequest(body: object): Request {
  return new Request('http://localhost/api/education/attendance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/education/attendance route authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({
      id: userId,
      tenant_id: tenantId,
      role: 'admin_staff',
    });
    mockGetCourseDailyAttendance.mockResolvedValue([]);
    mockSetDailyAttendance.mockResolvedValue({
      id: 'attendance-state-1',
      tenantId,
      enrollmentId,
      schoolDay: '2026-10-06',
      status: 'present',
      createdAt: '2026-10-06T00:00:00.000Z',
      updatedAt: '2026-10-06T00:00:00.000Z',
    });
    mockGetAuthorizedGuardians.mockResolvedValue(new Map());
    mockGetLatestHandovers.mockResolvedValue(new Map());
  });

  it('blocks parent users from reading the classroom attendance roster', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'parent-user',
      tenant_id: tenantId,
      role: 'parent',
    });

    const response = await GET(new Request(
      `http://localhost/api/education/attendance?courseId=${courseId}&date=2026-10-06`,
    ));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.error).toContain('AUTH_ROLE_PERMISSION_ERROR');
    expect(mockGetCourseDailyAttendance).not.toHaveBeenCalled();
  });

  it('blocks accountant users from mutating daily attendance', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'accountant-user',
      tenant_id: tenantId,
      role: 'accountant',
    });

    const response = await POST(attendancePostRequest({
      enrollmentId,
      status: 'present',
      date: '2026-10-06',
    }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.error).toContain('AUTH_ROLE_PERMISSION_ERROR');
    expect(mockSetDailyAttendance).not.toHaveBeenCalled();
  });

  it('allows an education staff actor to set attendance through the product service', async () => {
    const response = await POST(attendancePostRequest({
      enrollmentId,
      status: 'present',
      date: '2026-10-06',
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockSetDailyAttendance).toHaveBeenCalledWith({
      tenantId,
      enrollmentId,
      status: 'present',
      rollCallTime: '2026-10-06T05:00:00.000Z',
    });
  });
});
