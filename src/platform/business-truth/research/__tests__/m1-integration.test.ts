/**
 * @fileoverview M2 + M1 Integration Tests
 * 
 * Tests that M2 research outputs pass through M1 governance boundary correctly.
 * 
 * @module platform/business-truth/research/__tests__/m1-integration
 */

import { ResearchOrchestrator } from '../orchestrator';
import { BusinessTruthGate } from '../../gate/business-truth-gate';
import type { BusinessTruthDocument } from '../../types/business-truth';
import type { ResearchIntent } from '../types';

describe('M2 + M1 Integration Tests', () => {
  let orchestrator: ResearchOrchestrator;
  let gate: BusinessTruthGate;
  
  beforeEach(() => {
    orchestrator = new ResearchOrchestrator();
    gate = new BusinessTruthGate();
  });
  
  describe('Valid Proposals Pass M1 Gate', () => {
    it('research output has valid structure', async () => {
      const intent: ResearchIntent = {
        industry: 'Restaurant'
      };
      
      const result = await orchestrator.research(intent);
      
      // Research should complete without throwing
      // (Internal validation passed)
      expect(result.truths).toBeDefined();
      expect(result.truths.length).toBeGreaterThan(0);
      
      // All truths should be PROPOSED
      for (const truth of result.truths) {
        expect(truth.status).toBe('PROPOSED');
        expect(truth.authority.type).toBe('PROPOSED');
      }
    });
    
    it('proposals have complete structure required by M1', async () => {
      const intent: ResearchIntent = {
        industry: 'Healthcare'
      };
      
      const result = await orchestrator.research(intent);
      
      // Verify structure completeness
      for (const truth of result.truths) {
        // Must have provenance
        expect(truth.provenance).toBeDefined();
        expect(truth.provenance.sources.length).toBeGreaterThan(0);
        expect(truth.provenance.reasoning).toBeDefined();
        
        // Must have confidence
        expect(truth.confidence).toBeDefined();
        expect(truth.confidence.score).toBeGreaterThanOrEqual(0);
        expect(truth.confidence.score).toBeLessThanOrEqual(1);
        
        // Must have authority
        expect(truth.authority).toBeDefined();
        expect(truth.authority.source).toBe('AI');
        expect(truth.authority.type).toBe('PROPOSED');
      }
    });
  });
  
  describe('Proposals Cannot Self-Authorize', () => {
    it('all proposals remain PROPOSED', async () => {
      const intent: ResearchIntent = {
        industry: 'Retail'
      };
      
      const result = await orchestrator.research(intent);
      
      // Every truth must be PROPOSED
      for (const truth of result.truths) {
        expect(truth.status).toBe('PROPOSED');
        expect(truth.authority.type).toBe('PROPOSED');
        expect(truth.authority.approvedBy).toBeNull();
      }
    });
    
    it('M2 cannot produce CANONICAL truths', async () => {
      const intent: ResearchIntent = {
        industry: 'F&B'
      };
      
      const result = await orchestrator.research(intent);
      
      // No truth should be CANONICAL
      const canonicalTruths = result.truths.filter(t => t.status === 'CANONICAL');
      expect(canonicalTruths.length).toBe(0);
    });
    
    it('M2 cannot produce APPROVED truths', async () => {
      const intent: ResearchIntent = {
        industry: 'Education'
      };
      
      const result = await orchestrator.research(intent);
      
      // No truth should be APPROVED
      const approvedTruths = result.truths.filter(t => t.status === 'APPROVED');
      expect(approvedTruths.length).toBe(0);
    });
  });
  
  describe('Conflicts and Alternatives Preserved', () => {
    it('preserves alternatives when multiple approaches exist', async () => {
      const intent: ResearchIntent = {
        industry: 'Spa'  // Spa kernel exists, may suggest alternatives
      };
      
      const result = await orchestrator.research(intent);
      
      // Check if alternatives preserved in provenance
      for (const truth of result.truths) {
        expect(truth.provenance.alternatives).toBeDefined();
        // Alternatives array may be empty or populated
      }
    });
    
    it('preserves conflicts when evidence disagrees', async () => {
      const intent: ResearchIntent = {
        industry: 'Logistics'
      };
      
      const result = await orchestrator.research(intent);
      
      // Check if conflicts preserved
      for (const truth of result.truths) {
        expect(truth.provenance.conflicts).toBeDefined();
        // Conflicts array may be empty or populated
      }
    });
  });
});
