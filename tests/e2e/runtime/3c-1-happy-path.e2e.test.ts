/**
 * Phase 3C Test Category 3C-1: Happy Path E2E
 * 
 * Verifies complete workflow from Financial Intent submission to Finance OS emission.
 * 
 * Test Flow:
 * Financial Intent → Validation → Tenant Context → Idempotency →
 * Outbox → Audit → Emission → Status Tracking
 * 
 * @see BELLA_RUNTIME_PHASE_3C_TEST_PLAN.md (Test Category 3C-1)
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import {
  setupE2ETest,
  cleanupAllE2EData,
  ensureTestTenantsExist,
  E2ETestContext,
} from '../../utils/e2e-test-setup';
import {
  E2E_TENANTS,
  createTestIntent,
  HEALTHCARE_INTENTS,
  wait,
} from '../../utils/e2e-fixtures';
import { financeOSMock } from '../../utils/finance-os-mock';

describe('3C-1: Happy Path E2E', () => {
  let context: E2ETestContext;

  beforeAll(async () => {
    context = setupE2ETest();
    await ensureTestTenantsExist(context.serviceRoleClient);
  });

  beforeEach(async () => {
    await cleanupAllE2EData(context.serviceRoleClient);
    financeOSMock.reset();
  });

  afterAll(async () => {
    await cleanupAllE2EData(context.serviceRoleClient);
  });

  describe('Single Intent Flow', () => {
    it.skip('should process Financial Intent end-to-end', async () => {
      // SKIP: Requires Runtime API implementation (Week 2)
      // This test demonstrates expected E2E flow structure
      
      const intent = createTestIntent({
        tenantId: E2E_TENANTS.TENANT_A.tenantId,
        correlationId: 'test-happy-path-001',
        amount: 1000.00,
      });

      // TODO Week 2: Implement Runtime submission API
      // const result = await runtime.submitIntent(intent, context.tenantAClient);

      // Verify outbox record created
      const { data: outboxRecords } = await context.tenantAClient
        .from('runtime_outbox')
        .select('*')
        .eq('correlation_id', intent.correlationId);

      expect(outboxRecords).toHaveLength(1);
      expect(outboxRecords![0].status).toBe('PENDING');

      // Verify audit log entry
      const { data: auditRecords } = await context.tenantAClient
        .from('runtime_audit_log')
        .select('*')
        .eq('correlation_id', intent.correlationId);

      expect(auditRecords!.length).toBeGreaterThan(0);

      // TODO Week 2: Trigger outbox processing
      // await runtime.processOutbox();

      // Verify Finance OS received intent
      expect(financeOSMock.getEmissionCount()).toBe(1);
      expect(financeOSMock.wasIntentEmitted(intent.correlationId, intent.tenantId)).toBe(true);

      // Verify outbox status updated
      const { data: updatedOutbox } = await context.tenantAClient
        .from('runtime_outbox')
        .select('status')
        .eq('correlation_id', intent.correlationId)
        .single();

      expect(updatedOutbox!.status).toBe('PUBLISHED');
    });
  });

  describe('Infrastructure Verification', () => {
    it('should create authenticated clients with tenant JWT', () => {
      expect(context.tenantAClient).toBeDefined();
      expect(context.tenantBClient).toBeDefined();
      expect(context.attackerClient).toBeDefined();
      expect(context.serviceRoleClient).toBeDefined();
    });

    it('should initialize Finance OS mock', () => {
      expect(context.financeOSMock).toBeDefined();
      expect(context.financeOSMock.getEmissionCount()).toBe(0);
    });

    it('should verify test tenants exist in registry', async () => {
      const { data: tenantA } = await context.serviceRoleClient
        .from('runtime_tenant_registry')
        .select('*')
        .eq('tenant_id', E2E_TENANTS.TENANT_A.tenantId)
        .single();

      expect(tenantA).toBeDefined();
      expect(tenantA!.tenant_id).toBe(E2E_TENANTS.TENANT_A.tenantId);
      expect(tenantA!.is_active).toBe(true);

      const { data: tenantB } = await context.serviceRoleClient
        .from('runtime_tenant_registry')
        .select('*')
        .eq('tenant_id', E2E_TENANTS.TENANT_B.tenantId)
        .single();

      expect(tenantB).toBeDefined();
      expect(tenantB!.tenant_id).toBe(E2E_TENANTS.TENANT_B.tenantId);
    });

    it('should enforce RLS on authenticated clients', async () => {
      // Insert test data as service_role (matching actual schema)
      const testIntent = createTestIntent({ tenantId: E2E_TENANTS.TENANT_A.tenantId });
      
      const { error: insertError } = await context.serviceRoleClient
        .from('runtime_audit_log')
        .insert({
          tenant_id: E2E_TENANTS.TENANT_A.tenantId,
          correlation_id: 'test-rls-001',
          intent_type: testIntent.intentType,
          entity_id: testIntent.entityId,
          entity_type: testIntent.entityType,
          amount: testIntent.amount,
          currency: testIntent.currency,
          source: testIntent.metadata?.source || 'E2E Test',
          status: 'SUCCESS',
        });

      expect(insertError).toBeNull(); // Insert should succeed with service_role

      // Tenant A should see their own data
      const { data: tenantAData, error: tenantAError } = await context.tenantAClient
        .from('runtime_audit_log')
        .select('*')
        .eq('correlation_id', 'test-rls-001');

      expect(tenantAError).toBeNull();
      expect(tenantAData).toBeDefined();
      expect(tenantAData).toHaveLength(1);

      // Tenant B should NOT see Tenant A's data (RLS enforcement)
      const { data: tenantBData, error: tenantBError } = await context.tenantBClient
        .from('runtime_audit_log')
        .select('*')
        .eq('correlation_id', 'test-rls-001');

      expect(tenantBError).toBeNull(); // No error, just empty result
      expect(tenantBData).toBeDefined();
      expect(tenantBData).toHaveLength(0); // RLS filtered it out
    });

    it('should handle Finance OS mock responses', async () => {
      const intent = createTestIntent({ tenantId: E2E_TENANTS.TENANT_A.tenantId });

      // Test accept mode
      financeOSMock.setConfig({ responseMode: 'accept' });
      const acceptResponse = await financeOSMock.emitIntent(intent);
      expect(acceptResponse.status).toBe('accepted');
      expect(acceptResponse).toHaveProperty('transactionId');

      // Test reject mode
      financeOSMock.setConfig({ responseMode: 'reject', rejectReason: 'Test rejection' });
      const rejectResponse = await financeOSMock.emitIntent(intent);
      expect(rejectResponse.status).toBe('rejected');
      expect(rejectResponse).toHaveProperty('reason');

      // Verify history
      expect(financeOSMock.getEmissionCount()).toBe(2);
    });
  });
});
