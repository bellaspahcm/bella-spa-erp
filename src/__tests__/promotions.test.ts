/**
 * Unit tests for Promotions Server Actions.
 * Covers tenant scoping, explicit DB failures, and audit rollback side effects.
 */

jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('../services/audit-actions', () => ({
  recordAuditLog: jest.fn().mockResolvedValue({ success: true }),
}));
jest.mock('../services/user-actions', () => ({
  getCurrentUser: jest.fn(),
}));

import { revalidatePath } from 'next/cache';
import { recordAuditLog } from '../services/audit-actions';
import { getCurrentUser } from '../services/user-actions';
import type { Database } from '@/types/database.types';
import {
  createPromotion,
  deletePromotion,
  getPromotions,
  togglePromotionActive,
} from '../services/promotions-actions';

type DbError = { message: string };
type QueryResult = { data: unknown; error: DbError | null };
type Filter = { column: string; value: unknown };
type QueryCall = {
  table: string;
  operation: 'select' | 'insert' | 'update' | 'delete';
  payload?: unknown;
  filters: Filter[];
  order?: { column: string; options?: unknown };
  select?: unknown[];
};
type CurrentUser = Awaited<ReturnType<typeof getCurrentUser>>;
type PromotionRow = Database['public']['Tables']['promotions']['Row'];

const queryCalls: QueryCall[] = [];
let scriptedResults: QueryResult[] = [];

class QueryBuilder implements PromiseLike<QueryResult> {
  private operation: QueryCall['operation'] = 'select';
  private payload?: unknown;
  private filters: Filter[] = [];
  private selectArgs?: unknown[];
  private orderCall?: { column: string; options?: unknown };

  constructor(private readonly table: string) {}

  select(...args: unknown[]) {
    this.selectArgs = args;
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

  delete() {
    this.operation = 'delete';
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  order(column: string, options?: unknown) {
    this.orderCall = { column, options };
    return this.resolve();
  }

  single() {
    return this.resolve();
  }

  maybeSingle() {
    return this.resolve();
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.resolve().then(onfulfilled, onrejected);
  }

  private resolve() {
    queryCalls.push({
      table: this.table,
      operation: this.operation,
      payload: this.payload,
      filters: [...this.filters],
      order: this.orderCall,
      select: this.selectArgs,
    });

    return Promise.resolve(scriptedResults.shift() ?? { data: null, error: null });
  }
}

const mockSupabase = {
  from: jest.fn((table: string) => new QueryBuilder(table)),
};

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

const mockGetCurrentUser = getCurrentUser as jest.MockedFunction<typeof getCurrentUser>;
const mockRecordAuditLog = recordAuditLog as jest.MockedFunction<typeof recordAuditLog>;
const mockRevalidatePath = revalidatePath as jest.MockedFunction<typeof revalidatePath>;

const currentUser = (tenantId = 'tenant-123'): CurrentUser =>
  ({
    id: 'user-1',
    email: 'user@example.com',
    role: 'admin',
    tenant_id: tenantId,
    full_name: 'Staff',
  }) as CurrentUser;

const promotion = (overrides: Partial<PromotionRow> = {}): PromotionRow => ({
  id: 'promo-1',
  title: 'Mother Day',
  description: 'Discount services',
  image_url: null,
  discount_code: 'MOTHER10',
  discount_percent: 10,
  start_date: '2026-05-01',
  end_date: '2026-05-31',
  is_active: true,
  tenant_id: 'tenant-123',
  created_at: '2026-05-01T00:00:00.000Z',
  updated_at: '2026-05-01T00:00:00.000Z',
  ...overrides,
});

const payload = {
  title: 'Mother Day',
  description: 'Discount services',
  discount_code: 'MOTHER10',
  discount_percent: 10,
  start_date: '2026-05-01',
  end_date: '2026-05-31',
};

describe('Promotions Server Actions System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryCalls.length = 0;
    scriptedResults = [];
    mockRecordAuditLog.mockResolvedValue({ success: true });
  });

  describe('getPromotions', () => {
    it('returns empty array when user has no tenant_id', async () => {
      mockGetCurrentUser.mockResolvedValue(currentUser(''));

      const res = await getPromotions();

      expect(res).toEqual([]);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('returns promotions list scoped by tenant_id', async () => {
      const rows = [promotion()];
      mockGetCurrentUser.mockResolvedValue(currentUser());
      scriptedResults = [{ data: rows, error: null }];

      const res = await getPromotions();

      expect(res).toEqual(rows);
      expect(queryCalls[0]).toMatchObject({
        table: 'promotions',
        operation: 'select',
        filters: [{ column: 'tenant_id', value: 'tenant-123' }],
        order: { column: 'created_at', options: { ascending: false } },
      });
    });

    it('propagates error when query fails', async () => {
      mockGetCurrentUser.mockResolvedValue(currentUser());
      scriptedResults = [{ data: null, error: { message: 'Database crash' } }];

      await expect(getPromotions()).rejects.toThrow('Database crash');
    });
  });

  describe('createPromotion', () => {
    it('returns error if user not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const res = await createPromotion(payload);

      expect(res.success).toBe(false);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('returns error if missing title or description', async () => {
      mockGetCurrentUser.mockResolvedValue(currentUser());

      const res = await createPromotion({ title: '', description: 'Some description' });

      expect(res.success).toBe(false);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('inserts promotion with tenant_id and records audit', async () => {
      const createdPromo = promotion();
      mockGetCurrentUser.mockResolvedValue(currentUser());
      scriptedResults = [{ data: createdPromo, error: null }];

      const res = await createPromotion(payload);

      expect(res.success).toBe(true);
      expect(res.data).toEqual(createdPromo);
      expect(queryCalls[0]).toMatchObject({
        table: 'promotions',
        operation: 'insert',
        payload: {
          title: 'Mother Day',
          description: 'Discount services',
          discount_code: 'MOTHER10',
          discount_percent: 10,
          start_date: '2026-05-01',
          end_date: '2026-05-31',
          is_active: true,
          tenant_id: 'tenant-123',
          image_url: null,
        },
      });
      expect(mockRecordAuditLog).toHaveBeenCalledWith({
        action: 'INSERT',
        table_name: 'promotions',
        record_id: 'promo-1',
        new_data: expect.objectContaining({ id: 'promo-1', tenant_id: 'tenant-123' }),
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/settings');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/crm');
    });

    it('normalizes voucher code, percent, and text before inserting', async () => {
      const createdPromo = promotion({
        title: 'Mother Day',
        description: 'Discount services',
        discount_code: 'MOTHER33',
        discount_percent: 100,
      });
      mockGetCurrentUser.mockResolvedValue(currentUser());
      scriptedResults = [{ data: createdPromo, error: null }];

      const res = await createPromotion({
        title: '  Mother Day  ',
        description: '  Discount services  ',
        discount_code: ' mother 33 ',
        discount_percent: 150,
        start_date: '',
        end_date: null,
      });

      expect(res.success).toBe(true);
      expect(queryCalls[0]).toMatchObject({
        table: 'promotions',
        operation: 'insert',
        payload: {
          title: 'Mother Day',
          description: 'Discount services',
          discount_code: 'MOTHER33',
          discount_percent: 100,
          start_date: null,
          end_date: null,
          is_active: true,
          tenant_id: 'tenant-123',
          image_url: null,
        },
      });
    });

    it('returns error when promotion date range is invalid', async () => {
      mockGetCurrentUser.mockResolvedValue(currentUser());

      const res = await createPromotion({
        ...payload,
        start_date: '2026-06-30',
        end_date: '2026-06-01',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('Ngay bat dau khong duoc sau ngay ket thuc.');
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('returns error with DB failure', async () => {
      mockGetCurrentUser.mockResolvedValue(currentUser());
      scriptedResults = [{ data: null, error: { message: 'Insert constraint violation' } }];

      const res = await createPromotion(payload);

      expect(res.success).toBe(false);
      expect(res.error).toBe('Insert constraint violation');
      expect(mockRecordAuditLog).not.toHaveBeenCalled();
    });

    it('rolls back inserted promotion when audit fails', async () => {
      mockGetCurrentUser.mockResolvedValue(currentUser());
      mockRecordAuditLog.mockRejectedValueOnce(new Error('audit down'));
      scriptedResults = [
        { data: promotion(), error: null },
        { data: null, error: null },
      ];

      const res = await createPromotion(payload);

      expect(res.success).toBe(false);
      expect(res.error).toContain('Audit log failed after promotion insert: audit down');
      expect(queryCalls[1]).toMatchObject({
        table: 'promotions',
        operation: 'delete',
        filters: [
          { column: 'id', value: 'promo-1' },
          { column: 'tenant_id', value: 'tenant-123' },
        ],
      });
      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });

    it('reports rollback failure when audit and rollback both fail', async () => {
      mockGetCurrentUser.mockResolvedValue(currentUser());
      mockRecordAuditLog.mockRejectedValueOnce(new Error('audit down'));
      scriptedResults = [
        { data: promotion(), error: null },
        { data: null, error: { message: 'rollback denied' } },
      ];

      const res = await createPromotion(payload);

      expect(res.success).toBe(false);
      expect(res.error).toContain('Rollback failed');
      expect(res.error).toContain('rollback denied');
    });
  });

  describe('togglePromotionActive', () => {
    it('updates is_active with tenant scope and records old/new audit data', async () => {
      const before = promotion({ is_active: true });
      const after = promotion({ is_active: false, updated_at: '2026-05-02T00:00:00.000Z' });
      mockGetCurrentUser.mockResolvedValue(currentUser());
      scriptedResults = [
        { data: before, error: null },
        { data: after, error: null },
      ];

      const res = await togglePromotionActive('promo-1', false);

      expect(res.success).toBe(true);
      expect(res.data).toEqual(after);
      expect(queryCalls[0]).toMatchObject({
        table: 'promotions',
        operation: 'select',
        filters: [
          { column: 'id', value: 'promo-1' },
          { column: 'tenant_id', value: 'tenant-123' },
        ],
      });
      expect(queryCalls[1]).toMatchObject({
        table: 'promotions',
        operation: 'update',
        filters: [
          { column: 'id', value: 'promo-1' },
          { column: 'tenant_id', value: 'tenant-123' },
        ],
      });
      expect(queryCalls[1].payload).toMatchObject({ is_active: false });
      expect(mockRecordAuditLog).toHaveBeenCalledWith({
        action: 'UPDATE',
        table_name: 'promotions',
        record_id: 'promo-1',
        old_data: expect.objectContaining({ is_active: true }),
        new_data: expect.objectContaining({ is_active: false }),
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/settings');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/crm');
    });

    it('does not update when snapshot is missing', async () => {
      mockGetCurrentUser.mockResolvedValue(currentUser());
      scriptedResults = [{ data: null, error: null }];

      const res = await togglePromotionActive('promo-1', false);

      expect(res.success).toBe(false);
      expect(queryCalls).toHaveLength(1);
      expect(mockRecordAuditLog).not.toHaveBeenCalled();
    });

    it('returns update failure without audit or revalidate', async () => {
      mockGetCurrentUser.mockResolvedValue(currentUser());
      scriptedResults = [
        { data: promotion(), error: null },
        { data: null, error: { message: 'Update failed' } },
      ];

      const res = await togglePromotionActive('promo-1', false);

      expect(res.success).toBe(false);
      expect(res.error).toBe('Update failed');
      expect(mockRecordAuditLog).not.toHaveBeenCalled();
      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });

    it('rolls back status update when audit fails', async () => {
      const before = promotion({ is_active: true, updated_at: 'old-date' });
      const after = promotion({ is_active: false, updated_at: 'new-date' });
      mockGetCurrentUser.mockResolvedValue(currentUser());
      mockRecordAuditLog.mockRejectedValueOnce(new Error('audit down'));
      scriptedResults = [
        { data: before, error: null },
        { data: after, error: null },
        { data: null, error: null },
      ];

      const res = await togglePromotionActive('promo-1', false);

      expect(res.success).toBe(false);
      expect(res.error).toContain('Audit log failed after promotion update: audit down');
      expect(queryCalls[2]).toMatchObject({
        table: 'promotions',
        operation: 'update',
        payload: { is_active: true, updated_at: 'old-date' },
        filters: [
          { column: 'id', value: 'promo-1' },
          { column: 'tenant_id', value: 'tenant-123' },
        ],
      });
      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });
  });

  describe('deletePromotion', () => {
    it('deletes promotion with tenant scope and records old audit data', async () => {
      const before = promotion();
      mockGetCurrentUser.mockResolvedValue(currentUser());
      scriptedResults = [
        { data: before, error: null },
        { data: null, error: null },
      ];

      const res = await deletePromotion('promo-1');

      expect(res.success).toBe(true);
      expect(queryCalls[1]).toMatchObject({
        table: 'promotions',
        operation: 'delete',
        filters: [
          { column: 'id', value: 'promo-1' },
          { column: 'tenant_id', value: 'tenant-123' },
        ],
      });
      expect(mockRecordAuditLog).toHaveBeenCalledWith({
        action: 'DELETE',
        table_name: 'promotions',
        record_id: 'promo-1',
        old_data: expect.objectContaining({ id: 'promo-1', tenant_id: 'tenant-123' }),
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/settings');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/crm');
    });

    it('returns delete failure without audit or revalidate', async () => {
      mockGetCurrentUser.mockResolvedValue(currentUser());
      scriptedResults = [
        { data: promotion(), error: null },
        { data: null, error: { message: 'Delete restricted' } },
      ];

      const res = await deletePromotion('promo-1');

      expect(res.success).toBe(false);
      expect(res.error).toBe('Delete restricted');
      expect(mockRecordAuditLog).not.toHaveBeenCalled();
      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });

    it('restores deleted promotion when audit fails', async () => {
      const before = promotion();
      mockGetCurrentUser.mockResolvedValue(currentUser());
      mockRecordAuditLog.mockRejectedValueOnce(new Error('audit down'));
      scriptedResults = [
        { data: before, error: null },
        { data: null, error: null },
        { data: null, error: null },
      ];

      const res = await deletePromotion('promo-1');

      expect(res.success).toBe(false);
      expect(res.error).toContain('Audit log failed after promotion delete: audit down');
      expect(queryCalls[2]).toMatchObject({
        table: 'promotions',
        operation: 'insert',
        payload: expect.objectContaining({
          id: 'promo-1',
          tenant_id: 'tenant-123',
          is_active: true,
        }),
      });
      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });
  });
});
