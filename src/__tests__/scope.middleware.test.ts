/**
 * Scope Middleware Tests
 * 
 * Tests for API scope-based permission system
 * 
 * @module __tests__/scope.middleware
 * @since 2026-06-17
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  requireScope,
  requireAnyScope,
  requireAllScopes,
} from '@/lib/middleware/scope.middleware';
import { RequestWithPartner } from '@/lib/middleware/api-key.middleware';
import { APIScope } from '@/types/api-gateway';

// ============================================================================
// MOCK SETUP
// ============================================================================

const createMockPartner = (scopes: APIScope[]) => ({
  id: 'partner-123',
  tenant_id: 'tenant-456',
  partner_id: 'partner-123',
  partner_name: 'Test Partner',
  partner_type: 'pos' as const,
  api_key: 'pk_test_abc123',
  allowed_scopes: scopes,
  is_active: true,
  is_sandbox: true,
  rate_limit_per_minute: 100,
  rate_limit_per_day: 5000,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

const createMockRequest = (partner: any): RequestWithPartner => {
  const req = new NextRequest('http://localhost/api/test') as RequestWithPartner;
  req.partner = partner;
  return req;
};

// ============================================================================
// TEST SUITE 1: SINGLE SCOPE VALIDATION
// ============================================================================

describe('Scope Middleware - Single Scope Validation', () => {
  test('should allow access when partner has required scope', () => {
    const partner = createMockPartner(['order:read', 'order:write']);
    const req = createMockRequest(partner);
    
    const error = requireScope(req, 'order:read');
    
    expect(error).toBeNull();
  });
  
  test('should deny access when partner does not have required scope', () => {
    const partner = createMockPartner(['order:read']);
    const req = createMockRequest(partner);
    
    const error = requireScope(req, 'payment:write');
    
    expect(error).not.toBeNull();
    expect(error).toBeInstanceOf(NextResponse);
  });
  
  test('should handle missing partner context', () => {
    const req = new NextRequest('http://localhost/api/test') as RequestWithPartner;
    
    const error = requireScope(req, 'order:read');
    
    expect(error).not.toBeNull();
  });
});

// ============================================================================
// TEST SUITE 2: MULTIPLE SCOPE VALIDATION (AND LOGIC)
// ============================================================================

describe('Scope Middleware - Multiple Scopes (AND Logic)', () => {
  test('should allow access when partner has all required scopes', () => {
    const partner = createMockPartner(['order:read', 'order:write', 'payment:read']);
    const req = createMockRequest(partner);
    
    const error = requireAllScopes(req, ['order:read', 'payment:read']);
    
    expect(error).toBeNull();
  });
  
  test('should deny access when partner is missing one scope', () => {
    const partner = createMockPartner(['order:read', 'order:write']);
    const req = createMockRequest(partner);
    
    const error = requireAllScopes(req, ['order:read', 'payment:read']);
    
    expect(error).not.toBeNull();
  });
  
  test('should deny access when partner is missing all scopes', () => {
    const partner = createMockPartner(['order:read']);
    const req = createMockRequest(partner);
    
    const error = requireAllScopes(req, ['payment:read', 'invoice:write']);
    
    expect(error).not.toBeNull();
  });
  
  test('should allow access for empty required scopes array', () => {
    const partner = createMockPartner(['order:read']);
    const req = createMockRequest(partner);
    
    const error = requireAllScopes(req, []);
    
    // Empty array means no requirements, should pass
    expect(error).toBeNull();
  });
});

// ============================================================================
// TEST SUITE 3: ANY SCOPE VALIDATION (OR LOGIC)
// ============================================================================

describe('Scope Middleware - Any Scope (OR Logic)', () => {
  test('should allow access when partner has at least one required scope', () => {
    const partner = createMockPartner(['order:read', 'order:write']);
    const req = createMockRequest(partner);
    
    const error = requireAnyScope(req, ['order:read', 'payment:read']);
    
    expect(error).toBeNull();
  });
  
  test('should allow access when partner has all required scopes', () => {
    const partner = createMockPartner(['order:read', 'payment:read']);
    const req = createMockRequest(partner);
    
    const error = requireAnyScope(req, ['order:read', 'payment:read']);
    
    expect(error).toBeNull();
  });
  
  test('should deny access when partner has none of the required scopes', () => {
    const partner = createMockPartner(['order:read']);
    const req = createMockRequest(partner);
    
    const error = requireAnyScope(req, ['payment:read', 'invoice:write']);
    
    expect(error).not.toBeNull();
  });
  
  test('should deny access for empty required scopes array', () => {
    const partner = createMockPartner(['order:read']);
    const req = createMockRequest(partner);
    
    const error = requireAnyScope(req, []);
    
    // Empty array means no valid options, should fail
    expect(error).not.toBeNull();
  });
});

// ============================================================================
// TEST SUITE 4: WILDCARD SCOPES
// ============================================================================

describe('Scope Middleware - Wildcard Scopes', () => {
  test('should match wildcard scope (order:*) with order:read', () => {
    const partner = createMockPartner(['order:*']);
    const req = createMockRequest(partner);
    
    const error = requireScope(req, 'order:read');
    
    expect(error).toBeNull();
  });
  
  test('should match wildcard scope (order:*) with order:write', () => {
    const partner = createMockPartner(['order:*']);
    const req = createMockRequest(partner);
    
    const error = requireScope(req, 'order:write');
    
    expect(error).toBeNull();
  });
  
  test('should NOT match wildcard scope (order:*) with payment:read', () => {
    const partner = createMockPartner(['order:*']);
    const req = createMockRequest(partner);
    
    const error = requireScope(req, 'payment:read');
    
    expect(error).not.toBeNull();
  });
  
  test('should handle multiple wildcards correctly', () => {
    const partner = createMockPartner(['order:*', 'payment:*']);
    const req = createMockRequest(partner);
    
    // Should allow order and payment scopes
    expect(requireScope(req, 'order:read')).toBeNull();
    expect(requireScope(req, 'order:write')).toBeNull();
    expect(requireScope(req, 'payment:read')).toBeNull();
    expect(requireScope(req, 'payment:write')).toBeNull();
    
    // Should deny other scopes
    expect(requireScope(req, 'invoice:read')).not.toBeNull();
  });
});

// ============================================================================
// TEST SUITE 5: SCOPE HIERARCHY
// ============================================================================

describe('Scope Middleware - Scope Hierarchy', () => {
  test('should respect specific scope over wildcard', () => {
    const partner = createMockPartner(['order:*', 'order:read']);
    const req = createMockRequest(partner);
    
    const error = requireScope(req, 'order:read');
    
    expect(error).toBeNull();
  });
});

// ============================================================================
// TEST SUITE 6: EDGE CASES
// ============================================================================

describe('Scope Middleware - Edge Cases', () => {
  test('should handle case-sensitive scope matching', () => {
    const partner = createMockPartner(['order:read']);
    const req = createMockRequest(partner);
    
    // Scopes should be case-sensitive
    const error = requireScope(req, 'ORDER:READ' as APIScope);
    
    expect(error).not.toBeNull();
  });
  
  test('should handle partner with empty scopes array', () => {
    const partner = createMockPartner([]);
    const req = createMockRequest(partner);
    
    const error = requireScope(req, 'order:read');
    
    expect(error).not.toBeNull();
  });
  
  test('should handle special characters in scope names', () => {
    const partner = createMockPartner(['order-management:read' as APIScope]);
    const req = createMockRequest(partner);
    
    const error = requireScope(req, 'order-management:read' as APIScope);
    
    expect(error).toBeNull();
  });
});

// ============================================================================
// TEST SUITE 7: PERFORMANCE
// ============================================================================

describe('Scope Middleware - Performance', () => {
  test('should check scope in under 5ms', () => {
    const partner = createMockPartner(['order:read', 'order:write', 'payment:read']);
    const req = createMockRequest(partner);
    
    const start = performance.now();
    requireScope(req, 'order:read');
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(5);
  });
  
  test('should handle large scope arrays efficiently', () => {
    // Partner with 50 scopes
    const manyScopes: APIScope[] = [];
    for (let i = 0; i < 50; i++) {
      manyScopes.push(`scope${i}:read` as APIScope);
    }
    manyScopes.push('order:read');
    
    const partner = createMockPartner(manyScopes);
    const req = createMockRequest(partner);
    
    const start = performance.now();
    requireScope(req, 'order:read');
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(10);
  });
});
