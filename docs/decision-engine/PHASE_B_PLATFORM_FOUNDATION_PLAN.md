# Phase B: Platform Foundation - Detailed Implementation Plan (REVISED)

**Timeline:** July - October 2026 (16 weeks)  
**Status:** 📋 Planning (Prioritized)  
**Priority:** ⭐⭐⭐⭐⭐ CRITICAL

---

## 🎯 Phase Objective

Build **Business Decision Platform foundation** - not just a rule engine.

**Strategic Assessment:**
> This roadmap is no longer just "Decision Engine" - it's a **Business Rules Management System (BRMS) + Decision Intelligence Platform**.

**Current Reality Check:**
- Bella is still building foundation (not 5000-employee enterprise yet)
- Some features are enterprise-grade but **too early** for current stage
- Need to prioritize **what we need now** vs **what we'll need later**

**Revised Approach:** 3-Tier Priority System

### Priority 1: Core Foundation (MUST-HAVE) ⭐⭐⭐⭐⭐
**Timeline:** Week 1-10 (Jul-Sep 2026)

Components that are **non-negotiable** for a functioning Decision Platform:
- ✅ Policy Registry
- ✅ Rule Registry  
- ✅ Policy Versioning
- ✅ Explainability
- ✅ Shadow Mode
- ✅ Decision Context
- ✅ Action Engine

**Why mandatory:** Without these, we're still just "code with if/else" not "platform"

### Priority 2: Business Foundation (SHOULD-HAVE) ⭐⭐⭐⭐
**Timeline:** Week 11-14 (Sep-Oct 2026)

Components needed when we have **multiple policies** interacting:
- ✅ Decision Pipeline (orchestration)
- ✅ Composite Policy (policy composition)
- ✅ Conflict Resolver (handle overlapping rules)
- ✅ Decision Flow (configurable policy chains)
- ✅ Decision Cache (performance optimization)

**Why important:** Will need these when integrating Pricing + Promotion + Membership + Booking

### Priority 3: Enterprise Enhancement (NICE-TO-HAVE) ⭐⭐⭐
**Timeline:** Phase D+ (Jan 2027+)

Components for **scale, UX, and demo value** (defer until after business integration):
- ⏳ Rule Coverage Dashboard
- ⏳ Decision Simulator  
- ⏳ Decision Graph (CEO visual dashboard)
- ⏳ Rule DSL (near-compiler complexity)
- ⏳ Expression Engine
- ⏳ Visual Rule Builder
- ⏳ AI Rule Recommendation
- ⏳ Event Bus (only if microservices)

**Why defer:** These are **visualization/UX enhancements**, not core capability. Focus on substance first, polish later.

---

## 📊 Revised Success Criteria

**Phase B Complete = 90-95% Decision Platform capability**

After Priority 1 + 2, Bella will have:
- ✅ Centralized policy/rule management
- ✅ Version control with time-travel replay
- ✅ Safe deployment (shadow mode)
- ✅ Explainable decisions (not black box)
- ✅ Decoupled actions (clean architecture)
- ✅ Auto-injected context (fast policies)
- ✅ Policy composition & conflict resolution
- ✅ High performance (caching)

Priority 3 features add **demo value** and **ease-of-use**, but don't fundamentally change platform capability.

---

## 📅 16-Week Timeline Overview (3-TIER PRIORITY)

### Priority 1: Core Foundation (Week 1-10) ⭐⭐⭐⭐⭐ MUST-HAVE

| Week | Component | Why Critical | Status |
|------|-----------|--------------|--------|
| 1-2 | **Policy Registry** | Centralized policy management with governance | ⏳ |
| 2-3 | **Rule Registry** | Track rule usage, identify dead rules | ⏳ |
| 3-4 | **Policy Versioning** | Git-like time-travel replay | ⏳ |
| 4-5 | **Shadow Mode** | Safe policy testing without production risk | ⏳ |
| 5-6 | **Explainability** | Human-readable decision breakdown | ⏳ |
| 6-8 | **Decision Context** | Auto-inject business context | ⏳ |
| 8-10 | **Action Engine** | Separate decisions from side-effects | ⏳ |

**Deliverable:** Functional Decision Platform (60-70% complete)

### Priority 2: Business Foundation (Week 11-14) ⭐⭐⭐⭐ SHOULD-HAVE

| Week | Component | Why Needed | Status |
|------|-----------|------------|--------|
| 11 | **Decision Pipeline** | Orchestrate normalize → context → policy → merge | ⏳ |
| 11-12 | **Composite Policy** | Combine multiple policies (Pricing + Promotion + Capacity) | ⏳ |
| 12-13 | **Conflict Resolver** | Handle overlapping discounts/rules | ⏳ |
| 13-14 | **Decision Flow** | Configurable policy chains | ⏳ |
| 14 | **Decision Cache** | Cache context & results for performance | ⏳ |

**Deliverable:** Complete Decision Platform (90-95% complete)

### Priority 3: Enterprise Enhancement (Phase D+) ⭐⭐⭐ NICE-TO-HAVE

| Component | Why Defer | Move to Phase |
|-----------|-----------|---------------|
| **Rule Coverage Dashboard** | Visualization, not core capability | Phase D (Jan 2027) |
| **Decision Simulator** | Nice for testing, but shadow mode sufficient | Phase D |
| **Decision Graph** | Beautiful demo, but explainability sufficient | Phase D |
| **Rule DSL** | Compiler-level complexity, huge effort | Phase E (Q2 2027) |
| **Expression Engine** | Business self-service, not immediate need | Phase E |
| **Visual Rule Builder** | UX polish, needs Expression Engine first | Phase E |
| **Event Bus** | Only needed for microservices | Phase F (when decoupling) |
| **AI Rule Recommendation** | Requires 6+ months of decision data | Phase J (2028) |

**Rationale:** Focus on **substance** (working platform) before **polish** (fancy UI/demo features)

---

## Week 1-2: Policy Registry

### Objective
Centralize all policy definitions with metadata, status tracking, and lifecycle management.

### Current Problem
```typescript
// Policies scattered in code
src/lib/decision-engine/policies/leave-approval-policy.ts
src/lib/decision-engine/policies/booking-policy.ts
// No version control, no lifecycle, no metadata
```

### Target Solution
```typescript
// Centralized registry with full metadata
const registry = await PolicyRegistry.getAll();
// Returns: All policies with status, version, metadata
```

### Technical Design

#### 1.1 Database Schema
```sql
CREATE TABLE policy_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  version TEXT NOT NULL, -- Semver: "1.0.0"
  status TEXT NOT NULL, -- 'active', 'deprecated', 'archived'
  category TEXT, -- 'leave', 'booking', 'pricing', 'payroll'
  tenant_id UUID REFERENCES tenants(id),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id),
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES profiles(id),
  deprecated_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  
  -- Governance (NEW: Enterprise audit fields)
  owner_department TEXT, -- 'HR', 'Finance', 'Operations'
  business_owner TEXT, -- Name of business owner
  business_owner_email TEXT,
  technical_owner TEXT, -- Name of technical owner
  technical_owner_email TEXT,
  review_date DATE, -- Next scheduled review
  effective_date DATE, -- When policy takes effect
  expire_date DATE, -- When policy expires
  
  -- Config
  config JSONB, -- Policy-specific configuration
  metadata JSONB, -- Tags, owner, contact, SLA
  
  -- Statistics (denormalized for performance)
  total_decisions INTEGER DEFAULT 0,
  total_approvals INTEGER DEFAULT 0,
  total_rejections INTEGER DEFAULT 0,
  avg_confidence NUMERIC(5,2),
  last_decision_at TIMESTAMPTZ,
  
  CONSTRAINT valid_status CHECK (status IN ('active', 'deprecated', 'archived'))
);

CREATE INDEX idx_policy_registry_status ON policy_registry(status);
CREATE INDEX idx_policy_registry_tenant ON policy_registry(tenant_id);
CREATE INDEX idx_policy_registry_category ON policy_registry(category);
```

#### 1.2 TypeScript Types
```typescript
// src/lib/decision-engine/registry/types.ts

export type PolicyStatus = 'active' | 'deprecated' | 'archived';

export interface PolicyRegistryEntry {
  id: string;
  policyId: string;
  name: string;
  description?: string;
  version: string; // Semver
  status: PolicyStatus;
  category?: string;
  tenantId?: string;
  
  // Timestamps
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  publishedAt?: string;
  publishedBy?: string;
  deprecatedAt?: string;
  archivedAt?: string;
  
  // Config
  config?: Record<string, any>;
  metadata?: {
    tags?: string[];
    owner?: string;
    contact?: string;
    sla?: {
      maxLatency: number; // ms
      targetAvailability: number; // 99.9%
    };
  };
  
  // Statistics
  totalDecisions: number;
  totalApprovals: number;
  totalRejections: number;
  avgConfidence?: number;
  lastDecisionAt?: string;
}
```

#### 1.3 Policy Registry Service
```typescript
// src/lib/decision-engine/registry/PolicyRegistry.ts

export class PolicyRegistry {
  /**
   * Register a new policy in the registry
   */
  static async register(
    policy: Policy,
    metadata: {
      createdBy: string;
      category?: string;
      tags?: string[];
    }
  ): Promise<PolicyRegistryEntry> {
    // Validate policy structure
    this.validatePolicy(policy);
    
    // Check for duplicate policy ID
    const existing = await this.get(policy.id);
    if (existing) {
      throw new Error(`Policy ${policy.id} already registered`);
    }
    
    // Insert into registry
    const entry = await db.policyRegistry.create({
      policyId: policy.id,
      name: policy.name,
      description: policy.description,
      version: policy.version || '1.0.0',
      status: 'active',
      category: metadata.category,
      createdBy: metadata.createdBy,
      updatedBy: metadata.createdBy,
      metadata: { tags: metadata.tags },
      config: policy.config,
    });
    
    return entry;
  }
  
  /**
   * Get policy by ID
   */
  static async get(policyId: string): Promise<PolicyRegistryEntry | null> {
    return await db.policyRegistry.findByPolicyId(policyId);
  }
  
  /**
   * List all policies (with optional filters)
   */
  static async list(filters?: {
    status?: PolicyStatus;
    category?: string;
    tenantId?: string;
  }): Promise<PolicyRegistryEntry[]> {
    return await db.policyRegistry.findAll(filters);
  }

  /**
   * Update policy metadata (without changing version)
   */
  static async updateMetadata(
    policyId: string,
    updates: Partial<PolicyRegistryEntry>,
    updatedBy: string
  ): Promise<PolicyRegistryEntry> {
    return await db.policyRegistry.update(policyId, {
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy,
    });
  }
  
  /**
   * Deprecate a policy (soft delete)
   */
  static async deprecate(policyId: string, userId: string): Promise<void> {
    await this.updateMetadata(policyId, {
      status: 'deprecated',
      deprecatedAt: new Date().toISOString(),
    }, userId);
  }
  
  /**
   * Archive a policy (hard delete from active use)
   */
  static async archive(policyId: string, userId: string): Promise<void> {
    await this.updateMetadata(policyId, {
      status: 'archived',
      archivedAt: new Date().toISOString(),
    }, userId);
  }
  
  /**
   * Increment decision count (called after each decision)
   */
  static async recordDecision(
    policyId: string,
    outcome: 'approve' | 'reject',
    confidence: number
  ): Promise<void> {
    await db.policyRegistry.incrementStats(policyId, {
      totalDecisions: 1,
      totalApprovals: outcome === 'approve' ? 1 : 0,
      totalRejections: outcome === 'reject' ? 1 : 0,
      avgConfidence: confidence,
      lastDecisionAt: new Date().toISOString(),
    });
  }
}
```

### Deliverables (Week 1-2)

- [x] Database schema for `policy_registry` table
- [x] TypeScript types and interfaces
- [x] PolicyRegistry service class
- [ ] Migration script to import existing policies
- [ ] Unit tests (>90% coverage)
- [ ] Integration tests with existing Leave Policy
- [ ] Documentation and API reference

### Success Criteria

- ✅ All existing policies registered in database
- ✅ PolicyRegistry API working correctly
- ✅ Decision statistics automatically updated
- ✅ Tests passing with >90% coverage

---

## Week 2-3: Rule Registry

### Objective
Track individual rules, their usage patterns, and identify dead/rarely-used rules.

### Current Problem
```typescript
// Rules buried inside policies, no tracking
policy.rules.forEach(rule => {
  // Which rules are actually used?
  // Which rules are dead code?
  // No analytics, no optimization
});
```

### Target Solution
```typescript
const deadRules = await RuleRegistry.getDeadRules(days: 90);
// Returns: Rules with 0 executions in last 90 days
```

### Technical Design

#### 2.1 Database Schema
```sql
CREATE TABLE rule_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id TEXT UNIQUE NOT NULL,
  policy_id TEXT NOT NULL REFERENCES policy_registry(policy_id),
  name TEXT NOT NULL,
  description TEXT,
  priority INTEGER NOT NULL,
  
  -- Rule definition
  condition_expr TEXT NOT NULL, -- Expression string
  action_type TEXT NOT NULL, -- 'approve', 'reject', 'score'
  action_config JSONB, -- Action parameters
  
  -- Business-friendly fields (NEW: For non-technical users)
  business_name TEXT, -- "Giảm giá khách VIP"
  business_description TEXT, -- "Khách VIP trên 100 triệu được giảm 10%"
  sample_input JSONB, -- Example input that triggers this rule
  sample_output JSONB, -- Example output
  risk_level TEXT, -- 'low', 'medium', 'high', 'critical'
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'disabled', 'archived'
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id),
  
  -- Statistics
  total_matches INTEGER DEFAULT 0, -- How many times rule matched
  total_executions INTEGER DEFAULT 0, -- How many times rule executed
  last_matched_at TIMESTAMPTZ,
  last_executed_at TIMESTAMPTZ,
  avg_execution_time_ms NUMERIC(10,2),
  
  CONSTRAINT valid_status CHECK (status IN ('active', 'disabled', 'archived'))
);

CREATE INDEX idx_rule_registry_policy ON rule_registry(policy_id);
CREATE INDEX idx_rule_registry_status ON rule_registry(status);
CREATE INDEX idx_rule_registry_last_matched ON rule_registry(last_matched_at);
```


---

## Week 6-7: Decision Context ⭐ NEW

### Objective
Auto-inject business context into every decision without manual queries.

### Current Problem
```typescript
// Policies manually query context
const customer = await getCustomer(customerId);
const employee = await getEmployee(employeeId);
const branch = await getBranch(branchId);
// Repeated code, slow, error-prone
```

### Target Solution
```typescript
// Context auto-injected
const decision = await DecisionEngine.evaluate(policy, {
  bookingId: 'booking-123'
});
// Context automatically includes: customer, employee, room, branch, promotion, holiday, weather
```

### Technical Design

#### 6.1 Context Provider Registry
```typescript
interface ContextProvider {
  name: string;
  resolve: (input: any) => Promise<any>;
  cacheTTL?: number; // Cache duration in seconds
}

class DecisionContextRegistry {
  private providers = new Map<string, ContextProvider>();
  
  register(provider: ContextProvider) {
    this.providers.set(provider.name, provider);
  }
  
  async resolveAll(input: any): Promise<Record<string, any>> {
    const context: Record<string, any> = {};
    
    for (const [name, provider] of this.providers) {
      try {
        context[name] = await provider.resolve(input);
      } catch (error) {
        console.error(`Context provider ${name} failed`, error);
        context[name] = null;
      }
    }
    
    return context;
  }
}
```

#### 6.2 Built-in Context Providers
```typescript
// Customer context
DecisionContextRegistry.register({
  name: 'customer',
  resolve: async (input) => {
    if (!input.customerId) return null;
    return await getCustomerProfile(input.customerId);
  },
  cacheTTL: 300 // 5 minutes
});

// Employee context
DecisionContextRegistry.register({
  name: 'employee',
  resolve: async (input) => {
    if (!input.employeeId) return null;
    return await getEmployeeProfile(input.employeeId);
  },
  cacheTTL: 300
});

// Branch context
DecisionContextRegistry.register({
  name: 'branch',
  resolve: async (input) => {
    if (!input.branchId) return null;
    return await getBranchInfo(input.branchId);
  },
  cacheTTL: 600 // 10 minutes
});

// Promotion context
DecisionContextRegistry.register({
  name: 'activePromotions',
  resolve: async () => {
    return await getActivePromotions();
  },
  cacheTTL: 1800 // 30 minutes
});

// Holiday context
DecisionContextRegistry.register({
  name: 'isHoliday',
  resolve: async (input) => {
    const date = input.date || new Date();
    return await isPublicHoliday(date);
  },
  cacheTTL: 3600 // 1 hour
});

// Weather context (optional, for future)
DecisionContextRegistry.register({
  name: 'weather',
  resolve: async (input) => {
    if (!input.branchId) return null;
    return await getWeatherForecast(input.branchId);
  },
  cacheTTL: 1800
});
```

### Deliverables

- [ ] Context Provider interface and registry
- [ ] Built-in context providers (customer, employee, branch, promotion, holiday)
- [ ] Cache layer for context resolution
- [ ] Integration with Decision Engine
- [ ] Tests and documentation

### Success Criteria

- ✅ Context auto-injected for all decisions
- ✅ Context resolution time < 50ms (with cache)
- ✅ Zero manual context queries in policies
- ✅ Cache hit rate > 80%

---

## Week 7-9: Action Engine ⭐ NEW

### Objective
Separate decision logic from side-effects. Decision Engine decides, Action Engine executes.

### Current Problem
```typescript
// Decision and action mixed together
if (approved) {
  await createSession();
  await sendNotification();
  await updateInventory();
  // Side-effects in decision logic = hard to test, hard to rollback
}
```

### Target Solution
```typescript
// Decision returns actions to execute
const decision = await DecisionEngine.evaluate(policy, input);
// decision.actions = ['createSession', 'sendNotification', 'updateInventory']

// Action Engine executes
await ActionEngine.execute(decision.actions, decision.context);
```

### Technical Design

#### 7.1 Action Definition
```typescript
interface Action {
  id: string;
  type: 'create' | 'update' | 'delete' | 'notify' | 'webhook' | 'custom';
  target: string; // 'session', 'notification', 'inventory', etc.
  payload: Record<string, any>;
  condition?: string; // Optional condition (Expression Engine)
  retryPolicy?: {
    maxRetries: number;
    backoff: 'linear' | 'exponential';
  };
}
```

#### 7.2 Action Registry
```typescript
class ActionRegistry {
  private handlers = new Map<string, ActionHandler>();
  
  register(target: string, handler: ActionHandler) {
    this.handlers.set(target, handler);
  }
  
  async execute(action: Action): Promise<ActionResult> {
    const handler = this.handlers.get(action.target);
    if (!handler) {
      throw new Error(`No handler for action target: ${action.target}`);
    }
    
    try {
      return await handler.execute(action.payload);
    } catch (error) {
      if (action.retryPolicy) {
        return await this.retry(action, error);
      }
      throw error;
    }
  }
}
```

#### 7.3 Built-in Action Handlers
```typescript
// Create session
ActionRegistry.register('session', {
  execute: async (payload) => {
    const session = await createSession(payload);
    return { success: true, data: session };
  }
});

// Send notification
ActionRegistry.register('notification', {
  execute: async (payload) => {
    await sendNotification(payload);
    return { success: true };
  }
});

// Update inventory
ActionRegistry.register('inventory', {
  execute: async (payload) => {
    await updateInventory(payload);
    return { success: true };
  }
});

// Webhook
ActionRegistry.register('webhook', {
  execute: async (payload) => {
    await fetch(payload.url, {
      method: 'POST',
      body: JSON.stringify(payload.data)
    });
    return { success: true };
  }
});
```

### Deliverables

- [ ] Action interface and types
- [ ] Action Registry with handler system
- [ ] Built-in action handlers (session, notification, inventory, webhook)
- [ ] Retry mechanism with exponential backoff
- [ ] Action audit log (track all executed actions)
- [ ] Integration with Decision Engine
- [ ] Tests and documentation

### Success Criteria

- ✅ All side-effects moved to Action Engine
- ✅ Decision Engine only returns decisions + actions
- ✅ Action execution tracked in audit log
- ✅ Action retry success rate > 95%
- ✅ Average action execution time < 200ms

---

## Week 13-14: Decision Simulator ⭐ NEW

### Objective
Answer "What-if" questions without deploying to production.

### Business Use Case
```
Business team: "Nếu đổi Rule VIP discount từ 10% lên 15%, revenue sẽ thay đổi thế nào?"

Bella Simulator:
  - Pull 1,000 recent bookings
  - Replay with new rule
  - Show: Approve rate: 92% → 88%
          Revenue impact: +120 triệu
          Affected customers: 42
```

### Technical Design

#### 13.1 Simulator Engine
```typescript
interface SimulationConfig {
  policyId: string;
  policyVersion: string; // 'v2.0.0' (new version to test)
  baselineVersion?: string; // 'v1.0.0' (current version, for comparison)
  sampleSize: number; // How many historical decisions to replay
  dateRange?: { start: string; end: string };
}

interface SimulationResult {
  totalDecisions: number;
  baselineApprovalRate: number;
  newApprovalRate: number;
  approvalRateDiff: number; // %
  
  changedOutcomes: number;
  changedOutcomesList: Array<{
    decisionId: string;
    baseline: 'approve' | 'reject';
    new: 'approve' | 'reject';
    reason: string;
  }>;
  
  revenueImpact?: {
    baseline: number;
    new: number;
    diff: number; // +120,000,000
  };
  
  ruleConflicts: Array<{
    ruleA: string;
    ruleB: string;
    conflictReason: string;
  }>;
}

class DecisionSimulator {
  async simulate(config: SimulationConfig): Promise<SimulationResult> {
    // 1. Load historical decisions
    const decisions = await this.loadHistoricalDecisions(config);
    
    // 2. Replay with baseline policy
    const baselineResults = await this.replayDecisions(
      decisions,
      config.baselineVersion
    );
    
    // 3. Replay with new policy
    const newResults = await this.replayDecisions(
      decisions,
      config.policyVersion
    );
    
    // 4. Compare and analyze
    return this.compare(baselineResults, newResults);
  }
}
```

### Deliverables

- [ ] Simulator Engine with replay capability
- [ ] Historical decision loader
- [ ] Comparison and diff engine
- [ ] Revenue impact calculator
- [ ] Conflict detector
- [ ] UI for simulator (business-friendly)
- [ ] Tests and documentation

### Success Criteria

- ✅ Can replay 1,000+ decisions in < 10 seconds
- ✅ Comparison shows approval rate diff, revenue impact
- ✅ Detects rule conflicts before deployment
- ✅ Business team uses simulator > 5 times/week

---

## Week 14-15: Event Bus ⭐ NEW

### Objective
Decouple decisions from actions through event-driven architecture.

### Architecture
```
Decision Engine → Decision Made
                     ↓
                 Event Bus
        ↙         ↓         ↘
   Action     Analytics   Notification
   Engine      Service      Service
```

### Technical Design

#### 14.1 Event Types
```typescript
type DecisionEvent = {
  type: 'decision.created';
  decisionId: string;
  policyId: string;
  outcome: 'approve' | 'reject';
  confidence: number;
  timestamp: string;
  context: Record<string, any>;
};

type ActionEvent = {
  type: 'action.executed' | 'action.failed';
  actionId: string;
  decisionId: string;
  target: string;
  success: boolean;
  error?: string;
  timestamp: string;
};

type PolicyEvent = {
  type: 'policy.published' | 'policy.deprecated';
  policyId: string;
  version: string;
  userId: string;
  timestamp: string;
};
```

#### 14.2 Event Bus Implementation
```typescript
class EventBus {
  private subscribers = new Map<string, Set<EventHandler>>();
  
  subscribe(eventType: string, handler: EventHandler) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    this.subscribers.get(eventType)!.add(handler);
  }
  
  async publish(event: Event) {
    const handlers = this.subscribers.get(event.type) || new Set();
    
    // Execute all handlers in parallel
    await Promise.all(
      Array.from(handlers).map(handler => handler.handle(event))
    );
    
    // Store event in event store
    await this.storeEvent(event);
  }
}
```

### Deliverables

- [ ] Event Bus implementation (using Supabase Realtime or Redis Pub/Sub)
- [ ] Event types and schemas
- [ ] Event store (append-only log)
- [ ] Event replay capability
- [ ] Integration with Decision Engine, Action Engine
- [ ] Tests and documentation

### Success Criteria

- ✅ All decisions publish events
- ✅ Event delivery latency < 100ms
- ✅ Event throughput > 10,000/day
- ✅ Zero event loss (100% delivery guarantee)

---

## Week 15-16: Decision Graph ⭐ NEW

### Objective
Visual flow diagram showing how a decision was made (CEO-friendly dashboard).

### Visual Design
```
Booking Request
    ↓
Check Customer Status
    ├─ VIP: Yes ✅
    └─ Total Bookings: 45
    ↓
Check Inventory
    ├─ Room Available: Yes ✅
    └─ Stock Level: 8/10
    ↓
Check Schedule
    ├─ Conflict: None ✅
    └─ Peak Hour: No
    ↓
Calculate Price
    ├─ Base Price: 500,000đ
    ├─ VIP Discount: -50,000đ
    └─ Final Price: 450,000đ
    ↓
[APPROVED] ✅
Confidence: 97%
```

### Technical Design

#### 15.1 Decision Node
```typescript
interface DecisionNode {
  id: string;
  type: 'input' | 'rule' | 'action' | 'output';
  label: string;
  data: Record<string, any>;
  status: 'pending' | 'success' | 'error';
  timestamp: string;
}

interface DecisionEdge {
  source: string;
  target: string;
  label?: string;
}

interface DecisionGraph {
  decisionId: string;
  nodes: DecisionNode[];
  edges: DecisionEdge[];
  outcome: 'approve' | 'reject';
  confidence: number;
  duration: number; // ms
}
```

#### 15.2 Graph Builder
```typescript
class DecisionGraphBuilder {
  async build(decisionId: string): Promise<DecisionGraph> {
    // 1. Load decision from audit log
    const decision = await getDecisionAudit(decisionId);
    
    // 2. Build nodes
    const nodes: DecisionNode[] = [];
    const edges: DecisionEdge[] = [];
    
    // Input node
    nodes.push({
      id: 'input',
      type: 'input',
      label: 'Booking Request',
      data: decision.input,
      status: 'success',
      timestamp: decision.timestamp
    });
    
    // Rule nodes (from matched rules)
    decision.matchedRules.forEach((rule, index) => {
      const nodeId = `rule-${index}`;
      nodes.push({
        id: nodeId,
        type: 'rule',
        label: rule.businessName || rule.name,
        data: {
          condition: rule.condition,
          result: rule.result,
          confidence: rule.confidence
        },
        status: rule.result === 'error' ? 'error' : 'success',
        timestamp: rule.timestamp
      });
      
      // Edge from previous node
      const prevNode = index === 0 ? 'input' : `rule-${index - 1}`;
      edges.push({ source: prevNode, target: nodeId });
    });
    
    // Output node
    const lastRuleIndex = decision.matchedRules.length - 1;
    nodes.push({
      id: 'output',
      type: 'output',
      label: decision.outcome === 'approve' ? 'APPROVED ✅' : 'REJECTED ❌',
      data: {
        outcome: decision.outcome,
        confidence: decision.confidence,
        reason: decision.reason
      },
      status: 'success',
      timestamp: decision.timestamp
    });
    
    edges.push({
      source: `rule-${lastRuleIndex}`,
      target: 'output'
    });
    
    return {
      decisionId,
      nodes,
      edges,
      outcome: decision.outcome,
      confidence: decision.confidence,
      duration: decision.duration
    };
  }
}
```

### Deliverables

- [ ] Decision Graph builder
- [ ] Graph visualization UI (React Flow or similar)
- [ ] Real-time graph updates (for in-progress decisions)
- [ ] Export graph as image/PDF
- [ ] Share graph URL
- [ ] Tests and documentation

### Success Criteria

- ✅ Every decision has a visual graph
- ✅ Graph loads in < 500ms
- ✅ CEO/Business users understand 90%+ graphs
- ✅ Graph used in > 50 decision reviews/month

---

## 📊 Updated Phase B Success Metrics

| Metric | Target | Status |
|--------|--------|--------|
| **Policy Registry** | All policies centralized | ⏳ |
| **Rule Registry** | 90%+ rules have business descriptions | ⏳ |
| **Versioning** | Git-like snapshots for all policies | ⏳ |
| **Shadow Mode** | 100% new policies shadow-tested | ⏳ |
| **Explainability** | 100% decisions have human-readable reasons | ⏳ |
| **Decision Context** | Context auto-injected for all decisions | ⏳ |
| **Action Engine** | All side-effects moved to Action Engine | ⏳ |
| **Rule Coverage** | < 5% dead rules | ⏳ |
| **Expression Engine** | Business writes 50%+ new rules | ⏳ |
| **Rule DSL** | Business reads 90%+ rules without dev help | ⏳ |
| **Decision Simulator** | Used > 5 times/week by business | ⏳ |
| **Event Bus** | 100% decisions publish events | ⏳ |
| **Decision Graph** | Used in > 50 reviews/month | ⏳ |

---

## 🎯 Why This Revised Roadmap is Better

### Before (12 weeks, 8 components)
```
Policy Registry → Rule Registry → Versioning → Shadow → Explainability
→ Coverage → Expression → DSL
```

**Problem:** Missing critical enterprise features
- ❌ No context injection (slow, error-prone queries)
- ❌ No action separation (side-effects in decision logic)
- ❌ No simulator ("what-if" questions require deployment)
- ❌ No event bus (tight coupling)
- ❌ No visual graph (hard to explain decisions)

### After (16 weeks, 13 components)
```
Policy Registry → Rule Registry → Versioning → Shadow → Explainability
→ Decision Context → Action Engine → Coverage → Expression → DSL
→ Simulator → Event Bus → Decision Graph
```

**Benefits:**
- ✅ Context auto-injected (faster, cleaner policies)
- ✅ Actions decoupled (easier testing, rollback)
- ✅ Simulator for safe testing (no production deployment needed)
- ✅ Event-driven (loosely coupled, scalable)
- ✅ Visual graph (CEO-friendly, great for demos)

---

## 🚀 Next Steps

### Week 1-2 (Starting Jul 2026):
1. Create `policy_registry` table with governance fields
2. Implement PolicyRegistry service
3. Migrate existing policies to registry
4. Tests and documentation

### Week 2-3:
1. Create `rule_registry` table with business fields
2. Implement RuleRegistry service
3. Add business descriptions to all rules
4. Tests and documentation

**After Week 16:**
- Phase B complete (Platform Foundation ready)
- Ready for Phase C (Business Integration)
- Each new policy = 1 week (vs 3 weeks without foundation)

---

## 📝 Conclusion

This revised 16-week plan transforms Decision Engine from "a module with rules" into **Bella Enterprise Intelligence Platform** with:

1. **Policy/Rule Registry** - Centralized management
2. **Versioning & Shadow Mode** - Safe deployments
3. **Explainability & Decision Graph** - CEO-friendly transparency
4. **Decision Context** - Auto-injection for faster policies
5. **Action Engine** - Clean separation of concerns
6. **Expression Engine & DSL** - Business self-service
7. **Simulator** - What-if analysis without deployment
8. **Event Bus** - Scalable, decoupled architecture

**After Phase B, adding new policies (Pricing, Discount, Payroll, etc.) will be:**
- ✅ Configuration, not architecture
- ✅ 1 week per policy (not 3 weeks)
- ✅ Shadow-tested automatically
- ✅ Event-driven by default
- ✅ Visually explainable
- ✅ Simulatable before deployment

**This is the foundation for a true Enterprise Intelligence Platform.**
