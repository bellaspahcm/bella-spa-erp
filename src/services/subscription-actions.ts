'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from './user-actions';
import { checkSubscriptionLimit, SUBSCRIPTION_TIERS } from '@/lib/subscription';
import { revalidatePath } from 'next/cache';

export interface SubscriptionInvoice {
  id: string;
  tenant_id: string;
  invoice_number: string;
  amount: number;
  status: 'pending' | 'paid' | 'cancelled';
  tier: string;
  duration_months: number;
  created_at: string;
  paid_at: string | null;
  payment_method: string | null;
}

const TIER_PRICES: Record<string, number> = {
  free_trial: 0,
  basic: 499000,
  pro: 999000,
  enterprise: 2499000,
};

interface CustomSupabaseClient {
  from(table: 'subscription_invoices'): {
    select(columns?: string): {
      eq(column: 'tenant_id', value: string): {
        order(column: 'created_at', options?: { ascending?: boolean }): Promise<{
          data: SubscriptionInvoice[] | null;
          error: { message: string } | null;
        }>;
      };
    };
    insert(values: Array<{
      tenant_id: string;
      invoice_number: string;
      amount: number;
      status: 'pending';
      tier: string;
      duration_months: number;
    }>): {
      select(): {
        single(): Promise<{
          data: SubscriptionInvoice | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
  rpc(
    fn: 'renew_tenant_subscription',
    args: { p_invoice_number: string; p_payment_method: string }
  ): Promise<{ data: unknown; error: { message: string } | null }>;
}

/**
 * Get active subscription status and resource usage metrics
 */
export async function getSubscriptionStatus() {
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;

  if (!tenantId) {
    throw new Error('Unauthorized: Tenant ID is required');
  }

  // Check KTV count
  const ktvLimit = await checkSubscriptionLimit(tenantId, 'ktv');
  // Check Customer count
  const customerLimit = await checkSubscriptionLimit(tenantId, 'customer');
  // Check SMS count
  const smsLimit = await checkSubscriptionLimit(tenantId, 'sms');

  return {
    tier: ktvLimit.tier,
    isExpired: ktvLimit.isExpired || false,
    limits: ktvLimit.limits,
    usage: {
      ktv: {
        current: ktvLimit.current,
        max: ktvLimit.max,
        isBlocked: ktvLimit.isBlocked,
      },
      customer: {
        current: customerLimit.current,
        max: customerLimit.max,
        isBlocked: customerLimit.isBlocked,
      },
      sms: {
        current: smsLimit.current,
        max: smsLimit.max,
        isBlocked: smsLimit.isBlocked,
      },
    },
  };
}

/**
 * Fetch invoice history for the current tenant
 */
export async function getSubscriptionInvoiceHistory(): Promise<SubscriptionInvoice[]> {
  const supabase = await createClient() as unknown as CustomSupabaseClient;
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;

  if (!tenantId) {
    throw new Error('Unauthorized: Tenant ID is required');
  }

  const { data, error } = await supabase
    .from('subscription_invoices')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching subscription invoices:', error);
    return [];
  }

  return data || [];
}

/**
 * Create a new pending subscription invoice
 */
export async function createUpgradeInvoice(tier: string, durationMonths: number) {
  const supabase = await createClient() as unknown as CustomSupabaseClient;
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;

  if (!tenantId) {
    return { error: 'Không xác định được chi nhánh của người dùng' };
  }

  const pricePerMonth = TIER_PRICES[tier];
  if (pricePerMonth === undefined) {
    return { error: 'Gói cước không hợp lệ' };
  }

  const totalAmount = pricePerMonth * durationMonths;
  const invoiceNumber = `INV-${Date.now().toString().slice(-8)}`;

  // Defer RLS by executing through tenant context or service role if needed,
  // but public.subscription_invoices RLS allows inserting/viewing if you're an Admin of the tenant
  const { data, error } = await supabase
    .from('subscription_invoices')
    .insert([{
      tenant_id: tenantId,
      invoice_number: invoiceNumber,
      amount: totalAmount,
      status: 'pending',
      tier: tier,
      duration_months: durationMonths,
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating upgrade invoice:', error);
    return { error: error.message };
  }

  revalidatePath('/dashboard/settings');
  return { success: true, invoice: data };
}

/**
 * Simulate database payment webhook callback for sandbox validation
 */
export async function simulateInvoicePayment(invoiceNumber: string) {
  const supabase = await createClient() as unknown as CustomSupabaseClient;
  const { data, error } = await supabase.rpc('renew_tenant_subscription', {
    p_invoice_number: invoiceNumber,
    p_payment_method: 'Simulated VietQR'
  });

  if (error) {
    console.error('Error simulating invoice payment:', error);
    return { error: error.message };
  }

  revalidatePath('/dashboard/settings');
  return { success: true };
}
