/**
 * @fileoverview M3 Governance Invariant Tests
 * 
 * CRITICAL TESTS: Prove critique ≠ authorization.
 * 
 * These tests enforce the core M3 invariants:
 * 1. Critique cannot self-authorize
 * 2. CRITIQUED ≠ CANONICAL
 * 3. High assessment ≠ Auto-approval
 * 4. Must go through M1 authorization boundary
 */

import { CritiqueOrchestrator } from '../orchestrator';
import { CritiqueEngine } from '../critique-engine';
import type { BusinessTruth } from '../../types/business-truth';

describe('M3 Governance Invariants', () => {
  const orchestrator = new CritiqueOrchestrator();
  const engine = new CritiqueEngine();

  describe('CRITICAL: Critique ≠ Authorization', () => {
    it('should NEVER produce CANONICAL status (even with perfect assessment)', async () => {
      // Perfect proposal: good evidence, no issues
      const perfectProposal = createTruth({
        provenance: {
          sources: [
            { type: 'DOCUMENT', location: 'source1.md', retrievedAt: new Date() },
            { type: 'DOCUMENT', location: 'source2.md', retrievedAt: new Date() },
            { type: 'DOCUMENT', location: 'source3.md', retrievedAt: new Date() }
          ],
          epistemicStatus: 'OBSERVATION',
          reasoning: 'Direct observation from multiple sources'
        },
        confidence: { score: 0.95, factors: [] }
      });

      const result = await engine.critique(perfectProposal);

      // Even with perfect assessment
      expect(result.status).toBe('PASSED');
      expect(result.assessment.overallReadiness).toBeGreaterThan(0.8);
      
      // CRITICAL: Still cannot become CANONICAL
      expect(perfectProposal.status).toBe('PROPOSED');
      expect(perfectProposal.status).not.toBe('CANONICAL');
      expect(perfectProposal.status).not.toBe('APPROVED');
    });

    it('should output CRITIQUED, never CANONICAL', async () => {
      const proposal = createTruth();

      const { truth: critiqued } = await orchestrator.critiqueTruth(proposal);

      // Output is CRITIQUED
      expect(critiqued.status).toBe('CRITIQUED');
      
      // NEVER CANONICAL or APPROVED
      expect(critiqued.status).not.toBe('CANONICAL');
      expect(critiqued.status).not.toBe('APPROVED');
    });

    it('should require authorization even with high confidence', async () => {
      const highConfidenceProposal = createTruth({
        provenance: {
          sources: [
            { type: 'DOCUMENT', location: 'source1.md', retrievedAt: new Date() },
            { type: 'DOCUMENT', location: 'source2.md', retrievedAt: new Date() }
          ],
          epistemicStatus: 'OBSERVATION',
          reasoning: 'Strong evidence'
        },
        confidence: { score: 0.99, factors: [] }  // Very high confidence
      });

      const result = await engine.critique(highConfidenceProposal);

      // High confidence + good assessment
      expect(result.status).toBe('PASSED');
      expect(result.assessment.overallReadiness).toBeGreaterThan(0.8);
      
      // Can proceed to authorization
      expect(result.nextSteps.canProceedToAuthorization).toBe(true);
      
      // But NOT auto-authorized
      expect(highConfidenceProposal.status).not.toBe('CANONICAL');
      expect(highConfidenceProposal.status).not.toBe('APPROVED');
      
      // Must still go through M1 authorization
      expect(result.nextSteps.requiresHumanReview).toBe(false);  // No issues
      // But authorization is separate step, not automatic
    });
  });

  describe('CRITICAL: Lifecycle Enforcement', () => {
    it('should enforce PROPOSED → CRITIQUED transition', async () => {
      const proposal = createTruth({ status: 'PROPOSED' });

      const { truth: critiqued } = await orchestrator.critiqueTruth(proposal);

      expect(proposal.status).toBe('PROPOSED');
      expect(critiqued.status).toBe('CRITIQUED');
    });

    it('should reject non-PROPOSED input', async () => {
      const canonical = createTruth({ status: 'CANONICAL' });

      await expect(
        orchestrator.critiqueTruth(canonical)
      ).rejects.toThrow('Critique requires PROPOSED status');
    });

    it('should prevent PROPOSED → CANONICAL shortcut', async () => {
      const proposal = createTruth({ status: 'PROPOSED' });

      // Critique should never produce CANONICAL
      const { truth: critiqued } = await orchestrator.critiqueTruth(proposal);

      expect(critiqued.status).not.toBe('CANONICAL');
      expect(critiqued.status).toBe('CRITIQUED');
    });

    it('should record lifecycle transition', async () => {
      const proposal = createTruth({ status: 'PROPOSED' });

      const { truth: critiqued } = await orchestrator.critiqueTruth(proposal);

      // Status changed to CRITIQUED
      expect(critiqued.status).toBe('CRITIQUED');
      // Timestamp updated
      expect(critiqued.updatedAt.getTime()).toBeGreaterThanOrEqual(proposal.createdAt.getTime());
    });
  });

  describe('CRITICAL: Assessment ≠ Approval', () => {
    it('should not equate high assessment with approval', async () => {
      const proposal = createTruth({
        provenance: {
          sources: [
            { type: 'DOCUMENT', location: 'source1.md', retrievedAt: new Date() },
            { type: 'DOCUMENT', location: 'source2.md', retrievedAt: new Date() }
          ],
          epistemicStatus: 'OBSERVATION',
          reasoning: 'Well-supported'
        },
        confidence: { score: 0.9, factors: [] }
      });

      const result = await engine.critique(proposal);

      // High assessment
      expect(result.assessment.overallReadiness).toBeGreaterThan(0.7);
      expect(result.status).toBe('PASSED');
      
      // But NOT approved
      expect(proposal.status).toBe('PROPOSED');
      
      // Next step is authorization, not canonicalization
      expect(result.nextSteps.canProceedToAuthorization).toBe(true);
      expect(result.nextSteps.requiresHumanReview).toBe(false);
    });

    it('should distinguish "can proceed" from "auto-approved"', async () => {
      const proposal = createTruth({
        provenance: {
          sources: [
            { type: 'DOCUMENT', location: 'source1.md', retrievedAt: new Date() }
          ],
          epistemicStatus: 'OBSERVATION',
          reasoning: 'Observed'
        }
      });

      const result = await engine.critique(proposal);

      // Can proceed to authorization
      expect(result.nextSteps.canProceedToAuthorization).toBe(true);
      
      // But this means "ready for authorization", NOT "already authorized"
      expect(proposal.status).not.toBe('APPROVED');
      expect(proposal.status).not.toBe('CANONICAL');
      
      // Must still go through M1
      expect(proposal.status).toBe('PROPOSED');
    });
  });

  describe('CRITICAL: M1 Authorization Boundary', () => {
    it('should not bypass M1 gate even with perfect critique', async () => {
      const proposal = createTruth({
        provenance: {
          sources: [
            { type: 'DOCUMENT', location: 'source1.md', retrievedAt: new Date() },
            { type: 'DOCUMENT', location: 'source2.md', retrievedAt: new Date() },
            { type: 'DOCUMENT', location: 'source3.md', retrievedAt: new Date() }
          ],
          epistemicStatus: 'OBSERVATION',
          reasoning: 'Strong evidence'
        },
        confidence: { score: 0.95, factors: [] }
      });

      const result = await engine.critique(proposal);

      // Perfect critique
      expect(result.status).toBe('PASSED');
      expect(result.issues.length).toBe(0);
      expect(result.assessment.overallReadiness).toBeGreaterThan(0.9);
      
      // Still requires M1
      expect(proposal.status).toBe('PROPOSED');
      
      // M3 cannot authorize
      expect(result.nextSteps.canProceedToAuthorization).toBe(true);
      // This means "ready for M1", NOT "M1 bypassed"
    });

    it('should flag need for human review on blocking issues', async () => {
      const blockedProposal = createTruth({
        provenance: {
          sources: [],  // No evidence
          epistemicStatus: 'INFERENCE',
          reasoning: 'Unsupported'
        }
      });

      const result = await engine.critique(blockedProposal);

      expect(result.status).toBe('BLOCKED');
      expect(result.nextSteps.requiresHumanReview).toBe(true);
      expect(result.nextSteps.canProceedToAuthorization).toBe(false);
      
      // Still not authorized
      expect(blockedProposal.status).toBe('PROPOSED');
    });
  });

  describe('Valid Proposals Can Pass', () => {
    it('should not block valid well-supported proposals', async () => {
      const validProposal = createTruth({
        provenance: {
          sources: [
            { type: 'DOCUMENT', location: 'source1.md', retrievedAt: new Date() },
            { type: 'DOCUMENT', location: 'source2.md', retrievedAt: new Date() }
          ],
          epistemicStatus: 'OBSERVATION',
          reasoning: 'Direct observation from multiple sources'
        },
        confidence: { score: 0.85, factors: [] }
      });

      const result = await engine.critique(validProposal);

      // Should pass
      expect(result.status).toBe('PASSED');
      expect(result.issues.length).toBe(0);
      expect(result.nextSteps.canProceedToAuthorization).toBe(true);
      
      // Critique is not absolute blocker
      expect(result.assessment.overallReadiness).toBeGreaterThan(0.7);
    });

    it('should allow CRITIQUED → M1 authorization flow', async () => {
      const proposal = createTruth({ status: 'PROPOSED' });

      const { truth: critiqued, critique } = await orchestrator.critiqueTruth(proposal);

      // Now CRITIQUED
      expect(critiqued.status).toBe('CRITIQUED');
      
      // If passed, can proceed to authorization (M1)
      if (critique.status === 'PASSED') {
        expect(critique.nextSteps.canProceedToAuthorization).toBe(true);
        
        // Next step is M1 authorization, not M3
        // M1 will validate and potentially approve
        expect(critiqued.status).toBe('CRITIQUED');  // Still waiting for M1
      }
    });
  });

  describe('Batch Critique', () => {
    it('should critique multiple truths without authorization', async () => {
      const proposals = [
        createTruth({ id: 'truth-1' }),
        createTruth({ id: 'truth-2' }),
        createTruth({ id: 'truth-3' })
      ];

      const batchResult = await orchestrator.critiqueBatch(proposals);

      expect(batchResult.summary.total).toBe(3);
      expect(batchResult.results.size).toBe(3);
      
      // None should be CANONICAL
      for (const proposal of proposals) {
        expect(proposal.status).toBe('PROPOSED');
      }
      
      // All results should have critique
      for (const result of batchResult.results.values()) {
        expect(result.truthId).toBeDefined();
        expect(['PASSED', 'FLAGGED', 'BLOCKED']).toContain(result.status);
      }
    });
  });
});

// Helper: Create test truth
function createTruth(overrides: Partial<BusinessTruth> = {}): BusinessTruth {
  return {
    id: overrides.id || `test-truth-${Date.now()}`,
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
      sources: [
        { type: 'DOCUMENT', location: 'source.md', retrievedAt: new Date() }
      ],
      epistemicStatus: 'OBSERVATION',
      reasoning: 'Test reasoning',
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
