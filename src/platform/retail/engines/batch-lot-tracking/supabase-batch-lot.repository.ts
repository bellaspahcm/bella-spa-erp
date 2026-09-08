/**
 * Supabase Batch/Lot Repository Implementation
 * R4 Extension - Retail OS
 * 
 * Storage: retail_batches table
 * Security: RLS enforced, tenant isolation mandatory
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CreateBatchLotCommand,
  BatchLotCreatedEvent,
  UpdateBatchStockCommand,
  BatchStockUpdatedEvent,
  GetBatchQuery,
  GetExpiringBatchesQuery,
  BatchLot
} from '../../contracts/batch-lot-tracking.contract';
import type { IBatchLotRepository } from './batch-lot-repository.interface';

export class SupabaseBatchLotRepository implements IBatchLotRepository {
  constructor(private supabase: SupabaseClient) {}

  async createBatch(command: CreateBatchLotCommand): Promise<BatchLotCreatedEvent> {
    const { data, error } = await this.supabase
      .from('retail_product_batches')
      .insert({
        tenant_id: command.tenantId,
        product_id: command.productId,
        batch_number: command.batchNumber,
        lot_number: command.lotNumber || null,
        manufactured_date: command.manufacturedDate || null,
        expiry_date: command.expiryDate,
        initial_stock: command.initialStock,
        current_stock: command.initialStock,
        unit: command.unit,
        supplier_id: command.supplierId || null,
        notes: command.notes || null,
        metadata: command.metadata || {}
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create batch: ${error.message}`);
    }

    return {
      eventType: 'BATCH_LOT_CREATED',
      tenantId: command.tenantId,
      batchId: data.id,
      productId: command.productId,
      batchNumber: command.batchNumber,
      expiryDate: command.expiryDate,
      initialStock: command.initialStock,
      timestamp: new Date().toISOString()
    };
  }

  async updateStock(command: UpdateBatchStockCommand): Promise<BatchStockUpdatedEvent> {
    const { data, error } = await this.supabase
      .from('retail_product_batches')
      .update({
        current_stock: command.newStock,
        updated_at: new Date().toISOString()
      })
      .eq('id', command.batchId)
      .eq('tenant_id', command.tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update batch stock: ${error.message}`);
    }

    return {
      eventType: 'BATCH_STOCK_UPDATED',
      tenantId: command.tenantId,
      batchId: command.batchId,
      previousStock: data.initial_stock,
      newStock: command.newStock,
      timestamp: new Date().toISOString()
    };
  }

  async getBatchById(query: GetBatchQuery): Promise<BatchLot | null> {
    const { data, error } = await this.supabase
      .from('retail_product_batches')
      .select('*')
      .eq('id', query.batchId)
      .eq('tenant_id', query.tenantId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapToBatchLot(data);
  }

  async getBatchesForProduct(
    tenantId: string,
    productId: string
  ): Promise<BatchLot[]> {
    const { data, error } = await this.supabase
      .from('retail_product_batches')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('product_id', productId)
      .order('expiry_date', { ascending: true });

    if (error) {
      throw new Error(`Failed to get batches: ${error.message}`);
    }

    return (data || []).map(row => this.mapToBatchLot(row));
  }

  async getExpiringBatches(query: GetExpiringBatchesQuery): Promise<BatchLot[]> {
    const thresholdDate = new Date(query.thresholdDate);
    
    const { data, error } = await this.supabase
      .from('retail_product_batches')
      .select('*')
      .eq('tenant_id', query.tenantId)
      .lte('expiry_date', thresholdDate.toISOString())
      .gt('current_stock', 0)
      .order('expiry_date', { ascending: true });

    if (error) {
      throw new Error(`Failed to get expiring batches: ${error.message}`);
    }

    return (data || []).map(row => this.mapToBatchLot(row));
  }

  async getExpiredBatches(tenantId: string): Promise<BatchLot[]> {
    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('retail_product_batches')
      .select('*')
      .eq('tenant_id', tenantId)
      .lt('expiry_date', now)
      .gt('current_stock', 0)
      .order('expiry_date', { ascending: true });

    if (error) {
      throw new Error(`Failed to get expired batches: ${error.message}`);
    }

    return (data || []).map(row => this.mapToBatchLot(row));
  }

  private mapToBatchLot(row: any): BatchLot {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      productId: row.product_id,
      batchNumber: row.batch_number,
      lotNumber: row.lot_number,
      manufacturedDate: row.manufactured_date,
      expiryDate: row.expiry_date,
      initialStock: row.initial_stock,
      currentStock: row.current_stock,
      unit: row.unit,
      supplierId: row.supplier_id,
      notes: row.notes,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
