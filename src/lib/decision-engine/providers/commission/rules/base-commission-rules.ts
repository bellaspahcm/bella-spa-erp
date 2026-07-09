/**
 * @fileoverview Base Commission Rules for CommissionProvider
 * 
 * Handles fundamental commission calculations for service items and product sales.
 * Supports two commission strategies:
 * - Fixed: Flat amount per transaction (e.g., 150,000đ per service)
 * - Percentage: Percentage of transaction value (e.g., 10% of sales)
 * 
 * Priority Range: 200-240
 * - Service Fixed: 200
 * - Service Percentage: 210
 * - Product Fixed: 220
 * - Product Percentage: 230
 * - Manual Override: 240 (highest priority, bypasses all other rules)
 * 
 * @module decision-engine/providers/commission/rules/base-commission-rules
 */

import type { Rule, RuleContext } from '@/lib/decision-engine/types/rule';
import type { CommissionDecisionInput } from '../types';

/**
 * Service Commission - Fixed Strategy
 * 
 * Applies a flat commission amount per service, regardless of service value.
 * 
 * **When to Use:**
 * - Standardized services with consistent commission
 * - Simple commission structure (no percentage calculation)
 * - Same commission for all service types
 * 
 * **Configuration:**
 * - `config.serviceCommissionFixed` (default: 150,000đ)
 * 
 * **Formula:**
 * ```
 * commission_per_service = serviceCommissionFixed
 * total_commission = count(service_items) × commission_per_service
 * ```
 * 
 * **Example:**
 * ```typescript
 * // Config: serviceCommissionFixed = 150,000đ
 * // Input: 5 service items
 * // Output: 5 × 150,000 = 750,000đ
 * ```
 * 
 * **Priority:** 200 (lowest in base commission - runs first if strategy = 'fixed')
 */
export const serviceCommissionFixedRule: Rule = {
  id: 'commission_service_fixed',
  name: 'Service Commission - Fixed Strategy',
  description: 'Applies fixed commission amount per service item',
  priority: 200,
  enabled: true,
  
  condition: (context: RuleContext): boolean => {
    const input = context.input as CommissionDecisionInput;
    
    // Rule matches if:
    // 1. Commission strategy is 'fixed'
    // 2. Has service items to calculate
    // 3. No manual override present (override takes priority)
    return (
      input.config?.commissionStrategy === 'fixed' &&
      Array.isArray(input.serviceItems) &&
      input.serviceItems.length > 0 &&
      !input.manualOverride
    );
  },
  
  action: (context: RuleContext): Record<string, unknown> => {
    const input = context.input as CommissionDecisionInput;
    const config = input.config;
    
    // Get fixed commission amount from config (default: 150,000đ)
    const fixedAmount = config.serviceCommissionFixed ?? 150_000;
    
    // Calculate total commission (count × fixed amount)
    let totalCommission = 0;
    
    for (const item of input.serviceItems) {
      // Check if item has override (takes precedence)
      if (item.overrideType === 'fixed' && item.overrideValue !== null) {
        totalCommission += item.overrideValue;
      } else {
        totalCommission += fixedAmount;
      }
    }
    
    return {
      serviceCommission: totalCommission,
      strategyUsed: 'fixed',
      itemCount: input.serviceItems.length,
      fixedAmountApplied: fixedAmount,
    };
  },
};

/**
 * Service Commission - Percentage Strategy
 * 
 * Calculates commission as a percentage of service subtotal.
 * 
 * **When to Use:**
 * - Variable-value services (spa packages, premium treatments)
 * - Commission proportional to service value
 * - Incentivize higher-value services
 * 
 * **Configuration:**
 * - `config.serviceCommissionRate` (default: 10%)
 * 
 * **Formula:**
 * ```
 * commission_per_service = subtotal × (rate / 100)
 * total_commission = SUM(service_items.commission)
 * ```
 * 
 * **Example:**
 * ```typescript
 * // Config: serviceCommissionRate = 10%
 * // Input: [
 * //   { subtotal: 1,000,000đ }, // → 100,000đ
 * //   { subtotal: 800,000đ }    // → 80,000đ
 * // ]
 * // Output: 100,000 + 80,000 = 180,000đ
 * ```
 * 
 * **Priority:** 210 (runs if strategy = 'percentage')
 */
export const serviceCommissionPercentageRule: Rule = {
  id: 'commission_service_percentage',
  name: 'Service Commission - Percentage Strategy',
  description: 'Calculates commission as percentage of service subtotal',
  priority: 210,
  enabled: true,
  
  condition: (context: RuleContext): boolean => {
    const input = context.input as CommissionDecisionInput;
    
    return (
      input.config?.commissionStrategy === 'percentage' &&
      Array.isArray(input.serviceItems) &&
      input.serviceItems.length > 0 &&
      !input.manualOverride
    );
  },
  
  action: (context: RuleContext): Record<string, unknown> => {
    const input = context.input as CommissionDecisionInput;
    const config = input.config;
    
    // Get percentage rate from config (default: 10%)
    const percentageRate = config.serviceCommissionRate ?? 10;
    
    // Calculate total commission (sum of percentages)
    let totalCommission = 0;
    
    for (const item of input.serviceItems) {
      const subtotal = item.subtotal ?? 0;
      
      // Check if item has override
      if (item.overrideType === 'percentage' && item.overrideValue !== null) {
        const overrideRate = item.overrideValue;
        totalCommission += Math.round((subtotal * overrideRate) / 100);
      } else {
        totalCommission += Math.round((subtotal * percentageRate) / 100);
      }
    }
    
    return {
      serviceCommission: totalCommission,
      strategyUsed: 'percentage',
      itemCount: input.serviceItems.length,
      percentageRateApplied: percentageRate,
    };
  },
};

/**
 * Product Sales Commission - Fixed Strategy
 * 
 * Applies a flat commission amount per product sale.
 * 
 * **When to Use:**
 * - Standard product commissions (retail products)
 * - Simple commission structure
 * - Same commission regardless of product value
 * 
 * **Configuration:**
 * - `config.productCommissionFixed` (default: 50,000đ)
 * 
 * **Formula:**
 * ```
 * commission_per_sale = productCommissionFixed
 * total_commission = count(product_sales) × commission_per_sale
 * ```
 * 
 * **Example:**
 * ```typescript
 * // Config: productCommissionFixed = 50,000đ
 * // Input: 3 product sales
 * // Output: 3 × 50,000 = 150,000đ
 * ```
 * 
 * **Priority:** 220
 */
export const productCommissionFixedRule: Rule = {
  id: 'commission_product_fixed',
  name: 'Product Sales Commission - Fixed Strategy',
  description: 'Applies fixed commission amount per product sale',
  priority: 220,
  enabled: true,
  
  condition: (context: RuleContext): boolean => {
    const input = context.input as CommissionDecisionInput;
    
    return (
      input.config?.commissionStrategy === 'fixed' &&
      Array.isArray(input.productSales) &&
      input.productSales.length > 0 &&
      !input.manualOverride
    );
  },
  
  action: (context: RuleContext): Record<string, unknown> => {
    const input = context.input as CommissionDecisionInput;
    const config = input.config;
    
    // Get fixed commission amount from config (default: 50,000đ)
    const fixedAmount = config.productCommissionFixed ?? 50_000;
    
    // Calculate total commission
    let totalCommission = 0;
    
    for (const sale of input.productSales) {
      // Check if sale has override
      if (sale.overrideType === 'fixed' && sale.overrideValue !== null) {
        totalCommission += sale.overrideValue;
      } else {
        totalCommission += fixedAmount;
      }
    }
    
    return {
      productSalesCommission: totalCommission,
      strategyUsed: 'fixed',
      saleCount: input.productSales.length,
      fixedAmountApplied: fixedAmount,
    };
  },
};

/**
 * Product Sales Commission - Percentage Strategy
 * 
 * Calculates commission as a percentage of product sales amount.
 * 
 * **When to Use:**
 * - High-value product sales
 * - Commission proportional to sales value
 * - Incentivize higher-value product sales
 * 
 * **Configuration:**
 * - `config.productCommissionRate` (default: 12%)
 * 
 * **Formula:**
 * ```
 * commission_per_sale = sales_amount × (rate / 100)
 * total_commission = SUM(product_sales.commission)
 * ```
 * 
 * **Example:**
 * ```typescript
 * // Config: productCommissionRate = 12%
 * // Input: [
 * //   { salesAmount: 2,000,000đ }, // → 240,000đ
 * //   { salesAmount: 1,500,000đ }  // → 180,000đ
 * // ]
 * // Output: 240,000 + 180,000 = 420,000đ
 * ```
 * 
 * **Priority:** 230
 */
export const productCommissionPercentageRule: Rule = {
  id: 'commission_product_percentage',
  name: 'Product Sales Commission - Percentage Strategy',
  description: 'Calculates commission as percentage of product sales amount',
  priority: 230,
  enabled: true,
  
  condition: (context: RuleContext): boolean => {
    const input = context.input as CommissionDecisionInput;
    
    return (
      input.config?.commissionStrategy === 'percentage' &&
      Array.isArray(input.productSales) &&
      input.productSales.length > 0 &&
      !input.manualOverride
    );
  },
  
  action: (context: RuleContext): Record<string, unknown> => {
    const input = context.input as CommissionDecisionInput;
    const config = input.config;
    
    // Get percentage rate from config (default: 12%)
    const percentageRate = config.productCommissionRate ?? 12;
    
    // Calculate total commission
    let totalCommission = 0;
    
    for (const sale of input.productSales) {
      const salesAmount = sale.salesAmount ?? 0;
      
      // Check if sale has override
      if (sale.overrideType === 'percentage' && sale.overrideValue !== null) {
        const overrideRate = sale.overrideValue;
        totalCommission += Math.round((salesAmount * overrideRate) / 100);
      } else {
        totalCommission += Math.round((salesAmount * percentageRate) / 100);
      }
    }
    
    return {
      productSalesCommission: totalCommission,
      strategyUsed: 'percentage',
      saleCount: input.productSales.length,
      percentageRateApplied: percentageRate,
    };
  },
};

/**
 * Manual Override Commission
 * 
 * Allows admin to manually override commission calculation with a fixed amount.
 * 
 * **When to Use:**
 * - Special cases requiring manual adjustment
 * - Disputes or corrections
 * - Exceptional circumstances (promotions, bonuses, penalties)
 * 
 * **Priority:** 240 (HIGHEST - bypasses all other base commission rules)
 * 
 * **Example:**
 * ```typescript
 * // Admin sets manual override: 500,000đ
 * // All other rules are skipped
 * // Output: 500,000đ total commission
 * ```
 * 
 * **Note:** Manual override ONLY affects base commission.
 * Volume/performance multipliers and bonuses still apply.
 */
export const manualOverrideCommissionRule: Rule = {
  id: 'commission_manual_override',
  name: 'Manual Override Commission',
  description: 'Admin manual override bypasses automatic commission calculation',
  priority: 240,
  enabled: true,
  
  condition: (context: RuleContext): boolean => {
    const input = context.input as CommissionDecisionInput;
    
    // Rule matches if manual override is present
    return (
      input.manualOverride !== null &&
      input.manualOverride !== undefined &&
      typeof input.manualOverride === 'number'
    );
  },
  
  action: (context: RuleContext): Record<string, unknown> => {
    const input = context.input as CommissionDecisionInput;
    
    return {
      baseCommission: input.manualOverride,
      strategyUsed: 'manual_override',
      overrideReason: input.manualOverrideReason || 'Admin manual adjustment',
      overrideBy: input.manualOverrideBy || 'system',
    };
  },
};
