/**
 * Workflow Engine Integration Tests
 * 
 * Comprehensive test suite covering:
 * - Basic execution (happy path)
 * - Error handling and recovery
 * - Retry logic
 * - Pause/resume workflows
 * - State persistence
 * - Event emission
 * - Context management
 */

import { WorkflowEngine } from '../workflow-engine';
import { WorkflowExecutor } from '../workflow-executor';
import { InMemoryStateManager } from '../state-manager';
import { MockEventPublisher } from '@/lib/events/__tests__/mock-event-publisher';
import {
  createWorkflowContext,
  type IStep,
  type WorkflowContext,
  type StepOutput,
  type WorkflowDefinition
} from '../types';

/**
 * Test helpers: Simple step implementations
 */
class ActionStep implements IStep {
  name: string;
  type: 'action' = 'action';
  
  constructor(
    name: string,
    private action: (ctx: WorkflowContext) => Promise<StepOutput>
  ) {
    this.name = name;
  }
  
  async execute(context: WorkflowContext): Promise<StepOutput> {
    return this.action(context);
  }
}

class FailingStep implements IStep {
  name: string;
  type: 'action' = 'action';
  continueOnError?: boolean;
  
  constructor(name: string, continueOnError = false) {
    this.name = name;
    this.continueOnError = continueOnError;
  }
  
  async execute(_context: WorkflowContext): Promise<StepOutput> {
    throw new Error(`Step ${this.name} intentionally failed`);
  }
}

describe('Workflow Engine - Integration Tests', () => {
  let stateManager: InMemoryStateManager;
  let eventPublisher: MockEventPublisher;
  let executor: WorkflowExecutor;
  let engine: WorkflowEngine;
  
  beforeEach(() => {
    stateManager = new InMemoryStateManager();
    eventPublisher = new MockEventPublisher();
    executor = new WorkflowExecutor(stateManager, eventPublisher);
    engine = new WorkflowEngine(executor, stateManager, eventPublisher, undefined, createWorkflowContext);
  });
  
  afterEach(() => {
    stateManager.clear();
    eventPublisher.clear();
  });
  
  describe('Basic Execution', () => {
    test('should execute simple workflow with one step', async () => {
      const workflow: WorkflowDefinition = {
        id: 'simple-workflow',
        version: '1.0.0',
        name: 'Simple Workflow',
        steps: [
          new ActionStep('step1', async () => ({ result: 'success' }))
        ]
      };
      
      const result = await engine.execute(workflow, { tenantId: 'test-tenant' });
      
      expect(result.status).toBe('completed');
      expect(result.output).toEqual({ result: 'success' });
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].status).toBe('completed');
      expect(result.executionTime).toBeGreaterThan(0);
    });
    
    test('should execute workflow with multiple steps', async () => {
      const workflow: WorkflowDefinition = {
        id: 'multi-step-workflow',
        version: '1.0.0',
        name: 'Multi-Step Workflow',
        steps: [
          new ActionStep('step1', async () => ({ value: 1 })),
          new ActionStep('step2', async (ctx) => ({ value: (ctx.data.value as number) + 1 })),
          new ActionStep('step3', async (ctx) => ({ value: (ctx.data.value as number) * 2 }))
        ]
      };
      
      const result = await engine.execute(workflow, { tenantId: 'test-tenant' });
      
      expect(result.status).toBe('completed');
      expect(result.output).toEqual({ value: 4 }); // (1 + 1) * 2 = 4
      expect(result.steps).toHaveLength(3);
      expect(result.steps.every(s => s.status === 'completed')).toBe(true);
    });
    
    test('should pass data between steps via context', async () => {
      const workflow: WorkflowDefinition = {
        id: 'context-workflow',
        version: '1.0.0',
        name: 'Context Workflow',
        steps: [
          new ActionStep('collect-data', async () => ({ userId: '123', userName: 'John' })),
          new ActionStep('process-data', async (ctx) => ({
            greeting: `Hello, ${ctx.data.userName}!`,
            id: ctx.data.userId
          }))
        ]
      };
      
      const result = await engine.execute(workflow, { tenantId: 'test-tenant' });
      
      expect(result.output).toEqual({
        userId: '123',
        userName: 'John',
        greeting: 'Hello, John!',
        id: '123'
      });
    });
  });
  
  describe('Error Handling', () => {
    test('should fail workflow when step fails', async () => {
      const workflow: WorkflowDefinition = {
        id: 'failing-workflow',
        version: '1.0.0',
        name: 'Failing Workflow',
        steps: [
          new ActionStep('step1', async () => ({ result: 'ok' })),
          new FailingStep('failing-step'),
          new ActionStep('step3', async () => ({ result: 'should not reach' }))
        ]
      };
      
      const result = await engine.execute(workflow, { tenantId: 'test-tenant' });
      
      expect(result.status).toBe('failed');
      expect(result.error).toContain('Step failing-step failed');
      expect(result.steps).toHaveLength(2); // Only first 2 steps executed
      expect(result.steps[0].status).toBe('completed');
      expect(result.steps[1].status).toBe('failed');
    });
    
    test('should continue workflow when step has continueOnError=true', async () => {
      const workflow: WorkflowDefinition = {
        id: 'continue-on-error-workflow',
        version: '1.0.0',
        name: 'Continue On Error Workflow',
        steps: [
          new ActionStep('step1', async () => ({ result: 'ok' })),
          new FailingStep('failing-step', true), // continueOnError = true
          new ActionStep('step3', async () => ({ result: 'continued' }))
        ]
      };
      
      const result = await engine.execute(workflow, { tenantId: 'test-tenant' });
      
      expect(result.status).toBe('completed');
      expect(result.steps).toHaveLength(3);
      expect(result.steps[0].status).toBe('completed');
      expect(result.steps[1].status).toBe('failed');
      expect(result.steps[2].status).toBe('completed');
      expect(result.output).toEqual({ result: 'continued' });
    });
  });
  
  describe('Retry Logic', () => {
    test('should retry failed step according to retry policy', async () => {
      let attemptCount = 0;
      
      class RetryableStep implements IStep {
        name = 'retryable-step';
        type: 'action' = 'action';
        retryPolicy = {
          maxAttempts: 3,
          delayMs: 10,
          backoff: 'linear' as const
        };
        
        async execute(_context: WorkflowContext): Promise<StepOutput> {
          attemptCount++;
          if (attemptCount < 3) {
            throw new Error('Not yet');
          }
          return { success: true, attempts: attemptCount };
        }
      }
      
      const workflow: WorkflowDefinition = {
        id: 'retry-workflow',
        version: '1.0.0',
        name: 'Retry Workflow',
        steps: [new RetryableStep()]
      };
      
      const result = await engine.execute(workflow, { tenantId: 'test-tenant' });
      
      expect(result.status).toBe('completed');
      expect(result.output).toEqual({ success: true, attempts: 3 });
      expect(attemptCount).toBe(3);
      
      // Check events
      const retryEvents = eventPublisher.getEventsByType('workflow.step.retrying');
      expect(retryEvents).toHaveLength(2); // 2 retries before success
    });
    
    test('should fail after max retry attempts', async () => {
      let attemptCount = 0;
      
      class AlwaysFailingStep implements IStep {
        name = 'always-failing';
        type: 'action' = 'action';
        retryPolicy = {
          maxAttempts: 2,
          delayMs: 10
        };
        
        async execute(_context: WorkflowContext): Promise<StepOutput> {
          attemptCount++;
          throw new Error('Always fails');
        }
      }
      
      const workflow: WorkflowDefinition = {
        id: 'max-retry-workflow',
        version: '1.0.0',
        name: 'Max Retry Workflow',
        steps: [new AlwaysFailingStep()]
      };
      
      const result = await engine.execute(workflow, { tenantId: 'test-tenant' });
      
      expect(result.status).toBe('failed');
      expect(attemptCount).toBe(3); // 1 initial + 2 retries
      
      const retryEvents = eventPublisher.getEventsByType('workflow.step.retrying');
      expect(retryEvents).toHaveLength(2);
    });
  });
  
  describe('Control Flow', () => {
    test('should pause workflow when step requests pause', async () => {
      const workflow: WorkflowDefinition = {
        id: 'pause-workflow',
        version: '1.0.0',
        name: 'Pause Workflow',
        steps: [
          new ActionStep('step1', async () => ({ value: 1 })),
          new ActionStep('pause-step', async () => ({
            value: 2,
            _control: { pause: true }
          })),
          new ActionStep('step3', async () => ({ value: 3 }))
        ]
      };
      
      const result = await engine.execute(workflow, { tenantId: 'test-tenant' });
      
      expect(result.status).toBe('paused');
      expect(result.steps).toHaveLength(2); // Only 2 steps executed before pause
      
      // Check pause event emitted
      const pauseEvents = eventPublisher.getEventsByType('workflow.paused');
      expect(pauseEvents).toHaveLength(1);
      expect(pauseEvents[0].data.stepName).toBe('pause-step');
    });
    
    test('should skip remaining steps when requested', async () => {
      const workflow: WorkflowDefinition = {
        id: 'skip-workflow',
        version: '1.0.0',
        name: 'Skip Workflow',
        steps: [
          new ActionStep('step1', async () => ({ value: 1 })),
          new ActionStep('skip-step', async () => ({
            value: 2,
            _control: { skipRemaining: true }
          })),
          new ActionStep('step3', async () => ({ value: 3 })),
          new ActionStep('step4', async () => ({ value: 4 }))
        ]
      };
      
      const result = await engine.execute(workflow, { tenantId: 'test-tenant' });
      
      expect(result.status).toBe('completed');
      expect(result.steps).toHaveLength(2); // Only 2 steps executed
      expect(result.output).toEqual({ value: 2 });
    });
    
    test('should support conditional branching via nextStepName', async () => {
      const workflow: WorkflowDefinition = {
        id: 'branch-workflow',
        version: '1.0.0',
        name: 'Branch Workflow',
        steps: [
          new ActionStep('decision', async () => ({
            shouldSkip: true,
            _control: { nextStepName: 'final' }
          })),
          new ActionStep('skipped', async () => ({ value: 'should not see this' })),
          new ActionStep('final', async () => ({ result: 'jumped here' }))
        ]
      };
      
      const result = await engine.execute(workflow, { tenantId: 'test-tenant' });
      
      expect(result.status).toBe('completed');
      expect(result.steps).toHaveLength(2); // decision + final
      expect(result.steps[0].stepName).toBe('decision');
      expect(result.steps[1].stepName).toBe('final');
      expect(result.output).toEqual({ shouldSkip: true, result: 'jumped here' });
    });
  });
  
  describe('State Management', () => {
    test('should persist execution state after each step', async () => {
      const workflow: WorkflowDefinition = {
        id: 'state-workflow',
        version: '1.0.0',
        name: 'State Workflow',
        steps: [
          new ActionStep('step1', async () => ({ value: 1 })),
          new ActionStep('step2', async () => ({ value: 2 }))
        ]
      };
      
      const result = await engine.execute(workflow, { tenantId: 'test-tenant' });
      
      // Verify execution stored
      const stored = await stateManager.getExecution(result.executionId);
      expect(stored).toBeDefined();
      expect(stored.status).toBe('completed');
      expect(stored.context.stepResults).toHaveLength(2);
    });
    
    test('should update context after each step', async () => {
      const workflow: WorkflowDefinition = {
        id: 'context-update-workflow',
        version: '1.0.0',
        name: 'Context Update Workflow',
        steps: [
          new ActionStep('step1', async () => ({ a: 1 })),
          new ActionStep('step2', async () => ({ b: 2 })),
          new ActionStep('step3', async () => ({ c: 3 }))
        ]
      };
      
      const result = await engine.execute(workflow, { tenantId: 'test-tenant' });
      
      const stored = await stateManager.getExecution(result.executionId);
      expect(stored.context.data).toEqual({ a: 1, b: 2, c: 3 });
      expect(stored.context.currentStepIndex).toBe(3);
    });
  });
  
  describe('Event Emission', () => {
    test('should emit workflow lifecycle events', async () => {
      const workflow: WorkflowDefinition = {
        id: 'event-workflow',
        version: '1.0.0',
        name: 'Event Workflow',
        steps: [
          new ActionStep('step1', async () => ({ result: 'ok' }))
        ]
      };
      
      await engine.execute(workflow, { tenantId: 'test-tenant' });
      
      // Check events
      const startedEvents = eventPublisher.getEventsByType('workflow.started');
      const completedEvents = eventPublisher.getEventsByType('workflow.completed');
      
      expect(startedEvents).toHaveLength(1);
      expect(completedEvents).toHaveLength(1);
      
      expect(startedEvents[0].data.workflowId).toBe('event-workflow');
      expect(completedEvents[0].data.workflowId).toBe('event-workflow');
    });
    
    test('should emit step lifecycle events', async () => {
      const workflow: WorkflowDefinition = {
        id: 'step-event-workflow',
        version: '1.0.0',
        name: 'Step Event Workflow',
        steps: [
          new ActionStep('step1', async () => ({ result: 'ok' })),
          new ActionStep('step2', async () => ({ result: 'ok2' }))
        ]
      };
      
      await engine.execute(workflow, { tenantId: 'test-tenant' });
      
      const stepStartedEvents = eventPublisher.getEventsByType('workflow.step.started');
      const stepCompletedEvents = eventPublisher.getEventsByType('workflow.step.completed');
      
      expect(stepStartedEvents).toHaveLength(2);
      expect(stepCompletedEvents).toHaveLength(2);
      
      expect(stepStartedEvents[0].data.stepName).toBe('step1');
      expect(stepStartedEvents[1].data.stepName).toBe('step2');
    });
    
    test('should emit failure events on error', async () => {
      const workflow: WorkflowDefinition = {
        id: 'failure-event-workflow',
        version: '1.0.0',
        name: 'Failure Event Workflow',
        steps: [
          new FailingStep('failing-step')
        ]
      };
      
      await engine.execute(workflow, { tenantId: 'test-tenant' });
      
      const failedEvents = eventPublisher.getEventsByType('workflow.failed');
      const stepFailedEvents = eventPublisher.getEventsByType('workflow.step.failed');
      
      expect(failedEvents).toHaveLength(1);
      expect(stepFailedEvents).toHaveLength(1);
      
      expect(stepFailedEvents[0].data.stepName).toBe('failing-step');
    });
  });
  
  describe('Workflow Cancellation', () => {
    test('should cancel running workflow', async () => {
      const workflow: WorkflowDefinition = {
        id: 'cancel-workflow',
        version: '1.0.0',
        name: 'Cancel Workflow',
        steps: [
          new ActionStep('step1', async () => ({ value: 1 }))
        ]
      };
      
      const result = await engine.execute(workflow, { tenantId: 'test-tenant' });
      
      await engine.cancel(result.executionId, 'User requested cancellation');
      
      const execution = await stateManager.getExecution(result.executionId);
      expect(execution.status).toBe('cancelled');
      expect(execution.errorMessage).toBe('User requested cancellation');
      
      // Check cancellation event
      const cancelEvents = eventPublisher.getEventsByType('workflow.cancelled');
      expect(cancelEvents).toHaveLength(1);
      expect(cancelEvents[0].data.reason).toBe('User requested cancellation');
    });
  });
  
  describe('Validation', () => {
    test('should validate workflow definition', async () => {
      const invalidWorkflow: any = {
        id: '',
        version: '1.0.0',
        steps: []
      };
      
      await expect(
        engine.execute(invalidWorkflow, { tenantId: 'test-tenant' })
      ).rejects.toThrow('Workflow ID is required');
    });
    
    test('should reject workflow without version', async () => {
      const invalidWorkflow: any = {
        id: 'test',
        version: '',
        steps: [new ActionStep('step1', async () => ({}))]
      };
      
      await expect(
        engine.execute(invalidWorkflow, { tenantId: 'test-tenant' })
      ).rejects.toThrow('Workflow version is required');
    });
    
    test('should reject workflow without steps', async () => {
      const invalidWorkflow: WorkflowDefinition = {
        id: 'test',
        version: '1.0.0',
        name: 'Test',
        steps: []
      };
      
      await expect(
        engine.execute(invalidWorkflow, { tenantId: 'test-tenant' })
      ).rejects.toThrow('Workflow must have at least one step');
    });
    
    test('should reject workflow with duplicate step names', async () => {
      const invalidWorkflow: WorkflowDefinition = {
        id: 'test',
        version: '1.0.0',
        name: 'Test',
        steps: [
          new ActionStep('step1', async () => ({})),
          new ActionStep('step1', async () => ({})) // Duplicate name
        ]
      };
      
      await expect(
        engine.execute(invalidWorkflow, { tenantId: 'test-tenant' })
      ).rejects.toThrow('Duplicate step name: step1');
    });
    
    test('should require tenantId in initial context', async () => {
      const workflow: WorkflowDefinition = {
        id: 'test',
        version: '1.0.0',
        name: 'Test',
        steps: [new ActionStep('step1', async () => ({}))]
      };
      
      await expect(
        engine.execute(workflow, {} as any)
      ).rejects.toThrow('tenantId is required');
    });
  });
  
  describe('Performance', () => {
    test('should track execution time', async () => {
      const workflow: WorkflowDefinition = {
        id: 'perf-workflow',
        version: '1.0.0',
        name: 'Performance Workflow',
        steps: [
          new ActionStep('step1', async () => {
            await new Promise(resolve => setTimeout(resolve, 50));
            return { result: 'ok' };
          })
        ]
      };
      
      const result = await engine.execute(workflow, { tenantId: 'test-tenant' });
      
      expect(result.executionTime).toBeGreaterThanOrEqual(50);
      expect(result.steps[0].executionTime).toBeGreaterThanOrEqual(50);
    });
    
    test('should handle concurrent workflow executions', async () => {
      const workflow: WorkflowDefinition = {
        id: 'concurrent-workflow',
        version: '1.0.0',
        name: 'Concurrent Workflow',
        steps: [
          new ActionStep('step1', async () => ({ result: 'ok' }))
        ]
      };
      
      const executions = await Promise.all([
        engine.execute(workflow, { tenantId: 'tenant1' }),
        engine.execute(workflow, { tenantId: 'tenant2' }),
        engine.execute(workflow, { tenantId: 'tenant3' })
      ]);
      
      expect(executions).toHaveLength(3);
      expect(executions.every(e => e.status === 'completed')).toBe(true);
      
      // Verify all executions have unique IDs
      const ids = executions.map(e => e.executionId);
      expect(new Set(ids).size).toBe(3);
    });
  });
});
