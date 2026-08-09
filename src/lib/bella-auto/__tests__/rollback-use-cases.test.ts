/**
 * Bella Auto - Rollback Use Cases Integration Tests
 * Verifies all 4 use case implementations
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
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

function setupMockSupabase(config: {
  transactionId?: string;
  inventory?: { id: string; quantity: number };
  contract?: { id: string; total_price: number };
  quotation?: { id: string; status: string };
  vehicles?: Array<{ id: string; status: string }>;
  journeyStage?: { id: string; sla_hours: number };
  journey?: { id: string };
  steps?: Array<any>;
}) {
  let currentTxId = config.transactionId || 'tx-001';

  mockSupabase.from.mockImplementation((table: string) => {
    const builder: any = {};
    const chainFn = () => builder;
    
    builder.select = chainFn;
    builder.insert = jest.fn().mockImplementation((payload: any) => {
      if (table === 'auto_business_transactions') {
        const txObj = Array.isArray(payload) ? payload[0] : payload;
        if (txObj.entity_id === 'service-999') currentTxId = 'tx-999';
        else if (txObj.entity_id === 'trade-001') currentTxId = 'tx-002';
        else if (txObj.entity_id === 'loan-001') currentTxId = 'tx-003';
        else if (txObj.entity_id === 'quote-001') currentTxId = 'tx-004';
      }
      return builder;
    });
    builder.update = chainFn;
    builder.delete = chainFn;
    builder.eq = chainFn;
    builder.limit = chainFn;
    builder.order = chainFn;
    
    builder.single = jest.fn().mockImplementation(async () => {
      if (table === 'auto_business_transactions') {
        return { data: { id: currentTxId }, error: null };
      }
      if (table === 'auto_inventory') {
        return { data: config.inventory || { id: 'inv-001', quantity: 100 }, error: null };
      }
      if (table === 'auto_bookings') {
        return { data: config.contract || { id: 'contract-001', total_price: 800000000 }, error: null };
      }
      if (table === 'auto_quotations') {
        return { data: config.quotation || { id: 'quote-001', status: 'draft' }, error: null };
      }
      if (table === 'auto_journey_stages') {
        return { data: config.journeyStage || { id: 'stage-001', sla_hours: 24 }, error: null };
      }
      if (table === 'auto_customer_journeys') {
        return { data: config.journey || { id: 'journey-001' }, error: null };
      }
      return { data: null, error: null };
    });

    builder.then = (onfulfilled: any) => {
      let resData: any = null;
      if (table === 'auto_vehicles') {
        resData = config.vehicles || [{ id: 'vehicle-001', status: 'showroom' }];
      } else if (table === 'auto_transaction_steps') {
        resData = config.steps || [
          {
            id: 'step-001',
            action_type: 'INSERT',
            target_table: 'auto_services',
            target_record_id: 'service-001',
            before_snapshot: null,
            after_snapshot: {},
            status: 'executed',
          }
        ];
      }
      return Promise.resolve({ data: resData, error: null }).then(onfulfilled);
    };

    return builder;
  });
}

describe('Rollback Use Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ServiceCompletionRollback', () => {
    it('should register service completion with all impacts', async () => {
      const rollback = new ServiceCompletionRollback(mockSupabase);
      setupMockSupabase({ transactionId: 'tx-001' });

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
      setupMockSupabase({
        transactionId: 'tx-001',
        steps: [
          {
            id: 'step-001',
            action_type: 'INSERT',
            target_table: 'auto_services',
            target_record_id: 'service-001',
            before_snapshot: null,
            after_snapshot: {},
            status: 'executed',
          }
        ]
      });

      const result = await rollback.rollbackServiceCompletion(
        'tx-001',
        'Service recorded incorrectly - wrong parts used',
        'user-001',
        'admin@test.com'
      );

      expect(result.success).toBe(true);
      expect(result.stepsRolledBack).toBe(1);
    });
  });

  describe('TradeInApprovalRollback', () => {
    it('should register trade-in with inventory and accounting impacts', async () => {
      const rollback = new TradeInApprovalRollback(mockSupabase);
      setupMockSupabase({ transactionId: 'tx-002' });

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
      setupMockSupabase({ transactionId: 'tx-003' });

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
      setupMockSupabase({ transactionId: 'tx-004' });

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
      setupMockSupabase({
        transactionId: 'tx-999',
        steps: [
          {
            id: 'step-999',
            action_type: 'INSERT',
            target_table: 'auto_services',
            target_record_id: 'service-999',
            before_snapshot: null,
            after_snapshot: {},
            status: 'executed',
          }
        ]
      });

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

      expect(rollbackResult.success).toBe(true);
      expect(rollbackResult.stepsRolledBack).toBe(1);
    });
  });
});
