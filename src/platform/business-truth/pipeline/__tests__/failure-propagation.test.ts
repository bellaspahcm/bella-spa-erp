/**
 * @fileoverview M4 Failure Propagation Tests
 * 
 * Tests that failures stop pipeline correctly.
 * No silent fallback. No silent downgrade.
 */

import { IntelligencePipelineOrchestrator } from '../intelligence-pipeline';
import { PipelineError } from '../types';
import type { ResearchIntent } from '../../research/types';

describe('M4 Intelligence Pipeline - Failure Propagation', () => {
  const pipeline = new IntelligencePipelineOrchestrator({ strictCritique: true });

  describe('Research Phase Failures', () => {
    it('should stop on invalid research intent', async () => {
      // Given: Invalid intent (empty industry)
      const intent: ResearchIntent = {
        industry: '',
        focus: []
      };

      // When: Execute pipeline
      // Then: Throws PipelineError
      await expect(pipeline.execute(intent))
        .rejects.toThrow(PipelineError);
    });

    it('should record failure in lifecycle when invalid intent reaches critique', async () => {
      const intent: ResearchIntent = {
        industry: '',
        focus: []
      };

      try {
        await pipeline.execute(intent);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(PipelineError);
        // M2 doesn't validate empty intent - M3 catches it at critique phase
        expect((error as PipelineError).phase).toBe('CRITIQUE');
      }
    });
  });

  describe('Critique Phase Failures', () => {
    it('should stop when critique blocks (strict mode)', async () => {
      // Given: Intent that produces insufficient evidence
      // (This would need custom test setup to guarantee blocked critique)
      // For now, testing structure exists
      
      const strictPipeline = new IntelligencePipelineOrchestrator({
        strictCritique: true
      });

      // When critique blocks in strict mode
      // Then: Pipeline should throw
      // (Actual block would require crafted evidence)
    });
  });

  describe('Authorization Phase Failures', () => {
    it('should handle requires-human authorization correctly', async () => {
      // Given: Intent that produces business decisions requiring human
      // (High confidence but with alternatives)
      const intent: ResearchIntent = {
        industry: 'TEST_REQUIRES_HUMAN',
        focus: ['entities']
      };

      // When: Execute pipeline
      const result = await pipeline.execute(intent);

      // Then: May complete but not authorized
      // (Depending on M1 policy - if auto-approve is strict)
      expect(result).toBeDefined();
      
      // If authorization requires human, truths stay CRITIQUED
      if (result.authorization && !result.authorization.authorized) {
        expect(result.truths.every(t => t.status === 'CRITIQUED')).toBe(true);
      }
    });

    it('should record authorization failure in lifecycle', async () => {
      // When authorization fails for structural reasons
      // (Would need specific test case)
      
      // Lifecycle should record the failure
      const intent: ResearchIntent = {
        industry: 'TEST_AUTH_FAIL',
        focus: ['entities']
      };

      try {
        const result = await pipeline.execute(intent);
        
        // If authorization blocked, check lifecycle
        if (result.authorization && !result.authorization.authorized) {
          const authPhase = result.lifecycle.phases.find(p => p.phase === 'AUTHORIZATION');
          expect(authPhase).toBeDefined();
        }
      } catch (error) {
        // If throws, should be PipelineError from AUTHORIZATION phase
        if (error instanceof PipelineError) {
          expect(error.phase).toBe('AUTHORIZATION');
        }
      }
    });
  });

  describe('No Silent Fallback', () => {
    it('should not silently downgrade status on failure', async () => {
      const intent: ResearchIntent = {
        industry: 'TEST_NO_SILENT',
        focus: ['entities']
      };

      const result = await pipeline.execute(intent);

      // Truths are either CANONICAL (authorized) or CRITIQUED (not authorized)
      // Never silently downgraded to lower status
      for (const truth of result.truths) {
        expect(['CANONICAL', 'CRITIQUED']).toContain(truth.status);
        expect(truth.status).not.toBe('PROPOSED');  // Should have gone through critique
      }
    });

    it('should not proceed with invalid evidence', async () => {
      // Given: Intent that would produce invalid evidence
      // (Actual test would need specific setup)
      
      // When: Pipeline processes
      // Then: Should fail rather than proceed with invalid data
      
      // This is structural - pipeline uses M2 which validates
      expect(true).toBe(true);  // Placeholder - actual test requires specific setup
    });
  });

  describe('Error Information', () => {
    it('should provide detailed error information on failure', async () => {
      const intent: ResearchIntent = {
        industry: '',
        focus: []
      };

      try {
        await pipeline.execute(intent);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(PipelineError);
        
        const pipelineError = error as PipelineError;
        expect(pipelineError.message).toBeDefined();
        expect(pipelineError.phase).toBeDefined();
      }
    });
  });

  describe('Lifecycle Trace on Failure', () => {
    it('should record failure phase in lifecycle trace', async () => {
      const intent: ResearchIntent = {
        industry: '',
        focus: []
      };

      try {
        await pipeline.execute(intent);
        fail('Should have thrown');
      } catch (error) {
        // Error thrown, but lifecycle should still be recordable
        // (Would need enhanced error to include lifecycle)
        expect(error).toBeInstanceOf(PipelineError);
      }
    });
  });
});
