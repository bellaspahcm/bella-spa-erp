/**
 * Warehouse Management Engine
 * 
 * E6 Economics Experiment - P0.1: Engine Wrapper
 * 
 * Implements WarehouseContract interface and delegates to domain services.
 * Provides health check and event publishing integration.
 * 
 * @module platform/logistics/engines
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { EngineResponse, EngineHealthStatus } from '../shared-kernel/types';
import { eventBus } from '@/platform/host/event-bus';
import {
  WarehouseContract,
  CreateReceiptRequest,
  CreateReceiptResult,
  SubmitForPutawayRequest,
  SubmitForPutawayResult,
  CompletePutawayRequest,
  CompletePutawayResult,
  HoldReceiptRequest,
  HoldReceiptResult,
  ReleaseHoldRequest,
  ReleaseHoldResult,
  ListReceiptsRequest,
  ListReceiptsResult,
  GetReceiptRequest,
  GetReceiptsByStatusRequest,
  GetReceiptsByVendorRequest,
  CountReceiptsByStatusRequest,
  CountReceiptsByStatusResult,
  BulkInventoryMovementRequest,
  BulkInventoryMovementResult,
  GetInventoryValueRequest,
  GetInventoryValueResult,
  CheckBinCapacityRequest,
  CheckBinCapacityResult,
  GetReceiptMetricsRequest,
  ReceiptMetrics,
  ReceiptCreatedPayload,
  ReceiptSubmittedForPutawayPayload,
  ReceiptCompletedPayload,
  ReceiptHeldPayload,
  ReceiptHoldReleasedPayload,
} from '../contracts/warehouse.contract';
import { ReceiptService } from '../warehouse/receipt.service';

/**
 * Warehouse Engine
 * 
 * Main engine for warehouse management operations.
 * Delegates business logic to ReceiptService and handles:
 * - Event publishing
 * - Health checks
 * - Cross-cutting concerns
 */
export class WarehouseEngine implements WarehouseContract {
  private receiptService: ReceiptService;

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly tenantId: string,
    private readonly userId: string
  ) {
    this.receiptService = new ReceiptService(supabase, tenantId, userId);
  }

  /**
   * R1: Create Receipt
   * 
   * Creates warehouse receipt with line items.
   * Publishes ReceiptCreated event on success.
   */
  async createReceipt(
    request: CreateReceiptRequest
  ): Promise<EngineResponse<CreateReceiptResult>> {
    const result = await this.receiptService.createReceipt(request);

    // P0.5: Publish domain event on success
    if (result.success && result.data) {
      const { receipt, line_items } = result.data;
      
      const hasDiscrepancies = line_items.some(
        item => item.discrepancy_status !== 'match'
      );
      
      const totalQuantity = line_items.reduce(
        (sum, item) => sum + item.actual_quantity,
        0
      );

      const eventPayload: ReceiptCreatedPayload = {
        receipt_id: receipt.id,
        tenant_id: receipt.tenant_id,
        po_number: receipt.po_number,
        vendor_id: receipt.vendor_id,
        line_item_count: line_items.length,
        total_quantity: totalQuantity,
        has_discrepancies: hasDiscrepancies,
        created_at: receipt.created_at,
      };

      await eventBus.publish({
        eventType: 'warehouse.receipt.created.v1',
        eventVersion: '1.0.0',
        eventId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        tenantId: receipt.tenant_id,
        aggregateId: receipt.id,
        aggregateType: 'receipt' as any,
        payload: eventPayload,
        metadata: {
          userId: this.userId,
          source: 'WarehouseEngine',
        },
      });
    }

    return result;
  }

  /**
   * R11: Get Receipt by ID
   */
  async getReceipt(
    request: GetReceiptRequest
  ): Promise<EngineResponse<CreateReceiptResult>> {
    return this.receiptService.getReceipt(request);
  }

  /**
   * R10: List Receipts with Filters
   */
  async listReceipts(
    request: ListReceiptsRequest
  ): Promise<EngineResponse<ListReceiptsResult>> {
    return this.receiptService.listReceipts(request);
  }

  /**
   * R12: Count Receipts by Status
   */
  async countReceiptsByStatus(
    request: CountReceiptsByStatusRequest
  ): Promise<EngineResponse<CountReceiptsByStatusResult>> {
    return this.receiptService.countReceiptsByStatus(request);
  }

  /**
   * R13: Create Bulk Inventory Movements
   */
  async createBulkMovements(
    request: BulkInventoryMovementRequest
  ): Promise<EngineResponse<BulkInventoryMovementResult>> {
    return this.receiptService.createBulkMovements(request);
  }

  /**
   * R14: Get Inventory Value by SKU
   */
  async getInventoryValue(
    request: GetInventoryValueRequest
  ): Promise<EngineResponse<GetInventoryValueResult>> {
    return this.receiptService.getInventoryValue(request);
  }

  /**
   * R15: Check Bin Capacity
   */
  async checkBinCapacity(
    request: CheckBinCapacityRequest
  ): Promise<EngineResponse<CheckBinCapacityResult>> {
    return this.receiptService.checkBinCapacity(request);
  }

  /**
   * P0.2: Get Receipts by Status
   */
  async getReceiptsByStatus(
    request: GetReceiptsByStatusRequest
  ): Promise<EngineResponse<CreateReceiptResult[]>> {
    try {
      // Validate tenant isolation
      if (request.tenant_id !== this.tenantId) {
        return {
          success: false,
          error: {
            code: 'TENANT_MISMATCH',
            message: 'Request tenant_id does not match session tenant',
          },
        };
      }

      // Build query
      let query = this.supabase
        .from('logistics_warehouse_receipts')
        .select('*')
        .eq('tenant_id', this.tenantId)
        .eq('status', request.status)
        .is('deleted_at', null)
        .order('received_date', { ascending: false });

      // Pagination
      if (request.limit) {
        const offset = request.offset || 0;
        query = query.range(offset, offset + request.limit - 1);
      }

      const { data: receipts, error: queryError } = await query;

      if (queryError) {
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: queryError.message,
          },
        };
      }

      if (!receipts || receipts.length === 0) {
        return {
          success: true,
          data: [],
        };
      }

      // Fetch line items for each receipt
      const receiptIds = receipts.map(r => r.id);
      const { data: lineItems, error: lineItemsError } = await this.supabase
        .from('logistics_warehouse_receipt_line_items')
        .select('*')
        .in('receipt_id', receiptIds)
        .eq('tenant_id', this.tenantId);

      if (lineItemsError) {
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: lineItemsError.message,
          },
        };
      }

      // Group line items by receipt
      const lineItemsByReceipt = new Map<string, any[]>();
      (lineItems || []).forEach(item => {
        if (!lineItemsByReceipt.has(item.receipt_id)) {
          lineItemsByReceipt.set(item.receipt_id, []);
        }
        lineItemsByReceipt.get(item.receipt_id)!.push(item);
      });

      // Fetch SKU info for discrepancies
      const skuIds = Array.from(new Set((lineItems || []).map(li => li.sku_id)));
      const { data: skus } = await this.supabase
        .from('logistics_warehouse_skus')
        .select('id, sku_code')
        .in('id', skuIds)
        .eq('tenant_id', this.tenantId);

      const skuMap = new Map((skus || []).map(s => [s.id, s.sku_code]));

      // Map to CreateReceiptResult format
      const results: CreateReceiptResult[] = receipts.map(receipt => {
        const receiptLineItems = lineItemsByReceipt.get(receipt.id) || [];
        
        const mappedLineItems = receiptLineItems.map(li => ({
          line_item_id: li.id,
          sku_id: li.sku_id,
          expected_quantity: parseFloat(li.expected_quantity),
          actual_quantity: parseFloat(li.actual_quantity),
          discrepancy: parseFloat(li.discrepancy),
          discrepancy_status: li.discrepancy_status,
          uom: li.uom,
          target_bin_id: li.target_bin_id,
        }));

        const discrepancies = mappedLineItems
          .filter(li => li.discrepancy_status !== 'match')
          .map(li => ({
            sku_id: li.sku_id,
            expected: li.expected_quantity,
            actual: li.actual_quantity,
            variance: li.discrepancy,
            percentage: li.expected_quantity > 0
              ? Math.abs((li.discrepancy / li.expected_quantity) * 100)
              : 0,
          }));

        return {
          receipt_id: receipt.id,
          status: receipt.status,
          line_items: mappedLineItems,
          discrepancies,
        };
      });

      return {
        success: true,
        data: results,
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Failed to get receipts by status',
        },
      };
    }
  }

  /**
   * P0.3: Get Receipts by Vendor
   */
  async getReceiptsByVendor(
    request: GetReceiptsByVendorRequest
  ): Promise<EngineResponse<CreateReceiptResult[]>> {
    try {
      // Validate tenant isolation
      if (request.tenant_id !== this.tenantId) {
        return {
          success: false,
          error: {
            code: 'TENANT_MISMATCH',
            message: 'Request tenant_id does not match session tenant',
          },
        };
      }

      // Build query
      let query = this.supabase
        .from('logistics_warehouse_receipts')
        .select('*')
        .eq('tenant_id', this.tenantId)
        .eq('vendor_id', request.vendor_id)
        .is('deleted_at', null)
        .order('received_date', { ascending: false });

      // Date range filters
      if (request.from_date) {
        query = query.gte('received_date', request.from_date.toISOString().split('T')[0]);
      }
      if (request.to_date) {
        query = query.lte('received_date', request.to_date.toISOString().split('T')[0]);
      }

      // Pagination
      if (request.limit) {
        const offset = request.offset || 0;
        query = query.range(offset, offset + request.limit - 1);
      }

      const { data: receipts, error: queryError } = await query;

      if (queryError) {
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: queryError.message,
          },
        };
      }

      if (!receipts || receipts.length === 0) {
        return {
          success: true,
          data: [],
        };
      }

      // Fetch line items for each receipt
      const receiptIds = receipts.map(r => r.id);
      const { data: lineItems, error: lineItemsError } = await this.supabase
        .from('logistics_warehouse_receipt_line_items')
        .select('*')
        .in('receipt_id', receiptIds)
        .eq('tenant_id', this.tenantId);

      if (lineItemsError) {
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: lineItemsError.message,
          },
        };
      }

      // Group line items by receipt
      const lineItemsByReceipt = new Map<string, any[]>();
      (lineItems || []).forEach(item => {
        if (!lineItemsByReceipt.has(item.receipt_id)) {
          lineItemsByReceipt.set(item.receipt_id, []);
        }
        lineItemsByReceipt.get(item.receipt_id)!.push(item);
      });

      // Map to CreateReceiptResult format
      const results: CreateReceiptResult[] = receipts.map(receipt => {
        const receiptLineItems = lineItemsByReceipt.get(receipt.id) || [];
        
        const mappedLineItems = receiptLineItems.map(li => ({
          line_item_id: li.id,
          sku_id: li.sku_id,
          expected_quantity: parseFloat(li.expected_quantity),
          actual_quantity: parseFloat(li.actual_quantity),
          discrepancy: parseFloat(li.discrepancy),
          discrepancy_status: li.discrepancy_status,
          uom: li.uom,
          target_bin_id: li.target_bin_id,
        }));

        const discrepancies = mappedLineItems
          .filter(li => li.discrepancy_status !== 'match')
          .map(li => ({
            sku_id: li.sku_id,
            expected: li.expected_quantity,
            actual: li.actual_quantity,
            variance: li.discrepancy,
            percentage: li.expected_quantity > 0
              ? Math.abs((li.discrepancy / li.expected_quantity) * 100)
              : 0,
          }));

        return {
          receipt_id: receipt.id,
          status: receipt.status,
          line_items: mappedLineItems,
          discrepancies,
        };
      });

      return {
        success: true,
        data: results,
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Failed to get receipts by vendor',
        },
      };
    }
  }

  /**
   * P0.4: Get Receipt Metrics
   */
  async getReceiptMetrics(
    request: GetReceiptMetricsRequest
  ): Promise<EngineResponse<ReceiptMetrics>> {
    try {
      // Validate tenant isolation
      if (request.tenant_id !== this.tenantId) {
        return {
          success: false,
          error: {
            code: 'TENANT_MISMATCH',
            message: 'Request tenant_id does not match session tenant',
          },
        };
      }

      // Build query
      let query = this.supabase
        .from('logistics_warehouse_receipts')
        .select('*, logistics_warehouse_receipt_line_items(*)')
        .eq('tenant_id', this.tenantId)
        .is('deleted_at', null);

      // Date range filters
      if (request.from_date) {
        query = query.gte('received_date', request.from_date.toISOString().split('T')[0]);
      }
      if (request.to_date) {
        query = query.lte('received_date', request.to_date.toISOString().split('T')[0]);
      }

      const { data: receipts, error: queryError } = await query;

      if (queryError) {
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: queryError.message,
          },
        };
      }

      // Calculate metrics
      const totalReceipts = receipts?.length || 0;
      
      let totalLineItems = 0;
      let totalQuantity = 0;
      let discrepancyCount = 0;
      let onTimeReceipts = 0;

      (receipts || []).forEach(receipt => {
        const lineItems = (receipt as any).logistics_warehouse_receipt_line_items || [];
        totalLineItems += lineItems.length;

        lineItems.forEach((li: any) => {
          totalQuantity += parseFloat(li.actual_quantity || 0);
          
          if (li.discrepancy_status !== 'match') {
            discrepancyCount++;
          }
        });

        // On-time: completed within same day as received
        if (receipt.status === 'completed' && receipt.completed_at) {
          const receivedDate = new Date(receipt.received_date).toISOString().split('T')[0];
          const completedDate = new Date(receipt.completed_at).toISOString().split('T')[0];
          
          if (receivedDate === completedDate) {
            onTimeReceipts++;
          }
        }
      });

      const metrics: ReceiptMetrics = {
        total_receipts: totalReceipts,
        total_line_items: totalLineItems,
        total_quantity_received: totalQuantity,
        discrepancy_count: discrepancyCount,
        on_time_receipts: onTimeReceipts,
      };

      return {
        success: true,
        data: metrics,
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Failed to calculate receipt metrics',
        },
      };
    }
  }

  /**
   * R6: Submit for Putaway
   * 
   * Publishes ReceiptSubmittedForPutaway event on success.
   */
  async submitForPutaway(
    request: SubmitForPutawayRequest
  ): Promise<EngineResponse<SubmitForPutawayResult>> {
    const result = await this.receiptService.submitForPutaway(request);

    // P0.5: Publish domain event on success
    if (result.success && result.data) {
      const { receipt } = result.data;

      // Get line item count
      const { data: lineItems } = await this.supabase
        .from('logistics_warehouse_receipt_line_items')
        .select('id')
        .eq('receipt_id', receipt.id)
        .eq('tenant_id', this.tenantId);

      const eventPayload: ReceiptSubmittedForPutawayPayload = {
        receipt_id: receipt.id,
        tenant_id: receipt.tenant_id,
        po_number: receipt.po_number,
        submitted_by: receipt.submitted_by!,
        submitted_at: receipt.submitted_at!,
        line_item_count: lineItems?.length || 0,
      };

      await eventBus.publish({
        eventType: 'warehouse.receipt.submitted_for_putaway.v1',
        eventVersion: '1.0.0',
        eventId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        tenantId: receipt.tenant_id,
        aggregateId: receipt.id,
        aggregateType: 'receipt' as any,
        payload: eventPayload,
        metadata: {
          userId: this.userId,
          source: 'WarehouseEngine',
        },
      });
    }

    return result;
  }

  /**
   * R7: Complete Putaway
   * 
   * Publishes ReceiptCompleted event on success.
   */
  async completePutaway(
    request: CompletePutawayRequest
  ): Promise<EngineResponse<CompletePutawayResult>> {
    const result = await this.receiptService.completePutaway(request);

    // P0.5: Publish domain event on success
    if (result.success && result.data) {
      const { receipt, inventory_movements } = result.data;

      const eventPayload: ReceiptCompletedPayload = {
        receipt_id: receipt.id,
        tenant_id: receipt.tenant_id,
        po_number: receipt.po_number,
        completed_by: receipt.completed_by!,
        completed_at: receipt.completed_at!,
        inventory_movements: inventory_movements.map(m => ({
          sku_id: m.sku_id,
          bin_id: m.bin_id,
          quantity: m.quantity,
        })),
      };

      await eventBus.publish({
        eventType: 'warehouse.receipt.completed.v1',
        eventVersion: '1.0.0',
        eventId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        tenantId: receipt.tenant_id,
        aggregateId: receipt.id,
        aggregateType: 'receipt' as any,
        payload: eventPayload,
        metadata: {
          userId: this.userId,
          source: 'WarehouseEngine',
        },
      });
    }

    return result;
  }

  /**
   * R8: Hold Receipt
   * 
   * Publishes ReceiptHeld event on success.
   */
  async holdReceipt(
    request: HoldReceiptRequest
  ): Promise<EngineResponse<HoldReceiptResult>> {
    const result = await this.receiptService.holdReceipt(request);

    // P0.5: Publish domain event on success
    if (result.success && result.data) {
      const { receipt, scope } = result.data;

      const eventPayload: ReceiptHeldPayload = {
        receipt_id: receipt.id,
        tenant_id: receipt.tenant_id,
        po_number: receipt.po_number,
        held_by: receipt.held_by!,
        held_at: receipt.held_at!,
        hold_reason: receipt.hold_reason!,
        scope,
      };

      await eventBus.publish({
        eventType: 'warehouse.receipt.held.v1',
        eventVersion: '1.0.0',
        eventId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        tenantId: receipt.tenant_id,
        aggregateId: receipt.id,
        aggregateType: 'receipt' as any,
        payload: eventPayload,
        metadata: {
          userId: this.userId,
          source: 'WarehouseEngine',
        },
      });
    }

    return result;
  }

  /**
   * R8: Release Hold
   * 
   * Publishes ReceiptHoldReleased event on success.
   */
  async releaseHold(
    request: ReleaseHoldRequest
  ): Promise<EngineResponse<ReleaseHoldResult>> {
    const result = await this.receiptService.releaseHold(request);

    // P0.5: Publish domain event on success
    if (result.success && result.data) {
      const { receipt, released_at } = result.data;

      const eventPayload: ReceiptHoldReleasedPayload = {
        receipt_id: receipt.id,
        tenant_id: receipt.tenant_id,
        po_number: receipt.po_number,
        released_by: this.userId,
        released_at,
      };

      await eventBus.publish({
        eventType: 'warehouse.receipt.hold_released.v1',
        eventVersion: '1.0.0',
        eventId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        tenantId: receipt.tenant_id,
        aggregateId: receipt.id,
        aggregateType: 'receipt' as any,
        payload: eventPayload,
        metadata: {
          userId: this.userId,
          source: 'WarehouseEngine',
        },
      });
    }

    return result;
  }

  /**
   * Health Check
   * 
   * Verifies warehouse engine health including database connectivity.
   */
  async healthCheck(): Promise<EngineHealthStatus> {
    try {
      // Test database connectivity
      const { error: dbError } = await this.supabase
        .from('logistics_warehouse_receipts')
        .select('id')
        .limit(1)
        .single();

      // Allow "no rows" error (PGRST116) as healthy
      const isDbHealthy = !dbError || dbError.code === 'PGRST116';

      return {
        status: isDbHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        checks: {
          database: isDbHealthy ? 'ok' : 'error',
          eventBus: 'ok',
        },
        message: isDbHealthy
          ? 'Warehouse engine operational'
          : `Database error: ${dbError?.message || 'Unknown'}`,
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'error',
          eventBus: 'ok',
        },
        message: `Health check failed: ${error.message || 'Unknown error'}`,
      };
    }
  }
}
