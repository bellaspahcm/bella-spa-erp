import { supabase as typedSupabase } from '@/lib/supabase';
const supabase = typedSupabase as any;

export interface OutboxClaimedEvent {
  id: string;
  tenant_id: string;
  event_type: string;
  reference_type: string;
  reference_id: string;
  payload: {
    saleType: 'RE_BOOKING_FEE' | 'RE_DEPOSIT_RECEIVED' | 'RE_INSTALLMENT_REVENUE';
    amount: number;
    productId: string;
    customerId: string;
  };
}

export class AccountingOutboxListener {
  private static instance: AccountingOutboxListener;

  private constructor() {}

  public static getInstance(): AccountingOutboxListener {
    if (!AccountingOutboxListener.instance) {
      AccountingOutboxListener.instance = new AccountingOutboxListener();
    }
    return AccountingOutboxListener.instance;
  }

  /**
   * Process a single claimed accounting event and create double-entry journal logs
   */
  public async processEvent(event: OutboxClaimedEvent): Promise<string> {
    const { tenant_id: tenantId, reference_type: refType, reference_id: refId, payload, id: outboxId } = event;
    const { saleType, amount } = payload;

    try {
      // 1. Resolve Account IDs by code (e.g. 112 for Bank, 131 for Customer deposit, 511 for Revenue)
      const debitCode = '112'; // Cash/Bank
      let creditCode = '131'; // Default: customer deposits/liabilities

      if (saleType === 'RE_INSTALLMENT_REVENUE') {
        creditCode = '511'; // Real estate revenue
      } else if (saleType === 'RE_BOOKING_FEE') {
        creditCode = '3387'; // Unearned booking revenue
      }

      const { data: accounts, error: accError } = await supabase
        .from('accounting_accounts')
        .select('id, account_code')
        .eq('tenant_id', tenantId)
        .in('account_code', [debitCode, creditCode]);

      if (accError) throw accError;

      const debitAccount = accounts?.find((a: any) => a.account_code === debitCode);
      const creditAccount = accounts?.find((a: any) => a.account_code === creditCode);

      if (!debitAccount || !creditAccount) {
        throw new Error(`Accounting accounts not configured for codes: ${debitCode}, ${creditCode}`);
      }

      // 2. Insert Header Journal Entry as 'DRAFT'
      const description = `Ghi nhận giao dịch ${saleType} - Tham chiếu ${refType} ID ${refId}`;
      const { data: entry, error: entryError } = await supabase
        .from('journal_entries')
        .insert({
          tenant_id: tenantId,
          description,
          reference_type: refType,
          reference_id: refId,
          status: 'DRAFT',
        })
        .select('id')
        .single();

      if (entryError) throw entryError;
      const entryId = entry.id;

      // 3. Insert Journal Lines (Debit and Credit)
      const { error: lineError } = await supabase
        .from('journal_lines')
        .insert([
          {
            entry_id: entryId,
            account_id: debitAccount.id,
            debit_amount: amount,
            credit_amount: 0,
          },
          {
            entry_id: entryId,
            account_id: creditAccount.id,
            debit_amount: 0,
            credit_amount: amount,
          },
        ]);

      if (lineError) throw lineError;

      // 4. Update status to 'POSTED' to trigger database balanced constraint checks
      const { error: postError } = await supabase
        .from('journal_entries')
        .update({ status: 'POSTED' })
        .eq('id', entryId);

      if (postError) throw postError;

      // 5. Mark outbox entry completed
      const { error: outboxError } = await supabase.rpc('mark_outbox_completed', {
        p_outbox_id: outboxId,
        p_journal_entry_id: entryId,
      });

      if (outboxError) throw outboxError;

      return entryId;
    } catch (err: any) {
      console.error(`[AccountingOutboxListener Error] Processing failed for outbox ${outboxId}:`, err.message);
      // Mark outbox entry failed for retry
      await supabase.rpc('mark_outbox_failed', {
        p_outbox_id: outboxId,
        p_error: err.message,
      });
      throw err; // Propagate error up
    }
  }
}

export const accountingOutboxListener = AccountingOutboxListener.getInstance();
