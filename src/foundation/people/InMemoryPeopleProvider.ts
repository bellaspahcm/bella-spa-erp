/**
 * @module foundation/people/InMemoryPeopleProvider
 *
 * In-memory implementation of PeopleQueryService + PeopleCommandService.
 * Used in tests and local development. Not for production.
 *
 * Usage:
 * ```ts
 * const people = new InMemoryPeopleProvider({
 *   people: [
 *     { id: 'sale-a', type: 'employee', displayName: 'Nguyễn Văn A', tenantId: 'real_estate' },
 *     { id: 'broker-b', type: 'broker', displayName: 'Trần Thị B', tenantId: 'real_estate' },
 *   ],
 *   profiles: [
 *     { id: 'sale-a', type: 'employee', email: 'a@bella.vn', phone: '0901234567' },
 *   ],
 * });
 * ```
 *
 * @layer Foundation (test infrastructure)
 */

import type {
  AssignableReference,
  AssignableType,
  PersonProfile,
  PeopleQueryService,
  PeopleCommandService,
  AssignableFilter,
  RegisterPersonInput,
} from '../contracts';

// ─── Seed Data ────────────────────────────────────────────────────────────────

export type PersonSeedEntry = AssignableReference & {
  tenantId: string;
  /** Default true. Set false to simulate deactivated/terminated persons. */
  active?: boolean;
};

export interface PeopleSeedData {
  people?: PersonSeedEntry[];
  profiles?: PersonProfile[];
}

// ─── Provider ─────────────────────────────────────────────────────────────────

type InternalEntry = AssignableReference & { tenantId: string; active: boolean };

export class InMemoryPeopleProvider implements PeopleQueryService, PeopleCommandService {
  private readonly directory = new Map<string, InternalEntry>();
  private readonly profiles = new Map<string, PersonProfile>();

  constructor(seed?: PeopleSeedData) {
    if (seed) this.seed(seed);
  }

  seed(data: PeopleSeedData): void {
    data.people?.forEach(p =>
      this.directory.set(p.id, { ...p, active: p.active ?? true })
    );
    data.profiles?.forEach(p =>
      this.profiles.set(p.id, p)
    );
  }

  // ── PeopleQueryService ──────────────────────────────────────────────────────

  async getAssignable(id: string, _tenantId: string): Promise<AssignableReference | null> {
    const entry = this.directory.get(id);
    if (!entry || !entry.active) return null;
    return { id: entry.id, type: entry.type, displayName: entry.displayName };
  }

  async getProfile(id: string, _tenantId: string): Promise<PersonProfile | null> {
    return this.profiles.get(id) ?? null;
  }

  async findAssignables(filter: AssignableFilter): Promise<AssignableReference[]> {
    const result: AssignableReference[] = [];
    for (const entry of this.directory.values()) {
      if (entry.tenantId !== filter.tenantId) continue;
      if (filter.activeOnly && !entry.active) continue;
      if (filter.types && !filter.types.includes(entry.type)) continue;
      if (filter.excludeIds?.includes(entry.id)) continue;

      // If orgUnitIds filter provided — check via profile
      if (filter.orgUnitIds && filter.orgUnitIds.length > 0) {
        const profile = this.profiles.get(entry.id);
        const personUnitIds = profile?.orgUnitIds ?? [];
        const hasOverlap = filter.orgUnitIds.some(uid => personUnitIds.includes(uid));
        if (!hasOverlap) continue;
      }

      result.push({ id: entry.id, type: entry.type, displayName: entry.displayName });
    }
    return result;
  }

  async batchGetAssignables(
    ids: string[],
    tenantId: string
  ): Promise<Map<string, AssignableReference>> {
    const result = new Map<string, AssignableReference>();
    for (const id of ids) {
      const ref = await this.getAssignable(id, tenantId);
      if (ref) result.set(id, ref);
    }
    return result;
  }

  // ── PeopleCommandService ────────────────────────────────────────────────────

  async registerPerson(input: RegisterPersonInput): Promise<AssignableReference> {
    const id = `person-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const entry: InternalEntry = {
      id,
      type: input.type,
      displayName: input.displayName,
      tenantId: input.tenantId,
      active: true,
    };
    this.directory.set(id, entry);

    // Create profile if any extended fields provided
    if (input.email || input.phone || input.avatar || input.orgUnitIds) {
      this.profiles.set(id, {
        id,
        type: input.type,
        email: input.email,
        phone: input.phone,
        avatar: input.avatar,
        orgUnitIds: input.orgUnitIds,
        metadata: input.metadata,
      });
    }

    return { id: entry.id, type: entry.type, displayName: entry.displayName };
  }

  async updateDisplayName(id: string, _tenantId: string, displayName: string): Promise<void> {
    const entry = this.directory.get(id);
    if (entry) entry.displayName = displayName;
  }

  async updateProfile(id: string, _tenantId: string, patch: Partial<PersonProfile>): Promise<void> {
    const existing = this.profiles.get(id);
    const base: PersonProfile = existing ?? { id, type: 'employee' as AssignableType };
    this.profiles.set(id, { ...base, ...patch });
  }

  async deactivatePerson(id: string, _tenantId: string): Promise<void> {
    const entry = this.directory.get(id);
    if (entry) entry.active = false;
  }

  // ── Test Helpers ────────────────────────────────────────────────────────────

  /** Reactivate a previously deactivated person (test helper) */
  reactivatePerson(id: string): void {
    const entry = this.directory.get(id);
    if (entry) entry.active = true;
  }

  /** Count active persons in a tenant (test assertion helper) */
  countActive(tenantId: string): number {
    let count = 0;
    for (const entry of this.directory.values()) {
      if (entry.tenantId === tenantId && entry.active) count++;
    }
    return count;
  }
}
