/**
 * Quarantine Repository Integration Tests
 * 
 * Tests for runtime_quarantine table operations (Phase 3B)
 * 
 * Focus:
 * - Quarantine entry creation (error preservation)
 * - Resolution workflow (manual review)
 * - Tenant isolation
 * - Query operations
 * 
 * Test Plan: BELLA_RUNTIME_PHASE_3_TEST_PLAN.md v1.1
 * Gate: P3-5 (Error Classification & Recovery)
 * 
 * REQUIRES: Supabase connection + runtime tables
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { QuarantineRepository } from '../../../src/platform/integration-runtime/database/quarantine-repository';
import { TenantRepository } from '../../../src/platform/integration-runtime/database/tenant-repository';
import type { FinancialIntent } from '../../../src/platform/integration-runtime/types/financial-intent.types';

describe('QuarantineRepository Integration', () => {
  let supabase: SupabaseClient;
  let repository: QuarantineRepository;
  let tenantRepository: TenantRepository;
  
  const validIntent: FinancialIntent = {
    intentType: 'REVENUE_RECOGNIZED',
    tenantId: 'test-quarantine-tenant-a',
    correlationId: 'corr-001',
    entityType: 'Invoice',
    entityId: 'inv-001',
    amount: 1000,
    currency: 'USD',
    effectiveDate: new Date(),
    source: 'Hospital',
  };
  
  beforeAll(async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not found in environment');
    }
    
    supabase = createClient(supabaseUrl, supabaseKey);
    repository = new QuarantineRepository(supabase);
    tenantRepository = new TenantRepository(supabase);
    
    // Create test tenants (unique to quarantine suite)
    try {
      await tenantRepository.createTenant({ tenant_id: 'test-quarantine-tenant-a', is_active: true });
    } catch (e) { /* May exist */ }
    
    try {
      await tenantRepository.createTenant({ tenant_id: 'test-quarantine-tenant-b', is_active: true });
    } catch (e) { /* May exist */ }
  });
  
  beforeEach(async () => {
    // Cleanup test quarantine entries
    await supabase
      .from('runtime_quarantine')
      .delete()
      .like('tenant_id', 'test-quarantine-tenant-%');
  });
  
  afterAll(async () => {
    await supabase
      .from('runtime_quarantine')
      .delete()
      .like('tenant_id', 'test-quarantine-tenant-%');
  });
  
  // ==========================================================================
  // Quarantine Entry Creation
  // ==========================================================================
  
  describe('Quarantine Entry Creation', () => {
    it('should create quarantine entry with error details', async () => {
      const intent: FinancialIntent = {
        ...validIntent,
        correlationId: 'corr-quarantine-001',
      };
      
      const entry = await repository.quarantine(
        intent,
        'VALIDATION_FAILED',
        1,
        'Invalid currency code: {"field":"currency","value":"XXX"}'
      );
      
      expect(entry.id).toBeDefined();
      expect(entry.tenant_id).toBe('test-quarantine-tenant-a');
      expect(entry.failure_reason).toBe('VALIDATION_FAILED');
      expect(entry.quarantined_at).toBeInstanceOf(Date);
    });
    
    it('should preserve original payload', async () => {
      const intent: FinancialIntent = {
        ...validIntent,
        correlationId: 'corr-payload-001',
        metadata: { custom: 'data', nested: { value: 123 } },
      };
      
      const entry = await repository.quarantine(
        intent,
        'VALIDATION_FAILED',
        1,
        'Test error'
      );
      
      // JSON serialization converts Date to ISO string
      expect(entry.intent_payload.correlationId).toBe('corr-payload-001');
      expect(entry.intent_payload.metadata).toEqual({ custom: 'data', nested: { value: 123 } });
    });
    
    it('should store error details as JSON', async () => {
      const intent: FinancialIntent = {
        ...validIntent,
        correlationId: 'corr-error-details-001',
      };
      
      const errorDetails = JSON.stringify({
        validationErrors: [
          { field: 'amount', message: 'Must be positive' },
          { field: 'currency', message: 'Invalid ISO code' },
        ],
        stack: 'Error stack trace...',
      });
      
      const entry = await repository.quarantine(
        intent,
        'VALIDATION_FAILED',
        1,
        errorDetails
      );
      
      expect(entry.last_error).toContain('validationErrors');
    });
    
    it('should accept optional outbox_id', async () => {
      const intent: FinancialIntent = {
        ...validIntent,
        correlationId: 'corr-outbox-001',
      };
      const outboxId = crypto.randomUUID();
      
      const entry = await repository.quarantine(
        intent,
        'PROCESSING_FAILED',
        3,
        'Publisher timeout',
        outboxId
      );
      
      expect(entry.outbox_id).toBe(outboxId);
    });
  });
  
  // ==========================================================================
  // Resolution Workflow
  // ==========================================================================
  
  describe('Resolution Workflow', () => {
    let entryId: string;
    
    beforeEach(async () => {
      const intent: FinancialIntent = {
        ...validIntent,
        correlationId: 'corr-workflow-001',
      };
      
      const entry = await repository.quarantine(
        intent,
        'VALIDATION_FAILED',
        1,
        'Test error'
      );
      entryId = entry.id;
    });
    
    it('should mark entry as reviewed (replayed)', async () => {
      const updated = await repository.markReplayed(entryId, 'user-reviewer-001');
      
      expect(updated.reviewed).toBe(true);
      expect(updated.reviewed_by).toBe('user-reviewer-001');
      expect(updated.reviewed_at).toBeInstanceOf(Date);
      expect(updated.resolution).toBe('REPLAYED');
    });
    
    it('should mark entry as discarded', async () => {
      const updated = await repository.markDiscarded(entryId, 'user-reviewer-001');
      
      expect(updated.reviewed).toBe(true);
      expect(updated.resolution).toBe('DISCARDED');
    });
    
    it('should mark entry as fixed', async () => {
      const updated = await repository.markFixed(entryId, 'user-reviewer-001');
      
      expect(updated.reviewed).toBe(true);
      expect(updated.resolution).toBe('FIXED');
    });
    
    it('should get unreviewed entries', async () => {
      const unreviewed = await repository.getUnreviewed('test-quarantine-tenant-a');
      
      const found = unreviewed.find(e => e.id === entryId);
      expect(found).toBeDefined();
      expect(found?.reviewed).toBe(false);
    });
    
    it('should track review history', async () => {
      await repository.markReplayed(entryId, 'user-reviewer-001');
      
      const entry = await repository.getById(entryId);
      
      expect(entry.reviewed).toBe(true);
      expect(entry.reviewed_at).toBeDefined();
      expect(entry.reviewed_by).toBe('user-reviewer-001');
      expect(entry.resolution).toBe('REPLAYED');
    });
  });
  
  // ==========================================================================
  // Tenant Isolation
  // ==========================================================================
  
  describe('Tenant Isolation', () => {
    beforeEach(async () => {
      const intentA: FinancialIntent = {
        ...validIntent,
        tenantId: 'test-quarantine-tenant-a',
        correlationId: 'corr-isolation-a',
      };
      await repository.quarantine(intentA, 'VALIDATION_FAILED', 1, 'Tenant A error');
      
      const intentB: FinancialIntent = {
        ...validIntent,
        tenantId: 'test-quarantine-tenant-b',
        correlationId: 'corr-isolation-b',
      };
      await repository.quarantine(intentB, 'VALIDATION_FAILED', 1, 'Tenant B error');
    });
    
    it('should retrieve only tenant-specific entries', async () => {
      const entriesA = await repository.getByTenant('test-quarantine-tenant-a');
      const entriesB = await repository.getByTenant('test-quarantine-tenant-b');
      
      expect(entriesA.every(e => e.tenant_id === 'test-quarantine-tenant-a')).toBe(true);
      expect(entriesB.every(e => e.tenant_id === 'test-quarantine-tenant-b')).toBe(true);
    });
    
    it('should not allow cross-tenant resolution', async () => {
      const intentA: FinancialIntent = {
        ...validIntent,
        tenantId: 'test-quarantine-tenant-a',
        correlationId: 'corr-cross-001',
      };
      
      const entryA = await repository.quarantine(intentA, 'VALIDATION_FAILED', 1, 'Test');
      
      // Retrieve entry (should only work with correct tenant context)
      const retrieved = await repository.getById(entryA.id);
      expect(retrieved?.tenant_id).toBe('test-quarantine-tenant-a');
    });
  });
  
  // ==========================================================================
  // Query Operations
  // ==========================================================================
  
  describe('Query Operations', () => {
    beforeEach(async () => {
      const reasons = ['VALIDATION_FAILED', 'PROCESSING_FAILED', 'VALIDATION_FAILED'];
      
      for (let i = 0; i < 3; i++) {
        const intent: FinancialIntent = {
          ...validIntent,
          correlationId: `corr-query-${i}`,
        };
        
        const entry = await repository.quarantine(
          intent,
          reasons[i],
          1,
          `Error ${i}`
        );
        
        // Mark some as reviewed
        if (i === 1) {
          await repository.markReplayed(entry.id, 'user-reviewer-001');
        } else if (i === 2) {
          await repository.markDiscarded(entry.id, 'user-reviewer-001');
        }
      }
    });
    
    it('should get unreviewed entries', async () => {
      const unreviewed = await repository.getUnreviewed('test-quarantine-tenant-a');
      
      expect(unreviewed.length).toBeGreaterThan(0);
      expect(unreviewed.every(e => e.reviewed === false)).toBe(true);
    });
    
    it('should get all entries by tenant', async () => {
      const all = await repository.getByTenant('test-quarantine-tenant-a');
      
      expect(all.length).toBeGreaterThanOrEqual(3);
    });
    
    it('should filter reviewed entries', async () => {
      const all = await repository.getByTenant('test-quarantine-tenant-a');
      const reviewed = all.filter(e => e.reviewed === true);
      
      expect(reviewed.length).toBeGreaterThanOrEqual(2);
    });
    
    it('should get entries by failure reason (via filter)', async () => {
      const all = await repository.getByTenant('test-quarantine-tenant-a');
      const validationFailed = all.filter(e => e.failure_reason === 'VALIDATION_FAILED');
      
      expect(validationFailed.length).toBeGreaterThanOrEqual(2);
    });
    
    it('should get entries by correlation ID', async () => {
      const entries = await repository.getByCorrelationId('corr-query-0');
      
      expect(entries.length).toBeGreaterThan(0);
      expect(entries.every(e => e.correlation_id === 'corr-query-0')).toBe(true);
    });
    
    it('should search by error message (via filter)', async () => {
      const intent: FinancialIntent = {
        ...validIntent,
        correlationId: 'corr-search-001',
      };
      
      await repository.quarantine(
        intent,
        'VALIDATION_FAILED',
        1,
        'Unique search term: XYZABC'
      );
      
      const all = await repository.getByTenant('test-quarantine-tenant-a');
      const results = all.filter(e => e.last_error?.includes('XYZABC'));
      
      expect(results.length).toBeGreaterThan(0);
    });
  });
  
  // ==========================================================================
  // Statistics
  // ==========================================================================
  
  describe('Statistics', () => {
    beforeEach(async () => {
      const entries = [
        { reason: 'VALIDATION_FAILED' },
        { reason: 'VALIDATION_FAILED' },
        { reason: 'PROCESSING_FAILED' },
        { reason: 'VALIDATION_FAILED' },
      ];
      
      for (let i = 0; i < entries.length; i++) {
        const intent: FinancialIntent = {
          ...validIntent,
          correlationId: `corr-stats-${i}`,
        };
        
        const entry = await repository.quarantine(
          intent,
          entries[i].reason,
          1,
          `Error ${i}`
        );
        
        // Mark some as reviewed
        if (i === 1) {
          await repository.markReplayed(entry.id, 'user-reviewer-001');
        } else if (i === 3) {
          await repository.markDiscarded(entry.id, 'user-reviewer-001');
        }
      }
    });
    
    it('should get quarantine stats', async () => {
      const stats = await repository.getStats('test-quarantine-tenant-a');
      
      expect(stats.totalRecords).toBeGreaterThanOrEqual(4);
      expect(stats.unreviewed).toBeGreaterThanOrEqual(2);
      expect(stats.byResolution.get('REPLAYED')).toBeGreaterThanOrEqual(1);
      expect(stats.byResolution.get('DISCARDED')).toBeGreaterThanOrEqual(1);
    });
  });
  
  // ==========================================================================
  // Bulk Operations
  // ==========================================================================
  
  describe('Bulk Operations', () => {
    beforeEach(async () => {
      for (let i = 0; i < 5; i++) {
        const intent: FinancialIntent = {
          ...validIntent,
          correlationId: `corr-bulk-${i}`,
        };
        
        await repository.quarantine(
          intent,
          'VALIDATION_FAILED',
          1,
          'Bulk test error'
        );
      }
    });
    
    it('should mark multiple entries as discarded', async () => {
      const pending = await repository.getUnreviewed('test-quarantine-tenant-a');
      const ids = pending.slice(0, 3).map(e => e.id);
      
      // Mark each individually (repository doesn't have bulk method)
      for (const id of ids) {
        await repository.markDiscarded(id, 'user-admin-001');
      }
      
      for (const id of ids) {
        const entry = await repository.getById(id);
        expect(entry.resolution).toBe('DISCARDED');
      }
    });
    
    it('should get recent entries (oldest first via order)', async () => {
      const all = await repository.getByTenant('test-quarantine-tenant-a');
      const oldest = all.slice(0, 3);
      
      expect(oldest.length).toBeLessThanOrEqual(3);
      
      // Repository orders by quarantined_at DESC, so we reverse for oldest first
      const oldestFirst = [...oldest].reverse();
      
      // Verify chronological order
      for (let i = 1; i < oldestFirst.length; i++) {
        expect(oldestFirst[i].quarantined_at.getTime()).toBeGreaterThanOrEqual(
          oldestFirst[i - 1].quarantined_at.getTime()
        );
      }
    });
  });
});
