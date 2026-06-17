/**
 * API Scope Middleware - Phase 1
 * 
 * Middleware for scope-based access control
 * 
 * Works together with api-key.middleware.ts to enforce fine-grained permissions
 * 
 * @module lib/middleware/scope
 * @since 2026-06-17
 */

import { NextResponse } from 'next/server';
import { RequestWithPartner } from './api-key.middleware';
import { APIScope } from '@/types/api-gateway';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if partner has required scope
 * 
 * Supports wildcard scopes (e.g., 'order:*' matches 'order:read', 'order:write')
 */
function hasScope(
  partnerScopes: string[],
  requiredScope: APIScope
): boolean {
  // Direct match
  if (partnerScopes.includes(requiredScope)) {
    return true;
  }
  
  // Wildcard match: 'order:*' matches 'order:read', 'order:write', etc.
  const [resource, action] = requiredScope.split(':');
  const wildcardScope = `${resource}:*`;
  
  if (partnerScopes.includes(wildcardScope)) {
    return true;
  }
  
  return false;
}

/**
 * Check if partner has ANY of the required scopes (OR logic)
 */
function hasAnyScope(
  partnerScopes: string[],
  requiredScopes: APIScope[]
): boolean {
  return requiredScopes.some(scope => hasScope(partnerScopes, scope));
}

/**
 * Check if partner has ALL of the required scopes (AND logic)
 */
function hasAllScopes(
  partnerScopes: string[],
  requiredScopes: APIScope[]
): boolean {
  return requiredScopes.every(scope => hasScope(partnerScopes, scope));
}

/**
 * Create error response for insufficient permissions
 */
function createScopeErrorResponse(
  requiredScopes: APIScope[],
  partnerScopes: string[]
) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'AUTHZ_001',
        message: 'Insufficient permissions to access this endpoint',
        details: {
          required_scopes: requiredScopes,
          your_scopes: partnerScopes,
          note: 'Contact your administrator to request additional permissions',
        },
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    { status: 403 }
  );
}

// ============================================================================
// MAIN MIDDLEWARE
// ============================================================================

/**
 * Require Scope Middleware
 * 
 * Validates that the authenticated partner has the required scope(s)
 * 
 * **MUST be used AFTER apiKeyMiddleware**
 * 
 * @param req - Request with partner context attached
 * @param requiredScope - Single required scope
 * @returns Error response if scope check fails, null otherwise
 * 
 * @example
 * ```typescript
 * // In route handler
 * const authResult = await withAPIKey(req);
 * if (authResult.error) return authResult.error;
 * 
 * const scopeResult = requireScope(req, 'order:write');
 * if (scopeResult) return scopeResult; // Error
 * 
 * // Proceed with order creation...
 * ```
 */
export function requireScope(
  req: RequestWithPartner,
  requiredScope: APIScope
): NextResponse | null {
  // Check if partner context exists (should be set by apiKeyMiddleware)
  if (!req.partner) {
    console.error('[Scope Middleware] Partner context missing. Did you call apiKeyMiddleware first?');
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_001',
          message: 'Authentication context missing',
        },
      },
      { status: 500 }
    );
  }
  
  const partnerScopes = req.partner.allowed_scopes;
  
  // Check if partner has the required scope
  if (!hasScope(partnerScopes, requiredScope)) {
    console.warn(
      '[Scope Middleware] Access denied',
      {
        partner_id: req.partner.partner_id,
        required_scope: requiredScope,
        partner_scopes: partnerScopes,
      }
    );
    
    return createScopeErrorResponse([requiredScope], partnerScopes);
  }
  
  // Scope check passed
  return null;
}

/**
 * Require Any Scope Middleware (OR logic)
 * 
 * Partner needs at least ONE of the required scopes
 * 
 * @example
 * ```typescript
 * // Allow if partner has EITHER 'order:read' OR 'order:write'
 * const scopeResult = requireAnyScope(req, ['order:read', 'order:write']);
 * ```
 */
export function requireAnyScope(
  req: RequestWithPartner,
  requiredScopes: APIScope[]
): NextResponse | null {
  if (!req.partner) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_001',
          message: 'Authentication context missing',
        },
      },
      { status: 500 }
    );
  }
  
  const partnerScopes = req.partner.allowed_scopes;
  
  if (!hasAnyScope(partnerScopes, requiredScopes)) {
    console.warn(
      '[Scope Middleware] Access denied (any scope)',
      {
        partner_id: req.partner.partner_id,
        required_scopes: requiredScopes,
        partner_scopes: partnerScopes,
      }
    );
    
    return createScopeErrorResponse(requiredScopes, partnerScopes);
  }
  
  return null;
}

/**
 * Require All Scopes Middleware (AND logic)
 * 
 * Partner needs ALL of the required scopes
 * 
 * @example
 * ```typescript
 * // Require BOTH 'order:write' AND 'payment:write'
 * const scopeResult = requireAllScopes(req, ['order:write', 'payment:write']);
 * ```
 */
export function requireAllScopes(
  req: RequestWithPartner,
  requiredScopes: APIScope[]
): NextResponse | null {
  if (!req.partner) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_001',
          message: 'Authentication context missing',
        },
      },
      { status: 500 }
    );
  }
  
  const partnerScopes = req.partner.allowed_scopes;
  
  if (!hasAllScopes(partnerScopes, requiredScopes)) {
    console.warn(
      '[Scope Middleware] Access denied (all scopes)',
      {
        partner_id: req.partner.partner_id,
        required_scopes: requiredScopes,
        partner_scopes: partnerScopes,
      }
    );
    
    return createScopeErrorResponse(requiredScopes, partnerScopes);
  }
  
  return null;
}

// ============================================================================
// CONVENIENCE WRAPPER
// ============================================================================

/**
 * Combine API key authentication and scope validation
 * 
 * @example
 * ```typescript
 * export async function POST(req: NextRequest) {
 *   const { partner, error } = await withAPIKeyAndScope(req, 'order:write');
 *   if (error) return error;
 *   
 *   // Partner authenticated and has 'order:write' scope
 *   const tenantId = partner!.tenant_id;
 *   // ... proceed with order creation ...
 * }
 * ```
 */
export async function withAPIKeyAndScope(
  req: RequestWithPartner,
  requiredScope: APIScope
): Promise<{
  partner?: ReturnType<typeof req.partner>;
  error?: NextResponse;
}> {
  // Import here to avoid circular dependency
  const { withAPIKey } = await import('./api-key.middleware');
  
  // Step 1: Validate API key
  const authResult = await withAPIKey(req);
  if (authResult.error) {
    return { error: authResult.error };
  }
  
  // Step 2: Validate scope
  const scopeError = requireScope(req, requiredScope);
  if (scopeError) {
    return { error: scopeError };
  }
  
  // Success
  return { partner: req.partner };
}

/**
 * Combine API key authentication and ANY scope validation
 */
export async function withAPIKeyAndAnyScope(
  req: RequestWithPartner,
  requiredScopes: APIScope[]
): Promise<{
  partner?: ReturnType<typeof req.partner>;
  error?: NextResponse;
}> {
  const { withAPIKey } = await import('./api-key.middleware');
  
  const authResult = await withAPIKey(req);
  if (authResult.error) {
    return { error: authResult.error };
  }
  
  const scopeError = requireAnyScope(req, requiredScopes);
  if (scopeError) {
    return { error: scopeError };
  }
  
  return { partner: req.partner };
}

/**
 * Combine API key authentication and ALL scopes validation
 */
export async function withAPIKeyAndAllScopes(
  req: RequestWithPartner,
  requiredScopes: APIScope[]
): Promise<{
  partner?: ReturnType<typeof req.partner>;
  error?: NextResponse;
}> {
  const { withAPIKey } = await import('./api-key.middleware');
  
  const authResult = await withAPIKey(req);
  if (authResult.error) {
    return { error: authResult.error };
  }
  
  const scopeError = requireAllScopes(req, requiredScopes);
  if (scopeError) {
    return { error: scopeError };
  }
  
  return { partner: req.partner };
}

