/**
 * Tenant Validator Unit Tests
 * 
 * Tests for tenant validation and isolation (Phase 3A)
 * 
 * Focus:
 * - Tenant existence validation
 * - Active tenant validation
 * - Cross-tenant scope validation
 * - Tenant registration
 * 
 * Test Plan: BELLA_RUNTIME_PHASE_3_TEST_PLAN.md v1.1
 * Gate: P3-3 (Tenant Isolation - application level)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TenantValidator } from '../../../src/platform/integration-runtime/validation/tenant-validator';
import { TenantIsolationError } from '../../../src/platform/integration-runtime/types/runtime-errors.types';

describe('TenantValidator', () => {
  let validator: TenantValidator;
  
  beforeEach(() => {
    validator = new TenantValidator();
    validator.clearCache();
  });
  
  // ==========================================================================
  // Tenant Registration
  // ==========================================================================
  
  describe('Tenant Registration', () => {
    it('should register new tenant', () => {
      validator.registerTenant({
        tenantId: 'tenant-a',
        tenantName: 'Tenant A',
        isActive: true,
        createdAt: new Date(),
      });
      
      expect(validator.isTenantValid('tenant-a')).toBe(true);
    });
    
    it('should register multiple tenants', () => {
      validator.registerTenant({
        tenantId: 'tenant-a',
        isActive: true,
        createdAt: new Date(),
      });
      
      validator.registerTenant({
        tenantId: 'tenant-b',
        isActive: true,
        createdAt: new Date(),
      });
      
      expect(validator.isTenantValid('tenant-a')).toBe(true);
      expect(validator.isTenantValid('tenant-b')).toBe(true);
    });
  });
  
  // ==========================================================================
  // Tenant Validation
  // ==========================================================================
  
  describe('Tenant Validation', () => {
    beforeEach(() => {
      validator.registerTenant({
        tenantId: 'active-tenant',
        tenantName: 'Active Tenant',
        isActive: true,
        createdAt: new Date(),
      });
      
      validator.registerTenant({
        tenantId: 'inactive-tenant',
        tenantName: 'Inactive Tenant',
        isActive: false,
        createdAt: new Date(),
      });
    });
    
    it('should validate active tenant', () => {
      const tenant = validator.validateTenant('active-tenant');
      
      expect(tenant.tenantId).toBe('active-tenant');
      expect(tenant.isActive).toBe(true);
    });
    
    it('should throw error for non-existent tenant', () => {
      expect(() => {
        validator.validateTenant('non-existent');
      }).toThrow(TenantIsolationError);
      
      try {
        validator.validateTenant('non-existent');
      } catch (error) {
        expect(error).toBeInstanceOf(TenantIsolationError);
        expect((error as TenantIsolationError).tenantId).toBe('non-existent');
        expect((error as TenantIsolationError).message).toContain('not found');
      }
    });
    
    it('should throw error for empty tenantId', () => {
      expect(() => {
        validator.validateTenant('');
      }).toThrow(TenantIsolationError);
    });
    
    it('should throw error for whitespace tenantId', () => {
      expect(() => {
        validator.validateTenant('   ');
      }).toThrow(TenantIsolationError);
    });
    
    it('should throw error for inactive tenant', () => {
      expect(() => {
        validator.validateTenant('inactive-tenant');
      }).toThrow(TenantIsolationError);
      
      try {
        validator.validateTenant('inactive-tenant');
      } catch (error) {
        expect((error as TenantIsolationError).message).toContain('inactive');
      }
    });
  });
  
  // ==========================================================================
  // Tenant Scope Validation (Cross-Tenant Protection)
  // ==========================================================================
  
  describe('Tenant Scope Validation', () => {
    it('should allow same-tenant access', () => {
      expect(() => {
        validator.validateTenantScope('tenant-a', 'tenant-a');
      }).not.toThrow();
    });
    
    it('should deny cross-tenant access', () => {
      expect(() => {
        validator.validateTenantScope('tenant-a', 'tenant-b');
      }).toThrow(TenantIsolationError);
      
      try {
        validator.validateTenantScope('tenant-a', 'tenant-b');
      } catch (error) {
        expect(error).toBeInstanceOf(TenantIsolationError);
        expect((error as TenantIsolationError).message).toContain('Cross-tenant access denied');
        expect((error as TenantIsolationError).message).toContain('tenant-a');
        expect((error as TenantIsolationError).message).toContain('tenant-b');
      }
    });
    
    it('should deny cross-tenant access (reverse)', () => {
      expect(() => {
        validator.validateTenantScope('tenant-b', 'tenant-a');
      }).toThrow(TenantIsolationError);
    });
  });
  
  // ==========================================================================
  // Tenant Status Checks (Non-Throwing)
  // ==========================================================================
  
  describe('Tenant Status Checks', () => {
    beforeEach(() => {
      validator.registerTenant({
        tenantId: 'active-tenant',
        isActive: true,
        createdAt: new Date(),
      });
      
      validator.registerTenant({
        tenantId: 'inactive-tenant',
        isActive: false,
        createdAt: new Date(),
      });
    });
    
    it('should return true for valid active tenant', () => {
      expect(validator.isTenantValid('active-tenant')).toBe(true);
    });
    
    it('should return false for inactive tenant', () => {
      expect(validator.isTenantValid('inactive-tenant')).toBe(false);
    });
    
    it('should return false for non-existent tenant', () => {
      expect(validator.isTenantValid('non-existent')).toBe(false);
    });
  });
  
  // ==========================================================================
  // Tenant Lifecycle Management
  // ==========================================================================
  
  describe('Tenant Lifecycle', () => {
    beforeEach(() => {
      validator.registerTenant({
        tenantId: 'test-tenant',
        isActive: true,
        createdAt: new Date(),
      });
    });
    
    it('should deactivate tenant', () => {
      validator.deactivateTenant('test-tenant');
      
      expect(validator.isTenantValid('test-tenant')).toBe(false);
      
      const tenant = validator.getTenantContext('test-tenant');
      expect(tenant?.isActive).toBe(false);
    });
    
    it('should list only active tenants', () => {
      validator.registerTenant({
        tenantId: 'active-1',
        isActive: true,
        createdAt: new Date(),
      });
      
      validator.registerTenant({
        tenantId: 'active-2',
        isActive: true,
        createdAt: new Date(),
      });
      
      validator.registerTenant({
        tenantId: 'inactive-1',
        isActive: false,
        createdAt: new Date(),
      });
      
      const activeTenants = validator.listActiveTenants();
      
      expect(activeTenants.length).toBe(3); // test-tenant + active-1 + active-2
      expect(activeTenants.every(t => t.isActive)).toBe(true);
      expect(activeTenants.find(t => t.tenantId === 'inactive-1')).toBeUndefined();
    });
  });
  
  // ==========================================================================
  // Tenant Context Retrieval
  // ==========================================================================
  
  describe('Tenant Context Retrieval', () => {
    beforeEach(() => {
      validator.registerTenant({
        tenantId: 'test-tenant',
        tenantName: 'Test Tenant',
        isActive: true,
        createdAt: new Date('2026-01-01'),
        metadata: {
          industry: 'Healthcare',
          tier: 'Enterprise',
        },
      });
    });
    
    it('should retrieve full tenant context', () => {
      const tenant = validator.getTenantContext('test-tenant');
      
      expect(tenant).toBeDefined();
      expect(tenant?.tenantId).toBe('test-tenant');
      expect(tenant?.tenantName).toBe('Test Tenant');
      expect(tenant?.isActive).toBe(true);
      expect(tenant?.metadata).toEqual({
        industry: 'Healthcare',
        tier: 'Enterprise',
      });
    });
    
    it('should return undefined for non-existent tenant', () => {
      const tenant = validator.getTenantContext('non-existent');
      
      expect(tenant).toBeUndefined();
    });
  });
});
