/**
 * Decision Engine - Sprint 2 Exports
 * 
 * Simplified exports for Leave Approval integration.
 * Old system components moved to archive-old-system/
 */

// ============ Sprint 2: Core Types ============
export type { 
  Knowledge, 
  DecisionOutcome, 
  DecisionResult,
  Policy,
  Rule
} from './types';

// ============ Sprint 2: Core Engine ============
export { RuleReasoner } from './RuleReasoner';

// ============ Sprint 2: Policies ============
export { leaveApprovalPolicyV1 } from './policies/leave-approval-v1';

// ============ Sprint 2: Policy Registry (for Week 2) ============
export { PolicyRegistry } from './registry/PolicyRegistry';
export type { 
  PolicyMetadata, 
  PolicyStatus 
} from './registry/types';
