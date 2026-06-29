/**
 * Commission System Type Definitions
 * 
 * These types supplement database.types.ts for commission system tables
 * until database types are regenerated from Supabase.
 * 
 * TODO: Remove this file after running `npm run generate-types` to sync with Supabase
 */

export interface BookingServiceItem {
  id: string;
  booking_id: string;
  tenant_id: string;
  ktv_id: string | null;
  service_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  override_commission_type: 'fixed' | 'percentage' | null;
  override_commission_value: number | null;
  calculated_commission: number;
  status: 'pending' | 'completed' | 'cancelled';
  completed_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductSale {
  id: string;
  booking_id: string;
  tenant_id: string;
  ktv_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  override_commission_type: 'fixed' | 'percentage' | null;
  override_commission_value: number | null;
  calculated_commission: number;
  sale_date: string;
  created_at: string;
  updated_at: string;
}

export interface SalaryAdjustment {
  id: string;
  salary_record_id: string;
  tenant_id: string;
  adjustment_type: 'bonus' | 'deduction' | 'allowance' | 'reimbursement';
  category: string;
  amount: number;
  reason: string | null;
  approved_by_id: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommissionConfig {
  service_commission_default?: {
    type: 'fixed' | 'percentage';
    value: number;
  };
  product_sales_commission_default?: {
    type: 'fixed' | 'percentage';
    value: number;
  };
  position_multipliers?: {
    junior: number;
    senior: number;
    lead: number;
  };
  seniority_bonus_rates?: {
    '0_to_1_year': number;
    '1_to_3_years': number;
    '3_to_5_years': number;
    '5_plus_years': number;
  };
}

export interface TenantWithCommissionConfig {
  id: string;
  name: string;
  commission_config: CommissionConfig | null;
}

export interface UserWithPositionTier {
  id: string;
  full_name: string;
  position_tier: 'junior' | 'senior' | 'lead' | null;
  hire_date: string | null;
}

export interface SalaryRecordWithCommission {
  id: string;
  user_id: string;
  tenant_id: string;
  month: string;
  base_salary: number;
  session_bonus: number;
  kpi_bonus: number;
  rating_bonus: number;
  violations_deduction: number;
  service_percentage_bonus: number;
  // New commission fields
  service_commission: number;
  product_sales_commission: number;
  position_bonus: number;
  seniority_bonus: number;
  manual_adjustments: number;
  total_salary: number;
  status: string;
  created_at: string;
  updated_at: string;
}
