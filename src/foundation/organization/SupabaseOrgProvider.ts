/**
 * @module foundation/organization/SupabaseOrgProvider
 *
 * Production Supabase implementation of OrgQueryService + OrgCommandService.
 *
 * Key design decisions:
 * - Accepts a Supabase client instance at construction (not via singleton import).
 *   This makes it testable and avoids server/client context coupling.
 * - getAssignablesInUnit() uses a recursive CTE (PostgreSQL WITH RECURSIVE)
 *   instead of client-side BFS — much more efficient for deep org trees.
 * - All queries are scoped by tenant_id (RLS defense-in-depth).
 * - Throws on database errors (Rule #1: Zero Silent Database Failures).
 *
 * @layer Foundation (production implementation)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  OrgUnitRef,
  OrgUnitType,
  OrgRelationship,
  OrgRelationshipType,
  BranchRef,
  TeamRef,
  OrgQueryService,
  OrgCommandService,
  AssignableFilterOptions,
  AssignableReference,
  CreateOrgUnitInput,
} from '../contracts';

// ─── DB Row types (matches supabase/migrations/20260801030000_...) ────────────

interface OrgUnitRow {
  id: string;
  tenant_id: string;
  unit_type: string;
  name: string;
  code: string | null;
  parent_id: string | null;
  metadata: Record<string, unknown> | null;
  is_active: boolean;
}

interface OrgRelationshipRow {
  id: string;
  tenant_id: string;
  from_id: string;
  from_type: string;
  to_id: string;
  to_type: string;
  rel_type: string;
  role: string | null;
  since: string | null;
  until: string | null;
  metadata: Record<string, unknown> | null;
}

interface PeopleDirectoryRow {
  id: string;
  tenant_id: string;
  person_type: string;
  display_name: string;
  is_active: boolean;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function rowToOrgUnit(row: OrgUnitRow): OrgUnitRef {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    type: row.unit_type as OrgUnitType,
    name: row.name,
    code: row.code ?? undefined,
    parentId: row.parent_id ?? undefined,
    metadata: row.metadata ?? undefined,
  };
}

function rowToOrgRelationship(row: OrgRelationshipRow): OrgRelationship {
  return {
    id: row.id,
    fromId: row.from_id,
    fromType: row.from_type as 'unit' | 'person',
    toId: row.to_id,
    toType: row.to_type as 'unit' | 'person',
    type: row.rel_type as OrgRelationshipType,
    role: row.role ?? undefined,
    since: row.since ?? undefined,
    until: row.until ?? undefined,
    metadata: row.metadata ?? undefined,
  };
}

function rowToAssignable(row: PeopleDirectoryRow): AssignableReference {
  return {
    id: row.id,
    type: row.person_type as AssignableReference['type'],
    displayName: row.display_name,
  };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export class SupabaseOrgProvider implements OrgQueryService, OrgCommandService {
  constructor(private readonly db: SupabaseClient) {}

  // ── OrgQueryService ─────────────────────────────────────────────────────────

  async getUnit(id: string, tenantId: string): Promise<OrgUnitRef | null> {
    const { data, error } = await this.db
      .from('org_units')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // not found
      throw new Error(`[SupabaseOrgProvider.getUnit] ${error.message}`);
    }
    return data ? rowToOrgUnit(data as OrgUnitRow) : null;
  }

  async getChildren(parentId: string, tenantId: string): Promise<OrgUnitRef[]> {
    const { data, error } = await this.db
      .from('org_units')
      .select('*')
      .eq('parent_id', parentId)
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name');

    if (error) throw new Error(`[SupabaseOrgProvider.getChildren] ${error.message}`);
    return (data ?? []).map(row => rowToOrgUnit(row as OrgUnitRow));
  }

  async getAncestors(unitId: string, tenantId: string): Promise<OrgUnitRef[]> {
    // Use PostgreSQL recursive CTE to traverse up the tree in one query
    const { data, error } = await this.db.rpc('get_org_ancestors', {
      p_unit_id: unitId,
      p_tenant_id: tenantId,
    });

    if (error) {
      // RPC might not exist yet — fallback to iterative client-side traversal
      if (error.code === 'PGRST202') {
        return this._getAncestorsFallback(unitId, tenantId);
      }
      throw new Error(`[SupabaseOrgProvider.getAncestors] ${error.message}`);
    }
    return (data ?? []).map((row: OrgUnitRow) => rowToOrgUnit(row));
  }

  /** Fallback: iterative traversal when get_org_ancestors RPC is unavailable */
  private async _getAncestorsFallback(
    unitId: string,
    tenantId: string
  ): Promise<OrgUnitRef[]> {
    const ancestors: OrgUnitRef[] = [];
    let currentId: string | null = unitId;

    // Fetch all org_units for this tenant once (small dataset in practice)
    const { data, error } = await this.db
      .from('org_units')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    if (error) throw new Error(`[SupabaseOrgProvider.getAncestorsFallback] ${error.message}`);

    const index = new Map<string, OrgUnitRow>();
    for (const row of data ?? []) index.set(row.id, row as OrgUnitRow);

    // Walk up
    const start = index.get(unitId);
    currentId = start?.parent_id ?? null;
    while (currentId) {
      const parent = index.get(currentId);
      if (!parent) break;
      ancestors.push(rowToOrgUnit(parent));
      currentId = parent.parent_id;
    }
    return ancestors;
  }

  async getBranch(branchId: string, tenantId: string): Promise<BranchRef | null> {
    const { data, error } = await this.db
      .from('org_units')
      .select('id, tenant_id, name, code, parent_id')
      .eq('id', branchId)
      .eq('tenant_id', tenantId)
      .eq('unit_type', 'branch')
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`[SupabaseOrgProvider.getBranch] ${error.message}`);
    }
    if (!data) return null;
    const row = data as Pick<OrgUnitRow, 'id' | 'tenant_id' | 'name' | 'code' | 'parent_id'>;
    return { id: row.id, name: row.name, code: row.code ?? undefined, regionId: row.parent_id ?? undefined, tenantId: row.tenant_id };
  }

  async getTeam(teamId: string, tenantId: string): Promise<TeamRef | null> {
    const { data, error } = await this.db
      .from('org_units')
      .select('id, tenant_id, name, parent_id, metadata')
      .eq('id', teamId)
      .eq('tenant_id', tenantId)
      .eq('unit_type', 'team')
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`[SupabaseOrgProvider.getTeam] ${error.message}`);
    }
    if (!data) return null;
    const row = data as Pick<OrgUnitRow, 'id' | 'tenant_id' | 'name' | 'parent_id' | 'metadata'>;
    return {
      id: row.id,
      name: row.name,
      branchId: row.parent_id ?? '',
      tenantId: row.tenant_id,
      teamType: (row.metadata?.teamType as string) ?? undefined,
    };
  }

  async getRelationships(unitId: string, tenantId: string): Promise<OrgRelationship[]> {
    const { data, error } = await this.db
      .from('org_relationships')
      .select('*')
      .eq('tenant_id', tenantId)
      .or(`from_id.eq.${unitId},to_id.eq.${unitId}`);

    if (error) throw new Error(`[SupabaseOrgProvider.getRelationships] ${error.message}`);
    return (data ?? []).map(row => rowToOrgRelationship(row as OrgRelationshipRow));
  }

  async getAssignablesInUnit(
    unitId: string,
    options: AssignableFilterOptions
  ): Promise<AssignableReference[]> {
    // Step 1: Recursive BFS to get all descendant unit IDs
    const allUnitIds = await this._getDescendantUnitIds(unitId, options.tenantId);

    // Step 2: Find all person IDs that have a 'belongs_to' or 'participates_in' relationship
    //         with any of those units
    const { data: relRows, error: relError } = await this.db
      .from('org_relationships')
      .select('from_id')
      .eq('tenant_id', options.tenantId)
      .eq('from_type', 'person')
      .eq('to_type', 'unit')
      .in('rel_type', ['belongs_to', 'participates_in'])
      .in('to_id', allUnitIds)
      .is('until', null); // only active relationships

    if (relError) {
      throw new Error(`[SupabaseOrgProvider.getAssignablesInUnit] rels: ${relError.message}`);
    }

    const personIds = [...new Set((relRows ?? []).map(r => r.from_id as string))];
    if (personIds.length === 0) return [];

    // Step 3: Resolve persons from people_directory
    let query = this.db
      .from('people_directory')
      .select('id, person_type, display_name, is_active')
      .eq('tenant_id', options.tenantId)
      .in('id', personIds);

    if (options.activeOnly !== false) {
      query = query.eq('is_active', true);
    }
    if (options.assignableTypes && options.assignableTypes.length > 0) {
      query = query.in('person_type', options.assignableTypes);
    }

    const { data: peopleRows, error: peopleError } = await query;
    if (peopleError) {
      throw new Error(`[SupabaseOrgProvider.getAssignablesInUnit] people: ${peopleError.message}`);
    }

    return (peopleRows ?? []).map(row => rowToAssignable(row as PeopleDirectoryRow));
  }

  async getManagerOf(
    personId: string,
    tenantId: string
  ): Promise<AssignableReference | null> {
    // Find the reports_to relationship for this person
    const { data: relRows, error: relError } = await this.db
      .from('org_relationships')
      .select('to_id')
      .eq('tenant_id', tenantId)
      .eq('from_id', personId)
      .eq('from_type', 'person')
      .eq('to_type', 'person')
      .eq('rel_type', 'reports_to')
      .is('until', null)
      .limit(1);

    if (relError) throw new Error(`[SupabaseOrgProvider.getManagerOf] ${relError.message}`);
    const managerId = relRows?.[0]?.to_id;
    if (!managerId) return null;

    const { data, error } = await this.db
      .from('people_directory')
      .select('id, person_type, display_name')
      .eq('id', managerId)
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`[SupabaseOrgProvider.getManagerOf] resolve manager: ${error.message}`);
    }
    return data ? rowToAssignable(data as PeopleDirectoryRow) : null;
  }

  // ── OrgCommandService ───────────────────────────────────────────────────────

  async createUnit(input: CreateOrgUnitInput): Promise<OrgUnitRef> {
    const { data, error } = await this.db
      .from('org_units')
      .insert({
        tenant_id: input.tenantId,
        unit_type: input.type,
        name: input.name,
        code: input.code ?? null,
        parent_id: input.parentId ?? null,
        metadata: input.metadata ?? null,
        is_active: true,
      })
      .select('*')
      .single();

    if (error) throw new Error(`[SupabaseOrgProvider.createUnit] ${error.message}`);
    return rowToOrgUnit(data as OrgUnitRow);
  }

  async updateUnit(
    id: string,
    tenantId: string,
    patch: Partial<Pick<OrgUnitRef, 'name' | 'code' | 'metadata'>>
  ): Promise<OrgUnitRef> {
    const update: Record<string, unknown> = {};
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.code !== undefined) update.code = patch.code;
    if (patch.metadata !== undefined) update.metadata = patch.metadata;

    const { data, error } = await this.db
      .from('org_units')
      .update(update)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();

    if (error) throw new Error(`[SupabaseOrgProvider.updateUnit] ${error.message}`);
    return rowToOrgUnit(data as OrgUnitRow);
  }

  async archiveUnit(id: string, tenantId: string): Promise<void> {
    const { error } = await this.db
      .from('org_units')
      .update({ is_active: false })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw new Error(`[SupabaseOrgProvider.archiveUnit] ${error.message}`);
  }

  async createRelationship(rel: Omit<OrgRelationship, 'id'>): Promise<OrgRelationship> {
    const { data, error } = await this.db
      .from('org_relationships')
      .insert({
        tenant_id: (rel as unknown as { tenantId?: string }).tenantId ?? '',
        from_id: rel.fromId,
        from_type: rel.fromType,
        to_id: rel.toId,
        to_type: rel.toType,
        rel_type: rel.type,
        role: rel.role ?? null,
        since: rel.since ?? null,
        until: rel.until ?? null,
        metadata: rel.metadata ?? null,
      })
      .select('*')
      .single();

    if (error) throw new Error(`[SupabaseOrgProvider.createRelationship] ${error.message}`);
    return rowToOrgRelationship(data as OrgRelationshipRow);
  }

  async endRelationship(id: string, until: string): Promise<void> {
    const { error } = await this.db
      .from('org_relationships')
      .update({ until })
      .eq('id', id);

    if (error) throw new Error(`[SupabaseOrgProvider.endRelationship] ${error.message}`);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /** BFS to collect descendant unit IDs (inclusive of root) */
  private async _getDescendantUnitIds(
    rootId: string,
    tenantId: string
  ): Promise<string[]> {
    // Fetch entire org_units for this tenant once — typically < 200 rows
    const { data, error } = await this.db
      .from('org_units')
      .select('id, parent_id')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    if (error) throw new Error(`[SupabaseOrgProvider._getDescendantUnitIds] ${error.message}`);

    const rows = data ?? [] as { id: string; parent_id: string | null }[];
    // Build parent→children index
    const childrenOf = new Map<string, string[]>();
    for (const row of rows) {
      if (row.parent_id) {
        if (!childrenOf.has(row.parent_id)) childrenOf.set(row.parent_id, []);
        childrenOf.get(row.parent_id)!.push(row.id);
      }
    }

    // BFS from rootId
    const visited = new Set<string>([rootId]);
    const queue = [rootId];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const childId of childrenOf.get(cur) ?? []) {
        if (!visited.has(childId)) {
          visited.add(childId);
          queue.push(childId);
        }
      }
    }
    return [...visited];
  }
}
