import { createAdminClient } from '@/lib/supabase-admin';
import { AccountingEngineService, type JournalEntryInput } from './accounting-engine';

export class RevenueRecognitionService {
  /**
   * Resolve an account ID by its code (e.g., '111', '3387') for a specific tenant.
   * If not found, it throws an error (COA must be set up properly).
   */
  private static async getAccountByCode(tenantId: string, accountCode: string): Promise<string> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('accounting_accounts')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('account_code', accountCode)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      throw new Error(`Account code ${accountCode} not found for tenant ${tenantId}`);
    }
    return data.id;
  }

  /**
   * Handle the sale of a package.
   * Records Cash received vs Unearned Revenue & Tax.
   */
  static async handlePackageSale(params: {
    tenantId: string;
    packageSaleId: string; // The ID from revenue/packages table
    totalAmount: number;
    vatRate?: number; // e.g. 0.08 for 8%
    description: string;
    branchId?: string;
  }) {
    const { tenantId, packageSaleId, totalAmount, vatRate = 0, description, branchId } = params;

    // Accounts needed: 111 (Cash), 3387 (Unearned Revenue), 3331 (VAT Payable)
    const [cashAccountId, unearnedRevAccountId, vatAccountId] = await Promise.all([
      this.getAccountByCode(tenantId, '111'),
      this.getAccountByCode(tenantId, '3387'),
      vatRate > 0 ? this.getAccountByCode(tenantId, '3331') : Promise.resolve(null),
    ]);

    const vatAmount = vatRate > 0 ? totalAmount * (vatRate / (1 + vatRate)) : 0;
    const revenueAmount = totalAmount - vatAmount;

    const lines = [
      // Debit Cash
      {
        account_id: cashAccountId,
        debit_amount: totalAmount,
        credit_amount: 0,
        branch_id: branchId,
      },
      // Credit Unearned Revenue
      {
        account_id: unearnedRevAccountId,
        debit_amount: 0,
        credit_amount: revenueAmount,
        branch_id: branchId,
      },
    ];

    if (vatAmount > 0 && vatAccountId) {
      // Credit VAT
      lines.push({
        account_id: vatAccountId,
        debit_amount: 0,
        credit_amount: vatAmount,
        branch_id: branchId,
      });
    }

    return await AccountingEngineService.postJournalEntry({
      tenant_id: tenantId,
      description: `Bán gói: ${description}`,
      reference_type: 'PACKAGE_SALE',
      reference_id: packageSaleId,
      lines,
    });
  }

  /**
   * Handle the completion of a session.
   * Recognizes earned revenue (3387 -> 511) and calculates KTV commission (642 -> 334).
   */
  static async handleSessionDone(params: {
    tenantId: string;
    sessionLogId: string;
    packageId?: string; // If this session belongs to a package
    earnedRevenueAmount: number; // Value of this single session
    commissionAmount: number; // Amount to pay the KTV
    ktvId: string;
    branchId?: string;
    description: string;
  }) {
    const { tenantId, sessionLogId, earnedRevenueAmount, commissionAmount, ktvId, branchId, description } = params;

    // Resolve accounts: 3387 (Unearned Rev), 511 (Revenue), 642 (Expense), 334 (Payable to employee)
    const [unearnedRevAccountId, revAccountId, expenseAccountId, payableAccountId] = await Promise.all([
      this.getAccountByCode(tenantId, '3387'),
      this.getAccountByCode(tenantId, '511'),
      this.getAccountByCode(tenantId, '642'),
      this.getAccountByCode(tenantId, '334'),
    ]);

    const lines: JournalEntryInput['lines'] = [];

    // Entry 1: Revenue Recognition (If it's from a pre-paid package)
    if (earnedRevenueAmount > 0) {
      lines.push(
        {
          account_id: unearnedRevAccountId,
          debit_amount: earnedRevenueAmount,
          credit_amount: 0,
          branch_id: branchId,
        },
        {
          account_id: revAccountId,
          debit_amount: 0,
          credit_amount: earnedRevenueAmount,
          branch_id: branchId,
        }
      );
    }

    // Entry 2: KTV Commission
    if (commissionAmount > 0) {
      lines.push(
        {
          account_id: expenseAccountId,
          debit_amount: commissionAmount,
          credit_amount: 0,
          ktv_id: ktvId,
          branch_id: branchId,
        },
        {
          account_id: payableAccountId,
          debit_amount: 0,
          credit_amount: commissionAmount,
          ktv_id: ktvId,
          branch_id: branchId,
        }
      );
    }

    if (lines.length > 0) {
      return await AccountingEngineService.postJournalEntry({
        tenant_id: tenantId,
        description: `Kết chuyển dịch vụ hoàn thành: ${description}`,
        reference_type: 'SESSION_DONE',
        reference_id: sessionLogId,
        lines,
      });
    }

    return null;
  }
}
