/**
 * Bella AutoMove — Repair Order Actions
 *
 * Product-level server actions for repair order management.
 */

'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '@/services/user-actions';
import type {
  ActionResult,
  AutoRepairOrder,
  RepairOrderDetail,
  AutoRepairOrderItem,
} from '../types';

/**
 * List repair orders for current tenant
 */
export async function listRepairOrdersAction(filters?: {
  status?: string;
  vehicleId?: string;
}): Promise<ActionResult<RepairOrderDetail[]>> {
  try {
    const user = await getCurrentUser();
    if (!user?.tenant_id) {
      return { success: false, error: 'Unauthorized: No tenant context' };
    }

    const supabase = await createClient();

    let query = supabase
      .from('auto_repair_orders')
      .select(`
        *,
        items:auto_repair_order_items(*),
        vehicle:auto_vehicles(id, vin, variant_id),
        appointment:auto_service_appointments(id, appointment_number, appointment_date)
      `)
      .eq('tenant_id', user.tenant_id);

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.vehicleId) {
      query = query.eq('vehicle_id', filters.vehicleId);
    }

    query = query.order('created_at', { ascending: false });

    const { data: orders, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    // Calculate totals for each order
    const ordersWithTotals: RepairOrderDetail[] = (orders || []).map(order => {
      const items = order.items || [];
      const laborTotal = items
        .filter((i: AutoRepairOrderItem) => i.item_type === 'labor')
        .reduce((sum: number, i: AutoRepairOrderItem) => sum + (i.total_price || 0), 0);
      
      const partsTotal = items
        .filter((i: AutoRepairOrderItem) => i.item_type === 'part')
        .reduce((sum: number, i: AutoRepairOrderItem) => sum + (i.total_price || 0), 0);
      
      const subtotal = laborTotal + partsTotal;
      const taxRate = order.tax_rate || 0;
      const tax = subtotal * taxRate;
      const total = subtotal + tax;

      return {
        ...order,
        totals: {
          labor_total: laborTotal,
          parts_total: partsTotal,
          subtotal,
          tax,
          total,
        },
      };
    });

    return { success: true, data: ordersWithTotals };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get repair order detail by ID
 */
export async function getRepairOrderAction(
  orderId: string
): Promise<ActionResult<RepairOrderDetail>> {
  try {
    const user = await getCurrentUser();
    if (!user?.tenant_id) {
      return { success: false, error: 'Unauthorized: No tenant context' };
    }

    const supabase = await createClient();

    const { data: order, error } = await supabase
      .from('auto_repair_orders')
      .select(`
        *,
        items:auto_repair_order_items(*),
        vehicle:auto_vehicles(id, vin, variant_id),
        appointment:auto_service_appointments(id, appointment_number, appointment_date)
      `)
      .eq('id', orderId)
      .eq('tenant_id', user.tenant_id)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!order) {
      return { success: false, error: 'Repair order not found' };
    }

    // Calculate totals
    const items = order.items || [];
    const laborTotal = items
      .filter((i: AutoRepairOrderItem) => i.item_type === 'labor')
      .reduce((sum: number, i: AutoRepairOrderItem) => sum + (i.total_price || 0), 0);
    
    const partsTotal = items
      .filter((i: AutoRepairOrderItem) => i.item_type === 'part')
      .reduce((sum: number, i: AutoRepairOrderItem) => sum + (i.total_price || 0), 0);
    
    const subtotal = laborTotal + partsTotal;
    const taxRate = order.tax_rate || 0;
    const tax = subtotal * taxRate;
    const total = subtotal + tax;

    const orderDetail: RepairOrderDetail = {
      ...order,
      totals: {
        labor_total: laborTotal,
        parts_total: partsTotal,
        subtotal,
        tax,
        total,
      },
    };

    return { success: true, data: orderDetail };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Create repair order from appointment
 */
export async function createRepairOrderAction(input: {
  appointment_id?: string;
  vehicle_id: string;
  customer_id: string;
  description: string;
  estimated_hours?: number;
  tax_rate?: number;
}): Promise<ActionResult<AutoRepairOrder>> {
  try {
    const user = await getCurrentUser();
    if (!user?.tenant_id) {
      return { success: false, error: 'Unauthorized: No tenant context' };
    }

    // Validation
    if (!input.vehicle_id || !input.customer_id || !input.description) {
      return { success: false, error: 'Vehicle, customer, and description are required' };
    }

    const supabase = await createClient();

    // Verify vehicle and customer
    const { data: vehicle } = await supabase
      .from('auto_vehicles')
      .select('id')
      .eq('id', input.vehicle_id)
      .eq('tenant_id', user.tenant_id)
      .single();

    if (!vehicle) {
      return { success: false, error: 'Vehicle not found' };
    }

    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('id', input.customer_id)
      .eq('tenant_id', user.tenant_id)
      .single();

    if (!customer) {
      return { success: false, error: 'Customer not found' };
    }

    // Generate order number
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `RO-${dateStr}-${randomSuffix}`;

    const { data: order, error } = await supabase
      .from('auto_repair_orders')
      .insert({
        tenant_id: user.tenant_id,
        order_number: orderNumber,
        appointment_id: input.appointment_id,
        vehicle_id: input.vehicle_id,
        customer_id: input.customer_id,
        description: input.description,
        estimated_hours: input.estimated_hours,
        tax_rate: input.tax_rate || 0.1, // Default 10%
        status: 'draft',
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: order };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Add line item to repair order
 */
export async function addRepairOrderItemAction(input: {
  repair_order_id: string;
  item_type: 'labor' | 'part';
  description: string;
  quantity: number;
  unit_price: number;
  part_number?: string;
}): Promise<ActionResult<AutoRepairOrderItem>> {
  try {
    const user = await getCurrentUser();
    if (!user?.tenant_id) {
      return { success: false, error: 'Unauthorized: No tenant context' };
    }

    // Validation
    if (!input.repair_order_id || !input.description) {
      return { success: false, error: 'Order ID and description are required' };
    }

    if (input.quantity <= 0 || input.unit_price < 0) {
      return { success: false, error: 'Invalid quantity or price' };
    }

    const supabase = await createClient();

    // Verify repair order belongs to tenant
    const { data: order } = await supabase
      .from('auto_repair_orders')
      .select('id')
      .eq('id', input.repair_order_id)
      .eq('tenant_id', user.tenant_id)
      .single();

    if (!order) {
      return { success: false, error: 'Repair order not found' };
    }

    const totalPrice = input.quantity * input.unit_price;

    const { data: item, error } = await supabase
      .from('auto_repair_order_items')
      .insert({
        tenant_id: user.tenant_id,
        repair_order_id: input.repair_order_id,
        item_type: input.item_type,
        description: input.description,
        quantity: input.quantity,
        unit_price: input.unit_price,
        total_price: totalPrice,
        part_number: input.part_number,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: item };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Update repair order status
 */
export async function updateRepairOrderStatusAction(
  orderId: string,
  status: 'draft' | 'in_progress' | 'completed' | 'cancelled'
): Promise<ActionResult<AutoRepairOrder>> {
  try {
    const user = await getCurrentUser();
    if (!user?.tenant_id) {
      return { success: false, error: 'Unauthorized: No tenant context' };
    }

    const supabase = await createClient();

    // Verify order belongs to tenant
    const { data: existing } = await supabase
      .from('auto_repair_orders')
      .select('id')
      .eq('id', orderId)
      .eq('tenant_id', user.tenant_id)
      .single();

    if (!existing) {
      return { success: false, error: 'Repair order not found' };
    }

    const updates: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
    }

    const { data: order, error } = await supabase
      .from('auto_repair_orders')
      .update(updates)
      .eq('id', orderId)
      .eq('tenant_id', user.tenant_id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: order };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
