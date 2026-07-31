import { Database } from '@/types/database.types';
import { SupabaseClient } from '@supabase/supabase-js';

type ProductRow = Database['public']['Tables']['real_estate_products']['Row'];

export class ReservationExpiryEngine {
  /**
   * Check and auto-release held/booked units that have exceeded the holding window (default 24 hours).
   */
  static async checkAndReleaseExpiredHoldings(
    supabase: SupabaseClient<Database>,
    tenantId: string,
    holdHours: number = 24
  ): Promise<ProductRow[]> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    // Calculate cutoff timestamp
    const cutoffTime = new Date(Date.now() - holdHours * 60 * 60 * 1000).toISOString();

    // 1. Query booked products for this tenant updated before cutoff
    const { data: expiredProducts, error: fetchError } = await supabase
      .from('real_estate_products')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'booked')
      .lt('updated_at', cutoffTime);

    if (fetchError) {
      console.error('[ReservationExpiryEngine] Error fetching expired bookings:', fetchError.message);
      throw fetchError;
    }

    if (!expiredProducts || expiredProducts.length === 0) {
      return [];
    }

    const releasedProducts: ProductRow[] = [];

    // 2. Auto-release each expired product to 'available'
    for (const product of expiredProducts) {
      const { data: updatedProduct, error: updateError } = await supabase
        .from('real_estate_products')
        .update({
          status: 'available',
          owner_name: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', product.id)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (updateError) {
        console.error(`[ReservationExpiryEngine] Error releasing product ${product.id}:`, updateError.message);
      } else if (updatedProduct) {
        releasedProducts.push(updatedProduct);
      }
    }

    console.log(
      `[ReservationExpiryEngine] Released ${releasedProducts.length}/${expiredProducts.length} expired holdings for tenant ${tenantId}`
    );

    return releasedProducts;
  }
}
