/**
 * @fileoverview Business Truth Adapter - E10 Consumption Boundary
 * 
 * Enforces that E10 Factory can ONLY consume AUTHORIZED + CANONICAL truths.
 * 
 * This is the final gate before E10 receives Business Truth Document.
 * 
 * @module scripts/factory/business-truth-adapter
 */

import type { BusinessTruthDocument } from '../../src/platform/business-truth/types/business-truth';
import { BusinessTruthGate } from '../../src/platform/business-truth/gate/business-truth-gate';
import { AuthorizationBoundary } from '../../src/platform/business-truth/gate/authorization';
import type { GateResult } from '../../src/platform/business-truth/gate/types';
import type { AuthorizationDecision } from '../../src/platform/business-truth/gate/authorization';

/**
 * E10 consumption error.
 */
export class E10ConsumptionError extends Error {
  constructor(
    message: string,
    public gateResult?: GateResult,
    public authDecision?: AuthorizationDecision
  ) {
    super(message);
    this.name = 'E10ConsumptionError';
  }
}

/**
 * Business Truth Adapter.
 * 
 * Provides validated, authorized Business Truth Documents to E10 Factory.
 */
export class BusinessTruthAdapter {
  private gate: BusinessTruthGate;
  private authBoundary: AuthorizationBoundary;
  
  constructor() {
    this.gate = new BusinessTruthGate();
    this.authBoundary = new AuthorizationBoundary();
  }
  
  /**
   * Validate and authorize Business Truth Document for E10 consumption.
   * 
   * This is the ONLY entry point for E10 Factory to receive BTD.
   * Bypassing this method is architectural violation.
   * 
   * @param btd - Business Truth Document
   * @returns Validated and authorized BTD
   * @throws E10ConsumptionError if validation or authorization fails
   */
  prepareForE10(btd: BusinessTruthDocument): BusinessTruthDocument {
    // Step 1: Gate validation
    const gateResult = this.gate.validate(btd);
    
    if (!gateResult.validated) {
      const blockingViolations = gateResult.violations
        .filter(v => v.severity === 'BLOCKING')
        .map(v => v.message)
        .join('; ');
      
      throw new E10ConsumptionError(
        `Gate validation failed: ${blockingViolations}`,
        gateResult
      );
    }
    
    // Step 2: Authorization
    const authDecision = this.authBoundary.authorize({
      btd,
      gateResult
    });
    
    if (!authDecision.authorized) {
      throw new E10ConsumptionError(
        `Authorization failed: ${authDecision.reason}`,
        gateResult,
        authDecision
      );
    }
    
    // Step 3: Apply authorization to BTD
    const authorizedBTD = this.authBoundary.applyAuthorization(btd, authDecision);
    
    // Step 4: Final check - all truths must be CANONICAL
    const nonCanonical = authorizedBTD.truths.filter(
      t => t.status !== 'CANONICAL' && t.status !== 'VERSIONED'
    );
    
    if (nonCanonical.length > 0) {
      throw new E10ConsumptionError(
        `E10 cannot consume non-CANONICAL truths: ${nonCanonical.map(t => t.id).join(', ')}`
      );
    }
    
    return authorizedBTD;
  }
  
  /**
   * Prepare BTD with explicit human authorization.
   * 
   * @param btd - Business Truth Document
   * @param approver - Human approver identifier
   * @returns Validated and authorized BTD
   * @throws E10ConsumptionError if validation fails
   */
  prepareForE10WithHumanApproval(
    btd: BusinessTruthDocument,
    approver: string
  ): BusinessTruthDocument {
    // Step 1: Gate validation
    const gateResult = this.gate.validate(btd);
    
    if (!gateResult.validated) {
      throw new E10ConsumptionError(
        'Gate validation failed. Human cannot approve invalid document.',
        gateResult
      );
    }
    
    // Step 2: Human authorization
    const authDecision = this.authBoundary.authorizeByHuman(
      { btd, gateResult },
      approver
    );
    
    // Step 3: Apply authorization
    const authorizedBTD = this.authBoundary.applyAuthorization(btd, authDecision);
    
    // Step 4: Final check
    const nonCanonical = authorizedBTD.truths.filter(
      t => t.status !== 'CANONICAL' && t.status !== 'VERSIONED'
    );
    
    if (nonCanonical.length > 0) {
      throw new E10ConsumptionError(
        `E10 cannot consume non-CANONICAL truths: ${nonCanonical.map(t => t.id).join(', ')}`
      );
    }
    
    return authorizedBTD;
  }
}
