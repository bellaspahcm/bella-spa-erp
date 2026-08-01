/**
 * @module foundation/contracts/registry
 *
 * FoundationRegistry — central access point for all Foundation services.
 *
 * Design:
 * - Singleton container. Registered ONCE during app bootstrap (or test setup).
 * - Consumers call `getFoundation().org.getUnit(...)` — no direct imports of implementations.
 * - Implementations are swappable: InMemory for tests, Supabase for production.
 * - `reset()` is intentionally exposed for test teardown only.
 *
 * Bootstrap example:
 * ```ts
 * // src/app/bootstrap.ts
 * import { registerFoundation } from '@/foundation';
 * import { SupabaseOrgProvider } from '@/foundation/organization/SupabaseOrgProvider';
 * import { SupabasePeopleProvider } from '@/foundation/people/SupabasePeopleProvider';
 * import { SupabaseAssignmentProvider } from '@/capabilities/assignment/SupabaseAssignmentProvider';
 *
 * registerFoundation({
 *   org: new SupabaseOrgProvider(supabase),
 *   people: new SupabasePeopleProvider(supabase),
 *   assignment: new SupabaseAssignmentProvider(supabase),
 * });
 * ```
 *
 * Test example:
 * ```ts
 * // In beforeEach
 * registerFoundation({
 *   org: new InMemoryOrgProvider(seedData),
 *   people: new InMemoryPeopleProvider(seedData),
 *   assignment: new InMemoryAssignmentProvider(),
 * });
 *
 * // In afterEach
 * resetFoundation();
 * ```
 *
 * @layer Foundation
 */

import type { OrgQueryService, OrgCommandService, PeopleQueryService, PeopleCommandService, AssignmentQueryService } from './services';

// ─── Registry Interface ───────────────────────────────────────────────────────

/**
 * The full shape of the Foundation Registry.
 * All services are optional at the type level but validated on registration.
 */
export interface FoundationRegistry {
  /** Organization structure (read) */
  readonly org: OrgQueryService;
  /** People directory (read) */
  readonly people: PeopleQueryService;
  /** Assignment eligibility (read) */
  readonly assignment: AssignmentQueryService;
  /** Organization structure (write) — optional, not needed by most consumers */
  readonly orgCommand?: OrgCommandService;
  /** People directory (write) — optional */
  readonly peopleCommand?: PeopleCommandService;
}

// ─── Registry Container ───────────────────────────────────────────────────────

class FoundationRegistryContainer {
  private _registry: FoundationRegistry | null = null;

  register(registry: FoundationRegistry): void {
    if (this._registry) {
      throw new Error(
        '[FoundationRegistry] Already registered. ' +
        'Call resetFoundation() first if re-registering (test teardown only).'
      );
    }
    this._registry = registry;
  }

  get(): FoundationRegistry {
    if (!this._registry) {
      throw new Error(
        '[FoundationRegistry] Foundation services not registered. ' +
        'Call registerFoundation() in app bootstrap before accessing foundation services. ' +
        'In tests, call registerFoundation() in beforeEach().'
      );
    }
    return this._registry;
  }

  /** For test teardown only. Do NOT call in production code. */
  reset(): void {
    this._registry = null;
  }

  get isRegistered(): boolean {
    return this._registry !== null;
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

const _container = new FoundationRegistryContainer();

/**
 * Register foundation service implementations.
 * Call once during app bootstrap, or in test beforeEach() with mocks.
 */
export function registerFoundation(registry: FoundationRegistry): void {
  _container.register(registry);
}

/**
 * Access registered foundation services.
 * Throws if registerFoundation() has not been called.
 *
 * @example
 * const candidates = await getFoundation().org.getAssignablesInUnit(branchId, options);
 */
export function getFoundation(): FoundationRegistry {
  return _container.get();
}

/**
 * Check if foundation has been registered (useful in middleware/guards).
 */
export function isFoundationReady(): boolean {
  return _container.isRegistered;
}

/**
 * Reset foundation registry. FOR TEST TEARDOWN ONLY.
 * Calling this in production code will break all downstream services.
 */
export function resetFoundation(): void {
  _container.reset();
}
