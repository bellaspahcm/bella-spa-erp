/**
 * Bella AutoMove — Vehicle Actions
 *
 * Product-level server actions for vehicle management.
 * Wraps database operations with Product-specific validation and tenant isolation.
 */

'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '@/services/user-actions';
import type { ActionResult, AutoVehicle, VehicleDetail } from '../types';

/**
 * List vehicles for current tenant
 */
export async function listVehiclesAction(): Promise<ActionResult<VehicleDetail[]>> {
  try {
    const user = await getCurrentUser();
    if (!user?.tenant_id) {
      return { success: false, error: 'Unauthorized: No tenant context' };
    }

    const supabase = await createClient();

    const { data: vehicles, error } = await supabase
      .from('auto_vehicles')
      .select('*')
      .eq('tenant_id', user.tenant_id)
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: vehicles as VehicleDetail[] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get vehicle detail by ID
 */
export async function getVehicleAction(
  vehicleId: string
): Promise<ActionResult<VehicleDetail>> {
  try {
    const user = await getCurrentUser();
    if (!user?.tenant_id) {
      return { success: false, error: 'Unauthorized: No tenant context' };
    }

    const supabase = await createClient();

    // Get vehicle with related data
    const { data: vehicle, error: vehicleError } = await supabase
      .from('auto_vehicles')
      .select('*')
      .eq('id', vehicleId)
      .eq('tenant_id', user.tenant_id)
      .single();

    if (vehicleError) {
      return { success: false, error: vehicleError.message };
    }

    if (!vehicle) {
      return { success: false, error: 'Vehicle not found' };
    }

    // Get service history
    const { data: serviceHistory } = await supabase
      .from('auto_service_history')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .eq('tenant_id', user.tenant_id)
      .order('service_date', { ascending: false });

    // Get active appointments
    const { data: activeAppointments } = await supabase
      .from('auto_service_appointments')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .eq('tenant_id', user.tenant_id)
      .in('status', ['pending', 'confirmed', 'checked_in', 'in_service'])
      .order('appointment_date', { ascending: false });

    const vehicleDetail: VehicleDetail = {
      ...vehicle,
      service_history: serviceHistory || [],
      active_appointments: activeAppointments || [],
    };

    return { success: true, data: vehicleDetail };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Create new vehicle
 */
export async function createVehicleAction(input: {
  vin: string;
  make: string;
  model: string;
  year: number;
  color?: string;
  customer_id?: string;
  license_plate?: string;
  mileage?: number;
}): Promise<ActionResult<AutoVehicle>> {
  try {
    const user = await getCurrentUser();
    if (!user?.tenant_id) {
      return { success: false, error: 'Unauthorized: No tenant context' };
    }

    // Validation
    if (!input.vin || input.vin.length < 17) {
      return { success: false, error: 'Invalid VIN (must be 17 characters)' };
    }

    if (!input.make || !input.model) {
      return { success: false, error: 'Make and model are required' };
    }

    if (input.year < 1900 || input.year > new Date().getFullYear() + 2) {
      return { success: false, error: 'Invalid year' };
    }

    const supabase = await createClient();

    // Check if VIN already exists for tenant
    const { data: existing } = await supabase
      .from('auto_vehicles')
      .select('id')
      .eq('vin', input.vin)
      .eq('tenant_id', user.tenant_id)
      .single();

    if (existing) {
      return { success: false, error: 'Vehicle with this VIN already exists' };
    }

    const { data: vehicle, error } = await supabase
      .from('auto_vehicles')
      .insert({
        tenant_id: user.tenant_id,
        vin: input.vin.toUpperCase(),
        make: input.make,
        model: input.model,
        year: input.year,
        color: input.color,
        customer_id: input.customer_id,
        license_plate: input.license_plate,
        mileage: input.mileage,
        status: 'in_service', // Service shop default status
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: vehicle };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Update vehicle
 */
export async function updateVehicleAction(
  vehicleId: string,
  updates: {
    make?: string;
    model?: string;
    year?: number;
    color?: string;
    license_plate?: string;
    mileage?: number;
    customer_id?: string;
  }
): Promise<ActionResult<AutoVehicle>> {
  try {
    const user = await getCurrentUser();
    if (!user?.tenant_id) {
      return { success: false, error: 'Unauthorized: No tenant context' };
    }

    const supabase = await createClient();

    // Verify vehicle belongs to tenant
    const { data: existing } = await supabase
      .from('auto_vehicles')
      .select('id')
      .eq('id', vehicleId)
      .eq('tenant_id', user.tenant_id)
      .single();

    if (!existing) {
      return { success: false, error: 'Vehicle not found' };
    }

    const { data: vehicle, error } = await supabase
      .from('auto_vehicles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', vehicleId)
      .eq('tenant_id', user.tenant_id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: vehicle };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
