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
// Production code should use Supabase implementations (Phase 1.3)
export { InMemoryOrgProvider } from './organization';
export type { OrgSeedData } from './organization';

export { InMemoryPeopleProvider } from './people';
export type { PeopleSeedData, PersonSeedEntry } from './people';

export { InMemoryAssignmentProvider } from './assignment';
