const mockCreateClient = jest.fn();
const mockRevalidatePath = jest.fn();

jest.mock('@/lib/supabase-server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

jest.mock('next/cache', () => ({
  revalidatePath: (path: string) => mockRevalidatePath(path),
}));

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

type QueryCall = {
  table: string;
  operation: 'select' | 'update';
  payload?: unknown;
  selectColumns?: string;
  filters: Array<{ method: string; args: unknown[] }>;
  orders: Array<{ column: string; options?: unknown }>;
  limitCount?: number;
  single: boolean;
};

const queryCalls: QueryCall[] = [];
let scriptedResults: QueryResult[] = [];

class QueryBuilder implements PromiseLike<QueryResult> {
  private operation: 'select' | 'update' = 'select';
  private payload?: unknown;
  private selectColumns?: string;
  private filters: Array<{ method: string; args: unknown[] }> = [];
  private orders: Array<{ column: string; options?: unknown }> = [];
  private limitCount?: number;
  private isSingle = false;

  constructor(private readonly table: string) {}

  select(columns?: string) {
    this.selectColumns = columns;
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

  order(column: string, options?: unknown) {
    this.orders.push({ column, options });
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
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
      table: this.table,
      operation: this.operation,
      payload: this.payload,
      selectColumns: this.selectColumns,
      filters: [...this.filters],
      orders: [...this.orders],
      limitCount: this.limitCount,
      single: this.isSingle,
    });

    return Promise.resolve(scriptedResults.shift() ?? { data: null, error: null })
      .then(onfulfilled, onrejected);
  }
}

const mockAuthGetUser = jest.fn();
const mockSupabase = {
  auth: {
    getUser: mockAuthGetUser,
  },
  from: jest.fn((table: string) => new QueryBuilder(table)),
};

import {
  getUnreadNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '@/core/services/notification/notification-actions';

describe('notification actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryCalls.length = 0;
    scriptedResults = [];
    mockCreateClient.mockResolvedValue(mockSupabase);
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
  });

  it('returns explicit unauthorized failure for unread notifications without auth user', async () => {
    mockAuthGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    await expect(getUnreadNotifications()).resolves.toEqual({
      success: false,
      error: 'Unauthorized',
      data: [],
    });

    expect(queryCalls).toHaveLength(0);
  });

  it('returns explicit profile query failure without reading notifications', async () => {
    scriptedResults = [
      { data: null, error: { message: 'profile blocked' } },
    ];

    await expect(getUnreadNotifications()).resolves.toEqual({
      success: false,
      error: 'Failed to load notification tenant profile: profile blocked',
      data: [],
    });

    expect(queryCalls).toHaveLength(1);
    expect(queryCalls[0].table).toBe('users');
  });

  it('returns unread notifications when profile and notification query succeed', async () => {
    const notifications = [
      { id: 'notif-1', tenant_id: 'tenant-1', is_read: false },
    ];
    scriptedResults = [
      { data: { tenant_id: 'tenant-1' }, error: null },
      { data: notifications, error: null },
    ];

    await expect(getUnreadNotifications()).resolves.toEqual({
      success: true,
      data: notifications,
    });

    expect(queryCalls).toEqual([
      expect.objectContaining({
        table: 'users',
        selectColumns: 'tenant_id',
        filters: [{ method: 'eq', args: ['id', 'user-1'] }],
      }),
      expect.objectContaining({
        table: 'app_notifications',
        selectColumns: '*',
        filters: expect.arrayContaining([
          { method: 'eq', args: ['tenant_id', 'tenant-1'] },
          { method: 'eq', args: ['is_read', false] },
        ]),
        limitCount: 20,
      }),
    ]);
  });

  it('returns explicit unread notification query failure instead of silent empty data', async () => {
    scriptedResults = [
      { data: { tenant_id: 'tenant-1' }, error: null },
      { data: null, error: { message: 'notifications blocked' } },
    ];

    await expect(getUnreadNotifications()).resolves.toEqual({
      success: false,
      error: 'Failed to fetch unread notifications: notifications blocked',
      data: [],
    });
  });

  it('marks one notification as read scoped to the current tenant', async () => {
    scriptedResults = [
      { data: { tenant_id: 'tenant-1' }, error: null },
      { data: { id: 'notif-1' }, error: null },
    ];

    await expect(markNotificationAsRead('notif-1')).resolves.toEqual({ success: true });

    expect(queryCalls[1]).toEqual(expect.objectContaining({
      table: 'app_notifications',
      operation: 'update',
      payload: { is_read: true },
      selectColumns: 'id',
      single: true,
      filters: expect.arrayContaining([
        { method: 'eq', args: ['id', 'notif-1'] },
        { method: 'eq', args: ['tenant_id', 'tenant-1'] },
      ]),
    }));
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/ktv/dashboard');
  });

  it('fails one-notification mark when the scoped update returns no row', async () => {
    scriptedResults = [
      { data: { tenant_id: 'tenant-1' }, error: null },
      { data: null, error: null },
    ];

    await expect(markNotificationAsRead('other-tenant-notif')).resolves.toEqual({
      success: false,
      error: 'Notification not found for current tenant',
    });

    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('returns explicit update failure when marking one notification fails', async () => {
    scriptedResults = [
      { data: { tenant_id: 'tenant-1' }, error: null },
      { data: null, error: { message: 'update denied' } },
    ];

    await expect(markNotificationAsRead('notif-1')).resolves.toEqual({
      success: false,
      error: 'Failed to mark notification as read: update denied',
    });

    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('marks all unread notifications as read for the current tenant', async () => {
    scriptedResults = [
      { data: { tenant_id: 'tenant-1' }, error: null },
      { data: null, error: null },
    ];

    await expect(markAllNotificationsAsRead()).resolves.toEqual({ success: true });

    expect(queryCalls[1]).toEqual(expect.objectContaining({
      table: 'app_notifications',
      operation: 'update',
      payload: { is_read: true },
      filters: expect.arrayContaining([
        { method: 'eq', args: ['tenant_id', 'tenant-1'] },
        { method: 'eq', args: ['is_read', false] },
      ]),
    }));
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/ktv/dashboard');
  });

  it('returns explicit failure when mark-all update fails', async () => {
    scriptedResults = [
      { data: { tenant_id: 'tenant-1' }, error: null },
      { data: null, error: { message: 'bulk update denied' } },
    ];

    await expect(markAllNotificationsAsRead()).resolves.toEqual({
      success: false,
      error: 'Failed to mark all notifications as read: bulk update denied',
    });

    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});
