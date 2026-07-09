/**
 * @fileoverview Inventory Reorder Rules
 * 
 * Rules for automatic reorder decisions based on stock levels,
 * demand trends, seasonality, and supplier lead time.
 * 
 * **Priority Range:** 400-440 (Reorder category)
 * 
 * **Rule Execution Order:**
 * 1. Critical Stock Alert (400) - Urgent reorder at 10% stock
 * 2. Standard Reorder (410) - Normal reorder at 30% stock
 * 3. High Demand Adjustment (420) - Increase quantity for trending demand
 * 4. Seasonal Buffer (430) - Build stock buffer for peak season
 * 5. Supplier Lead Time (440) - Adjust timing based on lead time
 * 
 * @module decision-engine/providers/inventory/rules/reorder
 */

import type { Rule } from '@/lib/decision-engine/types';
import { INVENTORY_THRESHOLDS } from '../types';

/**
 * Rule 1: Critical Stock Alert
 * 
 * **Priority:** 400 (highest in reorder category)
 * 
 * **Trigger:** Stock below 10% of max capacity
 * 
 * **Action:** Urgent reorder with 3x normal quantity
 * 
 * **Business Logic:**
 * - Prevents stockouts for critical products
 * - Orders enough to reach 80% capacity
 * - Marks as CRITICAL urgency
 */
export const criticalStockAlertRule: Rule = {
  id: 'inventory_reorder_critical_stock',
  name: 'Critical Stock Alert - Urgent Reorder',
  description: 'Trigger urgent reorder when stock falls below 10% of maximum capacity',
  priority: 400,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'decisionType',
        operator: 'equals',
        value: 'reorder',
      },
      {
        type: 'simple',
        field: 'stockPercentage',
        operator: 'lessThan',
        value: INVENTORY_THRESHOLDS.CRITICAL_STOCK_PERCENT,
      },
    ],
  },
  action: {
    type: 'modify',
    data: {
      shouldReorder: true,
      urgency: 'critical',
      reorderQuantity: 'TARGET_80_PERCENT', // Calculate: (maxStock * 0.8) - currentStock
      reason: 'Stock critically low (<10%). Immediate reorder required to prevent stockout.',
      daysOfCoverage: 'BASED_ON_DEMAND', // Calculate: reorderQuantity / avgDailyDemand
    },
    message: 'Critical stock level detected. Urgent reorder recommended.',
  },
  metadata: {
    category: 'reorder',
    tags: ['critical', 'stockout-prevention', 'urgent'],
    businessImpact: 'high',
    automatable: true,
  },
};

/**
 * Rule 2: Standard Reorder Point
 * 
 * **Priority:** 410
 * 
 * **Trigger:** Stock below 30% of max capacity (and above 10%)
 * 
 * **Action:** Normal reorder with 2x normal quantity
 * 
 * **Business Logic:**
 * - Standard reorder trigger
 * - Orders enough to reach 70% capacity
 * - Marks as NORMAL urgency
 */
export const standardReorderRule: Rule = {
  id: 'inventory_reorder_standard',
  name: 'Standard Reorder Point',
  description: 'Trigger normal reorder when stock falls below 30% of maximum capacity',
  priority: 410,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'decisionType',
        operator: 'equals',
        value: 'reorder',
      },
      {
        type: 'simple',
        field: 'stockPercentage',
        operator: 'lessThan',
        value: INVENTORY_THRESHOLDS.REORDER_POINT_PERCENT,
      },
      {
        type: 'simple',
        field: 'stockPercentage',
        operator: 'greaterThanOrEqual',
        value: INVENTORY_THRESHOLDS.CRITICAL_STOCK_PERCENT,
      },
    ],
  },
  action: {
    type: 'modify',
    data: {
      shouldReorder: true,
      urgency: 'normal',
      reorderQuantity: 'TARGET_70_PERCENT', // Calculate: (maxStock * 0.7) - currentStock
      reason: 'Stock below reorder point (30%). Normal reorder recommended.',
      daysOfCoverage: 'BASED_ON_DEMAND',
    },
    message: 'Reorder point reached. Normal reorder recommended.',
  },
  metadata: {
    category: 'reorder',
    tags: ['standard', 'replenishment', 'normal-priority'],
    businessImpact: 'medium',
    automatable: true,
  },
};

/**
 * Rule 3: High Demand Adjustment
 * 
 * **Priority:** 420
 * 
 * **Trigger:** Demand trending up by 20%+ AND stock below 50%
 * 
 * **Action:** Increase reorder quantity by 50%
 * 
 * **Business Logic:**
 * - Adjusts reorder quantity for increasing demand
 * - Prevents stockout during demand spike
 * - Applies 1.5x multiplier to standard reorder quantity
 */
export const highDemandAdjustmentRule: Rule = {
  id: 'inventory_reorder_high_demand',
  name: 'High Demand Adjustment',
  description: 'Increase reorder quantity when demand is trending upward',
  priority: 420,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'decisionType',
        operator: 'equals',
        value: 'reorder',
      },
      {
        type: 'simple',
        field: 'isDemandIncreasing',
        operator: 'equals',
        value: true,
      },
      {
        type: 'simple',
        field: 'stockPercentage',
        operator: 'lessThan',
        value: 0.50, // Below 50% stock
      },
    ],
  },
  action: {
    type: 'modify',
    data: {
      quantityMultiplier: 1.5, // 50% increase
      urgency: 'high',
      reason: 'Demand trending up. Increased reorder quantity to prevent stockout during demand spike.',
    },
    message: 'High demand detected. Reorder quantity increased by 50%.',
  },
  metadata: {
    category: 'reorder',
    tags: ['demand-forecast', 'adjustment', 'high-priority'],
    businessImpact: 'high',
    automatable: true,
    requiresBIIntegration: true,
  },
};

/**
 * Rule 4: Seasonal Buffer
 * 
 * **Priority:** 430
 * 
 * **Trigger:** Peak season approaching (seasonality factor > 1.3) AND stock below 60%
 * 
 * **Action:** Build stock buffer to 90% capacity
 * 
 * **Business Logic:**
 * - Prepares for peak season demand
 * - Builds extra buffer to handle volume
 * - Orders to reach 90% capacity (vs normal 70%)
 */
export const seasonalBufferRule: Rule = {
  id: 'inventory_reorder_seasonal_buffer',
  name: 'Seasonal Buffer - Peak Season Preparation',
  description: 'Build extra stock buffer when peak season is approaching',
  priority: 430,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'decisionType',
        operator: 'equals',
        value: 'reorder',
      },
      {
        type: 'simple',
        field: 'isPeakSeason',
        operator: 'equals',
        value: true,
      },
      {
        type: 'simple',
        field: 'stockPercentage',
        operator: 'lessThan',
        value: 0.60, // Below 60% stock
      },
    ],
  },
  action: {
    type: 'modify',
    data: {
      shouldReorder: true,
      urgency: 'high',
      reorderQuantity: 'TARGET_90_PERCENT', // Calculate: (maxStock * 0.9) - currentStock
      reason: 'Peak season approaching. Building stock buffer to handle increased demand.',
      daysOfCoverage: 'BASED_ON_PEAK_DEMAND', // Use seasonality factor
    },
    message: 'Peak season detected. Building stock buffer to 90% capacity.',
  },
  metadata: {
    category: 'reorder',
    tags: ['seasonal', 'peak-season', 'buffer-stock'],
    businessImpact: 'high',
    automatable: true,
    requiresBIIntegration: true,
  },
};

/**
 * Rule 5: Supplier Lead Time Adjustment
 * 
 * **Priority:** 440
 * 
 * **Trigger:** Days of stock remaining < supplier lead time
 * 
 * **Action:** Advance reorder date to account for lead time
 * 
 * **Business Logic:**
 * - Prevents stockout due to supplier delay
 * - Orders early when lead time is long
 * - Calculates optimal order date: today + (daysRemaining - leadTime)
 */
export const supplierLeadTimeRule: Rule = {
  id: 'inventory_reorder_lead_time',
  name: 'Supplier Lead Time Adjustment',
  description: 'Advance reorder timing to account for supplier lead time',
  priority: 440,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'decisionType',
        operator: 'equals',
        value: 'reorder',
      },
      {
        type: 'simple',
        field: 'daysOfStockRemaining',
        operator: 'lessThan',
        value: 'SUPPLIER_LEAD_TIME', // Dynamic: productStock.supplierLeadTime
      },
    ],
  },
  action: {
    type: 'modify',
    data: {
      shouldReorder: true,
      urgency: 'high',
      recommendedOrderDate: 'CALCULATE_WITH_LEAD_TIME', // today + max(0, daysRemaining - leadTime)
      reason: 'Stock will run out before supplier delivery. Order immediately to account for lead time.',
    },
    message: 'Supplier lead time requires early order. Reorder recommended now.',
  },
  metadata: {
    category: 'reorder',
    tags: ['lead-time', 'supplier', 'timing'],
    businessImpact: 'high',
    automatable: true,
  },
};

/**
 * All Reorder Rules (sorted by priority)
 */
export const reorderRules: Rule[] = [
  criticalStockAlertRule,
  standardReorderRule,
  highDemandAdjustmentRule,
  seasonalBufferRule,
  supplierLeadTimeRule,
];

