'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from './user-actions';
import { checkSubscriptionLimit } from '@/lib/subscription';
import { revalidatePath } from 'next/cache';
import type { Database } from '@/types/database.types';
import {
  calculateSubscriptionInvoiceAmount,
  validateSubscriptionDuration,
} from '@/lib/business-rules/subscription';

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

type SubscriptionInvoiceInsert = Database['public']['Tables']['subscription_invoices']['Insert'];
type SubscriptionPlanPrice = Pick<
  Database['public']['Tables']['subscription_plans']['Row'],
  'plan_code' | 'price_monthly' | 'is_active'
>;

function canManageSubscription(role?: string | null) {
  return role === 'admin' || role === 'super_admin';
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
  const supabase = await createClient();
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
    throw new Error(`[getSubscriptionInvoiceHistory] subscription_invoices query failed: ${error.message}`);
  }

  return (data || []) as SubscriptionInvoice[];
}

/**
 * Create a new pending subscription invoice
 */
export async function createUpgradeInvoice(tier: string, durationMonths: number) {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;

  if (!currentUser || !canManageSubscription(currentUser.role)) {
    return { error: 'Không có quyền tạo hóa đơn gói dịch vụ.' };
  }

  if (!tenantId) {
    return { error: 'Không xác định được chi nhánh của người dùng' };
  }

  const durationError = validateSubscriptionDuration(durationMonths);
  if (durationError) {
    return { error: durationError };
  }

  const { data: plan, error: planError } = await (supabase
    .from('subscription_plans')
    .select('plan_code, price_monthly, is_active')
    .eq('plan_code', tier)
    .eq('is_active', true)
    .maybeSingle() as unknown as Promise<{ data: SubscriptionPlanPrice | null; error: { message: string } | null }>);

  if (planError) {
    return { error: `[createUpgradeInvoice] subscription_plans query failed: ${planError.message}` };
  }

  if (!plan) {
    return { error: 'Gói cước không hợp lệ' };
  }

  const invoiceAmount = calculateSubscriptionInvoiceAmount({
    priceMonthly: plan.price_monthly,
    durationMonths,
  });
  if (!invoiceAmount.success) {
    return { error: invoiceAmount.error };
  }

  const invoiceNumber = `INV-${Date.now().toString().slice(-8)}`;
  const invoicePayload: SubscriptionInvoiceInsert = {
    tenant_id: tenantId,
    invoice_number: invoiceNumber,
    amount: invoiceAmount.amount,
    status: 'pending',
    tier,
    duration_months: durationMonths,
  };

  const { data, error } = await supabase
    .from('subscription_invoices')
    .insert(invoicePayload)
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
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;

  if (!currentUser || !canManageSubscription(currentUser.role)) {
    return { error: 'Không có quyền kích hoạt thanh toán gói dịch vụ.' };
  }

  if (!tenantId) {
    return { error: 'Không xác định được chi nhánh của người dùng' };
  }

  const normalizedInvoiceNumber = invoiceNumber.trim().toUpperCase();
  const { data: invoice, error: invoiceError } = await supabase
    .from('subscription_invoices')
    .select('invoice_number')
    .eq('invoice_number', normalizedInvoiceNumber)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (invoiceError) {
    return { error: `[simulateInvoicePayment] subscription_invoices query failed: ${invoiceError.message}` };
  }

  if (!invoice) {
    return { error: 'Không tìm thấy hóa đơn gói dịch vụ thuộc chi nhánh hiện tại.' };
  }

  const { error } = await supabase.rpc('renew_tenant_subscription', {
    p_invoice_number: normalizedInvoiceNumber,
    p_payment_method: 'Simulated VietQR'
  });

  if (error) {
    console.error('Error simulating invoice payment:', error);
    return { error: error.message };
  }

  revalidatePath('/dashboard/settings');
  return { success: true };
}
