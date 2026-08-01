/**
 * @module foundation/organization/InMemoryOrgProvider
 *
 * In-memory implementation of OrgQueryService + OrgCommandService.
 * Used in tests and local development. Not for production.
 *
 * Usage:
 * ```ts
 * const org = new InMemoryOrgProvider({
 *   units: [...],
 *   relationships: [...],
 *   personMemberships: [
 *     { person: { id: 'sale-a', type: 'employee', displayName: 'Nguyễn Văn A' }, unitIds: ['team-luxury'] }
 *   ],
 * });
 * ```
 *
 * @layer Foundation (test infrastructure)
 */

import type {
  OrgUnitRef,
  OrgRelationship,
  BranchRef,
  TeamRef,
  OrgQueryService,
  OrgCommandService,
  AssignableFilterOptions,
  AssignableReference,
  CreateOrgUnitInput,
} from '../contracts';

// ─── Seed Data ────────────────────────────────────────────────────────────────

export interface OrgSeedData {
  /** Initial org units (branches, teams, departments, etc.) */
  units?: OrgUnitRef[];
  /** Initial relationships between units and persons */
  relationships?: OrgRelationship[];
  /**
   * Map persons to the org units they belong to.
   * InMemoryOrgProvider uses this to resolve getAssignablesInUnit().
   * Each person's AssignableReference is stored internally for name resolution.
   */
  personMemberships?: Array<{
    person: AssignableReference;
    unitIds: string[];
  }>;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export class InMemoryOrgProvider implements OrgQueryService, OrgCommandService {
  /** unitId → OrgUnitRef (with internal `_active` flag) */
  private readonly units = new Map<string, OrgUnitRef & { _active: boolean }>();
  /** relationshipId → OrgRelationship */
  private readonly relationships = new Map<string, OrgRelationship>();
  /** personId → AssignableReference (for name resolution in getAssignablesInUnit) */
  private readonly personDirectory = new Map<string, AssignableReference>();
  /** unitId → Set<personId> */
  private readonly unitPersons = new Map<string, Set<string>>();

  constructor(seed?: OrgSeedData) {
    if (seed) this.seed(seed);
  }

  /** Load seed data (can be called multiple times to append data) */
  seed(data: OrgSeedData): void {
    data.units?.forEach(u =>
      this.units.set(u.id, { ...u, _active: true })
    );
    data.relationships?.forEach(r =>
      this.relationships.set(r.id, r)
    );
    data.personMemberships?.forEach(({ person, unitIds }) => {
      this.personDirectory.set(person.id, person);
      unitIds.forEach(unitId => {
        if (!this.unitPersons.has(unitId)) {
          this.unitPersons.set(unitId, new Set());
        }
        this.unitPersons.get(unitId)!.add(person.id);
      });
    });
  }

  // ── OrgQueryService ─────────────────────────────────────────────────────────

  async getUnit(id: string, _tenantId: string): Promise<OrgUnitRef | null> {
    const entry = this.units.get(id);
    if (!entry || !entry._active) return null;
    const { _active, ...ref } = entry;
    return ref;
  }

  async getChildren(parentId: string, tenantId: string): Promise<OrgUnitRef[]> {
    const result: OrgUnitRef[] = [];
    for (const entry of this.units.values()) {
      if (entry.parentId === parentId && entry.tenantId === tenantId && entry._active) {
        const { _active, ...ref } = entry;
        result.push(ref);
      }
    }
    return result;
  }

  async getAncestors(unitId: string, tenantId: string): Promise<OrgUnitRef[]> {
    const ancestors: OrgUnitRef[] = [];
    let current = this.units.get(unitId);
    while (current?.parentId) {
      const parent = this.units.get(current.parentId);
      if (!parent || !parent._active || parent.tenantId !== tenantId) break;
      const { _active, ...ref } = parent;
      ancestors.push(ref);
      current = parent;
    }
    return ancestors;
  }

  async getBranch(branchId: string, tenantId: string): Promise<BranchRef | null> {
    const entry = this.units.get(branchId);
    if (!entry || entry.type !== 'branch' || entry.tenantId !== tenantId || !entry._active) {
      return null;
    }
    return { id: entry.id, name: entry.name, code: entry.code, tenantId: entry.tenantId };
  }

  async getTeam(teamId: string, tenantId: string): Promise<TeamRef | null> {
    const entry = this.units.get(teamId);
    if (!entry || entry.type !== 'team' || entry.tenantId !== tenantId || !entry._active) {
      return null;
    }
    return {
      id: entry.id,
      name: entry.name,
      branchId: entry.parentId ?? '',
      tenantId: entry.tenantId,
      teamType: entry.metadata?.teamType as string | undefined,
    };
  }

  async getRelationships(unitId: string, _tenantId: string): Promise<OrgRelationship[]> {
    return Array.from(this.relationships.values()).filter(
      r => r.fromId === unitId || r.toId === unitId
    );
  }

  async getAssignablesInUnit(
    unitId: string,
    options: AssignableFilterOptions
  ): Promise<AssignableReference[]> {
    // BFS — collect unitId + all descendants
    const allUnitIds = new Set<string>([unitId]);
    const queue = [unitId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const entry of this.units.values()) {
        if (
          entry.parentId === current &&
          entry.tenantId === options.tenantId &&
          entry._active &&
          !allUnitIds.has(entry.id)
        ) {
          allUnitIds.add(entry.id);
          queue.push(entry.id);
        }
      }
    }

    // Collect all person IDs across descendant units
    const personIds = new Set<string>();
    for (const uid of allUnitIds) {
      const persons = this.unitPersons.get(uid);
      if (persons) {
        for (const pid of persons) personIds.add(pid);
      }
    }

    // Resolve and apply type filter
    const result: AssignableReference[] = [];
    for (const pid of personIds) {
      const person = this.personDirectory.get(pid);
      if (!person) continue;
      if (options.assignableTypes && !options.assignableTypes.includes(person.type)) continue;
      result.push(person);
    }
    return result;
  }

  async getManagerOf(personId: string, _tenantId: string): Promise<AssignableReference | null> {
    // Find the first reports_to relationship from this person
    for (const rel of this.relationships.values()) {
      if (
        rel.fromId === personId &&
        rel.fromType === 'person' &&
        rel.type === 'reports_to'
      ) {
        return this.personDirectory.get(rel.toId) ?? null;
      }
    }
    return null;
  }

  // ── OrgCommandService ───────────────────────────────────────────────────────

  async createUnit(input: CreateOrgUnitInput): Promise<OrgUnitRef> {
    const unit: OrgUnitRef & { _active: boolean } = {
      id: `unit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tenantId: input.tenantId,
      type: input.type,
      name: input.name,
      code: input.code,
      parentId: input.parentId,
      metadata: input.metadata,
      _active: true,
    };
    this.units.set(unit.id, unit);
    const { _active, ...ref } = unit;
    return ref;
  }

  async updateUnit(
    id: string,
    _tenantId: string,
    patch: Partial<Pick<OrgUnitRef, 'name' | 'code' | 'metadata'>>
  ): Promise<OrgUnitRef> {
    const entry = this.units.get(id);
    if (!entry) throw new Error(`[InMemoryOrgProvider] Unit not found: ${id}`);
    Object.assign(entry, patch);
    const { _active, ...ref } = entry;
    return ref;
  }

  async archiveUnit(id: string, _tenantId: string): Promise<void> {
    const entry = this.units.get(id);
    if (entry) entry._active = false;
  }

  async createRelationship(rel: Omit<OrgRelationship, 'id'>): Promise<OrgRelationship> {
    const relationship: OrgRelationship = {
      ...rel,
      id: `rel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    };
    this.relationships.set(relationship.id, relationship);
    return relationship;
  }

  async endRelationship(id: string, until: string): Promise<void> {
    const rel = this.relationships.get(id);
    if (rel) rel.until = until;
  }

  // ── Test Helpers ────────────────────────────────────────────────────────────

  /** Register a person in a unit after initial construction (test helper) */
  addPersonToUnit(person: AssignableReference, unitId: string): void {
    this.personDirectory.set(person.id, person);
    if (!this.unitPersons.has(unitId)) this.unitPersons.set(unitId, new Set());
    this.unitPersons.get(unitId)!.add(person.id);
  }
}
