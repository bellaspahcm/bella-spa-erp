/**
 * @fileoverview Inventory Expiry Management Rules
 * 
 * Rules for managing product expiry lifecycle:
 * - FEFO (First Expiry First Out) prioritization
 * - Discount triggers for near-expiry products
 * - Write-off decisions for expired products
 * 
 * **Priority Range:** 490-510 (Expiry category)
 * 
 * **Rule Execution Order:**
 * 1. FEFO Priority (490) - Use products closest to expiry first
 * 2. Discount Trigger (500) - Apply discount when <30 days to expiry
 * 3. Write-off Decision (510) - Write off expired or damaged products
 * 
 * @module decision-engine/providers/inventory/rules/expiry
 */

import type { Rule } from '@/lib/decision-engine/types';
import { INVENTORY_THRESHOLDS } from '../types';

/**
 * Rule 10: FEFO Priority - Use Nearest Expiry First
 * 
 * **Priority:** 490 (highest in expiry category)
 * 
 * **Trigger:** Product with expiry date exists + normal usage
 * 
 * **Action:** Allocate products with nearest expiry first
 * 
 * **Business Logic:**
 * - FEFO (First Expiry First Out) inventory rotation
 * - Prevents waste from expired products
 * - Applies to all perishable inventory
 * - No discount needed if >30 days to expiry
 */
export const fefoPriorityRule: Rule = {
  id: 'inventory_expiry_fefo_priority',
  name: 'FEFO Priority - First Expiry First Out',
  description: 'Prioritize using products closest to expiry date to minimize waste',
  priority: 490,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'decisionType',
        operator: 'equals',
        value: 'expiry',
      },
      {
        type: 'simple',
        field: 'productStock.daysUntilExpiry',
        operator: 'greaterThan',
        value: INVENTORY_THRESHOLDS.EXPIRY_WARNING_DAYS, // >30 days
      },
    ],
  },
  action: {
    type: 'modify',
    data: {
      action: 'use_first',
      priority: 'normal',
      shouldAlert: false,
      reason: 'Normal FEFO rotation. Use products in expiry date order.',
      valueImpact: 0, // No discount or write-off
      daysUntilAction: 'DAYS_UNTIL_EXPIRY',
    },
    message: 'FEFO priority applied. Use nearest expiry products first.',
  },
  metadata: {
    category: 'expiry',
    tags: ['fefo', 'rotation', 'waste-prevention'],
    businessImpact: 'medium',
    automatable: true,
  },
};

/**
 * Rule 11: Discount Trigger - Near Expiry Warning
 * 
 * **Priority:** 500
 * 
 * **Trigger:** Product expiring within 30 days
 * 
 * **Action:** Apply discount to accelerate sales
 * 
 * **Business Logic:**
 * - Trigger discount when <30 days to expiry
 * - Discount scales with urgency:
 *   - 15-30 days: 10% discount
 *   - 7-14 days: 20% discount
 *   - <7 days: 30% discount
 * - Alert manager for approval
 * - Track value impact (discount loss)
 */
export const discountTriggerRule: Rule = {
  id: 'inventory_expiry_discount_trigger',
  name: 'Discount Trigger - Near Expiry Products',
  description: 'Apply discount to products approaching expiry to accelerate sales',
  priority: 500,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'decisionType',
        operator: 'equals',
        value: 'expiry',
      },
      {
        type: 'simple',
        field: 'productStock.daysUntilExpiry',
        operator: 'lessThanOrEqual',
        value: INVENTORY_THRESHOLDS.EXPIRY_WARNING_DAYS, // ≤30 days
      },
      {
        type: 'simple',
        field: 'productStock.daysUntilExpiry',
        operator: 'greaterThan',
        value: 0, // Not yet expired
      },
    ],
  },
  action: {
    type: 'modify',
    data: {
      action: 'discount',
      discountPercentage: 'CALCULATE_BY_EXPIRY', // Sliding scale: 10-30%
      shouldAlert: true,
      alertUrgency: 'BASED_ON_DAYS', // medium (15-30d), high (7-14d), critical (<7d)
      reason: 'Product approaching expiry. Discount applied to accelerate sales and minimize waste.',
      valueImpact: 'CALCULATE_DISCOUNT_LOSS', // (currentStock × unitCost × discountPercentage)
      daysUntilAction: 'DAYS_UNTIL_EXPIRY',
    },
    message: 'Near-expiry discount applied. Manager approval may be required.',
  },
  metadata: {
    category: 'expiry',
    tags: ['discount', 'near-expiry', 'waste-reduction'],
    businessImpact: 'high',
    automatable: false, // Requires manager approval for discount
    discountScale: {
      '15-30_days': 0.10, // 10% discount
      '7-14_days': 0.20,  // 20% discount
      '<7_days': 0.30,    // 30% discount
    },
  },
};

/**
 * Rule 12: Write-off Decision - Expired or Damaged
 * 
 * **Priority:** 510
 * 
 * **Trigger:** Product expired (days until expiry ≤ 0) OR damaged
 * 
 * **Action:** Write off product and remove from inventory
 * 
 * **Business Logic:**
 * - Automatic write-off for expired products
 * - Cannot be sold or used
 * - Track value loss for accounting
 * - Alert manager for review and approval
 * - Update inventory immediately
 */
export const writeOffDecisionRule: Rule = {
  id: 'inventory_expiry_write_off',
  name: 'Write-off Decision - Expired Products',
  description: 'Write off expired or damaged products and remove from inventory',
  priority: 510,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'decisionType',
        operator: 'equals',
        value: 'expiry',
      },
      {
        type: 'simple',
        field: 'productStock.daysUntilExpiry',
        operator: 'lessThanOrEqual',
        value: 0, // Expired
      },
    ],
  },
  action: {
    type: 'modify',
    data: {
      action: 'write_off',
      shouldAlert: true,
      alertUrgency: 'high',
      reason: 'Product expired. Write-off required. Remove from inventory immediately.',
      valueImpact: 'CALCULATE_WRITE_OFF_LOSS', // currentStock × unitCost
      daysUntilAction: 0, // Immediate action required
      accountingAction: 'CREATE_WRITE_OFF_EXPENSE', // Create expense entry for accounting
    },
    message: 'Expired product detected. Write-off and accounting entry required.',
  },
  metadata: {
    category: 'expiry',
    tags: ['write-off', 'expired', 'accounting', 'waste'],
    businessImpact: 'high',
    automatable: false, // Requires manager approval and accounting entry
  },
};

/**
 * All Expiry Rules (sorted by priority)
 */
export const expiryRules: Rule[] = [
  fefoPriorityRule,
  discountTriggerRule,
  writeOffDecisionRule,
];

