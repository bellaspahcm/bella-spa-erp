/**
 * Audit Utilities Unit Tests
 * 
 * Tests for audit trail logging functions.
 */

import { writeAudit, getHistory, queryHistory, getRecentChanges } from '../audit';
import { createClient } from '@/lib/supabase-server';

// Mock Supabase client
jest.mock('@/lib/supabase-server');

describe('Audit Utilities', () => {
  let mockSupabase: any;
  let mockQueryBuilder: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup chainable mock query builder that resolves when awaited
    mockQueryBuilder = {
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      // Make the query builder itself awaitable (for `await query` pattern)
      then: jest.fn((resolve) => resolve({ data: [], error: null })),
    };

    // Default: resolve with empty data
    mockQueryBuilder.range.mockReturnValue({
      then: jest.fn((resolve) => resolve({ data: [], error: null })),
    });
    mockQueryBuilder.limit.mockReturnValue({
      then: jest.fn((resolve) => resolve({ data: [], error: null })),
    });

    // Setup mock Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnValue({
        insert: jest.fn().mockResolvedValue({ data: null, error: null }),
        select: jest.fn().mockReturnValue(mockQueryBuilder),
      }),
    };

    (createClient as jest.Mock).mockResolvedValue(mockSupabase);
  });

  // ========================================
  // Write Audit Tests
  // ========================================

  describe('writeAudit()', () => {
    it('should write audit log successfully', async () => {
      await writeAudit({
        policyId: 'test-policy',
        version: '1.0.0',
        action: 'created',
        userId: 'user-123',
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('policy_history');
      const insertMock = mockSupabase.from().insert;
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          policy_id: 'test-policy',
          version: '1.0.0',
          action: 'created',
          created_by: 'user-123',
        })
      );
    });

    it('should include optional fields', async () => {
      await writeAudit({
        policyId: 'test-policy',
        version: '1.0.0',
        action: 'updated',
        fieldChanged: 'status',
        oldValue: { status: 'draft' },
        newValue: { status: 'active' },
        reason: 'Publishing policy',
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      const insertMock = mockSupabase.from().insert;
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          field_changed: 'status',
          old_value: { status: 'draft' },
          new_value: { status: 'active' },
          reason: 'Publishing policy',
          ip_address: '192.168.1.1',
          user_agent: 'Mozilla/5.0',
        })
      );
    });

    it('should throw error if insert fails', async () => {
      // Override insert for this test to return error
      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Database error'),
        }),
      });

      await expect(
        writeAudit({
          policyId: 'test-policy',
          version: '1.0.0',
          action: 'created',
          userId: 'user-123',
        })
      ).rejects.toThrow('Database error');
    });
  });

  // ========================================
  // Get History Tests
  // ========================================

  describe('getHistory()', () => {
    it('should get history for policy and version', async () => {
      const mockHistory = [
        {
          id: '1',
          policy_id: 'test-policy',
          version: '1.0.0',
          action: 'created',
          created_at: '2026-01-01T00:00:00Z',
          created_by: 'user-123',
        },
        {
          id: '2',
          policy_id: 'test-policy',
          version: '1.0.0',
          action: 'published',
          created_at: '2026-01-02T00:00:00Z',
          created_by: 'user-456',
        },
      ];

      // Override range to return a thenable that resolves with mockHistory
      mockQueryBuilder.range.mockReturnValueOnce({
        then: jest.fn((resolve) => Promise.resolve(resolve({ data: mockHistory, error: null }))),
      });

      const result = await getHistory({ policyId: 'test-policy', version: '1.0.0', limit: 10 });

      expect(mockSupabase.from).toHaveBeenCalledWith('policy_history');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('policy_id', 'test-policy');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('version', '1.0.0');
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(mockQueryBuilder.range).toHaveBeenCalledWith(0, 9); // limit 10 = range(0, 9)
      expect(result).toHaveLength(2);
      expect(result[0].policyId).toBe('test-policy');
      expect(result[1].action).toBe('published');
    });

    it('should get history for all versions when version not specified', async () => {
      const mockHistory = [
        {
          id: '1',
          policy_id: 'test-policy',
          version: '1.0.0',
          action: 'created',
          created_at: '2026-01-01T00:00:00Z',
          created_by: 'user-123',
        },
        {
          id: '2',
          policy_id: 'test-policy',
          version: '2.0.0',
          action: 'created',
          created_at: '2026-02-01T00:00:00Z',
          created_by: 'user-456',
        },
      ];

      // When NO limit, query is awaited directly (not .range())
      // Override the query builder's `then` method to return mock history
      mockQueryBuilder.then.mockImplementationOnce((resolve) => 
        Promise.resolve(resolve({ data: mockHistory, error: null }))
      );

      const result = await getHistory({ policyId: 'test-policy' });

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('policy_id', 'test-policy');
      expect(mockQueryBuilder.eq).toHaveBeenCalledTimes(1); // Only once for policyId
      expect(result).toHaveLength(2);
      expect(result[0].policyId).toBe('test-policy');
      expect(result[1].version).toBe('2.0.0');
    });

    it('should support pagination', async () => {
      await getHistory({ policyId: 'test-policy', limit: 10, offset: 20 });

      expect(mockQueryBuilder.range).toHaveBeenCalledWith(20, 29); // offset to offset + limit - 1
    });
  });

  // ========================================
  // Query History Tests
  // ========================================

  describe('queryHistory()', () => {
    it('should query history with filters', async () => {
      const mockHistory = [
        {
          id: '1',
          policy_id: 'test-policy',
          version: '1.0.0',
          action: 'published',
          created_at: '2026-06-01T00:00:00Z',
          created_by: 'user-123',
        },
      ];

      mockQueryBuilder.range.mockResolvedValueOnce({
        data: mockHistory,
        error: null,
        count: 1,
      });

      const result = await queryHistory({
        policyId: 'test-policy',
        action: 'published',
        dateFrom: '2026-05-01',
        dateTo: '2026-07-01',
        limit: 50,
      });

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('policy_id', 'test-policy');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('action', 'published');
      expect(mockQueryBuilder.gte).toHaveBeenCalledWith('created_at', '2026-05-01');
      expect(mockQueryBuilder.lte).toHaveBeenCalledWith('created_at', '2026-07-01');
      expect(result.history).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by user', async () => {
      mockQueryBuilder.range.mockResolvedValueOnce({
        data: [],
        error: null,
        count: 0,
      });

      await queryHistory({ createdBy: 'user-123' });

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('created_by', 'user-123');
    });

    it('should apply default limit', async () => {
      mockQueryBuilder.range.mockResolvedValueOnce({
        data: [],
        error: null,
        count: 0,
      });

      await queryHistory({});

      expect(mockQueryBuilder.range).toHaveBeenCalledWith(0, 49); // Default limit 50
    });
  });

  // ========================================
  // Get Recent Changes Tests
  // ========================================

  describe('getRecentChanges()', () => {
    it('should get recent changes with default limit', async () => {
      const mockChanges = Array.from({ length: 50 }, (_, i) => ({
        id: `${i + 1}`,
        policy_id: 'policy-1',
        version: '1.0.0',
        action: 'updated',
        created_at: new Date().toISOString(),
        created_by: 'user-123',
      }));

      mockQueryBuilder.limit.mockResolvedValueOnce({ data: mockChanges, error: null });

      const result = await getRecentChanges();

      expect(mockSupabase.from).toHaveBeenCalledWith('policy_history');
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(50);
      expect(result).toHaveLength(50);
    });

    it('should respect custom limit', async () => {
      mockQueryBuilder.limit.mockResolvedValueOnce({ data: [], error: null });

      await getRecentChanges(100);

      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(100);
    });
  });
});
