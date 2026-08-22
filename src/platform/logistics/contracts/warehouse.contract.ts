/**
 * Warehouse Management Contract
 * 
 * E6 Economics Experiment - R1: Receive Inventory
 * Category: B (Pattern Reuse - following E3 Contract pattern)
 * 
 * Domain: Inventory receiving, putaway, and stock management
 * Boundary: Warehouse operations isolated from transportation/freight
 */

import { EngineResponse, EngineHealthStatus } from '@/core/types/engine';

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * R1: Receive Inventory (Create Receipt)
 */
export interface CreateReceiptRequest {
  tenant_id: string;
  po_number: string;
  vendor_id: string;
  line_items: ReceiptLineItemInput[];
  received_date: Date;
  receiver_notes?: string;
  idempotency_key?: string;
}

export interface ReceiptLineItemInput {
  sku_id: string;
  expected_quantity: number;
  actual_quantity: number;
  uom: string; // 'EA' | 'CS' | 'PLT'
  target_bin_id?: string;
}

export interface CreateReceiptResult {
  receipt_id: string;
  status: string; // 'pending_putaway'
  line_items: ReceiptLineItem[];
  discrepancies: DiscrepancySummary[];
}

export interface ReceiptLineItem {
  line_item_id: string;
  sku_id: string;
  expected_quantity: number;
  actual_quantity: number;
  discrepancy: number;
  discrepancy_status: 'match' | 'over' | 'short';
  uom: string;
  target_bin_id?: string;
}

export interface DiscrepancySummary {
  sku_id: string;
  expected: number;
  actual: number;
  variance: number;
  percentage: number;
}

/**
 * R6: Submit for Putaway (Workflow)
 */
export interface SubmitForPutawayRequest {
  tenant_id: string;
  receipt_id: string;
  submitted_by: string; // user_id
}

export interface SubmitForPutawayResult {
  receipt_id: string;
  status: string; // 'putaway_in_progress'
  submitted_at: Date;
  submitted_by: string;
}

/**
 * R7: Complete Putaway (Workflow)
 */
export interface CompletePutawayRequest {
  tenant_id: string;
  receipt_id: string;
  completed_by: string; // user_id
}

export interface CompletePutawayResult {
  receipt_id: string;
  status: string; // 'completed'
  completed_at: Date;
  completed_by: string;
  inventory_movements: InventoryMovementSummary[];
}

export interface InventoryMovementSummary {
  sku_id: string;
  bin_id: string;
  quantity: number;
}

/**
 * R8: Hold/Quarantine Receipt (Workflow)
 */
export interface HoldReceiptRequest {
  tenant_id: string;
  receipt_id: string;
  held_by: string; // user_id
  hold_reason: 'quality_issue' | 'quantity_discrepancy' | 'damaged_goods';
  notes?: string;
  line_item_ids?: string[]; // optional - specific line items to hold
}

export interface HoldReceiptResult {
  receipt_id: string;
  status: string; // 'on_hold' if full receipt, or original status if line items only
  held_at: Date;
  held_by: string;
  hold_reason: string;
  scope: 'full_receipt' | 'line_items';
  affected_line_items?: number;
}

export interface ReleaseHoldRequest {
  tenant_id: string;
  receipt_id: string;
  released_by: string; // user_id
  notes?: string;
}

export interface ReleaseHoldResult {
  receipt_id: string;
  status: string; // restored to previous state
  released_at: Date;
  released_by: string;
}

/**
 * Query Operations
 */

/**
 * R10: List Receipts Request
 * Query receipts with filters and pagination
 */
export interface ListReceiptsRequest {
  tenant_id: string;
  
  // Pagination
  page?: number;           // default: 1
  limit?: number;          // default: 20
  
  // Filters
  status?: string;         // pending_putaway, putaway_in_progress, completed, on_hold
  vendor_id?: string;      // filter by vendor
  from?: string;           // date range start (YYYY-MM-DD)
  to?: string;             // date range end (YYYY-MM-DD)
  
  // Sorting
  sort_by?: 'received_date' | 'created_at' | 'po_number';
  sort_order?: 'asc' | 'desc';
}

/**
 * R10: List Receipts Result
 * Paginated list with metadata
 */
export interface ListReceiptsResult {
  receipts: ReceiptSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

/**
 * R10: Receipt Summary
 * Lightweight receipt info for list view
 */
export interface ReceiptSummary {
  id: string;
  po_number: string;
  vendor_id: string | null;
  vendor_name?: string;
  received_date: string;
  status: string;
  line_item_count: number;
  created_at: string;
  submitted_at?: string | null;
  completed_at?: string | null;
}

/**
 * R12: Count Receipts by Status Request
 * Aggregate metrics for dashboard
 */
export interface CountReceiptsByStatusRequest {
  tenant_id: string;
}

/**
 * R12: Count Receipts by Status Result
 * Returns count of receipts grouped by status
 */
export interface CountReceiptsByStatusResult {
  pending_putaway: number;
  putaway_in_progress: number;
  completed: number;
  on_hold: number;
}

/**
 * R13: Bulk Inventory Movement Request
 * Create multiple inventory movements in a single transaction
 */
export interface BulkInventoryMovementRequest {
  tenant_id: string;
  movement_type: 'cycle_count_adjustment' | 'inter_bin_transfer';
  movements: InventoryMovementInput[];
  approved_by: string; // user_id
}

export interface InventoryMovementInput {
  sku_id: string;
  from_bin_id?: string | null; // null for adjustments
  to_bin_id?: string | null;
  quantity: number;
  reason?: string;
}

/**
 * R13: Bulk Inventory Movement Result
 * Returns created movements with batch tracking
 */
export interface BulkInventoryMovementResult {
  batch_id: string;
  movement_count: number;
  movements: InventoryMovement[];
}

export interface InventoryMovement {
  id: string;
  tenant_id: string;
  sku_id: string;
  from_bin_id?: string | null;
  to_bin_id?: string | null;
  quantity: number;
  movement_type: string;
  reason?: string;
  batch_id: string;
  approved_by: string;
  created_at: Date;
}

/**
 * R14: Inventory Value by SKU Request
 * Calculate total inventory value grouped by SKU
 */
export interface GetInventoryValueRequest {
  tenant_id: string;
}

/**
 * R14: Inventory Value by SKU Result
 * Returns inventory value aggregated by SKU
 */
export interface GetInventoryValueResult {
  items: InventoryValueItem[];
  total_value: number;
}

export interface InventoryValueItem {
  sku_id: string;
  sku_code: string;
  on_hand_quantity: number;
  unit_cost: number;
  total_value: number;
}

/**
 * R15: Check Bin Capacity Request
 * Validate bin capacity before inventory operation
 */
export interface CheckBinCapacityRequest {
  tenant_id: string;
  bin_id: string;
  additional_quantity: number;
}

/**
 * R15: Check Bin Capacity Result
 * Returns capacity validation result
 */
export interface CheckBinCapacityResult {
  bin_id: string;
  max_capacity: number;
  current_quantity: number;
  available_capacity: number;
  requested_quantity: number;
  is_valid: boolean;
  error_message?: string;
}

export interface GetReceiptRequest {
  tenant_id: string;
  receipt_id: string;
}

export interface GetReceiptsByStatusRequest {
  tenant_id: string;
  status: string; // 'pending_putaway' | 'putaway_in_progress' | 'completed' | 'on_hold'
  limit?: number;
  offset?: number;
}

export interface GetReceiptsByVendorRequest {
  tenant_id: string;
  vendor_id: string;
  from_date?: Date;
  to_date?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Receipt Metrics
 */
export interface GetReceiptMetricsRequest {
  tenant_id: string;
  from_date?: Date;
  to_date?: Date;
}

export interface ReceiptMetrics {
  total_receipts: number;
  total_line_items: number;
  total_quantity_received: number;
  discrepancy_count: number;
  on_time_receipts: number;
}

// ============================================================================
// DOMAIN EVENTS
// ============================================================================

/**
 * R1: Receipt Created Event
 */
export interface ReceiptCreatedPayload {
  receipt_id: string;
  tenant_id: string;
  po_number: string;
  vendor_id: string;
  line_item_count: number;
  total_quantity: number;
  has_discrepancies: boolean;
  created_at: Date;
}

/**
 * R6: Receipt Submitted for Putaway Event
 */
export interface ReceiptSubmittedForPutawayPayload {
  receipt_id: string;
  tenant_id: string;
  po_number: string;
  submitted_by: string;
  submitted_at: Date;
  line_item_count: number;
}

/**
 * R7: Receipt Completed Event
 */
export interface ReceiptCompletedPayload {
  receipt_id: string;
  tenant_id: string;
  po_number: string;
  completed_by: string;
  completed_at: Date;
  inventory_movements: {
    sku_id: string;
    bin_id: string;
    quantity: number;
  }[];
}

/**
 * R8: Receipt Held Event
 */
export interface ReceiptHeldPayload {
  receipt_id: string;
  tenant_id: string;
  po_number: string;
  held_by: string;
  held_at: Date;
  hold_reason: string;
  scope: 'full_receipt' | 'line_items';
}

/**
 * R8: Receipt Hold Released Event
 */
export interface ReceiptHoldReleasedPayload {
  receipt_id: string;
  tenant_id: string;
  po_number: string;
  released_by: string;
  released_at: Date;
}

// ============================================================================
// CONTRACT INTERFACE
// ============================================================================

/**
 * Warehouse Management Contract
 * 
 * Defines domain operations for warehouse inventory management.
 * Platform engines implementing this contract must enforce:
 * - Tenant isolation (RLS)
 * - Audit trails
 * - Event emission after successful persistence
 */
export interface WarehouseContract {
  // ======================================
  // R1: RECEIVE INVENTORY
  // ======================================
  
  /**
   * Create inventory receipt
   * 
   * @param request - Receipt creation payload
   * @returns EngineResponse with receipt and line items
   * 
   * **Domain Rules:**
   * - Discrepancy calculated: actual - expected
   * - Status set to 'pending_putaway'
   * - Line items validated (SKU exists, quantities > 0)
   * 
   * **Platform:**
   * - Tenant isolation enforced
   * - Audit trail recorded
   * - Event emitted: ReceiptCreated
   */
  createReceipt(
    request: CreateReceiptRequest
  ): Promise<EngineResponse<CreateReceiptResult>>;
  
  /**
   * Get receipt by ID
   */
  getReceipt(
    request: GetReceiptRequest
  ): Promise<EngineResponse<CreateReceiptResult>>;
  
  /**
   * R10: List receipts with filters
   * 
   * @param request - Query filters and pagination
   * @returns EngineResponse with paginated receipt list
   * 
   * **Query Features:**
   * - Pagination (page, limit)
   * - Status filter
   * - Vendor filter
   * - Date range filter (from/to)
   * - RLS enforcement (tenant isolation)
   * 
   * **Platform:**
   * - Tenant isolation enforced via RLS
   * - No cross-tenant data leakage
   */
  listReceipts(
    request: ListReceiptsRequest
  ): Promise<EngineResponse<ListReceiptsResult>>;
  
  /**
   * R12: Count receipts by status
   * 
   * @param request - Tenant-scoped count request
   * @returns EngineResponse with counts grouped by status
   * 
   * **Metrics:**
   * - Aggregate count by status (pending_putaway, putaway_in_progress, completed, on_hold)
   * - Uses COUNT aggregate (not fetch-and-count)
   * - RLS enforcement (tenant isolation)
   * 
   * **Platform:**
   * - Tenant isolation enforced via RLS
   * - Performance optimized (<100ms for 10k receipts)
   */
  countReceiptsByStatus(
    request: CountReceiptsByStatusRequest
  ): Promise<EngineResponse<CountReceiptsByStatusResult>>;
  
  /**
   * R13: Create bulk inventory movements
   * 
   * @param request - Bulk movement creation payload
   * @returns EngineResponse with created movements
   * 
   * **Domain Rules:**
   * - All movements executed atomically (transaction boundary)
   * - Each movement logged separately with shared batch_id
   * - Inventory on-hand updated for affected SKU/bin combinations
   * - Movement types: cycle_count_adjustment, inter_bin_transfer
   * 
   * **Platform:**
   * - Transaction isolation enforced
   * - Audit trail recorded per movement
   * - Tenant isolation enforced via RLS
   */
  createBulkMovements(
    request: BulkInventoryMovementRequest
  ): Promise<EngineResponse<BulkInventoryMovementResult>>;
  
  /**
   * R14: Get inventory value by SKU
   * 
   * @param request - Tenant-scoped value request
   * @returns EngineResponse with inventory values
   * 
   * **Metrics:**
   * - Aggregate on-hand quantity by SKU (across all bins)
   * - Calculate total value (quantity × unit_cost)
   * - GROUP BY SKU with SUM aggregation
   * - DECIMAL precision (no rounding errors)
   * 
   * **Platform:**
   * - Tenant isolation enforced via RLS
   * - JOIN inventory_on_hand + skus
   */
  getInventoryValue(
    request: GetInventoryValueRequest
  ): Promise<EngineResponse<GetInventoryValueResult>>;
  
  /**
   * R15: Check bin capacity
   * 
   * @param request - Bin capacity check request
   * @returns EngineResponse with capacity validation result
   * 
   * **Domain Rules:**
   * - Calculate: current_quantity = SUM(inventory_on_hand.quantity) for bin
   * - Validate: (current_quantity + additional_quantity) <= bin.max_capacity
   * - Reject if capacity exceeded
   * 
   * **Platform:**
   * - Tenant isolation enforced via RLS
   * - Read bin max_capacity
   * - Aggregate current inventory
   */
  checkBinCapacity(
    request: CheckBinCapacityRequest
  ): Promise<EngineResponse<CheckBinCapacityResult>>;
  
  /**
   * Get receipts by status
   */
  getReceiptsByStatus(
    request: GetReceiptsByStatusRequest
  ): Promise<EngineResponse<CreateReceiptResult[]>>;
  
  /**
   * Get receipts by vendor
   */
  getReceiptsByVendor(
    request: GetReceiptsByVendorRequest
  ): Promise<EngineResponse<CreateReceiptResult[]>>;
  
  /**
   * Get receipt metrics
   */
  getReceiptMetrics(
    request: GetReceiptMetricsRequest
  ): Promise<EngineResponse<ReceiptMetrics>>;
  
  // ======================================
  // R6: WORKFLOW - SUBMIT FOR PUTAWAY
  // ======================================
  
  /**
   * Submit receipt for putaway
   * 
   * @param request - Putaway submission payload
   * @returns EngineResponse with updated receipt state
   * 
   * **Domain Rules:**
   * - Current status must be 'pending_putaway'
   * - All line_items must have target_bin_id assigned
   * - No line_items in 'hold' status
   * - Transition to 'putaway_in_progress'
   * 
   * **Platform:**
   * - Audit trail recorded
   * - Event emitted: ReceiptSubmittedForPutaway
   */
  submitForPutaway(
    request: SubmitForPutawayRequest
  ): Promise<EngineResponse<SubmitForPutawayResult>>;
  
  // ======================================
  // R7: WORKFLOW - COMPLETE PUTAWAY
  // ======================================
  
  /**
   * Complete putaway and update inventory
   * 
   * @param request - Putaway completion payload
   * @returns EngineResponse with completed receipt and inventory movements
   * 
   * **Domain Rules:**
   * - Current status must be 'putaway_in_progress'
   * - Transition to 'completed' (terminal state)
   * - Update inventory_on_hand for each line_item
   * - Idempotent: already completed returns 200 OK
   * 
   * **Platform:**
   * - Audit trail recorded
   * - Event emitted: ReceiptCompleted
   * - Inventory transactions atomic
   */
  completePutaway(
    request: CompletePutawayRequest
  ): Promise<EngineResponse<CompletePutawayResult>>;
  
  // ======================================
  // R8: WORKFLOW - HOLD/QUARANTINE
  // ======================================
  
  /**
   * Place receipt or line items on hold
   * 
   * @param request - Hold request payload
   * @returns EngineResponse with hold confirmation
   * 
   * **Domain Rules:**
   * - Current status must be 'pending_putaway' or 'putaway_in_progress'
   * - If line_item_ids provided: mark specific items as held
   * - If not provided: mark entire receipt as 'on_hold'
   * - On-hold items do NOT update inventory
   * 
   * **Platform:**
   * - Audit trail recorded
   * - Event emitted: ReceiptHeld
   */
  holdReceipt(
    request: HoldReceiptRequest
  ): Promise<EngineResponse<HoldReceiptResult>>;
  
  /**
   * Release hold on receipt or line items
   * 
   * @param request - Release hold payload
   * @returns EngineResponse with release confirmation
   * 
   * **Domain Rules:**
   * - Restore to previous state before hold
   * - Clear hold tracking fields
   * 
   * **Platform:**
   * - Audit trail recorded
   * - Event emitted: ReceiptHoldReleased
   */
  releaseHold(
    request: ReleaseHoldRequest
  ): Promise<EngineResponse<ReleaseHoldResult>>;
  
  // ======================================
  // HEALTH CHECK
  // ======================================
  
  /**
   * Health check for warehouse engine
   */
  healthCheck(): Promise<EngineHealthStatus>;
}
