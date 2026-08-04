/**
 * Workshop Data Mappers
 * Convert database schema to component-friendly formats
 * Handles new denormalized columns (scheduled_date, customer_name, vehicle_info)
 */

import type { Database } from '@/types/supabase';

type DbAppointment = Database['public']['Tables']['auto_service_appointments']['Row'];
type DbRepairOrder = Database['public']['Tables']['auto_repair_orders']['Row'];

/**
 * Map database appointment to ServiceCalendar component format
 */
export function mapAppointmentForCalendar(dbApt: DbAppointment) {
  // Parse scheduled_date (TIMESTAMPTZ) to separate date and time
  const scheduledDateTime = new Date(dbApt.scheduled_date);
  const scheduledDate = scheduledDateTime.toISOString().split('T')[0]; // YYYY-MM-DD
  const scheduledTime = scheduledDateTime.toLocaleTimeString('en-GB', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  }); // HH:MM

  // Parse vehicle_info to extract license plate
  // Format: "2024 Toyota Camry GLX - 30A-12345" or "2024 Toyota Camry GLX"
  const vehicleInfoParts = dbApt.vehicle_info?.split(' - ') || [];
  const vehicleInfo = vehicleInfoParts[0] || 'Unknown Vehicle';
  const licensePlate = vehicleInfoParts[1] || 'N/A';

  return {
    id: dbApt.id,
    appointmentNumber: dbApt.appointment_number || 'N/A',
    customerName: dbApt.customer_name || 'Unknown Customer',
    vehicleInfo,
    licensePlate,
    scheduledDate,
    scheduledTime,
    serviceType: dbApt.description || dbApt.requested_services || 'Dịch vụ không xác định',
    status: dbApt.status || 'pending',
    serviceAdvisorName: undefined, // TODO: join with users table if needed
    estimatedDuration: dbApt.estimated_duration_hours ? Number(dbApt.estimated_duration_hours) : undefined,
  };
}

/**
 * Map database repair order to RepairOrderBoard component format
 */
export function mapRepairOrderForBoard(dbOrder: DbRepairOrder) {
  // Parse vehicle_info to extract license plate
  const vehicleInfoParts = dbOrder.vehicle_info?.split(' - ') || [];
  const vehicleDisplay = vehicleInfoParts[0] || 'Unknown Vehicle';
  const licensePlate = vehicleInfoParts[1] || 'N/A';

  return {
    id: dbOrder.id,
    orderNumber: dbOrder.order_number || 'N/A',
    customerName: dbOrder.customer_name || 'Unknown Customer',
    customerPhone: dbOrder.customer_phone || '',
    vehicleInfo: vehicleDisplay,
    licensePlate,
    status: dbOrder.status || 'new',
    openedAt: dbOrder.opened_at,
    priority: dbOrder.priority || 'normal',
    estimatedCompletionDate: dbOrder.estimated_completion_date,
    actualCompletionDate: dbOrder.actual_completion_date,
    totalEstimate: dbOrder.total_estimate ? Number(dbOrder.total_estimate) : 0,
    totalActual: dbOrder.total_actual ? Number(dbOrder.total_actual) : 0,
    assignedTechnicianId: dbOrder.assigned_technician_id,
    serviceAdvisorId: dbOrder.service_advisor_id,
  };
}

/**
 * Helper: Format scheduled_date for display
 */
export function formatScheduledDate(scheduledDate: string): string {
  const date = new Date(scheduledDate);
  return date.toLocaleDateString('vi-VN', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Helper: Extract license plate from vehicle_info
 */
export function extractLicensePlate(vehicleInfo: string | null): string {
  if (!vehicleInfo) return 'N/A';
  const parts = vehicleInfo.split(' - ');
  return parts[1] || 'N/A';
}

/**
 * Helper: Extract vehicle display name from vehicle_info
 */
export function extractVehicleDisplay(vehicleInfo: string | null): string {
  if (!vehicleInfo) return 'Unknown Vehicle';
  const parts = vehicleInfo.split(' - ');
  return parts[0] || 'Unknown Vehicle';
}
