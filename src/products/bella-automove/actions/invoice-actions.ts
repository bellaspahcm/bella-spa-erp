/**
 * Bella AutoMove — Invoice Actions
 *
 * Product-level server actions for invoice generation and management.
 * 
 * Note: Basic implementation. Finance Kernel integration to be assessed.
 */

'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '@/services/user-actions';
import type { ActionResult, Invoice, RepairOrderDetail } from '../types';
import { getRepairOrderAction } from './repair-order-actions';

/**
 * Generate invoice from completed repair order
 */
export async function generateInvoiceAction(
  repairOrderId: string
): Promise<ActionResult<Invoice>> {
  try {
    const user = await getCurrentUser();
    if (!user?.tenant_id) {
      return { success: false, error: 'Unauthorized: No tenant context' };
    }

    // Get repair order with totals
    const orderResult = await getRepairOrderAction(repairOrderId);
    if (!orderResult.success || !orderResult.data) {
      return { success: false, error: 'Repair order not found' };
    }

    const order: RepairOrderDetail = orderResult.data;

    // Verify order is completed
    if (order.status !== 'completed') {
      return { success: false, error: 'Can only invoice completed repair orders' };
    }

    const supabase = await createClient();

    // Check if invoice already exists
    const { data: existing } = await supabase
      .from('auto_invoices')
      .select('id')
      .eq('repair_order_id', repairOrderId)
      .eq('tenant_id', user.tenant_id)
      .single();

    if (existing) {
      return { success: false, error: 'Invoice already exists for this repair order' };
    }

    // Generate invoice number
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `INV-${dateStr}-${randomSuffix}`;

    const issueDate = new Date();
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + 30); // 30 days payment term

    const invoice: Invoice = {
      id: '', // Will be set by database
      invoice_number: invoiceNumber,
      repair_order_id: repairOrderId,
      tenant_id: user.tenant_id,
      customer_id: order.customer_id,
      vehicle_id: order.vehicle_id,
      issue_date: issueDate.toISOString(),
      due_date: dueDate.toISOString(),
      labor_total: order.totals.labor_total,
      parts_total: order.totals.parts_total,
      subtotal: order.totals.subtotal,
      tax_rate: order.tax_rate || 0,
      tax_amount: order.totals.tax,
      total_amount: order.totals.total,
      paid_amount: 0,
      balance: order.totals.total,
      status: 'issued',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Store invoice (assuming auto_invoices table exists or using simple storage)
    // For MVP, returning constructed invoice object
    // TODO: Integrate with Finance Kernel or persist to database

    return { success: true, data: invoice };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * List invoices for current tenant
 */
export async function listInvoicesAction(filters?: {
  status?: string;
  customerId?: string;
}): Promise<ActionResult<Invoice[]>> {
  try {
    const user = await getCurrentUser();
    if (!user?.tenant_id) {
      return { success: false, error: 'Unauthorized: No tenant context' };
    }

    // TODO: Query auto_invoices table when available
    // For now, returning empty array

    return { success: true, data: [] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get invoice by ID
 */
export async function getInvoiceAction(
  invoiceId: string
): Promise<ActionResult<Invoice>> {
  try {
    const user = await getCurrentUser();
    if (!user?.tenant_id) {
      return { success: false, error: 'Unauthorized: No tenant context' };
    }

    // TODO: Query auto_invoices table when available

    return { success: false, error: 'Invoice not found' };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
