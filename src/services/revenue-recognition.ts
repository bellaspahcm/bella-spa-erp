import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { AccountingEngineService, type JournalEntryInput } from './accounting-engine';

type AdminClient = SupabaseClient<Database>;

function asFiniteAmount(value: number | undefined, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : fallback;
}

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

  private static async getAccountByCodeFallback(tenantId: string, accountCodes: string[]): Promise<string> {
    let lastError: unknown = null;

    for (const accountCode of accountCodes) {
      try {
        return await this.getAccountByCode(tenantId, accountCode);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(`Account codes ${accountCodes.join(', ')} not found for tenant ${tenantId}`);
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
    deferredRevenueAmount?: number;
    receivableAmount?: number;
    commissionAmount: number;
    ktvId: string;
    branchId?: string;
    description: string;
  }) {
    const {
      tenantId,
      sessionLogId,
      earnedRevenueAmount,
      deferredRevenueAmount,
      receivableAmount,
      commissionAmount,
      ktvId,
      branchId,
      description,
    } = params;

    // 5113 = doanh thu cung cấp dịch vụ; fallback 5111 keeps old tenants safe until migration is applied.
    const [unearnedRevAccountId, receivableAccountId, revAccountId, expenseAccountId, payableAccountId] = await Promise.all([
      this.getAccountByCode(tenantId, '3387'),
      this.getAccountByCode(tenantId, '131'),
      this.getAccountByCodeFallback(tenantId, ['5113', '5111']),
      this.getAccountByCode(tenantId, '6421'),
      this.getAccountByCode(tenantId, '334'),
    ]);

    const lines: JournalEntryInput['lines'] = [];
    const earnedAmount = asFiniteAmount(earnedRevenueAmount);
    const hasExplicitSplit = deferredRevenueAmount !== undefined || receivableAmount !== undefined;
    const rawDeferredAmount = deferredRevenueAmount !== undefined
      ? asFiniteAmount(deferredRevenueAmount)
      : Math.max(0, earnedAmount - asFiniteAmount(receivableAmount));
    const deferredAmount = hasExplicitSplit ? Math.min(rawDeferredAmount, earnedAmount) : earnedAmount;
    const receivableSessionAmount = hasExplicitSplit ? Math.max(0, earnedAmount - deferredAmount) : 0;

    if (earnedAmount > 0) {
      if (deferredAmount > 0) {
        lines.push({ account_id: unearnedRevAccountId, debit_amount: deferredAmount, credit_amount: 0, branch_id: branchId });
      }
      if (receivableSessionAmount > 0) {
        lines.push({ account_id: receivableAccountId, debit_amount: receivableSessionAmount, credit_amount: 0, branch_id: branchId });
      }
      lines.push({ account_id: revAccountId, debit_amount: 0, credit_amount: earnedAmount, branch_id: branchId });
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

  /**
   * Ghi nhận chi phí: Nợ 642 (hoặc tài khoản chi phí con) / Có 111 (Tiền mặt) hoặc 112 (Tiền gửi ngân hàng)
   */
  static async handleExpenseRecorded(params: {
    tenantId: string;
    expenseId: string;
    amount: number;
    category: string;
    paymentMethod: string;
    description: string;
    branchId?: string;
  }) {
    const { tenantId, expenseId, amount, category, paymentMethod, description, branchId } = params;

    if (amount <= 0) return null;

    // Xác định mã tài khoản chi phí theo category nghiệp vụ
    let expenseAccountCode = '6427'; // Chi phí khác bằng tiền (mặc định)
    const normCategory = category?.toLowerCase();
    if (normCategory === 'rent') {
      expenseAccountCode = '6423'; // Chi phí thuê mặt bằng
    } else if (normCategory === 'utilities') {
      expenseAccountCode = '6424'; // Chi phí điện nước, internet
    } else if (normCategory === 'marketing') {
      expenseAccountCode = '6425'; // Chi phí marketing & Zalo OA
    } else if (normCategory === 'materials') {
      expenseAccountCode = '632';  // Giá vốn hàng bán (vật tư tiêu hao)
    } else if (normCategory === 'salary') {
      expenseAccountCode = '642';  // Chi phí nhân viên nói chung
    }

    const payAccountCode = paymentMethod?.toLowerCase() === 'cash' ? '111' : '112';

    const [expenseAccountId, payAccountId] = await Promise.all([
      this.getAccountByCode(tenantId, expenseAccountCode),
      this.getAccountByCode(tenantId, payAccountCode),
    ]);

    const lines: JournalEntryInput['lines'] = [
      { account_id: expenseAccountId, debit_amount: amount, credit_amount: 0, branch_id: branchId },
      { account_id: payAccountId, debit_amount: 0, credit_amount: amount, branch_id: branchId },
    ];

    return await AccountingEngineService.postJournalEntry({
      tenant_id: tenantId,
      description: `Ghi nhận chi phí: ${description}`,
      reference_type: 'EXPENSE',
      reference_id: expenseId,
      lines,
    });
  }

  /**
   * Thanh toán lương: Nợ 334 (Phải trả người lao động) / Có 111 hoặc 112
   */
  static async handleSalaryPaid(params: {
    tenantId: string;
    salaryRecordId: string;
    amount: number;
    paymentMethod?: string;
    description: string;
    ktvId: string;
    branchId?: string;
  }) {
    const { tenantId, salaryRecordId, amount, paymentMethod = 'bank_transfer', description, ktvId, branchId } = params;

    if (amount <= 0) return null;

    const payAccountCode = paymentMethod?.toLowerCase() === 'cash' ? '111' : '112';

    const [payableAccountId, payAccountId] = await Promise.all([
      this.getAccountByCode(tenantId, '334'),
      this.getAccountByCode(tenantId, payAccountCode),
    ]);

    const lines: JournalEntryInput['lines'] = [
      { account_id: payableAccountId, debit_amount: amount, credit_amount: 0, ktv_id: ktvId, branch_id: branchId },
      { account_id: payAccountId, debit_amount: 0, credit_amount: amount, ktv_id: ktvId, branch_id: branchId },
    ];

    return await AccountingEngineService.postJournalEntry({
      tenant_id: tenantId,
      description: `Chi trả lương: ${description}`,
      reference_type: 'SALARY_PAYMENT',
      reference_id: salaryRecordId,
      lines,
    });
  }

  /**
   * Khấu hao tiêu hao vật tư: Nợ 632 (Giá vốn) / Có 152 (Nguyên liệu, vật liệu)
   */
  static async handleInventoryConsumed(params: {
    tenantId: string;
    sessionLogId: string;
    amount: number;
    description: string;
    branchId?: string;
  }) {
    const { tenantId, sessionLogId, amount, description, branchId } = params;

    if (amount <= 0) return null;

    const [cogsAccountId, materialsAccountId] = await Promise.all([
      this.getAccountByCode(tenantId, '632'),
      this.getAccountByCode(tenantId, '152'),
    ]);

    const lines: JournalEntryInput['lines'] = [
      { account_id: cogsAccountId, debit_amount: amount, credit_amount: 0, branch_id: branchId },
      { account_id: materialsAccountId, debit_amount: 0, credit_amount: amount, branch_id: branchId },
    ];

    return await AccountingEngineService.postJournalEntry({
      tenant_id: tenantId,
      description: `Tiêu hao vật tư ca trị liệu: ${description}`,
      reference_type: 'INVENTORY_CONSUMPTION',
      reference_id: sessionLogId,
      lines,
    });
  }

  /**
   * Hoan tien khach hang theo TT133:
   * - Phan dich vu chua thuc hien: No 3387 / Co 111 hoac 112
   * - Phan dich vu da ghi nhan: No 5113 / Co 111 hoac 112
   */
  static async handleRefundIssued(params: {
    tenantId: string;
    refundId: string;
    amount: number;
    deferredRefundAmount?: number;
    revenueReductionAmount?: number;
    paymentMethod?: string;
    description: string;
    branchId?: string;
  }) {
    const {
      tenantId,
      refundId,
      amount,
      deferredRefundAmount,
      revenueReductionAmount,
      paymentMethod = 'bank_transfer',
      description,
      branchId,
    } = params;

    if (amount <= 0) return null;

    const refundAmount = asFiniteAmount(amount);
    const hasDeferredSplit = deferredRefundAmount !== undefined;
    const hasRevenueSplit = revenueReductionAmount !== undefined;
    const explicitDeferredAmount = hasDeferredSplit ? asFiniteAmount(deferredRefundAmount) : undefined;
    const explicitRevenueReductionAmount = hasRevenueSplit ? asFiniteAmount(revenueReductionAmount) : undefined;
    let deferredAmount = 0;
    let recognizedRevenueRefundAmount = refundAmount;

    if (hasDeferredSplit && hasRevenueSplit) {
      const splitTotal = (explicitDeferredAmount ?? 0) + (explicitRevenueReductionAmount ?? 0);
      if (Math.abs(splitTotal - refundAmount) > 0.01) {
        throw new Error(`Refund split total ${splitTotal} does not match refund amount ${refundAmount}.`);
      }
      deferredAmount = explicitDeferredAmount ?? 0;
      recognizedRevenueRefundAmount = explicitRevenueReductionAmount ?? 0;
    } else if (hasDeferredSplit) {
      if ((explicitDeferredAmount ?? 0) > refundAmount) {
        throw new Error(`Deferred refund amount ${explicitDeferredAmount} exceeds refund amount ${refundAmount}.`);
      }
      deferredAmount = explicitDeferredAmount ?? 0;
      recognizedRevenueRefundAmount = refundAmount - deferredAmount;
    } else if (hasRevenueSplit) {
      if ((explicitRevenueReductionAmount ?? 0) > refundAmount) {
        throw new Error(`Revenue reduction amount ${explicitRevenueReductionAmount} exceeds refund amount ${refundAmount}.`);
      }
      recognizedRevenueRefundAmount = explicitRevenueReductionAmount ?? 0;
      deferredAmount = refundAmount - recognizedRevenueRefundAmount;
    }

    const payAccountCode = paymentMethod?.toLowerCase() === 'cash' ? '111' : '112';

    const [deferredAccountId, revenueAccountId, payAccountId] = await Promise.all([
      deferredAmount > 0 ? this.getAccountByCode(tenantId, '3387') : Promise.resolve(null),
      recognizedRevenueRefundAmount > 0 ? this.getAccountByCodeFallback(tenantId, ['5113', '5111']) : Promise.resolve(null),
      this.getAccountByCode(tenantId, payAccountCode),
    ]);

    const lines: JournalEntryInput['lines'] = [];

    if (deferredAmount > 0 && deferredAccountId) {
      lines.push({ account_id: deferredAccountId, debit_amount: deferredAmount, credit_amount: 0, branch_id: branchId });
    }

    if (recognizedRevenueRefundAmount > 0 && revenueAccountId) {
      lines.push({
        account_id: revenueAccountId,
        debit_amount: recognizedRevenueRefundAmount,
        credit_amount: 0,
        branch_id: branchId,
      });
    }

    lines.push({ account_id: payAccountId, debit_amount: 0, credit_amount: refundAmount, branch_id: branchId });

    return await AccountingEngineService.postJournalEntry({
      tenant_id: tenantId,
      description: `Hoàn tiền khách hàng: ${description}`,
      reference_type: 'REFUND',
      reference_id: refundId,
      lines,
    });
  }
}
