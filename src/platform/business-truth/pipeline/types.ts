/**
 * @fileoverview M4 Intelligence Pipeline Types
 * 
 * Types for end-to-end governed intelligence lifecycle orchestration.
 * 
 * CRITICAL: Pipeline connects M2 → M3 → M1, does NOT replace them.
 * 
 * @module platform/business-truth/pipeline/types
 */

import type { BusinessTruth } from '../types/business-truth';
import type { ResearchIntent, ResearchResult } from '../research/types';
import type { CritiqueResult } from '../critique/types';
import type { AuthorizationDecision } from '../gate/authorization';

/**
 * Pipeline execution result.
 */
export interface PipelineResult {
  truths: BusinessTruth[];  // Final truths (status depends on authorization)
  lifecycle: PipelineLifecycleTrace;
  research: ResearchResult;
  critiques: Map<string, CritiqueResult>;
  authorization: AuthorizationDecision | null;
  metadata: {
    startedAt: Date;
    completedAt: Date;
    intent: ResearchIntent;
    finalStatus: 'CANONICAL' | 'CRITIQUED' | 'FAILED';
  };
}

/**
 * Pipeline lifecycle trace.
 * 
 * Records complete governance path for audit.
 */
export interface PipelineLifecycleTrace {
  phases: Array<{
    phase: 'RESEARCH' | 'CRITIQUE' | 'AUTHORIZATION' | 'CANONICALIZATION';
    status: 'COMPLETED' | 'FAILED' | 'BLOCKED';
    timestamp: Date;
    details?: string;
  }>;
  transitions: Array<{
    from: string;  // Status name
    to: string;    // Status name
    timestamp: Date;
    mechanism: string;  // What caused transition
  }>;
}

/**
 * Pipeline configuration.
 */
export interface PipelineConfig {
  /**
   * Whether to auto-apply authorization for AUTO_APPROVED cases.
   * If false, all truths remain CRITIQUED even if auto-approved.
   */
  autoApplyAuthorization: boolean;
  
  /**
   * Whether to stop on critique block or continue with flag.
   * If true, BLOCKED critique stops pipeline.
   */
  strictCritique: boolean;
}

/**
 * Default pipeline configuration.
 */
export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  autoApplyAuthorization: true,
  strictCritique: true
};

/**
 * Pipeline error.
 */
export class PipelineError extends Error {
  constructor(
    message: string,
    public phase: 'RESEARCH' | 'CRITIQUE' | 'AUTHORIZATION' | 'CANONICALIZATION',
    public cause?: Error
  ) {
    super(message);
    this.name = 'PipelineError';
  }
}
