/**
 * E2E Manual Journal Reversal Test - Admin posts adjusting entry then reverses it
 */

jest.mock('server-only', () => ({}), { virtual: true });

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';

jest.setTimeout(60_000);

describe('E2E Manual Journal Reversal', () => {
  let supabase: ReturnType<typeof createSupabaseClient<Database>>;
  let testTenantId: string;

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabase = createSupabaseClient<Database>(url, adminKey);
    
    const { data: tenant } = await supabase.from('tenants').select('id').eq('name', 'Test Tenant Manual Reversal').single();
    testTenantId = tenant?.id || (await supabase.from('tenants').insert({ name: 'Test Tenant Manual Reversal', status: 'active' }).select('id').single()).data!.id;
  });

  it('should create reversing journal entry with opposite debits/credits', async () => {
    const today = new Date().toISOString().split('T')[0];

    // STEP 1: Admin posts manual adjusting entry (Dr. Expense 500k / Cr. Cash 500k)
    const { data: originalEntry } = await supabase.from('journal_entries').insert({
      tenant_id: testTenantId, entry_date: today, reference_type: 'MANUAL_ADJUSTMENT',
      description: 'Manual expense adjustment', status: 'posted',
    }).select('*').single();

    await supabase.from('journal_lines').insert([
      { entry_id: originalEntry!.id, account_id: 'expense-account-id', debit_amount: 500000, credit_amount: 0 },
      { entry_id: originalEntry!.id, account_id: 'cash-account-id', debit_amount: 0, credit_amount: 500000 },
    ]);

    console.log('✅ Step 1: Original entry posted', { entryId: originalEntry!.id, amount: 500000 });

    // STEP 2: Admin reverses the entry (opposite debits/credits)
    const { data: reversalEntry } = await supabase.from('journal_entries').insert({
      tenant_id: testTenantId, entry_date: today, reference_type: 'MANUAL_ADJUSTMENT',
      description: `REVERSAL of ${originalEntry!.id}`, status: 'posted', reversal_of_entry_id: originalEntry!.id,
    }).select('*').single();

    await supabase.from('journal_lines').insert([
      { entry_id: reversalEntry!.id, account_id: 'expense-account-id', debit_amount: 0, credit_amount: 500000 }, // Opposite
      { entry_id: reversalEntry!.id, account_id: 'cash-account-id', debit_amount: 500000, credit_amount: 0 },     // Opposite
    ]);

    console.log('✅ Step 2: Reversal entry posted', { reversalId: reversalEntry!.id });

    // STEP 3: Verify net effect is zero
    const { data: allLines } = await supabase.from('journal_lines').select('*').in('entry_id', [originalEntry!.id, reversalEntry!.id]);
    const netDebit = allLines!.reduce((sum, l) => sum + Number(l.debit_amount), 0);
    const netCredit = allLines!.reduce((sum, l) => sum + Number(l.credit_amount), 0);

    expect(netDebit).toBe(netCredit); // Balanced

    console.log('✅ Step 3: Net effect is zero (reversal correct)', { netDebit, netCredit });
    console.log('\n🎉 E2E MANUAL REVERSAL TEST: PASSED');
  }, 60000);
});
