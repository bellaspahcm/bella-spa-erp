/**
 * Platform Kernel — Shared Accounting Contract
 *
 * Defines the public contract for double-entry financial bookkeeping (Ledger).
 * Decouples product verticals from direct database writes to accounting tables.
 *
 * @module platform/accounting/contracts/accounting.contract
 */

export interface JournalLineInput {
  accountCode: string;
  debitAmount: number;
  creditAmount: number;
}

export interface PostJournalEntryRequest {
  tenantId: string;
  description: string;
  referenceType: string;
  referenceId: string;
  lines: JournalLineInput[];
}

export interface PostJournalEntryResponse {
  success: boolean;
  entryId?: string;
  error?: string;
}

export interface IAccountingContract {
  /**
   * Resolves accounting accounts by code and posts a balanced journal entry in a transaction.
   */
  postJournalEntry(request: PostJournalEntryRequest): Promise<PostJournalEntryResponse>;
}
