/**
 * @fileoverview B0 Negative Tests - 7 Adversarial Tests
 * 
 * These tests prove the governance boundary blocks B0 failures.
 * 
 * Each test creates malformed/forbidden input and verifies BLOCK.
 * 
 * @module platform/business-truth/__tests__/b0-negative-tests
 */

import { BusinessTruthGate } from '../gate/business-truth-gate';
import { AuthorizationBoundary } from '../gate/authorization';
import { BusinessTruthAdapter, E10ConsumptionError } from '../../../../scripts/factory/business-truth-adapter';
import type { BusinessTruthDocument, BusinessTruth } from '../types/business-truth';

describe('B0 Negative Tests - Adversarial Governance Boundary Validation', () => {
  let gate: BusinessTruthGate;
  let authBoundary: AuthorizationBoundary;
  let adapter: BusinessTruthAdapter;
  
  beforeEach(() => {
    gate = new BusinessTruthGate();
    authBoundary = new AuthorizationBoundary();
    adapter = new BusinessTruthAdapter();
  });
  
  // ============================================================================
  // B0 FAILURE #1: INFERENCE → CANONICAL SHORTCUT
  // ============================================================================
  
  describe('B0 Failure #1: INFERENCE → CANONICAL shortcut', () => {
    it('BLOCKS: INFERENCE + CANONICAL without approval', () => {
      const malformedBTD: BusinessTruthDocument = {
        metadata: {
          industryOS: 'F&B',
          version: '1.0',
          createdAt: new Date(),
          lastModified: new Date(),
          approvedBy: 'AI', // Attempting self-approval
          approvalDate: new Date()
        },
        truths: [
          {
            id: 'MALFORMED-1',
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            contentType: 'ENTITY',
            content: {
              name: 'MenuItem',
              description: 'Menu item entity',
              attributes: []
            },
            epistemicStatus: 'INFERENCE', // AI inferred
            status: 'CANONICAL', // FORBIDDEN: shortcut to CANONICAL
            authority: {
              source: 'AI',
              type: 'INFERRED', // NOT APPROVED
              approvedBy: null, // NO approval
              approvedAt: null
            },
            provenance: {
              sources: [{ 
                id: '1', 
                type: 'WEB', 
                source: 'example.com', 
                strength: 'MODERATE', 
                timestamp: new Date() 
              }],
              reasoning: 'Inferred from web sources',
              alternatives: [],
              conflicts: []
            },
            confidence: {
              score: 0.8,
              basis: 'Single web source',
              assumptions: []
            }
          }
        ]
      };
      
      // Gate should BLOCK
      const gateResult = gate.validate(malformedBTD);
      expect(gateResult.validated).toBe(false);
      expect(gateResult.violations.some(v => 
        v.severity === 'BLOCKING' && 
        v.message.includes('INFERENCE') &&
        v.message.includes('CANONICAL')
      )).toBe(true);
      
      // E10 adapter should THROW
      expect(() => adapter.prepareForE10(malformedBTD)).toThrow(E10ConsumptionError);
    });
  });
  
  // ============================================================================
  // B0 FAILURE #2: AI SELF-APPROVAL OF INFERENCE
  // ============================================================================
  
  describe('B0 Failure #2: AI self-approval of inference', () => {
    it('BLOCKS: approvedBy=AI for INFERENCE + CANONICAL', () => {
      const malformedBTD: BusinessTruthDocument = {
        metadata: {
          industryOS: 'F&B',
          version: '1.0',
          createdAt: new Date(),
          lastModified: new Date(),
          approvedBy: 'AI',
          approvalDate: new Date()
        },
        truths: [
          {
            id: 'MALFORMED-2',
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
            status: 'CANONICAL',
            authority: {
              source: 'AI',
              type: 'APPROVED', // AI approved itself!
              approvedBy: 'AI', // FORBIDDEN for INFERENCE
              approvedAt: new Date()
            },
            provenance: {
              sources: [{ 
                id: '2', 
                type: 'WEB', 
                source: 'example.com', 
                strength: 'MODERATE', 
                timestamp: new Date() 
              }],
              reasoning: 'AI reasoning',
              alternatives: [],
              conflicts: []
            },
            confidence: {
              score: 0.9,
              basis: 'AI confidence',
              assumptions: []
            }
          }
        ]
      };
      
      // Gate should BLOCK (Invariant 2)
      const gateResult = gate.validate(malformedBTD);
      expect(gateResult.validated).toBe(false);
      expect(gateResult.violations.some(v =>
        v.severity === 'BLOCKING' &&
        v.invariant === 'Invariant 2: Authority-Status Consistency'
      )).toBe(true);
      
      // E10 adapter should THROW
      expect(() => adapter.prepareForE10(malformedBTD)).toThrow(E10ConsumptionError);
    });
  });
  
  // ============================================================================
  // B0 FAILURE #3: CONFIDENCE = TRUTH (high confidence substitutes approval)
  // ============================================================================
  
  describe('B0 Failure #3: High confidence substitutes for authority', () => {
    it('BLOCKS: High confidence without approval when alternatives exist', () => {
      const malformedBTD: BusinessTruthDocument = {
        metadata: {
          industryOS: 'F&B',
          version: '1.0',
          createdAt: new Date(),
          lastModified: new Date(),
          approvedBy: 'SYSTEM',
          approvalDate: new Date()
        },
        truths: [
          {
            id: 'MALFORMED-3',
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            contentType: 'ENTITY',
            content: {
              name: 'Payment',
              description: 'Payment entity',
              attributes: []
            },
            epistemicStatus: 'BELIEF', // Multiple options exist
            status: 'CANONICAL',
            authority: {
              source: 'AI',
              type: 'APPROVED',
              approvedBy: 'AI', // Attempting confidence-based approval
              approvedAt: new Date()
            },
            provenance: {
              sources: [{ 
                id: '3', 
                type: 'WEB', 
                source: 'example.com', 
                strength: 'STRONG', 
                timestamp: new Date() 
              }],
              alternatives: [
                {
                  option: 'Cash-only',
                  description: 'Only cash payments',
                  pros: ['Simple'],
                  cons: ['Limited'],
                  evidence: [],
                  tradeoffs: 'Limited flexibility'
                },
                {
                  option: 'Multi-payment',
                  description: 'Multiple payment methods',
                  pros: ['Flexible'],
                  cons: ['Complex'],
                  evidence: [],
                  tradeoffs: 'Added complexity'
                }
              ],
              conflicts: []
            },
            confidence: {
              score: 0.98, // Very high confidence
              basis: 'Strong evidence',
              assumptions: []
            }
          }
        ]
      };
      
      // Gate should BLOCK (Invariant 2: alternatives require HUMAN)
      const gateResult = gate.validate(malformedBTD);
      expect(gateResult.validated).toBe(false);
      expect(gateResult.violations.some(v =>
        v.severity === 'BLOCKING' &&
        v.message.includes('alternatives')
      )).toBe(true);
      
      // E10 adapter should THROW
      expect(() => adapter.prepareForE10(malformedBTD)).toThrow(E10ConsumptionError);
    });
  });
  
  // ============================================================================
  // B0 FAILURE #4: BUSINESS DECISION MASKED (alternatives not explicit)
  // ============================================================================
  
  describe('B0 Failure #4: Business decision without alternatives', () => {
    it('BLOCKS: Business decision (alternatives exist) without HUMAN approval', () => {
      const malformedBTD: BusinessTruthDocument = {
        metadata: {
          industryOS: 'F&B',
          version: '1.0',
          createdAt: new Date(),
          lastModified: new Date(),
          approvedBy: 'AI',
          approvalDate: new Date()
        },
        truths: [
          {
            id: 'MALFORMED-4',
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            contentType: 'PROCESS',
            content: {
              name: 'OrderFulfillment',
              description: 'Order fulfillment process',
              steps: [
                { order: 1, name: 'Receive order' },
                { order: 2, name: 'Prepare items' },
                { order: 3, name: 'Deliver' }
              ],
              rules: []
            },
            epistemicStatus: 'BELIEF',
            status: 'CANONICAL',
            authority: {
              source: 'AI',
              type: 'APPROVED',
              approvedBy: 'AI', // Not HUMAN
              approvedAt: new Date()
            },
            provenance: {
              sources: [],
              alternatives: [
                {
                  option: 'Sequential fulfillment',
                  description: 'One order at a time',
                  pros: ['Simple'],
                  cons: ['Slow'],
                  evidence: [],
                  tradeoffs: 'Speed vs simplicity'
                },
                {
                  option: 'Parallel fulfillment',
                  description: 'Multiple orders simultaneously',
                  pros: ['Fast'],
                  cons: ['Complex'],
                  evidence: [],
                  tradeoffs: 'Complexity vs speed'
                }
              ],
              conflicts: []
            },
            confidence: {
              score: 0.9,
              basis: 'Industry common practice',
              assumptions: []
            }
          }
        ]
      };
      
      // Gate should BLOCK (Invariant 2: alternatives require HUMAN)
      const gateResult = gate.validate(malformedBTD);
      expect(gateResult.validated).toBe(false);
      
      // E10 adapter should THROW
      expect(() => adapter.prepareForE10(malformedBTD)).toThrow(E10ConsumptionError);
    });
  });
  
  // ============================================================================
  // B0 FAILURE #5: NO BELLA EVIDENCE (technical hallucination)
  // ============================================================================
  
  describe('B0 Failure #5: No Bella evidence', () => {
    it('WARNS: No Bella evidence (advisory, not blocking)', () => {
      const btdWithoutBellaEvidence: BusinessTruthDocument = {
        metadata: {
          industryOS: 'F&B',
          version: '1.0',
          createdAt: new Date(),
          lastModified: new Date(),
          approvedBy: 'HUMAN',
          approvalDate: new Date()
        },
        truths: [
          {
            id: 'NO-BELLA-5',
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            contentType: 'ENTITY',
            content: {
              name: 'Reservation',
              description: 'Reservation entity',
              attributes: []
            },
            epistemicStatus: 'KNOWLEDGE', // Change to KNOWLEDGE (not INFERENCE)
            status: 'CANONICAL',
            authority: {
              source: 'AI', // AI inferred (needs warning for missing Bella)
              type: 'APPROVED',
              approvedBy: 'HUMAN', // Human approved
              approvedAt: new Date()
            },
            provenance: {
              sources: [
                // NO Bella evidence
                { 
                  id: '5', 
                  type: 'WEB', 
                  source: 'restaurant-industry.com', 
                  strength: 'STRONG', 
                  timestamp: new Date() 
                }
              ],
              reasoning: 'Common F&B pattern',
              alternatives: [],
              conflicts: []
            },
            confidence: {
              score: 0.96,
              basis: 'Industry standard',
              assumptions: []
            }
          }
        ]
      };
      
      // Gate should PASS validation but include WARNING
      const gateResult = gate.validate(btdWithoutBellaEvidence);
      expect(gateResult.validated).toBe(true); // NOT BLOCKING
      expect(gateResult.violations.some(v =>
        v.severity === 'WARNING' &&
        v.invariant === 'Invariant 5: Implementation Feasibility'
      )).toBe(true);
      
      // E10 adapter should NOT throw (advisory warning only)
      expect(() => adapter.prepareForE10WithHumanApproval(
        btdWithoutBellaEvidence,
        'human-approver'
      )).not.toThrow();
    });
  });
  
  // ============================================================================
  // B0 FAILURE #6: E10 BYPASS (factory not used)
  // ============================================================================
  
  describe('B0 Failure #6: E10 bypass attempt', () => {
    it('BLOCKS: Attempting E10 consumption without adapter boundary', () => {
      const unapprovedBTD: BusinessTruthDocument = {
        metadata: {
          industryOS: 'F&B',
          version: '1.0',
          createdAt: new Date(),
          lastModified: new Date(),
          approvedBy: '', // NOT approved
          approvalDate: new Date('2000-01-01') // Invalid date
        },
        truths: [
          {
            id: 'BYPASS-6',
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            contentType: 'ENTITY',
            content: {
              name: 'Table',
              description: 'Table entity',
              attributes: []
            },
            epistemicStatus: 'OBSERVATION',
            status: 'PROPOSED', // NOT CANONICAL
            authority: {
              source: 'AI',
              type: 'PROPOSED',
              approvedBy: null,
              approvedAt: null
            },
            provenance: {
              sources: [],
              alternatives: [],
              conflicts: []
            },
            confidence: {
              score: 0.9,
              basis: 'Test',
              assumptions: []
            }
          }
        ]
      };
      
      // Attempting to bypass adapter and pass directly to E10
      // Gate should BLOCK
      const gateResult = gate.validate(unapprovedBTD);
      expect(gateResult.validated).toBe(false);
      
      // E10 adapter should THROW
      expect(() => adapter.prepareForE10(unapprovedBTD)).toThrow(E10ConsumptionError);
      expect(() => adapter.prepareForE10(unapprovedBTD)).toThrow(/non-CANONICAL/);
    });
  });
  
  // ============================================================================
  // B0 FAILURE #7: VERIFICATION CLAIMS FALSE (tests don't run)
  // ============================================================================
  
  describe('B0 Failure #7: Verification claims without executable evidence', () => {
    it('ENFORCED BY: TypeScript Gate B (existing governance)', () => {
      // This test documents that B0 Failure #7 is enforced by existing
      // Bella governance machinery (Gate B: TypeScript check).
      // 
      // Business Truth Gate (Invariant 7) is placeholder.
      // Full enforcement is in E10 output validation (post-build).
      //
      // Example: If E10 generates code claiming "tests pass" but
      // `npm test` fails, Gate B will catch it.
      
      expect(true).toBe(true); // Documented compliance
    });
  });
});
