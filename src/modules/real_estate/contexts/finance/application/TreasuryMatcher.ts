import { BillingInvoice } from '../domain/BillingInvoice';

export interface BankTransaction {
  readonly id: string;
  readonly amount: number;
  readonly description: string;
  readonly transactionDate: Date;
}

export interface MatchResult {
  readonly matched: boolean;
  readonly invoiceId?: string;
  readonly contractId?: string;
  readonly error?: string;
}

export class TreasuryMatcher {
  /**
   * Parse transfer description and match against open invoices
   */
  public matchTransaction(
    transaction: BankTransaction,
    openInvoices: BillingInvoice[]
  ): MatchResult {
    const desc = transaction.description.toUpperCase();

    // 1. Regular expression checks for contract ID (e.g. CON-123) and installment/dot number (e.g. DOT 2 or D2)
    const contractMatch = desc.match(/CON-[A-Z0-9_-]+/);
    const installmentMatch = desc.match(/DOT\s*(\d+)|D\s*(\d+)/);

    if (!contractMatch) {
      return { matched: false, error: 'No contract code found in description' };
    }

    const matchedContractId = contractMatch[0].toLowerCase();
    const matchedInstallmentNum = installmentMatch
      ? parseInt(installmentMatch[1] || installmentMatch[2], 10)
      : null;

    // 2. Search for matching open invoice
    const matchedInvoice = openInvoices.find((inv) => {
      const matchContract = inv.contractId.toLowerCase() === matchedContractId;
      const matchAmount = inv.amount === transaction.amount;
      const matchInstallment = matchedInstallmentNum
        ? inv.installmentNumber === matchedInstallmentNum
        : true;

      return matchContract && matchAmount && matchInstallment && inv.status !== 'PAID';
    });

    if (!matchedInvoice) {
      return {
        matched: false,
        error: `No unpaid invoice found matching contract "${matchedContractId}" for amount ${transaction.amount}`,
      };
    }

    // 3. Complete matching
    matchedInvoice.markPaid(transaction.id, transaction.transactionDate);

    return {
      matched: true,
      invoiceId: matchedInvoice.id,
      contractId: matchedInvoice.contractId,
    };
  }
}
