# Workflow Engine User Guide

**Version**: 1.0.0  
**Last Updated**: 2026-07-09  
**Audience**: Backend Developers, DevOps Engineers  
**Prerequisites**: [Decision Engine Platform Architecture](./DECISION_ENGINE_PLATFORM_ARCHITECTURE.md)

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Core Concepts](#2-core-concepts)
3. [Step Types Reference](#3-step-types-reference)
4. [Building Your First Workflow](#4-building-your-first-workflow)
5. [Decision Engine Integration](#5-decision-engine-integration)
6. [State Management & Persistence](#6-state-management--persistence)
7. [Error Handling & Retry](#7-error-handling--retry)
8. [Pause & Resume (Human Approvals)](#8-pause--resume-human-approvals)
9. [Event-Driven Integration](#9-event-driven-integration)
10. [Best Practices](#10-best-practices)
11. [Troubleshooting](#11-troubleshooting)
12. [Migration Guide](#12-migration-guide)

---

## 1. Quick Start

### Installation

Workflow Engine is built-in to Bella ERP. No installation needed.

### Minimal Example

```typescript
import {
  WorkflowEngine,
  WorkflowExecutor,
  InMemoryStateManager,
  ActionStep,
  createWorkflowContext
} from '@/lib/workflow-engine';
import { eventPublisher } from '@/lib/events';

// 1. Create state manager
const stateManager = new InMemoryStateManager();

// 2. Create executor
const executor = new WorkflowExecutor(stateManager, eventPublisher);

// 3. Create engine
const workflowEngine = new WorkflowEngine(executor, stateManager, eventPublisher);

// 4. Define workflow
const myWorkflow = {
  id: 'hello-world-v1',
  version: '1.0.0',
  name: 'Hello World Workflow',
  steps: [
    new ActionStep('say-hello', async (ctx) => {
      console.log('Hello from workflow!');
      return { greeting: 'Hello World' };
    })
  ]
};

// 5. Execute workflow
const result = await workflowEngine.execute(myWorkflow, {
  tenantId: 'test-tenant',
  data: {}
});

console.log(result.output); // { greeting: 'Hello World' }
```


---

## 2. Core Concepts

### What is Workflow Engine?

Workflow Engine là **stateful orchestrator** cho multi-step business processes. Nó:
- ✅ Orchestrates multiple steps sequentially or in parallel
- ✅ Manages execution state (survives crashes/restarts)
- ✅ Integrates with Decision Engine for decision-making
- ✅ Supports human-in-the-loop approvals (pause/resume)
- ✅ Provides retry, rollback, and compensation
- ✅ Emits events for observability

### Workflow vs Decision Engine

| Aspect | Decision Engine | Workflow Engine |
|--------|-----------------|-----------------|
| **Purpose** | Make single decisions | Orchestrate multi-step processes |
| **State** | Stateless | Stateful |
| **Duration** | Milliseconds | Minutes to days |
| **Use Case** | Auto-approval, eligibility | Booking flow, payroll approval |

**Key Insight**: Workflow Engine **USES** Decision Engine (not replaces). A workflow can have multiple decision steps.

### Key Components

```
WorkflowEngine
    ↓
WorkflowExecutor (step-by-step runner)
    ↓
IStep (DecisionStep, ActionStep, ConditionStep, ParallelStep)
    ↓
StateManager (persistence)
```

### Workflow Lifecycle

```
1. PENDING   → Workflow created, not started yet
2. RUNNING   → Workflow executing steps
3. PAUSED    → Workflow waiting for external event (e.g., approval)
4. COMPLETED → All steps completed successfully
5. FAILED    → Workflow failed due to error
6. CANCELLED → Workflow cancelled by user
```

---

## 3. Step Types Reference

### 3.1. DecisionStep

**Purpose**: Delegate decision-making to Decision Engine.

**When to use**:
- Auto-approval checks
- Eligibility evaluations
- Discount calculations
- Any decision that Decision Engine handles

**Example**:
```typescript
import { DecisionStep } from '@/lib/workflow-engine/steps';

const autoApprovalStep = new DecisionStep(
  'check-auto-approval',      // Step name
  decisionEngine,              // Decision Engine instance
  {
    decisionType: 'auto-approval',
    ruleType: 'if-then',
    rule: {
      condition: {
        and: [
          { field: 'amount', operator: '<', value: 5000000 },
          { field: 'tier', operator: '===', value: 'VIP' }
        ]
      },
      action: { approved: true }
    },
    outputKey: 'approvalResult'  // Where to store result in context
  },
  'Check if booking qualifies for auto-approval' // Description (optional)
);
```

**Output**: Result stored in `context.data[outputKey]`

**Compensation**: Not needed (pure evaluation, no side effects)


---

### 3.2. ActionStep

**Purpose**: Execute business logic or side-effect operations.

**When to use**:
- Send email/SMS/notification
- Update database
- Call external API
- Reserve inventory
- Any action with side effects

**Example**:
```typescript
import { ActionStep } from '@/lib/workflow-engine/steps';

const sendEmailStep = new ActionStep(
  'send-confirmation',
  async (context) => {
    // Access workflow data
    const { customerEmail, bookingId } = context.data;
    
    // Execute business logic
    await emailService.send({
      to: customerEmail,
      template: 'booking-confirmed',
      data: { bookingId }
    });
    
    // Return output (merged into context.data)
    return { emailSent: true, sentAt: new Date() };
  },
  'Send booking confirmation email', // Description (optional)
  {
    // Retry policy (optional)
    maxAttempts: 3,
    delayMs: 1000,
    backoff: 'exponential'
  },
  false, // continueOnError (optional)
  async (context) => {
    // Compensation handler (rollback) - optional
    console.log('Compensating: Cancel email', context.data.bookingId);
  }
);
```

**Compensation**: Use when action can be rolled back (e.g., cancel reservation, delete created record).

---

### 3.3. ConditionStep

**Purpose**: Conditional branching (if-then-else).

**When to use**:
- Branch based on decision result
- Different paths for approved/rejected
- Skip steps based on conditions

**Example**:
```typescript
import { ConditionStep } from '@/lib/workflow-engine/steps';

const approvalBranch = new ConditionStep(
  'check-approval-result',
  (context) => {
    // Evaluate condition
    return context.data.approvalResult?.approved === true;
  },
  'proceed-to-fulfillment',  // trueBranch: step name to jump to
  'send-rejection-email',    // falseBranch: step name to jump to
  'Branch based on approval result' // Description (optional)
);
```

**Important**: trueBranch and falseBranch must be valid step names in the workflow.

**Compensation**: Not needed (pure evaluation, no side effects)

---

### 3.4. ParallelStep

**Purpose**: Execute multiple steps concurrently.

**When to use**:
- Send email + SMS in parallel
- Multiple independent API calls
- Parallel data fetching

**Example**:
```typescript
import { ParallelStep, ActionStep } from '@/lib/workflow-engine/steps';

const notifyStep = new ParallelStep(
  'send-notifications',
  [
    new ActionStep('email', async (ctx) => {
      await emailService.send(ctx.data.email);
      return { emailSent: true };
    }),
    
    new ActionStep('sms', async (ctx) => {
      await smsService.send(ctx.data.phone);
      return { smsSent: true };
    }),
    
    new ActionStep('push', async (ctx) => {
      await pushService.send(ctx.data.userId);
      return { pushSent: true };
    })
  ],
  'allSettled', // Strategy: 'all', 'race', or 'allSettled'
  'Send notifications in parallel'
);
```

**Strategies**:
- `'all'`: Wait for all, throw if any fails (default: Promise.all)
- `'race'`: Return as soon as one completes (Promise.race)
- `'allSettled'`: Wait for all, don't throw on errors (Promise.allSettled)

**Compensation**: Compensates sub-steps in reverse order.


---

## 4. Building Your First Workflow

### Step-by-Step Tutorial

Let's build a simple "Order Fulfillment" workflow:

**Business Process**:
1. Validate order
2. Check inventory
3. Reserve inventory
4. Send confirmation email
5. Mark order as confirmed

**Step 1: Define Steps**

```typescript
import {
  ActionStep,
  ConditionStep,
  WorkflowDefinition
} from '@/lib/workflow-engine';

// Step 1: Validate order
const validateOrderStep = new ActionStep(
  'validate-order',
  async (ctx) => {
    const order = ctx.data.order;
    
    if (!order.customerId || !order.items || order.items.length === 0) {
      throw new Error('Invalid order: missing required fields');
    }
    
    return { orderValid: true };
  },
  'Validate order has required fields'
);

// Step 2: Check inventory
const checkInventoryStep = new ActionStep(
  'check-inventory',
  async (ctx) => {
    const order = ctx.data.order;
    const available = await inventoryService.checkAvailability(order.items);
    
    return { inventoryAvailable: available };
  },
  'Check if all items are in stock'
);

// Step 3: Conditional branch
const inventoryBranch = new ConditionStep(
  'inventory-branch',
  (ctx) => ctx.data.inventoryAvailable === true,
  'reserve-inventory',
  'notify-out-of-stock'
);

// Step 4a: Reserve inventory
const reserveInventoryStep = new ActionStep(
  'reserve-inventory',
  async (ctx) => {
    const order = ctx.data.order;
    const reservation = await inventoryService.reserve(order.items);
    
    return { reservationId: reservation.id };
  },
  'Reserve inventory for order',
  { maxAttempts: 3, delayMs: 1000 },
  false,
  async (ctx) => {
    // Compensation: Release reservation
    await inventoryService.releaseReservation(ctx.data.reservationId);
  }
);

// Step 5a: Send confirmation
const sendConfirmationStep = new ActionStep(
  'send-confirmation',
  async (ctx) => {
    const order = ctx.data.order;
    
    await emailService.send({
      to: order.customerEmail,
      template: 'order-confirmed',
      data: { orderId: order.id }
    });
    
    return { confirmationSent: true };
  },
  'Send order confirmation email'
);

// Step 6a: Mark as confirmed
const markConfirmedStep = new ActionStep(
  'mark-confirmed',
  async (ctx) => {
    const order = ctx.data.order;
    
    await orderService.updateStatus(order.id, 'confirmed');
    
    return { orderConfirmed: true };
  },
  'Mark order as confirmed'
);

// Step 4b: Notify out of stock (alternative branch)
const notifyOutOfStockStep = new ActionStep(
  'notify-out-of-stock',
  async (ctx) => {
    const order = ctx.data.order;
    
    await emailService.send({
      to: order.customerEmail,
      template: 'order-out-of-stock',
      data: { orderId: order.id }
    });
    
    return {
      outOfStockNotified: true,
      _control: { skipRemaining: true } // Skip remaining steps
    };
  },
  'Notify customer that items are out of stock'
);
```

**Step 2: Define Workflow**

```typescript
const orderFulfillmentWorkflow: WorkflowDefinition = {
  id: 'order-fulfillment-v1',
  version: '1.0.0',
  name: 'Order Fulfillment Workflow',
  description: 'Validate order, check inventory, reserve, and send confirmation',
  
  steps: [
    validateOrderStep,
    checkInventoryStep,
    inventoryBranch,
    reserveInventoryStep,
    sendConfirmationStep,
    markConfirmedStep,
    notifyOutOfStockStep
  ],
  
  defaultRetryPolicy: {
    maxAttempts: 3,
    delayMs: 1000
  },
  
  timeout: 60000 // 1 minute
};
```

**Step 3: Execute Workflow**

```typescript
import { WorkflowEngine, WorkflowExecutor, InMemoryStateManager } from '@/lib/workflow-engine';
import { eventPublisher } from '@/lib/events';

// Setup engine
const stateManager = new InMemoryStateManager();
const executor = new WorkflowExecutor(stateManager, eventPublisher);
const workflowEngine = new WorkflowEngine(executor, stateManager, eventPublisher);

// Execute
const result = await workflowEngine.execute(orderFulfillmentWorkflow, {
  tenantId: 'bella-spa-vietnam',
  userId: 'customer-123',
  data: {
    order: {
      id: 'order-456',
      customerId: 'customer-123',
      customerEmail: 'customer@example.com',
      items: [
        { productId: 'prod-1', quantity: 2 },
        { productId: 'prod-2', quantity: 1 }
      ]
    }
  }
});

if (result.status === 'completed') {
  console.log('Order fulfilled successfully!', result.output);
} else {
  console.error('Order fulfillment failed:', result.error);
}
```


---

## 5. Decision Engine Integration

### Pattern 1: Simple Decision

```typescript
import { DecisionStep } from '@/lib/workflow-engine/steps';

const eligibilityStep = new DecisionStep(
  'check-eligibility',
  decisionEngine,
  {
    decisionType: 'kpi-eligibility',
    ruleType: 'if-then',
    rule: {
      condition: {
        and: [
          { field: 'totalSessions', operator: '>=', value: 26 },
          { field: 'avgRating', operator: '>=', value: 4.5 }
        ]
      },
      action: { bonusAmount: 3000000 }
    },
    outputKey: 'eligibilityResult'
  }
);

// Access result in next step:
const applyBonusStep = new ActionStep('apply-bonus', async (ctx) => {
  const result = ctx.data.eligibilityResult;
  
  if (result.outcome === 'APPROVE') {
    await payrollService.applyBonus(result.bonusAmount);
  }
  
  return { bonusApplied: true };
});
```

### Pattern 2: Decision + Conditional Branch

```typescript
const steps = [
  // Step 1: Make decision
  new DecisionStep('evaluate', decisionEngine, { /* config */ }),
  
  // Step 2: Branch based on decision
  new ConditionStep(
    'decision-branch',
    (ctx) => ctx.data.decisionResult.outcome === 'APPROVE',
    'approved-path',
    'rejected-path'
  ),
  
  // Approved path
  new ActionStep('approved-path', approvedHandler),
  
  // Rejected path
  new ActionStep('rejected-path', rejectedHandler)
];
```

### Pattern 3: Multiple Decisions in Parallel

```typescript
import { ParallelStep, DecisionStep } from '@/lib/workflow-engine/steps';

const calculateSalaryComponents = new ParallelStep(
  'calculate-components',
  [
    new DecisionStep('kpi', decisionEngine, {
      decisionType: 'kpi-eligibility',
      ruleType: 'if-then',
      rule: { /* KPI rules */ },
      outputKey: 'kpiResult'
    }),
    
    new DecisionStep('deductions', decisionEngine, {
      decisionType: 'attendance-deduction',
      ruleType: 'if-then',
      rule: { /* deduction rules */ },
      outputKey: 'deductionResult'
    }),
    
    new DecisionStep('commission', decisionEngine, {
      decisionType: 'commission-calculation',
      ruleType: 'if-then',
      rule: { /* commission rules */ },
      outputKey: 'commissionResult'
    })
  ],
  'all' // Wait for all decisions
);

// Aggregate results in next step
const aggregateStep = new ActionStep('aggregate', async (ctx) => {
  const totalSalary =
    ctx.data.baseSalary +
    ctx.data.kpiResult.bonusAmount +
    ctx.data.commissionResult.amount -
    ctx.data.deductionResult.deductionAmount;
  
  return { totalSalary };
});
```

### Pattern 4: Decision-Driven Workflow Selection

```typescript
// Use decision to determine entire workflow path
const workflowSelector = new DecisionStep(
  'select-workflow',
  decisionEngine,
  {
    decisionType: 'workflow-routing',
    ruleType: 'if-then',
    rule: {
      condition: { field: 'orderValue', operator: '>', value: 10000000 }
    },
    outputKey: 'routingDecision'
  }
);

const routingBranch = new ConditionStep(
  'route',
  (ctx) => ctx.data.routingDecision.outcome === 'APPROVE',
  'premium-workflow-start',
  'standard-workflow-start'
);
```

---

## 6. State Management & Persistence

### In-Memory State Manager (Testing)

```typescript
import { InMemoryStateManager } from '@/lib/workflow-engine';

const stateManager = new InMemoryStateManager();

// Test helper: Clear state
stateManager.clear();

// Test helper: Get all executions
const executions = stateManager.getAllExecutions();
```

⚠️ **Warning**: InMemoryStateManager is for testing only. State is lost on process restart.

### Database State Manager (Production)

```typescript
// TODO: Implement SupabaseStateManager for production
import { SupabaseStateManager } from '@/lib/workflow-engine/state-manager-supabase';

const stateManager = new SupabaseStateManager(supabaseClient);
```

**Database Schema**:

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
CREATE INDEX idx_workflow_step_executions_workflow ON workflow_step_executions(workflow_execution_id);
```

### Querying Workflow State

```typescript
// Get execution by ID
const execution = await stateManager.getExecution(executionId);

// Find by correlation ID
const execution = await stateManager.findByCorrelationId(correlationId);

// Check status
if (execution.status === 'paused') {
  console.log('Workflow is waiting for approval');
}

// Access context
const currentData = execution.context.data;
const completedSteps = execution.context.stepResults;
```

---

## 7. Error Handling & Retry

### Step-Level Retry

```typescript
const step = new ActionStep(
  'api-call',
  async (ctx) => {
    return await externalApi.call(ctx.data);
  },
  'Call external API',
  {
    maxAttempts: 5,           // Retry up to 5 times
    delayMs: 1000,            // Initial delay: 1 second
    backoff: 'exponential',   // 1s, 2s, 4s, 8s, 16s
    maxDelayMs: 30000         // Cap delay at 30 seconds
  }
);
```

### Workflow-Level Default Retry

```typescript
const workflow: WorkflowDefinition = {
  id: 'my-workflow',
  version: '1.0.0',
  name: 'My Workflow',
  steps: [ /* ... */ ],
  
  // Default retry for all steps (unless overridden)
  defaultRetryPolicy: {
    maxAttempts: 3,
    delayMs: 1000,
    backoff: 'exponential'
  }
};
```

### Continue on Error

```typescript
// Don't fail workflow if this step fails
const notificationStep = new ActionStep(
  'send-notification',
  notificationHandler,
  'Send notification (non-critical)',
  { maxAttempts: 2, delayMs: 1000 },
  true // continueOnError: true
);
```

### Compensation Pattern (Rollback)

```typescript
const reserveStep = new ActionStep(
  'reserve-inventory',
  async (ctx) => {
    const reservation = await inventoryService.reserve(ctx.data.items);
    return { reservationId: reservation.id };
  },
  'Reserve inventory',
  { maxAttempts: 3, delayMs: 1000 },
  false,
  // Compensation handler (rollback)
  async (ctx) => {
    if (ctx.data.reservationId) {
      await inventoryService.releaseReservation(ctx.data.reservationId);
      console.log('Compensated: Released reservation', ctx.data.reservationId);
    }
  }
);
```

**When does compensation run?**
- When workflow fails after step completes
- When user calls `workflowEngine.cancel(executionId, reason)`
- Compensation runs in **reverse order** of step execution

### Error Propagation

```typescript
// Workflow execution returns status
const result = await workflowEngine.execute(workflow, context);

if (result.status === 'failed') {
  console.error('Workflow failed:', result.error);
  console.log('Failed at step:', result.steps[result.steps.length - 1].stepName);
  
  // Check which steps completed
  const completedSteps = result.steps.filter(s => s.status === 'completed');
  console.log(`${completedSteps.length} steps completed before failure`);
}
```


---

## 8. Pause & Resume (Human Approvals)

### Use Case

Long-running workflows with human approvals:
- Manager approval for payroll
- Finance review for expenses
- Manual quality check
- External approval from customer

### Pattern: Pause Workflow

```typescript
const managerApprovalStep = new ActionStep(
  'request-manager-approval',
  async (ctx) => {
    // Create approval request in database
    await approvalService.requestApproval({
      executionId: ctx.executionId,
      approverId: ctx.data.managerId,
      type: 'salary-approval',
      data: { totalSalary: ctx.data.totalSalary }
    });
    
    // Pause workflow - will be resumed when manager approves
    return {
      approvalRequested: true,
      _control: { pause: true } // ⭐ Key: pause workflow
    };
  },
  'Request manager approval and pause workflow'
);
```

### Pattern: Resume Workflow

```typescript
// In your approval handler (e.g., API route or webhook)
async function handleApproval(approvalId: string, approved: boolean) {
  // Get approval record
  const approval = await approvalService.get(approvalId);
  
  if (approved) {
    // Resume workflow
    await workflowEngine.resume(approval.executionId);
  } else {
    // Cancel workflow
    await workflowEngine.cancel(approval.executionId, 'Approval rejected');
  }
}
```

### Full Example: Payroll Approval

```typescript
const payrollWorkflow: WorkflowDefinition = {
  id: 'payroll-approval-v1',
  version: '1.0.0',
  name: 'Payroll Approval',
  
  steps: [
    // Step 1: Calculate salary
    new ActionStep('calculate-salary', calculateHandler),
    
    // Step 2: Manager approval (pause)
    new ActionStep('manager-approval', async (ctx) => {
      await approvalService.requestApproval({
        executionId: ctx.executionId,
        approverId: ctx.data.managerId,
        data: ctx.data.salary
      });
      
      return { _control: { pause: true } };
    }),
    
    // Step 3: Finance review (resume after manager, pause again)
    new ActionStep('finance-review', async (ctx) => {
      await approvalService.requestApproval({
        executionId: ctx.executionId,
        approverId: ctx.data.financeManagerId,
        data: ctx.data.salary
      });
      
      return { _control: { pause: true } };
    }),
    
    // Step 4: Publish salary (resume after finance)
    new ActionStep('publish-salary', publishHandler)
  ],
  
  timeout: 86400000 // 24 hours (long-running)
};

// Initial execution
const result = await workflowEngine.execute(payrollWorkflow, {
  tenantId: 'bella-spa',
  data: { employeeId: 'ktv-123', managerId: 'mgr-456', financeManagerId: 'fin-789' }
});

console.log(result.status); // 'paused'

// Later: Manager approves
await workflowEngine.resume(result.executionId);
// → Workflow continues to Step 3, pauses again

// Later: Finance approves
await workflowEngine.resume(result.executionId);
// → Workflow completes
```

### Event-Based Resume

```typescript
// Subscribe to approval events
eventPublisher.subscribe('approval.approved', async (event) => {
  const { executionId } = event.data;
  
  // Find paused workflow
  const execution = await stateManager.getExecution(executionId);
  
  if (execution.status === 'paused') {
    await workflowEngine.resume(executionId);
  }
});
```

---

## 9. Event-Driven Integration

### Workflow Lifecycle Events

Workflow Engine emits 9 event types:

```typescript
type WorkflowEventType =
  | 'workflow.started'       // Workflow execution started
  | 'workflow.step.started'  // Step execution started
  | 'workflow.step.completed' // Step completed successfully
  | 'workflow.step.failed'   // Step failed
  | 'workflow.step.retrying' // Step retrying after failure
  | 'workflow.paused'        // Workflow paused (waiting for approval)
  | 'workflow.resumed'       // Workflow resumed
  | 'workflow.completed'     // Workflow completed successfully
  | 'workflow.failed'        // Workflow failed
  | 'workflow.cancelled';    // Workflow cancelled
```

### Subscribe to Events

```typescript
import { eventPublisher } from '@/lib/events';

// Subscribe to all workflow events
eventPublisher.subscribe('workflow.*', async (event) => {
  console.log('Workflow event:', event.type, event.data);
  
  // Log to audit trail
  await auditService.log({
    eventType: event.type,
    executionId: event.data.executionId,
    tenantId: event.data.tenantId,
    timestamp: event.timestamp
  });
});

// Subscribe to specific event
eventPublisher.subscribe('workflow.failed', async (event) => {
  // Send alert
  await alertService.send({
    severity: 'error',
    message: `Workflow failed: ${event.data.workflowId}`,
    details: event.data.error
  });
});

// Subscribe to step completion
eventPublisher.subscribe('workflow.step.completed', async (event) => {
  // Collect metrics
  metrics.recordStepExecution({
    workflowId: event.data.workflowId,
    stepName: event.data.stepName,
    executionTime: event.data.executionTime,
    status: 'success'
  });
});
```

### Event Structure

```typescript
interface WorkflowEvent {
  id: string;              // Event ID
  type: WorkflowEventType; // Event type
  timestamp: Date;         // When event occurred
  tenantId: string;        // Tenant context
  correlationId: string;   // Correlation ID for tracing
  
  data: {
    executionId: string;
    workflowId: string;
    workflowVersion: string;
    
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

### Integration Patterns

#### Pattern 1: Audit Trail

```typescript
eventPublisher.subscribe('workflow.*', async (event) => {
  await db.insert('workflow_audit_log', {
    event_type: event.type,
    execution_id: event.data.executionId,
    workflow_id: event.data.workflowId,
    tenant_id: event.tenantId,
    event_data: event.data,
    created_at: event.timestamp
  });
});
```

#### Pattern 2: Metrics & Monitoring

```typescript
eventPublisher.subscribe('workflow.step.completed', async (event) => {
  // Record step execution time
  metrics.histogram('workflow.step.duration', event.data.stepResult.executionTime, {
    workflow_id: event.data.workflowId,
    step_name: event.data.stepName
  });
});

eventPublisher.subscribe('workflow.completed', async (event) => {
  // Record workflow success
  metrics.increment('workflow.completed', {
    workflow_id: event.data.workflowId
  });
});

eventPublisher.subscribe('workflow.failed', async (event) => {
  // Record workflow failure
  metrics.increment('workflow.failed', {
    workflow_id: event.data.workflowId,
    error: event.data.error
  });
});
```

#### Pattern 3: Cross-Workflow Coordination

```typescript
// Workflow A completes → Start Workflow B
eventPublisher.subscribe('workflow.completed', async (event) => {
  if (event.data.workflowId === 'order-fulfillment-v1') {
    // Start invoice generation workflow
    await workflowEngine.execute(invoiceWorkflow, {
      tenantId: event.tenantId,
      data: {
        orderId: event.data.result.output.orderId
      }
    });
  }
});
```

#### Pattern 4: Notification on Failure

```typescript
eventPublisher.subscribe('workflow.failed', async (event) => {
  // Notify ops team
  await slackService.send({
    channel: '#ops-alerts',
    message: `🚨 Workflow failed: ${event.data.workflowId}`,
    details: {
      executionId: event.data.executionId,
      error: event.data.error,
      tenant: event.tenantId
    }
  });
});
```


---

## 10. Best Practices

### 10.1. Workflow Design

✅ **DO**:
- Keep workflows focused on one business process
- Use descriptive step names (`check-auto-approval`, not `step1`)
- Add descriptions to steps for documentation
- Use Decision Engine for decision logic (don't hardcode rules in ActionSteps)
- Design for idempotency (steps should be safe to retry)

❌ **DON'T**:
- Create mega-workflows with 20+ steps (split into smaller workflows)
- Hardcode business rules in ActionStep handlers
- Duplicate decision logic (use Decision Engine)
- Forget error handling and compensation

### 10.2. Step Handlers

✅ **DO**:
```typescript
// Good: Pure, testable handler
const handler = async (ctx: WorkflowContext) => {
  const { customerId, amount } = ctx.data;
  
  // Business logic
  const result = await paymentService.process(customerId, amount);
  
  // Return output
  return {
    transactionId: result.id,
    status: result.status
  };
};
```

❌ **DON'T**:
```typescript
// Bad: Side effects without proper error handling
const badHandler = async (ctx: WorkflowContext) => {
  // Accessing undefined properties
  const amount = ctx.data.booking.totalAmount; // May be undefined
  
  // No error handling
  await paymentService.process(amount);
  
  // Not returning output
};
```

### 10.3. Error Handling

✅ **DO**:
```typescript
// Add retry for network calls
new ActionStep(
  'call-external-api',
  apiHandler,
  'Call payment gateway',
  {
    maxAttempts: 5,
    delayMs: 2000,
    backoff: 'exponential',
    maxDelayMs: 30000
  }
);

// Add compensation for reversible operations
new ActionStep(
  'reserve-inventory',
  reserveHandler,
  'Reserve inventory',
  { maxAttempts: 3, delayMs: 1000 },
  false,
  async (ctx) => {
    // Rollback reservation
    await inventoryService.release(ctx.data.reservationId);
  }
);

// Use continueOnError for non-critical steps
new ActionStep(
  'send-notification',
  notificationHandler,
  'Send notification (non-critical)',
  { maxAttempts: 2, delayMs: 1000 },
  true // Don't fail workflow if notification fails
);
```

### 10.4. Testing

✅ **DO**:
```typescript
// Test workflow with InMemoryStateManager
describe('Order Fulfillment Workflow', () => {
  let workflowEngine: WorkflowEngine;
  let stateManager: InMemoryStateManager;
  
  beforeEach(() => {
    stateManager = new InMemoryStateManager();
    const executor = new WorkflowExecutor(stateManager, eventPublisher);
    workflowEngine = new WorkflowEngine(executor, stateManager, eventPublisher);
  });
  
  afterEach(() => {
    stateManager.clear();
  });
  
  it('should complete workflow when inventory available', async () => {
    // Mock services
    const inventoryService = {
      checkAvailability: jest.fn().mockResolvedValue(true),
      reserve: jest.fn().mockResolvedValue({ id: 'reservation-123' })
    };
    
    // Execute workflow
    const result = await workflowEngine.execute(workflow, {
      tenantId: 'test-tenant',
      data: { order: { /* ... */ } }
    });
    
    // Assertions
    expect(result.status).toBe('completed');
    expect(result.output.reservationId).toBe('reservation-123');
    expect(inventoryService.reserve).toHaveBeenCalledTimes(1);
  });
});
```

### 10.5. State Management

✅ **DO**:
- Use InMemoryStateManager for tests
- Use Database StateManager (Supabase) for production
- Query state via StateManager interface (never access DB directly)
- Keep context.data minimal (avoid storing large objects)

❌ **DON'T**:
- Store large files or binary data in workflow context
- Query workflow_executions table directly (use StateManager)
- Use InMemoryStateManager in production

### 10.6. Performance

✅ **DO**:
- Use ParallelStep for independent operations
- Set appropriate timeout for long-running workflows
- Use Decision Engine cache for repeated decisions
- Monitor step execution times

```typescript
// Good: Parallel independent operations
new ParallelStep('notifications', [
  emailStep,
  smsStep,
  pushStep
], 'allSettled');

// Good: Set timeout
const workflow: WorkflowDefinition = {
  // ...
  timeout: 300000 // 5 minutes
};
```

❌ **DON'T**:
- Run independent operations sequentially (use ParallelStep)
- Set timeout too short for workflows with approvals
- Make external API calls without retry

### 10.7. Security

✅ **DO**:
- Validate workflow input in first step
- Use tenant isolation (always pass tenantId)
- Sanitize external input before using in queries
- Log all workflow executions for audit

```typescript
// Good: Validate input
const validateStep = new ActionStep('validate', async (ctx) => {
  const { orderId, customerId } = ctx.data;
  
  if (!orderId || !customerId) {
    throw new Error('Missing required fields');
  }
  
  // Verify tenant ownership
  const order = await orderService.get(orderId);
  if (order.tenantId !== ctx.tenantId) {
    throw new Error('Unauthorized access');
  }
  
  return { orderValidated: true };
});
```

### 10.8. Observability

✅ **DO**:
- Subscribe to workflow events for monitoring
- Collect metrics (execution time, success rate, error rate)
- Set up alerts for workflow failures
- Use correlation IDs for tracing

```typescript
// Good: Metrics collection
eventPublisher.subscribe('workflow.completed', async (event) => {
  metrics.histogram('workflow.duration', event.data.result.executionTime, {
    workflow_id: event.data.workflowId,
    tenant_id: event.tenantId
  });
  
  metrics.increment('workflow.success', {
    workflow_id: event.data.workflowId
  });
});

eventPublisher.subscribe('workflow.failed', async (event) => {
  metrics.increment('workflow.failure', {
    workflow_id: event.data.workflowId,
    error: event.data.error
  });
  
  // Alert ops team
  await alertService.send({
    severity: 'error',
    message: `Workflow ${event.data.workflowId} failed`,
    correlationId: event.correlationId
  });
});
```

---

## 11. Troubleshooting

### Common Issues

#### Issue 1: Workflow stuck in "running" status

**Symptom**: Workflow shows as "running" but no progress.

**Causes**:
- Step handler threw error but didn't retry
- Step is waiting for external event (but not paused)
- Infinite loop in step logic

**Solution**:
```typescript
// Check execution state
const execution = await stateManager.getExecution(executionId);
console.log('Status:', execution.status);
console.log('Current step:', execution.context.currentStepIndex);
console.log('Completed steps:', execution.context.stepResults);

// Cancel stuck workflow
await workflowEngine.cancel(executionId, 'Workflow stuck - manual cancellation');
```

#### Issue 2: Step fails with "No scripted result" error

**Symptom**: Test fails with error about missing mock.

**Cause**: Service not mocked in test.

**Solution**:
```typescript
// Mock all external services
const mockServices = {
  inventory: {
    checkAvailability: jest.fn().mockResolvedValue(true),
    reserve: jest.fn().mockResolvedValue({ id: 'res-123' })
  },
  notification: {
    send: jest.fn().mockResolvedValue(undefined)
  }
};
```

#### Issue 3: Workflow completes but output is empty

**Symptom**: `result.output` is `{}` or missing expected data.

**Cause**: Steps not returning output correctly.

**Solution**:
```typescript
// Bad: Not returning output
const badStep = new ActionStep('process', async (ctx) => {
  const result = await service.process(ctx.data);
  // Missing return!
});

// Good: Return output
const goodStep = new ActionStep('process', async (ctx) => {
  const result = await service.process(ctx.data);
  return { processedData: result }; // ✅ Return output
});
```

#### Issue 4: Compensation not running

**Symptom**: Workflow fails but compensation handler not called.

**Cause**: Compensation only runs for completed steps.

**Solution**:
```typescript
// Compensation runs for steps that completed successfully
// If step never completes, compensation won't run

// Check step status
const failedStepIndex = result.steps.findIndex(s => s.status === 'failed');
const completedSteps = result.steps.slice(0, failedStepIndex);
console.log('Steps with compensation:', completedSteps.filter(s => s.compensate));
```

#### Issue 5: Event not triggering

**Symptom**: Event subscriber not called.

**Cause**: Event type mismatch or subscriber not registered.

**Solution**:
```typescript
// Check event type matches
eventPublisher.subscribe('workflow.completed', handler); // Correct
eventPublisher.subscribe('workflow.complete', handler);  // Wrong (typo)

// Use wildcard for debugging
eventPublisher.subscribe('workflow.*', (event) => {
  console.log('Event:', event.type, event.data);
});
```


---

## 12. Migration Guide

### From Hardcoded Orchestration to Workflow Engine

#### Before (Hardcoded)

```typescript
// ❌ Hardcoded orchestration in business module
async function processBooking(booking: Booking) {
  // Step 1: Check approval
  const approvalResult = await checkAutoApproval(booking);
  
  // Step 2: Conditional logic
  if (approvalResult.approved) {
    // Step 3: Reserve inventory
    const reservation = await inventoryService.reserve(booking.productIds);
    
    // Step 4: Assign KTV
    const assignment = await ktvService.autoAssign(booking);
    
    // Step 5: Send notifications (parallel)
    await Promise.all([
      emailService.sendConfirmation(booking.customerEmail),
      smsService.notifyKTV(assignment.ktvId)
    ]);
    
    // Step 6: Finalize
    await bookingService.finalize(booking.id, {
      reservationId: reservation.id,
      ktvId: assignment.ktvId
    });
  } else {
    // Alternative path
    await emailService.sendPendingNotice(booking.customerEmail);
  }
}
```

**Problems**:
- ❌ No retry logic
- ❌ No audit trail
- ❌ No state persistence (can't pause/resume)
- ❌ Hard to test
- ❌ No compensation on failure
- ❌ Business logic mixed with orchestration

#### After (Workflow Engine)

```typescript
// ✅ Declarative workflow with Workflow Engine
const bookingWorkflow = createBookingToFulfillmentWorkflow(
  decisionEngine,
  services
);

async function processBooking(booking: Booking) {
  const result = await workflowEngine.execute(bookingWorkflow, {
    tenantId: booking.tenantId,
    userId: booking.customerId,
    data: { booking }
  });
  
  return result;
}
```

**Benefits**:
- ✅ Automatic retry with exponential backoff
- ✅ Complete audit trail (all events logged)
- ✅ State persistence (survives restarts)
- ✅ Easy to test (mock services)
- ✅ Compensation on failure (rollback inventory)
- ✅ Separation of concerns

### Migration Strategy

**Phase 1: Identify Candidates** (1 week)
- List all hardcoded orchestration logic
- Prioritize by:
  - Complexity (multi-step processes)
  - Failure rate (needs retry/rollback)
  - Business criticality

**Phase 2: Implement Workflows** (2-3 weeks)
- Start with simplest workflow
- Test thoroughly in staging
- Migrate one workflow at a time
- Keep both implementations during transition

**Phase 3: Deploy with Feature Flag** (1 week)
```typescript
// Use feature flag for gradual rollout
if (useWorkflowEngine) {
  return await workflowEngine.execute(workflow, context);
} else {
  return await legacyProcessBooking(booking);
}
```

**Phase 4: Monitor & Rollout** (2 weeks)
- 10% traffic → Monitor metrics
- 50% traffic → Verify stability
- 100% traffic → Full migration
- Remove legacy code

**Phase 5: Cleanup** (1 week)
- Remove feature flags
- Delete legacy code
- Update documentation

### Rollback Plan

If issues occur after migration:

1. **Immediate**: Toggle feature flag OFF
2. **Investigate**: Check workflow execution logs
3. **Fix**: Address root cause
4. **Re-deploy**: Enable feature flag again
5. **Monitor**: Watch metrics closely

**Rollback Time**: <5 minutes (feature flag toggle)

---

## 🎓 Summary

### Key Takeaways

1. **Workflow Engine orchestrates**, Decision Engine decides
2. Use **4 step types**: DecisionStep, ActionStep, ConditionStep, ParallelStep
3. **State is persistent** (survives restarts)
4. **Retry + Compensation** for resilience
5. **Pause/Resume** for human approvals
6. **Event-driven** for observability

### Quick Reference Card

```typescript
// 1. Setup Engine
const stateManager = new InMemoryStateManager();
const executor = new WorkflowExecutor(stateManager, eventPublisher);
const engine = new WorkflowEngine(executor, stateManager, eventPublisher);

// 2. Define Workflow
const workflow: WorkflowDefinition = {
  id: 'my-workflow-v1',
  version: '1.0.0',
  name: 'My Workflow',
  steps: [
    new DecisionStep('decide', decisionEngine, config),
    new ConditionStep('branch', predicate, 'pathA', 'pathB'),
    new ActionStep('pathA', handlerA),
    new ParallelStep('parallel', [step1, step2]),
    new ActionStep('pathB', handlerB)
  ]
};

// 3. Execute
const result = await engine.execute(workflow, {
  tenantId: 'tenant-1',
  data: { /* input */ }
});

// 4. Check Result
if (result.status === 'completed') {
  console.log('Success:', result.output);
} else if (result.status === 'paused') {
  // Resume later: await engine.resume(result.executionId);
} else {
  console.error('Failed:', result.error);
}
```

### Next Steps

- ✅ Read [Workflow Engine Architecture](./WORKFLOW_ENGINE_ARCHITECTURE.md)
- ✅ Review [Sample Workflows](../src/lib/workflow-engine/samples/)
- ✅ Try [Booking-to-Fulfillment Example](../src/lib/workflow-engine/samples/booking-to-fulfillment.ts)
- ✅ Implement your first workflow
- ✅ Set up monitoring & alerts

### Need Help?

- 📖 Architecture: [WORKFLOW_ENGINE_ARCHITECTURE.md](./WORKFLOW_ENGINE_ARCHITECTURE.md)
- 🧪 Tests: [src/lib/workflow-engine/**/*.test.ts](../src/lib/workflow-engine/__tests__/)
- 💬 Questions: Contact Platform Team

---

**Document Version**: 1.0.0  
**Last Updated**: 2026-07-09  
**Status**: ✅ **COMPLETE**

