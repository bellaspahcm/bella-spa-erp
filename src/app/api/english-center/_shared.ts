import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { headers } from 'next/headers';
import { createClient as createSupabaseClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

export interface EnglishCenterApiContext {
  readonly supabase: SupabaseClient<Database>;
  readonly tenantId: string;
  readonly userId: string;
}

type EnglishCenterResolvedUser = {
  readonly id: string;
  readonly tenantId: string | null;
};

type EnglishCenterDevelopmentMockContext = {
  readonly user: EnglishCenterResolvedUser;
  readonly supabase: SupabaseClient<Database>;
};

type EnglishCenterProfile = Pick<Database['public']['Tables']['users']['Row'], 'id' | 'tenant_id'>;

function getSupabaseAdminUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
}

function getSupabaseAdminKey(): string {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}

function createEnglishCenterAdminClient(): SupabaseClient<Database> | null {
  const adminUrl = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();

  if (!adminUrl || !adminKey) return null;

  return createSupabaseClient<Database>(adminUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function resolveProfileUser(
  supabase: SupabaseClient<Database>,
  user: User,
): Promise<EnglishCenterResolvedUser | null> {
  const { data } = await supabase
    .from('users')
    .select('id, tenant_id')
    .eq('id', user.id)
    .maybeSingle<EnglishCenterProfile>();

  if (data?.tenant_id) {
    return { id: data.id, tenantId: data.tenant_id };
  }

  if (!user.email) return data ? { id: data.id, tenantId: data.tenant_id } : null;

  const { data: emailProfile } = await supabase
    .from('users')
    .select('id, tenant_id')
    .eq('email', user.email)
    .maybeSingle<EnglishCenterProfile>();

  return emailProfile ? { id: emailProfile.id, tenantId: emailProfile.tenant_id } : null;
}

async function resolveDevelopmentMockUser(): Promise<EnglishCenterDevelopmentMockContext | null> {
  if (process.env.NODE_ENV !== 'development') return null;

  const mockEmail = (await headers()).get('x-mock-user-email');
  const adminClient = createEnglishCenterAdminClient();

  if (!mockEmail || !adminClient) return null;

  const { data } = await adminClient
    .from('users')
    .select('id, tenant_id')
    .eq('email', mockEmail)
    .maybeSingle<EnglishCenterProfile>();

  return data
    ? {
      user: { id: data.id, tenantId: data.tenant_id },
      supabase: adminClient,
    }
    : null;
}

export async function getEnglishCenterApiContext(): Promise<
  | { readonly context: EnglishCenterApiContext; readonly response?: never }
  | { readonly context?: never; readonly response: NextResponse }
> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  const developmentMock = user ? null : await resolveDevelopmentMockUser();
  const resolvedUser = user
    ? {
      id: user.id,
      tenantId: user.user_metadata?.tenant_id ?? null,
    }
    : developmentMock?.user;
  const fallbackUser = user && resolvedUser && !resolvedUser.tenantId
    ? await resolveProfileUser(supabase, user)
    : null;
  const tenantId = resolvedUser?.tenantId || fallbackUser?.tenantId;
  const userId = resolvedUser?.id || fallbackUser?.id;

  if ((authError || !user) && !resolvedUser) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (!tenantId) {
    return { response: NextResponse.json({ error: 'Tenant not found' }, { status: 400 }) };
  }
  if (!userId) {
    return { response: NextResponse.json({ error: 'User not found' }, { status: 400 }) };
  }

  return {
    context: {
      supabase: developmentMock?.supabase ?? supabase,
      tenantId,
      userId,
    },
  };
}

export function apiError(error: unknown, label: string): NextResponse {
  console.error(label, error);
  const message = error instanceof Error ? error.message : 'Internal server error';
  return NextResponse.json({ error: message }, { status: 500 });
}

export function parseRequiredSearchParam(
  searchParams: URLSearchParams,
  name: string
): string | NextResponse {
  const value = searchParams.get(name);
  if (!value) {
    return NextResponse.json({ error: `Missing required query parameter: ${name}` }, { status: 400 });
  }
  return value;
}
