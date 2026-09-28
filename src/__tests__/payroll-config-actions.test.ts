import { saveCommissionConfig, saveProviderConfig } from '../services/payroll-config-actions';

const mockFrom = jest.fn();
const mockUpsert = jest.fn();
const mockRevalidatePath = jest.fn();

jest.mock('next/cache', () => ({
  revalidatePath: (path: string) => mockRevalidatePath(path),
}));

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve({
    from: mockFrom,
  })),
}));

describe('payroll config actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-09-28T08:30:00.000Z'));
    mockFrom.mockReturnValue({ upsert: mockUpsert });
    mockUpsert.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates or updates a provider config row for first-time tenant payroll configuration', async () => {
    const result = await saveProviderConfig({
      tenantId: 'tenant-haircut',
      providerKey: 'commission',
      enabled: true,
      strategy: 'fixed',
      config: { rate: 135000, minSessions: 0 },
      notes: 'Haircut fixed commission policy',
    });

    expect(result).toEqual({ success: true });
    expect(mockFrom).toHaveBeenCalledWith('tenant_payroll_config');
    expect(mockUpsert).toHaveBeenCalledWith({
      tenant_id: 'tenant-haircut',
      provider_key: 'commission',
      enabled: true,
      strategy: 'fixed',
      config: { rate: 135000, minSessions: 0 },
      notes: 'Haircut fixed commission policy',
      updated_at: '2026-09-28T08:30:00.000Z',
    }, {
      onConflict: 'tenant_id,provider_key',
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/settings');
  });

  it('persists commission config values without forcing the default fallback rate', async () => {
    const result = await saveCommissionConfig(
      'tenant-haircut',
      true,
      'fixed',
      { rate: 135000, minSessions: 0 },
    );

    expect(result).toEqual({ success: true });
    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
      tenant_id: 'tenant-haircut',
      provider_key: 'commission',
      strategy: 'fixed',
      config: { rate: 135000, minSessions: 0 },
    }), {
      onConflict: 'tenant_id,provider_key',
    });
  });
});
