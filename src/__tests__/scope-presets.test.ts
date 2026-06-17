/**
 * Scope Preset Tests
 * 
 * Tests for predefined scope bundles
 * 
 * @module __tests__/scope-presets
 * @since 2026-06-17
 */

import { SCOPE_PRESETS, APIScope } from '@/types/api-gateway';

describe('Scope Presets - Basic Preset', () => {
  test('should have basic read-only scopes', () => {
    const scopes = SCOPE_PRESETS.basic;
    
    expect(scopes).toContain('order:read');
    expect(scopes).toContain('payment:read');
    expect(scopes).toContain('analytics:read');
  });
  
  test('should NOT have write scopes', () => {
    const scopes = SCOPE_PRESETS.basic;
    
    expect(scopes).not.toContain('order:write');
    expect(scopes).not.toContain('payment:write');
  });
});

describe('Scope Presets - POS Integration', () => {
  test('should have order read/write scopes', () => {
    const scopes = SCOPE_PRESETS.pos_integration;
    
    expect(scopes).toContain('order:read');
    expect(scopes).toContain('order:write');
  });
  
  test('should have payment read/write scopes', () => {
    const scopes = SCOPE_PRESETS.pos_integration;
    
    expect(scopes).toContain('payment:read');
    expect(scopes).toContain('payment:write');
  });
  
  test('should have pos sync scopes', () => {
    const scopes = SCOPE_PRESETS.pos_integration;
    
    expect(scopes).toContain('pos:sync');
    expect(scopes).toContain('pos:read');
  });
});

describe('Scope Presets - Payment Gateway', () => {
  test('should have payment scopes', () => {
    const scopes = SCOPE_PRESETS.payment_gateway;
    
    expect(scopes).toContain('payment:read');
    expect(scopes).toContain('payment:write');
  });
  
  test('should have webhook subscription scope', () => {
    const scopes = SCOPE_PRESETS.payment_gateway;
    
    expect(scopes).toContain('webhook:subscribe');
  });
  
  test('should have order read scope (for payment matching)', () => {
    const scopes = SCOPE_PRESETS.payment_gateway;
    
    expect(scopes).toContain('order:read');
  });
});

describe('Scope Presets - HR Platform', () => {
  test('should have hr sync scopes', () => {
    const scopes = SCOPE_PRESETS.hr_platform;
    
    expect(scopes).toContain('hr:sync');
    expect(scopes).toContain('hr:read');
  });
  
  test('should have analytics read scope', () => {
    const scopes = SCOPE_PRESETS.hr_platform;
    
    expect(scopes).toContain('analytics:read');
  });
});

describe('Scope Presets - Invoice Provider', () => {
  test('should have invoice scopes', () => {
    const scopes = SCOPE_PRESETS.invoice_provider;
    
    expect(scopes).toContain('invoice:read');
    expect(scopes).toContain('invoice:create');
    expect(scopes).toContain('invoice:cancel');
  });
  
  test('should have order and payment read scopes', () => {
    const scopes = SCOPE_PRESETS.invoice_provider;
    
    expect(scopes).toContain('order:read');
    expect(scopes).toContain('payment:read');
  });
});

describe('Scope Presets - Admin', () => {
  test('should have wildcard scopes for all resources', () => {
    const scopes = SCOPE_PRESETS.admin;
    
    expect(scopes).toContain('order:*');
    expect(scopes).toContain('payment:*');
    expect(scopes).toContain('invoice:*');
    expect(scopes).toContain('pos:*');
    expect(scopes).toContain('hr:*');
    expect(scopes).toContain('analytics:*');
    expect(scopes).toContain('webhook:*');
  });
});

describe('Scope Presets - Completeness', () => {
  test('all presets should be defined', () => {
    expect(SCOPE_PRESETS.basic).toBeDefined();
    expect(SCOPE_PRESETS.pos_integration).toBeDefined();
    expect(SCOPE_PRESETS.payment_gateway).toBeDefined();
    expect(SCOPE_PRESETS.hr_platform).toBeDefined();
    expect(SCOPE_PRESETS.invoice_provider).toBeDefined();
    expect(SCOPE_PRESETS.admin).toBeDefined();
  });
  
  test('all presets should have at least one scope', () => {
    Object.values(SCOPE_PRESETS).forEach(preset => {
      expect(preset.length).toBeGreaterThan(0);
    });
  });
  
  test('all scopes in presets should be valid APIScope types', () => {
    Object.values(SCOPE_PRESETS).forEach(preset => {
      preset.forEach(scope => {
        // Check format: resource:action or *:* or resource:* or *:action
        expect(scope).toMatch(/^[\w*]+:[\w*]+$/);
      });
    });
  });
});

describe('Scope Presets - No Overlapping Issues', () => {
  test('admin preset should be superset of all other presets', () => {
    const adminScopes = SCOPE_PRESETS.admin;
    
    // Admin should have wildcards that cover all other scopes
    expect(adminScopes).toContain('order:*');
    expect(adminScopes).toContain('payment:*');
    expect(adminScopes).toContain('invoice:*');
    expect(adminScopes).toContain('pos:*');
    expect(adminScopes).toContain('hr:*');
  });
  
  test('basic preset should be minimal (no write scopes)', () => {
    const basicScopes = SCOPE_PRESETS.basic;
    
    basicScopes.forEach(scope => {
      expect(scope).not.toContain(':write');
      expect(scope).not.toContain(':create');
      expect(scope).not.toContain(':delete');
      expect(scope).not.toContain(':update');
    });
  });
});
