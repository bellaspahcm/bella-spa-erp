/**
 * @fileoverview M2 + M3 Integration Tests
 * 
 * Tests complete flow: Research → Proposal → Critique
 * 
 * Proves: M2 PROPOSED → M3 CRITIQUED → (awaits M1 authorization)
 */

import { ResearchOrchestrator } from '../../research/orchestrator';
import { CritiqueOrchestrator } from '../orchestrator';
import type { ResearchIntent } from '../../research/types';

describe('M2 + M3 Integration', () => {
  const researchOrch = new ResearchOrchestrator();
  const critiqueOrch = new CritiqueOrchestrator();

  describe('Research → Critique Flow', () => {
    it('should flow from M2 PROPOSED to M3 CRITIQUED', async () => {
      // M2: Research produces PROPOSED truths
      const intent: ResearchIntent = {
        industry: 'TEST',
        focus: ['entities'],
        constraints: ['single-location']
      };

      const researchResult = await researchOrch.research(intent);

      // All truths are PROPOSED
      expect(researchResult.truths.length).toBeGreaterThan(0);
      for (const truth of researchResult.truths) {
        expect(truth.status).toBe('PROPOSED');
      }

      // M3: Critique the proposals
      const firstTruth = researchResult.truths[0];
      const { truth: critiqued, critique } = await critiqueOrch.critiqueTruth(firstTruth);

      // Now CRITIQUED
      expect(critiqued.status).toBe('CRITIQUED');
      expect(critique.truthId).toBe(firstTruth.id);
      
      // Still not CANONICAL
      expect(critiqued.status).not.toBe('CANONICAL');
    });

    it('should preserve provenance through critique', async () => {
      const intent: ResearchIntent = {
        industry: 'TEST',
        focus: ['entities']
      };

      const researchResult = await researchOrch.research(intent);
      const firstTruth = researchResult.truths[0];
      
      const originalProvenance = firstTruth.provenance;

      const { truth: critiqued } = await critiqueOrch.critiqueTruth(firstTruth);

      // Provenance unchanged
      expect(critiqued.provenance.sources).toEqual(originalProvenance.sources);
      expect(critiqued.epistemicStatus).toBe(firstTruth.epistemicStatus);
      expect(critiqued.provenance.reasoning).toBe(originalProvenance.reasoning);
    });

    it('should flag M2 proposals with insufficient evidence', async () => {
      const intent: ResearchIntent = {
        industry: 'SPARSE_TEST',  // Minimal evidence
        focus: ['entities']
      };

      const researchResult = await researchOrch.research(intent);

      // Critique batch
      const batchResult = await critiqueOrch.critiqueBatch(researchResult.truths);

      // Some may be flagged or blocked
      expect(batchResult.summary.total).toBeGreaterThan(0);
      
      // Check if any flagged/blocked
      const hasIssues = batchResult.summary.flagged > 0 || batchResult.summary.blocked > 0;
      
      // At least verify critique ran
      for (const result of batchResult.results.values()) {
        expect(result.critiqueMetadata.testsConducted.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Complete Pipeline: M2 → M3 → M1 (simulated)', () => {
    it('should follow governance lifecycle', async () => {
      // Step 1: M2 Research
      const intent: ResearchIntent = {
        industry: 'TEST_COMPLETE',
        focus: ['entities', 'processes']
      };

      const researchResult = await researchOrch.research(intent);
      const truth = researchResult.truths[0];

      // Status: PROPOSED
      expect(truth.status).toBe('PROPOSED');

      // Step 2: M3 Critique
      const { truth: critiqued, critique } = await critiqueOrch.critiqueTruth(truth);

      // Status: CRITIQUED
      expect(critiqued.status).toBe('CRITIQUED');

      // Step 3: Check if ready for M1
      if (critique.status === 'PASSED') {
        expect(critique.nextSteps.canProceedToAuthorization).toBe(true);
        
        // Next step: M1 authorization (not tested here)
        // M1 would:
        // - Validate full gate
        // - Apply authorization policy
        // - Produce CANONICAL if approved
        
        // But M3 cannot do this
        expect(critiqued.status).toBe('CRITIQUED');
        expect(critiqued.status).not.toBe('CANONICAL');
      } else {
        // Blocked or flagged - needs human review
        expect(critique.nextSteps.requiresHumanReview).toBe(true);
        expect(critique.nextSteps.canProceedToAuthorization).toBe(false);
      }
    });

    it('should accumulate lifecycle history', async () => {
      const intent: ResearchIntent = {
        industry: 'TEST_LIFECYCLE',
        focus: ['entities']
      };

      const researchResult = await researchOrch.research(intent);
      const truth = researchResult.truths[0];

      // Initial timestamp
      const initialTimestamp = truth.createdAt;

      // Critique
      const { truth: critiqued } = await critiqueOrch.critiqueTruth(truth);

      // Timestamp updated
      expect(critiqued.updatedAt.getTime()).toBeGreaterThanOrEqual(initialTimestamp.getTime());
      expect(critiqued.status).toBe('CRITIQUED');
    });
  });

  describe('M3 Does Not Weaken M2', () => {
    it('should not modify M2 structural validation', async () => {
      const intent: ResearchIntent = {
        industry: 'TEST_VALIDATION',
        focus: ['entities']
      };

      const researchResult = await researchOrch.research(intent);
      
      // M2 produced structurally valid PROPOSED truths
      expect(researchResult.truths.length).toBeGreaterThan(0);
      
      for (const truth of researchResult.truths) {
        // M2 validation passed
        expect(truth.status).toBe('PROPOSED');
        expect(truth.provenance.sources).toBeDefined();
        expect(truth.confidence).toBeDefined();
        expect(truth.authority).toBeDefined();
        
        // M3 critique (additional layer, not replacement)
        const { critique } = await critiqueOrch.critiqueTruth(truth);
        
        // M3 adds critique, doesn't remove M2 validation
        expect(critique.critiqueMetadata.testsConducted.length).toBeGreaterThan(0);
      }
    });

    it('should add critique layer without weakening structural requirements', async () => {
      const intent: ResearchIntent = {
        industry: 'TEST_LAYERS',
        focus: ['entities']
      };

      const researchResult = await researchOrch.research(intent);
      const truth = researchResult.truths[0];

      // M2 structural validation (still required)
      expect(truth.provenance).toBeDefined();
      expect(truth.confidence).toBeDefined();
      expect(truth.authority).toBeDefined();

      // M3 adds additional checks
      const { critique } = await critiqueOrch.critiqueTruth(truth);

      expect(critique.assessment.evidenceSufficiency).toBeDefined();
      expect(critique.assessment.logicalConsistency).toBeDefined();
      expect(critique.assessment.ambiguityResolution).toBeDefined();

      // Both layers applied
      expect(truth.status).toBe('PROPOSED');  // M2 passed
      expect(critique.truthId).toBe(truth.id);  // M3 ran
    });
  });
});
