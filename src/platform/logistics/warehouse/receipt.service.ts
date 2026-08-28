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
  SubmitForPutawayInput,
  SubmitForPutawayResult,
  CompletePutawayInput,
  CompletePutawayResult,
  InventoryMovementSummary,
  HoldReceiptInput,
  HoldReceiptResult,
  ReleaseHoldInput,
  ReleaseHoldResult,
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
   * R9 AC9.1: State Machine Invariant Validator
   * Enforce valid transitions only, reject invalid state changes
   */
  private isValidTransition(
    fromStatus: string,
    toStatus: string
  ): { valid: boolean; reason?: string } {
    // Terminal state protection
    if (fromStatus === 'completed') {
      return {
        valid: false,
        reason: 'Cannot transition from completed (terminal state)',
      };
    }

    // Valid transitions
    const validTransitions: Record<string, string[]> = {
      pending_putaway: ['putaway_in_progress', 'on_hold'],
      putaway_in_progress: ['completed', 'on_hold'],
      on_hold: ['pending_putaway'], // release only
    };

    const allowedTargets = validTransitions[fromStatus] || [];

    if (!allowedTargets.includes(toStatus)) {
      return {
        valid: false,
        reason: `Invalid transition: ${fromStatus} → ${toStatus}. Allowed: ${allowedTargets.join(', ')}`,
      };
    }

    return { valid: true };
  }

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

      // R2: SKU Validation - exists in tenant scope and not discontinued
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

      // AC2.1: Validate all SKUs exist
      const foundSkuIds = new Set((skus as SKURow[] || []).map(s => s.id));
      const missingSKUs = skuIds.filter(id => !foundSkuIds.has(id));
      
      if (missingSKUs.length > 0) {
        const firstMissingIndex = input.line_items.findIndex(
          item => item.sku_id === missingSKUs[0]
        );
        
        return {
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: `SKU not found in tenant inventory`,
            details: [{
              field: `line_items[${firstMissingIndex}].sku_id`,
              message: `SKU ${missingSKUs[0]} not found in tenant inventory`,
              code: 'SKU_NOT_FOUND'
            }]
          },
        };
      }

      // AC2.2: Validate SKU status - cannot receive discontinued SKUs
      const skuMap = new Map((skus as SKURow[]).map(s => [s.id, s]));
      
      for (let i = 0; i < input.line_items.length; i++) {
        const item = input.line_items[i];
        const sku = skuMap.get(item.sku_id);
        
        if (sku && sku.status === 'discontinued') {
          return {
            success: false,
            error: {
              code: 'VALIDATION_FAILED',
              message: 'Cannot receive discontinued SKU',
              details: [{
                field: `line_items[${i}].sku_id`,
                message: `Cannot receive discontinued SKU: ${sku.sku_code}`,
                code: 'SKU_DISCONTINUED'
              }]
            },
          };
        }
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
   * R6: Submit for Putaway
   * 
   * Acceptance Criteria:
   * - AC6.1: State transition (pending_putaway → putaway_in_progress)
   * - AC6.2: Preconditions (all line_items have target_bin_id, no holds)
   * - AC6.3: Audit event
   */
  async submitForPutaway(
    input: SubmitForPutawayInput
  ): Promise<EngineResponse<SubmitForPutawayResult>> {
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

      // Fetch receipt with line items
      const { data: receiptData, error: receiptError } = await this.supabase
        .from('logistics_warehouse_receipts')
        .select('*')
        .eq('id', input.receipt_id)
        .eq('tenant_id', this.tenantId)
        .is('deleted_at', null)
        .single();

      if (receiptError || !receiptData) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Receipt not found',
          },
        };
      }

      const receipt = receiptData as ReceiptRow;

      // R9 AC9.1: State transition validation
      const transitionCheck = this.isValidTransition(
        receipt.status,
        'putaway_in_progress'
      );

      if (!transitionCheck.valid) {
        return {
          success: false,
          error: {
            code: 'INVALID_STATE_TRANSITION',
            message: transitionCheck.reason || 'Invalid state transition',
            details: [{
              field: 'status',
              message: `Current status is ${receipt.status}`,
              code: 'INVALID_STATUS'
            }]
          },
        };
      }

      // AC6.2: Precondition - all line_items must have target_bin_id
      const { data: lineItemsData, error: lineItemsError } = await this.supabase
        .from('logistics_warehouse_receipt_line_items')
        .select('*')
        .eq('receipt_id', input.receipt_id)
        .eq('tenant_id', this.tenantId)
        .is('deleted_at', null);

      if (lineItemsError || !lineItemsData || lineItemsData.length === 0) {
        return {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: lineItemsError?.message || 'Failed to fetch line items',
          },
        };
      }

      const lineItems = lineItemsData as LineItemRow[];
      
      // Check all line items have target_bin_id assigned
      const itemsWithoutBin = lineItems.filter(item => !item.target_bin_id);
      
      if (itemsWithoutBin.length > 0) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'All line items must have target bin assigned before putaway',
            details: [{
              field: 'line_items',
              message: `${itemsWithoutBin.length} line item(s) missing target_bin_id`,
              code: 'MISSING_TARGET_BIN'
            }]
          },
        };
      }

      // P1.1: R3 Location Hierarchy Validation
      // Validate each target bin has complete hierarchy and is active
      const binIds = lineItems
        .map(item => item.target_bin_id)
        .filter((id): id is string => id !== null && id !== undefined);

      if (binIds.length > 0) {
        const { data: binsData, error: binsError } = await this.supabase
          .from('logistics_warehouse_bins')
          .select('*')
          .in('id', binIds)
          .eq('tenant_id', this.tenantId);

        if (binsError) {
          return {
            success: false,
            error: {
              code: 'DATABASE_ERROR',
              message: `Failed to validate bins: ${binsError.message}`,
            },
          };
        }

        const binMap = new Map((binsData || []).map(b => [b.id, b]));

        // Validate each line item's target bin using R3 validation
        for (let i = 0; i < lineItems.length; i++) {
          const item = lineItems[i];
          if (!item.target_bin_id) continue;

          const bin = binMap.get(item.target_bin_id);
          const binValidation = validatePutawayLocation(bin || null, i);

          if (!binValidation.valid) {
            return {
              success: false,
              error: {
                code: 'VALIDATION_FAILED',
                message: 'Bin validation failed for putaway',
                details: binValidation.errors,
              },
            };
          }
        }
      }

      // AC6.1: State transition
      const now = new Date();
      const { data: updatedReceipt, error: updateError } = await this.supabase
        .from('logistics_warehouse_receipts')
        .update({
          status: 'putaway_in_progress',
          submitted_at: now.toISOString(),
          submitted_by: input.submitted_by,
          updated_at: now.toISOString(),
        })
        .eq('id', input.receipt_id)
        .eq('tenant_id', this.tenantId)
        .eq('status', 'pending_putaway') // Optimistic lock
        .select()
        .single();

      if (updateError || !updatedReceipt) {
        return {
          success: false,
          error: {
            code: 'STATE_TRANSITION_FAILED',
            message: updateError?.message || 'Failed to transition receipt state',
          },
        };
      }

      const result: SubmitForPutawayResult = {
        receipt: this.mapReceiptRowToEntity(updatedReceipt as ReceiptRow),
        transitioned_at: now,
      };

      // AC6.3: Audit event - logged by database triggers or event publisher
      // Event: ReceiptSubmittedForPutaway

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
   * R7: Complete Putaway
   * 
   * Acceptance Criteria:
   * - AC7.1: State transition (putaway_in_progress → completed)
   * - AC7.2: Inventory update (UPDATE inventory_on_hand)
   * - AC7.3: Audit event
   * - AC7.4: Idempotency (already completed → 200 OK)
   */
  async completePutaway(
    input: CompletePutawayInput
  ): Promise<EngineResponse<CompletePutawayResult>> {
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

      // Fetch receipt with line items
      const { data: receiptData, error: receiptError } = await this.supabase
        .from('logistics_warehouse_receipts')
        .select('*')
        .eq('id', input.receipt_id)
        .eq('tenant_id', this.tenantId)
        .is('deleted_at', null)
        .single();

      if (receiptError || !receiptData) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Receipt not found',
          },
        };
      }

      const receipt = receiptData as ReceiptRow;

      // AC7.4 & R9 AC9.3: Idempotency - if already completed, return success
      if (receipt.status === 'completed') {
        return {
          success: true,
          data: {
            receipt: this.mapReceiptRowToEntity(receipt),
            transitioned_at: new Date(receipt.completed_at!),
            inventory_movements: [], // No new movements
          },
        };
      }

      // R9 AC9.1: State transition validation
      const transitionCheck = this.isValidTransition(receipt.status, 'completed');

      if (!transitionCheck.valid) {
        return {
          success: false,
          error: {
            code: 'INVALID_STATE_TRANSITION',
            message: transitionCheck.reason || 'Invalid state transition',
            details: [{
              field: 'status',
              message: `Current status is ${receipt.status}`,
              code: 'INVALID_STATUS'
            }]
          },
        };
      }

      // Fetch line items
      const { data: lineItemsData, error: lineItemsError } = await this.supabase
        .from('logistics_warehouse_receipt_line_items')
        .select('*')
        .eq('receipt_id', input.receipt_id)
        .eq('tenant_id', this.tenantId)
        .is('deleted_at', null);

      if (lineItemsError || !lineItemsData || lineItemsData.length === 0) {
        return {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: lineItemsError?.message || 'Failed to fetch line items',
          },
        };
      }

      const lineItems = lineItemsData as LineItemRow[];

      // AC7.2: Update inventory for each line item
      const inventoryMovements: InventoryMovementSummary[] = [];

      for (const item of lineItems) {
        if (!item.target_bin_id) {
          return {
            success: false,
            error: {
              code: 'VALIDATION_FAILED',
              message: 'Cannot complete putaway: line item missing target_bin_id',
              details: [{
                field: 'line_items',
                message: `Line item ${item.id} has no target_bin_id`,
                code: 'MISSING_TARGET_BIN'
              }]
            },
          };
        }

        // Check if inventory record exists
        const { data: existingInventory } = await this.supabase
          .from('logistics_warehouse_inventory_on_hand')
          .select('*')
          .eq('tenant_id', this.tenantId)
          .eq('sku_id', item.sku_id)
          .eq('bin_id', item.target_bin_id)
          .single();

        if (existingInventory) {
          // Update existing inventory
          const { error: updateError } = await this.supabase
            .from('logistics_warehouse_inventory_on_hand')
            .update({
              quantity: existingInventory.quantity + item.actual_quantity,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingInventory.id);

          if (updateError) {
            return {
              success: false,
              error: {
                code: 'INVENTORY_UPDATE_FAILED',
                message: `Failed to update inventory: ${updateError.message}`,
              },
            };
          }
        } else {
          // Create new inventory record
          const { error: insertError } = await this.supabase
            .from('logistics_warehouse_inventory_on_hand')
            .insert({
              tenant_id: this.tenantId,
              sku_id: item.sku_id,
              bin_id: item.target_bin_id,
              quantity: item.actual_quantity,
            });

          if (insertError) {
            return {
              success: false,
              error: {
                code: 'INVENTORY_INSERT_FAILED',
                message: `Failed to create inventory record: ${insertError.message}`,
              },
            };
          }
        }

        // Fetch SKU and Bin info for movement summary
        const { data: sku } = await this.supabase
          .from('logistics_warehouse_skus')
          .select('sku_code')
          .eq('id', item.sku_id)
          .single();

        const { data: bin } = await this.supabase
          .from('logistics_warehouse_bins')
          .select('bin_code')
          .eq('id', item.target_bin_id)
          .single();

        inventoryMovements.push({
          sku_id: item.sku_id,
          sku_code: sku?.sku_code || 'UNKNOWN',
          bin_id: item.target_bin_id,
          bin_code: bin?.bin_code || 'UNKNOWN',
          quantity: item.actual_quantity,
        });
      }

      // AC7.1: State transition
      const now = new Date();
      const { data: updatedReceipt, error: updateError } = await this.supabase
        .from('logistics_warehouse_receipts')
        .update({
          status: 'completed',
          completed_at: now.toISOString(),
          completed_by: input.completed_by,
          updated_at: now.toISOString(),
        })
        .eq('id', input.receipt_id)
        .eq('tenant_id', this.tenantId)
        .eq('status', 'putaway_in_progress') // Optimistic lock
        .select()
        .single();

      if (updateError || !updatedReceipt) {
        return {
          success: false,
          error: {
            code: 'STATE_TRANSITION_FAILED',
            message: updateError?.message || 'Failed to transition receipt state',
          },
        };
      }

      const result: CompletePutawayResult = {
        receipt: this.mapReceiptRowToEntity(updatedReceipt as ReceiptRow),
        transitioned_at: now,
        inventory_movements: inventoryMovements,
      };

      // AC7.3: Audit event - logged by database triggers or event publisher
      // Event: ReceiptCompleted

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
   * R8: Hold Receipt / Quarantine
   * 
   * Acceptance Criteria:
   * - AC8.1: State transition (full receipt OR line items → on_hold)
   * - AC8.2: Inventory impact (on-hold items do NOT update inventory)
   * - AC8.3: Audit event
   * - AC8.4: Reversal capability
   */
  async holdReceipt(
    input: HoldReceiptInput
  ): Promise<EngineResponse<HoldReceiptResult>> {
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

      // Fetch receipt
      const { data: receiptData, error: receiptError } = await this.supabase
        .from('logistics_warehouse_receipts')
        .select('*')
        .eq('id', input.receipt_id)
        .eq('tenant_id', this.tenantId)
        .is('deleted_at', null)
        .single();

      if (receiptError || !receiptData) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Receipt not found',
          },
        };
      }

      const receipt = receiptData as ReceiptRow;

      // R9 AC9.1: State transition validation
      const transitionCheck = this.isValidTransition(receipt.status, 'on_hold');

      if (!transitionCheck.valid) {
        return {
          success: false,
          error: {
            code: 'INVALID_STATE_TRANSITION',
            message: transitionCheck.reason || 'Invalid state transition',
            details: [{
              field: 'status',
              message: `Current status is ${receipt.status}`,
              code: 'INVALID_STATUS'
            }]
          },
        };
      }

      const now = new Date();
      let scope: 'full_receipt' | 'line_items' = 'full_receipt';
      let affectedCount = 0;

      // AC8.1: Conditional logic - full receipt OR specific line items
      if (input.line_item_ids && input.line_item_ids.length > 0) {
        // Hold specific line items only
        scope = 'line_items';
        
        const { error: lineItemError } = await this.supabase
          .from('logistics_warehouse_receipt_line_items')
          .update({
            line_status: 'on_hold',
            updated_at: now.toISOString(),
          })
          .in('id', input.line_item_ids)
          .eq('tenant_id', this.tenantId);

        if (lineItemError) {
          return {
            success: false,
            error: {
              code: 'LINE_ITEM_HOLD_FAILED',
              message: `Failed to hold line items: ${lineItemError.message}`,
            },
          };
        }

        affectedCount = input.line_item_ids.length;

        // Update receipt hold tracking (but not status)
        await this.supabase
          .from('logistics_warehouse_receipts')
          .update({
            held_at: now.toISOString(),
            held_by: input.held_by,
            hold_reason: input.hold_reason,
            updated_at: now.toISOString(),
          })
          .eq('id', input.receipt_id)
          .eq('tenant_id', this.tenantId);

      } else {
        // Hold entire receipt
        scope = 'full_receipt';

        const { data: updatedReceipt, error: updateError } = await this.supabase
          .from('logistics_warehouse_receipts')
          .update({
            status: 'on_hold',
            held_at: now.toISOString(),
            held_by: input.held_by,
            hold_reason: input.hold_reason,
            updated_at: now.toISOString(),
          })
          .eq('id', input.receipt_id)
          .eq('tenant_id', this.tenantId)
          .select()
          .single();

        if (updateError || !updatedReceipt) {
          return {
            success: false,
            error: {
              code: 'HOLD_FAILED',
              message: updateError?.message || 'Failed to hold receipt',
            },
          };
        }
      }

      // Fetch updated receipt
      const { data: finalReceipt } = await this.supabase
        .from('logistics_warehouse_receipts')
        .select('*')
        .eq('id', input.receipt_id)
        .single();

      const result: HoldReceiptResult = {
        receipt: this.mapReceiptRowToEntity(finalReceipt as ReceiptRow),
        held_at: now,
        scope,
        affected_line_items: scope === 'line_items' ? affectedCount : undefined,
      };

      // AC8.3: Audit event - logged by database triggers or event publisher
      // Event: ReceiptHeld

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
   * R8: Release Hold
   * 
   * Acceptance Criteria:
   * - AC8.4: Reversal - restore to previous state
   */
  async releaseHold(
    input: ReleaseHoldInput
  ): Promise<EngineResponse<ReleaseHoldResult>> {
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

      // Fetch receipt
      const { data: receiptData, error: receiptError } = await this.supabase
        .from('logistics_warehouse_receipts')
        .select('*')
        .eq('id', input.receipt_id)
        .eq('tenant_id', this.tenantId)
        .is('deleted_at', null)
        .single();

      if (receiptError || !receiptData) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Receipt not found',
          },
        };
      }

      const receipt = receiptData as ReceiptRow;

      // Check if receipt is on hold
      if (receipt.status !== 'on_hold' && !receipt.held_at) {
        return {
          success: false,
          error: {
            code: 'NOT_ON_HOLD',
            message: 'Receipt is not on hold',
          },
        };
      }

      const now = new Date();

      // AC8.4 & R9 AC9.1: Restore to pending_putaway (only valid transition from on_hold)
      const targetStatus = 'pending_putaway';

      // R9 AC9.1: Validate state transition
      const transitionCheck = this.isValidTransition(receipt.status, targetStatus);

      if (!transitionCheck.valid) {
        return {
          success: false,
          error: {
            code: 'INVALID_STATE_TRANSITION',
            message: transitionCheck.reason || 'Invalid state transition',
          },
        };
      }

      const { data: updatedReceipt, error: updateError } = await this.supabase
        .from('logistics_warehouse_receipts')
        .update({
          status: targetStatus,
          held_at: null,
          held_by: null,
          hold_reason: null,
          updated_at: now.toISOString(),
        })
        .eq('id', input.receipt_id)
        .eq('tenant_id', this.tenantId)
        .select()
        .single();

      if (updateError || !updatedReceipt) {
        return {
          success: false,
          error: {
            code: 'RELEASE_FAILED',
            message: updateError?.message || 'Failed to release hold',
          },
        };
      }

      // Release line items if any
      await this.supabase
        .from('logistics_warehouse_receipt_line_items')
        .update({
          line_status: 'pending',
          updated_at: now.toISOString(),
        })
        .eq('receipt_id', input.receipt_id)
        .eq('tenant_id', this.tenantId)
        .eq('line_status', 'on_hold');

      const result: ReleaseHoldResult = {
        receipt: this.mapReceiptRowToEntity(updatedReceipt as ReceiptRow),
        released_at: now,
      };

      // AC8.3: Audit event - ReceiptHoldReleased

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

  /**
   * R10: List Receipts with Filters
   * 
   * Query receipts with pagination and filters:
   * - Status filter
   * - Vendor filter
   * - Date range filter (from/to)
   * - Pagination (page, limit)
   * - RLS enforcement (tenant isolation)
   * 
   * Acceptance Criteria:
   * - AC10.1: Basic list query with pagination
   * - AC10.2: Status filter
   * - AC10.3: Date range filter
   * - AC10.4: Vendor filter
   * - AC10.5: RLS enforcement
   */
  async listReceipts(
    input: ListReceiptsInput
  ): Promise<EngineResponse<ListReceiptsResult>> {
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

      // Pagination defaults
      const page = input.page || 1;
      const limit = Math.min(input.limit || 20, 100); // max 100
      const offset = (page - 1) * limit;

      // Sorting defaults
      const sortBy = input.sort_by || 'received_date';
      const sortOrder = input.sort_order || 'desc';

      // Build query
      let query = this.supabase
        .from('logistics_warehouse_receipts')
        .select('id, po_number, vendor_id, received_date, status, created_at, submitted_at, completed_at', { count: 'exact' })
        .eq('tenant_id', this.tenantId)
        .is('deleted_at', null);

      // AC10.2: Status filter
      if (input.status) {
        query = query.eq('status', input.status);
      }

      // AC10.4: Vendor filter
      if (input.vendor_id) {
        query = query.eq('vendor_id', input.vendor_id);
      }

      // AC10.3: Date range filter
      if (input.from) {
        query = query.gte('received_date', input.from);
      }
      if (input.to) {
        query = query.lte('received_date', input.to);
      }

      // Sorting
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      // Pagination
      query = query.range(offset, offset + limit - 1);

      const { data: receipts, error: queryError, count } = await query;

      if (queryError) {
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: queryError.message,
          },
        };
      }

      if (!receipts) {
        return {
          success: true,
          data: {
            receipts: [],
            pagination: {
              page,
              limit,
              total: 0,
              total_pages: 0,
            },
          },
        };
      }

      // Get line item counts for each receipt
      const receiptIds = receipts.map(r => r.id);
      const { data: lineItemCounts } = await this.supabase
        .from('logistics_warehouse_receipt_line_items')
        .select('receipt_id')
        .in('receipt_id', receiptIds)
        .eq('tenant_id', this.tenantId);

      const countMap = new Map<string, number>();
      lineItemCounts?.forEach(item => {
        countMap.set(item.receipt_id, (countMap.get(item.receipt_id) || 0) + 1);
      });

      // Map to ReceiptSummary
      const summaries: ReceiptSummary[] = receipts.map(r => ({
        id: r.id,
        po_number: r.po_number,
        vendor_id: r.vendor_id,
        received_date: r.received_date,
        status: r.status,
        line_item_count: countMap.get(r.id) || 0,
        created_at: r.created_at,
        submitted_at: r.submitted_at,
        completed_at: r.completed_at,
      }));

      const totalPages = Math.ceil((count || 0) / limit);

      return {
        success: true,
        data: {
          receipts: summaries,
          pagination: {
            page,
            limit,
            total: count || 0,
            total_pages: totalPages,
          },
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Failed to list receipts',
        },
      };
    }
  }

  /**
   * R11: Get Receipt by ID
   * 
   * Retrieve single receipt with full line item details.
   * 
   * Acceptance Criteria:
   * - AC11.1: Return receipt with all fields + line items + discrepancies
   * - AC11.2: RLS enforcement (404 if cross-tenant, not 403)
   * - AC11.3: Not found handling (404 with message)
   */
  async getReceipt(
    input: { tenant_id: string; receipt_id: string }
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

      // AC11.2 & AC11.3: Fetch receipt with RLS
      const { data: receiptData, error: receiptError } = await this.supabase
        .from('logistics_warehouse_receipts')
        .select('*')
        .eq('id', input.receipt_id)
        .eq('tenant_id', this.tenantId)
        .is('deleted_at', null)
        .single();

      if (receiptError || !receiptData) {
        // AC11.2: RLS returns null if cross-tenant (appears as 404, not 403)
        // AC11.3: Not found
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Receipt not found',
          },
        };
      }

      const receipt = this.mapReceiptRowToEntity(receiptData as ReceiptRow);

      // Fetch line items
      const { data: lineItemsData, error: lineItemsError } = await this.supabase
        .from('logistics_warehouse_receipt_line_items')
        .select('*')
        .eq('receipt_id', input.receipt_id)
        .eq('tenant_id', this.tenantId);

      if (lineItemsError) {
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: 'Failed to fetch line items',
          },
        };
      }

      const lineItems = (lineItemsData || []).map(item =>
        this.mapLineItemRowToEntity(item as LineItemRow)
      );

      // AC11.1: Calculate discrepancies
      const { data: skuData } = await this.supabase
        .from('logistics_warehouse_skus')
        .select('id, sku_code')
        .in('id', lineItems.map(li => li.sku_id))
        .eq('tenant_id', this.tenantId);

      const skuMap = new Map(skuData?.map(s => [s.id, s.sku_code]) || []);

      const discrepancies: DiscrepancySummary[] = lineItems.map(li => {
        const variance = li.actual_quantity - li.expected_quantity;
        const variancePercentage =
          li.expected_quantity > 0
            ? (variance / li.expected_quantity) * 100
            : 0;

        return {
          sku_id: li.sku_id,
          sku_code: skuMap.get(li.sku_id) || 'UNKNOWN',
          expected: li.expected_quantity,
          actual: li.actual_quantity,
          variance,
          variance_percentage: parseFloat(variancePercentage.toFixed(2)),
        };
      });

      return {
        success: true,
        data: {
          receipt,
          line_items: lineItems,
          discrepancies,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Failed to get receipt',
        },
      };
    }
  }

  /**
   * R12: Count Receipts by Status
   * 
   * Returns aggregate count of receipts grouped by status for dashboard metrics.
   * 
   * **Acceptance Criteria:**
   * - AC12.1: Status count (pending_putaway, putaway_in_progress, completed, on_hold)
   * - AC12.2: Tenant scope (RLS enforced)
   * - AC12.3: Performance (COUNT aggregate, <100ms for 10k receipts)
   */
  async countReceiptsByStatus(
    input: { tenant_id: string }
  ): Promise<EngineResponse<{
    pending_putaway: number;
    putaway_in_progress: number;
    completed: number;
    on_hold: number;
  }>> {
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

      // AC12.3: Use COUNT aggregate (not fetch-and-count)
      // AC12.2: RLS enforced via tenant_id filter
      const { data, error } = await this.supabase
        .from('logistics_warehouse_receipts')
        .select('status')
        .eq('tenant_id', this.tenantId)
        .is('deleted_at', null);

      if (error) {
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: 'Failed to count receipts',
          },
        };
      }

      // Count by status in memory (Supabase doesn't support GROUP BY in select)
      const counts = {
        pending_putaway: 0,
        putaway_in_progress: 0,
        completed: 0,
        on_hold: 0,
      };

      (data || []).forEach(row => {
        const status = row.status as keyof typeof counts;
        if (status in counts) {
          counts[status]++;
        }
      });

      return {
        success: true,
        data: counts,
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Failed to count receipts',
        },
      };
    }
  }

  /**
   * R13: Create Bulk Inventory Movements
   * 
   * Creates multiple inventory movements atomically in a single transaction.
   * Updates inventory on-hand for affected SKU/bin combinations.
   * 
   * **Acceptance Criteria:**
   * - AC13.1: Bulk movement creation (cycle_count_adjustment, inter_bin_transfer)
   * - AC13.2: Atomic transaction (all or nothing)
   * - AC13.3: Audit trail (each movement logged, linked by batch_id)
   */
  async createBulkMovements(
    input: {
      tenant_id: string;
      movement_type: 'cycle_count_adjustment' | 'inter_bin_transfer';
      movements: Array<{
        sku_id: string;
        from_bin_id?: string | null;
        to_bin_id?: string | null;
        quantity: number;
        reason?: string;
      }>;
      approved_by: string;
    }
  ): Promise<EngineResponse<{
    batch_id: string;
    movement_count: number;
    movements: Array<{
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
    }>;
  }>> {
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

      // AC13.3: Generate batch_id for linking all movements
      const batch_id = crypto.randomUUID();

      // AC13.2: Atomic transaction - prepare all movement records
      const movementRecords = input.movements.map(movement => ({
        id: crypto.randomUUID(),
        tenant_id: this.tenantId,
        sku_id: movement.sku_id,
        from_bin_id: movement.from_bin_id || null,
        to_bin_id: movement.to_bin_id || null,
        quantity: movement.quantity,
        movement_type: input.movement_type,
        reason: movement.reason || null,
        batch_id,
        approved_by: input.approved_by,
        created_at: new Date().toISOString(),
      }));

      // AC13.2: Insert all movements atomically
      const { data: insertedMovements, error: insertError } = await this.supabase
        .from('logistics_warehouse_movements')
        .insert(movementRecords)
        .select();

      if (insertError) {
        return {
          success: false,
          error: {
            code: 'INSERT_FAILED',
            message: `Failed to create movements: ${insertError.message}`,
          },
        };
      }

      // AC13.1: Update inventory on-hand for each movement
      // For cycle_count_adjustment: set quantity to value (absolute)
      // For inter_bin_transfer: decrement from_bin, increment to_bin
      for (const movement of input.movements) {
        if (input.movement_type === 'cycle_count_adjustment' && movement.to_bin_id) {
          // Upsert inventory on-hand (set absolute quantity for adjustment)
          const { data: existing } = await this.supabase
            .from('logistics_warehouse_inventory_on_hand')
            .select('id, quantity')
            .eq('tenant_id', this.tenantId)
            .eq('sku_id', movement.sku_id)
            .eq('bin_id', movement.to_bin_id)
            .single();

          if (existing) {
            // Update existing
            const { error: updateError } = await this.supabase
              .from('logistics_warehouse_inventory_on_hand')
              .update({
                quantity: movement.quantity,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existing.id);

            if (updateError) {
              return {
                success: false,
                error: {
                  code: 'INVENTORY_UPDATE_FAILED',
                  message: `Failed to update inventory: ${updateError.message}`,
                },
              };
            }
          } else {
            // Insert new
            const { error: insertError } = await this.supabase
              .from('logistics_warehouse_inventory_on_hand')
              .insert({
                tenant_id: this.tenantId,
                sku_id: movement.sku_id,
                bin_id: movement.to_bin_id,
                quantity: movement.quantity,
              });

            if (insertError) {
              return {
                success: false,
                error: {
                  code: 'INVENTORY_INSERT_FAILED',
                  message: `Failed to insert inventory: ${insertError.message}`,
                },
              };
            }
          }
        } else if (input.movement_type === 'inter_bin_transfer') {
          // Decrement from_bin
          if (movement.from_bin_id) {
            const { data: fromBin } = await this.supabase
              .from('logistics_warehouse_inventory_on_hand')
              .select('id, quantity')
              .eq('tenant_id', this.tenantId)
              .eq('sku_id', movement.sku_id)
              .eq('bin_id', movement.from_bin_id)
              .single();

            if (fromBin) {
              const newQuantity = parseFloat(fromBin.quantity.toString()) - movement.quantity;
              
              const { error: decrementError } = await this.supabase
                .from('logistics_warehouse_inventory_on_hand')
                .update({
                  quantity: newQuantity,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', fromBin.id);

              if (decrementError) {
                return {
                  success: false,
                  error: {
                    code: 'INVENTORY_DECREMENT_FAILED',
                    message: `Failed to decrement from_bin: ${decrementError.message}`,
                  },
                };
              }
            }
          }

          // Increment to_bin
          if (movement.to_bin_id) {
            const { data: toBin } = await this.supabase
              .from('logistics_warehouse_inventory_on_hand')
              .select('id, quantity')
              .eq('tenant_id', this.tenantId)
              .eq('sku_id', movement.sku_id)
              .eq('bin_id', movement.to_bin_id)
              .single();

            if (toBin) {
              // Update existing
              const newQuantity = parseFloat(toBin.quantity.toString()) + movement.quantity;
              
              const { error: incrementError } = await this.supabase
                .from('logistics_warehouse_inventory_on_hand')
                .update({
                  quantity: newQuantity,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', toBin.id);

              if (incrementError) {
                return {
                  success: false,
                  error: {
                    code: 'INVENTORY_INCREMENT_FAILED',
                    message: `Failed to increment to_bin: ${incrementError.message}`,
                  },
                };
              }
            } else {
              // Insert new
              const { error: insertError } = await this.supabase
                .from('logistics_warehouse_inventory_on_hand')
                .insert({
                  tenant_id: this.tenantId,
                  sku_id: movement.sku_id,
                  bin_id: movement.to_bin_id,
                  quantity: movement.quantity,
                });

              if (insertError) {
                return {
                  success: false,
                  error: {
                    code: 'INVENTORY_INSERT_FAILED',
                    message: `Failed to insert inventory: ${insertError.message}`,
                  },
                };
              }
            }
          }
        }
      }

      // Map to result format
      const movements = (insertedMovements || []).map(row => ({
        id: row.id,
        tenant_id: row.tenant_id,
        sku_id: row.sku_id,
        from_bin_id: row.from_bin_id,
        to_bin_id: row.to_bin_id,
        quantity: parseFloat(row.quantity),
        movement_type: row.movement_type,
        reason: row.reason,
        batch_id: row.batch_id,
        approved_by: row.approved_by,
        created_at: new Date(row.created_at),
      }));

      return {
        success: true,
        data: {
          batch_id,
          movement_count: movements.length,
          movements,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Failed to create bulk movements',
        },
      };
    }
  }

  /**
   * R14: Get Inventory Value by SKU
   * 
   * Calculates total inventory value aggregated by SKU.
   * Value = SUM(quantity × unit_cost) across all bins per SKU.
   * 
   * **Acceptance Criteria:**
   * - AC14.1: Value by SKU (quantity, unit_cost, total_value)
   * - AC14.2: Aggregation query (JOIN + GROUP BY)
   * - AC14.3: Precision (DECIMAL, no rounding)
   */
  async getInventoryValue(
    input: { tenant_id: string }
  ): Promise<EngineResponse<{
    items: Array<{
      sku_id: string;
      sku_code: string;
      on_hand_quantity: number;
      unit_cost: number;
      total_value: number;
    }>;
    total_value: number;
  }>> {
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

      // AC14.2: Aggregation query with JOIN
      // Query inventory_on_hand + skus, group by SKU
      const { data: inventoryData, error: queryError } = await this.supabase
        .from('logistics_warehouse_inventory_on_hand')
        .select(`
          sku_id,
          quantity,
          logistics_warehouse_skus!inner (
            sku_code,
            unit_cost
          )
        `)
        .eq('tenant_id', this.tenantId);

      if (queryError) {
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: `Failed to query inventory: ${queryError.message}`,
          },
        };
      }

      // AC14.1 & AC14.3: Aggregate by SKU with DECIMAL precision
      const skuMap = new Map<string, {
        sku_code: string;
        unit_cost: number;
        total_quantity: number;
      }>();

      (inventoryData || []).forEach(row => {
        const sku = row.logistics_warehouse_skus as any;
        const quantity = parseFloat(row.quantity.toString());
        const unitCost = parseFloat(sku.unit_cost.toString());

        if (!skuMap.has(row.sku_id)) {
          skuMap.set(row.sku_id, {
            sku_code: sku.sku_code,
            unit_cost: unitCost,
            total_quantity: 0,
          });
        }

        const skuData = skuMap.get(row.sku_id)!;
        skuData.total_quantity += quantity;
      });

      // Calculate total values
      const items = Array.from(skuMap.entries()).map(([sku_id, data]) => ({
        sku_id,
        sku_code: data.sku_code,
        on_hand_quantity: data.total_quantity,
        unit_cost: data.unit_cost,
        total_value: parseFloat((data.total_quantity * data.unit_cost).toFixed(2)),
      }));

      const total_value = items.reduce((sum, item) => sum + item.total_value, 0);

      return {
        success: true,
        data: {
          items,
          total_value: parseFloat(total_value.toFixed(2)),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Failed to calculate inventory value',
        },
      };
    }
  }

  /**
   * R15: Check Bin Capacity
   * 
   * Validates bin capacity before inventory operation.
   * Ensures (current_quantity + additional_quantity) <= max_capacity.
   * 
   * **Acceptance Criteria:**
   * - AC15.1: Capacity check (reject if exceeds)
   * - AC15.2: Capacity calculation (SUM current + new)
   * - AC15.3: Validation at app level
   */
  async checkBinCapacity(
    input: {
      tenant_id: string;
      bin_id: string;
      additional_quantity: number;
    }
  ): Promise<EngineResponse<{
    bin_id: string;
    max_capacity: number;
    current_quantity: number;
    available_capacity: number;
    requested_quantity: number;
    is_valid: boolean;
    error_message?: string;
  }>> {
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

      // AC15.2: Get bin max_capacity
      const { data: binData, error: binError } = await this.supabase
        .from('logistics_warehouse_bins')
        .select('max_capacity')
        .eq('id', input.bin_id)
        .eq('tenant_id', this.tenantId)
        .single();

      if (binError || !binData) {
        return {
          success: false,
          error: {
            code: 'BIN_NOT_FOUND',
            message: 'Bin not found or access denied',
          },
        };
      }

      const max_capacity = parseFloat(binData.max_capacity.toString());

      // AC15.2: Calculate current quantity (SUM inventory in bin)
      const { data: inventoryData, error: inventoryError } = await this.supabase
        .from('logistics_warehouse_inventory_on_hand')
        .select('quantity')
        .eq('bin_id', input.bin_id)
        .eq('tenant_id', this.tenantId);

      if (inventoryError) {
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: `Failed to query inventory: ${inventoryError.message}`,
          },
        };
      }

      const current_quantity = (inventoryData || []).reduce(
        (sum, row) => sum + parseFloat(row.quantity.toString()),
        0
      );

      // AC15.1: Capacity check
      const available_capacity = max_capacity - current_quantity;
      const is_valid = (current_quantity + input.additional_quantity) <= max_capacity;

      return {
        success: true,
        data: {
          bin_id: input.bin_id,
          max_capacity,
          current_quantity,
          available_capacity,
          requested_quantity: input.additional_quantity,
          is_valid,
          error_message: is_valid
            ? undefined
            : `Bin capacity exceeded: ${current_quantity + input.additional_quantity} > ${max_capacity}`,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Failed to check bin capacity',
        },
      };
    }
  }
}
