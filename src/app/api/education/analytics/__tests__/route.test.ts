import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockGetCurrentUser = jest.fn();
const mockGetExecutiveDashboard = jest.fn();

jest.mock('@/services/user-actions', () => ({
  getCurrentUser: mockGetCurrentUser,
}));

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn().mockResolvedValue({}),
}));

jest.mock('@/products/bella-education/analytics/repositories/preschool-analytics.repository', () => ({
  PreschoolAnalyticsRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@/products/bella-education/analytics/services/preschool-analytics.service', () => ({
  PreschoolAnalyticsService: jest.fn().mockImplementation(() => ({
    getExecutiveDashboard: mockGetExecutiveDashboard,
  })),
}));

const { GET } = require('../route') as typeof import('../route');

const tenantId = '00000000-0000-0000-0000-0000000000aa';

describe('/api/education/analytics tenant and role boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({
      id: 'admin-user',
      tenant_id: tenantId,
      role: 'admin',
    });
    mockGetExecutiveDashboard.mockResolvedValue({
      tenantId,
      evaluatedAt: '2026-10-06T00:00:00.000Z',
      attendance: { todayPresentCount: 1, todayAbsentCount: 0, todayLateCount: 0, presentVsEnrolledRate: 100 },
      careAndSafety: { activeHealthIncidents: 0, pendingMedicationDoses: 0 },
      parentEngagement: { unacknowledgedNotices: 0, pendingConsentRequests: 0 },
      finance: { invoicedGrossTotal: 0, reconciledCashCollected: 0, outstandingBalanceTotal: 0, overdueAccountsCount: 0 },
    });
  });

  it('uses the authenticated tenant instead of a client-supplied tenantId', async () => {
    const response = await GET(new Request(
      'http://localhost/api/education/analytics?tenantId=00000000-0000-0000-0000-0000000000bb&date=2026-10-06',
    ));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockGetExecutiveDashboard).toHaveBeenCalledWith(tenantId, '2026-10-06');
  });

  it('blocks parent users from executive analytics', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'parent-user',
      tenant_id: tenantId,
      role: 'parent',
    });

    const response = await GET(new Request('http://localhost/api/education/analytics?date=2026-10-06'));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.error).toBe('ANALYTICS_ROLE_FORBIDDEN');
    expect(mockGetExecutiveDashboard).not.toHaveBeenCalled();
  });
});
