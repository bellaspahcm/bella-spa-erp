/**
 * @fileoverview Inventory Rules - Central Export
 * 
 * Central export point for all inventory management rules.
 * 
 * **Rule Categories:**
 * 1. Reorder Rules (5 rules) - Priority: 400-440
 * 2. Allocation Rules (4 rules) - Priority: 450-480
 * 3. Expiry Rules (3 rules) - Priority: 490-510
 * 
 * **Total:** 12 rules across 3 categories
 * 
 * **Rule Priority Order:**
 * ```
 * 400-440: Reorder (critical stock, standard reorder, demand adjustment, seasonal, lead time)
 * 450-480: Allocation (VIP priority, standard, partial, transfer)
 * 490-510: Expiry (FEFO, discount, write-off)
 * ```
 * 
 * **Execution Flow:**
 * 
 * **Reorder Flow:**
 * 1. Check stock level → Critical (<10%) or Standard (<30%)?
 * 2. Check demand trend → Adjust quantity if trending up
 * 3. Check seasonality → Build buffer if peak season
 * 4. Check lead time → Advance order date if needed
 * 5. Return reorder decision (shouldReorder, quantity, urgency, date)
 * 
 * **Allocation Flow:**
 * 1. Check customer tier → VIP priority or standard allocation?
 * 2. Check stock availability → Sufficient, partial, or transfer needed?
 * 3. Apply FEFO/freshest-first selection
 * 4. Reserve stock if confirmed booking
 * 5. Return allocation decision (canAllocate, quantity, priority, reservation)
 * 
 * **Expiry Flow:**
 * 1. Check days until expiry → >30 days, <30 days, or expired?
 * 2. Apply FEFO priority (>30 days)
 * 3. Apply discount trigger (<30 days)
 * 4. Apply write-off (expired)
 * 5. Return expiry decision (action, discount, alert, value impact)
 * 
 * @module decision-engine/providers/inventory/rules
 */

import type { Rule } from '@/lib/decision-engine/types';

// Reorder Rules (Priority: 400-440)
export {
  criticalStockAlertRule,
  standardReorderRule,
  highDemandAdjustmentRule,
  seasonalBufferRule,
  supplierLeadTimeRule,
  reorderRules,
} from './reorder-rules';

// Allocation Rules (Priority: 450-480)
export {
  vipPriorityAllocationRule,
  standardAllocationRule,
  partialAllocationRule,
  transferDecisionRule,
  allocationRules,
} from './allocation-rules';

// Expiry Rules (Priority: 490-510)
export {
  fefoPriorityRule,
  discountTriggerRule,
  writeOffDecisionRule,
  expiryRules,
} from './expiry-rules';

/**
 * All Inventory Rules (for provider initialization)
 */
import { reorderRules } from './reorder-rules';
import { allocationRules } from './allocation-rules';
import { expiryRules } from './expiry-rules';

export const allInventoryRules: Rule[] = [
  ...reorderRules,
  ...allocationRules,
  ...expiryRules,
].sort((a, b) => a.priority - b.priority);

/**
 * Inventory rules grouped by category
 */
export const inventoryRulesByCategory = {
  reorder: reorderRules,
  allocation: allocationRules,
  expiry: expiryRules,
};

/**
 * Rule Counts and Statistics
 */
export const INVENTORY_RULE_STATS = {
  total: 12,
  enabled: 12,
  disabled: 0,
  categories: {
    reorder: 5,
    allocation: 4,
    expiry: 3,
  },
  priorityRanges: {
    reorder: '400-440',
    allocation: '450-480',
    expiry: '490-510',
  },
  requiresBIIntegration: ['highDemandAdjustmentRule', 'seasonalBufferRule'],
  requiresManualApproval: ['partialAllocationRule', 'transferDecisionRule', 'discountTriggerRule', 'writeOffDecisionRule'],
  automatable: 8, // 8 rules can be fully automated
  manualReview: 4, // 4 rules require manual review/approval
};

/**
 * Rule Metadata Summary
 */
export const inventoryRulesMetadata = {
  description: 'Inventory management rules for reorder, allocation, and expiry decisions',
  version: '1.0.0',
  totalRules: allInventoryRules.length,
  lastUpdated: '2026-07-09',
  businessDomains: ['supply-chain', 'inventory', 'warehouse', 'product-lifecycle'],
  integrations: ['BI Provider (demand forecasting)', 'Event Bus (workflow coordination)', 'Accounting (write-off expenses)'],
  capabilities: [
    'Automated reorder suggestions',
    'VIP customer priority allocation',
    'FEFO inventory rotation',
    'Near-expiry discount automation',
    'Multi-location stock transfers',
    'Demand trend integration',
    'Seasonal buffer planning',
    'Supplier lead time optimization',
  ],
};

