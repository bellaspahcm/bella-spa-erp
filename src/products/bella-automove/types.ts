/**
 * BELLA AUTOMOVE — PRODUCT TYPES
 *
 * Type definitions for Bella AutoMove Product layer.
 * Imports from database schema and adds Product-specific types.
 *
 * @module src/products/bella-automove/types
 */

import type { Database } from '@/types/database.types';

// ────────────────────────────────────────────────────────────────────────────
// DATABASE TABLE TYPES (from schema)
// ────────────────────────────────────────────────────────────────────────────

export type AutoVehicle = Database['public']['Tables']['auto_vehicles']['Row'];
export type AutoVehicleInsert = Database['public']['Tables']['auto_vehicles']['Insert'];
export type AutoVehicleUpdate = Database['public']['Tables']['auto_vehicles']['Update'];

export type AutoServiceAppointment = Database['public']['Tables']['auto_service_appointments']['Row'];
export type AutoServiceAppointmentInsert = Database['public']['Tables']['auto_service_appointments']['Insert'];
export type AutoServiceAppointmentUpdate = Database['public']['Tables']['auto_service_appointments']['Update'];

export type AutoRepairOrder = Database['public']['Tables']['auto_repair_orders']['Row'];
export type AutoRepairOrderInsert = Database['public']['Tables']['auto_repair_orders']['Insert'];
export type AutoRepairOrderUpdate = Database['public']['Tables']['auto_repair_orders']['Update'];

export type AutoRepairOrderItem = Database['public']['Tables']['auto_repair_order_items']['Row'];
export type AutoRepairOrderItemInsert = Database['public']['Tables']['auto_repair_order_items']['Insert'];

export type AutoServiceHistory = Database['public']['Tables']['auto_service_history']['Row'];

// ────────────────────────────────────────────────────────────────────────────
// PRODUCT-SPECIFIC TYPES
// ────────────────────────────────────────────────────────────────────────────

/**
 * Vehicle with extended information (customer, service history)
 */
export interface VehicleDetail extends AutoVehicle {
  customer?: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
  };
  service_history?: AutoServiceHistory[];
  active_appointments?: AutoServiceAppointment[];
}

/**
 * Appointment with related entities
 */
export interface AppointmentDetail extends AutoServiceAppointment {
  vehicle?: {
    id: string;
    vin: string;
    make: string;
    model: string;
    year: number;
  };
  customer?: {
    id: string;
    name: string;
    phone?: string;
  };
}

/**
 * Repair order with line items and totals
 */
export interface RepairOrderDetail extends AutoRepairOrder {
  items: AutoRepairOrderItem[];
  vehicle?: {
    id: string;
    vin: string;
    make: string;
    model: string;
  };
  customer?: {
    id: string;
    name: string;
    phone?: string;
  };
  appointment?: {
    id: string;
    appointment_number: string;
    appointment_date: string;
  };
  totals: {
    labor_total: number;
    parts_total: number;
    subtotal: number;
    tax: number;
    total: number;
  };
}

/**
 * Invoice data structure
 */
export interface Invoice {
  id: string;
  invoice_number: string;
  repair_order_id: string;
  tenant_id: string;
  customer_id: string;
  vehicle_id: string;
  issue_date: string;
  due_date: string;
  labor_total: number;
  parts_total: number;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  balance: number;
  status: 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled';
  created_at: string;
  updated_at: string;
}

// ────────────────────────────────────────────────────────────────────────────
// ACTION RESULT TYPES
// ────────────────────────────────────────────────────────────────────────────

export interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
