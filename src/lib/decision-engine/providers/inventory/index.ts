/**
 * @fileoverview Inventory Provider - Main Export
 * 
 * Provider #5 for Decision Engine Platform.
 * 
 * **Domain:** Supply Chain & Inventory Management
 * 
 * **Capabilities:**
 * - Automated reorder decisions (stock level, demand, seasonality, lead time)
 * - Smart allocation (VIP priority, FEFO, multi-location)
 * - Expiry management (discount triggers, write-offs, waste reduction)
 * 
 * **Integration:**
 * - BI Provider (demand forecasting)
 * - Event Bus (workflow coordination)
 * - Accounting (write-off expenses)
 * 
 * **Rules:** 12 total (5 reorder + 4 allocation + 3 expiry)
 * 
 * **Usage:**
 * ```typescript
 * import { InventoryProvider } from '@/lib/decision-engine/providers/inventory';
 * 
 * const provider = new InventoryProvider();
 * 
 * // Reorder decision
 * const reorderDecision = await provider.evaluate({
 *   decisionType: 'reorder',
 *   productStock: { ... },
 *   demandTrend: { ... }, // From BI Provider
 * });
 * 
 * // Allocation decision
 * const allocationDecision = await provider.evaluate({
 *   decisionType: 'allocation',
 *   productStock: { ... },
 *   allocationRequest: {
 *     bookingId: '...',
 *     customerTier: 'vip',
 *     ...
 *   },
 * });
 * 
 * // Expiry decision
 * const expiryDecision = await provider.evaluate({
 *   decisionType: 'expiry',
 *   productStock: {
 *     daysUntilExpiry: 15, // Triggers discount
 *     ...
 *   },
 * });
 * ```
 * 
 * @module decision-engine/providers/inventory
 */

// Types
export type {
  ProductStock,
  DemandTrend,
  AllocationRequest,
  LocationStock,
  ReorderDecision,
  AllocationDecision,
  ExpiryDecision,
  TransferDecision,
  InventoryDecisionInput,
  InventoryDecisionOutput,
  InventoryRuleContext,
} from './types';

export {
  isReorderDecision,
  isAllocationDecision,
  isExpiryDecision,
  isTransferDecision,
  INVENTORY_THRESHOLDS,
} from './types';

// Rules
export {
  // Reorder
  criticalStockAlertRule,
  standardReorderRule,
  highDemandAdjustmentRule,
  seasonalBufferRule,
  supplierLeadTimeRule,
  reorderRules,
  
  // Allocation
  vipPriorityAllocationRule,
  standardAllocationRule,
  partialAllocationRule,
  transferDecisionRule,
  allocationRules,
  
  // Expiry
  fefoPriorityRule,
  discountTriggerRule,
  writeOffDecisionRule,
  expiryRules,
  
  // All rules
  allInventoryRules,
  inventoryRulesByCategory,
  INVENTORY_RULE_STATS,
  inventoryRulesMetadata,
} from './rules';

// Provider (will be implemented in Step 2)
// export { InventoryProvider } from './inventory-provider';

// Provider
export { InventoryProvider } from './inventory-provider';

