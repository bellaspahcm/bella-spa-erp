/**
 * Supabase Implementation of Order Repository
 * 
 * ARCHITECTURE:
 * - Domain Model: ClinicalOrder (aggregate root)
 * - Persistence: hc_clinical_orders (PostgreSQL table)
 * - Mapping: Bidirectional conversion between domain and database models
 * 
 * INVARIANTS ENFORCED:
 * - Tenant Isolation: All queries filter by tenant_id
 * - Idempotency: (tenant_id, request_id) uniqueness via DB constraint
 * - Optimistic Locking: Version check + increment on update
 * - Patient Consistency: Composite FK (encounter_id, patient_party_id)
 * 
 * @see order-repository.interface.ts for contract details
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  IOrderRepository,
  OrderQueryFilters,
  OrderSaveOptions,
} from './order-repository.interface';
import {
  OptimisticLockError,
  IdempotencyConflictError,
} from './order-repository.interface';
import { ClinicalOrder } from '../domain/clinical-order.entity';
import type { Database } from '@/types/supabase';

type OrderRow = Database['public']['Tables']['hc_clinical_orders']['Row'];
type OrderInsert = Database['public']['Tables']['hc_clinical_orders']['Insert'];
type OrderUpdate = Database['public']['Tables']['hc_clinical_orders']['Update'];

/**
 * Database Row to Domain Mapper
 * Reconstitutes ClinicalOrder aggregate from database row
 */
function toDomain(row: OrderRow): ClinicalOrder {
  return ClinicalOrder.fromPersistence({
    id: row.id,
    tenantId: row.tenant_id,
    encounterId: row.encounter_id,
    patientId: row.patient_party_id,
    orderType: row.order_type as any,
    orderStatus: row.order_status as any,
    priority: row.priority as any,
    orderedBy: row.ordered_by,
    orderedAt: new Date(row.ordered_at),
    approvedBy: row.approved_by ?? undefined,
    approvedAt: row.approved_at ? new Date(row.approved_at) : undefined,
    discontinuedBy: row.discontinued_by ?? undefined,
    discontinuedAt: row.discontinued_at ? new Date(row.discontinued_at) : undefined,
    discontinueReason: row.discontinue_reason ?? undefined,
    cdsCheckId: row.cds_check_id ?? undefined,
    cdsCheckStatus: row.cds_check_status as any ?? undefined,
    orderDetails: row.order_details as any,
    notes: row.notes ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    version: row.version,
  });
}

/**
 * Domain to Database Insert Mapper
 */
function toInsert(order: ClinicalOrder, requestId?: string): OrderInsert {
  return {
    id: order.id,
    tenant_id: order.tenantId,
    encounter_id: order.encounterId,
    patient_party_id: order.patientId,
    order_type: order.orderType,
    order_status: order.orderStatus,
    priority: order.priority,
    ordered_by: order.orderedBy,
    ordered_at: order.orderedAt.toISOString(),
    approved_by: order.approvedBy ?? null,
    approved_at: order.approvedAt?.toISOString() ?? null,
    discontinued_by: order.discontinuedBy ?? null,
    discontinued_at: order.discontinuedAt?.toISOString() ?? null,
    discontinue_reason: order.discontinueReason ?? null,
    cds_check_id: order.cdsCheckId ?? null,
    cds_check_status: order.cdsCheckStatus ?? null,
    order_details: order.orderDetails as any,
    notes: order.notes ?? null,
    request_id: requestId ?? null,
    version: order.version,
    created_at: order.createdAt.toISOString(),
    updated_at: order.updatedAt.toISOString(),
  };
}

/**
 * Domain to Database Update Mapper
 */
function toUpdate(order: ClinicalOrder): OrderUpdate {
  return {
    order_status: order.orderStatus,
    priority: order.priority,
    approved_by: order.approvedBy ?? null,
    approved_at: order.approvedAt?.toISOString() ?? null,
    discontinued_by: order.discontinuedBy ?? null,
    discontinued_at: order.discontinuedAt?.toISOString() ?? null,
    discontinue_reason: order.discontinueReason ?? null,
    cds_check_status: order.cdsCheckStatus ?? null,
    order_details: order.orderDetails as any,
    notes: order.notes ?? null,
    version: order.version, // Use domain version (already incremented by domain methods)
    updated_at: new Date().toISOString(),
  };
}

export class SupabaseOrderRepository implements IOrderRepository {
  private readonly TABLE = 'hc_clinical_orders';

  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async create(order: ClinicalOrder, requestId?: string): Promise<ClinicalOrder> {
    const insert = toInsert(order, requestId);

    const { data, error } = await this.supabase
      .from(this.TABLE)
      .insert(insert)
      .select()
      .single();

    if (error) {
      // Check for idempotency conflict
      if (error.code === '23505' && error.message.includes('idx_hc_clinical_orders_request_id')) {
        // Fetch existing order
        const existing = requestId
          ? await this.findByRequestId(order.tenantId, requestId)
          : null;
        
        if (existing) {
          throw new IdempotencyConflictError(order.tenantId, requestId!, existing.id);
        }
      }

      throw new Error(`Failed to create order: ${error.message}`);
    }

    return toDomain(data);
  }

  async findById(tenantId: string, orderId: string): Promise<ClinicalOrder | null> {
    const { data, error } = await this.supabase
      .from(this.TABLE)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', orderId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find order: ${error.message}`);
    }

    return data ? toDomain(data) : null;
  }

  async findByRequestId(tenantId: string, requestId: string): Promise<ClinicalOrder | null> {
    const { data, error } = await this.supabase
      .from(this.TABLE)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('request_id', requestId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find order by request_id: ${error.message}`);
    }

    return data ? toDomain(data) : null;
  }

  async findByFilters(filters: OrderQueryFilters): Promise<ClinicalOrder[]> {
    let query = this.supabase
      .from(this.TABLE)
      .select('*')
      .eq('tenant_id', filters.tenantId);

    if (filters.encounterId) {
      query = query.eq('encounter_id', filters.encounterId);
    }
    if (filters.patientId) {
      query = query.eq('patient_party_id', filters.patientId);
    }
    if (filters.orderType) {
      query = query.eq('order_type', filters.orderType);
    }
    if (filters.orderStatus) {
      query = query.eq('order_status', filters.orderStatus);
    }
    if (filters.priority) {
      query = query.eq('priority', filters.priority);
    }
    if (filters.orderedBy) {
      query = query.eq('ordered_by', filters.orderedBy);
    }
    if (filters.createdAfter) {
      query = query.gte('created_at', filters.createdAfter.toISOString());
    }
    if (filters.createdBefore) {
      query = query.lte('created_at', filters.createdBefore.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to query orders: ${error.message}`);
    }

    return data.map(toDomain);
  }

  async findActiveByEncounter(tenantId: string, encounterId: string): Promise<ClinicalOrder[]> {
    const completedStatuses = ['COMPLETED', 'DISCONTINUED', 'REJECTED'];
    
    const { data, error } = await this.supabase
      .from(this.TABLE)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('encounter_id', encounterId);

    if (error) {
      throw new Error(`Failed to find active orders: ${error.message}`);
    }

    // Filter out completed statuses in-memory (PostgREST .not('in') syntax varies)
    return data.filter(row => !completedStatuses.includes(row.order_status)).map(toDomain);
  }

  async update(order: ClinicalOrder, options?: OrderSaveOptions): Promise<ClinicalOrder> {
    const update = toUpdate(order);

    // Build query with optimistic locking
    let query = this.supabase
      .from(this.TABLE)
      .update(update)
      .eq('tenant_id', order.tenantId)
      .eq('id', order.id);

    // Optimistic locking check
    if (options?.expectedVersion !== undefined) {
      query = query.eq('version', options.expectedVersion);
    }

    const { data, error } = await query.select().maybeSingle();

    if (error) {
      throw new Error(`Failed to update order: ${error.message}`);
    }

    if (!data) {
      // Version mismatch or order not found
      if (options?.expectedVersion !== undefined) {
        // Fetch current version
        const current = await this.findById(order.tenantId, order.id);
        if (current) {
          throw new OptimisticLockError(
            order.id,
            options.expectedVersion,
            current.version
          );
        }
      }
      throw new Error(`Order not found: ${order.id}`);
    }

    return toDomain(data);
  }

  async softDelete(
    tenantId: string,
    orderId: string,
    discontinuedBy: string,
    reason: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from(this.TABLE)
      .update({
        order_status: 'DISCONTINUED',
        discontinued_by: discontinuedBy,
        discontinued_at: new Date().toISOString(),
        discontinue_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('id', orderId);

    if (error) {
      throw new Error(`Failed to discontinue order: ${error.message}`);
    }
  }

  async exists(tenantId: string, orderId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from(this.TABLE)
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('id', orderId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to check order existence: ${error.message}`);
    }

    return !!data;
  }
}
