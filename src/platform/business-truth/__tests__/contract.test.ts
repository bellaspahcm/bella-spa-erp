/**
 * @fileoverview Business Truth Contract Unit Tests
 * 
 * Tests individual validators and state machines.
 * 
 * @module platform/business-truth/__tests__/contract
 */

import { TruthLifecycle } from '../validators/truth-lifecycle';
import { AuthorityModel } from '../validators/authority-model';
import { EpistemicLifecycleValidator } from '../validators/epistemic-lifecycle-validator';
import { ProvenanceTracker } from '../validators/provenance-tracker';
import { ConfidenceValidator } from '../validators/confidence-validator';
import type { BusinessTruth } from '../types/business-truth';

describe('Business Truth Contract Unit Tests', () => {
  describe('TruthLifecycle State Machine', () => {
    let lifecycle: TruthLifecycle;
    
    beforeEach(() => {
      lifecycle = new TruthLifecycle();
    });
    
    it('allows valid transitions', () => {
      expect(lifecycle.canTransition('PROPOSED', 'CRITIQUED')).toBe(true);
      expect(lifecycle.canTransition('CRITIQUED', 'APPROVED')).toBe(true);
      expect(lifecycle.canTransition('APPROVED', 'CANONICAL')).toBe(true);
    });
    
    it('blocks forbidden shortcuts', () => {
      expect(lifecycle.canTransition('INFERRED', 'CANONICAL')).toBe(false);
      expect(lifecycle.canTransition('PROPOSED', 'CANONICAL')).toBe(false);
    });
    
    it('provides required path to CANONICAL', () => {
      const path = lifecycle.getRequiredPath('PROPOSED');
      expect(path).toContain('CRITIQUED');
      expect(path).toContain('APPROVED');
      expect(path).toContain('CANONICAL');
    });
  });
  
  describe('AuthorityModel State Machine', () => {
    let authorityModel: AuthorityModel;
    
    beforeEach(() => {
      authorityModel = new AuthorityModel();
    });
    
    it('allows AI to DERIVE from SYSTEM', () => {
      expect(authorityModel.canTransition(
        { source: 'SYSTEM', type: 'DERIVED' },
        { source: 'AI', type: 'DERIVED' }
      )).toBe(true);
    });
    
    it('allows AI to INFER', () => {
      expect(authorityModel.canTransition(
        { source: 'AI', type: 'DERIVED' },
        { source: 'AI', type: 'INFERRED' }
      )).toBe(true);
    });
    
    it('allows AI to PROPOSE', () => {
      expect(authorityModel.canTransition(
        { source: 'AI', type: 'INFERRED' },
        { source: 'AI', type: 'PROPOSED' }
      )).toBe(true);
    });
    
    it('allows HUMAN to APPROVE', () => {
      expect(authorityModel.canTransition(
        { source: 'AI', type: 'PROPOSED' },
        { source: 'HUMAN', type: 'APPROVED' }
      )).toBe(true);
    });
    
    it('allows AI auto-APPROVE under conditions', () => {
      // Conditions checked by gate, but transition is valid
      expect(authorityModel.canTransition(
        { source: 'AI', type: 'PROPOSED' },
        { source: 'AI', type: 'APPROVED' }
      )).toBe(true);
    });
  });
  
  describe('EpistemicLifecycleValidator', () => {
    let validator: EpistemicLifecycleValidator;
    
    beforeEach(() => {
      validator = new EpistemicLifecycleValidator();
    });
    
    it('rejects INFERENCE + CANONICAL without approval', () => {
      const truth: BusinessTruth = {
        id: 'test-1',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        contentType: 'ENTITY',
        content: { name: 'Test', description: 'Test entity', attributes: [] },
        epistemicStatus: 'INFERENCE',
        status: 'CANONICAL',
        authority: {
          source: 'AI',
          type: 'INFERRED',
          approvedBy: null, // No approval
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
      };
      
      const error = validator.validate(truth);
      expect(error).not.toBeNull();
      expect(error?.message).toContain('INFERENCE');
      expect(error?.message).toContain('CANONICAL');
    });
    
    it('accepts INFERENCE + CANONICAL with approval', () => {
      const truth: BusinessTruth = {
        id: 'test-2',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        contentType: 'ENTITY',
        content: { name: 'Test', description: 'Test entity', attributes: [] },
        epistemicStatus: 'INFERENCE',
        status: 'CANONICAL',
        authority: {
          source: 'HUMAN',
          type: 'APPROVED',
          approvedBy: 'HUMAN', // Approved
          approvedAt: new Date()
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
      };
      
      const error = validator.validate(truth);
      expect(error).toBeNull();
    });
  });
  
  describe('ProvenanceTracker', () => {
    let tracker: ProvenanceTracker;
    
    beforeEach(() => {
      tracker = new ProvenanceTracker();
    });
    
    it('detects missing sources for INFERENCE', () => {
      const truth: BusinessTruth = {
        id: 'test-3',
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
          sources: [], // Missing sources
          reasoning: 'Test reasoning',
          alternatives: [],
          conflicts: []
        },
        confidence: {
          score: 0.8,
          basis: 'Test',
          assumptions: []
        }
      };
      
      const validation = tracker.validateCompleteness(truth);
      expect(validation.valid).toBe(false);
      expect(validation.missing).toContain('sources (required for INFERENCE)');
    });
    
    it('detects unresolved conflicts', () => {
      const truth: BusinessTruth = {
        id: 'test-4',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        contentType: 'ENTITY',
        content: { name: 'Test', description: 'Test', attributes: [] },
        epistemicStatus: 'OBSERVATION',
        status: 'PROPOSED',
        authority: {
          source: 'AI',
          type: 'PROPOSED',
          approvedBy: null,
          approvedAt: null
        },
        provenance: {
          sources: [],
          alternatives: [],
          conflicts: [
            {
              evidenceA: { 
                id: 'a', 
                type: 'WEB', 
                source: 'a.com', 
                strength: 'MODERATE', 
                timestamp: new Date() 
              },
              evidenceB: { 
                id: 'b', 
                type: 'WEB', 
                source: 'b.com', 
                strength: 'MODERATE', 
                timestamp: new Date() 
              },
              nature: 'Conflicting definitions',
              resolution: undefined // Unresolved
            }
          ]
        },
        confidence: {
          score: 0.7,
          basis: 'Conflicting sources',
          assumptions: []
        }
      };
      
      const validation = tracker.validateCompleteness(truth);
      expect(validation.valid).toBe(false);
      expect(validation.missing.some(m => m.includes('conflict resolution'))).toBe(true);
    });
  });
  
  describe('ConfidenceValidator', () => {
    let validator: ConfidenceValidator;
    
    beforeEach(() => {
      validator = new ConfidenceValidator();
    });
    
    it('rejects invalid confidence score', () => {
      const validation = validator.validate({
        score: 1.5, // Invalid
        basis: 'Test',
        assumptions: []
      });
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('0.0-1.0'))).toBe(true);
    });
    
    it('warns on low confidence', () => {
      const validation = validator.validate({
        score: 0.3, // Very low
        basis: 'Weak evidence',
        assumptions: []
      });
      
      expect(validation.warnings.some(w => w.includes('low confidence'))).toBe(true);
    });
    
    it('checks auto-approval threshold', () => {
      expect(validator.meetsAutoApprovalThreshold({
        score: 0.96,
        basis: 'Strong',
        assumptions: []
      })).toBe(true);
      
      expect(validator.meetsAutoApprovalThreshold({
        score: 0.8,
        basis: 'Moderate',
        assumptions: []
      })).toBe(false);
    });
  });
});
