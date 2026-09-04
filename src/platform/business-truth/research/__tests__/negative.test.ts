/**
 * @fileoverview M2 Negative Tests
 * 
 * Tests that M2 cannot violate governance boundaries.
 * 
 * @module platform/business-truth/research/__tests__/negative
 */

import { ResearchOrchestrator } from '../orchestrator';
import { BusinessTruthGate } from '../../gate/business-truth-gate';
import type { BusinessTruthDocument, BusinessTruth } from '../../types/business-truth';

describe('M2 Negative Tests - Governance Boundary Enforcement', () => {
  let gate: BusinessTruthGate;
  
  beforeEach(() => {
    gate = new BusinessTruthGate();
  });
  
  describe('M2 Cannot Self-Authorize', () => {
    it('rejects INFERENCE + CANONICAL without approval', () => {
      const malformedTruth: BusinessTruth = {
        id: 'malformed-1',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        contentType: 'ENTITY',
        content: {
          name: 'MenuItem',
          description: 'Menu item',
          attributes: []
        },
        epistemicStatus: 'INFERENCE',  // AI inferred
        status: 'CANONICAL',  // FORBIDDEN: M2 attempting self-canonicalization
        authority: {
          source: 'AI',
          type: 'INFERRED',
          approvedBy: null,
          approvedAt: null
        },
        provenance: {
          sources: [],
          reasoning: 'Test',
          alternatives: [],
          conflicts: []
        },
        confidence: {
          score: 0.9,
          basis: 'Test',
          assumptions: []
        }
      };
      
      const btd: BusinessTruthDocument = {
        metadata: {
          industryOS: 'Test',
          version: '1.0',
          createdAt: new Date(),
          lastModified: new Date(),
          approvedBy: '',
          approvalDate: new Date()
        },
        truths: [malformedTruth]
      };
      
      // M1 gate must BLOCK
      const gateResult = gate.validate(btd);
      expect(gateResult.validated).toBe(false);
      expect(gateResult.violations.some(v =>
        v.severity === 'BLOCKING' &&
        v.message.includes('INFERENCE') &&
        v.message.includes('CANONICAL')
      )).toBe(true);
    });
    
    it('rejects PROPOSED → APPROVED self-authorization', () => {
      const selfApproved: BusinessTruth = {
        id: 'malformed-2',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        contentType: 'ENTITY',
        content: {
          name: 'Order',
          description: 'Order entity',
          attributes: []
        },
        epistemicStatus: 'INFERENCE',
        status: 'APPROVED',  // FORBIDDEN: M2 self-approving
        authority: {
          source: 'AI',
          type: 'APPROVED',  // AI approved itself
          approvedBy: 'AI',  // FORBIDDEN
          approvedAt: new Date()
        },
        provenance: {
          sources: [],
          reasoning: 'Test',
          alternatives: [],
          conflicts: []
        },
        confidence: {
          score: 0.95,
          basis: 'Test',
          assumptions: []
        }
      };
      
      const btd: BusinessTruthDocument = {
        metadata: {
          industryOS: 'Test',
          version: '1.0',
          createdAt: new Date(),
          lastModified: new Date(),
          approvedBy: 'AI',  // Attempting self-approval
          approvalDate: new Date()
        },
        truths: [selfApproved]
      };
      
      // M1 gate must BLOCK
      const gateResult = gate.validate(btd);
      expect(gateResult.validated).toBe(false);
    });
  });
  
  describe('M2 Cannot Bypass M1', () => {
    it('proposals without provenance rejected by M1', () => {
      const noProvenance: BusinessTruth = {
        id: 'malformed-3',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        contentType: 'ENTITY',
        content: {
          name: 'Payment',
          description: 'Payment entity',
          attributes: []
        },
        epistemicStatus: 'INFERENCE',
        status: 'PROPOSED',
        authority: {
          source: 'AI',
          type: 'PROPOSED',
          approvedBy: null,
          approvedAt: null
        },
        provenance: {
          sources: [],  // MISSING: No evidence sources
          reasoning: '',  // MISSING: No reasoning
          alternatives: [],
          conflicts: []
        },
        confidence: {
          score: 0.8,
          basis: 'None',
          assumptions: []
        }
      };
      
      const btd: BusinessTruthDocument = {
        metadata: {
          industryOS: 'Test',
          version: '1.0',
          createdAt: new Date(),
          lastModified: new Date(),
          approvedBy: '',
          approvalDate: new Date()
        },
        truths: [noProvenance]
      };
      
      // M1 gate must BLOCK (Invariant 4: Provenance)
      const gateResult = gate.validate(btd);
      expect(gateResult.validated).toBe(false);
      expect(gateResult.violations.some(v =>
        v.invariant === 'Invariant 4: Provenance Completeness'
      )).toBe(true);
    });
    
    it('proposals without confidence rejected', () => {
      const noConfidence: BusinessTruth = {
        id: 'malformed-4',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        contentType: 'PROCESS',
        content: {
          name: 'Workflow',
          description: 'Test workflow',
          steps: [],
          rules: []
        },
        epistemicStatus: 'INFERENCE',
        status: 'PROPOSED',
        authority: {
          source: 'AI',
          type: 'PROPOSED',
          approvedBy: null,
          approvedAt: null
        },
        provenance: {
          sources: [{
            id: 'test-1',
            type: 'WEB',
            source: 'test.com',
            strength: 'MODERATE',
            timestamp: new Date()
          }],
          reasoning: 'Test reasoning',
          alternatives: [],
          conflicts: []
        },
        confidence: {
          score: 1.5,  // INVALID: > 1.0
          basis: 'Invalid',
          assumptions: []
        }
      };
      
      const btd: BusinessTruthDocument = {
        metadata: {
          industryOS: 'Test',
          version: '1.0',
          createdAt: new Date(),
          lastModified: new Date(),
          approvedBy: '',
          approvalDate: new Date()
        },
        truths: [noConfidence]
      };
      
      // M1 gate must BLOCK (invalid confidence score)
      const gateResult = gate.validate(btd);
      expect(gateResult.validated).toBe(false);
    });
  });
  
  describe('Confidence Cannot Authorize', () => {
    it('high confidence does not bypass authorization', () => {
      const highConfidence: BusinessTruth = {
        id: 'malformed-5',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        contentType: 'ENTITY',
        content: {
          name: 'Customer',
          description: 'Customer entity',
          attributes: []
        },
        epistemicStatus: 'BELIEF',  // Multiple valid options
        status: 'CANONICAL',  // Attempting canonicalization
        authority: {
          source: 'AI',
          type: 'APPROVED',
          approvedBy: 'AI',  // Confidence-based self-approval
          approvedAt: new Date()
        },
        provenance: {
          sources: [{
            id: 'test-2',
            type: 'WEB',
            source: 'test.com',
            strength: 'STRONG',
            timestamp: new Date()
          }],
          reasoning: 'High confidence',
          alternatives: [
            {
              option: 'Option A',
              description: 'First approach',
              pros: ['Simple'],
              cons: ['Limited'],
              evidence: [],
              tradeoffs: 'Test'
            },
            {
              option: 'Option B',
              description: 'Second approach',
              pros: ['Complete'],
              cons: ['Complex'],
              evidence: [],
              tradeoffs: 'Test'
            }
          ],  // Alternatives exist → requires HUMAN
          conflicts: []
        },
        confidence: {
          score: 0.99,  // Very high confidence
          basis: 'Strong evidence',
          assumptions: []
        }
      };
      
      const btd: BusinessTruthDocument = {
        metadata: {
          industryOS: 'Test',
          version: '1.0',
          createdAt: new Date(),
          lastModified: new Date(),
          approvedBy: 'AI',
          approvalDate: new Date()
        },
        truths: [highConfidence]
      };
      
      // M1 gate must BLOCK (alternatives require HUMAN)
      const gateResult = gate.validate(btd);
      expect(gateResult.validated).toBe(false);
      expect(gateResult.violations.some(v =>
        v.message.includes('alternatives')
      )).toBe(true);
    });
  });
});
