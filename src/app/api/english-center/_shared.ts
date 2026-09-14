import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export interface EnglishCenterApiContext {
  readonly supabase: ReturnType<typeof createClient>;
  readonly tenantId: string;
  readonly userId: string;
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

  if (authError || !user) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const tenantId = user.user_metadata?.tenant_id;
  if (!tenantId) {
    return { response: NextResponse.json({ error: 'Tenant not found' }, { status: 400 }) };
  }

  return {
    context: {
      supabase,
      tenantId,
      userId: user.id,
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
