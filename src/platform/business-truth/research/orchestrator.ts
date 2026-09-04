/**
 * @fileoverview Research Orchestrator
 * 
 * Main coordinator for M2 Research Engine.
 * Orchestrates: Collection → Synthesis → Inference → M1 Gate
 * 
 * @module platform/business-truth/research/orchestrator
 */

import type { BusinessTruthDocument } from '../types/business-truth';
import type { ResearchIntent, ResearchResult } from './types';
import { ResearchError } from './types';
import { BellaCollector, WebCollector } from './collectors';
import { EvidenceSynthesizer } from './synthesizer';
import { InferenceEngine } from './inference-engine';
import { BusinessTruthGate } from '../gate/business-truth-gate';

/**
 * Research Orchestrator.
 * 
 * Coordinates the complete research pipeline:
 * Intent → Evidence → Synthesis → Inference → PROPOSED Business Truths
 */
export class ResearchOrchestrator {
  private bellaCollector: BellaCollector;
  private webCollector: WebCollector;
  private synthesizer: EvidenceSynthesizer;
  private inferenceEngine: InferenceEngine;
  private gate: BusinessTruthGate;
  
  constructor(workspaceRoot?: string) {
    this.bellaCollector = new BellaCollector(workspaceRoot);
    this.webCollector = new WebCollector();
    this.synthesizer = new EvidenceSynthesizer();
    this.inferenceEngine = new InferenceEngine();
    this.gate = new BusinessTruthGate();
  }
  
  /**
   * Conduct research and generate Business Truth proposals.
   * 
   * @param intent - Research intent
   * @returns Research result with PROPOSED truths
   * @throws ResearchError if research fails
   */
  async research(intent: ResearchIntent): Promise<ResearchResult> {
    const startedAt = new Date();
    
    try {
      // Phase 1: Evidence Collection
      const evidence = await this.collectEvidence(intent);
      
      // Phase 2: Evidence Synthesis
      const synthesis = this.synthesizer.synthesize(evidence);
      
      // Phase 3: Inference
      const truths = this.inferenceEngine.infer(intent, evidence, synthesis);
      
      // Phase 4: Validate through M1 gate (hard boundary)
      await this.validateThroughGate(truths, intent.industry);
      
      const completedAt = new Date();
      
      return {
        truths,
        evidence,
        synthesis,
        researchMetadata: {
          intent,
          startedAt,
          completedAt,
          sourcesConsulted: evidence.length,
          synthesisApproach: 'Pattern-based with conflict detection'
        }
      };
      
    } catch (error) {
      if (error instanceof ResearchError) {
        throw error;
      }
      throw new ResearchError(
        `Research failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'COLLECTION',
        error instanceof Error ? error : undefined
      );
    }
  }
  
  /**
   * Collect evidence from all sources.
   */
  private async collectEvidence(intent: ResearchIntent) {
    try {
      // Collect from Bella kernels
      const bellaCollection = await this.bellaCollector.collect(intent);
      
      // Collect from web (placeholder for now)
      const webCollection = await this.webCollector.collect(intent);
      
      // Aggregate all evidence
      const allEvidence = [
        ...bellaCollection.evidence,
        ...webCollection.evidence
      ];
      
      if (allEvidence.length === 0) {
        throw new ResearchError(
          'No evidence collected from any source',
          'COLLECTION'
        );
      }
      
      return allEvidence;
      
    } catch (error) {
      throw new ResearchError(
        `Evidence collection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'COLLECTION',
        error instanceof Error ? error : undefined
      );
    }
  }
  
  /**
   * Validate truths for structural correctness (M2 research phase).
   * 
   * This validates: provenance, confidence, authority consistency
   * This does NOT validate: CANONICAL status (E10 concern)
   * 
   * NOTE: Full M1 gate validation (including Invariant 1 & 6) is for
   * E10 consumption phase via BusinessTruthAdapter.
   */
  private async validateThroughGate(
    truths: any[],
    industry: string
  ): Promise<void> {
    // For M2 research validation, we only check structural invariants:
    // - Invariant 2: Authority-Status consistency
    // - Invariant 3: Confidence not authority
    // - Invariant 4: Provenance completeness
    // - Invariant 5: Implementation feasibility (advisory)
    
    // Skip Invariants 1 & 6 (E10 authorization checks) for PROPOSED truths
    
    for (const truth of truths) {
      // Check authority consistency (Invariant 2 logic)
      if (truth.epistemicStatus === 'INFERENCE' &&
          truth.status === 'CANONICAL' &&
          truth.authority.approvedBy !== 'HUMAN') {
        throw new ResearchError(
          'INFERENCE cannot be CANONICAL without HUMAN approval',
          'INFERENCE'
        );
      }
      
      // Check provenance (Invariant 4 logic)
      if (!truth.provenance || !truth.provenance.sources || truth.provenance.sources.length === 0) {
        throw new ResearchError(
          `Truth ${truth.id} missing provenance sources`,
          'INFERENCE'
        );
      }
      
      if (!truth.provenance.reasoning) {
        throw new ResearchError(
          `Truth ${truth.id} missing provenance reasoning`,
          'INFERENCE'
        );
      }
      
      // Check confidence (Invariant 3 logic)
      if (!truth.confidence || typeof truth.confidence.score !== 'number') {
        throw new ResearchError(
          `Truth ${truth.id} missing or invalid confidence`,
          'INFERENCE'
        );
      }
      
      if (truth.confidence.score < 0 || truth.confidence.score > 1) {
        throw new ResearchError(
          `Truth ${truth.id} confidence score out of range: ${truth.confidence.score}`,
          'INFERENCE'
        );
      }
    }
    
    // Structural validation passed
    // (Proposals remain PROPOSED, not APPROVED)
  }
}
