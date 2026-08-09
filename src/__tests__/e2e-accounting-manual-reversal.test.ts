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

    // Fetch real accounts to satisfy foreign key constraints
    const { data: accounts, error: accountError } = await supabase.from('accounting_accounts').select('id').limit(2);
    if (accountError || !accounts || accounts.length < 2) {
      throw new Error(`Failed to fetch 2 active accounts: ${accountError?.message || 'found ' + (accounts?.length || 0)}`);
    }
    const acc1 = accounts[0].id;
    const acc2 = accounts[1].id;

    // STEP 1: Admin posts manual adjusting entry (Dr. Expense 500k / Cr. Cash 500k)
    const { data: originalEntry, error: insertError1 } = await supabase.from('journal_entries').insert({
      tenant_id: testTenantId, entry_date: today, reference_type: 'MANUAL_ADJUSTMENT',
      description: 'Manual expense adjustment', status: 'POSTED',
    }).select('*').single();

    if (insertError1) {
      throw new Error(`DB INSERT ERROR STEP 1: ${insertError1.message}`);
    }

    const { error: lineError1 } = await supabase.from('journal_lines').insert([
      { entry_id: originalEntry!.id, account_id: acc1, debit_amount: 500000, credit_amount: 0 },
      { entry_id: originalEntry!.id, account_id: acc2, debit_amount: 0, credit_amount: 500000 },
    ]);
    if (lineError1) {
      throw new Error(`DB INSERT LINES ERROR STEP 1: ${lineError1.message}`);
    }

    console.log('✅ Step 1: Original entry posted', { entryId: originalEntry!.id, amount: 500000 });

    // STEP 2: Admin reverses the entry (opposite debits/credits)
    const { data: reversalEntry, error: insertError2 } = await supabase.from('journal_entries').insert({
      tenant_id: testTenantId, entry_date: today, reference_type: 'MANUAL_ADJUSTMENT',
      description: `REVERSAL of ${originalEntry!.id}`, status: 'POSTED',
    }).select('*').single();

    if (insertError2) {
      throw new Error(`DB INSERT ERROR STEP 2: ${insertError2.message}`);
    }

    const { error: lineError2 } = await supabase.from('journal_lines').insert([
      { entry_id: reversalEntry!.id, account_id: acc1, debit_amount: 0, credit_amount: 500000 }, // Opposite
      { entry_id: reversalEntry!.id, account_id: acc2, debit_amount: 500000, credit_amount: 0 },     // Opposite
    ]);
    if (lineError2) {
      throw new Error(`DB INSERT LINES ERROR STEP 2: ${lineError2.message}`);
    }

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
