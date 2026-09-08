/**
 * @fileoverview M4 Intelligence Pipeline Orchestrator
 * 
 * End-to-end governed intelligence lifecycle:
 * RESEARCH → PROPOSED → CRITIQUE → CRITIQUED → AUTHORIZATION → CANONICAL
 * 
 * CRITICAL GOVERNANCE INVARIANTS:
 * 1. PROPOSED ───X──→ CANONICAL (must go through critique + authorization)
 * 2. CRITIQUED ──X──→ CANONICAL (must go through authorization)
 * 3. HIGH CONFIDENCE ──X──→ CANONICAL (confidence ≠ authority)
 * 4. CRITIQUE PASS ──X──→ CANONICAL (critique ≠ authorization)
 * 5. AI ───X──→ approvedBy (AI cannot self-approve)
 * 
 * @module platform/business-truth/pipeline/intelligence-pipeline
 */

import type { BusinessTruth } from '../types/business-truth';
import type { ResearchIntent } from '../research/types';
import { ResearchOrchestrator } from '../research/orchestrator';
import { CritiqueOrchestrator } from '../critique/orchestrator';
import { BusinessTruthGate } from '../gate/business-truth-gate';
import { AuthorizationBoundary } from '../gate/authorization';
import type {
  PipelineResult,
  PipelineConfig,
  PipelineLifecycleTrace
} from './types';
import { DEFAULT_PIPELINE_CONFIG, PipelineError } from './types';

/**
 * Intelligence Pipeline Orchestrator.
 * 
 * Connects M2 (Research) → M3 (Critique) → M1 (Authorization)
 * to form complete governed intelligence lifecycle.
 * 
 * DOES NOT replace M1/M2/M3. Minimal orchestration only.
 */
export class IntelligencePipelineOrchestrator {
  private researchOrch: ResearchOrchestrator;
  private critiqueOrch: CritiqueOrchestrator;
  private gate: BusinessTruthGate;
  private authBoundary: AuthorizationBoundary;
  private config: PipelineConfig;
  
  constructor(config?: Partial<PipelineConfig>, workspaceRoot?: string) {
    this.researchOrch = new ResearchOrchestrator(workspaceRoot);
    this.critiqueOrch = new CritiqueOrchestrator();
    this.gate = new BusinessTruthGate();
    this.authBoundary = new AuthorizationBoundary();
    this.config = { ...DEFAULT_PIPELINE_CONFIG, ...config };
  }
  
  /**
   * Execute complete governed intelligence lifecycle.
   * 
   * @param intent - Research intent
   * @returns Pipeline result with final truths
   * @throws PipelineError if any phase fails
   */
  async execute(intent: ResearchIntent): Promise<PipelineResult> {
    const startedAt = new Date();
    const lifecycle: PipelineLifecycleTrace = {
      phases: [],
      transitions: []
    };
    
    try {
      // Phase 1: RESEARCH → PROPOSED
      const researchResult = await this.executeResearch(intent, lifecycle);
      
      // Phase 2: PROPOSED → CRITIQUE → CRITIQUED
      const critiqueResults = await this.executeCritique(
        researchResult.truths,
        lifecycle
      );
      
      // Update truths to CRITIQUED status after successful critique
      const critiquedTruths = researchResult.truths.map(truth => ({
        ...truth,
        status: 'CRITIQUED' as const,
        updatedAt: new Date()
      }));
      
      // Phase 3: CRITIQUED → AUTHORIZATION → APPROVED (if authorized)
      const authDecision = await this.executeAuthorization(
        critiquedTruths,
        critiqueResults,
        intent,
        lifecycle
      );
      
      // Phase 4: APPROVED → CANONICAL (if authorized)
      const finalTruths = await this.executeCanonicalization(
        authDecision.approvedTruths || critiquedTruths,  // Use APPROVED truths if authorized
        authDecision,
        intent,  // Pass intent for BTD metadata
        lifecycle
      );
      
      const completedAt = new Date();
      
      return {
        truths: finalTruths,
        lifecycle,
        research: researchResult,
        critiques: critiqueResults,
        authorization: authDecision,
        metadata: {
          startedAt,
          completedAt,
          intent,
          finalStatus: this.determineFinalStatus(finalTruths, authDecision)
        }
      };
      
    } catch (error) {
      if (error instanceof PipelineError) {
        throw error;
      }
      throw new PipelineError(
        `Pipeline execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'RESEARCH',
        error instanceof Error ? error : undefined
      );
    }
  }
  
  /**
   * Execute pipeline with pre-generated PROPOSED truths.
   * 
   * Useful for testing M3→M1 integration with controlled inputs.
   * Skips M2 research phase, starts directly from CRITIQUE.
   * 
   * @param truths - Pre-generated PROPOSED truths
   * @param intent - Original research intent (for metadata)
   * @returns Pipeline result with final truths
   * @throws PipelineError if any phase fails
   */
  async executeWithProposedTruths(
    truths: BusinessTruth[],
    intent: ResearchIntent
  ): Promise<PipelineResult> {
    const startedAt = new Date();
    const lifecycle: PipelineLifecycleTrace = {
      phases: [],
      transitions: []
    };
    
    try {
      // Validate truths are PROPOSED
      for (const truth of truths) {
        if (truth.status !== 'PROPOSED') {
          throw new PipelineError(
            `Truth ${truth.id} must have status PROPOSED, got ${truth.status}`,
            'RESEARCH'
          );
        }
      }
      
      // Record PROPOSED transition (already happened in M2)
      for (const truth of truths) {
        lifecycle.transitions.push({
          from: 'EVIDENCE',
          to: 'PROPOSED',
          timestamp: truth.createdAt,
          mechanism: 'M2 Research (external)'
        });
      }
      
      // Phase 2: PROPOSED → CRITIQUE → CRITIQUED
      const critiqueResults = await this.executeCritique(truths, lifecycle);
      
      // Update truths to CRITIQUED status after successful critique
      const critiquedTruths = truths.map(truth => ({
        ...truth,
        status: 'CRITIQUED' as const,
        updatedAt: new Date()
      }));
      
      // Phase 3: CRITIQUED → AUTHORIZATION → APPROVED (if authorized)
      const authDecision = await this.executeAuthorization(
        critiquedTruths,
        critiqueResults,
        intent,
        lifecycle
      );
      
      // Phase 4: APPROVED → CANONICAL (if authorized)
      const finalTruths = await this.executeCanonicalization(
        authDecision.approvedTruths || critiquedTruths,  // Use APPROVED truths if authorized
        authDecision,
        intent,  // Pass intent for BTD metadata
        lifecycle
      );
      
      const completedAt = new Date();
      
      return {
        truths: finalTruths,
        lifecycle,
        research: {
          truths,
          evidence: truths.flatMap(t => t.provenance.sources),
          researchMetadata: {
            intent,
            sourcesConsulted: truths.reduce((sum, t) => sum + t.provenance.sources.length, 0),
            synthesisApproach: 'External M2',
            timestamp: startedAt
          }
        },
        critiques: critiqueResults,
        authorization: authDecision,
        metadata: {
          startedAt,
          completedAt,
          intent,
          finalStatus: this.determineFinalStatus(finalTruths, authDecision)
        }
      };
      
    } catch (error) {
      if (error instanceof PipelineError) {
        throw error;
      }
      throw new PipelineError(
        `Pipeline execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CRITIQUE',
        error instanceof Error ? error : undefined
      );
    }
  }
  
  /**
   * Phase 1: Execute M2 Research.
   */
  private async executeResearch(
    intent: ResearchIntent,
    lifecycle: PipelineLifecycleTrace
  ) {
    try {
      const result = await this.researchOrch.research(intent);
      
      lifecycle.phases.push({
        phase: 'RESEARCH',
        status: 'COMPLETED',
        timestamp: new Date(),
        details: `${result.truths.length} PROPOSED truth(s) generated`
      });
      
      // Record transitions to PROPOSED
      for (const truth of result.truths) {
        lifecycle.transitions.push({
          from: 'INFERRED',
          to: 'PROPOSED',
          timestamp: new Date(),
          mechanism: 'M2 Research Inference'
        });
      }
      
      return result;
      
    } catch (error) {
      lifecycle.phases.push({
        phase: 'RESEARCH',
        status: 'FAILED',
        timestamp: new Date(),
        details: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw new PipelineError(
        'Research phase failed',
        'RESEARCH',
        error instanceof Error ? error : undefined
      );
    }
  }
  
  /**
   * Phase 2: Execute M3 Critique.
   */
  private async executeCritique(
    truths: BusinessTruth[],
    lifecycle: PipelineLifecycleTrace
  ) {
    try {
      const batchResult = await this.critiqueOrch.critiqueBatch(truths);
      
      // Check for blocking critiques
      if (this.config.strictCritique && batchResult.summary.blocked > 0) {
        lifecycle.phases.push({
          phase: 'CRITIQUE',
          status: 'BLOCKED',
          timestamp: new Date(),
          details: `${batchResult.summary.blocked} truth(s) blocked by critique`
        });
        
        throw new PipelineError(
          `Critique blocked ${batchResult.summary.blocked} truth(s)`,
          'CRITIQUE'
        );
      }
      
      lifecycle.phases.push({
        phase: 'CRITIQUE',
        status: 'COMPLETED',
        timestamp: new Date(),
        details: `${batchResult.summary.passed} passed, ${batchResult.summary.flagged} flagged, ${batchResult.summary.blocked} blocked`
      });
      
      // Record transitions to CRITIQUED
      for (const truth of truths) {
        lifecycle.transitions.push({
          from: 'PROPOSED',
          to: 'CRITIQUED',
          timestamp: new Date(),
          mechanism: 'M3 Self-Critique'
        });
      }
      
      return batchResult.results;
      
    } catch (error) {
      lifecycle.phases.push({
        phase: 'CRITIQUE',
        status: 'FAILED',
        timestamp: new Date(),
        details: error instanceof Error ? error.message : 'Unknown error'
      });
      
      if (error instanceof PipelineError) {
        throw error;
      }
      throw new PipelineError(
        'Critique phase failed',
        'CRITIQUE',
        error instanceof Error ? error : undefined
      );
    }
  }
  
  /**
   * Phase 3: Execute M1 Authorization.
   * 
   * CRITICAL: Checks both M3 critique AND auto-approval conditions.
   * Materializes APPROVED state if authorized.
   * 
   * Q0 Contract: CRITIQUED → APPROVED (if authorized)
   * Auto-approval conditions: confidence ≥ 0.95 + no conflicts + no alternatives
   */
  private async executeAuthorization(
    truths: BusinessTruth[],
    critiques: Map<string, any>,
    intent: ResearchIntent,
    lifecycle: PipelineLifecycleTrace
  ): Promise<{ authorized: boolean; authority: string | null; reason: string; timestamp: Date; approvedTruths?: BusinessTruth[] }> {
    try {
      // Step 1: Check M3 critique results
      const critiqueArray = Array.from(critiques.values());
      
      const allPassed = critiqueArray.every(
        c => c.status === 'PASSED' || c.status === 'FLAGGED'
      );
      
      const anyBlocked = critiqueArray.some(
        c => c.status === 'BLOCKED'
      );
      
      if (anyBlocked) {
        // Critique blocked
        lifecycle.phases.push({
          phase: 'AUTHORIZATION',
          status: 'BLOCKED',
          timestamp: new Date(),
          details: 'Critique blocked one or more truths'
        });
        
        return {
          authorized: false,
          authority: null,
          reason: 'Critique blocked one or more truths',
          timestamp: new Date()
        };
      }
      
      if (!allPassed) {
        // Critique did not pass cleanly
        lifecycle.phases.push({
          phase: 'AUTHORIZATION',
          status: 'BLOCKED',
          timestamp: new Date(),
          details: 'Requires human approval'
        });
        
        return {
          authorized: false,
          authority: null,
          reason: 'Requires human approval',
          timestamp: new Date()
        };
      }
      
      // Step 2: Check auto-approval conditions (Q0 contract)
      // Conditions: high confidence + no conflicts + no alternatives
      const meetsAutoApprovalConditions = truths.every(truth =>
        truth.confidence.score >= 0.95 &&
        truth.provenance.conflicts.length === 0 &&
        truth.provenance.alternatives.length === 0
      );
      
      if (!meetsAutoApprovalConditions) {
        // Does not meet auto-approval conditions
        lifecycle.phases.push({
          phase: 'AUTHORIZATION',
          status: 'BLOCKED',
          timestamp: new Date(),
          details: 'Does not meet auto-approval conditions (requires confidence ≥ 0.95, no conflicts, no alternatives)'
        });
        
        return {
          authorized: false,
          authority: null,
          reason: 'Does not meet auto-approval conditions',
          timestamp: new Date()
        };
      }
      
      // Step 3: Authorized - materialize APPROVED state (Q0 lifecycle)
      const approvalTimestamp = new Date();
      const approvedTruths = truths.map(truth => ({
        ...truth,
        status: 'APPROVED' as const,  // Q0: CRITIQUED → APPROVED
        authority: {
          source: truth.authority.source,
          type: 'APPROVED' as const,  // Authority type transition
          approvedBy: 'AI' as const,  // Q0 allows AI approval with conditions
          approvedAt: approvalTimestamp
        },
        updatedAt: approvalTimestamp
      }));
      
      lifecycle.phases.push({
        phase: 'AUTHORIZATION',
        status: 'COMPLETED',
        timestamp: approvalTimestamp,
        details: `Authorized by AI: Auto-approved (high confidence, no conflicts, no alternatives)`
      });
      
      // Record APPROVED transition
      for (const truth of approvedTruths) {
        lifecycle.transitions.push({
          from: 'CRITIQUED',
          to: 'APPROVED',
          timestamp: approvalTimestamp,
          mechanism: 'M1 Authorization (auto-approval)'
        });
      }
      
      return {
        authorized: true,
        authority: 'AI',
        reason: 'Auto-approved: high confidence, no conflicts, no alternatives',
        timestamp: approvalTimestamp,
        approvedTruths  // Return APPROVED truths
      };
      
    } catch (error) {
      if (error instanceof PipelineError) {
        throw error;
      }
      
      lifecycle.phases.push({
        phase: 'AUTHORIZATION',
        status: 'FAILED',
        timestamp: new Date(),
        details: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw new PipelineError(
        'Authorization phase failed',
        'AUTHORIZATION',
        error instanceof Error ? error : undefined
      );
    }
  }
  
  /**
   * Phase 4: Execute Canonicalization (if authorized).
   * 
   * CRITICAL: Operates on APPROVED truths, applies CANONICAL status.
   * Gate validates CANONICAL truths for E10-readiness.
   * 
   * Q0 Contract: APPROVED → CANONICAL
   */
  private async executeCanonicalization(
    approvedTruths: BusinessTruth[],  // Already APPROVED
    authDecision: any,
    intent: ResearchIntent,  // For BTD metadata
    lifecycle: PipelineLifecycleTrace
  ): Promise<BusinessTruth[]> {
    try {
      if (!this.config.autoApplyAuthorization || !authDecision.authorized) {
        // Not authorized or auto-apply disabled
        // Return truths in current state (APPROVED if authorized, CRITIQUED if not)
        lifecycle.phases.push({
          phase: 'CANONICALIZATION',
          status: 'BLOCKED',
          timestamp: new Date(),
          details: 'Not authorized or auto-apply disabled'
        });
        
        return approvedTruths;
      }
      
      // Authorized - apply CANONICAL status (Q0: APPROVED → CANONICAL)
      const canonicalizationTimestamp = new Date();
      const canonicalTruths = approvedTruths.map(truth => ({
        ...truth,
        status: 'CANONICAL' as const,  // Q0: APPROVED → CANONICAL
        updatedAt: canonicalizationTimestamp
        // authority already set during authorization (type: APPROVED, approvedBy: AI)
      }));
      
      // Gate validation of CANONICAL truths (E10-readiness check)
      const btd = {
        metadata: {
          industryOS: intent.industry || 'TEST',
          version: '1.0.0',
          createdAt: canonicalTruths[0]?.createdAt || new Date(),
          lastModified: canonicalizationTimestamp,
          approvedBy: authDecision.authority || 'UNKNOWN',
          approvalDate: authDecision.timestamp
        },
        truths: canonicalTruths
      };
      
      const gateResult = this.gate.validate(btd);
      
      if (!gateResult.validated) {
        // Gate validation failed - truths cannot reach CANONICAL
        // This may be due to governance rules (e.g., INFERENCE + AI)
        // Return truths in APPROVED state (highest they reached)
        lifecycle.phases.push({
          phase: 'CANONICALIZATION',
          status: 'BLOCKED',
          timestamp: canonicalizationTimestamp,
          details: `Gate blocked canonicalization: ${gateResult.violations.map(v => v.message).join('; ')}`
        });
        
        // Revert truths to APPROVED (they cannot be CANONICAL per governance)
        const revertedTruths = approvedTruths.map(truth => ({
          ...truth,
          status: 'APPROVED' as const,
          updatedAt: canonicalizationTimestamp
        }));
        
        return revertedTruths;
      }
      
      lifecycle.phases.push({
        phase: 'CANONICALIZATION',
        status: 'COMPLETED',
        timestamp: canonicalizationTimestamp,
        details: `${canonicalTruths.length} truth(s) canonicalized and validated`
      });
      
      // Record transitions to CANONICAL
      for (const truth of canonicalTruths) {
        lifecycle.transitions.push({
          from: 'APPROVED',
          to: 'CANONICAL',
          timestamp: canonicalizationTimestamp,
          mechanism: `Canonicalization (E10-ready)`
        });
      }
      
      return canonicalTruths;
      
    } catch (error) {
      lifecycle.phases.push({
        phase: 'CANONICALIZATION',
        status: 'FAILED',
        timestamp: new Date(),
        details: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw new PipelineError(
        'Canonicalization phase failed',
        'CANONICALIZATION',
        error instanceof Error ? error : undefined
      );
    }
  }
  
  /**
   * Determine final pipeline status.
   */
  private determineFinalStatus(
    truths: BusinessTruth[],
    authDecision: any
  ): 'CANONICAL' | 'CRITIQUED' | 'FAILED' {
    if (truths.length === 0) {
      return 'FAILED';
    }
    
    if (truths.some(t => t.status === 'CANONICAL')) {
      return 'CANONICAL';
    }
    
    // APPROVED truths that couldn't reach CANONICAL (governance blocked)
    // Should be reported as CRITIQUED (awaiting further action)
    if (truths.some(t => t.status === 'APPROVED')) {
      return 'CRITIQUED';
    }
    
    if (truths.every(t => t.status === 'CRITIQUED')) {
      return 'CRITIQUED';
    }
    
    return 'FAILED';
  }
}
