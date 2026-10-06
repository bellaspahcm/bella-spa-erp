import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockFrom = jest.fn();
const mockGetCurrentUser = jest.fn();
const mockGetDailyExperience = jest.fn();

jest.mock('@/lib/supabase-server', () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}));

jest.mock('@/services/user-actions', () => ({
  getCurrentUser: mockGetCurrentUser,
}));

jest.mock('@/products/bella-education/services/preschool-parent-daily-experience.service', () => ({
  PreschoolParentDailyExperienceService: jest.fn().mockImplementation(() => ({
    getDailyExperience: mockGetDailyExperience,
  })),
}));

const { GET } = require('../route') as typeof import('../route');

const tenantId = '00000000-0000-0000-0000-0000000000aa';
const parentUserId = '00000000-0000-0000-0000-0000000000pp';

describe('/api/education/parent-daily role boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({
      id: parentUserId,
      tenant_id: tenantId,
      role: 'parent',
    });
    mockFrom.mockImplementation((table: string) => {
      if (table !== 'users') {
        throw new Error(`Unexpected table access: ${table}`);
      }

      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: parentUserId,
                  tenant_id: tenantId,
                  phone: '0900 111 222',
                },
                error: null,
              }),
            }),
          }),
        }),
      };
    });
    mockGetDailyExperience.mockResolvedValue({
      tenantId,
      guardianPartyId: 'guardian-party-a',
      schoolDay: '2026-10-06',
      children: [],
    });
  });

  it('blocks non-parent users before loading parent daily experience', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'admin-user',
      tenant_id: tenantId,
      role: 'admin',
    });

    const response = await GET(new Request('http://localhost/api/education/parent-daily?date=2026-10-06'));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.error).toBe('PARENT_ROLE_REQUIRED');
    expect(mockGetDailyExperience).not.toHaveBeenCalled();
  });

  it('allows a parent user and keeps tenant and phone resolved server-side', async () => {
    const response = await GET(new Request('http://localhost/api/education/parent-daily?date=2026-10-06'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockGetDailyExperience).toHaveBeenCalledWith({
      user: {
        tenantId,
        userId: parentUserId,
        phone: '0900 111 222',
      },
      schoolDay: '2026-10-06',
      requestedStudentPartyId: undefined,
    });
  });
});
