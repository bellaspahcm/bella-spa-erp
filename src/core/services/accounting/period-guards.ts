import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

export async function assertOpenAccountingPeriod(
  supabase: SupabaseClient<Database>,
  input: {
    tenantId: string | null | undefined;
    date: string;
    context: string;
  }
) {
  if (!input.tenantId) {
    throw new Error(`${input.context}: missing tenant for accounting period guard.`);
  }

  const periodDate = input.date.slice(0, 10);
  const { error } = await supabase.rpc('ensure_open_period', {
    p_tenant_id: input.tenantId,
    p_date: periodDate,
  });

  if (error) {
    throw new Error(`${input.context}: accounting period is closed or unavailable: ${error.message}`);
  }
}
