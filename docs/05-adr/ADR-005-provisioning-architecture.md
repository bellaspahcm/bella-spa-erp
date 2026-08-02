# ADR-005: Provisioning Architecture

**Status:** APPROVED  
**Date:** 2026-08-02  
**Decision Makers:** Chief Architect, Platform Team Lead  
**Consulted:** Security Team, DevOps  
**Informed:** All Engineering Teams

---

## Context

After a Registration is approved, Bella AI Platform must create:
1. **Tenant** (if organization registration)
2. **Identity** (user account)
3. **Credentials** (login method)
4. **Roles & Permissions** (access control)
5. **Package & License** (subscription)
6. **Module Assignments** (enabled features)
7. **Initial Configuration** (defaults, quotas)
8. **Activation Token** (password setup)
9. **Welcome Notification** (email, in-app)

**Current Problem:** Provisioning is done in a single monolithic function with:
- ❌ No transactional safety (partial failure leaves orphaned records)
- ❌ No retry mechanism
- ❌ No idempotency
- ❌ No audit trail
- ❌ Hard to extend (adding new step requires code change)

**Question:** How do we design a robust, extensible provisioning system?

---

## Decision

We will adopt a **Pipeline Architecture** with:
1. **Stateful Pipeline** - Each step persists progress
2. **Atomic Steps** - Each step is a transaction
3. **Idempotent Steps** - Safe to retry
4. **Event-Driven** - Publishes events at each milestone
5. **Extensible** - New steps can be added without changing core logic

---

## Architecture

### Provisioning Pipeline

```
Registration Approved
        ↓
┌─────────────────────────────────────┐
│   Provisioning Pipeline Engine      │
└─────────────────────────────────────┘
        ↓
Step 1: Validate Prerequisites
        ↓
Step 2: Create Organization (if needed)
        ↓
Step 3: Create Tenant
        ↓
Step 4: Create Identity
        ↓
Step 5: Create Credential
        ↓
Step 6: Assign Roles & Permissions
        ↓
Step 7: Assign Package & License
        ↓
Step 8: Assign Modules
        ↓
Step 9: Apply Quotas
        ↓
Step 10: Generate Activation Token
        ↓
Step 11: Publish Events
        ↓
Step 12: Send Notifications
        ↓
Provisioning Complete
```

---

## Pipeline State Machine

```
Registration
  status = 'approved'
        ↓
Provisioning Pipeline
  status = 'pending'
        ↓
Step 1 Complete
  status = 'creating_organization'
        ↓
Step 2 Complete
  status = 'creating_tenant'
        ↓
Step 3 Complete
  status = 'creating_identity'
        ↓
...
        ↓
All Steps Complete
  status = 'provisioned'
        ↓
Activation Complete
  status = 'activated'
```

**Failure States:**
- `provisioning_failed` - Retry possible
- `provisioning_blocked` - Manual intervention required

---

## Database Schema

### provisioning_pipelines Table

```sql
CREATE TABLE provisioning_pipelines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  registration_id UUID NOT NULL REFERENCES identity_registrations(id),
  pipeline_type TEXT NOT NULL, -- 'partner', 'employee', 'customer'
  
  -- State
  status TEXT NOT NULL, -- 'pending', 'in_progress', 'completed', 'failed', 'blocked'
  current_step TEXT, -- 'create_organization', 'create_tenant', ...
  progress JSONB, -- { "completed_steps": [...], "failed_steps": [...] }
  
  -- Result
  organization_id UUID REFERENCES organizations(id),
  tenant_id UUID REFERENCES tenants(id),
  identity_id UUID REFERENCES identities(id),
  activation_token TEXT,
  
  -- Timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  
  -- Error Handling
  error_message TEXT,
  retry_count INT DEFAULT 0,
  last_retry_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB, -- Extensible configuration
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_provisioning_pipelines_registration ON provisioning_pipelines(registration_id);
CREATE INDEX idx_provisioning_pipelines_status ON provisioning_pipelines(status);
CREATE INDEX idx_provisioning_pipelines_identity ON provisioning_pipelines(identity_id);
```

### provisioning_steps Table

```sql
CREATE TABLE provisioning_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pipeline_id UUID NOT NULL REFERENCES provisioning_pipelines(id) ON DELETE CASCADE,
  
  step_name TEXT NOT NULL, -- 'create_organization', 'create_tenant', ...
  step_order INT NOT NULL,
  
  -- State
  status TEXT NOT NULL, -- 'pending', 'in_progress', 'completed', 'failed', 'skipped'
  
  -- Input/Output
  input_data JSONB, -- What data was passed to this step
  output_data JSONB, -- What data this step produced
  
  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INT, -- Performance tracking
  
  -- Error Handling
  error_message TEXT,
  retry_count INT DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_provisioning_steps_pipeline ON provisioning_steps(pipeline_id);
CREATE INDEX idx_provisioning_steps_status ON provisioning_steps(status);
```

---

## Step Implementation

### Step Interface

```typescript
interface ProvisioningStep {
  name: string;
  order: number;
  
  // Validate if step should run
  shouldRun(context: ProvisioningContext): Promise<boolean>;
  
  // Execute the step
  execute(context: ProvisioningContext): Promise<StepResult>;
  
  // Rollback (if possible)
  rollback?(context: ProvisioningContext): Promise<void>;
  
  // Idempotency check
  isCompleted(context: ProvisioningContext): Promise<boolean>;
}

interface ProvisioningContext {
  registration: Registration;
  pipeline: ProvisioningPipeline;
  progress: Progress;
  config: Record<string, any>;
}

interface StepResult {
  success: boolean;
  data?: Record<string, any>;
  error?: string;
}
```

---

### Example Step: CreateTenantStep

```typescript
export class CreateTenantStep implements ProvisioningStep {
  name = 'create_tenant';
  order = 3;
  
  async shouldRun(context: ProvisioningContext): Promise<boolean> {
    // Skip if tenant already created
    if (context.pipeline.tenant_id) return false;
    
    // Skip if individual (no tenant needed)
    if (context.registration.applicant_type === 'individual') return false;
    
    return true;
  }
  
  async execute(context: ProvisioningContext): Promise<StepResult> {
    const { registration, progress } = context;
    
    try {
      // 1. Create tenant
      const tenant = await db.insert('tenants').values({
        organization_id: progress.organization_id,
        industry_module: registration.metadata.industry,
        tenant_name: registration.company_name || registration.full_name,
        status: 'active',
        metadata: {
          registration_id: registration.id,
          created_via: 'provisioning_pipeline'
        }
      }).returning();
      
      // 2. Update pipeline with tenant_id
      await db.update('provisioning_pipelines')
        .set({ tenant_id: tenant.id })
        .where('id', context.pipeline.id);
      
      // 3. Publish event
      await eventBus.publish({
        eventType: 'TenantCreated',
        aggregateId: tenant.id,
        payload: {
          tenantId: tenant.id,
          organizationId: tenant.organization_id,
          registrationId: registration.id
        }
      });
      
      return {
        success: true,
        data: { tenant_id: tenant.id }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  async rollback(context: ProvisioningContext): Promise<void> {
    if (context.pipeline.tenant_id) {
      // Soft delete tenant
      await db.update('tenants')
        .set({ status: 'archived', deleted_at: new Date() })
        .where('id', context.pipeline.tenant_id);
    }
  }
  
  async isCompleted(context: ProvisioningContext): Promise<boolean> {
    return !!context.pipeline.tenant_id;
  }
}
```

---

## Pipeline Engine

### Execute Pipeline

```typescript
export class ProvisioningEngine {
  private steps: ProvisioningStep[] = [
    new ValidatePrerequisitesStep(),
    new CreateOrganizationStep(),
    new CreateTenantStep(),
    new CreateIdentityStep(),
    new CreateCredentialStep(),
    new AssignRolesStep(),
    new AssignPackageStep(),
    new AssignModulesStep(),
    new ApplyQuotasStep(),
    new GenerateActivationTokenStep(),
    new PublishEventsStep(),
    new SendNotificationsStep()
  ];
  
  async execute(registrationId: string): Promise<ProvisioningResult> {
    // 1. Load registration
    const registration = await loadRegistration(registrationId);
    
    // 2. Create pipeline record
    const pipeline = await this.createPipeline(registration);
    
    // 3. Load context
    const context = await this.loadContext(registration, pipeline);
    
    // 4. Execute steps sequentially
    for (const step of this.steps.sort((a, b) => a.order - b.order)) {
      try {
        // Check if step should run
        if (!await step.shouldRun(context)) {
          await this.markStepSkipped(pipeline.id, step.name);
          continue;
        }
        
        // Check if step already completed (idempotency)
        if (await step.isCompleted(context)) {
          await this.markStepCompleted(pipeline.id, step.name);
          continue;
        }
        
        // Execute step
        await this.markStepInProgress(pipeline.id, step.name);
        const result = await step.execute(context);
        
        if (result.success) {
          // Step succeeded
          await this.markStepCompleted(pipeline.id, step.name, result.data);
          context.progress = { ...context.progress, ...result.data };
        } else {
          // Step failed
          await this.markStepFailed(pipeline.id, step.name, result.error);
          
          // Rollback previous steps
          await this.rollback(context, step);
          
          return {
            success: false,
            error: `Step ${step.name} failed: ${result.error}`
          };
        }
        
      } catch (error) {
        // Unexpected error
        await this.markStepFailed(pipeline.id, step.name, error.message);
        await this.rollback(context, step);
        
        return {
          success: false,
          error: `Step ${step.name} threw exception: ${error.message}`
        };
      }
    }
    
    // 5. Mark pipeline complete
    await this.markPipelineCompleted(pipeline.id);
    
    return {
      success: true,
      pipeline: await this.loadPipeline(pipeline.id)
    };
  }
  
  private async rollback(context: ProvisioningContext, failedStep: ProvisioningStep) {
    const completedSteps = this.steps
      .filter(s => s.order < failedStep.order)
      .reverse(); // Rollback in reverse order
    
    for (const step of completedSteps) {
      if (step.rollback) {
        try {
          await step.rollback(context);
        } catch (error) {
          console.error(`Rollback failed for step ${step.name}:`, error);
          // Log but continue (best effort)
        }
      }
    }
  }
}
```

---

## Retry Strategy

### Automatic Retry

```typescript
export async function provisionWithRetry(registrationId: string) {
  const MAX_RETRIES = 3;
  const BACKOFF_MS = [1000, 5000, 30000]; // 1s, 5s, 30s
  
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const result = await provisioningEngine.execute(registrationId);
    
    if (result.success) {
      return result;
    }
    
    // Check if error is retryable
    if (isTransientError(result.error) && attempt < MAX_RETRIES) {
      // Wait before retry
      await sleep(BACKOFF_MS[attempt]);
      
      // Retry
      console.log(`Retrying provisioning (attempt ${attempt + 2}/${MAX_RETRIES + 1})`);
      continue;
    } else {
      // Non-retryable error or max retries reached
      await this.markPipelineBlocked(registrationId, result.error);
      
      // Alert engineering team
      await sendAlert({
        severity: 'high',
        message: `Provisioning blocked for registration ${registrationId}: ${result.error}`
      });
      
      return result;
    }
  }
}

function isTransientError(error: string): boolean {
  const transientErrors = [
    'network timeout',
    'connection refused',
    'temporary unavailable',
    'rate limit exceeded'
  ];
  
  return transientErrors.some(e => error.toLowerCase().includes(e));
}
```

---

## Idempotency

Each step must be idempotent (safe to run multiple times):

```typescript
async execute(context: ProvisioningContext): Promise<StepResult> {
  // 1. Check if already completed
  const existingTenant = await db.select('*')
    .from('tenants')
    .where('organization_id', context.progress.organization_id)
    .where('metadata->registration_id', context.registration.id)
    .first();
  
  if (existingTenant) {
    // Already created, return success
    return {
      success: true,
      data: { tenant_id: existingTenant.id }
    };
  }
  
  // 2. Create new tenant
  const tenant = await db.insert('tenants').values({...}).returning();
  
  return {
    success: true,
    data: { tenant_id: tenant.id }
  };
}
```

---

## Event Publishing

Pipeline publishes events at each milestone:

```typescript
// After CreateIdentityStep
await eventBus.publish({
  eventType: 'IdentityProvisioned',
  aggregateId: identity.id,
  payload: {
    identityId: identity.id,
    tenantId: tenant.id,
    registrationId: registration.id
  }
});

// After Pipeline Complete
await eventBus.publish({
  eventType: 'ProvisioningCompleted',
  aggregateId: pipeline.id,
  payload: {
    pipelineId: pipeline.id,
    registrationId: registration.id,
    identityId: identity.id,
    tenantId: tenant.id,
    activationToken: pipeline.activation_token
  }
});
```

**Subscribers can react to these events:**
- **Notification Service:** Send welcome email
- **Audit Service:** Log provisioning success
- **Analytics Service:** Track provisioning time
- **CRM Service:** Create contact record

---

## Compensation (Rollback)

If a step fails, previous steps are rolled back:

**Example:**
1. Create Organization ✅
2. Create Tenant ✅
3. Create Identity ❌ (email already exists)

**Rollback:**
- Delete Tenant (soft delete)
- Delete Organization (soft delete)

**Database State:**
- `provisioning_pipelines.status = 'failed'`
- `organizations.deleted_at = NOW()`
- `tenants.deleted_at = NOW()`

**Result:**
- No orphaned records
- Clean state for retry

---

## Testing Strategy

### Unit Tests (Steps)
```typescript
describe('CreateTenantStep', () => {
  it('should create tenant for organization registration', async () => {
    const context = createMockContext({
      applicant_type: 'organization',
      organization_id: 'org-123'
    });
    
    const step = new CreateTenantStep();
    const result = await step.execute(context);
    
    expect(result.success).toBe(true);
    expect(result.data.tenant_id).toBeDefined();
  });
  
  it('should be idempotent (safe to run twice)', async () => {
    const context = createMockContext();
    const step = new CreateTenantStep();
    
    const result1 = await step.execute(context);
    const result2 = await step.execute(context); // Run again
    
    expect(result1.data.tenant_id).toEqual(result2.data.tenant_id);
  });
});
```

### Integration Tests (Pipeline)
```typescript
describe('ProvisioningEngine', () => {
  it('should provision partner from approved registration', async () => {
    const registration = await createApprovedRegistration();
    
    const result = await provisioningEngine.execute(registration.id);
    
    expect(result.success).toBe(true);
    expect(result.pipeline.tenant_id).toBeDefined();
    expect(result.pipeline.identity_id).toBeDefined();
    expect(result.pipeline.activation_token).toBeDefined();
  });
  
  it('should rollback on failure', async () => {
    // Mock Identity creation to fail
    jest.spyOn(db, 'insert').mockImplementationOnce(() => {
      throw new Error('Email already exists');
    });
    
    const registration = await createApprovedRegistration();
    const result = await provisioningEngine.execute(registration.id);
    
    expect(result.success).toBe(false);
    
    // Verify rollback happened
    const tenant = await db.select('*').from('tenants').where('id', result.pipeline.tenant_id);
    expect(tenant.deleted_at).not.toBeNull();
  });
});
```

---

## Monitoring & Observability

### Metrics
- **Provisioning success rate** (%)
- **Provisioning duration** (p50, p95, p99)
- **Step failure rate** per step (%)
- **Retry rate** (%)
- **Blocked pipelines** (count)

### Alerts
- ⚠️ **Provisioning success rate < 95%** (last 1 hour)
- ⚠️ **Provisioning duration p95 > 30s**
- ⚠️ **Blocked pipelines > 5**
- ⚠️ **Step CreateIdentity failure rate > 10%**

### Dashboard
```
Provisioning Pipeline Health
├── Total pipelines (24h): 150
├── Success rate: 98%
├── Average duration: 5.2s
├── Blocked: 2
│
└── Step Performance
    ├── CreateOrganization: 0.5s (100% success)
    ├── CreateTenant: 0.8s (100% success)
    ├── CreateIdentity: 1.2s (98% success) ⚠️ 2% failed (duplicate email)
    ├── AssignRoles: 0.3s (100% success)
    └── SendNotification: 2.1s (99% success)
```

---

## Benefits

✅ **Transactional Safety** - Each step is atomic  
✅ **Retry Mechanism** - Automatic retry with backoff  
✅ **Idempotency** - Safe to retry failed steps  
✅ **Audit Trail** - Every step logged  
✅ **Extensibility** - Add new steps without changing engine  
✅ **Rollback** - Compensation on failure  
✅ **Event-Driven** - Decoupled from subscribers  
✅ **Observability** - Metrics and alerts  

---

## Trade-offs

⚠️ **Complexity** - More complex than single function  
⚠️ **Latency** - Slower than direct database inserts (5-10s vs 1s)  
⚠️ **Storage** - Stores all step history (database size growth)  

**Mitigation:**
- Complexity justified by reliability and extensibility
- Latency acceptable for infrequent operation (provisioning)
- Archive old pipeline records after 90 days

---

## Related ADRs

- [ADR-001: Identity Platform](./ADR-001-identity-platform.md)
- [ADR-004: Event-Driven Architecture](./ADR-004-event-driven-architecture.md)
- [ADR-010: Domain Model](./ADR-010-domain-model.md)

---

## Approval

- [x] **Chief Architect:** Approved - 2026-08-02
- [x] **Platform Team Lead:** Approved - 2026-08-02
- [x] **Security Team:** Approved - 2026-08-02

---

**Decision:** APPROVED  
**Effective Date:** 2026-08-02  
**Review Date:** 2026-11-02

---

**"Provisioning is a pipeline, not a function."**
