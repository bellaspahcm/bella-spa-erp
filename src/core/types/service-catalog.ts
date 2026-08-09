import type { ModuleId } from './module';

/**
 * Service or product catalog item status.
 * 
 * @remarks
 * Controls visibility and availability of catalog items:
 * - `active`: Item is available for booking/purchase
 * - `inactive`: Item is temporarily unavailable (not shown to customers)
 * - `archived`: Item is permanently retired but preserved for historical records
 */
export type ServiceCatalogStatus = 'active' | 'inactive' | 'archived';

/**
 * Core service catalog item representing a purchasable service or product.
 * 
 * @remarks
 * This is an industry-neutral primitive. Module-specific fields (e.g., spa package
 * session counts, cleaning service duration) should be stored in the `metadata` field.
 * 
 * **Spa Module Extensions** (stored in metadata):
 * - `total_sessions`: number of sessions in package
 * - `session_multiplier`: coefficient for session counting (1.0, 1.5, 2.0)
 * - `category`: 'basic' | 'premium' | 'vip'
 * - `duration_minutes`: typical service duration
 * 
 * @example
 * ```typescript
 * const spaPackage: CoreServiceCatalogItem = {
 *   id: 'uuid-here',
 *   tenantId: 'tenant-uuid',
 *   moduleId: 'spa',
 *   name: 'Combo Mẹ & Bé VIP Toàn Diện',
 *   description: 'Package with 20 sessions and premium services',
 *   basePrice: 15000000,
 *   currency: 'VND',
 *   status: 'active',
 *   metadata: {
 *     total_sessions: 20,
 *     session_multiplier: 2.0,
 *     category: 'vip',
 *     duration_minutes: 90,
 *   },
 * };
 * ```
 */
export interface CoreServiceCatalogItem {
  /** Unique identifier (UUID) */
  id: string;
  
  /** Tenant this service belongs to */
  tenantId: string;
  
  /** Module that owns this service */
  moduleId: ModuleId;
  
  /** Service name (user-visible) */
  name: string;
  
  /** Detailed description (optional) */
  description?: string;
  
  /** Base price before discounts/promotions */
  basePrice: number;
  
  /** ISO 4217 currency code (e.g., 'VND', 'USD') */
  currency: string;
  
  /** Current status */
  status: ServiceCatalogStatus;
  
  /** 
   * Module-specific fields and extensions.
   * 
   * @remarks
   * Store module-specific data here to avoid modifying the core interface.
   * 
   * **Spa module examples**:
   * - `total_sessions: number` - Number of sessions in package
   * - `session_multiplier: number` - Coefficient for session counting (1.0, 1.5, 2.0)
   * - `category: string` - Package tier ('basic', 'premium', 'vip')
   * - `duration_minutes: number` - Typical service duration
   * 
   * **Cleaning module examples**:
   * - `service_duration_hours: number` - Expected cleaning duration
   * - `square_meters_covered: number` - Area coverage
   * - `equipment_required: string[]` - Required cleaning equipment
   * 
   * **Home-service module examples**:
   * - `skill_level: string` - Required technician skill level
   * - `parts_included: boolean` - Whether parts are included in price
   * - `warranty_months: number` - Service warranty period
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, unknown>;
}

/**
 * Type guard for CoreServiceCatalogItem.
 * 
 * @param value - Value to validate
 * @returns True if value matches CoreServiceCatalogItem structure
 * 
 * @remarks
 * Use this for runtime validation when receiving data from external sources
 * (API responses, user input, database queries with unknown types).
 * 
 * @example
 * ```typescript
 * const data = await fetchServiceItem(id);
 * if (isCoreServiceCatalogItem(data)) {
 *   console.log(`Service: ${data.name}, Price: ${data.basePrice}`);
 * } else {
 *   throw new Error('Invalid service catalog item');
 * }
 * ```
 */
export function isCoreServiceCatalogItem(value: unknown): value is CoreServiceCatalogItem {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    typeof item.tenantId === 'string' &&
    typeof item.moduleId === 'string' &&
    typeof item.name === 'string' &&
    typeof item.basePrice === 'number' &&
    typeof item.currency === 'string' &&
    typeof item.status === 'string' &&
    typeof item.metadata === 'object'
  );
}
