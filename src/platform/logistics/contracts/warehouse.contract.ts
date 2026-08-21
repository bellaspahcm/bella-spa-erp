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
 * Query Operations
 */
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
  // HEALTH CHECK
  // ======================================
  
  /**
   * Health check for warehouse engine
   */
  healthCheck(): Promise<EngineHealthStatus>;
}
