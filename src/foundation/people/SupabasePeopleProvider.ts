/**
 * @module foundation/people/SupabasePeopleProvider
 *
 * Production Supabase implementation of PeopleQueryService + PeopleCommandService.
 *
 * Key design decisions:
 * - Accepts a Supabase client instance at construction (injectable, testable).
 * - batchGetAssignables() uses a single IN query — O(1) round trips instead of O(n).
 * - findAssignables() with orgUnitIds filter uses the denormalized `org_unit_ids`
 *   array column in `people_profiles` for fast filtering without JOIN.
 * - All mutations throw on error (Rule #1: Zero Silent Database Failures).
 *
 * @layer Foundation (production implementation)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AssignableReference,
  AssignableType,
  PersonProfile,
  PeopleQueryService,
  PeopleCommandService,
  AssignableFilter,
  RegisterPersonInput,
} from '../contracts';

// ─── DB Row types ─────────────────────────────────────────────────────────────

interface PeopleDirectoryRow {
  id: string;
  tenant_id: string;
  person_type: string;
  display_name: string;
  is_active: boolean;
}

interface PeopleProfileRow {
  id: string;
  tenant_id: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  org_unit_ids: string[] | null;
  metadata: Record<string, unknown> | null;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function rowToAssignable(row: PeopleDirectoryRow): AssignableReference {
  return {
    id: row.id,
    type: row.person_type as AssignableType,
    displayName: row.display_name,
  };
}

function rowToProfile(
  dirRow: PeopleDirectoryRow,
  profRow: PeopleProfileRow | null
): PersonProfile {
  return {
    id: dirRow.id,
    type: dirRow.person_type as AssignableType,
    email: profRow?.email ?? undefined,
    phone: profRow?.phone ?? undefined,
    avatar: profRow?.avatar_url ?? undefined,
    orgUnitIds: profRow?.org_unit_ids ?? undefined,
    metadata: profRow?.metadata ?? undefined,
  };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export class SupabasePeopleProvider implements PeopleQueryService, PeopleCommandService {
  constructor(private readonly db: SupabaseClient) {}

  // ── PeopleQueryService ──────────────────────────────────────────────────────

  async getAssignable(id: string, tenantId: string): Promise<AssignableReference | null> {
    const { data, error } = await this.db
      .from('people_directory')
      .select('id, person_type, display_name, is_active')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // not found
      throw new Error(`[SupabasePeopleProvider.getAssignable] ${error.message}`);
    }
    return data ? rowToAssignable(data as PeopleDirectoryRow) : null;
  }

  async getProfile(id: string, tenantId: string): Promise<PersonProfile | null> {
    // Fetch directory row first (single source of truth for type + display name)
    const { data: dirData, error: dirError } = await this.db
      .from('people_directory')
      .select('id, person_type, display_name, is_active')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (dirError) {
      if (dirError.code === 'PGRST116') return null;
      throw new Error(`[SupabasePeopleProvider.getProfile] directory: ${dirError.message}`);
    }
    if (!dirData) return null;

    // Fetch profile row (may not exist — profiles are optional)
    const { data: profData, error: profError } = await this.db
      .from('people_profiles')
      .select('id, tenant_id, email, phone, avatar_url, org_unit_ids, metadata')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (profError && profError.code !== 'PGRST116') {
      throw new Error(`[SupabasePeopleProvider.getProfile] profile: ${profError.message}`);
    }

    return rowToProfile(
      dirData as PeopleDirectoryRow,
      profData ? (profData as PeopleProfileRow) : null
    );
  }

  async findAssignables(filter: AssignableFilter): Promise<AssignableReference[]> {
    // If orgUnitIds filter provided — resolve through people_profiles first
    if (filter.orgUnitIds && filter.orgUnitIds.length > 0) {
      return this._findByOrgUnits(filter);
    }

    // Standard filter — query people_directory directly
    let query = this.db
      .from('people_directory')
      .select('id, person_type, display_name, is_active')
      .eq('tenant_id', filter.tenantId);

    if (filter.activeOnly !== false) {
      query = query.eq('is_active', true);
    }
    if (filter.types && filter.types.length > 0) {
      query = query.in('person_type', filter.types);
    }
    if (filter.excludeIds && filter.excludeIds.length > 0) {
      query = query.not('id', 'in', `(${filter.excludeIds.join(',')})`);
    }

    const { data, error } = await query.order('display_name');
    if (error) throw new Error(`[SupabasePeopleProvider.findAssignables] ${error.message}`);
    return (data ?? []).map(row => rowToAssignable(row as PeopleDirectoryRow));
  }

  async batchGetAssignables(
    ids: string[],
    tenantId: string
  ): Promise<Map<string, AssignableReference>> {
    if (ids.length === 0) return new Map();

    const { data, error } = await this.db
      .from('people_directory')
      .select('id, person_type, display_name, is_active')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .in('id', ids);

    if (error) throw new Error(`[SupabasePeopleProvider.batchGetAssignables] ${error.message}`);

    const result = new Map<string, AssignableReference>();
    for (const row of data ?? []) {
      const ref = rowToAssignable(row as PeopleDirectoryRow);
      result.set(ref.id, ref);
    }
    return result;
  }

  // ── PeopleCommandService ────────────────────────────────────────────────────

  async registerPerson(input: RegisterPersonInput): Promise<AssignableReference> {
    // 1. Insert into people_directory
    const { data: dirData, error: dirError } = await this.db
      .from('people_directory')
      .insert({
        tenant_id: input.tenantId,
        person_type: input.type,
        display_name: input.displayName,
        is_active: true,
      })
      .select('id, person_type, display_name, is_active')
      .single();

    if (dirError) {
      throw new Error(`[SupabasePeopleProvider.registerPerson] directory: ${dirError.message}`);
    }
    const dirRow = dirData as PeopleDirectoryRow;

    // 2. Insert profile if any extended fields provided
    if (input.email || input.phone || input.avatar || input.orgUnitIds) {
      const { error: profError } = await this.db
        .from('people_profiles')
        .insert({
          id: dirRow.id,
          tenant_id: input.tenantId,
          email: input.email ?? null,
          phone: input.phone ?? null,
          avatar_url: input.avatar ?? null,
          org_unit_ids: input.orgUnitIds ?? null,
          metadata: input.metadata ?? null,
        });

      if (profError) {
        throw new Error(`[SupabasePeopleProvider.registerPerson] profile: ${profError.message}`);
      }
    }

    return rowToAssignable(dirRow);
  }

  async updateDisplayName(id: string, tenantId: string, displayName: string): Promise<void> {
    const { error } = await this.db
      .from('people_directory')
      .update({ display_name: displayName })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(`[SupabasePeopleProvider.updateDisplayName] ${error.message}`);
    }
  }

  async updateProfile(id: string, tenantId: string, patch: Partial<PersonProfile>): Promise<void> {
    const update: Record<string, unknown> = {};
    if (patch.email !== undefined) update.email = patch.email;
    if (patch.phone !== undefined) update.phone = patch.phone;
    if (patch.avatar !== undefined) update.avatar_url = patch.avatar;
    if (patch.orgUnitIds !== undefined) update.org_unit_ids = patch.orgUnitIds;
    if (patch.metadata !== undefined) update.metadata = patch.metadata;

    // Upsert — profile may not exist yet
    const { error } = await this.db
      .from('people_profiles')
      .upsert({ id, tenant_id: tenantId, ...update });

    if (error) throw new Error(`[SupabasePeopleProvider.updateProfile] ${error.message}`);
  }

  async deactivatePerson(id: string, tenantId: string): Promise<void> {
    const { error } = await this.db
      .from('people_directory')
      .update({ is_active: false })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw new Error(`[SupabasePeopleProvider.deactivatePerson] ${error.message}`);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /**
   * findAssignables variant that filters by orgUnitIds using people_profiles.org_unit_ids.
   * Uses Postgres array overlap operator (&&) via the Supabase `overlaps` filter.
   */
  private async _findByOrgUnits(filter: AssignableFilter): Promise<AssignableReference[]> {
    const unitIds = filter.orgUnitIds!;

    // Get IDs of people whose org_unit_ids overlap with the requested unit IDs
    // Supabase JS supports `overlaps` for array columns
    const { data: profRows, error: profError } = await this.db
      .from('people_profiles')
      .select('id')
      .eq('tenant_id', filter.tenantId)
      .overlaps('org_unit_ids', unitIds);

    if (profError) {
      throw new Error(`[SupabasePeopleProvider._findByOrgUnits] profiles: ${profError.message}`);
    }

    const personIds = (profRows ?? []).map(r => r.id as string);
    if (personIds.length === 0) return [];

    // Now resolve from directory with remaining filters
    let query = this.db
      .from('people_directory')
      .select('id, person_type, display_name, is_active')
      .eq('tenant_id', filter.tenantId)
      .in('id', personIds);

    if (filter.activeOnly !== false) {
      query = query.eq('is_active', true);
    }
    if (filter.types && filter.types.length > 0) {
      query = query.in('person_type', filter.types);
    }
    if (filter.excludeIds && filter.excludeIds.length > 0) {
      query = query.not('id', 'in', `(${filter.excludeIds.join(',')})`);
    }

    const { data, error } = await query.order('display_name');
    if (error) {
      throw new Error(`[SupabasePeopleProvider._findByOrgUnits] directory: ${error.message}`);
    }
    return (data ?? []).map(row => rowToAssignable(row as PeopleDirectoryRow));
  }
}
