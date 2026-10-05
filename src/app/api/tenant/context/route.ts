import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cookies, headers } from 'next/headers';
import { combineChunks, createServerClient as createSupabaseServerClient } from '@supabase/ssr';
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';
import { getSupabaseAdminUrl, getSupabaseAdminKey } from '@/lib/supabase-admin-env';
import { getSupabasePublicUrl, requireSupabasePublicEnv } from '@/lib/supabase-public-env';
import type { TenantContext } from '@/core/types/tenant';
import type { Database } from '@/types/database.types';
import type { SupabaseClient, User } from '@supabase/supabase-js';

/**
 * Create a fresh Supabase server client for this Route Handler.
 * We do NOT use the cached `createClient` from supabase-server.ts because
 * React's cache() wrapper is incompatible with Next.js Route Handler context.
 */
async function createRouteHandlerClient() {
  const cookieStore = await cookies();
  const { url, publicKey } = requireSupabasePublicEnv();

  return createSupabaseServerClient<Database>(
    url,
    publicKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set({ name, value, ...options });
            });
          } catch {
            // Route handlers cannot always set cookies after response work has started.
          }
        },
      },
    }
  );
}

function getProjectRefFromSupabaseUrl() {
  const url = getSupabasePublicUrl();
  if (!url) return null;

  try {
    return new URL(url).hostname.split('.')[0] || null;
  } catch {
    return null;
  }
}

function decodeBase64UrlToUtf8(encoded: string) {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');

  if (typeof atob === 'function') {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  return Buffer.from(encoded, 'base64url').toString('utf8');
}

function readAccessTokenFromCookieValue(value: string | undefined) {
  if (!value) return null;

  try {
    const normalizedValue = decodeCookieValue(value);
    const encoded = normalizedValue.startsWith('base64-') ? normalizedValue.slice('base64-'.length) : null;
    if (!encoded) return null;

    const decoded = decodeBase64UrlToUtf8(encoded);
    const parsed: unknown = JSON.parse(decoded);

    if (typeof parsed !== 'object' || parsed === null) return null;

    const accessToken = (parsed as { access_token?: unknown }).access_token;
    return typeof accessToken === 'string' && accessToken.length > 0 ? accessToken : null;
  } catch {
    return null;
  }
}

function decodeCookieValue(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseRawCookieHeader(cookieHeader: string | null) {
  if (!cookieHeader) return [];

  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex < 1) return null;

      return {
        name: part.slice(0, separatorIndex).trim(),
        value: part.slice(separatorIndex + 1).trim(),
      };
    })
    .filter((cookie): cookie is { name: string; value: string } => Boolean(cookie?.name));
}

function getRequestCookies(request: NextRequest) {
  const cookiesByName = new Map<string, string>();

  for (const cookie of request.cookies.getAll()) {
    cookiesByName.set(cookie.name, cookie.value);
  }

  for (const cookie of parseRawCookieHeader(request.headers.get('cookie'))) {
    if (!cookiesByName.has(cookie.name)) {
      cookiesByName.set(cookie.name, cookie.value);
    }
  }

  return Array.from(cookiesByName, ([name, value]) => ({ name, value }));
}

async function readAccessTokenFromChunkedCookie(
  cookieName: string,
  requestCookies: ReturnType<NextRequest['cookies']['getAll']>,
) {
  const cookieValue = await combineChunks(cookieName, (chunkName) => {
    return requestCookies.find((cookie) => cookie.name === chunkName)?.value;
  });

  return readAccessTokenFromCookieValue(cookieValue ?? undefined);
}

async function getSupabaseAccessTokenFromRequest(request: NextRequest) {
  const requestCookies = getRequestCookies(request);
  const projectRef = getProjectRefFromSupabaseUrl();
  const preferredCookieName = projectRef ? `sb-${projectRef}-auth-token` : null;
  const preferredToken = preferredCookieName
    ? await readAccessTokenFromChunkedCookie(preferredCookieName, requestCookies)
    : null;

  if (preferredToken) return preferredToken;

  const authCookieNames = new Set<string>();

  for (const cookie of requestCookies) {
    const match = cookie.name.match(/^(sb-.+-auth-token)(?:\.\d+)?$/);
    if (!match?.[1]) continue;

    authCookieNames.add(match[1]);
  }

  if (preferredCookieName) {
    authCookieNames.delete(preferredCookieName);
  }

  for (const cookieName of authCookieNames) {
    const token = await readAccessTokenFromChunkedCookie(cookieName, requestCookies);
    if (token) return token;
  }

  return null;
}

function createBearerClient(accessToken: string): SupabaseClient<Database> {
  const { url, publicKey } = requireSupabasePublicEnv();

  return createSupabaseJsClient<Database>(
    url,
    publicKey,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    },
  );
}

async function resolveAuthenticatedUser(
  request: NextRequest,
  supabase: SupabaseClient<Database>,
): Promise<{ user: User | null; authError: unknown; queryClient: SupabaseClient<Database> }> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (user && !authError) {
    return { user, authError: null, queryClient: supabase };
  }

  const accessToken = await getSupabaseAccessTokenFromRequest(request);
  if (!accessToken) {
    return { user: null, authError, queryClient: supabase };
  }

  const bearerClient = createBearerClient(accessToken);
  const {
    data: { user: tokenUser },
    error: tokenAuthError,
  } = await bearerClient.auth.getUser(accessToken);

  return {
    user: tokenUser,
    authError: tokenAuthError,
    queryClient: tokenUser && !tokenAuthError ? bearerClient : supabase,
  };
}

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
    // ── Development mock bypass ──────────────────────────────────────────────
    // proxy.ts injects x-mock-user-email when mock_user_email cookie is set.
    // API Route Handlers don't receive the cookie-based session in this case,
    // so we use the admin client to look up the user by email.
    if (process.env.NODE_ENV === 'development') {
      const reqHeaders = await headers();
      const mockEmail = reqHeaders.get('x-mock-user-email');
      const adminUrl = getSupabaseAdminUrl();
      const adminKey = getSupabaseAdminKey();

      if (mockEmail === 'admin@medical.vn' || mockEmail === 'admin@healthcare.vn') {
        return NextResponse.json(
          {
            tenantId: '77777777-7777-7777-7777-777777777777',
            tenantName: 'Bella Medical Clinic',
            enabledModules: ['bella_healthcare'],
            subscriptionPlan: 'enterprise',
            featureFlags: {},
            settings: {},
          },
          {
            status: 200,
            headers: {
              'Cache-Control': 'no-store, no-cache, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0',
            },
          }
        );
      }

      if (mockEmail && adminUrl && adminKey) {
        const admin = createSupabaseJsClient<Database>(adminUrl, adminKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data: mockUserProfile } = await admin
          .from('users')
          .select('id, tenant_id')
          .eq('email', mockEmail)
          .single();

        if (mockUserProfile?.tenant_id) {
          const { data: mockTenant } = await admin
            .from('tenants')
            .select('*')
            .eq('id', mockUserProfile.tenant_id)
            .single();

          if (mockTenant) {
            return NextResponse.json(transformTenantRowToContext(mockTenant), {
              status: 200,
              headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
              },
            });
          }
        }
      }
    }
    // ── End dev bypass ───────────────────────────────────────────────────────

    const supabase = await createRouteHandlerClient();

    // Get authenticated user from session
    const { user, authError, queryClient } = await resolveAuthenticatedUser(request, supabase);

    if (authError || !user) {
      if (process.env.NODE_ENV === 'development') {
        return NextResponse.json(
          {
            tenantId: 'dev-tenant',
            tenantName: 'Bella Land (Dev)',
            enabledModules: ['real_estate', 'beauty_spa', 'cleaning', 'bella_healthcare'],
            subscriptionPlan: 'enterprise',
            featureFlags: {},
            settings: {},
          },
          {
            status: 200,
            headers: {
              'Cache-Control': 'no-store, no-cache, must-revalidate',
            },
          }
        );
      }

      console.error('[GET /api/tenant/context] Authentication failed:', authError);
      return NextResponse.json(
        { error: 'Unauthorized: Please log in to access tenant configuration' },
        { status: 401 }
      );
    }

    // Fetch user profile to get tenant_id
    const { data: userProfile, error: userError } = await queryClient
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (userError) {
      console.error('[GET /api/tenant/context] Failed to fetch user profile:', userError);
      console.error('[GET /api/tenant/context] User ID:', user.id);
      console.error('[GET /api/tenant/context] Error details:', JSON.stringify(userError));
      
      // If user record not found (PGRST116), provide more helpful error
      if (userError.code === 'PGRST116') {
        return NextResponse.json(
          { 
            error: 'User profile not found. Please contact administrator to set up your account.',
            details: 'Your account exists in auth system but not linked to a tenant yet.'
          },
          { status: 403 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to fetch user profile', details: userError.message },
        { status: 500 }
      );
    }

    if (!userProfile?.tenant_id) {
      console.error('[GET /api/tenant/context] User has no tenant assigned:', user.id);
      return NextResponse.json(
        { error: 'Forbidden: User has no tenant assigned. Please contact administrator.' },
        { status: 403 }
      );
    }

    const tenantId = userProfile.tenant_id;

    // Fetch tenant configuration from database
    const { data: tenant, error: tenantError } = await queryClient
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
        // Prevent browser caching to ensure fresh tenant state when switching users or logging in
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
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
  // Extract enabled modules from database (stored as JSONB object like {beauty_spa: true, babycare: false})
  let enabledModules: string[] = ['spa']; // Default fallback
  
  if (tenant.enabled_modules) {
    if (Array.isArray(tenant.enabled_modules)) {
      // Already an array of strings - need to filter out non-strings
      enabledModules = tenant.enabled_modules.filter((item): item is string => typeof item === 'string');
    } else if (typeof tenant.enabled_modules === 'object' && tenant.enabled_modules !== null) {
      // JSONB object format: {beauty_spa: true, babycare: false}
      // Filter to get only enabled modules
      enabledModules = Object.entries(tenant.enabled_modules)
        .filter(([_key, value]) => value === true)
        .map(([key, _value]) => key);
      
      // If no modules enabled, fallback to spa
      if (enabledModules.length === 0) {
        enabledModules = ['spa'];
      }
    } else if (typeof tenant.enabled_modules === 'string') {
      // Single module as string
      enabledModules = [tenant.enabled_modules];
    }
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
    const theme = tenant.brand_theme as Record<string, unknown>;
    Object.assign(settings, {
      logoUrl: theme.logoUrl || tenant.logo_url,
      primaryColor: theme.primaryColor,
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
    enabledModules: enabledModules as TenantContext['enabledModules'],
    subscriptionPlan,
    featureFlags,
    settings,
  };

  return context;
}
