/**
 * @fileoverview M3 Critique Orchestrator
 * 
 * Orchestrates self-critique process:
 * PROPOSED → CRITIQUE → CRITIQUED
 * 
 * CRITICAL: Does NOT authorize. Output is CRITIQUED, not CANONICAL.
 * 
 * @module platform/business-truth/critique/orchestrator
 */

import type { BusinessTruth } from '../types/business-truth';
import type { TruthStatus } from '../types/lifecycle';
import { VALID_TRANSITIONS, FORBIDDEN_SHORTCUTS } from '../types/lifecycle';
import { CritiqueEngine } from './critique-engine';
import type { 
  CritiqueResult, 
  BatchCritiqueResult, 
  CritiqueConfig 
} from './types';
import { CritiqueError } from './types';

/**
 * Critique Orchestrator.
 * 
 * Takes PROPOSED Business Truths and produces CRITIQUED results.
 * 
 * DOES NOT:
 * - Change status to CANONICAL
 * - Bypass authorization
 * - Self-approve
 */
export class CritiqueOrchestrator {
  private engine: CritiqueEngine;

  constructor(config?: CritiqueConfig) {
    this.engine = new CritiqueEngine(config);
  }

  /**
   * Critique a single PROPOSED truth.
   * 
   * Input: PROPOSED Business Truth
   * Output: CRITIQUED Business Truth (with critique result)
   * 
   * NEVER outputs CANONICAL or APPROVED.
   */
  async critiqueTruth(truth: BusinessTruth): Promise<{
    truth: BusinessTruth;
    critique: CritiqueResult;
  }> {
    // Validate input status
    this.validateInputStatus(truth);

    // Run critique
    const critique = await this.engine.critique(truth);

    // Update truth status to CRITIQUED
    // IMPORTANT: This is NOT approval, just marking as critiqued
    const critiquedTruth: BusinessTruth = {
      ...truth,
      status: 'CRITIQUED',
      updatedAt: new Date()
    };

    return { truth: critiquedTruth, critique };
  }

  /**
   * Critique multiple PROPOSED truths.
   * 
   * Batch processing for multiple truths from M2.
   */
  async critiqueBatch(truths: BusinessTruth[]): Promise<BatchCritiqueResult> {
    const batchId = `critique-${Date.now()}`;
    const startTime = Date.now();
    const results = new Map<string, CritiqueResult>();

    let passed = 0;
    let flagged = 0;
    let blocked = 0;

    for (const truth of truths) {
      try {
        const { critique } = await this.critiqueTruth(truth);
        results.set(truth.id, critique);

        // Count by status
        if (critique.status === 'PASSED') passed++;
        else if (critique.status === 'FLAGGED') flagged++;
        else if (critique.status === 'BLOCKED') blocked++;

      } catch (error) {
        // Record error as blocked
        results.set(truth.id, {
          truthId: truth.id,
          status: 'BLOCKED',
          issues: [{
            type: 'EVIDENCE_INSUFFICIENT',
            severity: 'BLOCKING',
            description: `Critique failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            affectedClaim: truth.id
          }],
          assessment: {
            evidenceSufficiency: 0,
            logicalConsistency: 0,
            ambiguityResolution: 0,
            overallReadiness: 0
          },
          nextSteps: {
            requiresHumanReview: true,
            requiresMoreEvidence: true,
            requiresAmbiguityResolution: false,
            canProceedToAuthorization: false
          },
          critiqueMetadata: {
            critiquedAt: new Date(),
            critiqueVersion: '1.0.0',
            testsConducted: []
          }
        });
        blocked++;
      }
    }

    const endTime = Date.now();

    return {
      results,
      summary: {
        total: truths.length,
        passed,
        flagged,
        blocked
      },
      critiqueMetadata: {
        batchId,
        critiquedAt: new Date(),
        critiqueDuration: endTime - startTime
      }
    };
  }

  /**
   * Validate input status.
   * 
   * Critique only accepts PROPOSED truths.
   */
  private validateInputStatus(truth: BusinessTruth): void {
    // Must be PROPOSED
    if (truth.status !== 'PROPOSED') {
      throw new CritiqueError(
        `Critique requires PROPOSED status, got ${truth.status}`,
        'EVIDENCE_CHECK'
      );
    }

    // Prevent forbidden shortcuts
    this.checkForbiddenShortcuts(truth.status, 'CRITIQUED');
  }

  /**
   * Check for forbidden shortcuts.
   * 
   * Prevents governance violations (e.g., PROPOSED → CANONICAL).
   */
  private checkForbiddenShortcuts(from: TruthStatus, to: TruthStatus): void {
    const shortcut = FORBIDDEN_SHORTCUTS.find(
      ([f, t]) => f === from && t === to
    );

    if (shortcut) {
      throw new CritiqueError(
        `Forbidden shortcut: ${from} → ${to} violates governance`,
        'SYNTHESIS'
      );
    }

    // Validate transition
    const validTransitions = VALID_TRANSITIONS[from];
    if (!validTransitions.includes(to)) {
      throw new CritiqueError(
        `Invalid transition: ${from} → ${to}`,
        'SYNTHESIS'
      );
    }
  }
}
