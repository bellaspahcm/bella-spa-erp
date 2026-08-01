/**
 * @module foundation/contracts/services
 *
 * Foundation Service Contracts (Read/Write separated via CQRS-lite).
 *
 * Design principles:
 * - QueryService = read-only. Safe to call from ANY layer (Capability, Module, AI).
 * - CommandService = write. Only called from appropriate owning layers.
 * - Assignment Engine only imports QueryServices — no write access.
 * - All services are interfaces (contracts). Implementations registered via FoundationRegistry.
 *
 * Dependency rule:
 *   Assignment Engine (Capability) → OrgQueryService + PeopleQueryService (Foundation)
 *   Foundation services NEVER import from Capabilities or Modules.
 *
 * @layer Foundation
 */

import type {
  OrgUnitRef,
  OrgUnitType,
  OrgRelationship,
  BranchRef,
  TeamRef,
} from './organization';

import type {
  AssignableReference,
  AssignableType,
  PersonProfile,
  AssignableAvailability,
} from './people';

// ════════════════════════════════════════════════════════════════════════════
// ORGANIZATION — QUERY SERVICE (Read-only)
// ════════════════════════════════════════════════════════════════════════════

export interface AssignableFilterOptions {
  tenantId: string;
  /** Narrow to people in units of this type, e.g. only 'team' members */
  unitType?: OrgUnitType;
  /** Narrow by person type */
  assignableTypes?: AssignableType[];
  /** Skip inactive / terminated persons */
  activeOnly?: boolean;
}

export interface OrgQueryService {
  /** Get a single org unit by ID */
  getUnit(id: string, tenantId: string): Promise<OrgUnitRef | null>;

  /** Direct children of a unit (one level down) */
  getChildren(parentId: string, tenantId: string): Promise<OrgUnitRef[]>;

  /** All ancestors up to root */
  getAncestors(unitId: string, tenantId: string): Promise<OrgUnitRef[]>;

  /** Convenience: resolve a BranchRef */
  getBranch(branchId: string, tenantId: string): Promise<BranchRef | null>;

  /** Convenience: resolve a TeamRef */
  getTeam(teamId: string, tenantId: string): Promise<TeamRef | null>;

  /** All relationships where this unit is a participant */
  getRelationships(unitId: string, tenantId: string): Promise<OrgRelationship[]>;

  /**
   * Get all assignable persons belonging to this org unit and its descendants.
   * Used by Assignment Engine to build candidate pool.
   *
   * @example
   * // Get all Sales in Branch HCM-Q1
   * const candidates = await org.getAssignablesInUnit('branch-hcm-q1', {
   *   tenantId: 'real_estate',
   *   assignableTypes: ['employee', 'broker'],
   *   activeOnly: true,
   * });
   */
  getAssignablesInUnit(
    unitId: string,
    options: AssignableFilterOptions
  ): Promise<AssignableReference[]>;

  /**
   * Find the direct reporting manager for a person.
   * Used by Approval Workflow to determine approver.
   */
  getManagerOf(
    personId: string,
    tenantId: string
  ): Promise<AssignableReference | null>;
}

// ════════════════════════════════════════════════════════════════════════════
// PEOPLE DIRECTORY — QUERY SERVICE (Read-only)
// ════════════════════════════════════════════════════════════════════════════

export interface AssignableFilter {
  tenantId: string;
  /** Filter by assignable type */
  types?: AssignableType[];
  /** Only return persons belonging to these org units */
  orgUnitIds?: string[];
  /** Skip inactive persons */
  activeOnly?: boolean;
  /** Exclude these IDs from results (e.g. current assignee during rotation) */
  excludeIds?: string[];
}

export interface PeopleQueryService {
  /**
   * Get minimal AssignableReference by ID.
   * Use this in loops and assignment logic — never store displayName from here.
   */
  getAssignable(id: string, tenantId: string): Promise<AssignableReference | null>;

  /**
   * Get full PersonProfile (email, phone, avatar...).
   * Call only when UI or notification needs contact details.
   */
  getProfile(id: string, tenantId: string): Promise<PersonProfile | null>;

  /** Search persons matching filter */
  findAssignables(filter: AssignableFilter): Promise<AssignableReference[]>;

  /**
   * Batch-resolve multiple IDs in a single call.
   * Returns a Map for O(1) lookup. Prefer over multiple getAssignable() calls.
   *
   * @example
   * const map = await people.batchGetAssignables(['id1', 'id2'], tenantId);
   * const name = map.get('id1')?.displayName ?? 'Unknown';
   */
  batchGetAssignables(
    ids: string[],
    tenantId: string
  ): Promise<Map<string, AssignableReference>>;
}

// ════════════════════════════════════════════════════════════════════════════
// ASSIGNMENT — QUERY SERVICE (Read-only)
// Computes eligible assignables for a given resource context.
// Aggregates: Org structure + People availability + HR leave + KPI quota
// ════════════════════════════════════════════════════════════════════════════

export interface EligibilityFilter {
  tenantId: string;
  /** Lead must go to someone in this branch */
  branchId?: string;
  /** Lead must go to someone in this team */
  teamId?: string;
  /** Lead is for this specific real estate project */
  projectId?: string;
  /** Exclude assignable types */
  excludeTypes?: AssignableType[];
  /** Exclude assignables currently on HR leave */
  excludeOnLeave?: boolean;
  /** Exclude assignables who reached their lead quota */
  excludeOverQuota?: boolean;
  /** Exclude assignables with too many open SLA breaches */
  maxSlaBreachCount?: number;
  /** Exclude specific IDs (current assignee during rotation) */
  excludeIds?: string[];
}

export interface AssignmentQueryService {
  /**
   * Returns ordered list of eligible assignables for a given resource.
   * Result order reflects assignment priority (performance score, SLA, quota).
   *
   * This is the single entry point for Lead Engine to get its candidate pool.
   * It never returns HR data — only AssignableReference.
   *
   * @example
   * const candidates = await assignment.getEligibleAssignables({
   *   tenantId: 'real_estate',
   *   branchId: 'branch-hcm-q1',
   *   projectId: 'proj-vinhomes-grand',
   *   excludeOnLeave: true,
   *   excludeOverQuota: true,
   * });
   */
  getEligibleAssignables(filter: EligibilityFilter): Promise<AssignableReference[]>;

  /**
   * Get real-time availability state for a single assignable.
   * Used to validate before committing an assignment.
   */
  getAvailability(
    assignableId: string,
    tenantId: string
  ): Promise<AssignableAvailability>;
}

// ════════════════════════════════════════════════════════════════════════════
// ORGANIZATION — COMMAND SERVICE (Write)
// Only called from Foundation service layer. NOT accessible from Capabilities.
// ════════════════════════════════════════════════════════════════════════════

export interface CreateOrgUnitInput {
  tenantId: string;
  type: OrgUnitType;
  name: string;
  code?: string;
  parentId?: string;
  metadata?: Record<string, unknown>;
}

export interface OrgCommandService {
  createUnit(input: CreateOrgUnitInput): Promise<OrgUnitRef>;
  updateUnit(id: string, tenantId: string, patch: Partial<Pick<OrgUnitRef, 'name' | 'code' | 'metadata'>>): Promise<OrgUnitRef>;
  archiveUnit(id: string, tenantId: string): Promise<void>;
  createRelationship(rel: Omit<OrgRelationship, 'id'>): Promise<OrgRelationship>;
  endRelationship(id: string, until: string): Promise<void>;
}

// ════════════════════════════════════════════════════════════════════════════
// PEOPLE — COMMAND SERVICE (Write)
// ════════════════════════════════════════════════════════════════════════════

export interface RegisterPersonInput {
  tenantId: string;
  type: AssignableType;
  displayName: string;
  email?: string;
  phone?: string;
  avatar?: string;
  orgUnitIds?: string[];
  metadata?: Record<string, unknown>;
}

export interface PeopleCommandService {
  registerPerson(input: RegisterPersonInput): Promise<AssignableReference>;
  updateDisplayName(id: string, tenantId: string, displayName: string): Promise<void>;
  updateProfile(id: string, tenantId: string, patch: Partial<PersonProfile>): Promise<void>;
  deactivatePerson(id: string, tenantId: string): Promise<void>;
}
