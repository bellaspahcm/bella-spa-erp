/**
 * Unit tests for Promotions Server Actions (getPromotions, createPromotion, togglePromotionActive, deletePromotion)
 * Validates role-based tenant checks, correct payload parameters, and Zero Silent Database Failures.
 */

// Bypass Next.js server-only check
jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

// Mock audit logging
jest.mock('../services/audit-actions', () => ({
  recordAuditLog: jest.fn().mockResolvedValue({ success: true }),
}));

// Supabase mock environment
const mockEq = jest.fn().mockReturnThis();
const mockSelect = jest.fn().mockReturnThis();
const mockOrder = jest.fn().mockReturnThis();
const mockSingle = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();

const mockSupabase = {
  from: jest.fn((table: string) => ({
    select: mockSelect,
    eq: mockEq,
    order: mockOrder,
    single: mockSingle,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  })),
};

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

import { getCurrentUser } from '../services/user-actions';
const mockGetCurrentUser = getCurrentUser as jest.MockedFunction<typeof getCurrentUser>;
jest.mock('../services/user-actions', () => {
  return {
    getCurrentUser: jest.fn(),
  };
});

import {
  getPromotions,
  createPromotion,
  togglePromotionActive,
  deletePromotion,
} from '../services/promotions-actions';

describe('Promotions Server Actions System', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockSelect.mockReturnValue({
      eq: mockEq,
      order: mockOrder,
      single: mockSingle,
    });
    mockEq.mockReturnValue({
      order: mockOrder,
      single: mockSingle,
    });
    mockOrder.mockResolvedValue({ data: [], error: null });
  });

  describe('getPromotions', () => {
    it('returns empty array when user has no tenant_id', async () => {
      mockGetCurrentUser.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        role: 'admin',
        tenant_id: '',
        full_name: 'Staff',
      });

      const res = await getPromotions();
      expect(res).toEqual([]);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('returns promotions list when user has tenant_id', async () => {
      mockGetCurrentUser.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        role: 'admin',
        tenant_id: 'tenant-123',
        full_name: 'Staff',
      });

      const mockData = [
        { id: 'promo-1', title: 'Mẹ Bầu VIP', is_active: true, tenant_id: 'tenant-123' }
      ];
      mockOrder.mockResolvedValue({ data: mockData, error: null });

      const res = await getPromotions();
      expect(res).toEqual(mockData);
      expect(mockSupabase.from).toHaveBeenCalledWith('promotions');
      expect(mockEq).toHaveBeenCalledWith('tenant_id', 'tenant-123');
    });

    it('propagates error when query fails (Rule 1: Zero Silent Failures)', async () => {
      mockGetCurrentUser.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        role: 'admin',
        tenant_id: 'tenant-123',
        full_name: 'Staff',
      });

      mockOrder.mockResolvedValue({ data: null, error: { message: 'Database crash' } });

      await expect(getPromotions()).rejects.toThrow('Lỗi truy vấn cơ sở dữ liệu: Database crash');
    });
  });

  describe('createPromotion', () => {
    const payload = {
      title: 'Mừng Ngày Của Mẹ',
      description: 'Giảm giá 10% các dịch vụ',
      discount_code: 'MOTHER10',
      discount_percent: 10,
      start_date: '2026-05-01',
      end_date: '2026-05-31',
    };

    it('returns error if user not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null as any);
      const res = await createPromotion(payload);
      expect(res.success).toBe(false);
      expect(res.error).toBe('Không có quyền thực hiện. Vui lòng đăng nhập.');
    });

    it('returns error if missing title or description', async () => {
      mockGetCurrentUser.mockResolvedValue({
        id: 'user-1',
        role: 'admin',
        tenant_id: 'tenant-123',
      } as any);

      const res = await createPromotion({ title: '', description: 'Some description' });
      expect(res.success).toBe(false);
      expect(res.error).toBe('Tiêu đề và Mô tả là bắt buộc.');
    });

    it('successfully inserts promotion with tenant_id', async () => {
      mockGetCurrentUser.mockResolvedValue({
        id: 'user-1',
        role: 'admin',
        tenant_id: 'tenant-123',
      } as any);

      const createdPromo = { id: 'promo-abc', ...payload, tenant_id: 'tenant-123', is_active: true };

      mockInsert.mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: createdPromo, error: null }),
        }),
      });

      const res = await createPromotion(payload);

      expect(res.success).toBe(true);
      expect(res.data).toEqual(createdPromo);
      expect(mockInsert).toHaveBeenCalledWith({
        title: 'Mừng Ngày Của Mẹ',
        description: 'Giảm giá 10% các dịch vụ',
        discount_code: 'MOTHER10',
        discount_percent: 10,
        start_date: '2026-05-01',
        end_date: '2026-05-31',
        is_active: true,
        tenant_id: 'tenant-123',
        image_url: null,
      });
    });

    it('returns error with DB failure (Zero Silent Failures)', async () => {
      mockGetCurrentUser.mockResolvedValue({
        id: 'user-1',
        role: 'admin',
        tenant_id: 'tenant-123',
      } as any);

      mockInsert.mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Insert constraint violation' } }),
        }),
      });

      const res = await createPromotion(payload);
      expect(res.success).toBe(false);
      expect(res.error).toBe('Insert constraint violation');
    });
  });

  describe('togglePromotionActive', () => {
    it('successfully updates is_active status', async () => {
      mockGetCurrentUser.mockResolvedValue({ id: 'user-1', role: 'admin' } as any);

      mockUpdate.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { id: 'promo-1', is_active: false }, error: null }),
          }),
        }),
      });

      const res = await togglePromotionActive('promo-1', false);
      expect(res.success).toBe(true);
      expect(res.data?.is_active).toBe(false);
    });

    it('handles failure during status toggle', async () => {
      mockGetCurrentUser.mockResolvedValue({ id: 'user-1', role: 'admin' } as any);

      mockUpdate.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Update failed' } }),
          }),
        }),
      });

      const res = await togglePromotionActive('promo-1', false);
      expect(res.success).toBe(false);
      expect(res.error).toBe('Update failed');
    });
  });

  describe('deletePromotion', () => {
    it('successfully deletes promotion', async () => {
      mockGetCurrentUser.mockResolvedValue({ id: 'user-1', role: 'admin' } as any);
      mockDelete.mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });

      const res = await deletePromotion('promo-1');
      expect(res.success).toBe(true);
    });

    it('handles failure during deletion', async () => {
      mockGetCurrentUser.mockResolvedValue({ id: 'user-1', role: 'admin' } as any);
      mockDelete.mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: { message: 'Delete restricted' } }),
      });

      const res = await deletePromotion('promo-1');
      expect(res.success).toBe(false);
      expect(res.error).toBe('Delete restricted');
    });
  });
});
