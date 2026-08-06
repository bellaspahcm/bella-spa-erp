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
