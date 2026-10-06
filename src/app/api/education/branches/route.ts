import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase-server';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { PreschoolChainService } from '@/products/bella-education/services/preschool-chain.service';
import type { Database } from '@/types/database.types';

type EducationBranchClient = SupabaseClient<Database>;

function createAdminOperationClient(): EducationBranchClient | null {
  const adminUrl = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();
  if (!adminUrl || !adminKey) return null;

  return createSupabaseClient<Database>(adminUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function resolveProfileUser(
  supabase: EducationBranchClient,
  user: User,
): Promise<{ id: string; tenantId: string | null } | null> {
  const metadataTenantId = typeof user.user_metadata?.tenant_id === 'string'
    ? user.user_metadata.tenant_id.trim()
    : '';
  if (metadataTenantId) return { id: user.id, tenantId: metadataTenantId };

  const { data } = await supabase
    .from('users')
    .select('id, tenant_id')
    .eq('id', user.id)
    .maybeSingle();

  return data ? { id: data.id, tenantId: data.tenant_id } : null;
}

async function resolveDevelopmentMockUser(): Promise<{
  readonly supabase: EducationBranchClient;
  readonly userId: string;
  readonly tenantId: string;
} | null> {
  if (process.env.NODE_ENV !== 'development') return null;

  const mockEmail = (await headers()).get('x-mock-user-email')?.trim();
  const adminClient = createAdminOperationClient();
  if (!mockEmail || !adminClient) return null;

  const { data } = await adminClient
    .from('users')
    .select('id, tenant_id')
    .eq('email', mockEmail)
    .maybeSingle();

  return data?.id && data.tenant_id
    ? { supabase: adminClient, userId: data.id, tenantId: data.tenant_id }
    : null;
}

async function resolveEducationBranchContext(): Promise<
  | { readonly supabase: EducationBranchClient; readonly tenantId: string; readonly userId: string; readonly response?: never }
  | { readonly response: NextResponse; readonly supabase?: never; readonly tenantId?: never; readonly userId?: never }
> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    const mock = await resolveDevelopmentMockUser();
    if (mock) return mock;
    return { response: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) };
  }

  const profileUser = await resolveProfileUser(supabase, user);
  if (!profileUser?.tenantId) {
    return { response: NextResponse.json({ success: false, error: 'Tenant not found for current user' }, { status: 403 }) };
  }

  return {
    supabase,
    tenantId: profileUser.tenantId,
    userId: profileUser.id,
  };
}

export async function GET() {
  try {
    const context = await resolveEducationBranchContext();
    if (context.response) return context.response;

    const branches = await new PreschoolChainService(context.supabase)
      .listAccessibleBranches(context.tenantId, context.userId);

    return NextResponse.json({
      success: true,
      branches,
      count: branches.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load Preschool branches';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
