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
      id: { value: row.id },
      movement_number: { value: row.movement_number },
      tenant_id: row.tenant_id,

      movement_date: new Date(row.movement_date),
      created_at: new Date(row.created_at),
      created_by: row.created_by,

      movement_type: row.movement_type,
      direction: row.direction,

      item_id: { value: row.item_id },

      from_location_id: row.from_location_id ? { value: row.from_location_id } : undefined,
      from_location_type: row.from_location_type,
      to_location_id: row.to_location_id ? { value: row.to_location_id } : undefined,
      to_location_type: row.to_location_type,

      quantity: parseFloat(row.quantity),
      unit_of_measure: row.unit_of_measure,

      lot_number: row.lot_number ? { value: row.lot_number } : undefined,
      serial_number: row.serial_number ? { value: row.serial_number } : undefined,
      expiry_date: row.expiry_date ? new Date(row.expiry_date) : undefined,

      unit_cost: row.unit_cost !== null ? parseFloat(row.unit_cost) : undefined,
      total_cost: row.total_cost !== null ? parseFloat(row.total_cost) : undefined,
      currency: row.currency,

      source_document: row.source_document_type ? {
        document_type: row.source_document_type,
        document_id: row.source_document_id,
        document_number: row.source_document_number,
        line_item_id: row.source_line_item_id,
      } : undefined,

      reason: row.reason,
      notes: row.notes,

      batch_id: row.batch_id,

      approved_by: row.approved_by,
      approved_at: row.approved_at ? new Date(row.approved_at) : undefined,

      status: row.status,
      completed_at: row.completed_at ? new Date(row.completed_at) : undefined,
      cancelled_at: row.cancelled_at ? new Date(row.cancelled_at) : undefined,
      cancellation_reason: row.cancellation_reason,
    };
  }

  /**
   * Map domain entity to DB row
   * 
   * Converts domain types to database types.
   */
  private mapToDb(movement: InventoryMovement): Record<string, unknown> {
    return {
      id: movement.id.value,
      movement_number: movement.movement_number.value,
      tenant_id: movement.tenant_id,

      movement_date: movement.movement_date.toISOString(),
      created_at: movement.created_at.toISOString(),
      created_by: movement.created_by,

      movement_type: movement.movement_type,
      direction: movement.direction,

      item_id: movement.item_id.value,

      from_location_id: movement.from_location_id?.value ?? null,
      from_location_type: movement.from_location_type,
      to_location_id: movement.to_location_id?.value ?? null,
      to_location_type: movement.to_location_type,

      quantity: movement.quantity,
      unit_of_measure: movement.unit_of_measure,

      lot_number: movement.lot_number?.value ?? null,
      serial_number: movement.serial_number?.value ?? null,
      expiry_date: movement.expiry_date?.toISOString() ?? null,

      unit_cost: movement.unit_cost ?? null,
      total_cost: movement.total_cost ?? null,
      currency: movement.currency,

      source_document_type: movement.source_document?.document_type ?? null,
      source_document_id: movement.source_document?.document_id ?? null,
      source_document_number: movement.source_document?.document_number ?? null,
      source_line_item_id: movement.source_document?.line_item_id ?? null,

      reason: movement.reason,
      notes: movement.notes,

      batch_id: movement.batch_id,

      approved_by: movement.approved_by,
      approved_at: movement.approved_at?.toISOString() ?? null,

      status: movement.status,
      completed_at: movement.completed_at?.toISOString() ?? null,
      cancelled_at: movement.cancelled_at?.toISOString() ?? null,
      cancellation_reason: movement.cancellation_reason,
    };
  }
}
