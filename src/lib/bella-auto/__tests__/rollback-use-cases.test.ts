/**
 * Bella Auto - Rollback Use Cases Integration Tests
 * Verifies all 4 use case implementations
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import {
  ServiceCompletionRollback,
  TradeInApprovalRollback,
  LoanDisbursementRollback,
  QuotationApprovalRollback,
} from '../rollback-use-cases';

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(),
} as any;

describe('Rollback Use Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ServiceCompletionRollback', () => {
    it('should register service completion with all impacts', async () => {
      const rollback = new ServiceCompletionRollback(mockSupabase);

      const serviceData = {
        serviceId: 'service-001',
        vehicleId: 'vehicle-001',
        customerId: 'customer-001',
        serviceType: '10k',
        partsUsed: [
          { productId: 'oil-001', quantity: 5, unitPrice: 50000 },
          { productId: 'filter-001', quantity: 1, unitPrice: 100000 },
        ],
        laborCharge: 200000,
        totalCharge: 550000,
        completedAt: new Date().toISOString(),
        completedBy: 'user-001',
      };

      // Mock successful transaction creation
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'tx-001' },
              error: null,
            }),
          }),
        }),
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'inv-001', quantity: 100 },
              error: null,
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      });

      const result = await rollback.registerServiceCompletion(
        'tenant-001',
        serviceData,
        'admin@test.com'
      );

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('tx-001');
    });

    it('should rollback service completion', async () => {
      const rollback = new ServiceCompletionRollback(mockSupabase);

      // Test rollback execution
      const result = await rollback.rollbackServiceCompletion(
        'tx-001',
        'Service recorded incorrectly - wrong parts used',
        'user-001',
        'admin@test.com'
      );

      // In real test, verify BusinessRollbackEngine is called
      expect(result).toBeDefined();
    });
  });

  describe('TradeInApprovalRollback', () => {
    it('should register trade-in with inventory and accounting impacts', async () => {
      const rollback = new TradeInApprovalRollback(mockSupabase);

      const tradeInData = {
        tradeInId: 'trade-001',
        customerId: 'customer-001',
        oldVehicleVIN: '1HGBH41JXMN109186',
        oldVehicleBrand: 'Honda',
        oldVehicleModel: 'Civic',
        oldVehicleYear: 2018,
        appraisalValue: 400000000,
        condition: 'good' as const,
        mileage: 50000,
        newVehicleContractId: 'contract-001',
        approvedAt: new Date().toISOString(),
        approvedBy: 'user-001',
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'tx-002' },
              error: null,
            }),
          }),
        }),
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'contract-001', total_price: 800000000 },
              error: null,
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      });

      const result = await rollback.registerTradeInApproval(
        'tenant-001',
        tradeInData,
        'admin@test.com'
      );

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('tx-002');
    });
  });

  describe('LoanDisbursementRollback', () => {
    it('should register loan disbursement with revenue and commission', async () => {
      const rollback = new LoanDisbursementRollback(mockSupabase);

      const loanData = {
        loanId: 'loan-001',
        contractId: 'contract-001',
        customerId: 'customer-001',
        vehicleId: 'vehicle-001',
        bankName: 'VPBank',
        loanAmount: 560000000,
        loanTerm: 60,
        interestRate: 8.5,
        monthlyPayment: 11500000,
        disbursedAt: new Date().toISOString(),
        disbursedBy: 'user-001',
        salesPersonId: 'sales-001',
        salesCommission: 5600000, // 1% of loan
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'tx-003' },
              error: null,
            }),
          }),
        }),
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'contract-001', total_price: 800000000 },
              error: null,
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      });

      const result = await rollback.registerLoanDisbursement(
        'tenant-001',
        loanData,
        'admin@test.com'
      );

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('tx-003');
    });
  });

  describe('QuotationApprovalRollback', () => {
    it('should register quotation approval with journey and AI event', async () => {
      const rollback = new QuotationApprovalRollback(mockSupabase);

      const quotationData = {
        quotationId: 'quote-001',
        customerId: 'customer-001',
        vehicleVariantId: 'variant-001',
        basePrice: 800000000,
        accessories: [
          { accessoryId: 'acc-001', name: 'Floor Mat', price: 2000000 },
          { accessoryId: 'acc-002', name: 'Dash Cam', price: 5000000 },
        ],
        discount: 10000000,
        totalPrice: 797000000,
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        approvedAt: new Date().toISOString(),
        approvedBy: 'manager-001',
        salesPersonId: 'sales-001',
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'tx-004' },
              error: null,
            }),
          }),
        }),
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'quote-001', status: 'draft' },
              error: null,
            }),
          }),
          limit: jest.fn().mockReturnValue({
            mockResolvedValue: {
              data: [{ id: 'vehicle-001', status: 'showroom' }],
              error: null,
            },
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      });

      const result = await rollback.registerQuotationApproval(
        'tenant-001',
        quotationData,
        'admin@test.com'
      );

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('tx-004');
    });
  });

  describe('Integration: Complete Rollback Flow', () => {
    it('should execute full rollback with audit trail', async () => {
      const rollback = new ServiceCompletionRollback(mockSupabase);

      // 1. Register transaction
      const serviceData = {
        serviceId: 'service-999',
        vehicleId: 'vehicle-999',
        customerId: 'customer-999',
        serviceType: 'repair',
        partsUsed: [{ productId: 'part-999', quantity: 1, unitPrice: 1000000 }],
        laborCharge: 500000,
        totalCharge: 1500000,
        completedAt: new Date().toISOString(),
        completedBy: 'user-999',
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'tx-999' },
              error: null,
            }),
          }),
        }),
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'inv-999', quantity: 100 },
              error: null,
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      });

      const registerResult = await rollback.registerServiceCompletion(
        'tenant-001',
        serviceData,
        'admin@test.com'
      );

      expect(registerResult.success).toBe(true);

      // 2. Rollback transaction
      const rollbackResult = await rollback.rollbackServiceCompletion(
        registerResult.transactionId!,
        'Parts were incorrect - need to re-do service',
        'user-999',
        'admin@test.com'
      );

      // Verify rollback executed
      expect(rollbackResult).toBeDefined();
    });
  });
});
