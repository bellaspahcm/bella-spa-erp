/**
 * Test JWT Helper for Phase 3C
 * 
 * Generates Supabase-compatible JWT tokens with tenant claims for testing RLS enforcement.
 * 
 * Phase 3B used service_role (bypasses RLS).
 * Phase 3C uses anon key + tenant JWT (enforces RLS).
 * 
 * @see BELLA_RUNTIME_PHASE_3C_TEST_PLAN.md (Test Categories 3C-3, 3C-4)
 */

import jwt from 'jsonwebtoken';

export interface TenantJWTPayload {
  sub: string; // User ID
  role: 'authenticated' | 'anon';
  aud: 'authenticated';
  exp: number;
  iat: number;
  tenant_id: string; // Custom claim for tenant isolation
  app_metadata?: {
    tenant_id?: string;
  };
  user_metadata?: {
    tenant_id?: string;
  };
}

export interface GenerateTenantJWTOptions {
  tenantId: string;
  userId?: string;
  expiresInSeconds?: number;
  role?: 'authenticated' | 'anon';
}

/**
 * Generate Supabase-compatible JWT with tenant claims
 * 
 * @param options - JWT configuration
 * @returns Signed JWT token string
 * 
 * @example
 * ```typescript
 * const token = generateTenantJWT({ tenantId: 'tenant-a' });
 * const client = createClient(url, anonKey, {
 *   global: { headers: { Authorization: `Bearer ${token}` } }
 * });
 * ```
 */
export function generateTenantJWT(options: GenerateTenantJWTOptions): string {
  const {
    tenantId,
    userId = `test-user-${tenantId}`,
    expiresInSeconds = 3600,
    role = 'authenticated',
  } = options;

  const now = Math.floor(Date.now() / 1000);
  
  const payload: TenantJWTPayload = {
    sub: userId,
    role,
    aud: 'authenticated',
    exp: now + expiresInSeconds,
    iat: now,
    tenant_id: tenantId,
    app_metadata: {
      tenant_id: tenantId,
    },
    user_metadata: {
      tenant_id: tenantId,
    },
  };

  // Use Supabase JWT secret from environment
  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  
  if (!jwtSecret) {
    throw new Error('SUPABASE_JWT_SECRET not found in environment. Required for Phase 3C RLS testing.');
  }

  return jwt.sign(payload, jwtSecret, {
    algorithm: 'HS256',
  });
}

/**
 * Create authenticated Supabase client with tenant context
 * 
 * @param tenantId - Tenant ID for JWT claim
 * @param userId - Optional user ID (defaults to test-user-{tenantId})
 * @returns Supabase client with tenant JWT authentication
 * 
 * @example
 * ```typescript
 * const client = createAuthenticatedClient('tenant-a');
 * // All queries now run under tenant-a context with RLS enforcement
 * const { data } = await client.from('runtime_outbox').select('*');
 * // Returns only tenant-a records due to RLS policy
 * ```
 */
export function createAuthenticatedClient(
  tenantId: string,
  userId?: string
): ReturnType<typeof import('@supabase/supabase-js').createClient> {
  const { createClient } = require('@supabase/supabase-js');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !anonKey) {
    throw new Error('Supabase URL or anon key not found in environment');
  }

  const token = generateTenantJWT({ tenantId, userId });

  return createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

/**
 * Verify JWT token for debugging
 * 
 * @param token - JWT token string
 * @returns Decoded payload or null if invalid
 */
export function verifyTenantJWT(token: string): TenantJWTPayload | null {
  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  
  if (!jwtSecret) {
    throw new Error('SUPABASE_JWT_SECRET not found');
  }

  try {
    return jwt.verify(token, jwtSecret, {
      algorithms: ['HS256'],
    }) as TenantJWTPayload;
  } catch (error) {
    return null;
  }
}
