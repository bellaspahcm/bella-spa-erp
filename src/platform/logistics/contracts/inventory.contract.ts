/**
 * Logistics OS: Inventory Domain Contract
 * 
 * Core inventory primitives for Logistics domain.
 * Products (Warehouse, Fulfillment, Transport) consume these interfaces.
 * 
 * @module LogisticsOS/Inventory
 */

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Unique identifier for an item in Logistics domain
 */
export type ItemId = string;

/**
 * Unique identifier for a location in Logistics domain
 */
export type LocationId = string;

/**
 * Quantity with decimal precision for inventory
 */
export type Quantity = number;

/**
 * Movement reason classification
 */
export enum MovementReason {
  RECEIPT = 'receipt',
  PUTAWAY = 'putaway',
  PICK = 'pick',
  ALLOCATION = 'allocation',
  TRANSFER = 'transfer',
  ADJUSTMENT = 'adjustment',
  RETURN = 'return',
  DAMAGE = 'damage',
  LOSS = 'loss',
  FOUND = 'found',
}

/**
 * Allocation purpose classification
 */
export enum AllocationPurpose {
  SALES_ORDER = 'sales_order',
  TRANSFER_ORDER = 'transfer_order',
  WORK_ORDER = 'work_order',
  RESERVATION = 'reservation',
  HOLD = 'hold',
}

/**
 * Transaction status
 */
export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  REVERSED = 'reversed',
  FAILED = 'failed',
}

// ============================================================================
// INVENTORY BALANCE
// ============================================================================

/**
 * Current inventory balance at a location
 */
export interface InventoryBalance {
  item_id: ItemId;
  location_id: LocationId;
  on_hand: Quantity;
  allocated: Quantity;
  available: Quantity; // on_hand - allocated
  in_transit?: Quantity;
  tenant_id: string;
  updated_at: Date;
}

/**
 * Query inventory balance
 */
export interface IInventoryBalanceQuery {
  /**
   * Get current on-hand quantity for item at location
   */
  getOnHand(params: {
    item_id: ItemId;
    location_id: LocationId;
    tenant_id: string;
  }): Promise<Quantity>;

  /**
   * Get available quantity (on_hand - allocated)
   */
  getAvailable(params: {
    item_id: ItemId;
    location_id: LocationId;
    tenant_id: string;
  }): Promise<Quantity>;

  /**
   * Get full balance (on_hand, allocated, available)
   */
  getBalance(params: {
    item_id: ItemId;
    location_id: LocationId;
    tenant_id: string;
  }): Promise<InventoryBalance>;

  /**
   * Get balances for item across all locations
   */
  getBalancesByItem(params: {
    item_id: ItemId;
    tenant_id: string;
  }): Promise<InventoryBalance[]>;

  /**
   * Get balances at location for all items
   */
  getBalancesByLocation(params: {
    location_id: LocationId;
    tenant_id: string;
  }): Promise<InventoryBalance[]>;
}

// ============================================================================
// INVENTORY MOVEMENT
// ============================================================================

/**
 * Movement request parameters
 */
export interface MoveInventoryRequest {
  item_id: ItemId;
  from_location_id: LocationId;
  to_location_id: LocationId;
  quantity: Quantity;
  reason: MovementReason;
  actor_id: string;
  tenant_id: string;
  reference_id?: string; // External reference (receipt_id, order_id, etc.)
  lot_number?: string;
  serial_numbers?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Movement result
 */
export interface MovementResult {
  transaction_id: string;
  item_id: ItemId;
  from_location_id: LocationId;
  to_location_id: LocationId;
  quantity: Quantity;
  reason: MovementReason;
  status: TransactionStatus;
  executed_at: Date;
  actor_id: string;
}

/**
 * Movement transaction record
 */
export interface MovementTransaction {
  id: string;
  tenant_id: string;
  item_id: ItemId;
  from_location_id: LocationId;
  to_location_id: LocationId;
  quantity: Quantity;
  reason: MovementReason;
  status: TransactionStatus;
  actor_id: string;
  reference_id?: string;
  lot_number?: string;
  serial_numbers?: string[];
  metadata?: Record<string, unknown>;
  created_at: Date;
  executed_at?: Date;
  reversed_at?: Date;
}

/**
 * Inventory movement service
 */
export interface IInventoryMovement {
  /**
   * Move inventory between locations
   * 
   * Validates:
   * - Item exists and is active
   * - Locations exist and are active
   * - Sufficient quantity at source location
   * - Tenant isolation
   * 
   * Effect:
   * - Decreases from_location balance
   * - Increases to_location balance
   * - Creates movement transaction record
   * - Emits InventoryMovedEvent
   */
  moveInventory(request: MoveInventoryRequest): Promise<MovementResult>;

  /**
   * Get movement history for item
   */
  getMovementHistory(params: {
    item_id: ItemId;
    tenant_id: string;
    location_id?: LocationId;
    from_date?: Date;
    to_date?: Date;
    limit?: number;
  }): Promise<MovementTransaction[]>;

  /**
   * Reverse a movement transaction
   */
  reverseMovement(params: {
    transaction_id: string;
    actor_id: string;
    tenant_id: string;
    reason: string;
  }): Promise<MovementResult>;
}

// ============================================================================
// INVENTORY ALLOCATION
// ============================================================================

/**
 * Allocation request
 */
export interface AllocateInventoryRequest {
  item_id: ItemId;
  location_id: LocationId;
  quantity: Quantity;
  purpose: AllocationPurpose;
  reference_id: string; // Order ID, Transfer ID, etc.
  actor_id: string;
  tenant_id: string;
  expires_at?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Allocation result
 */
export interface AllocationResult {
  allocation_id: string;
  item_id: ItemId;
  location_id: LocationId;
  quantity: Quantity;
  purpose: AllocationPurpose;
  reference_id: string;
  status: 'active' | 'released' | 'expired';
  created_at: Date;
  expires_at?: Date;
}

/**
 * Allocation record
 */
export interface AllocationRecord {
  id: string;
  tenant_id: string;
  item_id: ItemId;
  location_id: LocationId;
  quantity: Quantity;
  purpose: AllocationPurpose;
  reference_id: string;
  status: 'active' | 'released' | 'expired';
  actor_id: string;
  created_at: Date;
  released_at?: Date;
  expires_at?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Inventory allocation service
 */
export interface IInventoryAllocation {
  /**
   * Allocate inventory for purpose
   * 
   * Validates:
   * - Item exists and is active
   * - Location exists and is active
   * - Sufficient available quantity (on_hand - allocated)
   * - Tenant isolation
   * 
   * Effect:
   * - Increases allocated quantity
   * - Decreases available quantity
   * - Creates allocation record
   * - Emits InventoryAllocatedEvent
   */
  allocateInventory(request: AllocateInventoryRequest): Promise<AllocationResult>;

  /**
   * Release allocation
   * 
   * Effect:
   * - Decreases allocated quantity
   * - Increases available quantity
   * - Marks allocation as released
   * - Emits AllocationReleasedEvent
   */
  releaseAllocation(params: {
    allocation_id: string;
    actor_id: string;
    tenant_id: string;
  }): Promise<void>;

  /**
   * Get allocations for item
   */
  getAllocations(params: {
    item_id: ItemId;
    location_id?: LocationId;
    tenant_id: string;
    status?: 'active' | 'released' | 'expired';
  }): Promise<AllocationRecord[]>;

  /**
   * Get allocation by reference
   */
  getAllocationByReference(params: {
    reference_id: string;
    tenant_id: string;
  }): Promise<AllocationRecord[]>;
}

// ============================================================================
// INVENTORY ADJUSTMENT
// ============================================================================

/**
 * Adjustment reason
 */
export enum AdjustmentReason {
  DAMAGE = 'damage',
  LOSS = 'loss',
  FOUND = 'found',
  CYCLE_COUNT = 'cycle_count',
  RECONCILIATION = 'reconciliation',
  CORRECTION = 'correction',
}

/**
 * Adjustment request
 */
export interface AdjustInventoryRequest {
  item_id: ItemId;
  location_id: LocationId;
  quantity_delta: number; // Positive = increase, Negative = decrease
  reason: AdjustmentReason;
  actor_id: string;
  tenant_id: string;
  notes?: string;
  reference_id?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Adjustment result
 */
export interface AdjustmentResult {
  adjustment_id: string;
  item_id: ItemId;
  location_id: LocationId;
  quantity_before: Quantity;
  quantity_delta: number;
  quantity_after: Quantity;
  reason: AdjustmentReason;
  executed_at: Date;
}

/**
 * Inventory adjustment service
 */
export interface IInventoryAdjustment {
  /**
   * Adjust inventory quantity
   * 
   * Validates:
   * - Item exists and is active
   * - Location exists and is active
   * - Tenant isolation
   * - If negative adjustment, sufficient quantity exists
   * 
   * Effect:
   * - Updates on_hand quantity
   * - Creates adjustment transaction
   * - Emits InventoryAdjustedEvent
   */
  adjustInventory(request: AdjustInventoryRequest): Promise<AdjustmentResult>;

  /**
   * Get adjustment history
   */
  getAdjustmentHistory(params: {
    item_id: ItemId;
    location_id?: LocationId;
    tenant_id: string;
    from_date?: Date;
    to_date?: Date;
  }): Promise<AdjustmentResult[]>;
}

// ============================================================================
// INVENTORY LEDGER
// ============================================================================

/**
 * Ledger entry type
 */
export enum LedgerEntryType {
  MOVEMENT = 'movement',
  ALLOCATION = 'allocation',
  RELEASE = 'release',
  ADJUSTMENT = 'adjustment',
}

/**
 * Immutable ledger entry
 */
export interface InventoryLedgerEntry {
  id: string;
  tenant_id: string;
  item_id: ItemId;
  location_id: LocationId;
  entry_type: LedgerEntryType;
  quantity_delta: number;
  balance_after: Quantity;
  transaction_id: string;
  actor_id: string;
  reason: string;
  created_at: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Inventory ledger (immutable audit log)
 */
export interface IInventoryLedger {
  /**
   * Get ledger entries for item at location
   */
  getLedgerEntries(params: {
    item_id: ItemId;
    location_id?: LocationId;
    tenant_id: string;
    from_date?: Date;
    to_date?: Date;
    limit?: number;
  }): Promise<InventoryLedgerEntry[]>;

  /**
   * Get balance at point in time
   */
  getBalanceAt(params: {
    item_id: ItemId;
    location_id: LocationId;
    tenant_id: string;
    at: Date;
  }): Promise<Quantity>;
}

// ============================================================================
// MAIN CONTRACT
// ============================================================================

/**
 * Logistics OS: Inventory Domain Contract
 * 
 * Main interface for inventory operations.
 * Products consume this contract to manage inventory.
 */
export interface IInventoryDomain {
  balance: IInventoryBalanceQuery;
  movement: IInventoryMovement;
  allocation: IInventoryAllocation;
  adjustment: IInventoryAdjustment;
  ledger: IInventoryLedger;
}
