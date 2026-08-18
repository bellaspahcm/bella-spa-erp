/**
 * Idempotency Repository Integration Tests
 * 
 * Tests for runtime_idempotency_registry table operations (Phase 3B)
 * 
 * Focus:
 * - Idempotency check/register operations
 * - UNIQUE constraint enforcement (tenant_id + idempotency_key)
 * - TTL expiry cleanup
 * - Tenant isolation (database level)
 * 
 * Test Plan: BELLA_RUNTIME_PHASE_3_TEST_PLAN.md v1.1
 * Gate: P3-4 (Idempotency - database enforcement)
 * 
 * REQUIRES: Supabase connection + runtime tables
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { IdempotencyRepository } from '../../../src/platform/integration-runtime/database/idempotency-repository';
import { TenantRepository } from '../../../src/platform/integration-runtime/database/tenant-repository';
import { IdempotencyError } from '../../../src/platform/integration-runtime/types/runtime-errors.types';

describe('IdempotencyRepository Integration', () => {
  let supabase: SupabaseClient;
  let repository: IdempotencyRepository;
  let tenantRepository: TenantRepository;
  
  beforeAll(async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not found in environment');
    }
    
    supabase = createClient(supabaseUrl, supabaseKey);
    repository = new IdempotencyRepository(supabase);
    tenantRepository = new TenantRepository(supabase);
    
    // Create test tenants (unique to idempotency suite)
    try {
      await tenantRepository.createTenant({
        tenant_id: 'test-idempotency-tenant-a',
        is_active: true,
      });
    } catch (e) {
      // May already exist
    }
    
    try {
      await tenantRepository.createTenant({
        tenant_id: 'test-idempotency-tenant-b',
        is_active: true,
      });
    } catch (e) {
      // May already exist
    }
  });
  
  beforeEach(async () => {
    // Cleanup test idempotency records
    await supabase
      .from('runtime_idempotency_registry')
      .delete()
      .like('tenant_id', 'test-idempotency-tenant-%');
  });
  
  afterAll(async () => {
    // Final cleanup
    await supabase
      .from('runtime_idempotency_registry')
      .delete()
      .like('tenant_id', 'test-idempotency-tenant-%');
    
    await supabase
      .from('runtime_tenant_registry')
      .delete()
      .like('tenant_id', 'test-idempotency-tenant-%');
  });
  
  // ==========================================================================
  // Idempotency Check/Register
  // ==========================================================================
  
  describe('Idempotency Check/Register', () => {
    it('should return null for new idempotency key', async () => {
      const result = await repository.check('test-idempotency-tenant-a', 'key-new-001');
      
      expect(result).toBeNull();
    });
    
    it('should register new idempotency record', async () => {
      const expiresAt = new Date(Date.now() + 86400000); // 24 hours
      
      const record = await repository.register({
        tenant_id: 'test-idempotency-tenant-a',
        idempotency_key: 'key-register-001',
        correlation_id: 'corr-001',
        intent_type: 'REVENUE_RECOGNIZED',
        outbox_id: crypto.randomUUID(),
        expires_at: expiresAt,
      });
      
      expect(record.tenant_id).toBe('test-idempotency-tenant-a');
      expect(record.idempotency_key).toBe('key-register-001');
      expect(record.correlation_id).toBe('corr-001');
      expect(record.processed_at).toBeInstanceOf(Date);
    });
    
    it('should return existing record for duplicate key', async () => {
      const expiresAt = new Date(Date.now() + 86400000);
      const outboxId = crypto.randomUUID();
      
      // Register first time
      await repository.register({
        tenant_id: 'test-idempotency-tenant-a',
        idempotency_key: 'key-duplicate-001',
        correlation_id: 'corr-001',
        intent_type: 'REVENUE_RECOGNIZED',
        outbox_id: outboxId,
        expires_at: expiresAt,
      });
      
      // Check (should find existing)
      const existing = await repository.check('test-idempotency-tenant-a', 'key-duplicate-001');
      
      expect(existing).not.toBeNull();
      expect(existing?.idempotency_key).toBe('key-duplicate-001');
      expect(existing?.outbox_id).toBe(outboxId);
    });
    
    it('should throw IdempotencyError on duplicate register', async () => {
      const expiresAt = new Date(Date.now() + 86400000);
      
      await repository.register({
        tenant_id: 'test-idempotency-tenant-a',
        idempotency_key: 'key-error-001',
        correlation_id: 'corr-001',
        intent_type: 'REVENUE_RECOGNIZED',
        outbox_id: crypto.randomUUID(),
        expires_at: expiresAt,
      });
      
      // Attempt duplicate
      await expect(
        repository.register({
          tenant_id: 'test-idempotency-tenant-a',
          idempotency_key: 'key-error-001', // Same key
          correlation_id: 'corr-002',
          intent_type: 'REVENUE_RECOGNIZED',
          outbox_id: crypto.randomUUID(),
          expires_at: expiresAt,
        })
      ).rejects.toThrow(IdempotencyError);
    });
  });
  
  // ==========================================================================
  // UNIQUE Constraint (Tenant-Scoped) — CRITICAL TEST
  // ==========================================================================
  
  describe('UNIQUE Constraint (Tenant-Scoped)', () => {
    it('should enforce UNIQUE(tenant_id, idempotency_key)', async () => {
      const expiresAt = new Date(Date.now() + 86400000);
      
      // Tenant A: key-shared
      await repository.register({
        tenant_id: 'test-idempotency-tenant-a',
        idempotency_key: 'key-shared-001',
        correlation_id: 'corr-001',
        intent_type: 'REVENUE_RECOGNIZED',
        outbox_id: crypto.randomUUID(),
        expires_at: expiresAt,
      });
      
      // Tenant A: same key (should FAIL)
      await expect(
        repository.register({
          tenant_id: 'test-idempotency-tenant-a',
          idempotency_key: 'key-shared-001', // Same
          correlation_id: 'corr-002',
          intent_type: 'PAYMENT_RECEIVED',
          outbox_id: crypto.randomUUID(),
          expires_at: expiresAt,
        })
      ).rejects.toThrow();
    });
    
    it('should allow same key for different tenants', async () => {
      const expiresAt = new Date(Date.now() + 86400000);
      
      // Tenant A: key-cross-tenant
      const recordA = await repository.register({
        tenant_id: 'test-idempotency-tenant-a',
        idempotency_key: 'key-cross-tenant-001',
        correlation_id: 'corr-a-001',
        intent_type: 'REVENUE_RECOGNIZED',
        outbox_id: crypto.randomUUID(),
        expires_at: expiresAt,
      });
      
      // Tenant B: same key (should SUCCEED)
      const recordB = await repository.register({
        tenant_id: 'test-idempotency-tenant-b',
        idempotency_key: 'key-cross-tenant-001', // Same key
        correlation_id: 'corr-b-001',
        intent_type: 'REVENUE_RECOGNIZED',
        outbox_id: crypto.randomUUID(),
        expires_at: expiresAt,
      });
      
      expect(recordA.tenant_id).toBe('test-idempotency-tenant-a');
      expect(recordB.tenant_id).toBe('test-idempotency-tenant-b');
      expect(recordA.idempotency_key).toBe(recordB.idempotency_key);
    });
    
    it('should isolate tenant queries', async () => {
      const expiresAt = new Date(Date.now() + 86400000);
      
      // Tenant A: register key
      await repository.register({
        tenant_id: 'test-idempotency-tenant-a',
        idempotency_key: 'key-isolation-001',
        correlation_id: 'corr-a',
        intent_type: 'REVENUE_RECOGNIZED',
        outbox_id: crypto.randomUUID(),
        expires_at: expiresAt,
      });
      
      // Tenant B: check same key (should not find Tenant A's record)
      const resultB = await repository.check('test-idempotency-tenant-b', 'key-isolation-001');
      
      expect(resultB).toBeNull(); // Tenant B cannot see Tenant A's key
    });
  });
  
  // ==========================================================================
  // TTL Expiry
  // ==========================================================================
  
  describe('TTL Expiry', () => {
    it('should return null for expired key', async () => {
      const expiredAt = new Date(Date.now() - 1000); // 1 second ago
      
      await repository.register({
        tenant_id: 'test-idempotency-tenant-a',
        idempotency_key: 'key-expired-001',
        correlation_id: 'corr-001',
        intent_type: 'REVENUE_RECOGNIZED',
        outbox_id: crypto.randomUUID(),
        expires_at: expiredAt,
      });
      
      // Check (should ignore expired)
      const result = await repository.check('test-idempotency-tenant-a', 'key-expired-001');
      
      expect(result).toBeNull();
    });
    
    it('should cleanup expired records', async () => {
      const expiredAt = new Date(Date.now() - 1000);
      
      // Create expired record
      await repository.register({
        tenant_id: 'test-idempotency-tenant-a',
        idempotency_key: 'key-cleanup-001',
        correlation_id: 'corr-001',
        intent_type: 'REVENUE_RECOGNIZED',
        outbox_id: crypto.randomUUID(),
        expires_at: expiredAt,
      });
      
      // Cleanup
      const deletedCount = await repository.cleanupExpired();
      
      expect(deletedCount).toBeGreaterThan(0);
      
      // Verify deleted
      const record = await repository.getRecord('test-idempotency-tenant-a', 'key-cleanup-001');
      expect(record).toBeNull();
    });
    
    it('should not cleanup unexpired records', async () => {
      const expiresAt = new Date(Date.now() + 86400000);
      
      await repository.register({
        tenant_id: 'test-idempotency-tenant-a',
        idempotency_key: 'key-keep-001',
        correlation_id: 'corr-001',
        intent_type: 'REVENUE_RECOGNIZED',
        outbox_id: crypto.randomUUID(),
        expires_at: expiresAt,
      });
      
      // Cleanup (should not delete)
      await repository.cleanupExpired();
      
      // Verify still exists
      const record = await repository.getRecord('test-idempotency-tenant-a', 'key-keep-001');
      expect(record).not.toBeNull();
    });
  });
  
  // ==========================================================================
  // Query Operations
  // ==========================================================================
  
  describe('Query Operations', () => {
    beforeEach(async () => {
      const expiresAt = new Date(Date.now() + 86400000);
      
      await repository.register({
        tenant_id: 'test-idempotency-tenant-a',
        idempotency_key: 'key-query-001',
        correlation_id: 'corr-shared',
        intent_type: 'REVENUE_RECOGNIZED',
        outbox_id: crypto.randomUUID(),
        expires_at: expiresAt,
      });
      
      await repository.register({
        tenant_id: 'test-idempotency-tenant-a',
        idempotency_key: 'key-query-002',
        correlation_id: 'corr-shared',
        intent_type: 'PAYMENT_RECEIVED',
        outbox_id: crypto.randomUUID(),
        expires_at: expiresAt,
      });
      
      await repository.register({
        tenant_id: 'test-idempotency-tenant-b',
        idempotency_key: 'key-query-003',
        correlation_id: 'corr-shared',
        intent_type: 'REVENUE_RECOGNIZED',
        outbox_id: crypto.randomUUID(),
        expires_at: expiresAt,
      });
    });
    
    it('should get records by tenant', async () => {
      const records = await repository.getRecordsByTenant('test-idempotency-tenant-a');
      
      expect(records.length).toBe(2);
      expect(records.every(r => r.tenant_id === 'test-idempotency-tenant-a')).toBe(true);
    });
    
    it('should get records by correlation ID', async () => {
      const records = await repository.getRecordsByCorrelation('corr-shared');
      
      expect(records.length).toBeGreaterThanOrEqual(3);
      expect(records.every(r => r.correlation_id === 'corr-shared')).toBe(true);
    });
    
    it('should get stats', async () => {
      const stats = await repository.getStats();
      
      expect(stats.totalRecords).toBeGreaterThanOrEqual(3);
      expect(stats.recordsByTenant.get('test-idempotency-tenant-a')).toBe(2);
      expect(stats.recordsByTenant.get('test-idempotency-tenant-b')).toBe(1);
    });
  });
  
  // ==========================================================================
  // Concurrent Operations
  // ==========================================================================
  
  describe('Concurrent Operations', () => {
    it('should handle concurrent register attempts (race condition)', async () => {
      const expiresAt = new Date(Date.now() + 86400000);
      const outboxId = crypto.randomUUID();
      
      // Simulate race: two processes try to register same key
      const promises = [
        repository.register({
          tenant_id: 'test-idempotency-tenant-a',
          idempotency_key: 'key-race-001',
          correlation_id: 'corr-001',
          intent_type: 'REVENUE_RECOGNIZED',
          outbox_id: outboxId,
          expires_at: expiresAt,
        }),
        repository.register({
          tenant_id: 'test-idempotency-tenant-a',
          idempotency_key: 'key-race-001', // Same key
          correlation_id: 'corr-001',
          intent_type: 'REVENUE_RECOGNIZED',
          outbox_id: outboxId,
          expires_at: expiresAt,
        }),
      ];
      
      const results = await Promise.allSettled(promises);
      
      // One should succeed, one should fail
      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter(r => r.status === 'rejected');
      
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
    });
  });
});
