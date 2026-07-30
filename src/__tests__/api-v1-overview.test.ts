jest.mock('server-only', () => ({}), { virtual: true });

const mockRpc = jest.fn();
const mockInsert = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve({
    rpc: mockRpc,
    from: mockFrom,
  })),
}));

const mockAdminFrom = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: mockAdminFrom,
  })),
}));

jest.mock('@/lib/supabase-admin-env', () => ({
  getSupabaseAdminUrl: () => 'https://mock.supabase.co',
  getSupabaseAdminKey: () => 'mock-key',
}));

import { describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/v1/overview/route';

const MOCK_API_KEY = 'pk_live_bella_eos_key';
const MOCK_TENANT_ID = 'tenant_eos_uuid';

describe('/api/v1/overview Route - Partner Connection Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInsert.mockResolvedValue({ data: null, error: null });

    mockRpc.mockImplementation((fn, params) => {
      if (params.p_api_key === MOCK_API_KEY) {
        return Promise.resolve({
          data: [{
            partner_id: 'partner_bella_eos',
            tenant_id: MOCK_TENANT_ID,
            partner_name: 'BELLA EOS',
            allowed_scopes: ['analytics:read'],
            is_active: true,
            is_sandbox: false,
            rate_limit_per_minute: 100,
            rate_limit_per_day: 5000,
          }],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    mockFrom.mockImplementation(() => ({
      insert: mockInsert,
    }));

    mockAdminFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { metadata: {} }, error: null }),
        }),
      }),
    }));
  });

  it('GET /api/v1/overview returns 200 with partner details and logs request', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/overview', {
      method: 'GET',
      headers: {
        'x-api-key': MOCK_API_KEY,
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.partner_name).toBe('BELLA EOS');
    expect(body.data.tenant_id).toBe(MOCK_TENANT_ID);
    expect(body.data.status).toBe('active');

    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      partner_id: 'partner_bella_eos',
      tenant_id: MOCK_TENANT_ID,
      endpoint: '/api/v1/overview',
      status_code: 200,
      is_error: false,
    }));
  });

  it('POST /api/v1/overview returns 200 with partner details', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/overview', {
      method: 'POST',
      headers: {
        'x-api-key': MOCK_API_KEY,
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.partner_name).toBe('BELLA EOS');
  });

  it('returns 401 if x-api-key is missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/overview', {
      method: 'GET',
    });

    const res = await GET(req);
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('AUTH_001');
  });
});
