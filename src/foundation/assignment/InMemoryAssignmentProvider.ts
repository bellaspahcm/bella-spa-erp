/**
 * @module foundation/assignment/InMemoryAssignmentProvider
 *
 * In-memory implementation of AssignmentQueryService.
 * Aggregates OrgQueryService + PeopleQueryService to compute eligible assignables.
 *
 * This is the single entry point Lead Engine uses to get its candidate pool.
 * It never returns HR data — just AssignableReference.
 *
 * Usage:
 * ```ts
 * const assignment = new InMemoryAssignmentProvider(org, people);
 *
 * // Simulate a Sale being on leave
 * assignment.setAvailability('sale-a', { isOnLeave: true });
 *
 * // Simulate a Broker exceeding quota
 * assignment.setAvailability('broker-b', { isOverQuota: true, currentAssignmentCount: 50 });
 *
 * const eligible = await assignment.getEligibleAssignables({
 *   tenantId: 'real_estate',
 *   branchId: 'branch-hcm-q1',
 *   excludeOnLeave: true,
 * });
 * ```
 *
 * @layer Foundation (test infrastructure)
 */

import type {
  AssignableReference,
  AssignableAvailability,
  AssignmentQueryService,
  EligibilityFilter,
  OrgQueryService,
  PeopleQueryService,
} from '../contracts';

// ─── Provider ─────────────────────────────────────────────────────────────────

export class InMemoryAssignmentProvider implements AssignmentQueryService {
  /**
   * Availability overrides keyed by assignableId.
   * Keys not present = fully available (no constraints).
   */
  private readonly availability = new Map<string, Partial<AssignableAvailability>>();

  constructor(
    private readonly org: OrgQueryService,
    private readonly people: PeopleQueryService,
  ) {}

  // ── AssignmentQueryService ──────────────────────────────────────────────────

  async getEligibleAssignables(filter: EligibilityFilter): Promise<AssignableReference[]> {
    // 1. Build candidate pool from org structure
    let candidates: AssignableReference[];

    const scopeUnitId = filter.teamId ?? filter.branchId;
    if (scopeUnitId) {
      candidates = await this.org.getAssignablesInUnit(scopeUnitId, {
        tenantId: filter.tenantId,
        activeOnly: true,
      });
    } else {
      // No scope restriction — pull all active persons in tenant
      candidates = await this.people.findAssignables({
        tenantId: filter.tenantId,
        activeOnly: true,
      });
    }

    // 2. Type exclusion filter
    if (filter.excludeTypes && filter.excludeTypes.length > 0) {
      candidates = candidates.filter(c => !filter.excludeTypes!.includes(c.type));
    }

    // 3. ID exclusion filter (e.g. current assignee during rotation)
    if (filter.excludeIds && filter.excludeIds.length > 0) {
      const excluded = new Set(filter.excludeIds);
      candidates = candidates.filter(c => !excluded.has(c.id));
    }

    // 4. Availability constraint filters
    candidates = candidates.filter(c => {
      const avail = this.availability.get(c.id);
      if (!avail) return true; // No data = fully available

      if (filter.excludeOnLeave && avail.isOnLeave === true) return false;
      if (filter.excludeOverQuota && avail.isOverQuota === true) return false;
      if (
        filter.maxSlaBreachCount !== undefined &&
        (avail.slaBreachCount ?? 0) > filter.maxSlaBreachCount
      ) return false;

      return true;
    });

    // 5. Sort by priority: fewer assignments first, then by last assigned (oldest first)
    // This approximates round-robin in tests without a full scheduling engine.
    candidates.sort((a, b) => {
      const availA = this.availability.get(a.id);
      const availB = this.availability.get(b.id);
      const countA = availA?.currentAssignmentCount ?? 0;
      const countB = availB?.currentAssignmentCount ?? 0;
      if (countA !== countB) return countA - countB;

      const lastA = availA?.lastAssignedAt ?? '';
      const lastB = availB?.lastAssignedAt ?? '';
      return lastA.localeCompare(lastB);
    });

    return candidates;
  }

  async getAvailability(assignableId: string, _tenantId: string): Promise<AssignableAvailability> {
    const stored = this.availability.get(assignableId);
    return {
      assignableId,
      isOnLeave: stored?.isOnLeave ?? false,
      isOverQuota: stored?.isOverQuota ?? false,
      currentAssignmentCount: stored?.currentAssignmentCount ?? 0,
      slaBreachCount: stored?.slaBreachCount ?? 0,
      lastAssignedAt: stored?.lastAssignedAt,
    };
  }

  // ── Test Helpers ────────────────────────────────────────────────────────────

  /**
   * Override availability state for a specific assignable.
   * Merges with existing state — only provided fields are changed.
   *
   * @example
   * // Put Sale A on leave
   * assignment.setAvailability('sale-a', { isOnLeave: true });
   *
   * // Record an assignment (increment count)
   * assignment.setAvailability('sale-a', {
   *   currentAssignmentCount: 5,
   *   lastAssignedAt: new Date().toISOString(),
   * });
   */
  setAvailability(assignableId: string, state: Partial<AssignableAvailability>): void {
    const existing = this.availability.get(assignableId) ?? {};
    this.availability.set(assignableId, { ...existing, ...state });
  }

  /** Reset all availability overrides (test teardown helper) */
  clearAvailability(): void {
    this.availability.clear();
  }

  /** Simulate assigning a resource to this assignable (increments count, updates timestamp) */
  recordAssignment(assignableId: string): void {
    const existing = this.availability.get(assignableId) ?? {};
    this.availability.set(assignableId, {
      ...existing,
      currentAssignmentCount: (existing.currentAssignmentCount ?? 0) + 1,
      lastAssignedAt: new Date().toISOString(),
    });
  }
}
