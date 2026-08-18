/**
 * Tenant Repository Integration Tests
 * 
 * Tests for runtime_tenant_registry table operations (Phase 3B)
 * 
 * Focus:
 * - CRUD operations
 * - Tenant lifecycle (activate/deactivate)
 * - Database constraints
 * - Query performance
 * 
 * Test Plan: BELLA_RUNTIME_PHASE_3_TEST_PLAN.md v1.1
 * Gate: P3-3 (Tenant Isolation - database layer foundation)
 * 
 * REQUIRES: Supabase connection + runtime tables
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { TenantRepository } from '../../../src/platform/integration-runtime/database/tenant-repository';
import { TenantIsolationError } from '../../../src/platform/integration-runtime/types/runtime-errors.types';

describe('TenantRepository Integration', () => {
  let supabase: SupabaseClient;
  let repository: TenantRepository;
  
  beforeAll(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not found in environment');
    }
    
    supabase = createClient(supabaseUrl, supabaseKey);
    repository = new TenantRepository(supabase);
  });
  
  beforeEach(async () => {
    // Cleanup test tenants
    await supabase
      .from('runtime_tenant_registry')
      .delete()
      .like('tenant_id', 'test-tenant-%');
  });
  
  afterAll(async () => {
    // Final cleanup
    await supabase
      .from('runtime_tenant_registry')
      .delete()
      .like('tenant_id', 'test-tenant-%');
  });
  
  // ==========================================================================
  // Tenant Creation
  // ==========================================================================
  
  describe('Tenant Creation', () => {
    it('should create new tenant', async () => {
      const tenant = await repository.createTenant({
        tenant_id: 'test-tenant-001',
        tenant_name: 'Test Tenant 001',
        is_active: true,
      });
      
      expect(tenant.tenant_id).toBe('test-tenant-001');
      expect(tenant.tenant_name).toBe('Test Tenant 001');
      expect(tenant.is_active).toBe(true);
      expect(tenant.created_at).toBeInstanceOf(Date);
      expect(tenant.updated_at).toBeInstanceOf(Date);
    });
    
    it('should create tenant with metadata', async () => {
      const tenant = await repository.createTenant({
        tenant_id: 'test-tenant-002',
        tenant_name: 'Test Tenant 002',
        is_active: true,
        metadata: {
          industry: 'Healthcare',
          tier: 'Enterprise',
        },
      });
      
      expect(tenant.metadata).toEqual({
        industry: 'Healthcare',
        tier: 'Enterprise',
      });
    });
    
    it('should reject duplicate tenant_id', async () => {
      await repository.createTenant({
        tenant_id: 'test-tenant-duplicate',
        is_active: true,
      });
      
      // Attempt duplicate
      await expect(
        repository.createTenant({
          tenant_id: 'test-tenant-duplicate',
          is_active: true,
        })
      ).rejects.toThrow();
    });
    
    it('should auto-generate timestamps', async () => {
      const before = new Date();
      
      const tenant = await repository.createTenant({
        tenant_id: 'test-tenant-timestamps',
        is_active: true,
      });
      
      const after = new Date();
      
      // Add 1-second buffer for database timestamp precision
      expect(tenant.created_at.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
      expect(tenant.created_at.getTime()).toBeLessThanOrEqual(after.getTime() + 1000);
      expect(tenant.updated_at.getTime()).toBeGreaterThanOrEqual(tenant.created_at.getTime());
    });
  });
  
  // ==========================================================================
  // Tenant Retrieval
  // ==========================================================================
  
  describe('Tenant Retrieval', () => {
    beforeEach(async () => {
      await repository.createTenant({
        tenant_id: 'test-tenant-active',
        tenant_name: 'Active Tenant',
        is_active: true,
      });
      
      await repository.createTenant({
        tenant_id: 'test-tenant-inactive',
        tenant_name: 'Inactive Tenant',
        is_active: false,
      });
    });
    
    it('should retrieve tenant by ID', async () => {
      const tenant = await repository.getTenant('test-tenant-active');
      
      expect(tenant.tenant_id).toBe('test-tenant-active');
      expect(tenant.tenant_name).toBe('Active Tenant');
      expect(tenant.is_active).toBe(true);
    });
    
    it('should throw error for non-existent tenant', async () => {
      await expect(
        repository.getTenant('test-tenant-nonexistent')
      ).rejects.toThrow(TenantIsolationError);
    });
    
    it('should retrieve active tenant only', async () => {
      const tenant = await repository.getActiveTenant('test-tenant-active');
      expect(tenant.is_active).toBe(true);
    });
    
    it('should reject inactive tenant in getActiveTenant', async () => {
      await expect(
        repository.getActiveTenant('test-tenant-inactive')
      ).rejects.toThrow(TenantIsolationError);
    });
    
    it('should list only active tenants', async () => {
      const activeTenants = await repository.listActiveTenants();
      
      const testTenants = activeTenants.filter(t => t.tenant_id.startsWith('test-tenant-'));
      expect(testTenants.length).toBe(1);
      expect(testTenants[0].tenant_id).toBe('test-tenant-active');
    });
    
    it('should check tenant existence', async () => {
      expect(await repository.tenantExists('test-tenant-active')).toBe(true);
      expect(await repository.tenantExists('test-tenant-nonexistent')).toBe(false);
    });
    
    it('should check tenant active status', async () => {
      expect(await repository.isTenantActive('test-tenant-active')).toBe(true);
      expect(await repository.isTenantActive('test-tenant-inactive')).toBe(false);
      expect(await repository.isTenantActive('test-tenant-nonexistent')).toBe(false);
    });
  });
  
  // ==========================================================================
  // Tenant Updates
  // ==========================================================================
  
  describe('Tenant Updates', () => {
    beforeEach(async () => {
      await repository.createTenant({
        tenant_id: 'test-tenant-update',
        tenant_name: 'Original Name',
        is_active: true,
        metadata: { version: '1.0' },
      });
    });
    
    it('should update tenant name', async () => {
      const updated = await repository.updateTenant('test-tenant-update', {
        tenant_name: 'Updated Name',
      });
      
      expect(updated.tenant_name).toBe('Updated Name');
      expect(updated.updated_at.getTime()).toBeGreaterThan(updated.created_at.getTime());
    });
    
    it('should update tenant metadata', async () => {
      const updated = await repository.updateTenant('test-tenant-update', {
        metadata: { version: '2.0', new_field: 'value' },
      });
      
      expect(updated.metadata).toEqual({ version: '2.0', new_field: 'value' });
    });
    
    it('should update is_active status', async () => {
      const updated = await repository.updateTenant('test-tenant-update', {
        is_active: false,
      });
      
      expect(updated.is_active).toBe(false);
    });
    
    it('should auto-update updated_at timestamp', async () => {
      const before = await repository.getTenant('test-tenant-update');
      
      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const updated = await repository.updateTenant('test-tenant-update', {
        tenant_name: 'New Name',
      });
      
      expect(updated.updated_at.getTime()).toBeGreaterThan(before.updated_at.getTime());
    });
    
    it('should throw error when updating non-existent tenant', async () => {
      await expect(
        repository.updateTenant('test-tenant-nonexistent', { tenant_name: 'Test' })
      ).rejects.toThrow(TenantIsolationError);
    });
  });
  
  // ==========================================================================
  // Tenant Lifecycle
  // ==========================================================================
  
  describe('Tenant Lifecycle', () => {
    beforeEach(async () => {
      await repository.createTenant({
        tenant_id: 'test-tenant-lifecycle',
        tenant_name: 'Lifecycle Tenant',
        is_active: true,
      });
    });
    
    it('should deactivate tenant', async () => {
      await repository.deactivateTenant('test-tenant-lifecycle');
      
      const tenant = await repository.getTenant('test-tenant-lifecycle');
      expect(tenant.is_active).toBe(false);
    });
    
    it('should activate tenant', async () => {
      await repository.deactivateTenant('test-tenant-lifecycle');
      await repository.activateTenant('test-tenant-lifecycle');
      
      const tenant = await repository.getTenant('test-tenant-lifecycle');
      expect(tenant.is_active).toBe(true);
    });
    
    it('should exclude deactivated tenant from active list', async () => {
      await repository.deactivateTenant('test-tenant-lifecycle');
      
      const activeTenants = await repository.listActiveTenants();
      const found = activeTenants.find(t => t.tenant_id === 'test-tenant-lifecycle');
      
      expect(found).toBeUndefined();
    });
  });
  
  // ==========================================================================
  // Database Constraints
  // ==========================================================================
  
  describe('Database Constraints', () => {
    it('should enforce tenant_id NOT NULL', async () => {
      // Supabase returns error object instead of throwing
      const result = await supabase.from('runtime_tenant_registry').insert({
        tenant_id: null,
        is_active: true,
      });
      
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('23502'); // NOT NULL violation
      expect(result.error?.message).toContain('tenant_id');
    });
    
    it('should enforce tenant_id not empty (CHECK constraint)', async () => {
      await expect(
        repository.createTenant({
          tenant_id: '',
          is_active: true,
        })
      ).rejects.toThrow();
    });
    
    it('should enforce tenant_id not whitespace', async () => {
      await expect(
        repository.createTenant({
          tenant_id: '   ',
          is_active: true,
        })
      ).rejects.toThrow();
    });
    
    it('should enforce is_active NOT NULL', async () => {
      // Supabase returns error object instead of throwing
      const result = await supabase.from('runtime_tenant_registry').insert({
        tenant_id: 'test-tenant-null-active',
        is_active: null,
      });
      
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('23502'); // NOT NULL violation
      expect(result.error?.message).toContain('is_active');
    });
  });
  
  // ==========================================================================
  // Concurrent Operations
  // ==========================================================================
  
  describe('Concurrent Operations', () => {
    it('should handle concurrent tenant creation attempts', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        repository.createTenant({
          tenant_id: `test-tenant-concurrent-${i}`,
          is_active: true,
        })
      );
      
      const results = await Promise.all(promises);
      
      expect(results.length).toBe(5);
      expect(new Set(results.map(r => r.tenant_id)).size).toBe(5);
    });
    
    it('should handle concurrent updates to same tenant', async () => {
      await repository.createTenant({
        tenant_id: 'test-tenant-concurrent-update',
        tenant_name: 'Original',
        is_active: true,
      });
      
      const promises = Array.from({ length: 3 }, (_, i) =>
        repository.updateTenant('test-tenant-concurrent-update', {
          tenant_name: `Updated ${i}`,
        })
      );
      
      await Promise.all(promises);
      
      // Should succeed (last write wins)
      const tenant = await repository.getTenant('test-tenant-concurrent-update');
      expect(tenant.tenant_name).toMatch(/^Updated \d$/);
    });
  });
});
