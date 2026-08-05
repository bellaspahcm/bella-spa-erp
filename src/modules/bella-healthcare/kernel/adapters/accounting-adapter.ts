import { createClient } from '@/lib/supabase-server';
import { enqueueWithAutoClient } from '@/lib/accounting-outbox';

export interface HealthcareInvoicePaidEvent {
  readonly tenantId: string;
  readonly encounterId: string;
  readonly patientPartyId: string;
  readonly amount: number;
  readonly paymentMethod: 'cash' | 'bank_transfer' | 'card' | string;
  readonly lineItems: Array<{
    readonly type: 'service' | 'product'; // service = khám/thủ thuật, product = thuốc/vật tư
    readonly code: string;
    readonly label: string;
    readonly amount: number;
  }>;
}

export class HealthcareAccountingAdapter {
  /**
   * Biên dịch sự kiện thanh toán hóa đơn lượt khám y khoa sang Platform Ledger
   * thông qua transactional outbox.
   */
  async translateBillingToLedger(
    event: HealthcareInvoicePaidEvent
  ): Promise<boolean> {
    const supabase = await createClient();

    // Phân loại doanh thu theo TT133:
    // - Dịch vụ y tế (khám, nhổ răng, cấy implant): Doanh thu cung cấp dịch vụ (5113 hoặc 51111)
    // - Thuốc, vật tư y tế kê đơn: Doanh thu bán hàng hóa (5111 hoặc 51112)
    const ledgerDetails = event.lineItems.map((item) => {
      const isProduct = item.type === 'product';
      return {
        code: item.code,
        label: item.label,
        amount: item.amount,
        debit_account: event.paymentMethod === 'cash' ? '1111' : '1121', // Tiền mặt hoặc Tiền gửi ngân hàng
        credit_account: isProduct ? '51112' : '51111', // Doanh thu thuốc vs Doanh thu dịch vụ y khoa
      };
    });

    const payload = {
      encounter_id: event.encounterId,
      patient_id: event.patientPartyId,
      payment_method: event.paymentMethod,
      total_amount: event.amount,
      items: ledgerDetails,
      description: `Thanh toán hóa đơn lượt khám y tế ID: ${event.encounterId}`,
    };

    // Đẩy vào outbox với kiểu SESSION_DONE (kết thúc lượt khám và thanh toán lẻ)
    const success = await enqueueWithAutoClient(
      supabase,
      {
        tenantId: event.tenantId,
        eventType: 'SESSION_DONE',
        referenceType: 'REVENUE',
        referenceId: event.encounterId,
        payload,
      },
      '[healthcare-accounting-adapter]'
    );

    return success;
  }
}

export const healthcareAccountingAdapter = new HealthcareAccountingAdapter();
