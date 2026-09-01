/**
 * Supabase Bed Repository with Concurrency Protection
 *
 * Implements IBedRepository for `hc_beds` database operations.
 * Race-Condition Invariant:
 * - Uses optimistic concurrency control and conditional DB updates (`status = 'available'`)
 *   so that concurrent requests attempting to allocate the same bed will fail atomically.
 *
 * @module platform/healthcare/engines/bed-engine/repositories
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { Bed, BedOccupancy, BedStateProps, BedType, BedStatus } from '../domain/bed.entity';

export class BedOccupancyConflictError extends Error {
  constructor(bedId: string, bedCode: string) {
    super(`CONCURRENCY_CONFLICT: Bed ${bedCode} (${bedId}) was modified or allocated by another transaction`);
    this.name = 'BedOccupancyConflictError';
  }
}

export interface IBedRepository {
  save(bed: Bed): Promise<Bed>;
  findById(tenantId: string, id: string): Promise<Bed | null>;
  findAvailableBed(tenantId: string, wardId: string, preferredBedId?: string): Promise<Bed | null>;
  findAll(tenantId: string): Promise<Bed[]>;
  findAllInWard(tenantId: string, wardId: string): Promise<Bed[]>;
}

export class SupabaseBedRepository implements IBedRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async save(bed: Bed): Promise<Bed> {
    const snap = bed.toSnapshot();

    const dbRow = {
      id: snap.id,
      tenant_id: snap.tenantId,
      ward_id: snap.wardId,
      bed_code: snap.bedCode,
      bed_type: snap.bedType,
      status: snap.status,
      daily_rate: snap.dailyRate,
      current_patient_id: snap.occupancy?.patientPartyId || null,
      current_admission_id: snap.occupancy?.admissionId || null,
      assigned_at: snap.occupancy?.assignedAt || null,
      updated_at: snap.updatedAt,
    };

    // If allocating, perform conditional update to protect against concurrent allocations
    if (snap.status === 'occupied' && snap.occupancy) {
      const { data, error } = await this.supabase
        .from('hc_beds')
        .update(dbRow)
        .eq('id', snap.id)
        .eq('tenant_id', snap.tenantId)
        .eq('status', 'available') // Conditional check: must be available!
        .select()
        .maybeSingle();

      if (error) {
        throw new Error(`Database error saving Bed: ${error.message}`);
      }

      if (!data) {
        // Condition failed: Bed was already allocated by another concurrent transaction!
        throw new BedOccupancyConflictError(snap.id, snap.bedCode);
      }

      return this.mapToEntity(data, snap.occupancy.encounterId);
    }

    // Standard upsert for release, clean, or initial creation
    const { data, error } = await this.supabase
      .from('hc_beds')
      .upsert(dbRow, { onConflict: 'id' })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to save Bed: ${error?.message || 'Database execution failed'}`);
    }

    return this.mapToEntity(data);
  }

  async findById(tenantId: string, id: string): Promise<Bed | null> {
    const { data, error } = await this.supabase
      .from('hc_beds')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapToEntity(data);
  }

  async findAvailableBed(tenantId: string, wardId: string, preferredBedId?: string): Promise<Bed | null> {
    let query = this.supabase
      .from('hc_beds')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('ward_id', wardId)
      .eq('status', 'available');

    if (preferredBedId) {
      query = query.eq('id', preferredBedId);
    }

    const { data, error } = await query.limit(1).maybeSingle();

    if (error || !data) return null;
    return this.mapToEntity(data);
  }

  async findAll(tenantId: string): Promise<Bed[]> {
    const { data, error } = await this.supabase
      .from('hc_beds')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('bed_code', { ascending: true });

    if (error || !data) return [];
    return data.map((row) => this.mapToEntity(row));
  }

  async findAllInWard(tenantId: string, wardId: string): Promise<Bed[]> {
    const { data, error } = await this.supabase
      .from('hc_beds')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('ward_id', wardId)
      .order('bed_code', { ascending: true });

    if (error || !data) return [];
    return data.map((row) => this.mapToEntity(row));
  }

  private mapToEntity(row: Record<string, unknown>, fallbackEncounterId?: string): Bed {
    let occupancy: BedOccupancy | undefined = undefined;

    if (row.status === 'occupied' && row.current_patient_id && row.current_admission_id) {
      occupancy = new BedOccupancy({
        admissionId: String(row.current_admission_id),
        patientPartyId: String(row.current_patient_id),
        encounterId: fallbackEncounterId || 'enc-000',
        assignedAt: String(row.assigned_at || row.updated_at || new Date().toISOString()),
      });
    }

    const props: BedStateProps = {
      id: String(row.id || ''),
      tenantId: String(row.tenant_id || ''),
      wardId: String(row.ward_id || ''),
      bedCode: String(row.bed_code || ''),
      bedType: (row.bed_type as BedType) || 'standard',
      status: (row.status as BedStatus) || 'available',
      dailyRate: Number(row.daily_rate) || 0,
      occupancy,
      version: Number(row.version) || 1,
      createdAt: String(row.created_at || new Date().toISOString()),
      updatedAt: String(row.updated_at || new Date().toISOString()),
    };

    return Bed.rehydrate(props);
  }
}
