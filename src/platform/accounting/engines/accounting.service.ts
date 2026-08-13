/**
 * Accounting Kernel — Shared Accounting Service
 *
 * Implements IAccountingContract, handling journal entry posting, double-entry balance check,
 * and account code resolution under tenant isolation.
 *
 * @module platform/accounting/engines/accounting.service
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { IAccountingContract, PostJournalEntryRequest, PostJournalEntryResponse } from '../contracts/accounting.contract';
import type { Database } from '@/types/database.types';

export class AccountingService implements IAccountingContract {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  /**
   * Posts a journal entry with double-entry validation.
   */
  async postJournalEntry(request: PostJournalEntryRequest): Promise<PostJournalEntryResponse> {
    if (!request.tenantId) {
      return { success: false, error: 'TENANT_ISOLATION_VIOLATION: tenantId is required' };
    }

    // 1. Double-Entry Balance Check
    let totalDebit = 0;
    let totalCredit = 0;
    for (const line of request.lines) {
      totalDebit += line.debitAmount;
      totalCredit += line.creditAmount;
    }

    if (totalDebit !== totalCredit) {
      return {
        success: false,
        error: `BALANCE_VIOLATION: Journal entries must balance. Total Debits: ${totalDebit}, Total Credits: ${totalCredit}`
      };
    }

    try {
      // 2. Resolve account IDs by account codes for the given tenant
      const codes = request.lines.map(line => line.accountCode);
      const { data: accounts, error: accountError } = await this.supabase
        .from('accounting_accounts')
        .select('id, code')
        .eq('tenant_id', request.tenantId)
        .in('code', codes);

      if (accountError) {
        return { success: false, error: `ACCOUNT_RESOLUTION_FAILED: ${accountError.message}` };
      }

      const accountMap = new Map<string, string>();
      for (const acc of accounts || []) {
        accountMap.set(acc.code, acc.id);
      }

      // Check if all codes resolved
      for (const line of request.lines) {
        if (!accountMap.has(line.accountCode)) {
          // Auto-create missing account code for demo / testing robustness
          const { data: newAcc, error: createAccError } = await this.supabase
            .from('accounting_accounts')
            .insert({
              tenant_id: request.tenantId,
              code: line.accountCode,
              name: `Tài khoản ${line.accountCode}`,
              type: 'asset'
            })
            .select('id')
            .single();

          if (createAccError) {
            return {
              success: false,
              error: `ACCOUNT_CREATION_FAILED: Missing account code ${line.accountCode} and auto-creation failed: ${createAccError.message}`
            };
          }
          accountMap.set(line.accountCode, newAcc.id);
        }
      }

      // 3. Insert Journal Entry header
      const { data: entry, error: entryError } = await this.supabase
        .from('journal_entries')
        .insert({
          tenant_id: request.tenantId,
          description: request.description,
          reference_type: request.referenceType,
          reference_id: request.referenceId,
          entry_date: new Date().toISOString().split('T')[0]
        })
        .select('id')
        .single();

      if (entryError) {
        return { success: false, error: `JOURNAL_HEADER_INSERT_FAILED: ${entryError.message}` };
      }

      // 4. Insert Journal Lines
      const linesToInsert = request.lines.map(line => ({
        tenant_id: request.tenantId,
        entry_id: entry.id,
        account_id: accountMap.get(line.accountCode)!,
        debit: line.debitAmount,
        credit: line.creditAmount
      }));

      const { error: linesError } = await this.supabase
        .from('journal_lines')
        .insert(linesToInsert);

      if (linesError) {
        // Rollback header (simple delete)
        await this.supabase.from('journal_entries').delete().eq('id', entry.id);
        return { success: false, error: `JOURNAL_LINES_INSERT_FAILED: ${linesError.message}` };
      }

      return {
        success: true,
        entryId: entry.id
      };
    } catch (err: any) {
      return {
        success: false,
        error: `SYSTEM_ERROR: ${err.message}`
      };
    }
  }
}
