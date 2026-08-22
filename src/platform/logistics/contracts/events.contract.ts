/**
 * Logistics OS: Operational Events Contract
 * 
 * Domain events emitted by Logistics OS for cross-OS integration.
 * Finance OS consumes these events for financial accounting (COGS, journal entries, valuation).
 * 
 * IMPORTANT: Logistics OS emits events with financial context, but does NOT perform accounting.
 * Finance OS is responsible for valuation, costing, and journal entry creation.
 * 
 * @module LogisticsOS/Events
 */

import { ItemId, LocationId, Quantity, MovementReason, AllocationPurpose } from './inventory.contract';

// ============================================================================
// EVENT METADATA
// ============================================================================

/**
 * Standard event metadata
 */
export interface EventMetadata {
  /** Event unique ID */
  event_id: string;
  
  /** Event type */
  event_type: string;
  
  /** Tenant isolation */
  tenant_id: string;
  
  /** Event timestamp */
  occurred_at: Date;
  
  /** Actor who triggered event */
  actor_id: string;
  
  /** Correlation ID for tracing across services */
  correlation_id?: string;
  
  /** Causation ID (parent event that caused this) */
  causation_id?: string;
}

// ============================================================================
// FINANCIAL CONTEXT
// ============================================================================

/**
 * Currency code (ISO 4217)
 */
export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'VND' | string;

/**
 * Valuation method for inventory costing
 */
export enum ValuationMethod {
  /** First In, First Out */
  FIFO = 'FIFO',
  
  /** Last In, First Out */
  LIFO = 'LIFO',
  
  /** Weighted Average Cost */
  WEIGHTED_AVERAGE = 'WEIGHTED_AVERAGE',
  
  /** Moving Average Cost */
  MOVING_AVERAGE = 'MOVING_AVERAGE',
  
  /** Standard Cost */
  STANDARD_COST = 'STANDARD_COST',
  
  /** Actual Cost (for serialized items) */
  ACTUAL_COST = 'ACTUAL_COST',
}

/**
 * Financial context attached to inventory events
 * 
 * Logistics OS provides this context.
 * Finance OS uses this to calculate COGS, create journal entries, update inventory valuation.
 */
export interface FinancialContext {
  /** Unit cost at time of transaction (if known) */
  unit_cost?: number;
  
  /** Total transaction value (quantity × unit_cost) */
  transaction_value?: number;
  
  /** Currency */
  currency: CurrencyCode;
  
  /** Valuation method for this item */
  valuation_method: ValuationMethod;
  
  /** Lot/batch cost (if lot-controlled) */
  lot_cost?: number;
  
  /** Serial number cost (if serialized) */
  serial_costs?: Record<string, number>; // serial_number → cost
  
  /** Cost center (for expense allocation) */
  cost_center_id?: string;
  
  /** GL account hints (Finance OS may override) */
  gl_account_hints?: {
    inventory_asset_account?: string;
    cogs_account?: string;
    variance_account?: string;
  };
  
  /** Financial posting status */
  financial_posting_status: 'not_posted' | 'pending' | 'posted' | 'reversed';
  
  /** Reference to financial transaction (after Finance OS processes) */
  financial_transaction_id?: string;
  
  /** Additional context for Finance OS */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// INVENTORY EVENTS
// ============================================================================

/**
 * Inventory received event
 * 
 * Emitted when: Inventory is received into a location (purchase, production, return)
 * Finance Impact: Increase inventory asset, record payable (if purchase)
 */
export interface InventoryReceivedEvent {
  metadata: EventMetadata;
  
  /** Item received */
  item_id: ItemId;
  
  /** Received into location */
  location_id: LocationId;
  
  /** Quantity received */
  quantity: Quantity;
  
  /** Lot/batch (if lot-controlled) */
  lot_number?: string;
  
  /** Serial numbers (if serialized) */
  serial_numbers?: string[];
  
  /** Source reference (PO number, production order, etc.) */
  reference_id?: string;
  reference_type?: 'purchase_order' | 'production_order' | 'return' | 'transfer';
  
  /** Supplier/vendor (if purchase) */
  supplier_id?: string;
  
  /** Financial context for accounting */
  financial: FinancialContext;
}

/**
 * Inventory moved event
 * 
 * Emitted when: Inventory moves between locations (putaway, transfer, picking)
 * Finance Impact: Usually no impact (internal movement), unless cross-entity transfer
 */
export interface InventoryMovedEvent {
  metadata: EventMetadata;
  
  item_id: ItemId;
  from_location_id: LocationId;
  to_location_id: LocationId;
  quantity: Quantity;
  reason: MovementReason;
  
  lot_number?: string;
  serial_numbers?: string[];
  
  /** Transaction reference */
  transaction_id: string;
  
  /** Financial context (may be null for internal movements) */
  financial?: FinancialContext;
}

/**
 * Inventory allocated event
 * 
 * Emitted when: Inventory is allocated/reserved for purpose (sales order, work order)
 * Finance Impact: No immediate impact (still inventory asset), but reserved for specific purpose
 */
export interface InventoryAllocatedEvent {
  metadata: EventMetadata;
  
  item_id: ItemId;
  location_id: LocationId;
  quantity: Quantity;
  purpose: AllocationPurpose;
  
  /** Allocation reference (order ID, transfer ID, etc.) */
  reference_id: string;
  
  allocation_id: string;
  
  /** Financial context for future COGS calculation */
  financial: FinancialContext;
}

/**
 * Inventory released event
 * 
 * Emitted when: Allocated inventory is released (order cancelled, shipment failed)
 * Finance Impact: No direct impact (still inventory asset)
 */
export interface InventoryReleasedEvent {
  metadata: EventMetadata;
  
  allocation_id: string;
  item_id: ItemId;
  location_id: LocationId;
  quantity: Quantity;
  
  /** Release reason */
  reason: string;
  
  financial?: FinancialContext;
}

/**
 * Inventory issued event (consumption)
 * 
 * Emitted when: Inventory leaves the system (shipped, consumed in production, damaged)
 * Finance Impact: MAJOR - Decrease inventory asset, record COGS (if sale) or expense
 */
export interface InventoryIssuedEvent {
  metadata: EventMetadata;
  
  item_id: ItemId;
  from_location_id: LocationId;
  quantity: Quantity;
  
  /** Issue reason */
  reason: 'sale' | 'production_consumption' | 'damage' | 'loss' | 'disposal' | 'transfer_out';
  
  lot_number?: string;
  serial_numbers?: string[];
  
  /** Reference to source transaction */
  reference_id?: string;
  reference_type?: 'sales_order' | 'shipment' | 'work_order' | 'adjustment';
  
  /** Customer (if sale) */
  customer_id?: string;
  
  /** Financial context for COGS/expense posting */
  financial: FinancialContext;
}

/**
 * Inventory adjusted event
 * 
 * Emitted when: Inventory quantity is adjusted (cycle count, damage, found, loss)
 * Finance Impact: MAJOR - Adjust inventory asset value, record variance to P&L
 */
export interface InventoryAdjustedEvent {
  metadata: EventMetadata;
  
  item_id: ItemId;
  location_id: LocationId;
  
  /** Quantity change (positive = increase, negative = decrease) */
  quantity_delta: number;
  
  quantity_before: Quantity;
  quantity_after: Quantity;
  
  /** Adjustment reason */
  reason: 'cycle_count' | 'damage' | 'loss' | 'found' | 'reconciliation' | 'correction';
  
  lot_number?: string;
  
  /** Adjustment reference */
  adjustment_id: string;
  
  /** Financial context for variance posting */
  financial: FinancialContext;
}

// ============================================================================
// ITEM EVENTS
// ============================================================================

/**
 * Item created event
 * 
 * Emitted when: New item/SKU is created in master data
 * Finance Impact: None (just master data), but Finance OS may create GL account mappings
 */
export interface ItemCreatedEvent {
  metadata: EventMetadata;
  
  item_id: ItemId;
  sku: string;
  name: string;
  category: string;
  
  /** Default financial settings */
  default_financial?: {
    valuation_method: ValuationMethod;
    standard_cost?: number;
    currency: CurrencyCode;
    inventory_account?: string;
    cogs_account?: string;
  };
}

/**
 * Item cost changed event
 * 
 * Emitted when: Item standard/unit cost is updated
 * Finance Impact: May trigger inventory revaluation
 */
export interface ItemCostChangedEvent {
  metadata: EventMetadata;
  
  item_id: ItemId;
  old_cost?: number;
  new_cost: number;
  currency: CurrencyCode;
  
  /** Effective date of cost change */
  effective_date: Date;
  
  /** Whether to revalue existing inventory */
  revalue_existing_inventory: boolean;
}

// ============================================================================
// LOCATION EVENTS
// ============================================================================

/**
 * Location created event
 * 
 * Emitted when: New location is created
 * Finance Impact: None directly, but Finance OS may track location-based inventory valuation
 */
export interface LocationCreatedEvent {
  metadata: EventMetadata;
  
  location_id: LocationId;
  location_code: string;
  location_name: string;
  location_type: string;
  
  /** Entity/company (for multi-entity accounting) */
  entity_id?: string;
  
  /** Cost center */
  cost_center_id?: string;
}

// ============================================================================
// EVENT UNION TYPE
// ============================================================================

/**
 * All Logistics OS operational events
 */
export type LogisticsOperationalEvent =
  | InventoryReceivedEvent
  | InventoryMovedEvent
  | InventoryAllocatedEvent
  | InventoryReleasedEvent
  | InventoryIssuedEvent
  | InventoryAdjustedEvent
  | ItemCreatedEvent
  | ItemCostChangedEvent
  | LocationCreatedEvent;

// ============================================================================
// EVENT BUS CONTRACT
// ============================================================================

/**
 * Event handler function
 */
export type EventHandler<TEvent = LogisticsOperationalEvent> = (
  event: TEvent
) => Promise<void>;

/**
 * Event subscription
 */
export interface EventSubscription {
  id: string;
  event_type: string;
  handler: EventHandler;
  unsubscribe: () => void;
}

/**
 * Event bus interface
 * 
 * Logistics OS publishes events.
 * Finance OS (and other consumers) subscribe to events.
 */
export interface IEventBus {
  /**
   * Publish event
   * 
   * Logistics OS calls this to emit events after successful operations.
   */
  publish<TEvent extends LogisticsOperationalEvent>(
    event: TEvent
  ): Promise<void>;

  /**
   * Subscribe to event type
   * 
   * Finance OS (and others) call this to receive events.
   */
  subscribe(
    event_type: string,
    handler: EventHandler,
    filter?: (event: LogisticsOperationalEvent) => boolean
  ): EventSubscription;

  /**
   * Subscribe to multiple event types
   */
  subscribeMany(
    event_types: string[],
    handler: EventHandler,
    filter?: (event: LogisticsOperationalEvent) => boolean
  ): EventSubscription;

  /**
   * Get event history (for replay/reconciliation)
   */
  getEventHistory(params: {
    tenant_id: string;
    event_types?: string[];
    from_date: Date;
    to_date: Date;
    correlation_id?: string;
  }): Promise<LogisticsOperationalEvent[]>;
}

// ============================================================================
// FINANCE OS INTEGRATION NOTES
// ============================================================================

/**
 * Finance OS Integration Pattern
 * 
 * 1. Finance OS subscribes to Logistics events:
 *    ```typescript
 *    eventBus.subscribe('InventoryReceivedEvent', async (event) => {
 *      // Calculate cost (FIFO/LIFO/etc.)
 *      const cost = await costingService.calculateCost(event);
 *      
 *      // Create journal entry
 *      await journalService.createEntry({
 *        debit: { account: 'inventory_asset', amount: cost },
 *        credit: { account: 'accounts_payable', amount: cost },
 *        reference: event.reference_id,
 *      });
 *      
 *      // Update inventory valuation
 *      await valuationService.updateInventoryValue(event.item_id);
 *    });
 *    ```
 * 
 * 2. Logistics OS never performs accounting:
 *    - No journal entries
 *    - No COGS calculation
 *    - No GL account posting
 *    - Only emits events with financial context
 * 
 * 3. Finance OS is authoritative for:
 *    - Inventory valuation
 *    - Cost of goods sold (COGS)
 *    - Journal entries
 *    - GL account balances
 *    - Financial reports
 * 
 * 4. Logistics OS provides:
 *    - Quantity movements
 *    - Physical inventory balance
 *    - Transaction history
 *    - Financial context hints (unit cost, valuation method)
 * 
 * 5. Reconciliation:
 *    - Finance OS can query Logistics OS for physical quantities
 *    - Finance OS maintains financial quantities (may differ due to timing, valuation)
 *    - Periodic reconciliation between physical and financial inventory
 */
