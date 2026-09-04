/**
 * @fileoverview Authorization Boundary
 * 
 * Separate authorization layer from validation.
 * 
 * Gate validates → Authorization decides → Truth becomes CANONICAL.
 * 
 * CRITICAL: This is the governance decision point.
 * Validation (gate) is necessary but not sufficient for canonicalization.
 * 
 * @module platform/business-truth/gate/authorization
 */

import type { BusinessTruth, BusinessTruthDocument } from '../types/business-truth';
import type { GateResult } from './types';
import type { ApprovalAuthority } from '../types/authority';

/**
 * Authorization decision result.
 */
export interface AuthorizationDecision {
  authorized: boolean;
  authority: ApprovalAuthority | null;
  reason: string;
  timestamp: Date;
}

/**
 * Authorization policy input.
 */
export interface AuthorizationRequest {
  btd: BusinessTruthDocument;
  gateResult: GateResult;
  requestedBy?: string; // Optional: who requested authorization
}

/**
 * Authorization Boundary.
 * 
 * Applies authorization policy after gate validation.
 */
export class AuthorizationBoundary {
  /**
   * Apply authorization policy.
   * 
   * @param request - Authorization request
   * @returns Authorization decision
   */
  authorize(request: AuthorizationRequest): AuthorizationDecision {
    const { btd, gateResult, requestedBy } = request;
    
    // Gate validation is prerequisite
    if (!gateResult.validated) {
      return {
        authorized: false,
        authority: null,
        reason: 'Gate validation failed. Cannot authorize.',
        timestamp: new Date()
      };
    }
    
    // Apply policy based on gate recommendation
    switch (gateResult.authorizationStatus) {
      case 'BLOCKED':
        return {
          authorized: false,
          authority: null,
          reason: gateResult.authorizationReason,
          timestamp: new Date()
        };
      
      case 'AUTO_APPROVED':
        // Policy: Auto-approve if validated + high confidence + no conflicts + no alternatives
        return {
          authorized: true,
          authority: 'AI',
          reason: 'Auto-approved: high confidence, no conflicts, no alternatives.',
          timestamp: new Date()
        };
      
      case 'REQUIRES_HUMAN':
        // Policy: Requires explicit human approval
        // In real implementation, this would check if human approval was provided
        // For now, return NOT authorized (human must explicitly approve)
        return {
          authorized: false,
          authority: null,
          reason: 'Requires human approval. Document contains business decisions or low confidence truths.',
          timestamp: new Date()
        };
      
      default:
        return {
          authorized: false,
          authority: null,
          reason: 'Unknown authorization status.',
          timestamp: new Date()
        };
    }
  }
  
  /**
   * Apply human authorization explicitly.
   * 
   * @param request - Authorization request
   * @param approver - Human approver identifier
   * @returns Authorization decision
   */
  authorizeByHuman(
    request: AuthorizationRequest,
    approver: string
  ): AuthorizationDecision {
    const { gateResult } = request;
    
    // Gate validation is prerequisite
    if (!gateResult.validated) {
      return {
        authorized: false,
        authority: null,
        reason: 'Gate validation failed. Cannot authorize even with human approval.',
        timestamp: new Date()
      };
    }
    
    // Human can authorize if gate passed
    return {
      authorized: true,
      authority: 'HUMAN',
      reason: `Approved by ${approver}.`,
      timestamp: new Date()
    };
  }
  
  /**
   * Update Business Truth Document with authorization.
   * 
   * Applies authorization decision to BTD metadata.
   * 
   * @param btd - Business Truth Document
   * @param decision - Authorization decision
   * @returns Updated BTD
   */
  applyAuthorization(
    btd: BusinessTruthDocument,
    decision: AuthorizationDecision
  ): BusinessTruthDocument {
    if (!decision.authorized) {
      throw new Error('Cannot apply authorization: not authorized.');
    }
    
    return {
      ...btd,
      metadata: {
        ...btd.metadata,
        approvedBy: decision.authority || 'UNKNOWN',
        approvalDate: decision.timestamp
      }
    };
  }
}
