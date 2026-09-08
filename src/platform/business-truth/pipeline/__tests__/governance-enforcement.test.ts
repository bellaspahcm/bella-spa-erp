/**
 * @fileoverview M4 Governance Enforcement Tests
 * 
 * Explicit tests that M4 enforces Q0/M1 governance rules.
 * These tests verify governance BLOCKS inappropriate canonicalization.
 */

import { IntelligencePipelineOrchestrator } from '../intelligence-pipeline';
import type { BusinessTruth } from '../../types/business-truth';
import type { ResearchIntent } from '../../research/types';

describe('M4 Governance Enforcement', () => {
  const pipeline = new IntelligencePipelineOrchestrator({ strictCritique: false });

  describe('Q0 Invariant 2: INFERENCE + CANONICAL + AI Forbidden', () => {
    it('should block INFERENCE truths from reaching CANONICAL with AI approval', async () => {
      // Given: High-quality INFERENCE truth (not KNOWLEDGE)
      const inferenceTruth: BusinessTruth = {
        id: 'inference-gov-test-1',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        contentType: 'ENTITY',
        content: {
          name: 'TestEntity',
          description: 'Inferred pattern',
          attributes: []
        },
        epistemicStatus: 'INFERENCE',  // Key: this is INFERENCE, not KNOWLEDGE
        status: 'PROPOSED',
        authority: {
          source: 'AI',
          type: 'PROPOSED',
          approvedBy: null,
          approvedAt: null
        },
        provenance: {
          sources: [
            {
              id: 'bella-1',
              type: 'BELLA_KERNEL',
              source: 'test-kernel',
              strength: 'STRONG',
              timestamp: new Date()
            },
            {
              id: 'bella-2',
              type: 'BELLA_PATTERN',
              source: 'test-pattern',
              strength: 'STRONG',
              timestamp: new Date()
            }
          ],
          reasoning: 'Inferred from Bella patterns',
          alternatives: [],  // No alternatives
          conflicts: []      // No conflicts
        },
        confidence: {
          score: 0.98,  // High confidence (meets auto-approval threshold)
          basis: 'Strong evidence',
          assumptions: []
        }
      };

      const intent: ResearchIntent = {
        industry: 'GOVERNANCE_TEST',
        focus: ['entities']
      };

      // When: Execute pipeline
      const result = await pipeline.executeWithProposedTruths([inferenceTruth], intent);

      // Then: Truth reaches APPROVED (authorization successful)
      expect(result.authorization?.authorized).toBe(true);
      expect(result.truths[0].status).toBe('APPROVED');
      expect(result.truths[0].authority.type).toBe('APPROVED');
      expect(result.truths[0].authority.approvedBy).toBe('AI');

      // But: CANNOT reach CANONICAL (blocked by M1 Invariant 2)
      expect(result.truths[0].status).not.toBe('CANONICAL');

      // And: Lifecycle shows CANONICALIZATION was BLOCKED
      const canonPhase = result.lifecycle.phases.find(p => p.phase === 'CANONICALIZATION');
      expect(canonPhase).toBeDefined();
      expect(canonPhase?.status).toBe('BLOCKED');

      // And: Final status is CRITIQUED (not CANONICAL, not FAILED)
      expect(result.metadata.finalStatus).toBe('CRITIQUED');

      // And: No CANONICAL transition recorded
      const hasCanonical = result.lifecycle.transitions.some(t => t.to === 'CANONICAL');
      expect(hasCanonical).toBe(false);
    });

    it('should allow KNOWLEDGE truths to reach CANONICAL with AI approval', async () => {
      // Given: KNOWLEDGE truth (not INFERENCE) with high quality
      const knowledgeTruth: BusinessTruth = {
        id: 'knowledge-gov-test-1',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        contentType: 'ENTITY',
        content: {
          name: 'TestEntity',
          description: 'Established knowledge',
          attributes: []
        },
        epistemicStatus: 'KNOWLEDGE',  // Key: this is KNOWLEDGE
        status: 'PROPOSED',
        authority: {
          source: 'SYSTEM',
          type: 'PROPOSED',
          approvedBy: null,
          approvedAt: null
        },
        provenance: {
          sources: [
            {
              id: 'bella-1',
              type: 'BELLA_KERNEL',
              source: 'test-kernel',
              strength: 'STRONG',
              timestamp: new Date()
            },
            {
              id: 'bella-2',
              type: 'BELLA_PATTERN',
              source: 'test-pattern',
              strength: 'STRONG',
              timestamp: new Date()
            }
          ],
          reasoning: 'Established organizational knowledge',
          alternatives: [],
          conflicts: []
        },
        confidence: {
          score: 0.98,
          basis: 'Strong evidence',
          assumptions: []
        }
      };

      const intent: ResearchIntent = {
        industry: 'GOVERNANCE_TEST',
        focus: ['entities']
      };

      // When: Execute pipeline
      const result = await pipeline.executeWithProposedTruths([knowledgeTruth], intent);

      // Then: Truth reaches APPROVED
      expect(result.authorization?.authorized).toBe(true);
      expect(result.truths[0].authority.type).toBe('APPROVED');

      // And: Successfully reaches CANONICAL (no governance block)
      expect(result.truths[0].status).toBe('CANONICAL');

      // And: Lifecycle shows CANONICALIZATION COMPLETED
      const canonPhase = result.lifecycle.phases.find(p => p.phase === 'CANONICALIZATION');
      expect(canonPhase).toBeDefined();
      expect(canonPhase?.status).toBe('COMPLETED');

      // And: Final status is CANONICAL
      expect(result.metadata.finalStatus).toBe('CANONICAL');

      // And: CANONICAL transition recorded
      const hasCanonical = result.lifecycle.transitions.some(t => t.to === 'CANONICAL');
      expect(hasCanonical).toBe(true);
    });
  });

  describe('Auto-Approval Conditions', () => {
    it('should block INFERENCE with insufficient confidence', async () => {
      const lowConfidenceTruth: BusinessTruth = {
        id: 'low-conf-test',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        contentType: 'ENTITY',
        content: { name: 'Test', description: 'Test', attributes: [] },
        epistemicStatus: 'INFERENCE',
        status: 'PROPOSED',
        authority: {
          source: 'AI',
          type: 'PROPOSED',
          approvedBy: null,
          approvedAt: null
        },
        provenance: {
          sources: [
            {
              id: 'weak-1',
              type: 'WEB',
              source: 'test',
              strength: 'WEAK',
              timestamp: new Date()
            }
          ],
          reasoning: 'Weak inference',
          alternatives: [],
          conflicts: []
        },
        confidence: {
          score: 0.7,  // Below 0.95 threshold
          basis: 'Weak evidence',
          assumptions: []
        }
      };

      const intent: ResearchIntent = {
        industry: 'TEST',
        focus: ['entities']
      };

      const result = await pipeline.executeWithProposedTruths([lowConfidenceTruth], intent);

      // Authorization should fail (confidence too low)
      expect(result.authorization?.authorized).toBe(false);

      // Truth remains CRITIQUED (not APPROVED)
      expect(result.truths[0].status).toBe('CRITIQUED');
    });
  });
});
