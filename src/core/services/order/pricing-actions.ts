/**
 * Order pricing calculation with module adapter integration.
 * 
 * @remarks
 * This module provides pricing calculation functionality that integrates
 * with module adapters to apply module-specific pricing rules while
 * maintaining fallback behavior when adapters are not available.
 * 
 * **Pricing Flow**:
 * 1. Lookup module adapter from registry using context.moduleId
 * 2. If adapter exists and has calculatePricing method, invoke it
 * 3. If adapter not found, use base price from service catalog item
 * 4. Apply tenant subscription tier discounts (if configured)
 * 
 * **Requirements**: REQ-3.3.4
 * 
 * @module core/services/order/pricing-actions
 */

import type { CoreServiceCatalogItem } from '@/core/types/service-catalog';
import type { TenantContext } from '@/core/types/tenant';
import { moduleRegistry } from '@/core/adapters/registry';

/**
 * Calculate final order price using module adapter pricing or fallback.
 * 
 * @param item - Service catalog item to price
 * @param context - Tenant context with subscription tier and settings
 * @returns Final price after applying all discounts and pricing rules
 * 
 * @remarks
 * This function implements the pricing calculation strategy:
 * 
 * **Priority 1: Module Adapter Pricing**
 * - Lookup adapter for context.moduleId
 * - If adapter has calculatePricing method, use it
 * - Adapter applies module-specific pricing (package discounts, session multipliers)
 * - Adapter applies subscription tier discounts
 * 
 * **Priority 2: Fallback to Base Price**
 * - If no adapter found, use item.basePrice directly
 * - Log warning for visibility
 * - Ensures graceful degradation when adapter not registered
 * 
 * **Subscription Tier Integration**:
 * - Spa adapter applies subscription discounts:
 *   - enterprise: 15% off
 *   - professional: 10% off
 *   - starter: 5% off
 *   - free: no discount
 * - Other adapters may implement different discount structures
 * 
 * **Error Handling**:
 * - If adapter.calculatePricing throws, log error and fall back to base price
 * - Never throw errors to caller (pricing calculation must always succeed)
 * - Return valid price even in failure scenarios
 * 
 * @example
 * ```typescript
 * // With spa adapter registered
 * const item: CoreServiceCatalogItem = {
 *   id: 'pkg-1',
 *   name: 'Combo VIP',
 *   basePrice: 15000000,
 *   metadata: { category: 'vip', session_multiplier: 2.0 },
 *   // ... other fields
 * };
 * 
 * const context: TenantContext = {
 *   tenantId: 'tenant-1',
 *   enabledModules: ['spa'],
 *   subscriptionPlan: 'enterprise',
 *   // ... other fields
 * };
 * 
 * const finalPrice = await calculateOrderPrice(item, context);
 * // Returns: 11475000 (15000000 * 0.9 VIP * 0.85 enterprise)
 * ```
 * 
 * @example
 * ```typescript
 * // Without adapter registered (fallback)
 * const finalPrice = await calculateOrderPrice(item, context);
 * // Returns: 15000000 (base price, no discounts)
 * // Logs warning: "No adapter found for module spa, using base price"
 * ```
 */
export async function calculateOrderPrice(
  item: CoreServiceCatalogItem,
  context: TenantContext
): Promise<number> {
  console.log(
    `[PricingActions] Calculating price for ${item.name} (${item.id})`
  );

  // Look up module adapter
  const moduleId = item.moduleId || context.enabledModules[0];
  const adapter = moduleRegistry.get(moduleId);

  if (!adapter) {
    console.warn(
      `[PricingActions] No adapter found for module ${moduleId}, using base price ${item.basePrice}`
    );
    return item.basePrice;
  }

  // Check if adapter implements calculatePricing
  if (typeof adapter.calculatePricing !== 'function') {
    console.warn(
      `[PricingActions] Adapter ${adapter.moduleName} does not implement calculatePricing, using base price ${item.basePrice}`
    );
    return item.basePrice;
  }

  // Invoke adapter pricing calculation
  try {
    console.log(
      `[PricingActions] Invoking ${adapter.moduleName} adapter pricing calculation`
    );
    const finalPrice = await adapter.calculatePricing(item, context);
    
    console.log(
      `[PricingActions] Final price calculated: ${finalPrice} (from ${item.basePrice})`
    );
    
    return finalPrice;
  } catch (error) {
    console.error(
      `[PricingActions] Error calculating price with adapter ${adapter.moduleName}:`,
      error
    );
    console.warn(
      `[PricingActions] Falling back to base price ${item.basePrice}`
    );
    return item.basePrice;
  }
}

/**
 * Calculate order price for multiple items (batch operation).
 * 
 * @param items - Array of service catalog items to price
 * @param context - Tenant context
 * @returns Array of final prices (same order as input items)
 * 
 * @remarks
 * This function processes multiple items efficiently by:
 * - Calculating prices in parallel using Promise.all
 * - Handling errors per-item (one failure doesn't stop others)
 * - Maintaining order of results matching input order
 * 
 * Useful for:
 * - Shopping cart pricing
 * - Bulk order calculations
 * - Price comparison reports
 * 
 * @example
 * ```typescript
 * const items = [item1, item2, item3];
 * const prices = await calculateOrderPriceBatch(items, context);
 * // prices[0] corresponds to item1, prices[1] to item2, etc.
 * ```
 */
export async function calculateOrderPriceBatch(
  items: CoreServiceCatalogItem[],
  context: TenantContext
): Promise<number[]> {
  console.log(
    `[PricingActions] Calculating batch prices for ${items.length} items`
  );

  const prices = await Promise.all(
    items.map((item) => calculateOrderPrice(item, context))
  );

  console.log(`[PricingActions] Batch calculation completed`);
  return prices;
}
