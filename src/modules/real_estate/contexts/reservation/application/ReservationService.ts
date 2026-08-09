import { supabase as typedSupabase } from '@/lib/supabase';
const supabase = typedSupabase as unknown;

export interface ReservationResult {
  readonly success: boolean;
  readonly reservationId?: string;
  readonly expiresAt?: string;
  readonly error?: string;
}

export class ReservationService {
  private static instance: ReservationService;

  private constructor() {}

  public static getInstance(): ReservationService {
    if (!ReservationService.instance) {
      ReservationService.instance = new ReservationService();
    }
    return ReservationService.instance;
  }

  /**
   * Execute the postgres transaction-safe reservation RPC
   */
  public async reserveProduct(params: {
    tenantId: string;
    productId: string;
    userId?: string;
    customerId?: string;
    durationMinutes: number;
  }): Promise<ReservationResult> {
    const { data, error } = await supabase.rpc('reserve_product', {
      p_tenant_id: params.tenantId,
      p_product_id: params.productId,
      p_user_id: params.userId || null,
      p_customer_id: params.customerId || null,
      p_duration_minutes: params.durationMinutes,
    });

    if (error) {
      console.error('[ReservationService Error] RPC execution failed:', error.message);
      throw error; // Rule #1: Zero Silent Database Failures
    }

    const res = data as Record<string, unknown>;
    if (!res.success) {
      return {
        success: false,
        error: res.error,
      };
    }

    return {
      success: true,
      reservationId: res.reservation_id,
      expiresAt: res.expires_at,
    };
  }

  /**
   * Manually release an active hold reservation
   */
  public async releaseProduct(tenantId: string, productId: string, reservationId: string): Promise<void> {
    // Start transactional update:
    // 1. Mark reservation as released
    const { error: resError } = await supabase
      .from('re_reservations')
      .update({ status: 'released', updated_at: new Date().toISOString() })
      .eq('id', reservationId)
      .eq('tenant_id', tenantId);

    if (resError) {
      console.error('[ReservationService Error] Failed to update reservation status:', resError.message);
      throw resError;
    }

    // 2. Restore product status back to available
    const { error: prodError } = await supabase
      .from('real_estate_products')
      .update({ status: 'available', updated_at: new Date().toISOString() })
      .eq('id', productId)
      .eq('tenant_id', tenantId);

    if (prodError) {
      console.error('[ReservationService Error] Failed to restore product status:', prodError.message);
      throw prodError;
    }
  }
}

export const reservationService = ReservationService.getInstance();
