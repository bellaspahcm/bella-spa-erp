/**
 * Warehouse Receipt Service
 * 
 * E6 Economics Experiment - R1: Receive Inventory
 * Category: B (Pattern Reuse - following E3 FreightAuditEngine pattern)
 * 
 * Implements receipt creation with inventory updates
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { EngineResponse } from '@/core/types/engine';
import {
  CreateReceiptInput,
  CreateReceiptResult,
  WarehouseReceipt,
  ReceiptLineItem,
  DiscrepancySummary,
  WarehouseSKU,
} from '../shared-kernel/types/warehouse.types';
import {
  validateCreateReceipt,
  calculateDiscrepancy,
} from './receipt.validation';

interface ReceiptRow {
  id: string;
  tenant_id: string;
  po_number: string;
  vendor_id: string;
  received_date: string;
  receiver_notes?: string;
  status: string;
  submitted_at?: string;
  submitted_by?: string;
  completed_at?: string;
  completed_by?: string;
  held_at?: string;
  held_by?: string;
  hold_reason?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

interface LineItemRow {
  id: string;
  receipt_id: string;
  tenant_id: string;
  sku_id: string;
  expected_quantity: number;
  actual_quantity: number;
  discrepancy: number;
  discrepancy_status: string;
  uom: string;
  target_bin_id?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

interface SKURow {
  id: string;
  tenant_id: string;
  sku_code: string;
  description?: string;
  unit_cost: number;
  uom: string;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

/**
 * Receipt Service
 * 
 * Handles receipt creation, validation, and inventory updates
 */
export class ReceiptService {
  constructor(
    private supabase: SupabaseClient,
    private tenantId: string,
    private userId: string
  ) {}

  /**
   * R1: Create Receipt
   * 
   * Acceptance Criteria:
   * - AC1.1: Basic receipt creation
   * - AC1.2: Audit trail
   * - AC1.3: Validation
   * - AC1.4: Discrepancy calculation
   */
  async createReceipt(
    input: CreateReceiptInput
  ): Promise<EngineResponse<CreateReceiptResult>> {
    try {
      // Validate tenant isolation
      if (input.tenant_id !== this.tenantId) {
        return {
          success: false,
          error: {
            code: 'TENANT_MISMATCH',
            message: 'Request tenant_id does not match session tenant',
          },
        };
      }

      // AC1.3: Input validation
      const validation = validateCreateReceipt(input);
      if (!validation.valid) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Input validation failed',
            details: validation.errors,
          },
        };
      }

      // R2 will validate: SKU exists in tenant scope
      // For now, proceed with basic validation
      const skuIds = input.line_items.map(item => item.sku_id);
      const { data: skus, error: skuError } = await this.supabase
        .from('logistics_warehouse_skus')
        .select('*')
        .in('id', skuIds)
        .eq('tenant_id', this.tenantId)
        .is('deleted_at', null);

      if (skuError) {
        return {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: skuError.message,
          },
        };
      }

      // Validate all SKUs exist
      const foundSkuIds = new Set((skus as SKURow[] || []).map(s => s.id));
      const missingSKUs = skuIds.filter(id => !foundSkuIds.has(id));
      
      if (missingSKUs.length > 0) {
        return {
          success: false,
          error: {
            code: 'SKU_NOT_FOUND',
            message: `SKU(s) not found in tenant inventory: ${missingSKUs.join(', ')}`,
          },
        };
      }

      // AC1.1: Create receipt header
      const { data: receiptData, error: receiptError } = await this.supabase
        .from('logistics_warehouse_receipts')
        .insert({
          tenant_id: input.tenant_id,
          po_number: input.po_number,
          vendor_id: input.vendor_id,
          received_date: input.received_date.toISOString().split('T')[0], // Date only
          receiver_notes: input.receiver_notes,
          status: 'pending_putaway', // AC1.1
        })
        .select()
        .single();

      if (receiptError || !receiptData) {
        return {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: receiptError?.message || 'Failed to create receipt',
          },
        };
      }

      // AC1.4: Calculate discrepancies and create line items
      const lineItemsToInsert = input.line_items.map(item => {
        const { status } = calculateDiscrepancy(
          item.expected_quantity,
          item.actual_quantity
        );
        // Note: discrepancy is GENERATED ALWAYS column, computed by database
        return {
          receipt_id: receiptData.id,
          tenant_id: input.tenant_id,
          sku_id: item.sku_id,
          expected_quantity: item.expected_quantity,
          actual_quantity: item.actual_quantity,
          // discrepancy: auto-calculated by database (GENERATED ALWAYS)
          discrepancy_status: status,
          uom: item.uom,
          target_bin_id: item.target_bin_id,
        };
      });

      const { data: lineItemsData, error: lineItemsError } = await this.supabase
        .from('logistics_warehouse_receipt_line_items')
        .insert(lineItemsToInsert)
        .select();

      if (lineItemsError || !lineItemsData) {
        // Rollback receipt creation
        await this.supabase
          .from('logistics_warehouse_receipts')
          .delete()
          .eq('id', receiptData.id);

        return {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: lineItemsError?.message || 'Failed to create line items',
          },
        };
      }

      // Map to domain entities
      const receipt = this.mapReceiptRowToEntity(receiptData as ReceiptRow);
      const lineItems = (lineItemsData as LineItemRow[]).map(this.mapLineItemRowToEntity);

      // Generate discrepancy summary
      const skuMap = new Map((skus as SKURow[]).map(s => [s.id, s]));
      const discrepancies: DiscrepancySummary[] = lineItems
        .filter(item => item.discrepancy_status !== 'match')
        .map(item => {
          const sku = skuMap.get(item.sku_id);
          return {
            sku_id: item.sku_id,
            sku_code: sku?.sku_code || 'UNKNOWN',
            expected: item.expected_quantity,
            actual: item.actual_quantity,
            variance: item.discrepancy,
            variance_percentage: item.expected_quantity > 0
              ? Math.abs((item.discrepancy / item.expected_quantity) * 100)
              : 0,
          };
        });

      const result: CreateReceiptResult = {
        receipt,
        line_items: lineItems,
        discrepancies,
      };

      // AC1.2: Audit trail - receipt creation logged by database triggers
      // Domain event will be published after inventory updates (R7-R9)

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Map database row to domain entity
   */
  private mapReceiptRowToEntity(row: ReceiptRow): WarehouseReceipt {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      po_number: row.po_number,
      vendor_id: row.vendor_id,
      received_date: new Date(row.received_date),
      receiver_notes: row.receiver_notes,
      status: row.status as any,
      submitted_at: row.submitted_at ? new Date(row.submitted_at) : undefined,
      submitted_by: row.submitted_by,
      completed_at: row.completed_at ? new Date(row.completed_at) : undefined,
      completed_by: row.completed_by,
      held_at: row.held_at ? new Date(row.held_at) : undefined,
      held_by: row.held_by,
      hold_reason: row.hold_reason,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      deleted_at: row.deleted_at ? new Date(row.deleted_at) : undefined,
    };
  }

  private mapLineItemRowToEntity(row: LineItemRow): ReceiptLineItem {
    return {
      id: row.id,
      receipt_id: row.receipt_id,
      tenant_id: row.tenant_id,
      sku_id: row.sku_id,
      expected_quantity: row.expected_quantity,
      actual_quantity: row.actual_quantity,
      discrepancy: row.discrepancy,
      discrepancy_status: row.discrepancy_status as any,
      uom: row.uom as any,
      target_bin_id: row.target_bin_id,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      deleted_at: row.deleted_at ? new Date(row.deleted_at) : undefined,
    };
  }
}
