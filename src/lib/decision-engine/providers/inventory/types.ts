/**
 * @fileoverview Inventory Provider Types
 * 
 * Type definitions for inventory management decisions:
 * - Reorder decisions (when to reorder, how much)
 * - Allocation decisions (which stock to use, VIP priority)
 * - Expiry management (FEFO, discounts, write-offs)
 * 
 * @module decision-engine/providers/inventory/types
 */

/**
 * Product stock information
 */
export interface ProductStock {
  /** Product ID */
  productId: string;
  
  /** Product name */
  productName: string;
  
  /** Current stock quantity */
  currentStock: number;
  
  /** Maximum stock capacity */
  maxStock: number;
  
  /** Minimum stock threshold (reorder point) */
  minStock: number;
  
  /** Stock unit (e.g., 'bottle', 'box', 'kg') */
  unit: string;
  
  /** Days until expiry (null if not perishable) */
  daysUntilExpiry: number | null;
  
  /** Product cost per unit */
  unitCost: number;
  
  /** Supplier lead time (days) */
  supplierLeadTime?: number;
  
  /** Location ID (for multi-location support) */
  locationId?: string;
}

/**
 * Demand trend data (from BI Provider)
 */
export interface DemandTrend {
  /** Product ID */
  productId: string;
  
  /** Average daily demand (last 30 days) */
  avgDailyDemand: number;
  
  /** Trend direction: 'up' | 'down' | 'stable' */
  trending: 'up' | 'down' | 'stable';
  
  /** Trend percentage (e.g., 0.15 = 15% increase) */
  trendPercentage: number;
  
  /** Seasonality factor (1.0 = normal, >1.0 = peak season) */
  seasonalityFactor: number;
  
  /** Forecast accuracy (0-1) */
  forecastAccuracy: number;
}

/**
 * Booking allocation request
 */
export interface AllocationRequest {
  /** Booking ID */
  bookingId: string;
  
  /** Product ID to allocate */
  productId: string;
  
  /** Quantity needed */
  quantity: number;
  
  /** Customer tier: 'vip' | 'loyal' | 'regular' | 'new' */
  customerTier: 'vip' | 'loyal' | 'regular' | 'new';
  
  /** Booking scheduled date */
  scheduledDate: Date;
  
  /** Is this a confirmed booking? */
  isConfirmed: boolean;
}

/**
 * Multi-location stock data
 */
export interface LocationStock {
  /** Location ID */
  locationId: string;
  
  /** Location name */
  locationName: string;
  
  /** Product ID */
  productId: string;
  
  /** Stock quantity at this location */
  stock: number;
  
  /** Max capacity at this location */
  maxCapacity: number;
  
  /** Distance from requesting location (km) */
  distanceKm?: number;
}

/**
 * Reorder Decision Output
 */
export interface ReorderDecision {
  /** Should reorder? */
  shouldReorder: boolean;
  
  /** Reorder quantity */
  reorderQuantity: number;
  
  /** Urgency level: 'critical' | 'high' | 'normal' | 'low' */
  urgency: 'critical' | 'high' | 'normal' | 'low';
  
  /** Recommended order date */
  recommendedOrderDate: Date;
  
  /** Reason for decision */
  reason: string;
  
  /** Estimated cost */
  estimatedCost: number;
  
  /** Days of stock coverage after reorder */
  daysOfCoverage: number;
}

/**
 * Allocation Decision Output
 */
export interface AllocationDecision {
  /** Can allocate? */
  canAllocate: boolean;
  
  /** Allocated quantity */
  allocatedQuantity: number;
  
  /** Allocated from location */
  fromLocation: string;
  
  /** Priority level: 'high' | 'normal' | 'low' */
  priority: 'high' | 'normal' | 'low';
  
  /** Should reserve stock? */
  shouldReserve: boolean;
  
  /** Reservation expiry (if reserved) */
  reservationExpiry?: Date;
  
  /** Reason for decision */
  reason: string;
  
  /** Alternative suggestions (if can't allocate) */
  alternatives?: Array<{
    productId: string;
    productName: string;
    availableStock: number;
  }>;
}

/**
 * Expiry Management Decision Output
 */
export interface ExpiryDecision {
  /** Action: 'use_first' | 'discount' | 'write_off' | 'monitor' */
  action: 'use_first' | 'discount' | 'write_off' | 'monitor';
  
  /** Discount percentage (if action = 'discount') */
  discountPercentage?: number;
  
  /** Should send alert? */
  shouldAlert: boolean;
  
  /** Alert urgency: 'high' | 'medium' | 'low' */
  alertUrgency?: 'high' | 'medium' | 'low';
  
  /** Reason for decision */
  reason: string;
  
  /** Estimated value impact */
  valueImpact: number;
  
  /** Days until action required */
  daysUntilAction: number;
}

/**
 * Transfer Decision Output (multi-location)
 */
export interface TransferDecision {
  /** Should transfer? */
  shouldTransfer: boolean;
  
  /** Transfer quantity */
  transferQuantity: number;
  
  /** From location ID */
  fromLocation: string;
  
  /** To location ID */
  toLocation: string;
  
  /** Transfer cost estimate */
  transferCost: number;
  
  /** Transfer urgency: 'urgent' | 'normal' | 'low' */
  urgency: 'urgent' | 'normal' | 'low';
  
  /** Reason for decision */
  reason: string;
}

/**
 * Inventory Decision Input (union of all scenarios)
 */
export interface InventoryDecisionInput {
  /** Tenant ID */
  tenantId: string;
  
  /** Decision type: 'reorder' | 'allocation' | 'expiry' | 'transfer' */
  decisionType: 'reorder' | 'allocation' | 'expiry' | 'transfer';
  
  /** Product stock information */
  productStock: ProductStock;
  
  /** Demand trend (optional, from BI Provider) */
  demandTrend?: DemandTrend;
  
  /** Allocation request (for allocation decisions) */
  allocationRequest?: AllocationRequest;
  
  /** Location stock data (for transfer decisions) */
  locationStocks?: LocationStock[];
  
  /** Current date (for testing) */
  currentDate?: Date;
}

/**
 * Inventory Decision Output (union of all decision types)
 */
export type InventoryDecisionOutput =
  | ReorderDecision
  | AllocationDecision
  | ExpiryDecision
  | TransferDecision;

/**
 * Type guards
 */
export function isReorderDecision(output: InventoryDecisionOutput): output is ReorderDecision {
  return 'shouldReorder' in output;
}

export function isAllocationDecision(output: InventoryDecisionOutput): output is AllocationDecision {
  return 'canAllocate' in output;
}

export function isExpiryDecision(output: InventoryDecisionOutput): output is ExpiryDecision {
  return 'action' in output && typeof (output as ExpiryDecision).action === 'string';
}

export function isTransferDecision(output: InventoryDecisionOutput): output is TransferDecision {
  return 'shouldTransfer' in output;
}

/**
 * Rule evaluation context (internal)
 */
export interface InventoryRuleContext {
  /** Input data */
  input: InventoryDecisionInput;
  
  /** Stock percentage (currentStock / maxStock) */
  stockPercentage: number;
  
  /** Days of stock remaining (based on demand) */
  daysOfStockRemaining: number;
  
  /** Is peak season? */
  isPeakSeason: boolean;
  
  /** Is demand increasing? */
  isDemandIncreasing: boolean;
}

/**
 * Constants
 */
export const INVENTORY_THRESHOLDS = {
  /** Critical stock level (10% of max) */
  CRITICAL_STOCK_PERCENT: 0.10,
  
  /** Reorder point (30% of max) */
  REORDER_POINT_PERCENT: 0.30,
  
  /** Peak season factor threshold */
  PEAK_SEASON_FACTOR: 1.3,
  
  /** Demand increase threshold (20%) */
  DEMAND_INCREASE_THRESHOLD: 0.20,
  
  /** Expiry warning period (30 days) */
  EXPIRY_WARNING_DAYS: 30,
  
  /** Critical expiry period (7 days) */
  EXPIRY_CRITICAL_DAYS: 7,
  
  /** Discount expiry period (30 days) */
  DISCOUNT_EXPIRY_DAYS: 30,
  
  /** Transfer distance threshold (50km) */
  TRANSFER_DISTANCE_THRESHOLD_KM: 50,
} as const;

