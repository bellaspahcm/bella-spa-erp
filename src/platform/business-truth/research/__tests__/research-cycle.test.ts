/**
 * @fileoverview M2 Research Cycle Tests
 * 
 * Tests complete research pipeline: Intent → Evidence → Synthesis → Inference → Proposal
 * 
 * @module platform/business-truth/research/__tests__/research-cycle
 */

import { ResearchOrchestrator } from '../orchestrator';
import type { ResearchIntent } from '../types';

describe('M2 Research Cycle Tests', () => {
  let orchestrator: ResearchOrchestrator;
  
  beforeEach(() => {
    orchestrator = new ResearchOrchestrator();
  });
  
  describe('Complete Research Pipeline', () => {
    it('generates proposals from valid industry intent', async () => {
      const intent: ResearchIntent = {
        industry: 'Restaurant',
        focus: ['entities']
      };
      
      const result = await orchestrator.research(intent);
      
      // Verify result structure
      expect(result.truths).toBeDefined();
      expect(result.truths.length).toBeGreaterThan(0);
      expect(result.evidence).toBeDefined();
      expect(result.synthesis).toBeDefined();
      expect(result.researchMetadata).toBeDefined();
    });
    
    it('collects evidence from multiple sources', async () => {
      const intent: ResearchIntent = {
        industry: 'Healthcare'
      };
      
      const result = await orchestrator.research(intent);
      
      // Should have evidence from collectors
      expect(result.evidence.length).toBeGreaterThan(0);
      expect(result.researchMetadata.sourcesConsulted).toBeGreaterThan(0);
    });
    
    it('produces synthesis with confidence scores', async () => {
      const intent: ResearchIntent = {
        industry: 'Retail'
      };
      
      const result = await orchestrator.research(intent);
      
      // Verify synthesis
      expect(result.synthesis.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(result.synthesis.confidenceScore).toBeLessThanOrEqual(1);
      expect(result.synthesis.patterns).toBeDefined();
      expect(result.synthesis.assumptions).toBeDefined();
    });
    
    it('creates proposals with full provenance', async () => {
      const intent: ResearchIntent = {
        industry: 'F&B'
      };
      
      const result = await orchestrator.research(intent);
      
      // Every proposal must have provenance
      for (const truth of result.truths) {
        expect(truth.provenance).toBeDefined();
        expect(truth.provenance.sources.length).toBeGreaterThan(0);
        expect(truth.provenance.reasoning).toBeDefined();
        expect(truth.confidence).toBeDefined();
        expect(truth.confidence.score).toBeGreaterThanOrEqual(0);
        expect(truth.confidence.score).toBeLessThanOrEqual(1);
      }
    });
    
    it('completes research cycle with metadata', async () => {
      const intent: ResearchIntent = {
        industry: 'Hospitality'
      };
      
      const result = await orchestrator.research(intent);
      
      // Verify metadata
      expect(result.researchMetadata.intent).toEqual(intent);
      expect(result.researchMetadata.startedAt).toBeInstanceOf(Date);
      expect(result.researchMetadata.completedAt).toBeInstanceOf(Date);
      expect(result.researchMetadata.completedAt.getTime()).toBeGreaterThanOrEqual(
        result.researchMetadata.startedAt.getTime()
      );
    });
  });
  
  describe('Evidence Preservation', () => {
    it('preserves evidence in proposals', async () => {
      const intent: ResearchIntent = {
        industry: 'Education'
      };
      
      const result = await orchestrator.research(intent);
      
      // Evidence must be preserved in provenance
      for (const truth of result.truths) {
        expect(truth.provenance.sources).toBeDefined();
        expect(truth.provenance.sources.length).toBeGreaterThan(0);
        
        // Each source must be complete Evidence object
        for (const source of truth.provenance.sources) {
          expect(source.id).toBeDefined();
          expect(source.type).toBeDefined();
          expect(source.source).toBeDefined();
          expect(source.strength).toBeDefined();
          expect(source.timestamp).toBeInstanceOf(Date);
        }
      }
    });
    
    it('retains synthesis results', async () => {
      const intent: ResearchIntent = {
        industry: 'Manufacturing'
      };
      
      const result = await orchestrator.research(intent);
      
      // Synthesis must be accessible
      expect(result.synthesis.patterns).toBeDefined();
      expect(result.synthesis.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(result.synthesis.assumptions).toBeDefined();
      expect(result.synthesis.assumptions.length).toBeGreaterThan(0);
    });
  });
  
  describe('Inference Distinguishability', () => {
    it('marks all proposals as INFERENCE epistemic status', async () => {
      const intent: ResearchIntent = {
        industry: 'Logistics'
      };
      
      const result = await orchestrator.research(intent);
      
      // All truths must be INFERENCE (AI inferred)
      for (const truth of result.truths) {
        expect(truth.epistemicStatus).toBe('INFERENCE');
      }
    });
    
    it('sets authority source as AI', async () => {
      const intent: ResearchIntent = {
        industry: 'RealEstate'
      };
      
      const result = await orchestrator.research(intent);
      
      // All proposals from AI
      for (const truth of result.truths) {
        expect(truth.authority.source).toBe('AI');
      }
    });
  });
});
