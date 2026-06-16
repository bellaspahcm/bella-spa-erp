import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import type { TenantContext } from '@/core/types/tenant';
import type { Database } from '@/types/database.types';

/**
 * Type for tenant row from database.
 */
type TenantRow = Database['public']['Tables']['tenants']['Row'];

/**
 * API route to fetch tenant configuration for the authenticated user.
 * 
 * @remarks
 * This route extracts the tenant ID from the authenticated user's session,
 * queries the database for tenant configuration, and returns a properly
 * typed TenantContext object.
 * 
 * **Authentication**: Requires valid Supabase session. Returns 401 if not authenticated.
 * 
 * **Authorization**: Users can only access their own tenant's configuration.
 * The tenant_id comes from the authenticated user's profile.
 * 
 * **Caching**: Consider adding HTTP caching headers in production for performance.
 * Tenant configuration rarely changes during a user session.
 * 
 * **Error Handling**:
 * - 401: User not authenticated
 * - 403: User has no tenant assigned
 * - 404: Tenant not found in database
 * - 500: Database query error
 * 
 * @param request - Next.js request object
 * @returns JSON response with TenantContext or error
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user from session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[GET /api/tenant/context] Authentication failed:', authError);
      return NextResponse.json(
        { error: 'Unauthorized: Please log in to access tenant configuration' },
        { status: 401 }
      );
    }

    // Fetch user profile to get tenant_id
    const { data: userProfile, error: userError } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (userError) {
      console.error('[GET /api/tenant/context] Failed to fetch user profile:', userError);
      return NextResponse.json(
        { error: 'Failed to fetch user profile' },
        { status: 500 }
      );
    }

    if (!userProfile?.tenant_id) {
      console.error('[GET /api/tenant/context] User has no tenant assigned:', user.id);
      return NextResponse.json(
        { error: 'Forbidden: User has no tenant assigned' },
        { status: 403 }
      );
    }

    const tenantId = userProfile.tenant_id;

    // Fetch tenant configuration from database
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    if (tenantError) {
      console.error('[GET /api/tenant/context] Failed to fetch tenant:', tenantError);
      return NextResponse.json(
        { error: 'Failed to fetch tenant configuration' },
        { status: 500 }
      );
    }

    if (!tenant) {
      console.error('[GET /api/tenant/context] Tenant not found:', tenantId);
      return NextResponse.json(
        { error: 'Not Found: Tenant configuration not found' },
        { status: 404 }
      );
    }

    // Transform database row to TenantContext
    const tenantContext = transformTenantRowToContext(tenant);

    // Return tenant context
    return NextResponse.json(tenantContext, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        // Cache for 5 minutes to reduce database load
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (error) {
    console.error('[GET /api/tenant/context] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Internal server error: ${errorMessage}` },
      { status: 500 }
    );
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
 * @param tenant - Tenant row from database
 * @returns TenantContext object
 */
function transformTenantRowToContext(tenant: TenantRow): TenantContext {
  // Extract enabled modules from database (stored as text[] or JSON)
  const enabledModules = Array.isArray(tenant.enabled_modules)
    ? tenant.enabled_modules
    : tenant.enabled_modules
    ? [tenant.enabled_modules as string]
    : ['spa']; // Default to spa module for backward compatibility

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
  const settings: Record<string, any> = {
    currency: 'VND', // Default currency
    timezone: 'Asia/Ho_Chi_Minh', // Default timezone
    locale: 'vi-VN', // Default locale
    companyName: tenant.name, // Always set company name
  };

  // Merge in any additional settings from database
  if (tenant.brand_theme && typeof tenant.brand_theme === 'object') {
    Object.assign(settings, {
      logoUrl: (tenant.brand_theme as any).logoUrl || tenant.logo_url,
      primaryColor: (tenant.brand_theme as any).primaryColor,
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
    enabledModules: enabledModules as any, // Cast to readonly array
    subscriptionPlan,
    featureFlags,
    settings,
  };

  return context;
}
