import { supabase as typedSupabase } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = typedSupabase as unknown as SupabaseClient<any>;

export class SalesOutboxService {
  private static instance: SalesOutboxService;

  private constructor() {}

  public static getInstance(): SalesOutboxService {
    if (!SalesOutboxService.instance) {
      SalesOutboxService.instance = new SalesOutboxService();
    }
    return SalesOutboxService.instance;
  }

  /**
   * Enqueue a Real Estate sales transactional event into the accounting outbox
   */
  public async enqueueSalesEvent(params: {
    tenantId: string;
    saleType: 'RE_BOOKING_FEE' | 'RE_DEPOSIT_RECEIVED' | 'RE_INSTALLMENT_REVENUE';
    referenceType: 'BOOKING' | 'DEPOSIT' | 'CONTRACT';
    referenceId: string;
    amount: number;
    productId: string;
    customerId: string;
    metadata?: Record<string, unknown>;
  }): Promise<string | null> {
    const payload = {
      saleType: params.saleType,
      amount: params.amount,
      productId: params.productId,
      customerId: params.customerId,
      timestamp: new Date().toISOString(),
      ...(params.metadata || {}),
    };

    const { data, error } = await supabase.rpc('enqueue_accounting_event', {
      p_tenant_id: params.tenantId,
      p_event_type: 'PACKAGE_SALE', // Maps to standard accounting outbox enum
      p_reference_type: params.referenceType,
      p_reference_id: params.referenceId,
      p_payload: payload,
    });

    if (error) {
      console.error('[SalesOutboxService Error] Failed to enqueue outbox event:', error.message);
      throw error; // Rule #1: Zero Silent Database Failures
    }

    return data as string | null;
  }
}

export const salesOutboxService = SalesOutboxService.getInstance();
