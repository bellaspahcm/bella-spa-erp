/**
 * @fileoverview M3 Critique Engine Tests
 * 
 * Tests for governed self-critique layer.
 * 
 * CRITICAL: Tests prove critique ≠ authorization.
 */

import { CritiqueEngine } from '../critique-engine';
import type { BusinessTruth } from '../../types/business-truth';
import type { CritiqueConfig } from '../types';

describe('M3 Critique Engine', () => {
  const engine = new CritiqueEngine();

  describe('Test 1: Evidence Sufficiency', () => {
    it('should BLOCK proposal with no evidence', async () => {
      const truth = createTruth({
        epistemicStatus: 'INFERENCE',
        provenance: {
          sources: [],  // No evidence
          reasoning: 'Some reasoning'
        }
      });

      const result = await engine.critique(truth);

      expect(result.status).toBe('BLOCKED');
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'EVIDENCE_INSUFFICIENT',
            severity: 'BLOCKING'
          })
        ])
      );
      expect(result.nextSteps.canProceedToAuthorization).toBe(false);
    });

    it('should PASS proposal with sufficient evidence', async () => {
      const truth = createTruth({
        epistemicStatus: 'OBSERVATION',
        provenance: {
          sources: [
            { type: 'DOCUMENT', location: 'source1.md', retrievedAt: new Date() }
          ],
          reasoning: 'Direct observation'
        }
      });

      const result = await engine.critique(truth);

      expect(result.status).toBe('PASSED');
      expect(result.nextSteps.canProceedToAuthorization).toBe(true);
      // CRITICAL: Can proceed to authorization ≠ auto-approved
      expect(truth.status).not.toBe('CANONICAL');
    });
  });

  describe('Test 2: Contradiction Detection', () => {
    it('should BLOCK proposal with unresolved contradictions', async () => {
      const truth = createTruth({
        epistemicStatus: 'OBSERVATION',
        provenance: {
          sources: [
            { type: 'DOCUMENT', location: 'source1.md', retrievedAt: new Date() }
          ],
          conflicts: [
            {
              description: 'Source A says X, Source B says Y',
              sources: ['A', 'B']
              // No resolution
            }
          ]
        }
      });

      const result = await engine.critique(truth);

      expect(result.status).toBe('BLOCKED');
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'EVIDENCE_CONTRADICTORY',
            severity: 'BLOCKING'
          })
        ])
      );
    });

    it('should ADVISE on resolved contradictions', async () => {
      const truth = createTruth({
        epistemicStatus: 'OBSERVATION',
        provenance: {
          sources: [
            { type: 'DOCUMENT', location: 'source1.md', retrievedAt: new Date() }
          ],
          conflicts: [
            {
              description: 'Conflict resolved',
              sources: ['A', 'B'],
              resolution: 'Chose A based on more recent data'
            }
          ]
        }
      });

      const result = await engine.critique(truth);

      expect(result.status).toBe('PASSED');  // Advisory doesn't block
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'EVIDENCE_CONTRADICTORY',
            severity: 'ADVISORY'
          })
        ])
      );
    });
  });

  describe('Test 3: Unsupported Inference', () => {
    it('should BLOCK inference without evidence', async () => {
      const truth = createTruth({
        epistemicStatus: 'INFERENCE',
        provenance: {
          sources: [],  // No evidence
          reasoning: 'I inferred this'
        }
      });

      const result = await engine.critique(truth);

      expect(result.status).toBe('BLOCKED');
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'INFERENCE_UNSUPPORTED',
            severity: 'BLOCKING'
          })
        ])
      );
    });

    it('should WARN on inference without reasoning', async () => {
      const truth = createTruth({
        epistemicStatus: 'INFERENCE',
        provenance: {
          sources: [
            { type: 'DOCUMENT', location: 'source1.md', retrievedAt: new Date() }
          ],
          reasoning: ''  // No reasoning
        }
      });

      const result = await engine.critique(truth);

      expect(result.status).toBe('FLAGGED');
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'INFERENCE_UNSUPPORTED',
            severity: 'WARNING'
          })
        ])
      );
    });

    it('should WARN on observation/inference confusion', async () => {
      const truth = createTruth({
        provenance: {
          sources: [
            { type: 'DOCUMENT', location: 'source1.md', retrievedAt: new Date() }
          ],
          epistemicStatus: 'OBSERVATION',
          reasoning: 'Observed'
        },
        confidence: { score: 0.5, factors: [] }  // Low confidence suggests inference
      });

      const result = await engine.critique(truth);

      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'OBSERVATION_INFERENCE_CONFUSION',
            severity: 'WARNING'
          })
        ])
      );
    });
  });

  describe('Test 4: Unresolved Ambiguity', () => {
    it('should BLOCK proposal with unresolved alternatives', async () => {
      const truth = createTruth({
        epistemicStatus: 'INFERENCE',
        provenance: {
          sources: [
            { type: 'DOCUMENT', location: 'source1.md', retrievedAt: new Date() }
          ],
          reasoning: 'Multiple approaches possible',
          alternatives: [
            { approach: 'Approach A', reasoning: 'Reason A' },
            { approach: 'Approach B', reasoning: 'Reason B' }
          ]
          // No chosen alternative
        }
      });

      const result = await engine.critique(truth);

      expect(result.status).toBe('BLOCKED');
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'AMBIGUITY_UNRESOLVED',
            severity: 'BLOCKING',
            description: expect.stringContaining('2 alternative')
          })
        ])
      );
      expect(result.nextSteps.requiresAmbiguityResolution).toBe(true);
    });

    it('should WARN on hidden assumptions', async () => {
      const truth = createTruth({
        epistemicStatus: 'INFERENCE',
        provenance: {
          sources: [
            { type: 'DOCUMENT', location: 'source1.md', retrievedAt: new Date() }
          ],
          reasoning: 'Assuming customers want X, we should do Y'
        }
      });

      const result = await engine.critique(truth);

      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'ASSUMPTION_HIDDEN',
            severity: 'WARNING'
          })
        ])
      );
    });
  });

  describe('Test 5: Confidence vs Evidence Quality', () => {
    it('should BLOCK high confidence without evidence', async () => {
      const truth = createTruth({
        epistemicStatus: 'INFERENCE',
        provenance: {
          sources: [],  // No evidence
          reasoning: 'Some reasoning'
        },
        confidence: { score: 0.9, factors: [] }  // High confidence
      });

      const result = await engine.critique(truth);

      expect(result.status).toBe('BLOCKED');
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'CONFIDENCE_EVIDENCE_MISMATCH',
            severity: 'BLOCKING',
            description: expect.stringContaining('too high for evidence quality')
          })
        ])
      );
    });

    it('should WARN on very low confidence', async () => {
      const truth = createTruth({
        epistemicStatus: 'INFERENCE',
        provenance: {
          sources: [
            { type: 'DOCUMENT', location: 'source1.md', retrievedAt: new Date() }
          ],
          reasoning: 'Uncertain'
        },
        confidence: { score: 0.2, factors: [] }  // Very low
      });

      const result = await engine.critique(truth);

      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'CONFIDENCE_EVIDENCE_MISMATCH',
            severity: 'WARNING',
            description: expect.stringContaining('below threshold')
          })
        ])
      );
    });
  });

  describe('Test 6: Provenance Completeness', () => {
    it('should BLOCK missing epistemic status', async () => {
      const truth = createTruth({
        epistemicStatus: undefined as any,  // Missing
        provenance: {
          sources: [
            { type: 'DOCUMENT', location: 'source1.md', retrievedAt: new Date() }
          ],
          reasoning: 'Some reasoning'
        }
      });

      const result = await engine.critique(truth);

      expect(result.status).toBe('BLOCKED');
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'PROVENANCE_INCOMPLETE',
            severity: 'BLOCKING'
          })
        ])
      );
    });
  });

  describe('Test 7: Downstream Impact', () => {
    it('should WARN on high-impact low-confidence claims', async () => {
      const truth = createTruth({
        type: 'ENTITY',  // High impact
        provenance: {
          sources: [
            { type: 'DOCUMENT', location: 'source1.md', retrievedAt: new Date() }
          ],
          epistemicStatus: 'INFERENCE',
          reasoning: 'Inferred entity'
        },
        confidence: { score: 0.6, factors: [] }  // Moderate confidence
      });

      const result = await engine.critique(truth);

      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'DOWNSTREAM_RISK_HIGH',
            severity: 'WARNING'
          })
        ])
      );
    });
  });

  describe('Critique Assessment Scoring', () => {
    it('should calculate assessment scores', async () => {
      const truth = createTruth({
        epistemicStatus: 'OBSERVATION',
        provenance: {
          sources: [
            { type: 'DOCUMENT', location: 'source1.md', retrievedAt: new Date() }
          ],
          reasoning: 'Direct observation'
        }
      });

      const result = await engine.critique(truth);

      expect(result.assessment).toMatchObject({
        evidenceSufficiency: expect.any(Number),
        logicalConsistency: expect.any(Number),
        ambiguityResolution: expect.any(Number),
        overallReadiness: expect.any(Number)
      });

      // All scores should be 0-1
      expect(result.assessment.evidenceSufficiency).toBeGreaterThanOrEqual(0);
      expect(result.assessment.evidenceSufficiency).toBeLessThanOrEqual(1);
      expect(result.assessment.overallReadiness).toBeGreaterThanOrEqual(0);
      expect(result.assessment.overallReadiness).toBeLessThanOrEqual(1);
    });

    it('should set low readiness for blocked proposals', async () => {
      const truth = createTruth({
        epistemicStatus: 'INFERENCE',
        provenance: {
          sources: [],  // No evidence - blocking
          reasoning: 'Unsupported'
        }
      });

      const result = await engine.critique(truth);

      expect(result.status).toBe('BLOCKED');
      expect(result.assessment.overallReadiness).toBeLessThanOrEqual(0.5);
    });
  });

  describe('Critique Configuration', () => {
    it('should respect custom configuration', async () => {
      const strictEngine = new CritiqueEngine({
        tests: {
          evidenceSufficiency: true,
          contradictionDetection: true,
          inferenceValidation: true,
          ambiguityDetection: true,
          confidenceValidation: true,
          provenanceValidation: true,
          downstreamImpactAnalysis: true
        },
        thresholds: {
          minEvidenceCount: 2,  // Require 2 sources
          minConfidenceForClaim: 0.5,
          maxConfidenceWithoutEvidence: 0.3
        },
        strictMode: true  // Warnings become blocking
      });

      const truth = createTruth({
        epistemicStatus: 'OBSERVATION',
        provenance: {
          sources: [
            { type: 'DOCUMENT', location: 'source1.md', retrievedAt: new Date() }
          ],  // Only 1 source
          reasoning: 'Observed'
        }
      });

      const result = await strictEngine.critique(truth);

      // In strict mode, warning about insufficient evidence should block
      expect(result.status).toBe('BLOCKED');
    });
  });
});

// Helper: Create test truth
function createTruth(overrides: Partial<BusinessTruth> = {}): BusinessTruth {
  return {
    id: 'test-truth-1',
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    contentType: 'ENTITY',
    type: 'ENTITY',
    status: 'PROPOSED',
    content: {
      name: 'TestEntity',
      description: 'Test entity',
      attributes: []
    },
    epistemicStatus: 'OBSERVATION',
    confidence: {
      score: 0.8,
      factors: []
    },
    provenance: {
      sources: [],
      reasoning: '',
      discoveredAt: new Date()
    },
    authority: {
      domain: 'TEST',
      scope: 'KERNEL',
      level: 'TECHNICAL'
    },
    ...overrides
  } as BusinessTruth;
}
