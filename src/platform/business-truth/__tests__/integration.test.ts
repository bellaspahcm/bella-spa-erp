/**
 * @fileoverview Business Truth Integration Tests
 * 
 * Tests complete flow: PROPOSED → CANONICAL → E10
 * 
 * @module platform/business-truth/__tests__/integration
 */

import { BusinessTruthGate } from '../gate/business-truth-gate';
import { AuthorizationBoundary } from '../gate/authorization';
import { BusinessTruthAdapter } from '../../../../scripts/factory/business-truth-adapter';
import type { BusinessTruthDocument } from '../types/business-truth';

describe('Business Truth Integration Tests', () => {
  let gate: BusinessTruthGate;
  let authBoundary: AuthorizationBoundary;
  let adapter: BusinessTruthAdapter;
  
  beforeEach(() => {
    gate = new BusinessTruthGate();
    authBoundary = new AuthorizationBoundary();
    adapter = new BusinessTruthAdapter();
  });
  
  describe('Happy Path: PROPOSED → VALIDATED → AUTHORIZED → CANONICAL → E10', () => {
    it('auto-approves high confidence truth with no conflicts/alternatives', () => {
      const validBTD: BusinessTruthDocument = {
        metadata: {
          industryOS: 'F&B',
          version: '1.0',
          createdAt: new Date(),
          lastModified: new Date(),
          approvedBy: '',
          approvalDate: new Date()
        },
        truths: [
          {
            id: 'valid-1',
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            contentType: 'ENTITY',
            content: {
              name: 'MenuItem',
              description: 'Menu item entity',
              attributes: [
                { name: 'id', type: 'string' },
                { name: 'name', type: 'string' },
                { name: 'price', type: 'number' }
              ]
            },
            epistemicStatus: 'KNOWLEDGE', // Well-established
            status: 'CANONICAL',
            authority: {
              source: 'SYSTEM',
              type: 'APPROVED',
              approvedBy: 'SYSTEM', // From existing Bella
              approvedAt: new Date()
            },
            provenance: {
              sources: [
                {
                  id: 'bella-1',
                  type: 'BELLA_KERNEL',
                  source: 'src/platform/spa/entities/service-item.ts',
                  strength: 'STRONG',
                  timestamp: new Date()
                }
              ],
              alternatives: [], // No alternatives
              conflicts: [] // No conflicts
            },
            confidence: {
              score: 0.98, // High confidence
              basis: 'Existing Bella Spa Kernel',
              assumptions: []
            }
          }
        ]
      };
      
      // Step 1: Gate validation
      const gateResult = gate.validate(validBTD);
      expect(gateResult.validated).toBe(true);
      expect(gateResult.authorizationStatus).toBe('AUTO_APPROVED');
      
      // Step 2: Authorization
      const authDecision = authBoundary.authorize({ btd: validBTD, gateResult });
      expect(authDecision.authorized).toBe(true);
      expect(authDecision.authority).toBe('AI');
      
      // Step 3: E10 consumption
      const authorizedBTD = adapter.prepareForE10(validBTD);
      expect(authorizedBTD.metadata.approvedBy).toBe('AI');
      expect(authorizedBTD.truths[0].status).toBe('CANONICAL');
    });
    
    it('requires human approval for business decisions (alternatives exist)', () => {
      const btdWithAlternatives: BusinessTruthDocument = {
        metadata: {
          industryOS: 'F&B',
          version: '1.0',
          createdAt: new Date(),
          lastModified: new Date(),
          approvedBy: '',
          approvalDate: new Date()
        },
        truths: [
          {
            id: 'decision-1',
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            contentType: 'PROCESS',
            content: {
              name: 'OrderFulfillment',
              description: 'Order fulfillment workflow',
              steps: [
                { order: 1, name: 'Receive order' },
                { order: 2, name: 'Prepare' },
                { order: 3, name: 'Serve' }
              ],
              rules: []
            },
            epistemicStatus: 'BELIEF', // Multiple valid approaches
            status: 'CANONICAL',
            authority: {
              source: 'HUMAN',
              type: 'APPROVED',
              approvedBy: 'HUMAN',
              approvedAt: new Date()
            },
            provenance: {
              sources: [
                {
                  id: 'web-1',
                  type: 'WEB',
                  source: 'restaurant-ops.com',
                  strength: 'MODERATE',
                  timestamp: new Date()
                }
              ],
              alternatives: [
                {
                  option: 'Sequential',
                  description: 'One at a time',
                  pros: ['Simple'],
                  cons: ['Slow'],
                  evidence: [],
                  tradeoffs: 'Speed vs simplicity'
                },
                {
                  option: 'Parallel',
                  description: 'Multiple concurrent',
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
              assumptions: ['Single-site operation']
            }
          }
        ]
      };
      
      // Step 1: Gate validation
      const gateResult = gate.validate(btdWithAlternatives);
      expect(gateResult.validated).toBe(true);
      expect(gateResult.authorizationStatus).toBe('REQUIRES_HUMAN');
      
      // Step 2: Auto-authorization should FAIL
      const autoAuthDecision = authBoundary.authorize({ 
        btd: btdWithAlternatives, 
        gateResult 
      });
      expect(autoAuthDecision.authorized).toBe(false);
      
      // Step 3: Human authorization should SUCCEED
      const humanAuthDecision = authBoundary.authorizeByHuman(
        { btd: btdWithAlternatives, gateResult },
        'product-owner'
      );
      expect(humanAuthDecision.authorized).toBe(true);
      expect(humanAuthDecision.authority).toBe('HUMAN');
      
      // Step 4: E10 consumption with human approval
      const authorizedBTD = adapter.prepareForE10WithHumanApproval(
        btdWithAlternatives,
        'product-owner'
      );
      expect(authorizedBTD.metadata.approvedBy).toBe('HUMAN');
    });
  });
  
  describe('Invalid Paths: Must STOP', () => {
    it('blocks non-CANONICAL truths from E10', () => {
      const proposedBTD: BusinessTruthDocument = {
        metadata: {
          industryOS: 'F&B',
          version: '1.0',
          createdAt: new Date(),
          lastModified: new Date(),
          approvedBy: '',
          approvalDate: new Date()
        },
        truths: [
          {
            id: 'proposed-1',
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
      
      // Gate should BLOCK
      const gateResult = gate.validate(proposedBTD);
      expect(gateResult.validated).toBe(false);
      
      // E10 consumption should THROW
      expect(() => adapter.prepareForE10(proposedBTD)).toThrow();
    });
    
    it('blocks INFERENCE without approval', () => {
      const inferenceBTD: BusinessTruthDocument = {
        metadata: {
          industryOS: 'F&B',
          version: '1.0',
          createdAt: new Date(),
          lastModified: new Date(),
          approvedBy: '',
          approvalDate: new Date()
        },
        truths: [
          {
            id: 'inference-1',
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            contentType: 'ENTITY',
            content: {
              name: 'Reservation',
              description: 'Reservation entity',
              attributes: []
            },
            epistemicStatus: 'INFERENCE',
            status: 'CANONICAL',
            authority: {
              source: 'AI',
              type: 'INFERRED', // NOT APPROVED
              approvedBy: null,
              approvedAt: null
            },
            provenance: {
              sources: [
                {
                  id: 'web-2',
                  type: 'WEB',
                  source: 'example.com',
                  strength: 'MODERATE',
                  timestamp: new Date()
                }
              ],
              reasoning: 'Inferred from web sources',
              alternatives: [],
              conflicts: []
            },
            confidence: {
              score: 0.85,
              basis: 'Single web source',
              assumptions: []
            }
          }
        ]
      };
      
      // Gate should BLOCK
      const gateResult = gate.validate(inferenceBTD);
      expect(gateResult.validated).toBe(false);
      expect(gateResult.violations.some(v =>
        v.message.includes('INFERENCE') && v.message.includes('CANONICAL')
      )).toBe(true);
      
      // E10 consumption should THROW
      expect(() => adapter.prepareForE10(inferenceBTD)).toThrow();
    });
  });
});
