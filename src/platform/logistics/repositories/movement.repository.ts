/**
 * E7.2 Movement Repository Implementation
 * 
 * Persistence layer for Inventory Movement.
 * 
 * Responsibilities:
 * - CRUD operations (create, read)
 * - Tenant isolation
 * - DB ↔ Domain mapping
 * 
 * NOT Responsibilities:
 * - Business rules (domain layer)
 * - Workflow orchestration (application layer)
 * - Product-specific logic (Warehouse, Finance)
 * 
 * Design:
 * - Supabase implementation
 * - Single table: lg_movements
 * - Tenant isolation via RLS
 * - Result<T> for all operations
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Result } from '../domain/core/result';
import type { InventoryMovement } from '../domain/movement.types';
import type { IMovementRepository, MovementFilters } from './movement.repository.interface';

export class MovementRepository implements IMovementRepository {
  private supabase: SupabaseClient;

  constructor(supabaseUrl?: string, supabaseKey?: string) {
    const url = supabaseUrl || process.env.SUPABASE_URL || '';
    const key = supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!url || !key) {
      throw new Error('Supabase URL and Service Role Key are required');
    }

    this.supabase = createClient(url, key);
  }

  /**
   * Find movement by ID
   * 
   * Tenant isolation enforced.
   */
  async findById(
    tenantId: string,
    movementId: string
  ): Promise<Result<InventoryMovement | null>> {
    try {
      const { data, error } = await this.supabase
        .from('lg_movements')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('id', movementId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Not found
          return Result.ok(null);
        }
        return Result.fail(
          `Failed to find movement: ${error.message}`,
          'MOVEMENT_FIND_FAILED'
        );
      }

      return Result.ok(this.mapToDomain(data));
    } catch (error) {
      return Result.fail(
        `Unexpected error finding movement: ${(error as Error).message}`,
        'MOVEMENT_FIND_ERROR'
      );
    }
  }

  /**
   * Find movement by movement number
   * 
   * Business key lookup with tenant isolation.
   */
  async findByMovementNumber(
    tenantId: string,
    movementNumber: string
  ): Promise<Result<InventoryMovement | null>> {
    try {
      const { data, error } = await this.supabase
        .from('lg_movements')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('movement_number', movementNumber)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return Result.ok(null);
        }
        return Result.fail(
          `Failed to find movement by number: ${error.message}`,
          'MOVEMENT_FIND_BY_NUMBER_FAILED'
        );
      }

      return Result.ok(this.mapToDomain(data));
    } catch (error) {
      return Result.fail(
        `Unexpected error finding movement by number: ${(error as Error).message}`,
        'MOVEMENT_FIND_BY_NUMBER_ERROR'
      );
    }
  }

  /**
   * List movements with filters
   * 
   * Supports common query patterns.
   */
  async list(
    tenantId: string,
    filters?: MovementFilters
  ): Promise<Result<InventoryMovement[]>> {
    try {
      let query = this.supabase
        .from('lg_movements')
        .select('*')
        .eq('tenant_id', tenantId);

      // Apply filters
      if (filters) {
        if (filters.itemId) {
          query = query.eq('item_id', filters.itemId);
        }
        if (filters.movementType) {
          query = query.eq('movement_type', filters.movementType);
        }
        if (filters.direction) {
          query = query.eq('direction', filters.direction);
        }
        if (filters.status) {
          query = query.eq('status', filters.status);
        }
        if (filters.fromLocationId) {
          query = query.eq('from_location_id', filters.fromLocationId);
        }
        if (filters.toLocationId) {
          query = query.eq('to_location_id', filters.toLocationId);
        }
        if (filters.lotNumber) {
          query = query.eq('lot_number', filters.lotNumber);
        }
        if (filters.serialNumber) {
          query = query.eq('serial_number', filters.serialNumber);
        }
        if (filters.dateFrom) {
          query = query.gte('movement_date', filters.dateFrom.toISOString());
        }
        if (filters.dateTo) {
          query = query.lte('movement_date', filters.dateTo.toISOString());
        }
      }

      // Order by movement date descending
      query = query.order('movement_date', { ascending: false });

      const { data, error } = await query;

      if (error) {
        return Result.fail(
          `Failed to list movements: ${error.message}`,
          'MOVEMENT_LIST_FAILED'
        );
      }

      const movements = data.map((row: any) => this.mapToDomain(row));
      return Result.ok(movements);
    } catch (error) {
      return Result.fail(
        `Unexpected error listing movements: ${(error as Error).message}`,
        'MOVEMENT_LIST_ERROR'
      );
    }
  }

  /**
   * Save movement (create or update)
   * 
   * Uses upsert for idempotency.
   */
  async save(movement: InventoryMovement): Promise<Result<InventoryMovement>> {
    try {
      const dbRow = this.mapToDb(movement);

      const { data, error } = await this.supabase
        .from('lg_movements')
        .upsert(dbRow)
        .select()
        .single();

      if (error) {
        return Result.fail(
          `Failed to save movement: ${error.message}`,
          'MOVEMENT_SAVE_FAILED'
        );
      }

      return Result.ok(this.mapToDomain(data));
    } catch (error) {
      return Result.fail(
        `Unexpected error saving movement: ${(error as Error).message}`,
        'MOVEMENT_SAVE_ERROR'
      );
    }
  }

  /**
   * Save batch of movements
   * 
   * Atomic operation (all or nothing).
   */
  async saveBatch(
    movements: InventoryMovement[]
  ): Promise<Result<InventoryMovement[]>> {
    try {
      const dbRows = movements.map((m) => this.mapToDb(m));

      const { data, error } = await this.supabase
        .from('lg_movements')
        .upsert(dbRows)
        .select();

      if (error) {
        return Result.fail(
          `Failed to save batch: ${error.message}`,
          'MOVEMENT_SAVE_BATCH_FAILED'
        );
      }

      const saved = data.map((row: any) => this.mapToDomain(row));
      return Result.ok(saved);
    } catch (error) {
      return Result.fail(
        `Unexpected error saving batch: ${(error as Error).message}`,
        'MOVEMENT_SAVE_BATCH_ERROR'
      );
    }
  }

  /**
   * Map DB row to domain entity
   * 
   * Handles null/undefined conversion and type mapping.
   */
  private mapToDomain(row: any): InventoryMovement {
    return {
      id: row.id,
      movementNumber: row.movement_number,
      tenantId: row.tenant_id,

      movementDate: new Date(row.movement_date),
      createdAt: new Date(row.created_at),
      createdBy: row.created_by,

      movementType: row.movement_type,
      direction: row.direction,

      itemId: row.item_id,

      fromLocationId: row.from_location_id,
      fromLocationType: row.from_location_type,
      toLocationId: row.to_location_id,
      toLocationType: row.to_location_type,

      quantity: parseFloat(row.quantity),
      unitOfMeasure: row.unit_of_measure,

      lotNumber: row.lot_number,
      serialNumber: row.serial_number,
      expiryDate: row.expiry_date ? new Date(row.expiry_date) : null,

      unitCost: row.unit_cost !== null ? parseFloat(row.unit_cost) : null,
      totalCost: row.total_cost !== null ? parseFloat(row.total_cost) : null,
      currency: row.currency,

      sourceDocumentType: row.source_document_type,
      sourceDocumentId: row.source_document_id,
      sourceDocumentNumber: row.source_document_number,
      sourceLineItemId: row.source_line_item_id,

      reason: row.reason,
      notes: row.notes,

      batchId: row.batch_id,

      approvedBy: row.approved_by,
      approvedAt: row.approved_at ? new Date(row.approved_at) : null,

      status: row.status,
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
      cancelledAt: row.cancelled_at ? new Date(row.cancelled_at) : null,
      cancellationReason: row.cancellation_reason,
    };
  }

  /**
   * Map domain entity to DB row
   * 
   * Converts domain types to database types.
   */
  private mapToDb(movement: InventoryMovement): any {
    return {
      id: movement.id,
      movement_number: movement.movementNumber,
      tenant_id: movement.tenantId,

      movement_date: movement.movementDate.toISOString(),
      created_at: movement.createdAt.toISOString(),
      created_by: movement.createdBy,

      movement_type: movement.movementType,
      direction: movement.direction,

      item_id: movement.itemId,

      from_location_id: movement.fromLocationId,
      from_location_type: movement.fromLocationType,
      to_location_id: movement.toLocationId,
      to_location_type: movement.toLocationType,

      quantity: movement.quantity,
      unit_of_measure: movement.unitOfMeasure,

      lot_number: movement.lotNumber,
      serial_number: movement.serialNumber,
      expiry_date: movement.expiryDate?.toISOString() || null,

      unit_cost: movement.unitCost,
      total_cost: movement.totalCost,
      currency: movement.currency,

      source_document_type: movement.sourceDocumentType,
      source_document_id: movement.sourceDocumentId,
      source_document_number: movement.sourceDocumentNumber,
      source_line_item_id: movement.sourceLineItemId,

      reason: movement.reason,
      notes: movement.notes,

      batch_id: movement.batchId,

      approved_by: movement.approvedBy,
      approved_at: movement.approvedAt?.toISOString() || null,

      status: movement.status,
      completed_at: movement.completedAt?.toISOString() || null,
      cancelled_at: movement.cancelledAt?.toISOString() || null,
      cancellation_reason: movement.cancellationReason,
    };
  }
}
