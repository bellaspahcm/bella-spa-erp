/**
 * @fileoverview Commission Calculation Business Logic Engine
 * 
 * Central engine for calculating commissions in the Bella ERP system.
 * Supports flexible commission input (fixed amount OR percentage),
 * position-based multipliers, seniority bonuses, and manual adjustments.
 * 
 * @module lib/business-rules/commission
 * @see {@link docs/INDUSTRY_MODULE_DEVELOPMENT_PLAYBOOK.md} for module development guidelines
 */

import { BUSINESS_RULES } from '@bella/shared';

/**
 * Commission input type: fixed amount or percentage
 */
export type CommissionType = 'fixed' | 'percentage';

/**
 * Position tier for commission multipliers
 */
export type PositionTier = 'junior' | 'senior' | 'lead';

/**
 * Commission configuration from tenant settings
 */
export interface CommissionConfig {
  service_commission_default?: {
    type: CommissionType;
    value: number;
  };
  product_sales_commission_default?: {
    type: CommissionType;
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

/**
 * Commission calculation input for service items
 */
export interface ServiceCommissionInput {
  subtotal: number;
  overrideType?: CommissionType | null;
  overrideValue?: number | null;
  defaultType?: CommissionType;
  defaultValue?: number;
}

/**
 * Commission calculation input for product sales
 */
export interface ProductSalesCommissionInput {
  totalSalesAmount: number;
  overrideType?: CommissionType | null;
  overrideValue?: number | null;
  defaultType?: CommissionType;
  defaultValue?: number;
}

/**
 * Position bonus calculation input
 */
export interface PositionBonusInput {
  baseCommission: number;
  positionTier: PositionTier;
  multipliers?: {
    junior: number;
    senior: number;
    lead: number;
  };
}

/**
 * Seniority bonus calculation input
 */
export interface SeniorityBonusInput {
  baseSalary: number;
  hireDate?: Date | string | null;
  bonusRates?: {
    '0_to_1_year': number;
    '1_to_3_years': number;
    '3_to_5_years': number;
    '5_plus_years': number;
  };
}

/**
 * Manual adjustments aggregation input
 */
export interface ManualAdjustmentsInput {
  adjustments: Array<{
    adjustment_type: 'bonus' | 'deduction';
    amount: number;
    status: string;
  }>;
}

/**
 * Default commission configuration constants
 */
export const DEFAULT_COMMISSION_CONFIG: Required<CommissionConfig> = {
  service_commission_default: {
    type: 'fixed',
    value: 150000, // 150,000 VND per service
  },
  product_sales_commission_default: {
    type: 'percentage',
    value: 10, // 10% of sales amount
  },
  position_multipliers: {
    junior: 1.0,  // Baseline
    senior: 1.2,  // 20% higher
    lead: 1.5,    // 50% higher
  },
  seniority_bonus_rates: {
    '0_to_1_year': 0.00,   // 0% bonus
    '1_to_3_years': 0.05,  // 5% bonus
    '3_to_5_years': 0.10,  // 10% bonus
    '5_plus_years': 0.15,  // 15% bonus
  },
};

/**
 * Converts a value to a finite number with fallback.
 * 
 * @param value - Value to convert (number, string, null, or undefined)
 * @param fallback - Fallback value if conversion fails (default: 0)
 * @returns Finite number or fallback
 * 
 * @example
 * ```typescript
 * asFiniteNumber('1000') // 1000
 * asFiniteNumber(null, 100) // 100
 * asFiniteNumber('invalid', 50) // 50
 * asFiniteNumber(NaN) // 0
 * ```
 */
function asFiniteNumber(value: number | string | null | undefined, fallback = 0): number {
  const numeric = Number(value ?? fallback);
  return Number.isFinite(numeric) ? numeric : fallback;
}

/**
 * Parses commission input (type + value) and returns the commission amount.
 * 
 * Supports two input modes:
 * - Fixed amount: Returns the value directly (e.g., 150000 VND)
 * - Percentage: Calculates percentage of base amount (e.g., 10% of 1000000 = 100000)
 * 
 * @param type - Commission type: 'fixed' or 'percentage'
 * @param value - Commission value (amount in VND or percentage 0-100)
 * @param baseAmount - Base amount for percentage calculation (e.g., service subtotal or sales amount)
 * @returns Calculated commission in VND
 * 
 * @example
 * ```typescript
 * parseCommissionInput('fixed', 150000, 0) // 150000 VND (fixed amount)
 * parseCommissionInput('percentage', 10, 1000000) // 100000 VND (10% of 1M)
 * parseCommissionInput('percentage', 15.5, 500000) // 77500 VND (15.5% of 500k)
 * ```
 */
export function parseCommissionInput(
  type: CommissionType,
  value: number,
  baseAmount: number
): number {
  if (type === 'fixed') {
    return Math.max(0, asFiniteNumber(value));
  }
  
  if (type === 'percentage') {
    const percentage = asFiniteNumber(value);
    const clampedPercentage = Math.max(0, Math.min(100, percentage));
    return Math.round((clampedPercentage / 100) * asFiniteNumber(baseAmount));
  }
  
  return 0;
}

/**
 * Calculates commission for a service item.
 * 
 * Uses override commission if provided, otherwise falls back to tenant default configuration.
 * 
 * **Priority:**
 * 1. Override commission (transaction-level)
 * 2. Tenant default commission (tenant-level config)
 * 3. System default (150,000 VND fixed)
 * 
 * @param input - Service commission input with subtotal and override/default settings
 * @returns Calculated commission in VND
 * 
 * @example
 * ```typescript
 * // Override with fixed amount
 * calculateServiceCommission({
 *   subtotal: 500000,
 *   overrideType: 'fixed',
 *   overrideValue: 200000
 * }) // 200000 VND
 * 
 * // Override with percentage
 * calculateServiceCommission({
 *   subtotal: 1000000,
 *   overrideType: 'percentage',
 *   overrideValue: 15
 * }) // 150000 VND (15% of 1M)
 * 
 * // Use tenant default
 * calculateServiceCommission({
 *   subtotal: 800000,
 *   defaultType: 'fixed',
 *   defaultValue: 150000
 * }) // 150000 VND
 * 
 * // Use system default (no override or tenant default)
 * calculateServiceCommission({
 *   subtotal: 600000
 * }) // 150000 VND (system default)
 * ```
 */
export function calculateServiceCommission(input: ServiceCommissionInput): number {
  // Priority 1: Override commission
  if (input.overrideType && input.overrideValue !== null && input.overrideValue !== undefined) {
    return parseCommissionInput(input.overrideType, input.overrideValue, input.subtotal);
  }
  
  // Priority 2: Tenant default commission
  if (input.defaultType && input.defaultValue !== null && input.defaultValue !== undefined) {
    return parseCommissionInput(input.defaultType, input.defaultValue, input.subtotal);
  }
  
  // Priority 3: System default (150,000 VND fixed)
  return parseCommissionInput(
    DEFAULT_COMMISSION_CONFIG.service_commission_default.type,
    DEFAULT_COMMISSION_CONFIG.service_commission_default.value,
    input.subtotal
  );
}

/**
 * Calculates commission for product sales.
 * 
 * Uses override commission if provided, otherwise falls back to tenant default configuration.
 * 
 * **Priority:**
 * 1. Override commission (transaction-level)
 * 2. Tenant default commission (tenant-level config)
 * 3. System default (10% of sales amount)
 * 
 * @param input - Product sales commission input with sales amount and override/default settings
 * @returns Calculated commission in VND
 * 
 * @example
 * ```typescript
 * // Override with fixed amount
 * calculateProductSalesCommission({
 *   totalSalesAmount: 2000000,
 *   overrideType: 'fixed',
 *   overrideValue: 50000
 * }) // 50000 VND
 * 
 * // Override with percentage
 * calculateProductSalesCommission({
 *   totalSalesAmount: 1000000,
 *   overrideType: 'percentage',
 *   overrideValue: 15
 * }) // 150000 VND (15% of 1M)
 * 
 * // Use tenant default
 * calculateProductSalesCommission({
 *   totalSalesAmount: 800000,
 *   defaultType: 'percentage',
 *   defaultValue: 12
 * }) // 96000 VND (12% of 800k)
 * 
 * // Use system default (10% percentage)
 * calculateProductSalesCommission({
 *   totalSalesAmount: 500000
 * }) // 50000 VND (10% of 500k)
 * ```
 */
export function calculateProductSalesCommission(input: ProductSalesCommissionInput): number {
  // Priority 1: Override commission
  if (input.overrideType && input.overrideValue !== null && input.overrideValue !== undefined) {
    return parseCommissionInput(input.overrideType, input.overrideValue, input.totalSalesAmount);
  }
  
  // Priority 2: Tenant default commission
  if (input.defaultType && input.defaultValue !== null && input.defaultValue !== undefined) {
    return parseCommissionInput(input.defaultType, input.defaultValue, input.totalSalesAmount);
  }
  
  // Priority 3: System default (10% of sales)
  return parseCommissionInput(
    DEFAULT_COMMISSION_CONFIG.product_sales_commission_default.type,
    DEFAULT_COMMISSION_CONFIG.product_sales_commission_default.value,
    input.totalSalesAmount
  );
}

/**
 * Calculates position bonus based on position tier multiplier.
 * 
 * Applies a multiplier to the base commission based on the KTV's position tier.
 * 
 * **Position Tiers:**
 * - Junior (Nhân viên mới): 1.0x (baseline, no bonus)
 * - Senior (Nhân viên chính thức): 1.2x (20% higher)
 * - Lead (Trưởng ca): 1.5x (50% higher)
 * 
 * **Formula:**
 * ```
 * position_bonus = base_commission × (multiplier - 1.0)
 * ```
 * 
 * @param input - Position bonus input with base commission and position tier
 * @returns Position bonus amount in VND
 * 
 * @example
 * ```typescript
 * // Junior KTV (no bonus)
 * calculatePositionBonus({
 *   baseCommission: 1000000,
 *   positionTier: 'junior'
 * }) // 0 VND (1.0x - 1.0 = 0)
 * 
 * // Senior KTV (20% bonus)
 * calculatePositionBonus({
 *   baseCommission: 1000000,
 *   positionTier: 'senior'
 * }) // 200000 VND (1.2x - 1.0 = 0.2, 1M × 0.2 = 200k)
 * 
 * // Lead KTV (50% bonus)
 * calculatePositionBonus({
 *   baseCommission: 1000000,
 *   positionTier: 'lead'
 * }) // 500000 VND (1.5x - 1.0 = 0.5, 1M × 0.5 = 500k)
 * ```
 */
export function calculatePositionBonus(input: PositionBonusInput): number {
  const multipliers = input.multipliers || DEFAULT_COMMISSION_CONFIG.position_multipliers;
  const multiplier = multipliers[input.positionTier] || 1.0;
  
  // Position bonus is the additional amount above baseline (1.0x)
  const bonusRate = Math.max(0, multiplier - 1.0);
  return Math.round(asFiniteNumber(input.baseCommission) * bonusRate);
}

/**
 * Calculates years of service from hire date.
 * 
 * @param hireDate - Employee hire date
 * @returns Years of service (can be decimal, e.g., 2.5 years)
 * 
 * @example
 * ```typescript
 * calculateYearsOfService(new Date('2023-01-01')) // ~3.5 years (as of 2026-06-22)
 * calculateYearsOfService('2025-06-01') // ~1.0 year
 * calculateYearsOfService(null) // 0
 * ```
 */
export function calculateYearsOfService(hireDate?: Date | string | null): number {
  if (!hireDate) return 0;
  
  const hire = new Date(hireDate);
  const now = new Date();
  
  if (isNaN(hire.getTime())) return 0;
  
  const diffMs = now.getTime() - hire.getTime();
  const diffYears = diffMs / (1000 * 60 * 60 * 24 * 365.25);
  
  return Math.max(0, diffYears);
}

/**
 * Gets seniority bonus rate based on years of service.
 * 
 * **Bonus Tiers:**
 * - 0-1 year: 0% (no bonus)
 * - 1-3 years: 5%
 * - 3-5 years: 10%
 * - 5+ years: 15%
 * 
 * @param yearsOfService - Years of service
 * @param bonusRates - Custom bonus rates (optional, uses system default if not provided)
 * @returns Seniority bonus rate (0.0-0.15)
 * 
 * @example
 * ```typescript
 * getSeniorityBonusRate(0.5) // 0.00 (no bonus)
 * getSeniorityBonusRate(2.0) // 0.05 (5% bonus)
 * getSeniorityBonusRate(4.0) // 0.10 (10% bonus)
 * getSeniorityBonusRate(6.0) // 0.15 (15% bonus)
 * ```
 */
export function getSeniorityBonusRate(
  yearsOfService: number,
  bonusRates?: CommissionConfig['seniority_bonus_rates']
): number {
  const rates = bonusRates || DEFAULT_COMMISSION_CONFIG.seniority_bonus_rates;
  
  if (yearsOfService >= 5) return rates['5_plus_years'];
  if (yearsOfService >= 3) return rates['3_to_5_years'];
  if (yearsOfService >= 1) return rates['1_to_3_years'];
  return rates['0_to_1_year'];
}

/**
 * Calculates seniority bonus based on years of service.
 * 
 * Applies a percentage bonus to the base salary based on tenure.
 * 
 * **Formula:**
 * ```
 * seniority_bonus = base_salary × bonus_rate
 * ```
 * 
 * @param input - Seniority bonus input with base salary and hire date
 * @returns Seniority bonus amount in VND
 * 
 * @example
 * ```typescript
 * // New employee (< 1 year)
 * calculateSeniorityBonus({
 *   baseSalary: 6000000,
 *   hireDate: new Date('2026-01-01')
 * }) // 0 VND (0% bonus)
 * 
 * // 2 years experience (1-3 years tier)
 * calculateSeniorityBonus({
 *   baseSalary: 6000000,
 *   hireDate: new Date('2024-06-01')
 * }) // 300000 VND (5% of 6M)
 * 
 * // 4 years experience (3-5 years tier)
 * calculateSeniorityBonus({
 *   baseSalary: 6000000,
 *   hireDate: new Date('2022-06-01')
 * }) // 600000 VND (10% of 6M)
 * 
 * // 6+ years experience (5+ years tier)
 * calculateSeniorityBonus({
 *   baseSalary: 6000000,
 *   hireDate: new Date('2020-01-01')
 * }) // 900000 VND (15% of 6M)
 * ```
 */
export function calculateSeniorityBonus(input: SeniorityBonusInput): number {
  if (!input.hireDate) return 0;
  
  const yearsOfService = calculateYearsOfService(input.hireDate);
  const bonusRate = getSeniorityBonusRate(yearsOfService, input.bonusRates);
  
  return Math.round(asFiniteNumber(input.baseSalary) * bonusRate);
}

/**
 * Aggregates manual adjustments (bonuses and deductions) into net amount.
 * 
 * Only includes adjustments with status = 'approved'.
 * 
 * **Formula:**
 * ```
 * net_adjustments = SUM(bonuses) - SUM(deductions)
 * ```
 * 
 * @param input - Manual adjustments input with array of adjustments
 * @returns Net manual adjustments amount in VND (can be positive or negative)
 * 
 * @example
 * ```typescript
 * aggregateManualAdjustments({
 *   adjustments: [
 *     { adjustment_type: 'bonus', amount: 500000, status: 'approved' },
 *     { adjustment_type: 'bonus', amount: 200000, status: 'approved' },
 *     { adjustment_type: 'deduction', amount: 100000, status: 'approved' },
 *     { adjustment_type: 'bonus', amount: 300000, status: 'draft' } // Ignored
 *   ]
 * }) // 600000 VND (500k + 200k - 100k, draft ignored)
 * 
 * aggregateManualAdjustments({
 *   adjustments: [
 *     { adjustment_type: 'deduction', amount: 500000, status: 'approved' },
 *     { adjustment_type: 'deduction', amount: 200000, status: 'approved' }
 *   ]
 * }) // -700000 VND (net deduction)
 * ```
 */
export function aggregateManualAdjustments(input: ManualAdjustmentsInput): number {
  let netAmount = 0;
  
  for (const adj of input.adjustments) {
    // Only include approved adjustments
    if (adj.status !== 'approved') continue;
    
    const amount = asFiniteNumber(adj.amount);
    
    if (adj.adjustment_type === 'bonus') {
      netAmount += amount;
    } else if (adj.adjustment_type === 'deduction') {
      netAmount -= amount;
    }
  }
  
  return netAmount;
}

/**
 * Calculates commission for multiple service items (bulk calculation).
 * 
 * @param items - Array of service commission inputs
 * @returns Total service commission in VND
 * 
 * @example
 * ```typescript
 * calculateBulkServiceCommission([
 *   { subtotal: 500000, overrideType: 'fixed', overrideValue: 150000 },
 *   { subtotal: 800000, overrideType: 'percentage', overrideValue: 10 },
 *   { subtotal: 600000 }
 * ]) // 150000 + 80000 + 150000 = 380000 VND
 * ```
 */
export function calculateBulkServiceCommission(items: ServiceCommissionInput[]): number {
  return items.reduce((total, item) => total + calculateServiceCommission(item), 0);
}

/**
 * Calculates commission for multiple product sales (bulk calculation).
 * 
 * @param sales - Array of product sales commission inputs
 * @returns Total product sales commission in VND
 * 
 * @example
 * ```typescript
 * calculateBulkProductSalesCommission([
 *   { totalSalesAmount: 1000000, overrideType: 'percentage', overrideValue: 10 },
 *   { totalSalesAmount: 500000, overrideType: 'fixed', overrideValue: 50000 },
 *   { totalSalesAmount: 800000 }
 * ]) // 100000 + 50000 + 80000 = 230000 VND
 * ```
 */
export function calculateBulkProductSalesCommission(sales: ProductSalesCommissionInput[]): number {
  return sales.reduce((total, sale) => total + calculateProductSalesCommission(sale), 0);
}
