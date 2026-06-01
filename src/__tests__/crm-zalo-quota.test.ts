import { getBirthdayCustomers, sendBirthdayGreeting } from '../services/crm/campaigns';
import { triggerZaloReminder } from '../services/crm/zalo-messaging';

const mockGetCurrentUser = jest.fn();
const mockRecordAuditLog = jest.fn();
const mockCreateClient = jest.fn();
const mockCheckSubscriptionLimit = jest.fn();
const mockIncrementSmsCount = jest.fn();
const mockGetOrRefreshZaloToken = jest.fn();

jest.mock('../lib/supabase-server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

jest.mock('../services/user-actions', () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));

jest.mock('../services/audit-actions', () => ({
  recordAuditLog: (...args: unknown[]) => mockRecordAuditLog(...args),
}));

jest.mock('@/lib/subscription', () => ({
  checkSubscriptionLimit: (...args: unknown[]) => mockCheckSubscriptionLimit(...args),
  incrementSmsCount: (...args: unknown[]) => mockIncrementSmsCount(...args),
}));

jest.mock('../services/crm/zalo-config', () => ({
  getOrRefreshZaloToken: (...args: unknown[]) => mockGetOrRefreshZaloToken(...args),
}));

type TableQueues = Record<string, MockQueryBuilder[]>;

const callOrder: string[] = [];
const insertPayloads: Array<{ table: string; payload: unknown }> = [];
const updatePayloads: Array<{ table: string; payload: unknown }> = [];

class MockQueryBuilder {
  public table = '';

  constructor(
    private data: unknown = null,
    private error: { message: string } | null = null
  ) {}

  select() { return this; }
  eq() { return this; }
  not() { return this; }
  order() { return this; }
  single() { return this; }

  insert(payload: unknown) {
    callOrder.push(`${this.table}:insert`);
    insertPayloads.push({ table: this.table, payload });
    return this;
  }

  update(payload: unknown) {
    callOrder.push(`${this.table}:update`);
    updatePayloads.push({ table: this.table, payload });
    return this;
  }

  then(onfulfilled: (value: { data: unknown; error: { message: string } | null }) => unknown) {
    return Promise.resolve({ data: this.data, error: this.error }).then(onfulfilled);
  }
}

function setupSupabase(queues: TableQueues) {
  const from = jest.fn((table: string) => {
    const builder = queues[table]?.shift() ?? new MockQueryBuilder(null, null);
    builder.table = table;
    return builder;
  });

  mockCreateClient.mockResolvedValue({ from });
  return { from };
}

function mockSuccessfulZaloFetch() {
  mockGetOrRefreshZaloToken.mockResolvedValue('zalo-token');
  global.fetch = jest.fn(async () => {
    callOrder.push('zalo:fetch');
    return {
      ok: true,
      json: async () => ({ error: 0, data: { message_id: 'zns-1' } }),
    } as Response;
  });
}

describe('CRM/Zalo quota hardening', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    callOrder.length = 0;
    insertPayloads.length = 0;
    updatePayloads.length = 0;

    mockGetCurrentUser.mockResolvedValue({
      id: 'admin-1',
      tenant_id: 'tenant-1',
      role: 'admin',
    });
    mockCheckSubscriptionLimit.mockResolvedValue({ isBlocked: false });
    mockIncrementSmsCount.mockImplementation(async () => {
      callOrder.push('sms:increment');
      return 1;
    });
    mockRecordAuditLog.mockImplementation(async () => {
      callOrder.push('audit:record');
      return { success: true };
    });
    mockSuccessfulZaloFetch();
  });

  it('propagates birthday customer query failures instead of returning an empty list', async () => {
    setupSupabase({
      customers: [new MockQueryBuilder(null, { message: 'customers unavailable' })],
    });

    await expect(getBirthdayCustomers()).rejects.toThrow(
      'Failed to fetch birthday customers: customers unavailable'
    );
  });

  it('does not send or write birthday side effects when SMS reservation fails', async () => {
    mockIncrementSmsCount.mockImplementation(async () => {
      callOrder.push('sms:increment');
      throw new Error('quota counter unavailable');
    });
    setupSupabase({
      customers: [
        new MockQueryBuilder({
          id: 'customer-1',
          name_mother: 'Lan',
          name_baby: 'Mi',
          phone: '0909123456',
        }),
      ],
      tenants: [new MockQueryBuilder({ zalo_template_birthday_id: 'tpl-birthday' })],
    });

    const result = await sendBirthdayGreeting('customer-1', 'BDAY10', 'tenant-1');

    expect(result).toEqual({ error: 'quota counter unavailable' });
    expect(callOrder).toEqual(['sms:increment']);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(insertPayloads).toHaveLength(0);
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
  });

  it('reserves SMS quota before a real birthday ZNS send', async () => {
    setupSupabase({
      customers: [
        new MockQueryBuilder({
          id: 'customer-1',
          name_mother: 'Lan',
          name_baby: 'Mi',
          phone: '0909123456',
        }),
      ],
      tenants: [new MockQueryBuilder({ zalo_template_birthday_id: 'tpl-birthday' })],
      Notification: [new MockQueryBuilder(null, null)],
    });

    const result = await sendBirthdayGreeting('customer-1', 'BDAY10', 'tenant-1');

    expect(result.success).toBe(true);
    expect(callOrder.indexOf('sms:increment')).toBeLessThan(callOrder.indexOf('zalo:fetch'));
    expect(insertPayloads).toHaveLength(1);
    expect(mockRecordAuditLog).toHaveBeenCalledTimes(1);
  });

  it('does not send or write reminder side effects when SMS reservation fails', async () => {
    mockIncrementSmsCount.mockImplementation(async () => {
      callOrder.push('sms:increment');
      throw new Error('quota counter unavailable');
    });
    setupSupabase({
      session_logs: [
        new MockQueryBuilder({
          id: 'session-1',
          assigned_time: '09:00:00',
          assigned_date: '2026-06-02',
          address: '123 Le Loi',
          bookings: {
            package_name: 'Goi cham soc',
            customers: {
              name_mother: 'Lan',
              name_baby: 'Mi',
              phone: '0909123456',
            },
            assigned_ktv: {
              full_name: 'KTV A',
              id: 'ktv-1',
            },
          },
        }),
      ],
      tenants: [new MockQueryBuilder({ zalo_template_reminder_id: 'tpl-reminder' })],
    });

    const result = await triggerZaloReminder('session-1', 'tenant-1');

    expect(result).toEqual({ error: 'quota counter unavailable' });
    expect(callOrder).toEqual(['sms:increment']);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(updatePayloads).toHaveLength(0);
    expect(insertPayloads).toHaveLength(0);
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
  });
});
