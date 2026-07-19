import { getPublicBabycareBookingPackages } from '@/core/services/order';

const mockFrom = jest.fn();

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve({ from: mockFrom })),
}));

jest.mock('server-only', () => ({}), { virtual: true });

function createTenantBuilder() {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    single: jest.fn().mockResolvedValue({
      data: {
        id: 'bella-tenant',
        name: 'Bella Spa Headquarter',
        status: 'active',
        enabled_modules: { babycare: true, beauty_spa: false },
        contact_phone: '0865 701 493',
      },
      error: null,
    }),
  };
  return builder;
}

function createPackagesBuilder(rows: Record<string, unknown>[]) {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    or: jest.fn(() => builder),
    order: jest.fn().mockResolvedValue({ data: rows, error: null }),
  };
  return builder;
}

describe('public booking packages', () => {
  const originalDefaultTenantId = process.env.DEFAULT_TENANT_ID;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DEFAULT_TENANT_ID = 'bella-tenant';
  });

  afterAll(() => {
    process.env.DEFAULT_TENANT_ID = originalDefaultTenantId;
  });

  it('loads only active Bella babycare packages for the public booking page', async () => {
    const tenantBuilder = createTenantBuilder();
    const packagesBuilder = createPackagesBuilder([
      {
        id: 'pkg-babycare',
        tenant_id: 'bella-tenant',
        module_key: 'babycare',
        status: 'active',
        name: 'Tam be',
        description: null,
        price: 4500000,
        full_price: 6000000,
        total_sessions: 15,
        service_category: 'babycare',
      },
      {
        id: 'pkg-legacy-null',
        tenant_id: 'bella-tenant',
        module_key: null,
        status: 'active',
        name: 'Tu van',
        description: null,
        price: null,
        full_price: 0,
        total_sessions: 1,
        service_category: null,
      },
      {
        id: 'pkg-beauty',
        tenant_id: 'bella-tenant',
        module_key: 'beauty_spa',
        status: 'active',
        name: 'Facial',
        description: null,
        price: 900000,
        full_price: 900000,
        total_sessions: 1,
        service_category: 'facial',
      },
      {
        id: 'pkg-other-tenant',
        tenant_id: 'beauty-tenant',
        module_key: 'babycare',
        status: 'active',
        name: 'Other',
        description: null,
        price: 100000,
        full_price: 100000,
        total_sessions: 1,
        service_category: null,
      },
    ]);

    mockFrom.mockImplementation((table: string) => {
      if (table === 'tenants') return tenantBuilder;
      if (table === 'packages') return packagesBuilder;
      throw new Error(`Unexpected table ${table}`);
    });

    const result = await getPublicBabycareBookingPackages();

    expect(result.error).toBeNull();
    expect(result.tenantPhone).toBe('0865 701 493');
    expect(result.packages.map((pkg) => pkg.id)).toEqual(['pkg-babycare', 'pkg-legacy-null']);
    expect(tenantBuilder.eq).toHaveBeenCalledWith('id', 'bella-tenant');
    expect(packagesBuilder.eq).toHaveBeenCalledWith('tenant_id', 'bella-tenant');
    expect(packagesBuilder.eq).toHaveBeenCalledWith('status', 'active');
    expect(packagesBuilder.or).toHaveBeenCalledWith('module_key.is.null,module_key.eq.babycare');
  });
});
