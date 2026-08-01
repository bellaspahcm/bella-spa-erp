/**
 * @module foundation/testing/createTestFoundation
 *
 * Convenience factory for setting up the full Foundation stack in tests.
 * Wires InMemoryOrgProvider, InMemoryPeopleProvider, and InMemoryAssignmentProvider
 * together and registers them in the FoundationRegistry.
 *
 * Usage pattern (Jest):
 * ```ts
 * import { createTestFoundation } from '@/foundation/testing/createTestFoundation';
 * import { resetFoundation } from '@/foundation';
 *
 * describe('Lead Assignment', () => {
 *   let testFoundation: ReturnType<typeof createTestFoundation>;
 *
 *   beforeEach(() => {
 *     testFoundation = createTestFoundation({
 *       tenantId: 'real_estate',
 *       units: [
 *         { id: 'branch-hcm', tenantId: 'real_estate', type: 'branch', name: 'Chi nhánh HCM' },
 *         { id: 'team-luxury', tenantId: 'real_estate', type: 'team', name: 'Team Luxury', parentId: 'branch-hcm' },
 *       ],
 *       people: [
 *         { id: 'sale-a', type: 'employee', displayName: 'Nguyễn Văn A', tenantId: 'real_estate' },
 *         { id: 'broker-b', type: 'broker', displayName: 'Trần Thị B', tenantId: 'real_estate' },
 *       ],
 *       personMemberships: [
 *         { person: { id: 'sale-a', type: 'employee', displayName: 'Nguyễn Văn A' }, unitIds: ['team-luxury'] },
 *         { person: { id: 'broker-b', type: 'broker', displayName: 'Trần Thị B' }, unitIds: ['branch-hcm'] },
 *       ],
 *     });
 *   });
 *
 *   afterEach(() => {
 *     resetFoundation();
 *   });
 *
 *   it('should return eligible assignables excluding person on leave', async () => {
 *     testFoundation.assignment.setAvailability('sale-a', { isOnLeave: true });
 *
 *     const eligible = await getFoundation().assignment.getEligibleAssignables({
 *       tenantId: 'real_estate',
 *       branchId: 'branch-hcm',
 *       excludeOnLeave: true,
 *     });
 *
 *     expect(eligible.map(e => e.id)).not.toContain('sale-a');
 *     expect(eligible.map(e => e.id)).toContain('broker-b');
 *   });
 * });
 * ```
 *
 * @layer Foundation (test infrastructure only)
 */

import { registerFoundation } from '../contracts';
import { InMemoryOrgProvider, type OrgSeedData } from '../organization';
import { InMemoryPeopleProvider, type PeopleSeedData } from '../people';
import { InMemoryAssignmentProvider } from '../assignment';

export interface TestFoundationInput extends OrgSeedData, PeopleSeedData {
  /** Tenant ID used for seeding — for documentation clarity only */
  tenantId?: string;
}

export interface TestFoundation {
  /** Direct access to org provider for test assertions and manual seeding */
  org: InMemoryOrgProvider;
  /** Direct access to people provider for test assertions and manual updates */
  people: InMemoryPeopleProvider;
  /** Direct access to assignment provider for setting availability overrides */
  assignment: InMemoryAssignmentProvider;
}

/**
 * Create and register a full in-memory Foundation for testing.
 * Automatically calls registerFoundation() — call resetFoundation() in afterEach().
 *
 * Returns the concrete providers so tests can call test-only helpers
 * (setAvailability, addPersonToUnit, etc.) without type-casting.
 */
export function createTestFoundation(input: TestFoundationInput = {}): TestFoundation {
  const org = new InMemoryOrgProvider({
    units: input.units,
    relationships: input.relationships,
    personMemberships: input.personMemberships,
  });

  const people = new InMemoryPeopleProvider({
    people: input.people,
    profiles: input.profiles,
  });

  const assignment = new InMemoryAssignmentProvider(org, people);

  registerFoundation({ org, people, assignment, orgCommand: org, peopleCommand: people });

  return { org, people, assignment };
}
