import type { ModuleId } from './module';
import type { CoreServiceCatalogItem } from './service-catalog';
import type { CoreBookingOrder } from './booking-order';
import type { TenantContext } from './tenant';

/**
 * Module adapter interface for extending core platform functionality.
 * 
 * @remarks
 * Modules implement this interface to integrate with the core platform
 * and provide module-specific behavior without coupling core to module code.
 * 
 * All methods are optional. The core platform will handle missing methods
 * gracefully with default behavior.
 * 
 * **Phase 3 Note**: Module registration system will be implemented in Phase 3.
 * This interface establishes the contract that modules will implement.
 * 
 * @example
 * ```typescript
 * const spaAdapter: ModuleAdapter = {
 *   moduleId: 'spa',
 *   moduleName: 'Bella Spa & Babycare',
 *   transformServiceItem: (item) => ({
 *     ...item,
 *     totalSessions: item.metadata.total_sessions,
 *     category: item.metadata.category,
 *   }),
 *   validateBookingRules: async (order, context) => {
 *     // Check KTV availability, package limits, etc.
 *     return true;
 *   },
 * };
 * ```
 */
export interface ModuleAdapter {
  /** Module identifier */
  moduleId: ModuleId;
  
  /** Human-readable module name */
  moduleName: string;
  
  /** 
   * Transform core service item to module-specific type.
   * 
   * @remarks
   * Use this to convert the generic CoreServiceCatalogItem to a module-specific
   * type with strongly-typed metadata fields.
   * 
   * **When to implement**: When your module needs to access service catalog items
   * with module-specific fields (sessions, duration, equipment, etc.)
   * 
   * **Example for spa module**:
   * ```typescript
   * transformServiceItem: (item) => ({
   *   id: item.id,
   *   name: item.name,
   *   price: item.basePrice,
   *   totalSessions: item.metadata.total_sessions as number,
   *   category: item.metadata.category as 'basic' | 'premium' | 'vip',
   *   sessionMultiplier: item.metadata.session_multiplier as number,
   * })
   * ```
   */
  transformServiceItem?: (item: CoreServiceCatalogItem) => unknown;
  
  /** 
   * Transform core booking order to module-specific type.
   * 
   * @remarks
   * Use this to convert the generic CoreBookingOrder to a module-specific
   * type with strongly-typed metadata fields.
   * 
   * **When to implement**: When your module needs to access booking orders
   * with module-specific progress tracking or configuration.
   * 
   * **Example for spa module**:
   * ```typescript
   * transformBookingOrder: (order) => ({
   *   id: order.id,
   *   customerId: order.customerId,
   *   status: order.status,
   *   sessionsCompleted: order.metadata.sessions_completed as number,
   *   sessionsRemaining: order.metadata.sessions_remaining as number,
   *   assignedKtvId: order.metadata.assigned_ktv_id as string,
   * })
   * ```
   */
  transformBookingOrder?: (order: CoreBookingOrder) => unknown;
  
  /** 
   * Validate module-specific booking constraints.
   * 
   * @remarks
   * Use this to enforce module-specific business rules before confirming a booking.
   * 
   * **When to implement**: When your module has constraints that core platform
   * cannot validate (resource availability, package limits, skill requirements).
   * 
   * **Example for spa module**:
   * ```typescript
   * validateBookingRules: async (order, context) => {
   *   // Check KTV availability
   *   const ktvAvailable = await checkKtvAvailability(
   *     order.metadata.assigned_ktv_id,
   *     order.scheduledStartTime
   *   );
   *   if (!ktvAvailable) return false;
   *   
   *   // Check package session limits
   *   const sessionsUsed = await getSessionCount(order.customerId, order.serviceItemId);
   *   const sessionsTotal = order.metadata.sessions_total;
   *   if (sessionsUsed >= sessionsTotal) return false;
   *   
   *   return true;
   * }
   * ```
   */
  validateBookingRules?: (order: CoreBookingOrder, context: TenantContext) => Promise<boolean>;
  
  /** 
   * Calculate module-specific pricing rules.
   * 
   * @remarks
   * Use this to apply dynamic pricing, discounts, or promotions specific to your module.
   * 
   * **When to implement**: When your module has complex pricing logic beyond
   * the base price (member discounts, package discounts, dynamic pricing).
   * 
   * **Example for spa module**:
   * ```typescript
   * calculatePricing: async (item, context) => {
   *   let price = item.basePrice;
   *   
   *   // Apply member discount
   *   if (context.settings.membershipLevel === 'gold') {
   *     price *= 0.9; // 10% discount
   *   }
   *   
   *   // Apply package discount
   *   if (item.metadata.category === 'vip') {
   *     price *= 0.85; // 15% discount for VIP packages
   *   }
   *   
   *   return Math.round(price);
   * }
   * ```
   */
  calculatePricing?: (item: CoreServiceCatalogItem, context: TenantContext) => Promise<number>;
  
  /** 
   * Execute module-specific side effects when booking completes.
   * 
   * @remarks
   * Use this to trigger module-specific actions after a booking is completed
   * (inventory updates, salary credits, loyalty points, etc.).
   * 
   * **When to implement**: When your module needs to perform actions that the
   * core platform doesn't handle (deduct inventory, credit KTV salary, etc.).
   * 
   * **Example for spa module**:
   * ```typescript
   * onBookingCompleted: async (order, context) => {
   *   // Credit KTV salary
   *   const ktvId = order.metadata.assigned_ktv_id;
   *   const sessionsCompleted = order.metadata.sessions_completed;
   *   await creditKtvSalary(ktvId, sessionsCompleted);
   *   
   *   // Deduct inventory (products used)
   *   const productsUsed = order.metadata.products_used;
   *   await deductInventory(productsUsed);
   *   
   *   // Award loyalty points
   *   await awardLoyaltyPoints(order.customerId, order.totalAmount);
   * }
   * ```
   */
  onBookingCompleted?: (order: CoreBookingOrder, context: TenantContext) => Promise<void>;
  
  /** 
   * Return dashboard widget components for this module.
   * 
   * @remarks
   * Use this to provide module-specific dashboard widgets that display
   * in the tenant's dashboard.
   * 
   * **When to implement**: When your module has custom metrics or visualizations
   * to show on the dashboard (revenue charts, service statistics, etc.).
   * 
   * **Example for spa module**:
   * ```typescript
   * getModuleWidgets: () => [
   *   {
   *     id: 'spa-revenue-chart',
   *     component: SpaRevenueChart,
   *     title: 'Spa Revenue',
   *     size: 'large',
   *   },
   *   {
   *     id: 'ktv-leaderboard',
   *     component: KtvLeaderboard,
   *     title: 'Top KTVs',
   *     size: 'medium',
   *   },
   * ]
   * ```
   */
  getModuleWidgets?: () => unknown[];
}
