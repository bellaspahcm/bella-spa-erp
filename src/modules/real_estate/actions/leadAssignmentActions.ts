'use server';

/**
 * @module modules/real_estate/actions/leadAssignmentActions
 *
 * Real Estate — Lead Assignment Server Actions
 *
 * Uses the Assignment Capability (Layer 2) which bridges
 * Foundation (Org + People Directory) to the Lead Engine.
 *
 * Strangler Fig pattern:
 * - These actions REPLACE the hardcoded SalesAgent list in legacy rotation engine.
 * - Legacy LeadRotationEngine is NOT modified — it receives bridgedAgents instead.
 * - Future Phase: LeadRotationEngine will accept AssignableReference natively.
 *
 * @layer Module (Layer 3) — Real Estate
 * @see src/capabilities/assignment/LeadAssignmentService.ts
 */

import { createClient } from '@/lib/supabase-server';
import { createSupabaseFoundation } from '@/foundation';
import { createLeadAssignmentService, BridgedSalesAgent, LeadCandidatePool } from '@/capabilities/assignment';
import type { AssignableReference } from '@/foundation';

// ─── Action Input Types ───────────────────────────────────────────────────────

export interface GetLeadCandidatesInput {
  tenantId: string;
  /** Filter to this branch. Use 'BRANCH-HCM' or a real UUID from org_units. */
  branchId?: string;
  /** Filter to this project (org context UUID from org_units). */
  projectId?: string;
  /** Exclude the current assignee during rotation. */
  excludeIds?: string[];
  /** Skip people on leave (default: true). */
  excludeOnLeave?: boolean;
}

// ─── Action Output Types ──────────────────────────────────────────────────────

export interface GetLeadCandidatesResult {
  success: boolean;
  /** Ordered list of eligible candidates (AssignableReference) */
  candidates?: AssignableReference[];
  /** Bridge-compatible list for legacy rotation engine */
  bridgedAgents?: BridgedSalesAgent[];
  /** The top-priority candidate */
  topCandidate?: AssignableReference | null;
  error?: string;
}

export interface ValidateCandidateResult {
  success: boolean;
  isEligible?: boolean;
  reason?: string;
  error?: string;
}

export interface ResolveAssigneeResult {
  success: boolean;
  assignee?: AssignableReference | null;
  error?: string;
}

export interface GetAllInScopeResult {
  success: boolean;
  candidates?: AssignableReference[];
  bridgedAgents?: BridgedSalesAgent[];
  error?: string;
}

// ─── Server Actions ───────────────────────────────────────────────────────────

/**
 * Get ordered list of eligible candidates for lead assignment.
 * Used by:
 * - Auto-assignment: pick pool.topCandidate
 * - Rotation: pass pool.bridgedAgents to LeadRotationEngine.rotateLead()
 * - Manual assignment dropdown: display pool.candidates
 */
export async function getLeadCandidatesAction(
  input: GetLeadCandidatesInput
): Promise<GetLeadCandidatesResult> {
  try {
    const db = createClient();
    const foundation = createSupabaseFoundation(db);
    const assignmentSvc = createLeadAssignmentService(foundation);

    const pool: LeadCandidatePool = await assignmentSvc.getCandidatesForLead({
      tenantId: input.tenantId,
      branchId: input.branchId,
      projectId: input.projectId,
      excludeIds: input.excludeIds,
      excludeOnLeave: input.excludeOnLeave ?? true,
    });

    return {
      success: true,
      candidates: pool.candidates,
      bridgedAgents: pool.bridgedAgents,
      topCandidate: pool.topCandidate,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[getLeadCandidatesAction] error: %s', msg);
    return { success: false, error: msg };
  }
}

/**
 * Validate a specific candidate is still eligible before committing assignment.
 * Call this just before saving to DB to avoid race conditions.
 */
export async function validateLeadCandidateAction(
  assignableId: string,
  tenantId: string
): Promise<ValidateCandidateResult> {
  try {
    const db = createClient();
    const foundation = createSupabaseFoundation(db);
    const assignmentSvc = createLeadAssignmentService(foundation);

    const result = await assignmentSvc.validateCandidate(assignableId, tenantId);
    return { success: true, ...result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[validateLeadCandidateAction] error: %s', msg);
    return { success: false, error: msg };
  }
}

/**
 * Resolve a single assignee by ID for display in lead detail.
 * Used when loading a lead record that has a currentSaleId.
 */
export async function resolveLeadAssigneeAction(
  assignableId: string,
  tenantId: string
): Promise<ResolveAssigneeResult> {
  try {
    const db = createClient();
    const foundation = createSupabaseFoundation(db);
    const assignmentSvc = createLeadAssignmentService(foundation);

    const assignee = await assignmentSvc.resolveAssignee(assignableId, tenantId);
    return { success: true, assignee };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[resolveLeadAssigneeAction] error: %s', msg);
    return { success: false, error: msg };
  }
}

/**
 * Get all people in scope (branch/team) for manual assignment dropdown.
 * Unlike getLeadCandidatesAction, this does NOT filter by availability.
 * Used when a manager manually overrides assignment.
 */
export async function getAllInScopeAction(input: {
  tenantId: string;
  branchId?: string;
  teamId?: string;
}): Promise<GetAllInScopeResult> {
  try {
    const db = createClient();
    const foundation = createSupabaseFoundation(db);
    const assignmentSvc = createLeadAssignmentService(foundation);

    const result = await assignmentSvc.getAllInScope(input);
    return { success: true, ...result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[getAllInScopeAction] error: %s', msg);
    return { success: false, error: msg };
  }
}
