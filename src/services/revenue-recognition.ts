import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { AccountingEngineService, type JournalEntryInput } from './accounting-engine';

type AdminClient = SupabaseClient<Database>;

function getAdminClient(): AdminClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export class RevenueRecognitionService {
  private static async getAccountByCode(tenantId: string, accountCode: string): Promise<string> {
    const supabase = getAdminClient();
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
   * Bán gói: Nợ 111 (Cash) / Có 3387 (Unearned Revenue) + Có 3331 (VAT nếu có)
   */
  static async handlePackageSale(params: {
    tenantId: string;
    packageSaleId: string;
    totalAmount: number;
    vatRate?: number;
    description: string;
    branchId?: string;
  }) {
    const { tenantId, packageSaleId, totalAmount, vatRate = 0, description, branchId } = params;

    const [cashAccountId, unearnedRevAccountId, vatAccountId] = await Promise.all([
      this.getAccountByCode(tenantId, '111'),
      this.getAccountByCode(tenantId, '3387'),
      vatRate > 0 ? this.getAccountByCode(tenantId, '3331') : Promise.resolve(null),
    ]);

    const vatAmount = vatRate > 0 ? totalAmount * (vatRate / (1 + vatRate)) : 0;
    const revenueAmount = totalAmount - vatAmount;

    const lines: JournalEntryInput['lines'] = [
      { account_id: cashAccountId, debit_amount: totalAmount, credit_amount: 0, branch_id: branchId },
      { account_id: unearnedRevAccountId, debit_amount: 0, credit_amount: revenueAmount, branch_id: branchId },
    ];

    if (vatAmount > 0 && vatAccountId) {
      lines.push({ account_id: vatAccountId, debit_amount: 0, credit_amount: vatAmount, branch_id: branchId });
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
   * Hoàn thành buổi: Nợ 3387 / Có 5111 (ghi nhận doanh thu) + Nợ 6421 / Có 334 (hoa hồng KTV)
   */
  static async handleSessionDone(params: {
    tenantId: string;
    sessionLogId: string;
    packageId?: string;
    earnedRevenueAmount: number;
    commissionAmount: number;
    ktvId: string;
    branchId?: string;
    description: string;
  }) {
    const { tenantId, sessionLogId, earnedRevenueAmount, commissionAmount, ktvId, branchId, description } = params;

    // 5111 = Doanh thu gói dịch vụ; 6421 = Hoa hồng KTV
    const [unearnedRevAccountId, revAccountId, expenseAccountId, payableAccountId] = await Promise.all([
      this.getAccountByCode(tenantId, '3387'),
      this.getAccountByCode(tenantId, '5111'),
      this.getAccountByCode(tenantId, '6421'),
      this.getAccountByCode(tenantId, '334'),
    ]);

    const lines: JournalEntryInput['lines'] = [];

    if (earnedRevenueAmount > 0) {
      lines.push(
        { account_id: unearnedRevAccountId, debit_amount: earnedRevenueAmount, credit_amount: 0, branch_id: branchId },
        { account_id: revAccountId, debit_amount: 0, credit_amount: earnedRevenueAmount, branch_id: branchId }
      );
    }

    if (commissionAmount > 0) {
      lines.push(
        { account_id: expenseAccountId, debit_amount: commissionAmount, credit_amount: 0, ktv_id: ktvId, branch_id: branchId },
        { account_id: payableAccountId, debit_amount: 0, credit_amount: commissionAmount, ktv_id: ktvId, branch_id: branchId }
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
