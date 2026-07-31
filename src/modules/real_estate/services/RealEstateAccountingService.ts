import { Database } from '@/types/database.types';
import { SupabaseClient } from '@supabase/supabase-js';
import { enqueueAccountingEvent, AccountingEventType, AccountingReferenceType } from '@/lib/accounting-outbox';

type ProductRow = Database['public']['Tables']['real_estate_products']['Row'];

export class RealEstateAccountingService {
  /**
   * Emit transactional accounting outbox event based on unit status transition.
   * Never writes directly to journal_entries - always uses accounting_outbox (Rule #112).
   */
  static async emitStatusChangeEvent(
    supabase: SupabaseClient<Database>,
    tenantId: string,
    product: ProductRow,
    targetStatus: ProductRow['status']
  ): Promise<boolean> {
    if (!tenantId || !product) return false;

    let eventType: AccountingEventType = 'PACKAGE_SALE';
    let referenceType: AccountingReferenceType = 'REVENUE';
    let description = '';

    const totalPrice = product.unit_price * product.area;

    switch (targetStatus) {
      case 'booked':
        eventType = 'PACKAGE_SALE';
        referenceType = 'BOOKING';
        description = `Thu tiền giữ chỗ tạm thời căn ${product.product_code}`;
        break;
      case 'deposited':
        eventType = 'PACKAGE_SALE';
        referenceType = 'REVENUE';
        description = `Thu tiền cọc căn ${product.product_code}`;
        break;
      case 'contracted':
        eventType = 'MANUAL_ENTRY';
        referenceType = 'REVENUE';
        description = `Ký HĐMB căn ${product.product_code} (Công nợ 131)`;
        break;
      case 'handed_over':
        eventType = 'PACKAGE_SALE';
        referenceType = 'REVENUE';
        description = `Ghi nhận Doanh thu & Bàn giao căn ${product.product_code} (Tk 511/3331)`;
        break;
      default:
        // Non-financial status changes (e.g. available, cancelled) don't emit financial events
        return true;
    }

    const payload = {
      product_id: product.id,
      product_code: product.product_code,
      project_id: product.project_id,
      status: targetStatus,
      owner_name: product.owner_name,
      area: product.area,
      unit_price: product.unit_price,
      total_price: totalPrice,
      description,
      module: 'real_estate',
    };

    return enqueueAccountingEvent(
      supabase,
      {
        tenantId,
        eventType,
        referenceType,
        referenceId: product.id,
        payload,
      },
      '[RealEstateAccounting]'
    );
  }
}
