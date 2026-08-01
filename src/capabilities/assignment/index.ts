/**
 * @module capabilities/assignment
 *
 * Bella EIP — Assignment Capability (Layer 2)
 *
 * This Capability bridges the Foundation Layer (Org + People) with Business Modules
 * that need to assign resources (Sales, Brokers, Agents) to business entities (Leads, Requests).
 *
 * Layer 2 — Capability. Sits ABOVE Foundation, BELOW Business Modules.
 *
 * Key concepts:
 * - LeadAssignmentService: High-level service used by Real Estate Lead Engine
 * - Converts Foundation's AssignableReference → Legacy SalesAgent (bridge pattern)
 * - Supports both Strangler Fig migration (bridge) and native foundation usage
 *
 * Usage from Real Estate module:
 * ```ts
 * import { createLeadAssignmentService } from '@/capabilities/assignment';
 * import { createSupabaseFoundation } from '@/foundation';
 * import { createClient } from '@/lib/supabase-server';
 *
 * const db = createClient();
 * const foundation = createSupabaseFoundation(db);
 * const assignmentSvc = createLeadAssignmentService(foundation);
 *
 * const candidates = await assignmentSvc.getCandidatesForLead({
 *   tenantId,
 *   branchId: lead.branchId,
 *   projectId: lead.interestedProject,
 *   excludeIds: [lead.currentSaleId],
 * });
 * ```
 *
 * @layer Capability (Layer 2)
 * @see src/foundation/contracts/services.ts — EligibilityFilter, AssignmentQueryService
 * @see src/platform/lead-engine/ — Legacy Lead Engine (FROZEN, do not modify)
 */

export { LeadAssignmentService, createLeadAssignmentService } from './LeadAssignmentService';
export type { LeadCandidatePool, LeadAssignmentContext, BridgedSalesAgent } from './LeadAssignmentService';
