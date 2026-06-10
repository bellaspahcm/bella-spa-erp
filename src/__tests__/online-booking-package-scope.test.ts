import { submitOnlineBooking } from '@/modules/booking/actions/online-booking-action';

const mockFrom = jest.fn();

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve({ from: mockFrom })),
}));

jest.mock('@/lib/revalidate', () => ({
  safeRevalidatePath: jest.fn(() => Promise.resolve()),
}));

jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }));
jest.mock('@/services/audit-actions', () => ({
  recordAuditLog: jest.fn().mockResolvedValue({ success: true }),
}));

function createSingleRowBuilder(row: Record<string, unknown>) {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    single: jest.fn().mockResolvedValue({ data: row, error: null }),
  };
  return builder;
}

describe('online booking package scope', () => {
  const originalDefaultTenantId = process.env.DEFAULT_TENANT_ID;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DEFAULT_TENANT_ID = 'tenant-a';
  });

  afterAll(() => {
    process.env.DEFAULT_TENANT_ID = originalDefaultTenantId;
  });

  it('blocks public online bookings before customer side effects when the package module is not enabled', async () => {
    let tenantLookupCount = 0;

    mockFrom.mockImplementation((table: string) => {
      if (table === 'packages') {
        return createSingleRowBuilder({
          id: 'pkg-babycare',
          tenant_id: 'tenant-a',
          module_key: 'babycare',
          name: 'Babycare Package',
        });
      }

      if (table === 'tenants') {
        tenantLookupCount += 1;
        return createSingleRowBuilder({
          id: 'tenant-a',
          status: 'active',
          enabled_modules: tenantLookupCount === 1
            ? { babycare: true, beauty_spa: false }
            : { babycare: false, beauty_spa: true },
        });
      }

      return createSingleRowBuilder({ id: 'unexpected' });
    });

    const result = await submitOnlineBooking({
      name_mother: 'Nguyen Thi A',
      phone: '0901234567',
      start_date: '2026-06-10',
      package_id: 'pkg-babycare',
      package_name: 'Babycare Package',
    });

    expect(result.error).toContain('Admin HQ');
    expect(mockFrom).toHaveBeenCalledWith('packages');
    expect(mockFrom).toHaveBeenCalledWith('tenants');
    expect(mockFrom).not.toHaveBeenCalledWith('customers');
    expect(mockFrom).not.toHaveBeenCalledWith('bookings');
  });

  it('blocks public online bookings when the configured public tenant is not babycare', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'tenants') {
        return createSingleRowBuilder({
          id: 'tenant-a',
          status: 'active',
          enabled_modules: { babycare: false, beauty_spa: true },
        });
      }

      return createSingleRowBuilder({ id: 'unexpected' });
    });

    const result = await submitOnlineBooking({
      name_mother: 'Nguyen Thi A',
      phone: '0901234567',
      start_date: '2026-06-10',
      package_id: 'pkg-babycare',
      package_name: 'Babycare Package',
    });

    expect(result.error).toContain('Me & Be');
    expect(mockFrom).toHaveBeenCalledWith('tenants');
    expect(mockFrom).not.toHaveBeenCalledWith('packages');
    expect(mockFrom).not.toHaveBeenCalledWith('customers');
    expect(mockFrom).not.toHaveBeenCalledWith('bookings');
  });
});
