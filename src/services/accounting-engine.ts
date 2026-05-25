import { createClient } from '@/utils/supabase/server';
import { Database } from '@/types/database.types';

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

export class AccountingEngineService {
  /**
   * Post a double-entry journal to the ledger.
   * Throws an error if debit != credit.
   */
  static async postJournalEntry(entry: JournalEntryInput) {
    const supabase = await createClient();

    // 1. Validate Balance
    const totalDebit = entry.lines.reduce((sum, line) => sum + line.debit_amount, 0);
    const totalCredit = entry.lines.reduce((sum, line) => sum + line.credit_amount, 0);

    // Using a small epsilon to handle potential floating point issues if somehow passed, though DB strictly uses decimal
    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      throw new Error(`Unbalanced journal entry. Debit: ${totalDebit}, Credit: ${totalCredit}`);
    }

    if (totalDebit === 0) {
      throw new Error('Journal entry must have non-zero lines.');
    }

    // 2. Insert Entry & Lines in a transaction (Supabase RPC or via standard insert since constraints handle integrity)
    // Create Header (DRAFT first)
    const { data: header, error: headerError } = await supabase
      .from('journal_entries')
      .insert({
        tenant_id: entry.tenant_id,
        description: entry.description,
        reference_type: entry.reference_type,
        reference_id: entry.reference_id,
        entry_date: entry.entry_date || new Date().toISOString(),
        status: 'DRAFT',
      })
      .select('id')
      .single();

    if (headerError || !header) {
      console.error('Error creating journal entry header:', headerError);
      throw new Error(headerError?.message || 'Failed to create journal entry');
    }

    // Insert Lines
    const linesToInsert = entry.lines.map((line) => ({
      entry_id: header.id,
      account_id: line.account_id,
      debit_amount: line.debit_amount,
      credit_amount: line.credit_amount,
      branch_id: line.branch_id,
      ktv_id: line.ktv_id,
      cost_center_id: line.cost_center_id,
    }));

    const { error: linesError } = await supabase.from('journal_lines').insert(linesToInsert);

    if (linesError) {
      // Rollback header if lines fail (not strictly necessary if we rely on DRAFT status to clean up later, but good practice)
      await supabase.from('journal_entries').delete().eq('id', header.id);
      console.error('Error creating journal lines:', linesError);
      throw new Error(linesError.message);
    }

    // 3. POST the entry (triggers DB balance validation)
    const { error: postError } = await supabase
      .from('journal_entries')
      .update({ status: 'POSTED' })
      .eq('id', header.id);

    if (postError) {
      console.error('Error posting journal entry:', postError);
      throw new Error(postError.message);
    }

    return header.id;
  }

  /**
   * Closes an accounting period
   */
  static async closePeriod(tenantId: string, periodId: string) {
    const supabase = await createClient();
    const { error } = await supabase
      .from('accounting_periods')
      .update({ status: 'CLOSED' })
      .eq('id', periodId)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(`Failed to close period: ${error.message}`);
    }
    return true;
  }
}
