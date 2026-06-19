/**
 * Sandbox Detection Middleware
 * 
 * Detects sandbox vs production environment based on API key prefix.
 * Routes requests to appropriate database schema.
 * 
 * Features:
 * - Automatic environment detection (pk_test_ vs pk_live_)
 * - Schema routing (sandbox vs public)
 * - Sandbox mode indicators in responses
 * - Prevent cross-contamination (test keys cannot access production)
 * 
 * @module middleware/sandbox
 */

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { APIPartner } from '@/types/api-gateway';
import type { PartnerContext, RequestWithPartner } from './api-key.middleware';
import { APIError } from '@/types/api-gateway';

/**
 * Environment type
 */
export type Environment = 'sandbox' | 'production';

/**
 * Sandbox configuration
 */
interface SandboxConfig {
  environment: Environment;
  schema: string; // 'sandbox' or 'public'
  isSandbox: boolean;
}

type RequestWithSandbox = RequestWithPartner & { sandbox?: SandboxConfig };

/**
 * Detect environment from API key prefix
 * 
 * @param apiKey - API key (pk_test_... or pk_live_...)
 * @returns Environment type
 * 
 * @example
 * ```typescript
 * detectEnvironment('pk_test_abc123') // 'sandbox'
 * detectEnvironment('pk_live_xyz789') // 'production'
 * ```
 */
export function detectEnvironment(apiKey: string): Environment {
  if (apiKey.startsWith('pk_test_')) {
    return 'sandbox';
  } else if (apiKey.startsWith('pk_live_')) {
    return 'production';
  } else {
    throw new APIError(
      'AUTH_001',
      'Invalid API key format. Must start with pk_test_ (sandbox) or pk_live_ (production)',
      { provided_prefix: apiKey.substring(0, 8) },
      401
    );
  }
}

/**
 * Get database schema for environment
 * 
 * @param environment - Environment type
 * @returns PostgreSQL schema name
 */
export function getSchemaForEnvironment(environment: Environment): string {
  return environment === 'sandbox' ? 'sandbox' : 'public';
}

/**
 * Sandbox detection middleware
 * Sets sandbox configuration on request object
 * 
 * MUST be called after withAPIKey() middleware
 * 
 * @param req - Next.js request (must have req.partner set)
 * @returns Sandbox configuration
 * 
 * @example
 * ```typescript
 * export async function GET(req: NextRequest) {
 *   await withAPIKey(req);
 *   const sandbox = await detectSandboxMode(req);
 *   
 *   if (sandbox.isSandbox) {
 *     console.log('⚠️ Sandbox mode: Test data only');
 *   }
 *   
 *   // Use sandbox.schema for database queries
 *   const { data } = await supabase
 *     .schema(sandbox.schema)
 *     .from('orders')
 *     .select('*');
 * }
 * ```
 */
export function detectSandboxMode(req: NextRequest): SandboxConfig {
  // Ensure partner is set (should be set by withAPIKey)
  const partner = (req as RequestWithPartner).partner;
  
  if (!partner) {
    throw new APIError(
      'SERVER_001',
      'Partner not set. Ensure withAPIKey() is called before detectSandboxMode()'
    );
  }

  // Detect environment from API key
  const environment: Environment = partner.is_sandbox ? 'sandbox' : 'production';
  const schema = getSchemaForEnvironment(environment);
  const isSandbox = environment === 'sandbox';

  // Set sandbox config on request
  const config: SandboxConfig = {
    environment,
    schema,
    isSandbox,
  };

  (req as RequestWithSandbox).sandbox = config;

  // Log sandbox requests for monitoring
  if (isSandbox) {
    console.log('🧪 Sandbox request:', {
      partner_id: partner.partner_id,
      partner_name: partner.partner_name,
      tenant_id: partner.tenant_id,
      schema,
      method: req.method,
      url: req.url,
    });
  }

  return config;
}

/**
 * Validate environment access
 * Ensures partner is using correct API key for intended environment
 * 
 * @param partner - API partner
 * @param requiredEnvironment - Required environment
 * @throws APIError if environment mismatch
 * 
 * @example
 * ```typescript
 * // Enforce production-only endpoint
 * validateEnvironmentAccess(partner, 'production');
 * ```
 */
export function validateEnvironmentAccess(
  partner: APIPartner,
  requiredEnvironment: Environment
): void {
  const currentEnvironment = detectEnvironment(partner.api_key);
  
  if (currentEnvironment !== requiredEnvironment) {
    throw new APIError(
      'AUTHZ_001',
      `This endpoint requires ${requiredEnvironment} API key. You are using ${currentEnvironment} key.`,
      {
        current_environment: currentEnvironment,
        required_environment: requiredEnvironment,
        api_key_prefix: partner.api_key.substring(0, 8),
      },
      403
    );
  }
}

/**
 * Add sandbox indicator to response headers
 * Helps partners know they're in sandbox mode
 * 
 * @param req - Next.js request
 * @param headers - Response headers object
 * @returns Updated headers
 * 
 * @example
 * ```typescript
 * const headers = new Headers();
 * addSandboxHeaders(req, headers);
 * 
 * // Headers will include:
 * // X-Environment: sandbox
 * // X-Sandbox-Mode: true
 * ```
 */
export function addSandboxHeaders(
  req: NextRequest,
  headers: Headers | Record<string, string>
): void {
  const sandbox = (req as RequestWithSandbox).sandbox;
  
  if (!sandbox) {
    // If sandbox not detected, assume production
    if (headers instanceof Headers) {
      headers.set('X-Environment', 'production');
      headers.set('X-Sandbox-Mode', 'false');
    } else {
      headers['X-Environment'] = 'production';
      headers['X-Sandbox-Mode'] = 'false';
    }
    return;
  }

  if (headers instanceof Headers) {
    headers.set('X-Environment', sandbox.environment);
    headers.set('X-Sandbox-Mode', sandbox.isSandbox ? 'true' : 'false');
    if (sandbox.isSandbox) {
      headers.set('X-Sandbox-Schema', sandbox.schema);
    }
  } else {
    headers['X-Environment'] = sandbox.environment;
    headers['X-Sandbox-Mode'] = sandbox.isSandbox ? 'true' : 'false';
    if (sandbox.isSandbox) {
      headers['X-Sandbox-Schema'] = sandbox.schema;
    }
  }
}

/**
 * Wrapper: API route with sandbox detection
 * Combines withAPIKey + detectSandboxMode + automatic header injection
 * 
 * @param handler - Route handler function
 * @returns Wrapped handler with sandbox detection
 * 
 * @example
 * ```typescript
 * export const GET = withSandbox(async (req, { sandbox }) => {
 *   // Use sandbox.schema for queries
 *   const { data } = await supabase
 *     .schema(sandbox.schema)
 *     .from('orders')
 *     .select('*');
 *   
 *   return success(req, data);
 * });
 * ```
 */
export function withSandbox(
  handler: (
    req: NextRequest,
    context: {
      sandbox: SandboxConfig;
      partner: PartnerContext;
    }
  ) => Promise<Response>
) {
  return async (req: NextRequest, _routeContext?: unknown): Promise<Response> => {
    // Import withAPIKey to avoid circular dependency
    const { withAPIKey } = await import('./api-key.middleware');
    
    // Authenticate
    await withAPIKey(req);
    
    // Detect sandbox mode
    const sandbox = detectSandboxMode(req);
    
    // Execute handler
    const response = await handler(req, {
      sandbox,
      partner: (req as RequestWithPartner).partner!,
    });
    
    // Add sandbox headers to response
    addSandboxHeaders(req, response.headers);
    
    return response;
  };
}

/**
 * Get Supabase client with sandbox schema support
 * Returns a Supabase client configured for correct schema
 * 
 * @param req - Next.js request (with sandbox config)
 * @returns Supabase client configured for sandbox or production
 * 
 * @example
 * ```typescript
 * const supabase = getSandboxAwareSupabaseClient(req);
 * 
 * // Queries automatically go to correct schema
 * const { data } = await supabase.from('orders').select('*');
 * ```
 */
export function getSandboxAwareSupabaseClient(req: NextRequest) {
  const sandbox = (req as RequestWithSandbox).sandbox;
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: {
        schema: sandbox?.schema || 'public',
      },
    }
  );
  
  return supabase;
}
