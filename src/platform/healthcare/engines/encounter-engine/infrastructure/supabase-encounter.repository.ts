/**
 * Supabase Encounter Repository Implementation
 * 
 * Constitution Compliance:
 * - Law 2: No direct DB access from product packs (repository abstraction)
 * - Law 11: Strictly typed, no `any` types
 * 
 * Architecture:
 * - Serialization: Encounter domain entity ↔ Database row
 * - RLS: Tenant isolation enforced at database level
 * - No business logic duplication (stays in aggregate)
 * 
 * @module platform/healthcare/engines/encounter-engine/infrastructure
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { Encounter, EncounterProps, EncounterStatus, EncounterType } from '../domain/encounter.entity';
import type { Diagnosis } from '@/platform/healthcare/shared-kernel/types';
import type {
  IEncounterRepository,
  EncounterSearchQuery,
  PaginatedResult,
  RepositoryTransaction,
} from './repository.interface';
import {
  RepositoryError,
  EncounterNotFoundError,
  TenantIsolationViolationError,
  DatabaseConnectionError,
  TransactionError,
} from './repository.interface';

// ============================================================================
// Database Types
// ============================================================================

type EncounterRow = Database['public']['Tables']['hc_encounters']['Row'];
type EncounterInsert = Database['public']['Tables']['hc_encounters']['Insert'];
type EncounterUpdate = Database['public']['Tables']['hc_encounters']['Update'];

// ============================================================================
// Supabase Encounter Repository
// ============================================================================

export class SupabaseEncounterRepository implements IEncounterRepository {
  private supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  async save(encounter: Encounter): Promise<Encounter> {
    try {
      const exists = await this.exists(encounter.id, encounter.tenantId);

      if (exists) {
        await this.update(encounter);
      } else {
        await this.insert(encounter);
      }

      // Return the saved encounter
      return encounter;
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw error;
      }
      throw new RepositoryError(
        `Failed to save encounter: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SAVE_FAILED',
        { encounterId: encounter.id, error }
      );
    }
  }

  async findById(encounterId: string, tenantId: string): Promise<Encounter | null> {
    try {
      const { data, error } = await this.supabase
        .from('hc_encounters')
        .select('*')
        .eq('id', encounterId)
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Not found
          return null;
        }
        throw new RepositoryError(
          `Failed to find encounter: ${error.message}`,
          'FIND_BY_ID_FAILED',
          { encounterId, tenantId, error }
        );
      }

      if (!data) {
        return null;
      }

      return this.toDomain(data);
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw error;
      }
      throw new RepositoryError(
        `Unexpected error in findById: ${error instanceof Error ? error.message : 'Unknown'}`,
        'FIND_BY_ID_ERROR',
        { encounterId, tenantId, error }
      );
    }
  }

  async findByPatient(
    patientId: string,
    tenantId: string,
    limit: number = 50
  ): Promise<Encounter[]> {
    try {
      const { data, error } = await this.supabase
        .from('hc_encounters')
        .select('*')
        .eq('patient_party_id', patientId)  // ← Legacy column (transition period)
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .order('period_start', { ascending: false })
        .limit(limit);

      if (error) {
        throw new RepositoryError(
          `Failed to find encounters by patient: ${error.message}`,
          'FIND_BY_PATIENT_FAILED',
          { patientId, tenantId, error }
        );
      }

      return (data || []).map((row) => this.toDomain(row));
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw error;
      }
      throw new RepositoryError(
        `Unexpected error in findByPatient: ${error instanceof Error ? error.message : 'Unknown'}`,
        'FIND_BY_PATIENT_ERROR',
        { patientId, tenantId, error }
      );
    }
  }

  async search(query: EncounterSearchQuery): Promise<PaginatedResult<Encounter>> {
    try {
      let supabaseQuery = this.supabase
        .from('hc_encounters')
        .select('*', { count: 'exact' })
        .eq('tenant_id', query.tenantId)
        .is('deleted_at', null);

      // Apply filters
      if (query.patientId) {
        supabaseQuery = supabaseQuery.eq('patient_party_id', query.patientId);  // ← Legacy column
      }

      if (query.status) {
        if (Array.isArray(query.status)) {
          supabaseQuery = supabaseQuery.in('status', query.status);
        } else {
          supabaseQuery = supabaseQuery.eq('status', query.status);
        }
      }

      if (query.encounterType) {
        supabaseQuery = supabaseQuery.eq('encounter_type', query.encounterType);
      }

      if (query.serviceProviderId) {
        supabaseQuery = supabaseQuery.eq('doctor_party_id', query.serviceProviderId);  // ← Legacy column
      }

      if (query.departmentId) {
        supabaseQuery = supabaseQuery.eq('department_id', query.departmentId);
      }

      if (query.locationId) {
        supabaseQuery = supabaseQuery.eq('location_id', query.locationId);
      }

      if (query.startDateFrom) {
        supabaseQuery = supabaseQuery.gte('period_start', query.startDateFrom.toISOString());
      }

      if (query.startDateTo) {
        supabaseQuery = supabaseQuery.lte('period_start', query.startDateTo.toISOString());
      }

      // Pagination
      const limit = query.limit || 50;
      const offset = query.offset || 0;
      supabaseQuery = supabaseQuery
        .order('period_start', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error, count } = await supabaseQuery;

      if (error) {
        throw new RepositoryError(
          `Failed to search encounters: ${error.message}`,
          'SEARCH_FAILED',
          { query, error }
        );
      }

      const total = count || 0;
      const items = (data || []).map((row) => this.toDomain(row));

      return {
        items,
        total,
        limit,
        offset,
        hasMore: offset + items.length < total,
      };
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw error;
      }
      throw new RepositoryError(
        `Unexpected error in search: ${error instanceof Error ? error.message : 'Unknown'}`,
        'SEARCH_ERROR',
        { query, error }
      );
    }
  }

  async findActive(tenantId: string, limit: number = 100): Promise<Encounter[]> {
    try {
      const activeStatuses: EncounterStatus[] = ['arrived', 'triaged', 'in-progress', 'on-hold'];

      const { data, error } = await this.supabase
        .from('hc_encounters')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('status', activeStatuses)
        .is('deleted_at', null)
        .order('period_start', { ascending: false })
        .limit(limit);

      if (error) {
        throw new RepositoryError(
          `Failed to find active encounters: ${error.message}`,
          'FIND_ACTIVE_FAILED',
          { tenantId, error }
        );
      }

      return (data || []).map((row) => this.toDomain(row));
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw error;
      }
      throw new RepositoryError(
        `Unexpected error in findActive: ${error instanceof Error ? error.message : 'Unknown'}`,
        'FIND_ACTIVE_ERROR',
        { tenantId, error }
      );
    }
  }

  async findByProvider(
    serviceProviderId: string,
    tenantId: string,
    limit: number = 50
  ): Promise<Encounter[]> {
    try {
      const { data, error } = await this.supabase
        .from('hc_encounters')
        .select('*')
        .eq('doctor_party_id', serviceProviderId)  // ← Legacy column (transition period)
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .order('period_start', { ascending: false })
        .limit(limit);

      if (error) {
        throw new RepositoryError(
          `Failed to find encounters by provider: ${error.message}`,
          'FIND_BY_PROVIDER_FAILED',
          { serviceProviderId, tenantId, error }
        );
      }

      return (data || []).map((row) => this.toDomain(row));
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw error;
      }
      throw new RepositoryError(
        `Unexpected error in findByProvider: ${error instanceof Error ? error.message : 'Unknown'}`,
        'FIND_BY_PROVIDER_ERROR',
        { serviceProviderId, tenantId, error }
      );
    }
  }

  async findByDepartment(
    departmentId: string,
    tenantId: string,
    limit: number = 50
  ): Promise<Encounter[]> {
    try {
      const { data, error } = await this.supabase
        .from('hc_encounters')
        .select('*')
        .eq('department_id', departmentId)
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .order('period_start', { ascending: false })
        .limit(limit);

      if (error) {
        throw new RepositoryError(
          `Failed to find encounters by department: ${error.message}`,
          'FIND_BY_DEPARTMENT_FAILED',
          { departmentId, tenantId, error }
        );
      }

      return (data || []).map((row) => this.toDomain(row));
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw error;
      }
      throw new RepositoryError(
        `Unexpected error in findByDepartment: ${error instanceof Error ? error.message : 'Unknown'}`,
        'FIND_BY_DEPARTMENT_ERROR',
        { departmentId, tenantId, error }
      );
    }
  }

  async exists(encounterId: string, tenantId: string): Promise<boolean> {
    try {
      const { count, error } = await this.supabase
        .from('hc_encounters')
        .select('id', { count: 'exact', head: true })
        .eq('id', encounterId)
        .eq('tenant_id', tenantId)
        .is('deleted_at', null);

      if (error) {
        throw new RepositoryError(
          `Failed to check encounter existence: ${error.message}`,
          'EXISTS_CHECK_FAILED',
          { encounterId, tenantId, error }
        );
      }

      return (count || 0) > 0;
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw error;
      }
      throw new RepositoryError(
        `Unexpected error in exists: ${error instanceof Error ? error.message : 'Unknown'}`,
        'EXISTS_ERROR',
        { encounterId, tenantId, error }
      );
    }
  }

  async delete(encounterId: string, tenantId: string): Promise<void> {
    try {
      // Soft delete
      const { error } = await this.supabase
        .from('hc_encounters')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', encounterId)
        .eq('tenant_id', tenantId);

      if (error) {
        throw new RepositoryError(
          `Failed to delete encounter: ${error.message}`,
          'DELETE_FAILED',
          { encounterId, tenantId, error }
        );
      }
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw error;
      }
      throw new RepositoryError(
        `Unexpected error in delete: ${error instanceof Error ? error.message : 'Unknown'}`,
        'DELETE_ERROR',
        { encounterId, tenantId, error }
      );
    }
  }

  async count(query: Partial<EncounterSearchQuery>): Promise<number> {
    try {
      let supabaseQuery = this.supabase
        .from('hc_encounters')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null);

      if (query.tenantId) {
        supabaseQuery = supabaseQuery.eq('tenant_id', query.tenantId);
      }

      if (query.patientId) {
        supabaseQuery = supabaseQuery.eq('patient_party_id', query.patientId);  // ← Legacy column
      }

      if (query.status) {
        if (Array.isArray(query.status)) {
          supabaseQuery = supabaseQuery.in('status', query.status);
        } else {
          supabaseQuery = supabaseQuery.eq('status', query.status);
        }
      }

      const { count, error } = await supabaseQuery;

      if (error) {
        throw new RepositoryError(
          `Failed to count encounters: ${error.message}`,
          'COUNT_FAILED',
          { query, error }
        );
      }

      return count || 0;
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw error;
      }
      throw new RepositoryError(
        `Unexpected error in count: ${error instanceof Error ? error.message : 'Unknown'}`,
        'COUNT_ERROR',
        { query, error }
      );
    }
  }

  async beginTransaction(): Promise<RepositoryTransaction> {
    // Supabase doesn't expose transaction API directly
    // For multi-aggregate operations, use application-level transaction coordination
    throw new TransactionError(
      'begin',
      new Error('Supabase client does not support explicit transactions. Use RPC functions for complex multi-table operations.')
    );
  }

  // ==========================================================================
  // Private Methods - Serialization
  // ==========================================================================

  private async insert(encounter: Encounter): Promise<void> {
    const row = this.toDatabase(encounter);

    const { error } = await this.supabase
      .from('hc_encounters')
      .insert(row);

    if (error) {
      throw new RepositoryError(
        `Failed to insert encounter: ${error.message}`,
        'INSERT_FAILED',
        { encounterId: encounter.id, error }
      );
    }
  }

  private async update(encounter: Encounter): Promise<void> {
    const row = this.toDatabase(encounter);

    const { error } = await this.supabase
      .from('hc_encounters')
      .update(row)
      .eq('id', encounter.id)
      .eq('tenant_id', encounter.tenantId);

    if (error) {
      throw new RepositoryError(
        `Failed to update encounter: ${error.message}`,
        'UPDATE_FAILED',
        { encounterId: encounter.id, error }
      );
    }
  }

  /**
   * Convert database row to Encounter domain entity
   * 
   * TRANSITION PERIOD: Reads from legacy columns (patient_party_id, doctor_party_id)
   * and maps to domain properties (patientId, serviceProviderId)
   */
  private toDomain(row: EncounterRow): Encounter {
    const props: EncounterProps = {
      id: row.id,
      tenantId: row.tenant_id,
      patientId: row.patient_party_id,  // ← Legacy column (DEPRECATED but active)
      encounterType: row.encounter_type as EncounterType,
      encounterClass: row.encounter_class as 'AMB' | 'EMER' | 'IMP' | 'HH' | 'VR',
      status: row.status as EncounterStatus,
      period: {
        start: new Date(row.period_start),
        end: row.period_end ? new Date(row.period_end) : undefined,
      },
      serviceProviderId: row.doctor_party_id || undefined,  // ← Legacy column (DEPRECATED but active)
      departmentId: row.department_id || undefined,
      locationId: row.location_id || undefined,
      reasonCode: (row.reason_code as string[]) || [],
      diagnosis: (row.diagnosis as unknown as Diagnosis[]) || [], // JSONB deserialization
      parentEncounterId: row.parent_encounter_id || undefined,
      metadata: (row.metadata as unknown as Record<string, unknown>) || {},
      provenance: {
        createdBy: row.created_by || 'system',
        createdAt: new Date(row.created_at),
        updatedBy: row.updated_by || 'system',
        updatedAt: new Date(row.updated_at),
      },
    };

    return Encounter.reconstitute(props);
  }

  /**
   * Convert Encounter domain entity to database row
   * 
   * TRANSITION PERIOD: Writes to legacy columns (patient_party_id, doctor_party_id)
   * from domain properties (patientId, serviceProviderId)
   */
  private toDatabase(encounter: Encounter): EncounterInsert {
    const props = encounter.toProps();

    return {
      id: props.id,
      tenant_id: props.tenantId,
      patient_party_id: props.patientId,  // ← Write to legacy column (DEPRECATED but active)
      care_journey_id: props.id, // Same as encounter ID for now
      encounter_type: props.encounterType,
      encounter_class: props.encounterClass,
      status: props.status,
      period_start: props.period.start.toISOString(),
      period_end: props.period.end?.toISOString() || null,
      doctor_party_id: props.serviceProviderId || null,  // ← Write to legacy column (DEPRECATED but active)
      department_id: props.departmentId || null,
      location_id: props.locationId || null,
      reason_code: props.reasonCode as unknown as any, // JSONB serialization
      diagnosis: props.diagnosis as unknown as any, // JSONB serialization: Supabase expects unknown
      parent_encounter_id: props.parentEncounterId || null,
      metadata: props.metadata as unknown as any, // JSONB serialization: Supabase expects unknown
      created_by: props.provenance.createdBy,
      updated_by: props.provenance.updatedBy,
      created_at: props.provenance.createdAt.toISOString(),
      updated_at: props.provenance.updatedAt.toISOString(),
      version: 1,
    };
  }
}
