/**
 * Bella AutoMove — Appointment Actions
 *
 * Product-level server actions for service appointment management.
 */

'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '@/services/user-actions';
import type { ActionResult, AutoServiceAppointment, AppointmentDetail } from '../types';

/**
 * List appointments for current tenant
 */
export async function listAppointmentsAction(filters?: {
  status?: string;
  vehicleId?: string;
  fromDate?: string;
  toDate?: string;
}): Promise<ActionResult<AppointmentDetail[]>> {
  try {
    const user = await getCurrentUser();
    if (!user?.tenant_id) {
      return { success: false, error: 'Unauthorized: No tenant context' };
    }

    const supabase = await createClient();

    let query = supabase
      .from('auto_service_appointments')
      .select(`
        *,
        vehicle:auto_vehicles(id, vin, variant_id)
      `)
      .eq('tenant_id', user.tenant_id);

    // Apply filters
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.vehicleId) {
      query = query.eq('vehicle_id', filters.vehicleId);
    }
    if (filters?.fromDate) {
      query = query.gte('appointment_date', filters.fromDate);
    }
    if (filters?.toDate) {
      query = query.lte('appointment_date', filters.toDate);
    }

    query = query.order('appointment_date', { ascending: false });

    const { data: appointments, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: appointments as AppointmentDetail[] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get appointment detail by ID
 */
export async function getAppointmentAction(
  appointmentId: string
): Promise<ActionResult<AppointmentDetail>> {
  try {
    const user = await getCurrentUser();
    if (!user?.tenant_id) {
      return { success: false, error: 'Unauthorized: No tenant context' };
    }

    const supabase = await createClient();

    const { data: appointment, error } = await supabase
      .from('auto_service_appointments')
      .select(`
        *,
        vehicle:auto_vehicles(id, vin, variant_id)
      `)
      .eq('id', appointmentId)
      .eq('tenant_id', user.tenant_id)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!appointment) {
      return { success: false, error: 'Appointment not found' };
    }

    return { success: true, data: appointment as AppointmentDetail };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Create new appointment
 */
export async function createAppointmentAction(input: {
  vehicle_id: string;
  customer_id: string;
  appointment_date: string;
  service_type: string;
  notes?: string;
}): Promise<ActionResult<AutoServiceAppointment>> {
  try {
    const user = await getCurrentUser();
    if (!user?.tenant_id) {
      return { success: false, error: 'Unauthorized: No tenant context' };
    }

    // Validation
    if (!input.vehicle_id || !input.customer_id || !input.appointment_date) {
      return { success: false, error: 'Vehicle, customer, and date are required' };
    }

    const appointmentDate = new Date(input.appointment_date);
    if (isNaN(appointmentDate.getTime())) {
      return { success: false, error: 'Invalid appointment date' };
    }

    const supabase = await createClient();

    // Verify vehicle and customer belong to tenant
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

    // Generate appointment number
    const dateStr = appointmentDate.toISOString().split('T')[0].replace(/-/g, '');
    const { data: numberData } = await supabase.rpc('generate_appointment_number', {
      p_tenant_id: user.tenant_id,
      p_date_prefix: dateStr,
    });

    const appointmentNumber = numberData || `APT-${dateStr}-${Date.now().toString().slice(-4)}`;

    const { data: appointment, error } = await supabase
      .from('auto_service_appointments')
      .insert({
        tenant_id: user.tenant_id,
        appointment_number: appointmentNumber,
        vehicle_id: input.vehicle_id,
        customer_id: input.customer_id,
        appointment_date: input.appointment_date,
        service_type: input.service_type,
        notes: input.notes,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: appointment };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Update appointment status
 */
export async function updateAppointmentStatusAction(
  appointmentId: string,
  status: 'pending' | 'confirmed' | 'checked_in' | 'in_service' | 'completed' | 'cancelled'
): Promise<ActionResult<AutoServiceAppointment>> {
  try {
    const user = await getCurrentUser();
    if (!user?.tenant_id) {
      return { success: false, error: 'Unauthorized: No tenant context' };
    }

    const supabase = await createClient();

    // Verify appointment belongs to tenant
    const { data: existing } = await supabase
      .from('auto_service_appointments')
      .select('id, status')
      .eq('id', appointmentId)
      .eq('tenant_id', user.tenant_id)
      .single();

    if (!existing) {
      return { success: false, error: 'Appointment not found' };
    }

    // Status transition logic
    const updates: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'confirmed') {
      updates.confirmed_at = new Date().toISOString();
    } else if (status === 'checked_in') {
      updates.checked_in_at = new Date().toISOString();
    } else if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
    }

    const { data: appointment, error } = await supabase
      .from('auto_service_appointments')
      .update(updates)
      .eq('id', appointmentId)
      .eq('tenant_id', user.tenant_id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: appointment };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
