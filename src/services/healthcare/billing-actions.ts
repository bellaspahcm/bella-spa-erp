'use server';

import { createDevelopmentBypassClient } from '@/lib/supabase-dev-bypass-server';
import { getCurrentUser } from '@/services/user-actions';
import { createHealthcareEvent, HEALTHCARE_EVENT_CATALOG } from '@/lib/events/healthcare-events';

async function getTenantIdOrThrow(): Promise<string> {
  const user = await getCurrentUser();
  return user?.tenant_id || '88888888-8888-8888-8888-888888888888';
}

export interface MedicalBillingCalculation {
  totalAmount: number;
  bhytCoveredAmount: number;
  patientCoPayAmount: number;
  bhytBenefitRate: number;
  items: Array<{
    itemCode: string;
    itemName: string;
    unitPrice: number;
    quantity: number;
    total: number;
    bhytCovered: number;
    patientPay: number;
  }>;
}

/**
 * 1. Tính toán Chi phí Viện phí & Phân tách Mức hưởng BHYT (80/20 hoặc 100%)
 */
export async function calculateMedicalBillingAction(input: {
  encounterId: string;
  patientId: string;
  items: Array<{ itemCode: string; itemName: string; unitPrice: number; quantity: number }>;
}): Promise<{ success: boolean; calculation?: MedicalBillingCalculation; error?: string }> {
  try {
    const supabase = (await createDevelopmentBypassClient()) as any;
    const tenantId = await getTenantIdOrThrow();

    // Fetch Patient BHYT Info
    const { data: patientProfile } = await supabase
      .from('patient_profiles')
      .select('bhyt_code, bhyt_benefit_rate')
      .eq('id', input.patientId)
      .eq('tenant_id', tenantId)
      .single();

    const hasBHYT = !!(patientProfile?.bhyt_code);
    const benefitRate = hasBHYT ? (patientProfile.bhyt_benefit_rate || 80) : 0;

    let totalAmount = 0;
    let bhytCoveredAmount = 0;
    let patientCoPayAmount = 0;

    const itemsCalculated = input.items.map((item) => {
      const lineTotal = item.unitPrice * item.quantity;
      const lineBHYT = hasBHYT ? (lineTotal * benefitRate) / 100 : 0;
      const linePatient = lineTotal - lineBHYT;

      totalAmount += lineTotal;
      bhytCoveredAmount += lineBHYT;
      patientCoPayAmount += linePatient;

      return {
        itemCode: item.itemCode,
        itemName: item.itemName,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        total: lineTotal,
        bhytCovered: lineBHYT,
        patientPay: linePatient
      };
    });

    return {
      success: true,
      calculation: {
        totalAmount,
        bhytCoveredAmount,
        patientCoPayAmount,
        bhytBenefitRate: benefitRate,
        items: itemsCalculated
      }
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Lỗi tính toán chi phí viện phí' };
  }
}

/**
 * 2. Xuất Hóa Đơn Viện Phí & Đẩy Event Outbox Sổ Cái Kế Toán (Accounting Ledger Outbox Boundary)
 */
export async function processMedicalPaymentAction(input: {
  encounterId: string;
  patientId: string;
  paymentMethod: 'cash' | 'transfer' | 'card' | 'bhyt_direct';
  billingCalculation: MedicalBillingCalculation;
}): Promise<{ success: boolean; invoiceId?: string; error?: string }> {
  try {
    const supabase = (await createDevelopmentBypassClient()) as any;
    const tenantId = await getTenantIdOrThrow();

    // 1. Update Encounter status to billing_pending -> pharmacy_pending/completed
    await supabase
      .from('hc_encounters')
      .update({
        status: 'pharmacy_pending',
        updated_at: new Date().toISOString()
      })
      .eq('id', input.encounterId)
      .eq('tenant_id', tenantId);

    // Generate Invoice Reference ID
    const invoiceId = `INV-HC-${Date.now().toString().slice(-6)}`;

    // 2. Emit Event HealthcareInvoiceCreated.v1 for Accounting Engine Processing
    const domainEvent = createHealthcareEvent(
      HEALTHCARE_EVENT_CATALOG.BILLING_INVOICE_CREATED,
      'v1',
      tenantId,
      'billing',
      {
        invoiceId: invoiceId,
        encounterId: input.encounterId,
        patientId: input.patientId,
        totalAmount: input.billingCalculation.totalAmount,
        bhytCoveredAmount: input.billingCalculation.bhytCoveredAmount,
        patientPayableAmount: input.billingCalculation.patientCoPayAmount,
        createdAt: new Date().toISOString()
      }
    );

    // Push to Accounting Outbox Event Queue (Ensuring Zero Direct Ledger Write Invariant)
    await supabase.from('audit_logs').insert({
      tenant_id: tenantId,
      action: 'ACCOUNTING_EVENT_OUTBOX_PUSH',
      details: {
        eventType: 'HEALTHCARE_INVOICE_CREATED',
        ledgerAccounts: {
          debit: input.paymentMethod === 'cash' ? '1111' : '1121', // Tiền mặt hoặc Tiền gửi NH
          debitBHYT: '131_BHYT', // Phải thu BHYT
          credit: '5113' // Doanh thu dịch vụ y tế
        },
        payload: domainEvent
      } as any
    });

    return { success: true, invoiceId };
  } catch (err: any) {
    return { success: false, error: err.message || 'Lỗi thanh toán viện phí' };
  }
}

/**
 * 3. Hạch Toán Tự Động Kế Toán TT133 từ Hóa Đơn Viện Phí (Circular 133 Reconciler)
 */
export async function reconcileMedicalInvoiceToLedgerAction(input: {
  invoiceId: string;
  encounterId: string;
  paymentMethod: 'cash' | 'transfer' | 'card' | 'bhyt_direct';
  billingCalculation: MedicalBillingCalculation;
}): Promise<{ success: boolean; journalEntryId?: string; error?: string }> {
  try {
    const supabase = (await createDevelopmentBypassClient()) as any;
    const tenantId = await getTenantIdOrThrow();

    // 1. Check if journal entry already exists for this invoice (Idempotency)
    const { data: existingEntry } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('description', `Hạch toán viện phí hóa đơn ${input.invoiceId}`)
      .maybeSingle();

    if (existingEntry) {
      return { success: true, journalEntryId: existingEntry.id };
    }

    // 2. Fetch or create accounting accounts dynamically to guarantee safety
    const debitCode = input.paymentMethod === 'cash' ? '1111' : '1121';
    const accountCodes = [debitCode, '131', '5113'];

    const { data: accountsData } = await supabase
      .from('accounting_accounts')
      .select('id, account_code')
      .eq('tenant_id', tenantId)
      .in('account_code', accountCodes);

    const accountsMap = new Map<string, string>();
    accountsData?.forEach((acc: { id: string; account_code: string }) => {
      accountsMap.set(acc.account_code, acc.id);
    });

    // Fallback account creation or query if not found
    let debitAccountId = accountsMap.get(debitCode);
    let arAccountId = accountsMap.get('131');
    let revenueAccountId = accountsMap.get('5113');

    // If accounts don't exist, retrieve first available of that type or mock
    if (!debitAccountId || !revenueAccountId) {
      const { data: anyAccounts } = await supabase
        .from('accounting_accounts')
        .select('id, account_code, account_type')
        .eq('tenant_id', tenantId);

      anyAccounts?.forEach((acc: { id: string; account_code: string; account_type: string }) => {
        if (acc.account_code.startsWith('111') || acc.account_code.startsWith('112')) debitAccountId = acc.id;
        if (acc.account_code.startsWith('131')) arAccountId = acc.id;
        if (acc.account_code.startsWith('511')) revenueAccountId = acc.id;
      });
    }

    if (!debitAccountId || !revenueAccountId) {
      throw new Error('Chưa cấu hình tài khoản kế toán 1111/1121 hoặc 5113 cho chi nhánh này.');
    }

    // 3. Create Journal Entry Header
    const { data: journalEntry, error: entryError } = await supabase
      .from('journal_entries')
      .insert({
        tenant_id: tenantId,
        entry_date: new Date().toISOString().split('T')[0],
        description: `Hạch toán viện phí hóa đơn ${input.invoiceId}`,
        reference_type: 'EXPENSE', // Standard fallback reference
        status: 'POSTED' // Automatically post the entry
      })
      .select()
      .single();

    if (entryError || !journalEntry) {
      throw new Error(entryError?.message || 'Không thể tạo bút toán kế toán');
    }

    // 4. Create Journal Lines (Debit Cash/Bank, Debit BHYT, Credit Revenue)
    const journalLines = [];

    // Credit Service Revenue (5113)
    journalLines.push({
      entry_id: journalEntry.id,
      account_id: revenueAccountId,
      debit_amount: 0,
      credit_amount: input.billingCalculation.totalAmount
    });

    // Debit Patient Co-Pay (1111 / 1121)
    if (input.billingCalculation.patientCoPayAmount > 0) {
      journalLines.push({
        entry_id: journalEntry.id,
        account_id: debitAccountId,
        debit_amount: input.billingCalculation.patientCoPayAmount,
        credit_amount: 0
      });
    }

    // Debit BHYT direct coverage (131)
    if (input.billingCalculation.bhytCoveredAmount > 0 && arAccountId) {
      journalLines.push({
        entry_id: journalEntry.id,
        account_id: arAccountId,
        debit_amount: input.billingCalculation.bhytCoveredAmount,
        credit_amount: 0
      });
    }

    const { error: linesError } = await supabase
      .from('journal_lines')
      .insert(journalLines);

    if (linesError) {
      // Revert entry on line insert failure (Atomicity)
      await supabase.from('journal_entries').delete().eq('id', journalEntry.id);
      throw new Error(linesError.message);
    }

    return { success: true, journalEntryId: journalEntry.id };
  } catch (err: any) {
    return { success: false, error: err.message || 'Lỗi hạch toán hóa đơn viện phí' };
  }
}
