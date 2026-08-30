'use server';

import { safeRevalidatePath } from '@/lib/revalidate';
import { recordAuditLog } from '@/services/audit-actions';
import { getCurrentUser } from '@/services/user-actions';
import { createAccountingDataClient } from './client';
import {
  ACCOUNTING_SEMANTIC_DEFINITIONS,
  type AccountingSemanticConfigSnapshot,
  type AccountingSemanticKey,
  type SaveAccountingSemanticMappingInput,
  type SaveAccountingSemanticMappingResult,
} from './semantic-config.types';

const SUPPORTED_SEMANTICS = new Set<AccountingSemanticKey>(
  ACCOUNTING_SEMANTIC_DEFINITIONS.map((item) => item.key)
);

function isAccountingSemanticKey(value: string): value is AccountingSemanticKey {
  return SUPPORTED_SEMANTICS.has(value as AccountingSemanticKey);
}

function normalizeDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Ngày hiệu lực không hợp lệ.');
  }
  return value;
}

export async function getAccountingSemanticConfig(): Promise<AccountingSemanticConfigSnapshot> {
  const user = await getCurrentUser();
  if (!user?.tenant_id) throw new Error('Unauthorized or missing tenant session.');

  const supabase = await createAccountingDataClient();

  const [accountsResult, mappingsResult] = await Promise.all([
    supabase
      .from('finance_accounts' as never)
      .select('code, name, type')
      .eq('tenant_id' as never, user.tenant_id)
      .eq('is_active' as never, true)
      .order('code' as never, { ascending: true }),
    supabase
      .from('finance_control_account_mappings')
      .select('id, control_type, account_code, effective_from, effective_to, authority_version')
      .eq('tenant_id', user.tenant_id)
      .in('control_type', ACCOUNTING_SEMANTIC_DEFINITIONS.map((item) => item.key))
      .order('control_type', { ascending: true })
      .order('effective_from', { ascending: false }),
  ]);

  if (accountsResult.error) throw accountsResult.error;
  if (mappingsResult.error) throw mappingsResult.error;

  const accountOptions = ((accountsResult.data ?? []) as unknown as Array<{
    code: string;
    name: string;
    type: string;
  }>).map((account) => ({
    code: account.code,
    name: account.name,
    type: account.type,
  }));

  const mappings = ((mappingsResult.data ?? []) as unknown as Array<{
    id: string;
    control_type: string;
    account_code: string;
    effective_from: string;
    effective_to: string | null;
    authority_version: string | null;
  }>)
    .filter((mapping) => isAccountingSemanticKey(mapping.control_type))
    .map((mapping) => ({
      id: mapping.id,
      semantic_key: mapping.control_type as AccountingSemanticKey,
      account_code: mapping.account_code,
      effective_from: mapping.effective_from,
      effective_to: mapping.effective_to,
      authority_version: mapping.authority_version,
    }));

  return {
    semantics: ACCOUNTING_SEMANTIC_DEFINITIONS,
    accountOptions,
    mappings,
  };
}

export async function saveAccountingSemanticMapping(
  input: SaveAccountingSemanticMappingInput
): Promise<SaveAccountingSemanticMappingResult> {
  const user = await getCurrentUser();
  if (!user?.tenant_id || !['admin', 'super_admin', 'accountant'].includes(user.role || '')) {
    return { success: false, error: 'Bạn không có quyền cấu hình ánh xạ kế toán.' };
  }

  if (!isAccountingSemanticKey(input.semantic_key)) {
    return { success: false, error: 'Nghiệp vụ kế toán chưa được hỗ trợ.' };
  }

  try {
    const effectiveFrom = normalizeDate(input.effective_from);
    const supabase = await createAccountingDataClient();

    const { data, error } = await supabase.rpc(
      'finance_save_accounting_semantic_gl_mapping' as never,
      {
        p_tenant_id: user.tenant_id,
        p_semantic_key: input.semantic_key,
        p_account_code: input.account_code,
        p_effective_from: effectiveFrom,
        p_authority_version: 'TENANT_CONFIG:UI:v1',
      } as never
    );

    if (error) {
      return { success: false, error: error.message };
    }

    const row = ((data as unknown[])?.[0] ?? null) as {
      id: string;
      semantic_key: AccountingSemanticKey;
      account_code: string;
      effective_from: string;
      effective_to: string | null;
      authority_version: string | null;
    } | null;

    if (!row) {
      return { success: false, error: 'Không lưu được cấu hình kế toán.' };
    }

    await recordAuditLog({
      action: 'UPDATE',
      table_name: 'finance_control_account_mappings',
      record_id: row.id,
      new_data: row as never,
    });

    await safeRevalidatePath('/dashboard/settings');
    return { success: true, data: row };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không lưu được cấu hình kế toán.';
    return { success: false, error: message };
  }
}
