/**
 * Warehouse Management - Shared Kernel Types
 * 
 * E6 Economics Experiment - R1: Receive Inventory
 * Category: B (Pattern Reuse - following E3 Kernel type pattern)
 * 
 * Domain entities for warehouse inventory management
 */

/**
 * Receipt Status Lifecycle
 * 
 * pending_putaway → putaway_in_progress → completed
 *                ↓
 *             on_hold
 */
export type ReceiptStatus = 
  | 'pending_putaway'
  | 'putaway_in_progress'
  | 'completed'
  | 'on_hold';

/**
 * SKU Status
 */
export type SKUStatus = 
  | 'active'
  | 'discontinued';

/**
 * Unit of Measure
 */
export type UnitOfMeasure = 
  | 'EA'  // Each
  | 'CS'  // Case
  | 'PLT' // Pallet
  | 'BX'  // Box
  | 'PK'; // Pack

/**
 * Discrepancy Status
 * 
 * Indicates relationship between expected and actual quantities
 */
export type DiscrepancyStatus = 
  | 'match'  // actual === expected
  | 'over'   // actual > expected
  | 'short'; // actual < expected

/**
 * Bin Status
 */
export type BinStatus = 
  | 'active'
  | 'damaged'
  | 'reserved'
  | 'inactive';

/**
 * Movement Type
 */
export type MovementType = 
  | 'receive'
  | 'putaway'
  | 'pick'
  | 'adjustment'
  | 'transfer';

/**
 * Inventory Receipt (Header)
 */
export interface WarehouseReceipt {
  id: string;
  tenant_id: string;
  po_number: string;
  vendor_id: string;
  received_date: Date;
  receiver_notes?: string;
  status: ReceiptStatus;
  
  // Workflow tracking
  submitted_at?: Date;
  submitted_by?: string;
  completed_at?: Date;
  completed_by?: string;
  held_at?: Date;
  held_by?: string;
  hold_reason?: string;
  
  // Timestamps
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

/**
 * Receipt Line Item
 * 
 * Individual SKU quantities within a receipt
 */
export interface ReceiptLineItem {
  id: string;
  receipt_id: string;
  tenant_id: string;
  sku_id: string;
  
  // Quantities
  expected_quantity: number;
  actual_quantity: number;
  discrepancy: number; // actual - expected
  discrepancy_status: DiscrepancyStatus;
  
  // Unit
  uom: UnitOfMeasure;
  
  // Putaway target
  target_bin_id?: string;
  
  // Timestamps
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

/**
 * Stock Keeping Unit (SKU)
 * 
 * Product/item master data
 */
export interface WarehouseSKU {
  id: string;
  tenant_id: string;
  sku_code: string;
  description?: string;
  unit_cost: number;
  uom: UnitOfMeasure;
  status: SKUStatus;
  
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

/**
 * Storage Bin
 * 
 * Physical warehouse location
 */
export interface WarehouseBin {
  id: string;
  tenant_id: string;
  bin_code: string;
  warehouse_id: string;
  zone_id?: string;
  aisle_id?: string;
  max_capacity: number;
  status: BinStatus;
  
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

/**
 * Inventory On Hand
 * 
 * Current inventory snapshot by SKU and Bin
 */
export interface InventoryOnHand {
  id: string;
  tenant_id: string;
  sku_id: string;
  bin_id: string;
  quantity: number;
  uom: UnitOfMeasure;
  last_movement_at?: Date;
  
  created_at: Date;
  updated_at: Date;
}

/**
 * Inventory Movement
 * 
 * Transaction log for all inventory changes
 */
export interface InventoryMovement {
  id: string;
  tenant_id: string;
  movement_type: MovementType;
  sku_id: string;
  from_bin_id?: string;
  to_bin_id?: string;
  quantity: number;
  uom: UnitOfMeasure;
  
  // Reference to source transaction
  reference_type?: string; // 'receipt', 'order', 'adjustment'
  reference_id?: string;   // receipt_id, order_id, etc
  
  notes?: string;
  
  created_at: Date;
  created_by: string;
}

/**
 * R1 - Create Receipt Input
 */
export interface CreateReceiptInput {
  tenant_id: string;
  po_number: string;
  vendor_id: string;
  line_items: ReceiptLineItemInput[];
  received_date: Date;
  receiver_notes?: string;
}

export interface ReceiptLineItemInput {
  sku_id: string;
  expected_quantity: number;
  actual_quantity: number;
  uom: UnitOfMeasure;
  target_bin_id?: string;
}

/**
 * R1 - Create Receipt Result
 */
export interface CreateReceiptResult {
  receipt: WarehouseReceipt;
  line_items: ReceiptLineItem[];
  discrepancies: DiscrepancySummary[];
}

export interface DiscrepancySummary {
  sku_id: string;
  sku_code: string;
  expected: number;
  actual: number;
  variance: number;
  variance_percentage: number;
}

/**
 * R6 - Submit for Putaway Input
 */
export interface SubmitForPutawayInput {
  tenant_id: string;
  receipt_id: string;
  submitted_by: string; // user_id
}

/**
 * R6 - Submit for Putaway Result
 */
export interface SubmitForPutawayResult {
  receipt: WarehouseReceipt;
  transitioned_at: Date;
}

/**
 * R7 - Complete Putaway Input
 */
export interface CompletePutawayInput {
  tenant_id: string;
  receipt_id: string;
  completed_by: string; // user_id
}

/**
 * R7 - Complete Putaway Result
 */
export interface CompletePutawayResult {
  receipt: WarehouseReceipt;
  transitioned_at: Date;
  inventory_movements: InventoryMovementSummary[];
}

export interface InventoryMovementSummary {
  sku_id: string;
  sku_code: string;
  bin_id: string;
  bin_code: string;
  quantity: number;
}

/**
 * R8 - Hold Receipt Input
 */
export interface HoldReceiptInput {
  tenant_id: string;
  receipt_id: string;
  held_by: string; // user_id
  hold_reason: 'quality_issue' | 'quantity_discrepancy' | 'damaged_goods';
  notes?: string;
  line_item_ids?: string[]; // optional - specific line items
}

/**
 * R8 - Hold Receipt Result
 */
export interface HoldReceiptResult {
  receipt: WarehouseReceipt;
  held_at: Date;
  scope: 'full_receipt' | 'line_items';
  affected_line_items?: number;
}

/**
 * R8 - Release Hold Input
 */
export interface ReleaseHoldInput {
  tenant_id: string;
  receipt_id: string;
  released_by: string; // user_id
  notes?: string;
}

/**
 * R8 - Release Hold Result
 */
export interface ReleaseHoldResult {
  receipt: WarehouseReceipt;
  released_at: Date;
}

/**
 * R6-R8 - Workflow Validation Errors
 */
export interface WorkflowValidationError {
  field: string;
  code: string;
  message: string;
}

/**
 * R10 - List Receipts Input
 */
export interface ListReceiptsInput {
  tenant_id: string;
  
  // Pagination
  page?: number;
  limit?: number;
  
  // Filters
  status?: ReceiptStatus;
  vendor_id?: string;
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
  
  // Sorting
  sort_by?: 'received_date' | 'created_at' | 'po_number';
  sort_order?: 'asc' | 'desc';
}

/**
 * R10 - List Receipts Result
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
 * R10 - Receipt Summary
 * Lightweight receipt for list views
 */
export interface ReceiptSummary {
  id: string;
  po_number: string;
  vendor_id: string | null;
  vendor_name?: string;
  received_date: string;
  status: ReceiptStatus;
  line_item_count: number;
  created_at: string;
  submitted_at?: string | null;
  completed_at?: string | null;
}


/**
 * R13: Bulk Inventory Movement Input
 * Input for creating multiple inventory movements in a transaction
 */
export interface BulkInventoryMovementInput {
  tenant_id: string;
  movement_type: 'cycle_count_adjustment' | 'inter_bin_transfer';
  movements: InventoryMovementInput[];
  approved_by: string;
}

export interface InventoryMovementInput {
  sku_id: string;
  from_bin_id?: string | null;
  to_bin_id?: string | null;
  quantity: number;
  reason?: string;
}

/**
 * R13: Bulk Inventory Movement Result
 * Result after bulk movement creation
 */
export interface BulkInventoryMovementResult {
  batch_id: string;
  movement_count: number;
  movements: InventoryMovementRecord[];
}

export interface InventoryMovementRecord {
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
