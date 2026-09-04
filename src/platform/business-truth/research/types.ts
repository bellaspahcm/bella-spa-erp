/**
 * @fileoverview M2 Research Engine Types
 * 
 * Types for research orchestration, evidence collection, and inference.
 * 
 * @module platform/business-truth/research/types
 */

import type { BusinessTruth, Evidence } from '../types/business-truth';
import type { Alternative, Conflict } from '../types/provenance';

/**
 * Research intent - what industry/domain to research.
 */
export interface ResearchIntent {
  industry: string;
  focus?: string[];  // Optional specific areas (e.g., ["entities", "processes"])
  constraints?: string[];  // Optional constraints (e.g., ["single-location"])
}

/**
 * Evidence collection result.
 */
export interface EvidenceCollection {
  evidence: Evidence[];
  collectedAt: Date;
  collectorType: 'WEB' | 'BELLA' | 'DOCUMENT';
}

/**
 * Synthesized evidence result.
 */
export interface SynthesisResult {
  patterns: string[];  // Common patterns found
  conflicts: Conflict[];  // Conflicting evidence
  alternatives: Alternative[];  // Alternative approaches
  confidenceScore: number;  // Overall confidence (0-1)
  assumptions: string[];  // Assumptions made
}

/**
 * Research result - complete output from M2.
 */
export interface ResearchResult {
  truths: BusinessTruth[];  // All PROPOSED
  evidence: Evidence[];
  synthesis: SynthesisResult;
  researchMetadata: {
    intent: ResearchIntent;
    startedAt: Date;
    completedAt: Date;
    sourcesConsulted: number;
    synthesisApproach: string;
  };
}

/**
 * Research error.
 */
export class ResearchError extends Error {
  constructor(
    message: string,
    public phase: 'COLLECTION' | 'SYNTHESIS' | 'INFERENCE',
    public cause?: Error
  ) {
    super(message);
    this.name = 'ResearchError';
  }
}
