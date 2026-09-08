/**
 * @fileoverview Test Research Helper for M4
 * 
 * Provides high-quality evidence to M2 research orchestrator for M4 tests.
 * 
 * CRITICAL: This does NOT bypass M2/M3/M1. It provides legitimate
 * high-quality evidence that SHOULD pass governed pipeline.
 */

import type { BusinessTruth } from '../../../types/business-truth';
import type { Evidence } from '../../../types/provenance';
import { EvidenceSynthesizer } from '../../../research/synthesizer';
import { InferenceEngine } from '../../../research/inference-engine';
import type { ResearchIntent } from '../../../research/types';
import { createHighQualityBellaEvidence } from './high-quality-evidence';

/**
 * Create high-quality PROPOSED truths for M4 happy path tests.
 * 
 * Uses actual M2 machinery (synthesizer + inference) with high-quality evidence.
 */
export function createHighQualityProposedTruths(
  intent: ResearchIntent
): BusinessTruth[] {
  // Get high-quality evidence
  const evidence = createHighQualityBellaEvidence(intent.industry);
  
  // Use actual M2 synthesizer
  const synthesizer = new EvidenceSynthesizer();
  const synthesis = synthesizer.synthesize(evidence);
  
  // Use actual M2 inference engine
  const inferenceEngine = new InferenceEngine();
  const truths = inferenceEngine.infer(intent, evidence, synthesis);
  
  // These are legitimate PROPOSED truths with strong evidence
  // Should pass M3 critique legitimately
  return truths;
}
