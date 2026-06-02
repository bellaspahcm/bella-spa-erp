/**
 * Accounting Outbox Integration & Background Worker Tests
 *
 * Verifies:
 *  1. Authorization & security of the cron api endpoint.
 *  2. Sequential processing of batches (fifos).
 *  3. Dynamic routing to specific bookkeeping handlers.
 *  4. Robust error capture and backoff state transitions (mark_outbox_failed).
 *  5. Mark outbox completed upon successful posting.
 */

// ── Setup environment variables BEFORE imports ──
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.CRON_SECRET = 'test-cron-secret-123';

// ── Mock Supabase Client ──
const mockRpc = jest.fn();
const mockClient = {
  rpc: mockRpc,
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockClient),
}));

// ── Mock Bookkeeping Handlers ──
import { RevenueRecognitionService } from '@/services/revenue-recognition';

jest.mock('@/services/revenue-recognition', () => ({
  RevenueRecognitionService: {
    handlePackageSale: jest.fn(),
    handleSessionDone: jest.fn(),
    handleExpenseRecorded: jest.fn(),
    handleSalaryPaid: jest.fn(),
    handleInventoryConsumed: jest.fn(),
    handleRefundIssued: jest.fn(),
  },
}));

jest.mock('@/services/accounting-engine', () => ({
  AccountingEngineService: {
    postJournalEntry: jest.fn(),
  },
}));

import { GET } from '@/app/api/cron/accounting-worker/route';
import { NextRequest } from 'next/server';

describe('Accounting Outbox Worker API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. Authentication Guards
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Authentication Guard', () => {
    it('returns 401 Unauthorized if Authorization header is missing', async () => {
      const req = new NextRequest('http://localhost/api/cron/accounting-worker', {
        method: 'GET',
      });

      const response = await GET(req);
      expect(response.status).toBe(401);

      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('Unauthorized');
    });

    it('returns 401 Unauthorized if Authorization token does not match CRON_SECRET', async () => {
      const req = new NextRequest('http://localhost/api/cron/accounting-worker', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer invalid-secret',
        },
      });

      const response = await GET(req);
      expect(response.status).toBe(401);

      const json = await response.json();
      expect(json.success).toBe(false);
    });

    it('proceeds if Authorization token matches CRON_SECRET', async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null }); // claim_outbox_batch returns empty array

      const req = new NextRequest('http://localhost/api/cron/accounting-worker', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer test-cron-secret-123',
        },
      });

      const response = await GET(req);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.processed).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. Event Routing & Bookkeeping Handlers
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Batch Event Processing & Routing', () => {
    it('claims pending outbox events, routes them to correct handlers, and completes them', async () => {
      // Setup mocked queue batch
      const mockBatch = [
        {
          id: 'outbox-id-1',
          tenant_id: 'tenant-uuid-1',
          event_type: 'PACKAGE_SALE',
          reference_id: 'ref-id-1',
          payload: {
            totalAmount: 1000000,
            vatRate: 0,
            description: 'Bán gói liệu trình mẹ bé',
            branchId: 'branch-1',
          },
          retry_count: 0,
        },
        {
          id: 'outbox-id-2',
          tenant_id: 'tenant-uuid-1',
          event_type: 'SESSION_DONE',
          reference_id: 'ref-id-2',
          payload: {
            earnedRevenueAmount: 200000,
            commissionAmount: 50000,
            ktvId: 'ktv-id-1',
            branchId: 'branch-1',
            description: 'Hoàn thành ca trị liệu',
          },
          retry_count: 0,
        },
      ];

      // 1. claim_outbox_batch returns the batch
      mockRpc.mockResolvedValueOnce({ data: mockBatch, error: null });
      // 2. handlePackageSale resolves to journal entry ID
      (RevenueRecognitionService.handlePackageSale as jest.Mock).mockResolvedValueOnce('journal-entry-1');
      // 3. mark_outbox_completed for first event resolves successfully
      mockRpc.mockResolvedValueOnce({ error: null });
      // 4. handleSessionDone resolves to journal entry ID
      (RevenueRecognitionService.handleSessionDone as jest.Mock).mockResolvedValueOnce('journal-entry-2');
      // 5. mark_outbox_completed for second event resolves successfully
      mockRpc.mockResolvedValueOnce({ error: null });

      const req = new NextRequest('http://localhost/api/cron/accounting-worker', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer test-cron-secret-123',
        },
      });

      const response = await GET(req);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.processed).toBe(2);
      expect(json.successCount).toBe(2);
      expect(json.failureCount).toBe(0);

      // Verify RPC claim call
      expect(mockRpc).toHaveBeenNthCalledWith(1, 'claim_outbox_batch', { p_limit: 50 });

      // Verify routing arguments
      expect(RevenueRecognitionService.handlePackageSale).toHaveBeenCalledWith({
        tenantId: 'tenant-uuid-1',
        packageSaleId: 'ref-id-1',
        totalAmount: 1000000,
        vatRate: 0,
        description: 'Bán gói liệu trình mẹ bé',
        branchId: 'branch-1',
      });

      expect(RevenueRecognitionService.handleSessionDone).toHaveBeenCalledWith({
        tenantId: 'tenant-uuid-1',
        sessionLogId: 'ref-id-2',
        earnedRevenueAmount: 200000,
        commissionAmount: 50000,
        ktvId: 'ktv-id-1',
        branchId: 'branch-1',
        description: 'Hoàn thành ca trị liệu',
      });

      // Verify completion updates in DB
      expect(mockRpc).toHaveBeenCalledWith('mark_outbox_completed', {
        p_outbox_id: 'outbox-id-1',
        p_journal_entry_id: 'journal-entry-1',
      });
      expect(mockRpc).toHaveBeenCalledWith('mark_outbox_completed', {
        p_outbox_id: 'outbox-id-2',
        p_journal_entry_id: 'journal-entry-2',
      });
    });

    it('handles other event types: EXPENSE_RECORDED, SALARY_PAID, INVENTORY_CONSUMED, REFUND_ISSUED', async () => {
      const mockBatch = [
        {
          id: 'outbox-id-3',
          tenant_id: 'tenant-uuid-1',
          event_type: 'EXPENSE_RECORDED',
          reference_id: 'ref-id-3',
          payload: { amount: 500000, category: 'rent', paymentMethod: 'bank_transfer', description: 'Thuê mặt bằng' },
        },
        {
          id: 'outbox-id-4',
          tenant_id: 'tenant-uuid-1',
          event_type: 'SALARY_PAID',
          reference_id: 'ref-id-4',
          payload: { amount: 8000000, paymentMethod: 'bank_transfer', description: 'Trả lương KTV', ktvId: 'ktv-1' },
        },
        {
          id: 'outbox-id-5',
          tenant_id: 'tenant-uuid-1',
          event_type: 'INVENTORY_CONSUMED',
          reference_id: 'ref-id-5',
          payload: { amount: 150000, description: 'Tiêu hao vật tư' },
        },
        {
          id: 'outbox-id-6',
          tenant_id: 'tenant-uuid-1',
          event_type: 'REFUND_ISSUED',
          reference_id: 'ref-id-6',
          payload: { amount: 300000, paymentMethod: 'cash', description: 'Hoàn tiền khách' },
        },
      ];

      mockRpc.mockResolvedValueOnce({ data: mockBatch, error: null });
      (RevenueRecognitionService.handleExpenseRecorded as jest.Mock).mockResolvedValueOnce('je-3');
      mockRpc.mockResolvedValueOnce({ error: null });
      (RevenueRecognitionService.handleSalaryPaid as jest.Mock).mockResolvedValueOnce('je-4');
      mockRpc.mockResolvedValueOnce({ error: null });
      (RevenueRecognitionService.handleInventoryConsumed as jest.Mock).mockResolvedValueOnce('je-5');
      mockRpc.mockResolvedValueOnce({ error: null });
      (RevenueRecognitionService.handleRefundIssued as jest.Mock).mockResolvedValueOnce('je-6');
      mockRpc.mockResolvedValueOnce({ error: null });

      const req = new NextRequest('http://localhost/api/cron/accounting-worker', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer test-cron-secret-123',
        },
      });

      const response = await GET(req);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.successCount).toBe(4);

      expect(RevenueRecognitionService.handleExpenseRecorded).toHaveBeenCalledWith(expect.objectContaining({ expenseId: 'ref-id-3' }));
      expect(RevenueRecognitionService.handleSalaryPaid).toHaveBeenCalledWith(expect.objectContaining({ salaryRecordId: 'ref-id-4' }));
      expect(RevenueRecognitionService.handleInventoryConsumed).toHaveBeenCalledWith(expect.objectContaining({ sessionLogId: 'ref-id-5' }));
      expect(RevenueRecognitionService.handleRefundIssued).toHaveBeenCalledWith(expect.objectContaining({ refundId: 'ref-id-6' }));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Error Handling & Backoff Retries
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Error Handling & Backoff Retries', () => {
    it('captures processing errors, increments retry count, and calls mark_outbox_failed', async () => {
      const mockBatch = [
        {
          id: 'outbox-fail-1',
          tenant_id: 'tenant-uuid-1',
          event_type: 'PACKAGE_SALE',
          reference_id: 'ref-fail-1',
          payload: {
            totalAmount: 1000000,
            vatRate: 0,
            description: 'Failed sale',
          },
          retry_count: 0,
        },
      ];

      mockRpc.mockResolvedValueOnce({ data: mockBatch, error: null });
      // Mock the recognition handler to fail/throw
      (RevenueRecognitionService.handlePackageSale as jest.Mock).mockRejectedValueOnce(new Error('Mất kết nối tài khoản COA'));
      mockRpc.mockResolvedValueOnce({ error: null }); // mark_outbox_failed resolves

      const req = new NextRequest('http://localhost/api/cron/accounting-worker', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer test-cron-secret-123',
        },
      });

      const response = await GET(req);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.successCount).toBe(0);
      expect(json.failureCount).toBe(1);

      // Verify mark_outbox_failed RPC call was invoked with the exact error message
      expect(mockRpc).toHaveBeenCalledWith('mark_outbox_failed', {
        p_outbox_id: 'outbox-fail-1',
        p_error: 'Mất kết nối tài khoản COA',
      });
    });

    it('fails malformed payloads instead of silently completing the outbox item', async () => {
      const mockBatch = [
        {
          id: 'outbox-invalid-payload-1',
          tenant_id: 'tenant-uuid-1',
          event_type: 'PACKAGE_SALE',
          reference_id: 'ref-invalid-1',
          payload: {
            vatRate: 0,
            description: 'Missing amount sale',
          },
          retry_count: 0,
        },
      ];

      mockRpc.mockResolvedValueOnce({ data: mockBatch, error: null });
      mockRpc.mockResolvedValueOnce({ error: null });

      const req = new NextRequest('http://localhost/api/cron/accounting-worker', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer test-cron-secret-123',
        },
      });

      const response = await GET(req);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.status).toBe('partial_failure');
      expect(json.successCount).toBe(0);
      expect(json.failureCount).toBe(1);

      expect(RevenueRecognitionService.handlePackageSale).not.toHaveBeenCalled();
      expect(mockRpc).not.toHaveBeenCalledWith('mark_outbox_completed', expect.anything());
      expect(mockRpc).toHaveBeenCalledWith('mark_outbox_failed', {
        p_outbox_id: 'outbox-invalid-payload-1',
        p_error: 'Invalid outbox payload: totalAmount must be a number.',
      });
    });
  });
});
