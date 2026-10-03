import { cookies } from 'next/headers';
import { createServerClient as createSupabaseServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import { productRegistry } from '@/platform/registry/product-registry';
import {
  resolvePlatformPwaIdentity,
  toPlatformWebAppManifest,
  type PlatformPwaBrandOverlay,
} from '@/platform/pwa/platform-pwa-contract';
import type { Database, Json } from '@/types/database.types';

export const dynamic = 'force-dynamic';

type TenantPwaRow = Pick<
  Database['public']['Tables']['tenants']['Row'],
  'id' | 'product_key' | 'brand_theme' | 'logo_url'
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readBrandOverlay(brandTheme: Json, logoUrl: string | null): PlatformPwaBrandOverlay {
  const theme = isRecord(brandTheme) ? brandTheme : {};
  return {
    brandName: readString(theme.brandName),
    logoUrl: readString(theme.logoUrl) ?? logoUrl,
    primaryColor: readString(theme.primaryColor),
  };
}

async function createRouteHandlerClient() {
  const cookieStore = await cookies();
  return createSupabaseServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Route handlers cannot always set cookies.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // Route handlers cannot always remove cookies.
          }
        },
      },
    },
  );
}

async function resolveTenantForCurrentUser(): Promise<TenantPwaRow | null> {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const { data: userProfile, error: userError } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single();

  if (userError || !userProfile?.tenant_id) {
    return null;
  }

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id, product_key, brand_theme, logo_url')
    .eq('id', userProfile.tenant_id)
    .single();

  if (tenantError || !tenant) {
    return null;
  }

  return tenant;
}

export async function GET() {
  const tenant = await resolveTenantForCurrentUser();
  const product = tenant?.product_key ? productRegistry.get(tenant.product_key) : null;
  const brand = tenant ? readBrandOverlay(tenant.brand_theme, tenant.logo_url) : null;
  const identity = resolvePlatformPwaIdentity({ product, brand });
  const manifest = toPlatformWebAppManifest(identity);

  return new Response(JSON.stringify(manifest), {
    status: 200,
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'private, no-store, max-age=0',
    },
  });
}

