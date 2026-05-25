import { createAdminClient } from '@/lib/supabase-admin';

export type JournalEntryInput = {
  tenant_id: string;
  description: string;
  reference_type?: string;
  reference_id?: string;
  entry_date?: string;
  lines: {
    account_id: string;
    debit_amount: number;
    credit_amount: number;
    branch_id?: string;
    ktv_id?: string;
    cost_center_id?: string;
  }[];
};

type JournalHeader = { id: string };

export class AccountingEngineService {
  static async postJournalEntry(entry: JournalEntryInput): Promise<string> {
    const supabase = createAdminClient();

    const totalDebit = entry.lines.reduce((sum, l) => sum + l.debit_amount, 0);
    const totalCredit = entry.lines.reduce((sum, l) => sum + l.credit_amount, 0);

    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      throw new Error(`Unbalanced journal entry. Debit: ${totalDebit}, Credit: ${totalCredit}`);
    }
    if (totalDebit === 0) {
      throw new Error('Journal entry must have non-zero lines.');
    }

    const { data: header, error: headerError } = await supabase
      .from('journal_entries')
      .insert({
        tenant_id: entry.tenant_id,
        description: entry.description,
        reference_type: entry.reference_type ?? null,
        reference_id: entry.reference_id ?? null,
        entry_date: entry.entry_date ?? new Date().toISOString().slice(0, 10),
        status: 'DRAFT',
      })
      .select('id')
      .single<JournalHeader>();

    if (headerError || !header) {
      throw new Error(headerError?.message ?? 'Failed to create journal entry header');
    }

    const linesToInsert = entry.lines.map((line) => ({
      entry_id: header.id,
      account_id: line.account_id,
      debit_amount: line.debit_amount,
      credit_amount: line.credit_amount,
      branch_id: line.branch_id ?? null,
      ktv_id: line.ktv_id ?? null,
      cost_center_id: line.cost_center_id ?? null,
    }));

    const { error: linesError } = await supabase.from('journal_lines').insert(linesToInsert);

    if (linesError) {
      await supabase.from('journal_entries').delete().eq('id', header.id);
      throw new Error(linesError.message);
    }

    const { error: postError } = await supabase
      .from('journal_entries')
      .update({ status: 'POSTED' })
      .eq('id', header.id);

    if (postError) {
      throw new Error(`Failed to post journal entry: ${postError.message}`);
    }

    return header.id;
  }

  static async closePeriod(tenantId: string, periodId: string): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('accounting_periods')
      .update({ status: 'CLOSED' })
      .eq('id', periodId)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(`Failed to close period: ${error.message}`);
    }
  }
}
