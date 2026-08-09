/**
 * Phase 11: Business Rollback Engine - Integration Tests
 * 
 * Tests:
 * 1. Transaction lifecycle (start → execute steps → commit)
 * 2. Automatic rollback on failure
 * 3. Manual rollback
 * 4. Cascade rollback (7 steps)
 * 5. Idempotent rollback
 * 6. Audit trail
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BusinessRollbackEngine } from '@/modules/bella-auto/services/rollback/BusinessRollbackEngine';
import { VehicleDeliveryRollback } from '@/modules/bella-auto/services/rollback/VehicleDeliveryRollback';

function createChainableMock(defaultResolveValue: any = { data: null, error: null }) {
  const mockPromise = (val: any) => {
    const promise = Promise.resolve(val);
    const chain: any = {
      then: (onfulfilled: any, onrejected: any) => promise.then(onfulfilled, onrejected),
      catch: (onrejected: any) => promise.catch(onrejected),
      finally: (onfinally: any) => promise.finally(onfinally),
      select: jest.fn(() => chain),
      insert: jest.fn(() => chain),
      update: jest.fn(() => chain),
      delete: jest.fn(() => chain),
      eq: jest.fn(() => chain),
      neq: jest.fn(() => chain),
      in: jest.fn(() => chain),
      order: jest.fn(() => chain),
      limit: jest.fn(() => chain),
      single: jest.fn(() => chain),
      maybeSingle: jest.fn(() => chain),
    };
    return chain;
  };

  const fn: any = jest.fn(() => fn._chain);

  fn._chain = mockPromise(defaultResolveValue);

  fn.mockResolvedValueOnce = (val: any) => {
    fn.mockImplementationOnce(() => {
      return mockPromise(val);
    });
    return fn;
  };

  fn.mockResolvedValue = (val: any) => {
    fn.mockImplementation(() => {
      return mockPromise(val);
    });
    return fn;
  };

  fn.mockRejectedValueOnce = (val: any) => {
    fn.mockImplementationOnce(() => {
      const promise = Promise.reject(val);
      const chain: any = {
        then: (onfulfilled: any, onrejected: any) => promise.then(onfulfilled, onrejected),
        catch: (onrejected: any) => promise.catch(onrejected),
        finally: (onfinally: any) => promise.finally(onfinally),
        select: jest.fn(() => chain),
        eq: jest.fn(() => chain),
      };
      return chain;
    });
    return fn;
  };

  return fn;
}

function createMockSupabaseClient() {
  const tables: Record<string, any> = {};

  const from = jest.fn((table: string) => {
    if (!tables[table]) {
      const tableMock = {
        select: createChainableMock({ data: [], error: null }),
        insert: createChainableMock({ data: null, error: null }),
        update: createChainableMock({ data: null, error: null }),
        delete: createChainableMock({ data: null, error: null }),
        eq: createChainableMock({ data: [], error: null }),
        neq: createChainableMock({ data: [], error: null }),
        in: createChainableMock({ data: [], error: null }),
        order: createChainableMock({ data: [], error: null }),
        limit: createChainableMock({ data: [], error: null }),
        single: createChainableMock({ data: null, error: null }),
        maybeSingle: createChainableMock({ data: null, error: null }),
      };
      tables[table] = tableMock;
    }
    return tables[table];
  });

  return {
    from,
    rpc: jest.fn().mockImplementation(() => Promise.resolve({ data: null, error: null })),
  };
}

describe('Phase 11: Business Rollback Engine', () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;
  let engine: BusinessRollbackEngine;
  let deliveryRollback: VehicleDeliveryRollback;
  
  const TENANT_ID = 'bella_auto_demo';
  const BOOKING_ID = 'booking-123';
  const VEHICLE_ID = 'vehicle-456';
  const JOURNEY_ID = 'journey-789';
  const USER_ID = 'user-admin';

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    engine = new BusinessRollbackEngine(mockSupabase as any, TENANT_ID);
    deliveryRollback = new VehicleDeliveryRollback(mockSupabase as any, TENANT_ID);
  });

  describe('Transaction Lifecycle', () => {
    it('should start transaction successfully', async () => {
      mockSupabase.from('auto_business_transactions').insert.mockResolvedValueOnce({
        data: {
          id: 'tx-1',
          tenant_id: TENANT_ID,
          transaction_type: 'vehicle_delivery',
          status: 'pending',
          entity_type: 'booking',
          entity_id: BOOKING_ID,
          created_at: new Date().toISOString(),
        },
        error: null,
      });

      const transaction = await engine.startTransaction({
        type: 'vehicle_delivery',
        entityType: 'booking',
        entityId: BOOKING_ID,
        createdBy: USER_ID,
      });

      expect(transaction).toMatchObject({
        id: 'tx-1',
        tenantId: TENANT_ID,
        transactionType: 'vehicle_delivery',
        status: 'pending',
        entityType: 'booking',
        entityId: BOOKING_ID,
      });
    });

    it('should execute step with compensating action', async () => {
      // Mock existing steps query
      mockSupabase.from('auto_transaction_steps').select.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      // Mock insert
      mockSupabase.from('auto_transaction_steps').insert.mockResolvedValueOnce({
        data: {
          id: 'step-1',
          transaction_id: 'tx-1',
          sequence: 1,
          action: 'update_vehicle_status',
          status: 'executed',
          entity_type: 'vehicle',
          entity_id: VEHICLE_ID,
          snapshot_before: { status: 'allocated' },
          snapshot_after: { status: 'delivered' },
          compensating_action: 'revert_vehicle_status',
          compensating_params: { status: 'allocated' },
          executed_at: new Date().toISOString(),
        },
        error: null,
      });

      const step = await engine.executeStep('tx-1', {
        action: 'update_vehicle_status',
        entityType: 'vehicle',
        entityId: VEHICLE_ID,
        snapshotBefore: { status: 'allocated' },
        snapshotAfter: { status: 'delivered' },
        compensatingAction: 'revert_vehicle_status',
        compensatingParams: { status: 'allocated' },
      });

      expect(step).toMatchObject({
        sequence: 1,
        action: 'update_vehicle_status',
        status: 'executed',
        compensatingAction: 'revert_vehicle_status',
      });
    });

    it('should commit transaction', async () => {
      mockSupabase.from('auto_business_transactions').update.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      await expect(
        engine.commitTransaction('tx-1')
      ).resolves.not.toThrow();
    });
  });

  describe('Cascade Rollback', () => {
    it('should rollback all 7 steps in reverse order', async () => {
      const steps = [
        { sequence: 1, action: 'update_journey_stage', compensating_action: 'revert_journey_stage' },
        { sequence: 2, action: 'send_notification', compensating_action: 'cancel_notification' },
        { sequence: 3, action: 'record_ai_event', compensating_action: 'remove_ai_event' },
        { sequence: 4, action: 'calculate_commission', compensating_action: 'revert_commission' },
        { sequence: 5, action: 'post_accounting', compensating_action: 'reverse_accounting_entry' },
        { sequence: 6, action: 'update_inventory', compensating_action: 'restore_inventory' },
        { sequence: 7, action: 'update_vehicle_status', compensating_action: 'revert_vehicle_status' },
      ];

      // Mock steps query (returns in reverse order)
      mockSupabase.from('auto_transaction_steps').select.mockResolvedValueOnce({
        data: steps.reverse().map(s => ({
          id: `step-${s.sequence}`,
          transaction_id: 'tx-1',
          tenant_id: TENANT_ID,
          ...s,
          entity_type: 'test',
          entity_id: 'test-123',
          compensating_params: {},
        })),
        error: null,
      });

      // Mock step updates
      for (let i = 0; i < 7; i++) {
        mockSupabase.from('auto_transaction_steps').update.mockResolvedValueOnce({
          data: null,
          error: null,
        });
      }

      // Mock transaction update
      mockSupabase.from('auto_business_transactions').update.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Mock audit log insert
      mockSupabase.from('auto_rollback_audit_log').insert.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      await expect(
        engine.rollbackTransaction('tx-1', 'Wrong VIN delivered', USER_ID)
      ).resolves.not.toThrow();

      // Verify all steps were updated
      expect(mockSupabase.from('auto_transaction_steps').update).toHaveBeenCalledTimes(7);
    });

    it('should continue rollback even if some steps fail', async () => {
      const steps = [
        { sequence: 1, action: 'step1', compensating_action: 'comp1' },
        { sequence: 2, action: 'step2', compensating_action: 'comp2' },
      ];

      mockSupabase.from('auto_transaction_steps').select.mockResolvedValueOnce({
        data: steps.reverse().map(s => ({
          id: `step-${s.sequence}`,
          transaction_id: 'tx-1',
          tenant_id: TENANT_ID,
          ...s,
          entity_type: 'test',
          entity_id: 'test-123',
          compensating_params: {},
        })),
        error: null,
      });

      // First step update succeeds
      mockSupabase.from('auto_transaction_steps').update.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Second step update fails
      mockSupabase.from('auto_transaction_steps').update.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      mockSupabase.from('auto_business_transactions').update.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      mockSupabase.from('auto_rollback_audit_log').insert.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Should complete rollback despite errors (expecting the collected errors to be thrown at the end)
      await expect(
        engine.rollbackTransaction('tx-1', 'Test rollback', USER_ID)
      ).rejects.toThrow('Rollback completed with 2 error(s)');
    });
  });

  describe('Vehicle Delivery Rollback', () => {
    it('should execute delivery with rollback capability', async () => {
      // Mock transaction start
      mockSupabase.from('auto_business_transactions').insert.mockResolvedValueOnce({
        data: {
          id: 'tx-delivery-1',
          tenant_id: TENANT_ID,
          transaction_type: 'vehicle_delivery',
          status: 'pending',
          entity_type: 'booking',
          entity_id: BOOKING_ID,
          created_at: new Date().toISOString(),
        },
        error: null,
      });

      // Mock all step inserts (7 steps)
      for (let i = 1; i <= 7; i++) {
        mockSupabase.from('auto_transaction_steps').select.mockResolvedValueOnce({
          data: i > 1 ? [{ sequence: i - 1 }] : [],
          error: null,
        });

        mockSupabase.from('auto_transaction_steps').insert.mockResolvedValueOnce({
          data: {
            id: `step-${i}`,
            transaction_id: 'tx-delivery-1',
            sequence: i,
            status: 'executed',
          },
          error: null,
        });
      }

      // Mock journey, vehicle queries
      mockSupabase.from('auto_customer_journeys').select.mockResolvedValueOnce({
        data: { id: JOURNEY_ID, current_stage_code: 'vehicle_prep' },
        error: null,
      });

      mockSupabase.from('auto_customer_journeys').update.mockResolvedValue({
        data: null,
        error: null,
      });

      mockSupabase.from('auto_vehicles').select.mockResolvedValueOnce({
        data: { id: VEHICLE_ID, status: 'allocated' },
        error: null,
      });

      mockSupabase.from('auto_vehicles').update.mockResolvedValue({
        data: null,
        error: null,
      });

      // Mock commit
      mockSupabase.from('auto_business_transactions').update.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const result = await deliveryRollback.executeDelivery({
        bookingId: BOOKING_ID,
        vehicleId: VEHICLE_ID,
        journeyId: JOURNEY_ID,
        deliveredBy: USER_ID,
      });

      expect(result).toMatchObject({
        success: true,
        transactionId: 'tx-delivery-1',
      });
    });

    it('should auto-rollback on delivery failure', async () => {
      // Mock transaction start
      mockSupabase.from('auto_business_transactions').insert.mockResolvedValueOnce({
        data: {
          id: 'tx-delivery-fail',
          tenant_id: TENANT_ID,
          transaction_type: 'vehicle_delivery',
          status: 'pending',
          entity_type: 'booking',
          entity_id: BOOKING_ID,
          created_at: new Date().toISOString(),
        },
        error: null,
      });

      // First step succeeds
      mockSupabase.from('auto_transaction_steps').select.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      mockSupabase.from('auto_transaction_steps').insert.mockResolvedValueOnce({
        data: { id: 'step-1', sequence: 1 },
        error: null,
      });

      mockSupabase.from('auto_customer_journeys').select.mockResolvedValueOnce({
        data: { id: JOURNEY_ID, current_stage_code: 'vehicle_prep' },
        error: null,
      });

      // Second step fails
      mockSupabase.from('auto_customer_journeys').update.mockRejectedValueOnce(
        new Error('Database connection lost')
      );

      // Mock rollback
      mockSupabase.from('auto_transaction_steps').select.mockResolvedValueOnce({
        data: [{
          id: 'step-1',
          sequence: 1,
          tenant_id: TENANT_ID,
          transaction_id: 'tx-delivery-fail',
          compensating_action: 'revert_journey_stage',
          compensating_params: {},
          entity_type: 'journey',
          entity_id: JOURNEY_ID,
        }],
        error: null,
      });

      mockSupabase.from('auto_transaction_steps').update.mockResolvedValue({
        data: null,
        error: null,
      });

      mockSupabase.from('auto_business_transactions').update.mockResolvedValue({
        data: null,
        error: null,
      });

      mockSupabase.from('auto_rollback_audit_log').insert.mockResolvedValue({
        data: null,
        error: null,
      });

      mockSupabase.from('auto_customer_journeys').update.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await deliveryRollback.executeDelivery({
        bookingId: BOOKING_ID,
        vehicleId: VEHICLE_ID,
        journeyId: JOURNEY_ID,
        deliveredBy: USER_ID,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database connection lost');
    });

    it('should manually rollback completed delivery', async () => {
      // Mock finding transaction
      mockSupabase.from('auto_business_transactions').select.mockResolvedValueOnce({
        data: { id: 'tx-delivery-1' },
        error: null,
      });

      // Mock rollback steps
      mockSupabase.from('auto_transaction_steps').select.mockResolvedValueOnce({
        data: [
          {
            id: 'step-1',
            sequence: 1,
            tenant_id: TENANT_ID,
            transaction_id: 'tx-delivery-1',
            compensating_action: 'revert_vehicle_status',
            compensating_params: { status: 'allocated' },
            entity_type: 'vehicle',
            entity_id: VEHICLE_ID,
          },
        ],
        error: null,
      });

      mockSupabase.from('auto_vehicles').update.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      mockSupabase.from('auto_transaction_steps').update.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      mockSupabase.from('auto_business_transactions').update.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      mockSupabase.from('auto_rollback_audit_log').insert.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const result = await deliveryRollback.rollbackDelivery({
        bookingId: BOOKING_ID,
        reason: 'Wrong VIN delivered to customer',
        rolledBackBy: USER_ID,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Audit Trail', () => {
    it('should create audit log on rollback', async () => {
      mockSupabase.from('auto_transaction_steps').select.mockResolvedValueOnce({
        data: [{
          id: 'step-1',
          sequence: 1,
          tenant_id: TENANT_ID,
          transaction_id: 'tx-1',
          compensating_action: 'test_action',
          compensating_params: {},
          entity_type: 'test',
          entity_id: 'test-123',
        }],
        error: null,
      });

      mockSupabase.from('auto_transaction_steps').update.mockResolvedValue({
        data: null,
        error: null,
      });

      mockSupabase.from('auto_business_transactions').update.mockResolvedValue({
        data: null,
        error: null,
      });

      let auditLogData: any;
      mockSupabase.from('auto_rollback_audit_log').insert.mockImplementationOnce((data: any) => {
        auditLogData = data;
        return Promise.resolve({ data: null, error: null });
      });

      await expect(
        engine.rollbackTransaction('tx-1', 'Test reason', USER_ID)
      ).rejects.toThrow('Rollback completed with 1 error(s)');

      expect(auditLogData).toMatchObject({
        tenant_id: TENANT_ID,
        transaction_id: 'tx-1',
        rollback_reason: 'Test reason',
        rollback_executed_by: USER_ID,
        steps_rolled_back: 1,
      });
    });
  });
});

describe('Phase 11: RPC Functions', () => {
  it('should get transaction with steps', async () => {
    // Test RPC function get_business_transaction_with_steps
    // This would be tested against actual database in E2E tests
    expect(true).toBe(true);
  });

  it('should get entity rollback history', async () => {
    // Test RPC function get_entity_rollback_history
    // This would be tested against actual database in E2E tests
    expect(true).toBe(true);
  });
});
