/**
 * @module foundation
 *
 * Bella EIP — Enterprise Foundation Layer
 *
 * The Foundation Layer provides shared business infrastructure used by all Capabilities and Modules.
 * It sits between the Platform (technical infrastructure) and Capabilities (business logic).
 *
 * Layer order (dependency flows DOWN only):
 *   Layer 0 — Shared Contracts (ExecutionContext, IAM, Event Bus, Feature Flags)
 *   Layer 1 — Foundation (THIS MODULE: Organization, People, Calendar, Location)
 *   Layer 2 — Capabilities (HR, CRM, Finance, Assignment, KPI)
 *   Layer 3 — Business Modules (Real Estate, Beauty Spa, Baby Care)
 *   Layer 4 — AI / Analytics / Automation
 *
 * INVARIANT: Foundation must NEVER import from Capabilities, Modules, or AI layers.
 *
 * @see src/foundation/contracts/registry.ts for bootstrap instructions
 * @see src/foundation/testing/createTestFoundation.ts for test setup
 */

// ── Contracts (interfaces) — import from here in all production code ──────────
export * from './contracts';

// ── InMemory implementations — for testing only ───────────────────────────────
// Production code should use Supabase implementations (see below)
export { InMemoryOrgProvider } from './organization';
export type { OrgSeedData } from './organization';

export { InMemoryPeopleProvider } from './people';
export type { PeopleSeedData, PersonSeedEntry } from './people';

export { InMemoryAssignmentProvider } from './assignment';

// ── Supabase implementations — for production use ─────────────────────────────
export { SupabaseOrgProvider } from './organization/SupabaseOrgProvider';
export { SupabasePeopleProvider } from './people/SupabasePeopleProvider';

// ── Production Bootstrap ───────────────────────────────────────────────────────
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseOrgProvider as _SupabaseOrgProvider } from './organization/SupabaseOrgProvider';
import { SupabasePeopleProvider as _SupabasePeopleProvider } from './people/SupabasePeopleProvider';
import { InMemoryAssignmentProvider as _InMemoryAssignmentProvider } from './assignment';
import type { FoundationRegistry } from './contracts';

/**
 * Create a production Foundation registry backed by Supabase.
 *
 * Usage (in a Server Action or Route Handler):
 * ```ts
 * import { createSupabaseFoundation } from '@/foundation';
 * import { createClient } from '@/lib/supabase-server';
 *
 * const db = createClient();
 * const foundation = createSupabaseFoundation(db);
 * const candidates = await foundation.org.getAssignablesInUnit(branchId, { tenantId });
 * ```
 *
 * @param db - Supabase client (server-side, with auth context)
 */
export function createSupabaseFoundation(db: SupabaseClient): FoundationRegistry {
  const org = new _SupabaseOrgProvider(db);
  const people = new _SupabasePeopleProvider(db);
  // Assignment provider uses Org + People — InMemory is OK until Phase 1.4 Assignment
  const assignment = new _InMemoryAssignmentProvider(org, people);

  return {
    org,
    people,
    assignment,
    orgCommand: org,       // SupabaseOrgProvider implements both Query + Command
    peopleCommand: people, // SupabasePeopleProvider implements both Query + Command
  };
}
