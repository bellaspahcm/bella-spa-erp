const mockCreateClient = jest.fn();

jest.mock('@/lib/supabase-server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

type QueryCall = {
  filters: Array<{ method: string; args: unknown[] }>;
  operation: 'insert' | 'select' | 'update';
  orders: Array<{ column: string; options?: unknown }>;
  payload?: unknown;
  selectColumns?: string;
  single: boolean;
  table: string;
};

const queryCalls: QueryCall[] = [];
let scriptedResults: QueryResult[] = [];
let scriptedRpcResult: QueryResult = { data: [], error: null };

class QueryBuilder implements PromiseLike<QueryResult> {
  private filters: Array<{ method: string; args: unknown[] }> = [];
  private operation: 'insert' | 'select' | 'update' = 'select';
  private orders: Array<{ column: string; options?: unknown }> = [];
  private payload?: unknown;
  private selectColumns?: string;
  private isSingle = false;

  constructor(private readonly table: string) {}

  select(columns?: string) {
    this.selectColumns = columns;
    return this;
  }

  insert(payload: unknown) {
    this.operation = 'insert';
    this.payload = payload;
    return this;
  }

  update(payload: unknown) {
    this.operation = 'update';
    this.payload = payload;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ method: 'eq', args: [column, value] });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push({ method: 'in', args: [column, values] });
    return this;
  }

  order(column: string, options?: unknown) {
    this.orders.push({ column, options });
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    queryCalls.push({
      filters: [...this.filters],
      operation: this.operation,
      orders: [...this.orders],
      payload: this.payload,
      selectColumns: this.selectColumns,
      single: this.isSingle,
      table: this.table,
    });

    return Promise.resolve(scriptedResults.shift() ?? { data: null, error: null })
      .then(onfulfilled, onrejected);
  }
}

const mockAuthGetUser = jest.fn();
const mockRpc = jest.fn();
const mockSupabase = {
  auth: {
    getUser: mockAuthGetUser,
  },
  from: jest.fn((table: string) => new QueryBuilder(table)),
  rpc: mockRpc,
};

import {
  getChatCustomers,
  getChatMessages,
  markMessagesAsRead,
  sendChatMessage,
} from '@/services/chat-actions';

const customerRows = [
  {
    created_at: '2026-06-01T08:00:00.000Z',
    customer_level: 'Gold',
    full_name: 'Nguyen Thi A',
    id: 'cust-1',
    last_package_name: 'Combo VIP',
    phone: '0900000001',
    total_spent: 1200000,
    unread_count: 2,
  },
  {
    created_at: '2026-06-01T09:00:00.000Z',
    customer_level: 'Silver',
    full_name: 'Tran Thi B',
    id: 'cust-2',
    last_package_name: 'Combo Basic',
    phone: '0900000002',
    total_spent: 500000,
    unread_count: 0,
  },
];

function seedAuthContext() {
  mockAuthGetUser.mockResolvedValue({
    data: { user: { id: 'user-1' } },
    error: null,
  });
  scriptedResults.push({ data: { tenant_id: 'tenant-1' }, error: null });
}

describe('dashboard chat actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryCalls.length = 0;
    scriptedResults = [];
    scriptedRpcResult = { data: [], error: null };
    mockCreateClient.mockResolvedValue(mockSupabase);
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    mockRpc.mockImplementation(() => Promise.resolve(scriptedRpcResult));
  });

  it('loads chat customers with tenant-scoped latest message previews', async () => {
    seedAuthContext();
    scriptedRpcResult = { data: customerRows, error: null };
    scriptedResults.push({
      data: [
        {
          created_at: '2026-06-03T09:30:00.000Z',
          customer_id: 'cust-2',
          id: 'msg-3',
          is_read: false,
          message: 'Tin moi cua B',
          sender_id: null,
          sender_type: 'customer',
          tenant_id: 'tenant-1',
        },
        {
          created_at: '2026-06-03T09:00:00.000Z',
          customer_id: 'cust-1',
          id: 'msg-2',
          is_read: false,
          message: 'Tin moi cua A',
          sender_id: null,
          sender_type: 'customer',
          tenant_id: 'tenant-1',
        },
        {
          created_at: '2026-06-02T09:00:00.000Z',
          customer_id: 'cust-1',
          id: 'msg-1',
          is_read: true,
          message: 'Tin cu cua A',
          sender_id: 'user-1',
          sender_type: 'staff',
          tenant_id: 'tenant-1',
        },
      ],
      error: null,
    });

    await expect(getChatCustomers()).resolves.toEqual([
      expect.objectContaining({
        id: 'cust-1',
        last_message: 'Tin moi cua A',
        last_message_at: '2026-06-03T09:00:00.000Z',
      }),
      expect.objectContaining({
        id: 'cust-2',
        last_message: 'Tin moi cua B',
        last_message_at: '2026-06-03T09:30:00.000Z',
      }),
    ]);

    expect(mockRpc).toHaveBeenCalledWith('get_chat_customers');
    expect(queryCalls).toEqual([
      expect.objectContaining({
        table: 'users',
        selectColumns: 'tenant_id',
        filters: [{ method: 'eq', args: ['id', 'user-1'] }],
      }),
      expect.objectContaining({
        table: 'chat_messages',
        selectColumns: '*',
        filters: expect.arrayContaining([
          { method: 'eq', args: ['tenant_id', 'tenant-1'] },
          { method: 'in', args: ['customer_id', ['cust-1', 'cust-2']] },
        ]),
        orders: [{ column: 'created_at', options: { ascending: false } }],
      }),
    ]);
  });

  it('throws instead of returning silent empty previews when latest message query fails', async () => {
    seedAuthContext();
    scriptedRpcResult = { data: customerRows, error: null };
    scriptedResults.push({ data: null, error: { message: 'preview query failed' } });

    await expect(getChatCustomers()).rejects.toEqual({ message: 'preview query failed' });
  });

  it('loads messages only after verifying the selected customer belongs to the current tenant', async () => {
    seedAuthContext();
    scriptedResults.push(
      { data: { tenant_id: 'tenant-1' }, error: null },
      {
        data: [
          {
            created_at: '2026-06-03T09:00:00.000Z',
            customer_id: 'cust-1',
            id: 'msg-1',
            is_read: false,
            message: 'Can tu van',
            sender_id: null,
            sender_type: 'customer',
            tenant_id: 'tenant-1',
          },
        ],
        error: null,
      },
    );

    await expect(getChatMessages('cust-1')).resolves.toEqual([
      expect.objectContaining({ id: 'msg-1', tenant_id: 'tenant-1' }),
    ]);

    expect(queryCalls[1]).toEqual(expect.objectContaining({
      table: 'customers',
      selectColumns: 'tenant_id',
      filters: expect.arrayContaining([
        { method: 'eq', args: ['id', 'cust-1'] },
        { method: 'eq', args: ['tenant_id', 'tenant-1'] },
      ]),
      single: true,
    }));
    expect(queryCalls[2]).toEqual(expect.objectContaining({
      table: 'chat_messages',
      selectColumns: '*',
      filters: expect.arrayContaining([
        { method: 'eq', args: ['customer_id', 'cust-1'] },
        { method: 'eq', args: ['tenant_id', 'tenant-1'] },
      ]),
      orders: [{ column: 'created_at', options: { ascending: true } }],
    }));
  });

  it('inserts staff messages with authenticated sender and tenant payload', async () => {
    seedAuthContext();
    scriptedResults.push(
      { data: { tenant_id: 'tenant-1' }, error: null },
      {
        data: {
          created_at: '2026-06-03T10:00:00.000Z',
          customer_id: 'cust-1',
          id: 'msg-staff-1',
          is_read: false,
          message: 'Spa se lien he lai',
          sender_id: 'user-1',
          sender_type: 'staff',
          tenant_id: 'tenant-1',
        },
        error: null,
      },
    );

    await expect(sendChatMessage('cust-1', '  Spa se lien he lai  ')).resolves.toEqual(
      expect.objectContaining({
        id: 'msg-staff-1',
        message: 'Spa se lien he lai',
        sender_id: 'user-1',
        sender_type: 'staff',
        tenant_id: 'tenant-1',
      })
    );

    expect(queryCalls[2]).toEqual(expect.objectContaining({
      table: 'chat_messages',
      operation: 'insert',
      payload: {
        customer_id: 'cust-1',
        is_read: false,
        message: 'Spa se lien he lai',
        sender_id: 'user-1',
        sender_type: 'staff',
        tenant_id: 'tenant-1',
      },
      selectColumns: undefined,
      single: true,
    }));
  });

  it('rejects blank staff messages before any database query', async () => {
    await expect(sendChatMessage('cust-1', '   ')).rejects.toThrow('Noi dung tin nhan khong duoc de trong.');

    expect(queryCalls).toHaveLength(0);
  });

  it('marks only unread customer messages as read for the verified tenant', async () => {
    seedAuthContext();
    scriptedResults.push(
      { data: { tenant_id: 'tenant-1' }, error: null },
      { data: null, error: null },
    );

    await expect(markMessagesAsRead('cust-1')).resolves.toBeUndefined();

    expect(queryCalls[2]).toEqual(expect.objectContaining({
      table: 'chat_messages',
      operation: 'update',
      payload: { is_read: true },
      filters: expect.arrayContaining([
        { method: 'eq', args: ['customer_id', 'cust-1'] },
        { method: 'eq', args: ['sender_type', 'customer'] },
        { method: 'eq', args: ['is_read', false] },
        { method: 'eq', args: ['tenant_id', 'tenant-1'] },
      ]),
    }));
  });

  it('propagates mark-read update failures', async () => {
    seedAuthContext();
    scriptedResults.push(
      { data: { tenant_id: 'tenant-1' }, error: null },
      { data: null, error: { message: 'update denied' } },
    );

    await expect(markMessagesAsRead('cust-1')).rejects.toEqual({ message: 'update denied' });
  });
});
