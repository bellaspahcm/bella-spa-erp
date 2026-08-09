import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import type { TenantContext } from '@/core/types/tenant';
import type { Database } from '@/types/database.types';

/**
 * Type for tenant row from database.
 */
type TenantRow = Database['public']['Tables']['tenants']['Row'];

/**
 * Extended NextRequest with TenantContext attached.
 * 
 * @remarks
 * This type extends NextRequest to include a `tenantContext` property
 * that is populated by the `withTenantContext` middleware.
 * 
 * Use this type in API route handlers that require tenant context:
 * 
 * @example
 * ```typescript
 * import { withTenantContext, type NextRequestWithContext } from '@/core/middleware/tenantContext';
 * 
 * export const POST = withTenantContext(async (request: NextRequestWithContext) => {
 *   const context = request.tenantContext;
 *   const order = await createOrder(context, orderData);
 *   return NextResponse.json(order);
 * });
 * ```
 */
export interface NextRequestWithContext extends NextRequest {
  /**
   * Tenant context object containing configuration and entitlements.
   * Populated by `withTenantContext` middleware.
   */
  tenantContext: TenantContext;
}

/**
 * Handler function that receives NextRequest with TenantContext.
 */
export type TenantContextHandler = (
  request: NextRequestWithContext
) => Promise<Response> | Response;

/**
 * Middleware to extract tenant ID from request and construct TenantContext.
 * 
 * @remarks
 * This middleware:
 * 1. Extracts authenticated user from Supabase session
 * 2. Fetches user's tenant_id from user profile
 * 3. Fetches tenant configuration from database
 * 4. Constructs TenantContext and attaches to request
 * 5. Calls the wrapped handler with the extended request
 * 
 * **Error Handling**:
 * - Returns 401 if user is not authenticated
 * - Returns 403 if user has no tenant assigned
 * - Returns 404 if tenant not found in database
 * - Returns 500 if database query fails
 * 
 * **Usage Pattern**:
 * ```typescript
 * import { withTenantContext } from '@/core/middleware/tenantContext';
 * 
 * export const POST = withTenantContext(async (request) => {
 *   const context = request.tenantContext;
 *   // Use context in service calls
 *   const result = await someService(context, data);
 *   return NextResponse.json(result);
 * });
 * ```
 * 
 * **Security**:
 * - Validates tenant ID belongs to authenticated user
 * - Prevents cross-tenant access attempts
 * - All errors are logged for audit trail
 * 
 * @param handler - API route handler that receives request with TenantContext
 * @returns Wrapped handler that extracts tenant context before calling handler
 */
export function withTenantContext(handler: TenantContextHandler) {
  return async (request: NextRequest): Promise<Response> => {
    try {
      // Extract tenant context from request
      const result = await extractTenantContext(request);

      // If extraction failed, return error response
      if (!result.success) {
        console.error('[withTenantContext] Failed to extract tenant context:', result.error);
        return NextResponse.json(
          { error: result.error },
          { status: result.statusCode }
        );
      }

      // Attach tenant context to request
      const requestWithContext = request as NextRequestWithContext;
      requestWithContext.tenantContext = result.context;

      // Call the wrapped handler
      return await handler(requestWithContext);
    } catch (error) {
      console.error('[withTenantContext] Unexpected error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json(
        { error: `Internal server error: ${errorMessage}` },
        { status: 500 }
      );
    }
  };
}

/**
 * Result of tenant context extraction.
 */
type ExtractionResult =
  | { success: true; context: TenantContext }
  | { success: false; error: string; statusCode: number };

/**
 * Extract tenant context from request.
 * 
 * @remarks
 * This function encapsulates the logic for extracting tenant context
 * from an authenticated request. It can be used independently of the
 * `withTenantContext` middleware for testing or custom middleware chains.
 * 
 * **Extraction Steps**:
 * 1. Get authenticated user from Supabase session
 * 2. Query user profile to get tenant_id
 * 3. Query tenant configuration from database
 * 4. Transform database row to TenantContext
 * 
 * **Error Cases**:
 * - User not authenticated (401)
 * - User has no tenant assigned (403)
 * - Tenant not found (404)
 * - Database query error (500)
 * 
 * @param request - Next.js request object
 * @returns Extraction result with context or error details
 */
export async function extractTenantContext(
  _request: NextRequest
): Promise<ExtractionResult> {
  try {
    const supabase = await createClient();

    // Get authenticated user from session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[extractTenantContext] Authentication failed:', authError);
      return {
        success: false,
        error: 'Unauthorized: Please log in to access this resource',
        statusCode: 401,
      };
    }

    // Fetch user profile to get tenant_id
    const { data: userProfile, error: userError } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (userError) {
      console.error('[extractTenantContext] Failed to fetch user profile:', userError);
      return {
        success: false,
        error: 'Failed to fetch user profile',
        statusCode: 500,
      };
    }

    if (!userProfile?.tenant_id) {
      console.error('[extractTenantContext] User has no tenant assigned:', user.id);
      return {
        success: false,
        error: 'Forbidden: User has no tenant assigned',
        statusCode: 403,
      };
    }

    const tenantId = userProfile.tenant_id;

    // Fetch tenant configuration from database
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    if (tenantError) {
      console.error('[extractTenantContext] Failed to fetch tenant:', tenantError);
      return {
        success: false,
        error: 'Failed to fetch tenant configuration',
        statusCode: 500,
      };
    }

    if (!tenant) {
      console.error('[extractTenantContext] Tenant not found:', tenantId);
      return {
        success: false,
        error: 'Not Found: Tenant configuration not found',
        statusCode: 404,
      };
    }

    // Transform database row to TenantContext
    const tenantContext = transformTenantRowToContext(tenant);

    return {
      success: true,
      context: tenantContext,
    };
  } catch (error) {
    console.error('[extractTenantContext] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Internal server error: ${errorMessage}`,
      statusCode: 500,
    };
  }
}

/**
 * Transform database tenant row to TenantContext contract type.
 * 
 * @remarks
 * This function maps the database schema to the TenantContext interface
 * defined in Phase 2. It handles type conversions and provides defaults
 * for missing fields.
 * 
 * **Field Mappings**:
 * - `id` → `tenantId`
 * - `name` → `tenantName`
 * - `enabled_modules` → `enabledModules` (with default ['spa'])
 * - `subscription_tier` → `subscriptionPlan` (with default 'basic')
 * - Database JSON fields → `featureFlags` and `settings`
 * 
 * **Defaults**:
 * - If `enabled_modules` is null/empty, defaults to `['spa']`
 * - If `subscription_plan` is null, defaults to `'basic'`
 * - Feature flags and settings default to empty objects if not set
 * 
 * **Note**: This function duplicates logic from `/api/tenant/context` route
 * to maintain consistency. Any changes to tenant context transformation
 * should be applied to both locations.
 * 
 * @param tenant - Tenant row from database
 * @returns TenantContext object
 */
function transformTenantRowToContext(tenant: TenantRow): TenantContext {
  // Extract enabled modules from database (stored as text[] or JSON)
  let enabledModules: string[] = ['spa'];
  if (tenant.enabled_modules) {
    if (Array.isArray(tenant.enabled_modules)) {
      enabledModules = tenant.enabled_modules.filter((item): item is string => typeof item === 'string');
    } else if (typeof tenant.enabled_modules === 'object') {
      enabledModules = Object.entries(tenant.enabled_modules)
        .filter(([_key, value]) => value === true)
        .map(([key]) => key === 'babycare' ? 'spa' : key);
    } else if (typeof tenant.enabled_modules === 'string') {
      enabledModules = [tenant.enabled_modules === 'babycare' ? 'spa' : tenant.enabled_modules];
    }
  }
  if (enabledModules.length === 0) {
    enabledModules = ['spa'];
  }

  // Extract subscription plan (with fallback to 'basic')
  const subscriptionPlan = (tenant.subscription_tier as TenantContext['subscriptionPlan']) || 'basic';

  // Extract feature flags from database
  // Feature flags may be stored in a JSON column or derived from tenant settings
  const featureFlags: Record<string, boolean> = {};
  
  // Parse feature flags from tenant configuration if available
  if (tenant.role_permissions && typeof tenant.role_permissions === 'object') {
    const rolePermissions = tenant.role_permissions as Record<string, unknown>;
    if (rolePermissions.feature_flags && typeof rolePermissions.feature_flags === 'object') {
      Object.assign(featureFlags, rolePermissions.feature_flags);
    }
  }

  // Extract settings from database
  // Settings include currency, timezone, locale, and other tenant-specific config
  const settings: Record<string, unknown> = {
    currency: 'VND', // Default currency
    timezone: 'Asia/Ho_Chi_Minh', // Default timezone
    locale: 'vi-VN', // Default locale
    companyName: tenant.name, // Always set company name
  };

  // Merge in any additional settings from database
  if (tenant.brand_theme && typeof tenant.brand_theme === 'object') {
    Object.assign(settings, {
      logoUrl: (tenant.brand_theme as unknown).logoUrl || tenant.logo_url,
      primaryColor: (tenant.brand_theme as unknown).primaryColor,
    });
  } else if (tenant.logo_url) {
    // If no brand_theme but logo_url exists, set it
    settings.logoUrl = tenant.logo_url;
  }

  // Add salary configuration if available
  if (tenant.salary_config && typeof tenant.salary_config === 'object') {
    settings.salaryConfig = tenant.salary_config;
  }

  // Add QR payment configuration if available
  if (tenant.qr_bank_code) {
    settings.qrPayment = {
      bankCode: tenant.qr_bank_code,
      accountNumber: tenant.qr_account_number,
      accountName: tenant.qr_account_name,
    };
  }

  // Add contact information
  if (tenant.contact_phone || tenant.email || tenant.address) {
    settings.contact = {
      phone: tenant.contact_phone,
      email: tenant.email,
      address: tenant.address,
    };
  }

  // Construct and return TenantContext
  const context: TenantContext = {
    tenantId: tenant.id,
    tenantName: tenant.name || 'Unnamed Tenant',
    enabledModules: enabledModules as unknown, // Cast to readonly array
    subscriptionPlan,
    featureFlags,
    settings,
  };

  return context;
}
