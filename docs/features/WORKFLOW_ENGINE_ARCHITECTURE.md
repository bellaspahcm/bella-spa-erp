# Workflow Engine Architecture

**Version**: 1.0.0  
**Status**: 🚧 **Draft** (Phase 1 Implementation)  
**Last Updated**: 2026-07-09  
**Preceded By**: [Decision Engine Platform Architecture](./DECISION_ENGINE_PLATFORM_ARCHITECTURE.md)

---

## Document Map

This document is organized into 15 sections:

1. [Executive Summary](#1-executive-summary)
2. [Design Principles (Alignment with Decision Engine)](#2-design-principles-alignment-with-decision-engine)
3. [What is Workflow Engine?](#3-what-is-workflow-engine)
4. [Core Components (6 Components)](#4-core-components-6-components)
5. [Workflow DSL (Definition Language)](#5-workflow-dsl-definition-language)
6. [Step Types & Abstractions](#6-step-types--abstractions)
7. [State Management Strategy](#7-state-management-strategy)
8. [Decision Integration Patterns](#8-decision-integration-patterns)
9. [Event-Driven Architecture](#9-event-driven-architecture)
10. [Error Handling & Retry Strategy](#10-error-handling--retry-strategy)
11. [Observability & Audit Trail](#11-observability--audit-trail)
12. [Sample Workflows (3 Real-World Examples)](#12-sample-workflows-3-real-world-examples)
13. [Comparison: Workflow vs Decision Engine](#13-comparison-workflow-vs-decision-engine)
14. [Out of Scope](#14-out-of-scope)
15. [Migration Path & Rollout Plan](#15-migration-path--rollout-plan)

---

## 1. Executive Summary

### What is This?

Workflow Engine là **orchestration layer** cho multi-step business processes trong Bella ERP. Nó **bổ sung** (không thay thế) Decision Engine bằng cách:
- ✅ Orchestrate nhiều decisions liên tiếp
- ✅ Quản lý state của long-running processes
- ✅ Điều phối conditional branching dựa trên decision results
- ✅ Cung cấp retry, rollback, và compensation logic

### Relationship với Decision Engine

```
Decision Engine:     "Make ONE decision based on context"
Workflow Engine:     "Execute MULTIPLE steps with state management"
```

**Analogy**:
- Decision Engine = **Calculator** (pure function: input → output)
- Workflow Engine = **Recipe** (sequence of steps with state)


### Key Characteristics

| Aspect | Workflow Engine | Decision Engine |
|--------|-----------------|-----------------|
| **Purpose** | Orchestrate multi-step processes | Make single decisions |
| **State** | Stateful (workflow execution state) | Stateless (pure functions) |
| **Duration** | Long-running (minutes to days) | Short-lived (milliseconds) |
| **Scope** | Multi-module coordination | Single decision point |
| **Retry** | Built-in retry/rollback | No retry (caller handles) |
| **Examples** | Booking-to-fulfillment, Approval chains | Auto-approval, Eligibility checks |

### Architecture in One Picture

```
┌─────────────────────────────────────────────────────────────┐
│                Business Process Layer                        │
│    (Booking → Decision → Inventory → Notification)          │
└────────────┬────────────────────────────────────────────────┘
             │ uses
             ↓
┌─────────────────────────────────────────────────────────────┐
│                  Workflow Engine Platform                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ WorkflowEngine (Stateful Orchestrator)               │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     ↓                                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ WorkflowExecutor (Step-by-Step Runner)               │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     ↓                                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ IStep (Step Abstraction)                            │   │
│  └─────┬────────┬───────────┬──────────┬───────────────┘   │
│        ↓        ↓           ↓          ↓                    │
│  ┌─────────┐ ┌──────┐ ┌────────┐ ┌──────────┐            │
│  │Decision │ │Action│ │Condition││Parallel  │            │
│  │  Step   │ │ Step │ │  Step   │ │  Step    │            │
│  └─────────┘ └──────┘ └────────┘ └──────────┘            │
│        ↓                                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ StateManager (Workflow State Persistence)            │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
             │ subscribes to / publishes
             ↓
┌─────────────────────────────────────────────────────────────┐
│                     Event Bus Layer                          │
│  (Decision Engine events + Workflow Engine events)          │
└─────────────────────────────────────────────────────────────┘
             │ calls
             ↓
┌─────────────────────────────────────────────────────────────┐
│               Decision Engine Platform                       │
│        (Used by DecisionStep for decision logic)            │
└─────────────────────────────────────────────────────────────┘
```

### Design Philosophy

> **"Orchestrate decisions, don't replace them"**

Workflow Engine is designed to **coordinate** Decision Engine providers:
- Today: Simple sequential workflows (A → B → C)
- Tomorrow: Conditional branching (if Decision X → Path Y)
- Future: Parallel execution (A + B → wait → C)
- Long-term: Human-in-the-loop approvals + compensating transactions

### Core Value Proposition

```
Before Workflow Engine:
Business Module
    ↓
Hardcoded orchestration logic (async/await chains)
    ↓
Difficult to visualize, audit, retry, or modify
    ↓
Cannot reuse across modules

After Workflow Engine:
Business Module
    ↓
WorkflowEngine.execute(workflowDefinition)
    ↓
Declarative workflow DSL
    ↓
Visual audit trail, automatic retry, reusable patterns
```


---

## 2. Design Principles (Alignment with Decision Engine)

### The 8 Workflow Engine Principles

Workflow Engine follows Decision Engine's philosophy but adapts for stateful orchestration:

| # | Principle | Rationale |
|---|-----------|-----------|
| 1️⃣ | **Engine MUST NOT know business modules** | Same as Decision Engine - domain independence |
| 2️⃣ | **Engine MUST be step-based** | All workflows decompose into discrete steps |
| 3️⃣ | **Steps MUST be reusable** | Same step types work across all workflows |
| 4️⃣ | **Engine IS stateful** | ⚠️ **Different from Decision Engine** - workflows need state |
| 5️⃣ | **State MUST be persistent** | Workflow state survives crashes/restarts |
| 6️⃣ | **Workflows delegate to Decision Engine** | Never duplicate decision logic in workflows |
| 7️⃣ | **All executions are auditable** | Complete trace of every step execution |
| 8️⃣ | **Engine never accesses Database directly** | State via StateManager only |

### Principle #4: Why Stateful?

**Decision Engine is stateless** because decisions are:
- ✅ Short-lived (milliseconds)
- ✅ Pure functions (same input → same output)
- ✅ Horizontally scalable (no state to sync)

**Workflow Engine MUST be stateful** because workflows are:
- ✅ Long-running (minutes to days)
- ✅ Sequential (Step A result feeds into Step B)
- ✅ Need persistence (survive server restarts)
- ✅ Need retry/rollback (require execution history)

### State Management Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                  Workflow State (Persistent)                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ workflow_executions table                            │  │
│  │  - execution_id (PK)                                 │  │
│  │  - workflow_id                                       │  │
│  │  - status (running, completed, failed, paused)       │  │
│  │  - current_step_index                                │  │
│  │  - context_data (JSON)                               │  │
│  │  - created_at, updated_at                            │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ workflow_step_executions table                       │  │
│  │  - step_execution_id (PK)                            │  │
│  │  - workflow_execution_id (FK)                        │  │
│  │  - step_name                                         │  │
│  │  - status (pending, running, completed, failed)      │  │
│  │  - input_data (JSON)                                 │  │
│  │  - output_data (JSON)                                │  │
│  │  - error_message                                     │  │
│  │  - retry_count                                       │  │
│  │  - started_at, completed_at                          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Key points**:
- State stored in Database (Supabase `workflow_executions` + `workflow_step_executions` tables)
- StateManager handles all DB operations (Engine never accesses DB directly - Principle #8)
- Workflow execution can be paused/resumed
- Full audit trail of every step


---

## 3. What is Workflow Engine?

### Definition

Workflow Engine là **stateful orchestrator** cho multi-step business processes. Nó:
- ✅ **Executes workflows** defined in declarative DSL
- ✅ **Manages execution state** across steps
- ✅ **Coordinates Decision Engine** calls
- ✅ **Handles errors** with retry/rollback
- ✅ **Emits events** for observability
- ✅ **Provides audit trail** for compliance

### What It Is

```
✅ Multi-step process orchestrator
✅ Stateful execution engine
✅ Event-driven coordinator
✅ Decision Engine consumer
✅ Auditable execution tracker
✅ Retry/rollback manager
```

### What It Is NOT

```
❌ Decision Engine replacement (workflows USE decisions)
❌ Business module (not tied to Booking, Payroll, etc.)
❌ BPMN engine (simpler, opinionated for Bella ERP needs)
❌ Human workflow tool (no drag-and-drop UI builder in Phase 1)
❌ ETL pipeline (not for data transformation)
❌ Job scheduler (not for cron-like recurring tasks)
```

### Core Responsibilities

```typescript
// Workflow Engine does 6 things:
class WorkflowEngine {
  async execute(
    workflowDefinition: WorkflowDefinition,
    initialContext: WorkflowContext
  ): Promise<WorkflowExecutionResult> {
    // 1. Create workflow execution record (state)
    const execution = await this.stateManager.createExecution(workflowDefinition, initialContext);
    
    // 2. Execute steps sequentially (or in parallel for ParallelStep)
    for (const step of workflowDefinition.steps) {
      const stepResult = await this.executor.executeStep(step, execution.context);
      
      // 3. Update execution state after each step
      await this.stateManager.updateStepExecution(execution.id, step.name, stepResult);
      
      // 4. Handle conditional branching
      if (stepResult.shouldSkipRemainingSteps) break;
      if (stepResult.nextStepName) {
        step = this.findStepByName(stepResult.nextStepName);
      }
      
      // 5. Publish step execution events
      await this.eventPublisher.publish({
        type: 'workflow.step.completed',
        data: { execution, step, result: stepResult }
      });
    }
    
    // 6. Finalize and return result
    return this.stateManager.completeExecution(execution.id);
  }
}
```


### Use Cases

| Workflow Type | Steps | Example |
|---------------|-------|---------|
| **Booking-to-Fulfillment** | 5-7 steps | Create booking → Check eligibility → Reserve inventory → Assign KTV → Send notification → Complete |
| **Payroll Approval Flow** | 3-5 steps | Calculate salary → Manager approval (decision) → Finance review → Publish salary → Generate expense |
| **Inventory Reorder Flow** | 4-6 steps | Check stock → Evaluate reorder (decision) → Create PO → Notify supplier → Update inventory → Audit |
| **Customer Onboarding** | 6-8 steps | Register customer → KYC verification → Create account → Send welcome email → Assign sales rep → Track conversion |

---

## 4. Core Components (6 Components)

Workflow Engine consists of **6 core components**:

```
┌─────────────────────────────────────────────────────────────┐
│                    1. WorkflowEngine                         │
│                  (Main Entry Point)                          │
└────────────────────────┬────────────────────────────────────┘
                         │ uses
┌────────────────────────▼────────────────────────────────────┐
│              2. WorkflowExecutor                             │
│           (Step-by-Step Execution Logic)                     │
└────────────────────────┬────────────────────────────────────┘
                         │ uses
┌────────────────────────▼────────────────────────────────────┐
│              3. IStep (Step Abstraction)                     │
│         DecisionStep | ActionStep | ConditionStep            │
└────────────────────────┬────────────────────────────────────┘
                         │ uses
┌────────────────────────▼────────────────────────────────────┐
│              4. StateManager                                 │
│         (Workflow Execution State Persistence)               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              5. WorkflowDefinition                           │
│           (Declarative Workflow DSL)                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              6. WorkflowContext                              │
│         (Execution State + Shared Data)                      │
└─────────────────────────────────────────────────────────────┘
```

---

### Component 1: WorkflowEngine

**Role**: Main orchestrator and entry point for workflow execution.

**Responsibilities**:
1. Validate workflow definition
2. Initialize workflow execution state
3. Coordinate WorkflowExecutor
4. Handle top-level errors
5. Emit workflow lifecycle events
6. Return final result

**Interface**:
```typescript
interface IWorkflowEngine {
  /**
   * Execute a workflow from start to finish
   * @param definition - Workflow definition (DSL)
   * @param initialContext - Initial workflow context
   * @returns Promise<WorkflowExecutionResult>
   */
  execute(
    definition: WorkflowDefinition,
    initialContext: Partial<WorkflowContext>
  ): Promise<WorkflowExecutionResult>;
  
  /**
   * Resume a paused workflow execution
   * @param executionId - Workflow execution ID
   * @returns Promise<WorkflowExecutionResult>
   */
  resume(executionId: string): Promise<WorkflowExecutionResult>;
  
  /**
   * Cancel a running workflow execution
   * @param executionId - Workflow execution ID
   * @param reason - Cancellation reason
   */
  cancel(executionId: string, reason: string): Promise<void>;
}
```


**Implementation** (simplified):
```typescript
class WorkflowEngine implements IWorkflowEngine {
  constructor(
    private readonly executor: WorkflowExecutor,
    private readonly stateManager: IStateManager,
    private readonly eventPublisher: IEventPublisher,
    private readonly logger: ILogger
  ) {}

  async execute(
    definition: WorkflowDefinition,
    initialContext: Partial<WorkflowContext>
  ): Promise<WorkflowExecutionResult> {
    // 1. Validate definition
    this.validateDefinition(definition);
    
    // 2. Create execution record
    const execution = await this.stateManager.createExecution({
      workflowId: definition.id,
      workflowVersion: definition.version,
      status: 'running',
      context: this.buildInitialContext(definition, initialContext),
      startedAt: new Date()
    });
    
    // 3. Publish start event
    await this.eventPublisher.publish({
      type: 'workflow.started',
      data: { executionId: execution.id, workflowId: definition.id }
    });
    
    try {
      // 4. Execute workflow
      const result = await this.executor.execute(definition, execution);
      
      // 5. Mark as completed
      await this.stateManager.completeExecution(execution.id, result);
      
      // 6. Publish completion event
      await this.eventPublisher.publish({
        type: 'workflow.completed',
        data: { executionId: execution.id, result }
      });
      
      return result;
    } catch (error) {
      // 7. Handle failure
      await this.stateManager.failExecution(execution.id, error);
      
      await this.eventPublisher.publish({
        type: 'workflow.failed',
        data: { executionId: execution.id, error: error.message }
      });
      
      throw error;
    }
  }
  
  async resume(executionId: string): Promise<WorkflowExecutionResult> {
    // Load execution from StateManager
    const execution = await this.stateManager.getExecution(executionId);
    
    if (execution.status !== 'paused') {
      throw new Error(`Cannot resume workflow: status is ${execution.status}`);
    }
    
    // Resume from last completed step
    return this.executor.resume(execution);
  }
  
  async cancel(executionId: string, reason: string): Promise<void> {
    await this.stateManager.cancelExecution(executionId, reason);
    
    await this.eventPublisher.publish({
      type: 'workflow.cancelled',
      data: { executionId, reason }
    });
  }
  
  private validateDefinition(definition: WorkflowDefinition): void {
    if (!definition.id) throw new Error('Workflow ID is required');
    if (!definition.steps || definition.steps.length === 0) {
      throw new Error('Workflow must have at least one step');
    }
    // Additional validation...
  }
  
  private buildInitialContext(
    definition: WorkflowDefinition,
    partial: Partial<WorkflowContext>
  ): WorkflowContext {
    return {
      workflowId: definition.id,
      executionId: crypto.randomUUID(),
      tenantId: partial.tenantId!,
      userId: partial.userId,
      correlationId: partial.correlationId ?? crypto.randomUUID(),
      data: partial.data ?? {},
      metadata: partial.metadata ?? {},
      currentStepIndex: 0,
      stepResults: []
    };
  }
}
```


---

### Component 2: WorkflowExecutor

**Role**: Step-by-step execution engine.

**Responsibilities**:
1. Execute workflow steps in order (or parallel)
2. Pass context between steps
3. Handle step-level errors/retries
4. Support conditional branching
5. Emit step execution events

**Interface**:
```typescript
interface IWorkflowExecutor {
  /**
   * Execute all steps in workflow definition
   */
  execute(
    definition: WorkflowDefinition,
    execution: WorkflowExecution
  ): Promise<WorkflowExecutionResult>;
  
  /**
   * Execute a single step
   */
  executeStep(
    step: IStep,
    context: WorkflowContext
  ): Promise<StepExecutionResult>;
  
  /**
   * Resume from paused execution
   */
  resume(execution: WorkflowExecution): Promise<WorkflowExecutionResult>;
}
```

**Implementation** (core logic):
```typescript
class WorkflowExecutor implements IWorkflowExecutor {
  constructor(
    private readonly stateManager: IStateManager,
    private readonly eventPublisher: IEventPublisher,
    private readonly logger: ILogger
  ) {}

  async execute(
    definition: WorkflowDefinition,
    execution: WorkflowExecution
  ): Promise<WorkflowExecutionResult> {
    let context = execution.context;
    const results: StepExecutionResult[] = [];
    
    for (let i = context.currentStepIndex; i < definition.steps.length; i++) {
      const step = definition.steps[i];
      
      // Execute step with retry logic
      const stepResult = await this.executeStepWithRetry(step, context);
      
      // Store result
      results.push(stepResult);
      context.stepResults.push(stepResult);
      context.currentStepIndex = i + 1;
      
      // Persist state after each step
      await this.stateManager.updateStepExecution(execution.id, {
        stepName: step.name,
        status: stepResult.status,
        output: stepResult.output,
        error: stepResult.error,
        completedAt: new Date()
      });
      
      // Handle step outcomes
      if (stepResult.status === 'failed' && !step.continueOnError) {
        throw new WorkflowExecutionError(`Step ${step.name} failed`, stepResult);
      }
      
      if (stepResult.shouldPause) {
        await this.stateManager.pauseExecution(execution.id);
        break;
      }
      
      if (stepResult.nextStepName) {
        // Conditional branching
        i = this.findStepIndex(definition, stepResult.nextStepName) - 1;
      }
      
      // Merge step output into context
      context.data = { ...context.data, ...stepResult.output };
    }
    
    return {
      status: 'completed',
      output: context.data,
      steps: results
    };
  }
  
  async executeStep(
    step: IStep,
    context: WorkflowContext
  ): Promise<StepExecutionResult> {
    const startTime = Date.now();
    
    try {
      this.logger.info(`Executing step: ${step.name}`);
      
      // Emit event
      await this.eventPublisher.publish({
        type: 'workflow.step.started',
        data: { stepName: step.name, context }
      });
      
      // Execute step logic
      const result = await step.execute(context);
      
      const executionTime = Date.now() - startTime;
      
      // Emit completion event
      await this.eventPublisher.publish({
        type: 'workflow.step.completed',
        data: { stepName: step.name, result, executionTime }
      });
      
      return {
        stepName: step.name,
        status: 'completed',
        output: result,
        executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      this.logger.error(`Step failed: ${step.name}`, error);
      
      await this.eventPublisher.publish({
        type: 'workflow.step.failed',
        data: { stepName: step.name, error: error.message, executionTime }
      });
      
      return {
        stepName: step.name,
        status: 'failed',
        error: error.message,
        executionTime
      };
    }
  }
  
  private async executeStepWithRetry(
    step: IStep,
    context: WorkflowContext
  ): Promise<StepExecutionResult> {
    const maxRetries = step.retryPolicy?.maxAttempts ?? 0;
    const retryDelay = step.retryPolicy?.delayMs ?? 1000;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const result = await this.executeStep(step, context);
      
      if (result.status === 'completed') {
        return result;
      }
      
      if (attempt < maxRetries) {
        this.logger.warn(`Retrying step ${step.name} (attempt ${attempt + 1}/${maxRetries})`);
        await this.delay(retryDelay * Math.pow(2, attempt)); // Exponential backoff
      }
    }
    
    throw new Error(`Step ${step.name} failed after ${maxRetries} retries`);
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  private findStepIndex(definition: WorkflowDefinition, stepName: string): number {
    return definition.steps.findIndex(s => s.name === stepName);
  }
}
```


---

### Component 3: IStep (Step Abstraction)

**Role**: Base interface for all workflow steps.

**Interface**:
```typescript
interface IStep {
  /** Unique step name */
  name: string;
  
  /** Step type (for logging/debugging) */
  type: 'decision' | 'action' | 'condition' | 'parallel';
  
  /** Step description */
  description?: string;
  
  /** Retry policy */
  retryPolicy?: {
    maxAttempts: number;
    delayMs: number;
  };
  
  /** Continue workflow even if this step fails */
  continueOnError?: boolean;
  
  /** Execute the step logic */
  execute(context: WorkflowContext): Promise<StepOutput>;
}

/** Step execution output */
interface StepOutput {
  /** Output data to merge into workflow context */
  [key: string]: unknown;
  
  /** Special control flags */
  _control?: {
    /** Pause workflow after this step */
    pause?: boolean;
    
    /** Skip remaining steps */
    skipRemaining?: boolean;
    
    /** Jump to specific step */
    nextStepName?: string;
  };
}
```

**Step Types**:

#### 1. DecisionStep (Delegates to Decision Engine)

```typescript
class DecisionStep implements IStep {
  readonly type = 'decision';
  
  constructor(
    public readonly name: string,
    private readonly decisionEngine: IDecisionEngine,
    private readonly config: {
      decisionType: string;
      ruleType: string;
      rule: any;
      outputKey: string; // Where to store result in context
    }
  ) {}
  
  async execute(context: WorkflowContext): Promise<StepOutput> {
    // Delegate to Decision Engine
    const result = await this.decisionEngine.evaluate({
      tenantId: context.tenantId,
      module: 'workflow',
      decisionType: this.config.decisionType,
      ruleType: this.config.ruleType,
      rule: this.config.rule,
      data: context.data,
      user: { id: context.userId },
      correlationId: context.correlationId
    });
    
    // Store result in context
    return {
      [this.config.outputKey]: result
    };
  }
}
```


#### 2. ActionStep (Execute business logic)

```typescript
class ActionStep implements IStep {
  readonly type = 'action';
  
  constructor(
    public readonly name: string,
    private readonly handler: ActionHandler
  ) {}
  
  async execute(context: WorkflowContext): Promise<StepOutput> {
    // Execute business action
    return this.handler(context);
  }
}

// Example: Send notification action
const sendNotificationStep = new ActionStep(
  'send-booking-confirmation',
  async (context) => {
    await notificationService.send({
      to: context.data.customerEmail,
      template: 'booking-confirmation',
      data: { bookingId: context.data.bookingId }
    });
    
    return { notificationSent: true };
  }
);
```

#### 3. ConditionStep (Conditional branching)

```typescript
class ConditionStep implements IStep {
  readonly type = 'condition';
  
  constructor(
    public readonly name: string,
    private readonly predicate: (context: WorkflowContext) => boolean | Promise<boolean>,
    private readonly trueBranch: string,
    private readonly falseBranch: string
  ) {}
  
  async execute(context: WorkflowContext): Promise<StepOutput> {
    const condition = await this.predicate(context);
    
    return {
      _control: {
        nextStepName: condition ? this.trueBranch : this.falseBranch
      }
    };
  }
}

// Example: Branch based on decision result
const approvalBranchStep = new ConditionStep(
  'check-approval',
  (context) => context.data.approvalResult?.approved === true,
  'proceed-to-fulfillment', // true branch
  'send-rejection-email'    // false branch
);
```

#### 4. ParallelStep (Execute multiple steps concurrently)

```typescript
class ParallelStep implements IStep {
  readonly type = 'parallel';
  
  constructor(
    public readonly name: string,
    private readonly steps: IStep[]
  ) {}
  
  async execute(context: WorkflowContext): Promise<StepOutput> {
    // Execute all steps in parallel
    const results = await Promise.allSettled(
      this.steps.map(step => step.execute(context))
    );
    
    // Merge all outputs
    const output: StepOutput = {};
    
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const stepName = this.steps[i].name;
      
      if (result.status === 'fulfilled') {
        Object.assign(output, result.value);
      } else {
        output[`${stepName}_error`] = result.reason.message;
      }
    }
    
    return output;
  }
}
```

---

## 5. Workflow DSL (Definition Language)

### Definition Structure

```typescript
interface WorkflowDefinition {
  /** Unique workflow ID */
  id: string;
  
  /** Workflow version (semver) */
  version: string;
  
  /** Human-readable name */
  name: string;
  
  /** Description */
  description?: string;
  
  /** Workflow steps (executed in order) */
  steps: IStep[];
  
  /** Default retry policy for all steps */
  defaultRetryPolicy?: {
    maxAttempts: number;
    delayMs: number;
  };
  
  /** Workflow timeout (ms) */
  timeout?: number;
  
  /** Metadata */
  metadata?: Record<string, unknown>;
}
```

### Example: Booking-to-Fulfillment Workflow

```typescript
const bookingToFulfillmentWorkflow: WorkflowDefinition = {
  id: 'booking-to-fulfillment-v1',
  version: '1.0.0',
  name: 'Booking to Fulfillment Workflow',
  description: 'Orchestrate booking creation, approval, inventory reservation, and KTV assignment',
  
  steps: [
    // Step 1: Check auto-approval eligibility (Decision Engine)
    new DecisionStep('check-auto-approval', decisionEngine, {
      decisionType: 'auto-approval',
      ruleType: 'if-then',
      rule: {
        condition: {
          and: [
            { field: 'totalAmount', operator: '<', value: 5000000 },
            { field: 'customer.membershipTier', operator: '===', value: 'VIP' }
          ]
        },
        action: { approved: true }
      },
      outputKey: 'approvalResult'
    }),
    
    // Step 2: Conditional branch
    new ConditionStep(
      'approval-branch',
      (ctx) => ctx.data.approvalResult.approved,
      'reserve-inventory',  // If approved
      'notify-pending-approval'  // If not approved
    ),
    
    // Step 3a: Reserve inventory (Action)
    new ActionStep('reserve-inventory', async (ctx) => {
      const reservation = await inventoryService.reserve({
        productIds: ctx.data.booking.productIds,
        sessionDate: ctx.data.booking.sessionDate,
        tenantId: ctx.tenantId
      });
      
      return { reservationId: reservation.id };
    }),
    
    // Step 3b: Assign KTV (Action)
    new ActionStep('assign-ktv', async (ctx) => {
      const assignment = await ktvService.autoAssign({
        sessionDate: ctx.data.booking.sessionDate,
        serviceType: ctx.data.booking.serviceType,
        tenantId: ctx.tenantId
      });
      
      return { assignedKtvId: assignment.ktvId };
    }),
    
    // Step 4: Send confirmation (Parallel notifications)
    new ParallelStep('send-notifications', [
      new ActionStep('notify-customer', async (ctx) => {
        await notificationService.sendEmail({
          to: ctx.data.booking.customerEmail,
          template: 'booking-confirmed',
          data: { bookingId: ctx.data.booking.id }
        });
        return { customerNotified: true };
      }),
      
      new ActionStep('notify-ktv', async (ctx) => {
        await notificationService.sendSMS({
          to: ctx.data.assignedKtvId,
          message: `New booking assigned: ${ctx.data.booking.id}`
        });
        return { ktvNotified: true };
      })
    ]),
    
    // Step 5: Finalize booking (Action)
    new ActionStep('finalize-booking', async (ctx) => {
      await bookingService.finalize({
        bookingId: ctx.data.booking.id,
        status: 'confirmed',
        reservationId: ctx.data.reservationId,
        assignedKtvId: ctx.data.assignedKtvId
      });
      
      return { bookingFinalized: true };
    })
  ],
  
  defaultRetryPolicy: {
    maxAttempts: 3,
    delayMs: 1000
  },
  
  timeout: 60000 // 1 minute
};
```


### Usage Pattern

```typescript
// Step 1: Define workflow (once, reusable)
const workflow = defineWorkflow({
  id: 'payroll-approval-v1',
  version: '1.0.0',
  name: 'Payroll Approval Workflow',
  steps: [
    // ... steps definition
  ]
});

// Step 2: Execute workflow (per invocation)
const result = await workflowEngine.execute(workflow, {
  tenantId: 'bella-spa-vietnam',
  userId: 'manager-123',
  data: {
    employeeId: 'ktv-456',
    month: '2026-06',
    salaryAmount: 15000000
  }
});

// Step 3: Check result
if (result.status === 'completed') {
  console.log('Workflow completed:', result.output);
} else {
  console.error('Workflow failed:', result.error);
}

// Step 4: Audit (automatic via events)
// Workflow Engine already published events:
// - workflow.started
// - workflow.step.started (×5)
// - workflow.step.completed (×5)
// - workflow.completed
```

---

## 6. Step Types & Abstractions

### Summary Table

| Step Type | Purpose | Stateful? | Decision Engine? | Example Use Case |
|-----------|---------|-----------|------------------|------------------|
| **DecisionStep** | Delegate to Decision Engine | No | ✅ Yes | Auto-approval check, Eligibility evaluation |
| **ActionStep** | Execute business logic | No | ❌ No | Send email, Reserve inventory, Update DB |
| **ConditionStep** | Conditional branching | No | ❌ No | If approved → Path A, else → Path B |
| **ParallelStep** | Execute steps concurrently | No | ❌ No | Send email + SMS in parallel |

### Step Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                     Step Lifecycle                           │
└─────────────────────────────────────────────────────────────┘

1. CREATED
   └─> Step instantiated with config

2. PENDING
   └─> Waiting for execution

3. RUNNING
   └─> execute() method called

4. RETRYING (if error + retry policy)
   └─> Exponential backoff retry

5. COMPLETED or FAILED
   └─> Result stored in StateManager

6. OUTPUT MERGED
   └─> Step output merged into WorkflowContext
```

### Step Design Patterns

#### Pattern 1: Decision + Action

```typescript
// Check eligibility (Decision) → Reserve resource (Action)
const steps = [
  new DecisionStep('check-eligibility', decisionEngine, { ... }),
  new ActionStep('reserve-resource', async (ctx) => {
    if (!ctx.data.eligibilityResult.approved) {
      return { skipped: true };
    }
    return await resourceService.reserve(ctx.data.resourceId);
  })
];
```

#### Pattern 2: Parallel Actions

```typescript
// Send notifications in parallel
const notificationStep = new ParallelStep('notify-all', [
  new ActionStep('email', emailHandler),
  new ActionStep('sms', smsHandler),
  new ActionStep('push', pushHandler)
]);
```

#### Pattern 3: Conditional Retry

```typescript
// Retry with custom policy
const criticalStep = new ActionStep('critical-action', handler);
criticalStep.retryPolicy = {
  maxAttempts: 5,
  delayMs: 2000
};
```

---

## 7. State Management Strategy

### StateManager Interface

```typescript
interface IStateManager {
  /**
   * Create new workflow execution record
   */
  createExecution(
    params: {
      workflowId: string;
      workflowVersion: string;
      context: WorkflowContext;
      status: ExecutionStatus;
      startedAt: Date;
    }
  ): Promise<WorkflowExecution>;
  
  /**
   * Get workflow execution by ID
   */
  getExecution(executionId: string): Promise<WorkflowExecution>;
  
  /**
   * Update step execution record
   */
  updateStepExecution(
    executionId: string,
    stepData: {
      stepName: string;
      status: StepStatus;
      output?: any;
      error?: string;
      completedAt?: Date;
    }
  ): Promise<void>;
  
  /**
   * Complete workflow execution
   */
  completeExecution(
    executionId: string,
    result: WorkflowExecutionResult
  ): Promise<void>;
  
  /**
   * Fail workflow execution
   */
  failExecution(
    executionId: string,
    error: Error
  ): Promise<void>;
  
  /**
   * Pause workflow execution
   */
  pauseExecution(executionId: string): Promise<void>;
  
  /**
   * Cancel workflow execution
   */
  cancelExecution(executionId: string, reason: string): Promise<void>;
}
```

### Database Schema

```sql
-- Workflow executions table
CREATE TABLE workflow_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  workflow_id TEXT NOT NULL,
  workflow_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'paused', 'cancelled')),
  context_data JSONB NOT NULL,
  current_step_index INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Workflow step executions table
CREATE TABLE workflow_step_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  step_name TEXT NOT NULL,
  step_index INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_workflow_executions_tenant ON workflow_executions(tenant_id);
CREATE INDEX idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX idx_workflow_executions_workflow ON workflow_executions(workflow_id);
CREATE INDEX idx_workflow_step_executions_workflow ON workflow_step_executions(workflow_execution_id);
```

### State Persistence Flow

```
┌─────────────────────────────────────────────────────────────┐
│            Workflow Execution State Flow                     │
└─────────────────────────────────────────────────────────────┘

1. START
   └─> INSERT workflow_executions (status = 'running')

2. FOR EACH STEP
   ├─> INSERT workflow_step_executions (status = 'pending')
   ├─> UPDATE workflow_step_executions (status = 'running')
   ├─> Execute step logic
   └─> UPDATE workflow_step_executions (status = 'completed', output_data)

3. UPDATE CONTEXT
   └─> UPDATE workflow_executions (context_data, current_step_index)

4. END
   └─> UPDATE workflow_executions (status = 'completed', completed_at)
```


---

## 8. Decision Integration Patterns

### Pattern 1: Simple Decision Step

```typescript
// Direct decision delegation
const autoApprovalStep = new DecisionStep(
  'check-auto-approval',
  decisionEngine,
  {
    decisionType: 'auto-approval',
    ruleType: 'if-then',
    rule: { /* rule definition */ },
    outputKey: 'approvalResult'
  }
);

// Output: context.data.approvalResult = { approved: true/false, reason: '...' }
```

### Pattern 2: Decision + Conditional Branch

```typescript
const steps = [
  // Step 1: Make decision
  new DecisionStep('evaluate-kpi', decisionEngine, {
    decisionType: 'kpi-eligibility',
    ruleType: 'if-then',
    rule: { /* KPI rules */ },
    outputKey: 'kpiResult'
  }),
  
  // Step 2: Branch based on decision
  new ConditionStep(
    'kpi-branch',
    (ctx) => ctx.data.kpiResult.outcome === 'APPROVE',
    'apply-kpi-bonus',
    'send-ineligibility-notice'
  ),
  
  // Branch A: Approved
  new ActionStep('apply-kpi-bonus', async (ctx) => {
    await payrollService.applyBonus(ctx.data.kpiResult.bonusAmount);
    return { bonusApplied: true };
  }),
  
  // Branch B: Rejected
  new ActionStep('send-ineligibility-notice', async (ctx) => {
    await notificationService.send(ctx.data.kpiResult.reason);
    return { notificationSent: true };
  })
];
```

### Pattern 3: Multiple Decisions in Sequence

```typescript
const steps = [
  // Decision 1: Discount eligibility
  new DecisionStep('check-discount', decisionEngine, {
    decisionType: 'discount-eligibility',
    ruleType: 'if-then',
    rule: { /* discount rules */ },
    outputKey: 'discountResult'
  }),
  
  // Decision 2: Inventory availability
  new DecisionStep('check-inventory', decisionEngine, {
    decisionType: 'inventory-allocation',
    ruleType: 'if-then',
    rule: { /* inventory rules */ },
    outputKey: 'inventoryResult'
  }),
  
  // Action: Process booking with both results
  new ActionStep('process-booking', async (ctx) => {
    return await bookingService.create({
      ...ctx.data.booking,
      discount: ctx.data.discountResult.discountAmount,
      inventoryReserved: ctx.data.inventoryResult.reserved
    });
  })
];
```

### Pattern 4: Decision with Parallel Actions

```typescript
const steps = [
  // Decision
  new DecisionStep('approve-leave', decisionEngine, { /* config */ }),
  
  // Parallel actions based on decision
  new ParallelStep('post-approval-actions', [
    new ActionStep('update-attendance', attendanceHandler),
    new ActionStep('notify-manager', managerNotificationHandler),
    new ActionStep('update-calendar', calendarHandler)
  ])
];
```

### Event Subscription Pattern

```typescript
// Workflow Engine subscribes to Decision Engine events
eventPublisher.subscribe('decision.evaluated', async (event) => {
  const { tenantId, correlationId, result } = event.data;
  
  // Find workflow execution with matching correlationId
  const execution = await stateManager.findByCorrelationId(correlationId);
  
  if (execution && execution.status === 'paused') {
    // Resume workflow with decision result
    await workflowEngine.resume(execution.id);
  }
});
```

---

## 9. Event-Driven Architecture

### Workflow Lifecycle Events

```typescript
// Event types emitted by Workflow Engine
type WorkflowEventType =
  | 'workflow.started'
  | 'workflow.step.started'
  | 'workflow.step.completed'
  | 'workflow.step.failed'
  | 'workflow.step.retrying'
  | 'workflow.paused'
  | 'workflow.resumed'
  | 'workflow.completed'
  | 'workflow.failed'
  | 'workflow.cancelled';
```

### Event Structure

```typescript
interface WorkflowEvent extends DomainEvent {
  type: WorkflowEventType;
  data: {
    executionId: string;
    workflowId: string;
    workflowVersion: string;
    tenantId: string;
    correlationId: string;
    
    // Step-specific
    stepName?: string;
    stepIndex?: number;
    stepResult?: StepExecutionResult;
    
    // Completion data
    result?: WorkflowExecutionResult;
    error?: string;
  };
}
```

### Event Subscribers

```typescript
// Example: Audit logger
eventPublisher.subscribe('workflow.*', async (event: WorkflowEvent) => {
  await auditService.log({
    eventType: event.type,
    executionId: event.data.executionId,
    tenantId: event.data.tenantId,
    timestamp: event.timestamp,
    data: event.data
  });
});

// Example: Metrics collector
eventPublisher.subscribe('workflow.step.completed', async (event) => {
  metrics.recordStepExecution({
    workflowId: event.data.workflowId,
    stepName: event.data.stepName,
    executionTime: event.data.stepResult.executionTime,
    status: 'success'
  });
});

// Example: Error alerting
eventPublisher.subscribe('workflow.failed', async (event) => {
  await alertService.send({
    severity: 'error',
    message: `Workflow failed: ${event.data.workflowId}`,
    details: event.data.error
  });
});
```

---

## 10. Error Handling & Retry Strategy

### Error Handling Levels

```
Level 1: Step-Level Retry
   ↓ (if max retries exceeded)
Level 2: Step Failure with continueOnError
   ↓ (if continueOnError = false)
Level 3: Workflow Failure
   ↓
Level 4: Compensation/Rollback
```

### Retry Policy Configuration

```typescript
interface RetryPolicy {
  /** Maximum retry attempts */
  maxAttempts: number;
  
  /** Initial delay in milliseconds */
  delayMs: number;
  
  /** Backoff strategy */
  backoff?: 'linear' | 'exponential';
  
  /** Maximum delay cap (for exponential backoff) */
  maxDelayMs?: number;
  
  /** Retry only on specific error types */
  retryOn?: (error: Error) => boolean;
}

// Example: Exponential backoff
const retryPolicy: RetryPolicy = {
  maxAttempts: 5,
  delayMs: 1000,
  backoff: 'exponential', // 1s, 2s, 4s, 8s, 16s
  maxDelayMs: 30000, // Cap at 30s
  retryOn: (error) => error instanceof NetworkError
};
```

### Compensation Pattern

```typescript
interface IStep {
  // ... existing properties
  
  /** Compensation logic (rollback) */
  compensate?: (context: WorkflowContext) => Promise<void>;
}

// Example: Inventory reservation with compensation
const reserveInventoryStep = new ActionStep(
  'reserve-inventory',
  async (ctx) => {
    const reservation = await inventoryService.reserve(ctx.data.productIds);
    return { reservationId: reservation.id };
  }
);

reserveInventoryStep.compensate = async (ctx) => {
  // Rollback: Release reservation
  await inventoryService.releaseReservation(ctx.data.reservationId);
};

// Workflow Engine automatically calls compensate() on workflow failure
```


---

## 11. Observability & Audit Trail

### Metrics

```typescript
// Workflow Engine metrics
interface WorkflowMetrics {
  // Execution metrics
  totalExecutions: number;
  activeExecutions: number;
  completedExecutions: number;
  failedExecutions: number;
  
  // Performance metrics
  avgExecutionTime: number;
  p50ExecutionTime: number;
  p95ExecutionTime: number;
  p99ExecutionTime: number;
  
  // Step metrics
  totalSteps: number;
  avgStepsPerWorkflow: number;
  stepSuccessRate: number;
  
  // Error metrics
  totalErrors: number;
  totalRetries: number;
  errorRate: number;
}
```

### Logging

```typescript
// Structured logging for workflow events
logger.info('Workflow started', {
  executionId,
  workflowId,
  tenantId,
  userId,
  correlationId
});

logger.info('Step executing', {
  executionId,
  stepName,
  stepIndex,
  stepType
});

logger.info('Step completed', {
  executionId,
  stepName,
  status: 'completed',
  executionTime,
  output: stepResult.output
});

logger.error('Step failed', {
  executionId,
  stepName,
  error: error.message,
  stack: error.stack,
  retryCount
});
```

### Audit Trail

```sql
-- Audit query: Get full workflow execution history
SELECT
  we.id AS execution_id,
  we.workflow_id,
  we.status AS workflow_status,
  we.started_at AS workflow_started_at,
  we.completed_at AS workflow_completed_at,
  wse.step_name,
  wse.status AS step_status,
  wse.input_data,
  wse.output_data,
  wse.error_message,
  wse.retry_count,
  wse.execution_time_ms,
  wse.started_at AS step_started_at,
  wse.completed_at AS step_completed_at
FROM workflow_executions we
LEFT JOIN workflow_step_executions wse ON wse.workflow_execution_id = we.id
WHERE we.tenant_id = $1
  AND we.created_at >= $2
  AND we.created_at < $3
ORDER BY we.created_at DESC, wse.step_index ASC;
```

---

## 12. Sample Workflows (3 Real-World Examples)

### Example 1: Booking-to-Fulfillment Workflow

**Business Process**:
1. Customer creates booking
2. Check auto-approval eligibility (Decision Engine)
3. If approved → Reserve inventory, Assign KTV, Send confirmation
4. If rejected → Send pending approval notice

**Workflow Definition**:
```typescript
const bookingWorkflow: WorkflowDefinition = {
  id: 'booking-to-fulfillment-v1',
  version: '1.0.0',
  name: 'Booking to Fulfillment',
  
  steps: [
    new DecisionStep('check-auto-approval', decisionEngine, {
      decisionType: 'auto-approval',
      ruleType: 'if-then',
      rule: {
        condition: {
          and: [
            { field: 'totalAmount', operator: '<', value: 5000000 },
            { field: 'customer.tier', operator: '===', value: 'VIP' }
          ]
        },
        action: { approved: true }
      },
      outputKey: 'approvalResult'
    }),
    
    new ConditionStep(
      'approval-branch',
      (ctx) => ctx.data.approvalResult.approved,
      'reserve-inventory',
      'notify-pending'
    ),
    
    new ActionStep('reserve-inventory', async (ctx) => {
      return await inventoryService.reserve(ctx.data.booking.productIds);
    }),
    
    new ActionStep('assign-ktv', async (ctx) => {
      return await ktvService.autoAssign(ctx.data.booking);
    }),
    
    new ParallelStep('send-confirmations', [
      new ActionStep('email-customer', emailCustomerHandler),
      new ActionStep('sms-ktv', smsKTVHandler)
    ])
  ]
};
```

**Execution**:
```typescript
const result = await workflowEngine.execute(bookingWorkflow, {
  tenantId: 'bella-spa-vietnam',
  userId: 'customer-123',
  data: {
    booking: {
      id: 'booking-456',
      customerId: 'customer-123',
      totalAmount: 3500000,
      productIds: ['prod-1', 'prod-2'],
      sessionDate: '2026-07-15'
    },
    customer: {
      tier: 'VIP',
      email: 'customer@example.com'
    }
  }
});
```


---

### Example 2: Payroll Approval Workflow

**Business Process**:
1. Calculate salary (Decision Engine: KPI, deductions, bonuses)
2. Manager approval (human step - pause workflow)
3. Finance review (human step - pause workflow)
4. Publish salary record
5. Generate accounting expense entry

**Workflow Definition**:
```typescript
const payrollApprovalWorkflow: WorkflowDefinition = {
  id: 'payroll-approval-v1',
  version: '1.0.0',
  name: 'Payroll Approval Flow',
  
  steps: [
    // Step 1: Calculate salary components via Decision Engine
    new ParallelStep('calculate-salary-components', [
      new DecisionStep('calculate-kpi', decisionEngine, {
        decisionType: 'kpi-eligibility',
        ruleType: 'if-then',
        rule: { /* KPI rules */ },
        outputKey: 'kpiResult'
      }),
      
      new DecisionStep('calculate-deductions', decisionEngine, {
        decisionType: 'attendance-deduction',
        ruleType: 'if-then',
        rule: { /* deduction rules */ },
        outputKey: 'deductionResult'
      }),
      
      new DecisionStep('calculate-commission', decisionEngine, {
        decisionType: 'commission-calculation',
        ruleType: 'if-then',
        rule: { /* commission rules */ },
        outputKey: 'commissionResult'
      })
    ]),
    
    // Step 2: Aggregate salary
    new ActionStep('aggregate-salary', async (ctx) => {
      const totalSalary =
        ctx.data.baseSalary +
        ctx.data.kpiResult.bonusAmount +
        ctx.data.commissionResult.amount -
        ctx.data.deductionResult.deductionAmount;
      
      return { totalSalary };
    }),
    
    // Step 3: Manager approval (pause workflow)
    new ActionStep('request-manager-approval', async (ctx) => {
      await approvalService.requestApproval({
        executionId: ctx.executionId,
        approverId: ctx.data.managerId,
        data: { totalSalary: ctx.data.totalSalary }
      });
      
      return {
        _control: { pause: true }
      };
    }),
    
    // Step 4: Finance review (resume after manager approval)
    new ActionStep('request-finance-review', async (ctx) => {
      await approvalService.requestApproval({
        executionId: ctx.executionId,
        approverId: ctx.data.financeManagerId,
        data: { totalSalary: ctx.data.totalSalary }
      });
      
      return {
        _control: { pause: true }
      };
    }),
    
    // Step 5: Publish salary record
    new ActionStep('publish-salary', async (ctx) => {
      return await payrollService.publish({
        employeeId: ctx.data.employeeId,
        month: ctx.data.month,
        totalSalary: ctx.data.totalSalary,
        status: 'published'
      });
    }),
    
    // Step 6: Generate expense entry
    new ActionStep('create-expense', async (ctx) => {
      return await accountingService.createExpense({
        type: 'salary',
        amount: ctx.data.totalSalary,
        employeeId: ctx.data.employeeId,
        month: ctx.data.month
      });
    })
  ]
};
```

**Execution Flow**:
```typescript
// Initial execution
const result = await workflowEngine.execute(payrollApprovalWorkflow, {
  tenantId: 'bella-spa-vietnam',
  userId: 'hr-manager-123',
  data: {
    employeeId: 'ktv-456',
    month: '2026-06',
    baseSalary: 8000000,
    managerId: 'manager-789',
    financeManagerId: 'finance-012'
  }
});

// Workflow pauses at manager approval step
// Manager approves via UI → triggers resume

// Later: Manager approves
await workflowEngine.resume(result.executionId);

// Workflow pauses again at finance review step
// Finance manager approves via UI → triggers resume

// Later: Finance approves
await workflowEngine.resume(result.executionId);

// Workflow completes: salary published + expense created
```


---

### Example 3: Inventory Reorder Workflow

**Business Process**:
1. Check current stock levels
2. Evaluate reorder decision (Decision Engine: demand forecast, lead time, safety stock)
3. If reorder needed → Create purchase order, Notify supplier, Update expected inventory
4. Track delivery, Update actual inventory

**Workflow Definition**:
```typescript
const inventoryReorderWorkflow: WorkflowDefinition = {
  id: 'inventory-reorder-v1',
  version: '1.0.0',
  name: 'Inventory Reorder Workflow',
  
  steps: [
    // Step 1: Fetch current inventory
    new ActionStep('fetch-inventory', async (ctx) => {
      const inventory = await inventoryService.getByProduct(ctx.data.productId);
      return { currentStock: inventory.quantity };
    }),
    
    // Step 2: Evaluate reorder decision (Decision Engine)
    new DecisionStep('evaluate-reorder', decisionEngine, {
      decisionType: 'inventory-reorder',
      ruleType: 'if-then',
      rule: {
        condition: {
          and: [
            { field: 'currentStock', operator: '<', value: 50 },
            { field: 'demandForecast', operator: '>', value: 100 }
          ]
        },
        action: {
          reorder: true,
          quantity: { formula: 'demandForecast * 1.2 - currentStock' }
        }
      },
      outputKey: 'reorderDecision'
    }),
    
    // Step 3: Conditional branch
    new ConditionStep(
      'reorder-branch',
      (ctx) => ctx.data.reorderDecision.reorder === true,
      'create-purchase-order',
      'skip-reorder'
    ),
    
    // Step 4: Create purchase order
    new ActionStep('create-purchase-order', async (ctx) => {
      const po = await purchaseOrderService.create({
        productId: ctx.data.productId,
        quantity: ctx.data.reorderDecision.quantity,
        supplierId: ctx.data.supplierId
      });
      
      return { purchaseOrderId: po.id };
    }),
    
    // Step 5: Notify supplier
    new ActionStep('notify-supplier', async (ctx) => {
      await notificationService.sendEmail({
        to: ctx.data.supplierEmail,
        template: 'purchase-order-created',
        data: { poId: ctx.data.purchaseOrderId }
      });
      
      return { supplierNotified: true };
    }),
    
    // Step 6: Update expected inventory
    new ActionStep('update-expected-inventory', async (ctx) => {
      await inventoryService.updateExpectedStock({
        productId: ctx.data.productId,
        expectedQuantity: ctx.data.reorderDecision.quantity,
        expectedDate: ctx.data.expectedDeliveryDate
      });
      
      return { inventoryUpdated: true };
    }),
    
    // Step 7: Audit log
    new ActionStep('audit-reorder', async (ctx) => {
      await auditService.log({
        action: 'inventory-reorder',
        productId: ctx.data.productId,
        quantity: ctx.data.reorderDecision.quantity,
        reason: ctx.data.reorderDecision.explanation
      });
      
      return { auditLogged: true };
    })
  ],
  
  defaultRetryPolicy: {
    maxAttempts: 3,
    delayMs: 2000
  }
};
```

**Execution**:
```typescript
const result = await workflowEngine.execute(inventoryReorderWorkflow, {
  tenantId: 'bella-spa-vietnam',
  userId: 'inventory-manager-123',
  data: {
    productId: 'prod-001',
    supplierId: 'supplier-456',
    supplierEmail: 'supplier@example.com',
    demandForecast: 150,
    expectedDeliveryDate: '2026-07-20'
  }
});

// Workflow completes: PO created, supplier notified, inventory updated
```

---

## 13. Comparison: Workflow vs Decision Engine

| Aspect | Decision Engine | Workflow Engine |
|--------|-----------------|-----------------|
| **Purpose** | Make single decisions | Orchestrate multi-step processes |
| **State** | Stateless (pure functions) | Stateful (execution state) |
| **Duration** | Milliseconds | Minutes to days |
| **Complexity** | Simple (one rule evaluation) | Complex (multiple steps, branching) |
| **Retry** | No (caller handles) | Yes (built-in retry/compensation) |
| **Auditability** | Decision-level | Step-level + workflow-level |
| **Human Interaction** | No | Yes (pause/resume for approvals) |
| **Scalability** | Horizontal (stateless) | Vertical + Horizontal (requires state sync) |
| **Database Access** | No (via adapters only) | No (via StateManager only) |
| **Examples** | Auto-approval, Eligibility, Discount | Booking-to-fulfillment, Payroll approval |

### When to Use Decision Engine

✅ **Use Decision Engine when**:
- Single decision point (approve/reject/escalate)
- Pure business logic (no side effects)
- Sub-50ms latency requirement
- Horizontally scalable (no state)
- No human interaction needed

**Examples**:
- Auto-approval for bookings <5M VND
- KPI eligibility (26+ sessions, 4.5+ rating)
- Discount calculation (membership tier, campaign rules)
- Inventory allocation (stock available, priority rules)

### When to Use Workflow Engine

✅ **Use Workflow Engine when**:
- Multi-step process (A → B → C)
- Requires state management (context between steps)
- Conditional branching (if X → Path Y)
- Human-in-the-loop (approvals, reviews)
- Retry/rollback needed (resilience)
- Long-running (>1 minute)

**Examples**:
- Booking-to-fulfillment (create → approve → reserve → assign → notify)
- Payroll approval flow (calculate → manager approval → finance review → publish)
- Inventory reorder (check → decide → create PO → notify supplier)
- Customer onboarding (register → KYC → account → welcome)

### Integration Pattern

```
Workflow Engine USES Decision Engine (not replace)

┌─────────────────────────────────────────────────────────────┐
│                     Workflow Engine                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Step 1: ActionStep (fetch data)                      │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Step 2: DecisionStep (call Decision Engine)          │  │ ← Uses Decision Engine
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Step 3: ConditionStep (branch based on decision)     │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Step 4: ActionStep (execute business logic)          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Key insight**: Workflow Engine orchestrates; Decision Engine evaluates. They complement each other.


---

## 14. Out of Scope

### What Workflow Engine Does NOT Support (Phase 1)

❌ **Visual Workflow Builder UI** (drag-and-drop interface)
- Reason: Code-first approach in Phase 1
- Future: Phase 2 may add UI builder

❌ **BPMN Compliance** (full Business Process Model and Notation)
- Reason: Too complex for current needs
- Alternative: Simplified DSL optimized for Bella ERP

❌ **Human Task Management System** (full-featured approval UI)
- Reason: Out of scope for Workflow Engine
- Alternative: Pause/resume API + external approval service

❌ **Distributed Transactions** (2PC, Saga orchestration)
- Reason: Adds complexity without clear need
- Alternative: Compensation pattern (rollback on failure)

❌ **Workflow Versioning & Migration** (automatic migration between versions)
- Reason: Manual migration sufficient for Phase 1
- Future: Phase 3 may add automatic migration

❌ **Real-Time Progress Streaming** (WebSocket updates)
- Reason: Event-driven approach sufficient
- Alternative: Poll execution status via API

❌ **Multi-Tenancy Isolation** (tenant-level workflow definitions)
- Reason: All workflows are tenant-agnostic in Phase 1
- Future: Phase 2 may add tenant-specific workflows

❌ **Workflow Marketplace** (import/export workflow templates)
- Reason: Not needed until multiple deployments
- Future: Phase 4 may add marketplace

---

## 15. Migration Path & Rollout Plan

### Phase 1: Core Implementation (Week 1-2)

**Deliverables**:
- ✅ WorkflowEngine core (~600 lines)
- ✅ WorkflowExecutor (~400 lines)
- ✅ IStep interface + 4 step types (~400 lines)
- ✅ StateManager + DB schema (~300 lines)
- ✅ Event integration (~200 lines)
- ✅ 30+ comprehensive tests
- ✅ This architecture document (~500 lines)

**Total**: ~2,400 lines of code + tests + docs

**Timeline**: 5-7 days

### Phase 2: Sample Workflows (Week 3)

**Deliverables**:
- ✅ Booking-to-fulfillment workflow (~150 lines)
- ✅ Payroll approval workflow (~200 lines)
- ✅ Inventory reorder workflow (~150 lines)
- ✅ Integration tests for all 3 workflows
- ✅ Production deployment guide

**Timeline**: 3-4 days

### Phase 3: Production Rollout (Week 4)

**Strategy**:
1. **Week 4.1**: Deploy to staging, monitor for 3 days
2. **Week 4.2**: Pilot with 1 workflow (Booking-to-fulfillment)
3. **Week 4.3**: Monitor metrics, fix issues
4. **Week 4.4**: Roll out to 10% tenants
5. **Week 4.5**: Full rollout to 100%

**Success Criteria**:
- ✅ Zero workflow execution failures
- ✅ <1s avg workflow execution time (for simple workflows)
- ✅ 100% event delivery rate
- ✅ Complete audit trail for all executions

### Migration from Hardcoded Orchestration

**Before** (Hardcoded):
```typescript
// ❌ Business module with hardcoded orchestration
async function processBooking(booking: Booking) {
  // Step 1
  const approvalResult = await checkAutoApproval(booking);
  
  // Step 2
  if (approvalResult.approved) {
    const reservation = await inventoryService.reserve(booking.productIds);
    const assignment = await ktvService.autoAssign(booking);
    
    await Promise.all([
      emailService.sendConfirmation(booking.customerEmail),
      smsService.notifyKTV(assignment.ktvId)
    ]);
    
    await bookingService.finalize(booking.id);
  } else {
    await emailService.sendPendingNotice(booking.customerEmail);
  }
}
```

**After** (Workflow Engine):
```typescript
// ✅ Business module delegates to Workflow Engine
async function processBooking(booking: Booking) {
  const result = await workflowEngine.execute(bookingToFulfillmentWorkflow, {
    tenantId: booking.tenantId,
    userId: booking.customerId,
    data: { booking }
  });
  
  return result;
}
```

**Benefits**:
- ✅ Declarative workflow definition (easier to understand)
- ✅ Automatic retry logic (resilience)
- ✅ Event-driven observability (monitoring)
- ✅ Complete audit trail (compliance)
- ✅ Reusable across modules (no duplication)

### Rollback Plan

If Workflow Engine causes issues in production:

1. **Immediate**: Feature flag OFF (`FEATURE_WORKFLOW_ENGINE=false`)
2. **Revert**: Business modules use hardcoded orchestration
3. **Debug**: Analyze logs, metrics, audit trail
4. **Fix**: Address root cause
5. **Redeploy**: Enable feature flag, monitor closely

**Rollback Time**: <5 minutes (feature flag toggle)

---

## 🏁 Conclusion

### Summary

Workflow Engine is the **orchestration layer** for Bella ERP's multi-step business processes. It:
- ✅ **Complements** Decision Engine (uses decisions, doesn't replace them)
- ✅ **Stateful** (unlike Decision Engine's stateless design)
- ✅ **Event-driven** (publishes workflow lifecycle events)
- ✅ **Resilient** (built-in retry, compensation, rollback)
- ✅ **Auditable** (complete execution trace)
- ✅ **Extensible** (add step types without core changes)

### Architecture Principles

The 8 Workflow Engine Principles ensure:
1. Domain independence (works for any industry)
2. Step-based modularity (reusable building blocks)
3. State persistence (survive crashes/restarts)
4. Decision Engine integration (delegate, don't duplicate)
5. Event-driven observability (complete visibility)
6. Error resilience (retry + compensation)
7. Database abstraction (via StateManager only)
8. Auditability (compliance-ready)

### Next Steps

**Task #2**: Implement Workflow Engine Core (~600 lines)
**Task #3**: Implement Decision Integration Layer (~300 lines)
**Task #4**: Implement Sample Workflows (3 workflows, ~500 lines)
**Task #5**: Write Comprehensive Tests (30+ tests)
**Task #6**: Create Documentation (API reference, integration guide)

**Total Effort**: 5-7 days for Phase 1 completion

---

**Document Status**: ✅ **COMPLETE** (Architecture design finished)  
**Next Milestone**: Begin Task #2 - Implement Workflow Engine Core  
**Estimated Start**: 2026-07-09

