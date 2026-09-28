import { validateBookingPackageScope } from '@/core/services/order/create-booking-helpers';

type MockRow = Record<string, unknown>;

function createScopedSupabaseMock(rows: Record<string, MockRow[]>) {
  const calls: Array<{ table: string; filters: Record<string, unknown> }> = [];

  class QueryBuilder {
    private filters: Record<string, unknown> = {};

    constructor(private readonly table: string) {}

    select() {
      return this;
    }

    eq(column: string, value: unknown) {
      this.filters[column] = value;
      return this;
    }

    async single() {
      calls.push({ table: this.table, filters: { ...this.filters } });
      const list = rows[this.table] || [];
      const row = list.find((item) => Object.entries(this.filters).every(([column, value]) => item[column] === value));

      if (!row) {
        return { data: null, error: { message: 'Row not found' } };
      }

      return { data: row, error: null };
    }
  }

  return {
    calls,
    client: {
      from: (table: string) => new QueryBuilder(table),
    },
  };
}

describe('booking package module scope', () => {
  it('does not query package scope when booking has no package id', async () => {
    const { client, calls } = createScopedSupabaseMock({});

    const result = await validateBookingPackageScope(client as never, 'tenant-a', null);

    expect(result).toEqual({ success: true });
    expect(calls).toHaveLength(0);
  });

  it('allows Beauty Spa bookings to use Beauty Spa packages', async () => {
    const { client } = createScopedSupabaseMock({
      packages: [{ id: 'pkg-beauty', tenant_id: 'tenant-a', module_key: 'beauty_spa', name: 'Facial Signature' }],
      tenants: [{ id: 'tenant-a', enabled_modules: { babycare: false, beauty_spa: true } }],
    });

    const result = await validateBookingPackageScope(client as never, 'tenant-a', 'pkg-beauty');

    expect(result).toEqual({ success: true });
  });

  it('allows Haircut tenants to use tenant-owned Beauty OS package identities', async () => {
    const { client } = createScopedSupabaseMock({
      packages: [{ id: 'pkg-haircut', tenant_id: 'tenant-haircut', module_key: 'beauty_spa', name: 'Cắt tóc nam cơ bản' }],
      tenants: [{ id: 'tenant-haircut', enabled_modules: { haircut: true, bella_haircut: true, beauty_spa: true } }],
    });

    const result = await validateBookingPackageScope(client as never, 'tenant-haircut', 'pkg-haircut');

    expect(result).toEqual({ success: true });
  });

  it('treats package_id as packages.id and does not resolve by display name', async () => {
    const { client, calls } = createScopedSupabaseMock({
      packages: [{ id: 'pkg-haircut', tenant_id: 'tenant-haircut', module_key: 'beauty_spa', name: 'Cắt tóc nam cơ bản' }],
      tenants: [{ id: 'tenant-haircut', enabled_modules: { beauty_spa: true } }],
    });

    const result = await validateBookingPackageScope(client as never, 'tenant-haircut', 'pkg-haircut');

    expect(result).toEqual({ success: true });
    expect(calls[0]).toEqual({
      table: 'packages',
      filters: { id: 'pkg-haircut' },
    });
  });

  it('blocks missing packages', async () => {
    const { client } = createScopedSupabaseMock({
      packages: [],
      tenants: [{ id: 'tenant-a', enabled_modules: { beauty_spa: true } }],
    });

    const result = await validateBookingPackageScope(client as never, 'tenant-a', 'missing-package');

    expect(result).toEqual({
      error: 'Không thể xác thực gói dịch vụ của booking. Row not found',
    });
  });

  it('blocks Beauty Spa bookings from using Babycare packages', async () => {
    const { client } = createScopedSupabaseMock({
      packages: [{ id: 'pkg-babycare', tenant_id: 'tenant-a', module_key: 'babycare', name: 'Tắm bé chuẩn y khoa' }],
      tenants: [{ id: 'tenant-a', enabled_modules: { babycare: false, beauty_spa: true } }],
    });

    const result = await validateBookingPackageScope(client as never, 'tenant-a', 'pkg-babycare');

    expect(result).toEqual({
      error: 'Gói dịch vụ không thuộc ngành kinh doanh được Admin HQ cấp cho spa này.',
    });
  });

  it('blocks booking packages from a different tenant', async () => {
    const { client } = createScopedSupabaseMock({
      packages: [{ id: 'pkg-other', tenant_id: 'tenant-b', module_key: 'beauty_spa', name: 'Facial Signature' }],
      tenants: [{ id: 'tenant-a', enabled_modules: { babycare: false, beauty_spa: true } }],
    });

    const result = await validateBookingPackageScope(client as never, 'tenant-a', 'pkg-other');

    expect(result).toEqual({
      error: 'Gói dịch vụ không thuộc đơn vị kinh doanh hiện tại.',
    });
  });
});
