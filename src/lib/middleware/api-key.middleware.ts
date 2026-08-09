/**
 * API Key Middleware - Phase 1
 * 
 * Middleware for API partner authentication and tenant resolution
 * 
 * CRITICAL SECURITY:
 * - Validates API key from header
 * - Resolves tenant from partner (NO client-provided tenant_id)
 * - Prevents tenant injection attacks
 * - Logs all API requests for audit
 * 
 * @module lib/middleware/api-key
 * @since 2026-06-17
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminUrl, getSupabaseAdminKey } from '@/lib/supabase-admin-env';
import {
  APIError,
  PartnerValidationResult,
  CreateAPIRequestLogInput,
  HTTPMethod,
} from '@/types/api-gateway';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Partner Context - Attached to request after validation
 */
export interface PartnerContext {
  partner_id: string;
  tenant_id: string;
  partner_name: string;
  allowed_scopes: string[];
  is_active: boolean;
  is_sandbox: boolean;
  rate_limit_per_minute: number;
  rate_limit_per_day: number;
}

/**
 * Extended Request with Partner Context
 */
export interface RequestWithPartner extends NextRequest {
  partner?: PartnerContext;
  request_id?: string;
  rateLimitHeaders?: Record<string, string>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

type APIKeyQueryError = {
  code?: string;
  message: string;
};

type APIKeyQueryResult<T> = {
  data: T | null;
  error: APIKeyQueryError | null;
};

type APIKeySupabaseClient = {
  rpc(
    functionName: 'validate_api_partner',
    params: { p_api_key: string }
  ): Promise<APIKeyQueryResult<PartnerValidationResult[]>>;
  from(table: 'api_request_logs'): {
    insert(payload: CreateAPIRequestLogInput): Promise<APIKeyQueryResult<unknown>>;
  };
};

function asAPIKeySupabaseClient(client: unknown): APIKeySupabaseClient {
  return client as APIKeySupabaseClient;
}

const API_KEY_HEADER = 'x-api-key';
const ALTERNATIVE_HEADER = 'authorization'; // Bearer <api-key>

/**
 * Endpoints that DON'T require API key (public or session-based auth)
 */
const PUBLIC_ENDPOINTS = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/session',
  '/api/health',
  '/api/test-upcoming', // Dev only
];

/**
 * Endpoints that require API key (partner APIs)
 */
const PARTNER_API_PREFIXES = [
  '/api/v1/', // All versioned APIs
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate unique request ID for tracing
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Get client IP address from request
 * NextRequest doesn't have .ip property, need to extract from headers
 */
export function getClientIP(req: NextRequest): string {
  // Try various headers in order of reliability
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip') || // Cloudflare
    'unknown'
  );
}

/**
 * Extract API key from request headers
 */
function extractAPIKey(req: NextRequest): string | null {
  // Try x-api-key header first
  let apiKey = req.headers.get(API_KEY_HEADER);
  
  if (!apiKey) {
    // Try Authorization header: "Bearer <api-key>"
    const authHeader = req.headers.get(ALTERNATIVE_HEADER);
    if (authHeader?.startsWith('Bearer ')) {
      apiKey = authHeader.substring(7);
    }
  }
  
  return apiKey;
}

/**
 * Check if endpoint requires API key authentication
 */
function requiresAPIKey(pathname: string): boolean {
  // Public endpoints don't require API key
  if (PUBLIC_ENDPOINTS.some(ep => pathname.startsWith(ep))) {
    return false;
  }
  
  // Partner API endpoints require API key
  if (PARTNER_API_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
    return true;
  }
  
  return false;
}

/**
 * Helper to get service_role Supabase client for API Gateway middleware operations
 * (Bypasses RLS restrictions on api_request_logs and partner validation queries)
 */
function getAdminSupabaseClient(): APIKeySupabaseClient {
  const adminUrl = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();
  if (adminUrl && adminKey) {
    return asAPIKeySupabaseClient(createSupabaseClient(adminUrl, adminKey));
  }
  return asAPIKeySupabaseClient(
    createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  );
}

/**
 * Validate API key and get partner info from database
 * 
 * NOTE: The validate_api_partner RPC exists in the database but TypeScript
 * types haven't been regenerated yet. Using type assertion as temporary workaround.
 * TODO: Regenerate types with: npx supabase gen types typescript --project-id <id>
 */
async function validateAPIKey(apiKey: string): Promise<PartnerValidationResult | null> {
  const supabase = getAdminSupabaseClient();
  const { data, error } = await supabase
    .rpc('validate_api_partner', { p_api_key: apiKey });

  if (error) {
    throw new APIError(
      'SERVER_002',
      'Failed to validate API partner',
      { code: error.code, message: error.message },
      500
    );
  }

  return data?.[0] ?? null;
}

/**
 * Fetch partner metadata for validation checks (IP Whitelist, etc.)
 */
async function getPartnerMetadata(partnerId: string): Promise<Record<string, unknown>> {
  const adminUrl = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();
  if (!adminUrl || !adminKey) {
    throw new APIError(
      'SERVER_002',
      'Partner security metadata is unavailable',
      undefined,
      500
    );
  }

  const supabaseAdmin = createSupabaseClient(adminUrl, adminKey);
  const { data, error } = await supabaseAdmin
    .from('api_partners')
    .select('metadata')
    .eq('id', partnerId)
    .single();

  if (error || !data) {
    throw new APIError(
      'SERVER_002',
      'Failed to load partner security metadata',
      error ? { code: error.code, message: error.message } : undefined,
      500
    );
  }

  return data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata)
    ? data.metadata as Record<string, unknown>
    : {};
}

/**
 * Helper to validate if string is a valid IPv4 or IPv6 address for PostgreSQL INET column
 */
function isValidIP(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return false;
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip) || ip === '::1' || ip === '127.0.0.1';
}

/**
 * Log API request to database (async, non-blocking)
 * 
 * NOTE: The api_request_logs table exists in the database but TypeScript
 * types haven't been regenerated yet. Using type assertion as temporary workaround.
 * TODO: Regenerate types with: npx supabase gen types typescript --project-id <id>
 */
export async function logAPIRequest(logData: CreateAPIRequestLogInput): Promise<void> {
  const supabase = getAdminSupabaseClient();

  // Primary: Use SECURITY DEFINER RPC log_api_request for safe INET handling and RLS bypass
  const { error: rpcError } = await (supabase.rpc as unknown)('log_api_request', {
    p_partner_id: logData.partner_id,
    p_tenant_id: logData.tenant_id,
    p_method: logData.method,
    p_endpoint: logData.endpoint,
    p_status_code: logData.status_code,
    p_response_time_ms: logData.response_time_ms,
    p_is_error: logData.is_error ?? false,
    p_error_code: logData.error_code ?? null,
    p_error_message: logData.error_message ?? null,
    p_ip_address: logData.ip_address ?? null,
    p_user_agent: logData.user_agent ?? null,
    p_request_id: logData.request_id ?? null,
  });

  if (!rpcError) {
    return;
  }

  // If RPC is missing (e.g. before migration), attempt fallback direct insert
  if (rpcError.code === 'PGRST202' || rpcError.message?.includes('function') || rpcError.message?.includes('does not exist')) {
    const payload = { ...logData };
    if (payload.ip_address && !isValidIP(payload.ip_address)) {
      delete payload.ip_address;
    }

    const { error: insertError } = await supabase
      .from('api_request_logs')
      .insert(payload);

    if (insertError) {
      throw new APIError(
        'SERVER_002',
        'Failed to persist API request audit log',
        { code: insertError.code, message: insertError.message },
        500
      );
    }
    return;
  }

  // If RPC returned a database error, throw APIError
  throw new APIError(
    'SERVER_002',
    'Failed to persist API request audit log',
    { code: rpcError.code, message: rpcError.message },
    500
  );
}

/**
 * Create error response with proper format
 */
function createErrorResponse(
  code: string,
  message: string,
  statusCode: number = 401,
  details?: unknown
) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        details,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    { status: statusCode }
  );
}

// ============================================================================
// MAIN MIDDLEWARE
// ============================================================================

/**
 * API Key Middleware
 * 
 * **CRITICAL SECURITY RULES:**
 * 1. API key MUST be provided in header
 * 2. Tenant MUST be resolved from API key (NOT from request body)
 * 3. Client CANNOT inject tenant_id
 * 4. All requests are logged for audit
 * 5. Inactive partners are blocked
 * 
 * @param req - Next.js request
 * @returns Response or modified request
 */
export async function apiKeyMiddleware(
  req: RequestWithPartner
): Promise<NextResponse | null> {
  const startTime = Date.now();
  const pathname = req.nextUrl.pathname;
  const method = req.method as HTTPMethod;
  
  // Generate unique request ID for tracing
  const requestId = generateRequestId();
  req.request_id = requestId;
  
  // Check if this endpoint requires API key
  if (!requiresAPIKey(pathname)) {
    // Public endpoint - no API key required
    return null; // Continue to next middleware
  }
  
  // ============================================================
  // STEP 1: Extract API Key from Headers
  // ============================================================
  
  const apiKey = extractAPIKey(req);
  
  if (!apiKey) {
    return createErrorResponse(
      'AUTH_001',
      'API key is required. Provide it via x-api-key header or Authorization: Bearer <key>',
      401,
      {
        header_options: [
          'x-api-key: <your-api-key>',
          'Authorization: Bearer <your-api-key>',
        ],
      }
    );
  }
  
  // ============================================================
  // STEP 2: Validate API Key & Get Partner Info
  // ============================================================
  
  const partnerInfo = await validateAPIKey(apiKey);
  
  if (!partnerInfo) {
    // Log failed attempt as security warning (avoid inserting non-UUID 'unknown' into DB)
    console.warn('[SECURITY] Invalid API key attempt:', {
      ip: getClientIP(req),
      endpoint: pathname,
      request_id: requestId,
      api_key_prefix: apiKey.substring(0, 8),
    });
    
    return createErrorResponse(
      'AUTH_001',
      'Invalid API key. Please check your credentials.',
      401
    );
  }
  
  // Check if partner is active
  if (!partnerInfo.is_active) {
    await logAPIRequest({
      partner_id: partnerInfo.partner_id,
      tenant_id: partnerInfo.tenant_id,
      method,
      endpoint: pathname,
      status_code: 403,
      response_time_ms: Date.now() - startTime,
      is_error: true,
      error_code: 'AUTH_002',
      error_message: 'API key inactive',
      ip_address: getClientIP(req),
      user_agent: req.headers.get('user-agent') || undefined,
      request_id: requestId,
    });
    
    return createErrorResponse(
      'AUTH_002',
      'Your API key has been deactivated. Please contact support.',
      403
    );
  }
  
  // ============================================================
  // STEP 2.5: Optional IP Whitelisting Check
  // ============================================================
  const clientIp = getClientIP(req);
  const metadata = await getPartnerMetadata(partnerInfo.partner_id);

  if (metadata.ip_whitelist) {
    const whitelist = Array.isArray(metadata.ip_whitelist)
      ? metadata.ip_whitelist
      : typeof metadata.ip_whitelist === 'string'
        ? metadata.ip_whitelist.split(',').map((ip: string) => ip.trim())
        : [];

    if (whitelist.length > 0 && !whitelist.includes(clientIp)) {
      console.warn(
        '[SECURITY] Blocked request from unauthorized IP: %s for partner: %s',
        clientIp,
        partnerInfo.partner_name
      );

      await logAPIRequest({
        partner_id: partnerInfo.partner_id,
        tenant_id: partnerInfo.tenant_id,
        method,
        endpoint: pathname,
        status_code: 403,
        response_time_ms: Date.now() - startTime,
        is_error: true,
        error_code: 'AUTHZ_001',
        error_message: 'Forbidden: IP address not in whitelist',
        ip_address: clientIp,
        user_agent: req.headers.get('user-agent') || undefined,
        request_id: requestId,
      });

      return createErrorResponse(
        'AUTHZ_001',
        'Forbidden: Your IP address is not whitelisted for this API key.',
        403,
        { ip_address: clientIp }
      );
    }
  }
  // ============================================================
  // STEP 3: Attach Partner Context to Request
  // ============================================================
  
  req.partner = {
    partner_id: partnerInfo.partner_id,
    tenant_id: partnerInfo.tenant_id,
    partner_name: partnerInfo.partner_name,
    allowed_scopes: partnerInfo.allowed_scopes,
    is_active: partnerInfo.is_active,
    is_sandbox: partnerInfo.is_sandbox,
    rate_limit_per_minute: partnerInfo.rate_limit_per_minute,
    rate_limit_per_day: partnerInfo.rate_limit_per_day,
  };
  
  // ============================================================
  // STEP 4: Prevent Tenant Injection Attack
  // ============================================================
  
  // If request body contains tenant_id, validate it matches partner's tenant
  if (req.method !== 'GET') {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      body = null;
    }

    if (body && typeof body === 'object' && !Array.isArray(body)) {
      const tenantId = (body as Record<string, unknown>).tenant_id;
      if (tenantId && tenantId !== partnerInfo.tenant_id) {
        console.error('[SECURITY ALERT] Tenant injection attempt detected', {
          partner_id: partnerInfo.partner_id,
          partner_tenant_id: partnerInfo.tenant_id,
          provided_tenant_id: tenantId,
          endpoint: pathname,
          ip_address: getClientIP(req),
        });

        await logAPIRequest({
          partner_id: partnerInfo.partner_id,
          tenant_id: partnerInfo.tenant_id,
          method,
          endpoint: pathname,
          request_body: { tenant_id: tenantId },
          status_code: 403,
          response_time_ms: Date.now() - startTime,
          is_error: true,
          error_code: 'AUTHZ_003',
          error_message: 'Tenant mismatch - potential security breach',
          ip_address: getClientIP(req),
          user_agent: req.headers.get('user-agent') || undefined,
          request_id: requestId,
          metadata: {
            security_alert: true,
            attempted_tenant_id: tenantId,
          },
        });

        return createErrorResponse(
          'AUTHZ_003',
          'Tenant ID mismatch. You cannot access data from other tenants.',
          403,
          {
            your_tenant_id: partnerInfo.tenant_id,
            provided_tenant_id: tenantId,
            note: 'Tenant is resolved from your API key. Do not provide tenant_id in request body.',
          }
        );
      }
    }
  }
  // ============================================================
  // STEP 5: Success - Continue to Route Handler
  // ============================================================
  
  // If response wrapper (like withSandbox) will log the request with actual response status,
  // skip logging premature status_code 200 here to prevent double logs and incorrect status codes.
  if (!(req as unknown as Record<string, unknown>)._willLogResponse) {
    await logAPIRequest({
      partner_id: partnerInfo.partner_id,
      tenant_id: partnerInfo.tenant_id,
      method,
      endpoint: pathname,
      status_code: 200,
      response_time_ms: Date.now() - startTime,
      is_error: false,
      ip_address: getClientIP(req),
      user_agent: req.headers.get('user-agent') || undefined,
      request_id: requestId,
    });
  }
  
  // Continue to next middleware or route handler
  return null;
}

// ============================================================================
// HELPER MIDDLEWARE WRAPPER
// ============================================================================

/**
 * Wrapper to use middleware in route handlers
 * 
 * Usage:
 * ```typescript
 * export async function GET(req: NextRequest) {
 *   const authResult = await withAPIKey(req);
 *   if (authResult.error) return authResult.error;
 *   
 *   const partner = authResult.partner;
 *   // ... use partner context ...
 * }
 * ```
 */
export async function withAPIKey(req: RequestWithPartner): Promise<{
  partner?: PartnerContext;
  error?: NextResponse;
}> {
  const result = await apiKeyMiddleware(req);
  
  if (result) {
    // Error response
    return { error: result };
  }
  
  // Success - return partner context
  return { partner: req.partner };
}
