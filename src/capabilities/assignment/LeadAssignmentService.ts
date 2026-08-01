/**
 * @module capabilities/assignment/LeadAssignmentService
 *
 * Lead Assignment Service — Layer 2 Capability
 *
 * Bridges Foundation (AssignableReference, OrgQueryService, PeopleQueryService)
 * with the Real Estate Lead Engine (SalesAgent, rotation logic).
 *
 * Design principles:
 * - NEVER imports from Business Modules (Real Estate, Beauty Spa, etc.)
 * - NEVER modifies legacy platform/lead-engine (FROZEN per Strangler Fig)
 * - Depends only on Foundation contracts (interfaces, not implementations)
 * - Provides BridgedSalesAgent adapter for backward compatibility
 *
 * Migration path:
 *   Phase 1.4 (NOW): Bridge mode — real estate module uses this service;
 *                    internally maps to Foundation AssignableReference
 *   Phase 2.x (FUTURE): Remove bridge; Real Estate Lead Engine uses
 *                        AssignableReference natively
 *
 * @layer Capability (Layer 2)
 */

import type {
  FoundationRegistry,
  AssignableReference,
  AssignableType,
  EligibilityFilter,
} from '@/foundation';

// ─── Bridge Types ─────────────────────────────────────────────────────────────

/**
 * Backward-compatible adapter for legacy SalesAgent shape.
 * Used during Strangler Fig migration — will be removed in Phase 2.x.
 *
 * @deprecated Use AssignableReference directly in new code.
 */
export interface BridgedSalesAgent {
  /** Foundation ID (same as AssignableReference.id) */
  id: string;
  /** Display name from People Directory */
  name: string;
  /** Mapped from AssignableType: 'employee' → 'Sale', 'broker' → 'Broker', etc. */
  role: string;
  /** Foundation type — preserved for new code that needs it */
  _foundationType: AssignableType;
  /** Original AssignableReference — preserved for future native usage */
  _ref: AssignableReference;
}

/**
 * Input context for getting lead assignment candidates.
 * Subset of EligibilityFilter with Real Estate semantics.
 */
export interface LeadAssignmentContext {
  tenantId: string;
  /** Filter candidates to this branch (org unit of type 'branch') */
  branchId?: string;
  /** Filter to candidates on a specific project team */
  projectId?: string;
  /** Filter to a specific team within a branch */
  teamId?: string;
  /** Which person types can receive leads */
  eligibleTypes?: AssignableType[];
  /** Exclude these person IDs (e.g. current assignee) */
  excludeIds?: string[];
  /** Skip people currently on HR leave */
  excludeOnLeave?: boolean;
  /** Skip people who reached their daily/monthly lead quota */
  excludeOverQuota?: boolean;
}

/**
 * Result pool of candidates for lead assignment.
 * Ordered by priority (fewer assignments first, then oldest-last-assigned).
 */
export interface LeadCandidatePool {
  /** Ordered list of eligible assignees */
  candidates: AssignableReference[];
  /** Bridge adapter list for legacy rotation engine */
  bridgedAgents: BridgedSalesAgent[];
  /** The top pick — first candidate in the priority queue, or null if pool is empty */
  topCandidate: AssignableReference | null;
  /** Context snapshot — for logging/audit purposes */
  context: LeadAssignmentContext;
  /** ISO timestamp when pool was computed */
  computedAt: string;
}

// ─── Mapping ──────────────────────────────────────────────────────────────────

const TYPE_TO_ROLE: Record<string, string> = {
  employee: 'Sale Specialist',
  broker: 'Môi giới độc lập',
  agency: 'Đại lý F1',
  partner: 'Đối tác',
  consultant: 'Chuyên gia tư vấn',
  contractor: 'Cộng tác viên',
};

function toRole(type: AssignableType): string {
  return TYPE_TO_ROLE[type] ?? type;
}

function bridgeRef(ref: AssignableReference): BridgedSalesAgent {
  return {
    id: ref.id,
    name: ref.displayName,
    role: toRole(ref.type),
    _foundationType: ref.type,
    _ref: ref,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class LeadAssignmentService {
  constructor(private readonly foundation: FoundationRegistry) {}

  /**
   * Get the eligible candidate pool for a lead assignment.
   *
   * Returns both:
   * 1. `candidates` — native AssignableReference[] for new code
   * 2. `bridgedAgents` — BridgedSalesAgent[] for legacy rotation engine compatibility
   *
   * @example
   * const pool = await svc.getCandidatesForLead({
   *   tenantId,
   *   branchId: 'branch-hcm',
   *   excludeIds: [currentSaleId],
   *   excludeOnLeave: true,
   * });
   *
   * // For legacy rotation engine:
   * rotateLead(lead, pool.bridgedAgents, 'sla_accept_timeout');
   *
   * // For new code:
   * const topRef = pool.topCandidate;
   */
  async getCandidatesForLead(ctx: LeadAssignmentContext): Promise<LeadCandidatePool> {
    const filter: EligibilityFilter = {
      tenantId: ctx.tenantId,
      branchId: ctx.branchId,
      teamId: ctx.teamId,
      projectId: ctx.projectId,
      excludeTypes: ctx.eligibleTypes
        ? (['employee', 'broker', 'agency', 'partner', 'consultant', 'contractor'] as AssignableType[])
            .filter(t => !ctx.eligibleTypes!.includes(t))
        : undefined,
      excludeIds: ctx.excludeIds,
      excludeOnLeave: ctx.excludeOnLeave ?? true,
      excludeOverQuota: ctx.excludeOverQuota ?? false,
    };

    const candidates = await this.foundation.assignment.getEligibleAssignables(filter);

    return {
      candidates,
      bridgedAgents: candidates.map(bridgeRef),
      topCandidate: candidates[0] ?? null,
      context: ctx,
      computedAt: new Date().toISOString(),
    };
  }

  /**
   * Get availability state of a specific assignee.
   * Used before committing an assignment to validate they are still eligible.
   */
  async validateCandidate(
    assignableId: string,
    tenantId: string
  ): Promise<{ isEligible: boolean; reason?: string }> {
    const avail = await this.foundation.assignment.getAvailability(assignableId, tenantId);

    if (avail.isOnLeave) {
      return { isEligible: false, reason: 'Nhân viên đang nghỉ phép' };
    }
    if (avail.isOverQuota) {
      return { isEligible: false, reason: 'Đã đạt hạn mức phân bổ lead' };
    }
    if (avail.slaBreachCount > 5) {
      return { isEligible: false, reason: `Đang có ${avail.slaBreachCount} Lead quá hạn SLA` };
    }

    return { isEligible: true };
  }

  /**
   * Resolve a single assignable by ID for display purposes.
   * Used when loading a lead's currentSaleId to show their name and contact.
   */
  async resolveAssignee(
    assignableId: string,
    tenantId: string
  ): Promise<AssignableReference | null> {
    return this.foundation.people.getAssignable(assignableId, tenantId);
  }

  /**
   * Batch-resolve multiple assignee IDs.
   * Used in list views (lead table, rotation history) for O(1) display resolution.
   */
  async batchResolveAssignees(
    assignableIds: string[],
    tenantId: string
  ): Promise<Map<string, AssignableReference>> {
    return this.foundation.people.batchGetAssignables(assignableIds, tenantId);
  }

  /**
   * Get all candidates in a branch/team for display in assignment dropdown.
   * Unlike getCandidatesForLead(), this does NOT filter by availability.
   * Used for manual assignment override by managers.
   */
  async getAllInScope(ctx: Pick<LeadAssignmentContext, 'tenantId' | 'branchId' | 'teamId'>): Promise<{
    candidates: AssignableReference[];
    bridgedAgents: BridgedSalesAgent[];
  }> {
    const scopeUnitId = ctx.teamId ?? ctx.branchId;
    const candidates = scopeUnitId
      ? await this.foundation.org.getAssignablesInUnit(scopeUnitId, {
          tenantId: ctx.tenantId,
          activeOnly: true,
        })
      : await this.foundation.people.findAssignables({
          tenantId: ctx.tenantId,
          activeOnly: true,
        });

    return {
      candidates,
      bridgedAgents: candidates.map(bridgeRef),
    };
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a LeadAssignmentService from a FoundationRegistry.
 *
 * @example
 * import { createSupabaseFoundation } from '@/foundation';
 * import { createLeadAssignmentService } from '@/capabilities/assignment';
 *
 * const foundation = createSupabaseFoundation(db);
 * const assignmentSvc = createLeadAssignmentService(foundation);
 */
export function createLeadAssignmentService(
  foundation: FoundationRegistry
): LeadAssignmentService {
  return new LeadAssignmentService(foundation);
}
