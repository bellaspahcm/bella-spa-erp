# Decision Engine Platform Architecture

**Version**: 1.0.0  
**Status**: 🔒 **Architecture Frozen** (Changes only for critical bugs or real enterprise requirements)  
**Last Updated**: 2026-06-22  
**Preceded By**: [Decision Engine Principles](./DECISION_ENGINE_PRINCIPLES.md)

---

## Document Map

This document is organized into 20 sections for comprehensive coverage:

1. [Executive Summary](#1-executive-summary)
2. [Design Principles (The 10 Commandments)](#2-design-principles-the-10-commandments)
3. [Why Stateless is Critical ⭐](#3-why-stateless-is-critical-)
4. [Decision Engine ≠ Rule Engine ⭐](#4-decision-engine--rule-engine-)
5. [What is Decision Engine Platform?](#5-what-is-decision-engine-platform)
6. [Core Components (5 Components)](#6-core-components-5-components)
7. [DecisionContext (Detailed Structure)](#7-decisioncontext-detailed-structure)
8. [DecisionResult (Standard Contract)](#8-decisionresult-standard-contract)
9. [Responsibilities (What it DOES)](#9-responsibilities-what-it-does)
10. [Out of Scope ⭐ (What we DON'T support)](#10-out-of-scope--what-we-dont-support)
11. [Dependency Rules](#11-dependency-rules)
12. [Provider Model & Roadmap](#12-provider-model--roadmap)
13. [Decision Lifecycle (Flow Diagram)](#13-decision-lifecycle-flow-diagram)
14. [Decision Types (Domain-Agnostic)](#14-decision-types-domain-agnostic)
15. [Cache Strategy](#15-cache-strategy)
16. [Event Strategy](#16-event-strategy)
17. [Observability (Metrics, Logs, Traces)](#17-observability-metrics-logs-traces)
18. [Error Strategy (Fallback Chain)](#18-error-strategy-fallback-chain)
19. [Future AI/ML Integration](#19-future-aiml-integration)
20. [Migration Path](#20-migration-path)

---

## 1. Executive Summary

### What is This?

Decision Engine Platform là **domain-agnostic decision-making capability** của Bella EIP. Nó không phải là một feature của ERP, mà là **platform infrastructure** mà mọi business module có thể sử dụng.

### Key Characteristics

| Aspect | Description |
|--------|-------------|
| **Nature** | Platform Capability (NOT business feature) |
| **Domain** | Industry-agnostic (Spa, Clinic, Manufacturing, Logistics, Education...) |
| **Architecture** | Provider-based, stateless, event-driven |
| **Extensibility** | Open for providers, closed for Engine core |
| **Target Users** | Business Modules (Payroll, CRM, Booking, Finance...) as consumers |

### Core Value Proposition

```
Before Decision Engine:
Business Module
    ↓
Hardcoded IF/ELSE logic
    ↓
Difficult to change
    ↓
Cannot scale to multiple industries

After Decision Engine:
Business Module
    ↓
DecisionEngine.evaluate(context)
    ↓
Pluggable providers (Rule/BI/AI/External)
    ↓
Easy to change, scales across industries
```

### Architecture in One Picture

```
┌─────────────────────────────────────────────────────────────┐
│                    Business Modules Layer                    │
│  (Payroll, CRM, Booking, Finance, HR, Inventory...)         │
└────────────┬────────────────────────────────────────────────┘
             │ calls
             ↓
┌─────────────────────────────────────────────────────────────┐
│                  Decision Engine Platform                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ DecisionEngine (Stateless Orchestrator)              │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     ↓                                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ProviderRegistry (Provider Selector)                 │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     ↓                                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ IDecisionProvider (Abstraction)                     │   │
│  └─────┬────────┬───────────┬──────────┬───────────────┘   │
│        ↓        ↓           ↓          ↓                    │
│  ┌─────────┐ ┌──────┐ ┌────────┐ ┌──────────┐            │
│  │  Rule   │ │  BI  │ │   AI   │ │ External │            │
│  │Provider │ │ Prov.│ │ Prov.  │ │ Provider │            │
│  └─────────┘ └──────┘ └────────┘ └──────────┘            │
└─────────────────────────────────────────────────────────────┘
             │ publishes
             ↓
┌─────────────────────────────────────────────────────────────┐
│                     Event Bus Layer                          │
│             (Audit, Observability, Workflow)                 │
└─────────────────────────────────────────────────────────────┘
```

### Design Philosophy

> **"Design for extension, implement for current needs"**

Decision Engine is designed to support **10+ years of evolution** without core refactoring:
- Today: Rule-based decisions
- Tomorrow: BI-powered insights
- Future: AI/ML predictions
- Long-term: Human-in-the-loop + multi-source composite decisions

---

## 2. Design Principles (The 10 Commandments)

**Reference**: [Full principles document](./DECISION_ENGINE_PRINCIPLES.md)

Decision Engine Platform is governed by **10 immutable principles**:

| # | Principle | Why It Matters |
|---|-----------|----------------|
| 1️⃣ | Engine MUST NOT know business modules | Enables domain independence and multi-industry support |
| 2️⃣ | Engine MUST be provider-based | All decision logic lives in replaceable providers |
| 3️⃣ | Providers MUST be replaceable | Plug-and-play providers without Engine changes |
| 4️⃣ | Engine MUST be stateless | Enables horizontal scaling and predictable behavior |
| 5️⃣ | Business logic belongs to Providers | Engine orchestrates, Providers implement |
| 6️⃣ | Providers MAY use BI/AI/External sources | Providers have full autonomy in decision-making |
| 7️⃣ | Engine returns DecisionResult only | Standard contract for all consumers |
| 8️⃣ | Engine never accesses Database directly | Pure orchestrator, no data layer |
| 9️⃣ | Engine never calls Business Modules | One-way dependency (Modules → Engine only) |
| 🔟 | All decisions are auditable | Complete audit trail for compliance and debugging |

**These principles are the "Constitution" of Decision Engine.** When there's a conflict between convenience and principles, **principles always win**.

For detailed explanations, examples, and enforcement strategies, refer to the [Decision Engine Principles document](./DECISION_ENGINE_PRINCIPLES.md).

---

## 3. Why Stateless is Critical ⭐

### The Stateless Principle

**Decision Engine MUST be stateless.** This is principle #4, but it deserves its own section because it's the **foundation of scalability**.

### What "Stateless" Means

```typescript
// ❌ STATEFUL (WRONG)
class DecisionEngine {
  private lastResult: DecisionResult; // State!
  private cache: Map<string, DecisionResult>; // State!
  private session: UserSession; // State!
  
  async evaluate(context: DecisionContext): Promise<DecisionResult> {
    // Uses instance state
    this.lastResult = await this.provider.evaluate(context);
    this.cache.set(context.id, this.lastResult);
    return this.lastResult;
  }
}

// ✅ STATELESS (CORRECT)
class DecisionEngine {
  // No instance variables except dependencies injected via constructor
  constructor(
    private readonly registry: DecisionProviderRegistry,
    private readonly eventPublisher: IEventPublisher
  ) {}
  
  async evaluate(context: DecisionContext): Promise<DecisionResult> {
    // Pure function: same input → same output
    const provider = this.registry.getProvider(context.ruleType);
    const result = await provider.evaluate(context);
    
    // Publishes event but doesn't store state
    await this.eventPublisher.publish({
      type: 'decision.evaluated',
      data: { context, result }
    });
    
    return result; // Returns immediately, no state stored
  }
}
```

### Where State SHOULD Live

| Concern | Where It Lives | Example |
|---------|----------------|---------|
| **Session/User Context** | Business Module | `booking.userId`, `payroll.employeeId` |
| **Cache** | External Cache Layer (Redis) | Cached rules, BI query results |
| **Workflow State** | Workflow Engine | Approval chain status, pending tasks |
| **Audit Trail** | Database/Event Store | Decision history, execution logs |
| **Transaction State** | Database Transaction | Multi-step booking, payment flows |

### Why Stateless Matters

#### 1. Horizontal Scaling

```
Request 1 → Decision Engine Instance A → Result
Request 2 → Decision Engine Instance B → Result
Request 3 → Decision Engine Instance C → Result

No coordination needed because there's no state to synchronize!
```

If Engine was stateful:
```
Request 1 → Instance A (stores state)
Request 2 → Instance B (doesn't have A's state) → ❌ Inconsistent result
```

#### 2. Predictable Testing

```typescript
// Stateless = Pure function = Easy to test
describe('DecisionEngine', () => {
  it('returns same result for same input', async () => {
    const engine = new DecisionEngine(registry, eventPublisher);
    
    const result1 = await engine.evaluate(context);
    const result2 = await engine.evaluate(context);
    
    expect(result1).toEqual(result2); // Always true for stateless engine
  });
});
```

#### 3. No Side Effects

```typescript
// Stateless engine doesn't mutate anything
const result = await engine.evaluate(context);

// Context is unchanged
expect(context).toEqual(originalContext);

// Engine instance is unchanged
expect(engine).not.toHaveBeenModified();
```

#### 4. Crash Safety

```
Engine Instance A crashes
    ↓
Load Balancer routes traffic to Instance B
    ↓
No state lost, no recovery needed ✅
```

### Common Stateful Anti-Patterns to Avoid

```typescript
// ❌ ANTI-PATTERN 1: Caching in instance
class DecisionEngine {
  private cache = new Map<string, DecisionResult>();
  
  async evaluate(context: DecisionContext): Promise<DecisionResult> {
    if (this.cache.has(context.id)) {
      return this.cache.get(context.id)!; // State-dependent!
    }
    // ...
  }
}

// ✅ CORRECT: Inject cache dependency
class DecisionEngine {
  constructor(
    private readonly cache: ICache // External cache service
  ) {}
  
  async evaluate(context: DecisionContext): Promise<DecisionResult> {
    const cached = await this.cache.get(context.id);
    if (cached) return cached;
    // ...
  }
}

// ❌ ANTI-PATTERN 2: Session management
class DecisionEngine {
  private currentUser: User;
  
  setUser(user: User) {
    this.currentUser = user; // State!
  }
  
  async evaluate(context: DecisionContext): Promise<DecisionResult> {
    // Uses stored user
    if (!this.currentUser) throw new Error('No user set');
    // ...
  }
}

// ✅ CORRECT: User in context
class DecisionEngine {
  async evaluate(context: DecisionContext): Promise<DecisionResult> {
    // User passed in context, not stored
    const user = context.user;
    // ...
  }
}

// ❌ ANTI-PATTERN 3: Workflow state
class DecisionEngine {
  private pendingApprovals = new Set<string>();
  
  async evaluate(context: DecisionContext): Promise<DecisionResult> {
    if (this.pendingApprovals.has(context.id)) {
      return { approved: false, reason: 'Pending approval' };
    }
    // ...
  }
}

// ✅ CORRECT: Delegate to Workflow Engine
class DecisionEngine {
  async evaluate(context: DecisionContext): Promise<DecisionResult> {
    // Decision Engine doesn't manage workflows
    // Just returns decision result
    const result = await provider.evaluate(context);
    
    // Business module handles workflow
    await this.eventPublisher.publish({
      type: 'decision.evaluated',
      data: { context, result }
    });
    
    return result;
  }
}
```

### Stateless vs Stateful Providers

**Important distinction**: While **Engine must be stateless**, **Providers MAY be stateful** (if needed).

```typescript
// ✅ Stateless Engine
class DecisionEngine {
  async evaluate(context: DecisionContext): Promise<DecisionResult> {
    const provider = this.registry.getProvider(context.ruleType);
    return provider.evaluate(context); // Delegates, no state
  }
}

// ✅ Provider CAN have internal state (e.g., cached rules)
class RuleProvider implements IDecisionProvider {
  private ruleCache: Map<string, Rule>; // Provider-level cache OK
  
  async evaluate(context: DecisionContext): Promise<DecisionResult> {
    // Provider manages its own cache
    const rule = await this.getRuleCached(context.rule);
    return this.evaluateRule(rule, context.data);
  }
  
  private async getRuleCached(ruleId: string): Promise<Rule> {
    if (!this.ruleCache.has(ruleId)) {
      const rule = await this.loadRule(ruleId);
      this.ruleCache.set(ruleId, rule);
    }
    return this.ruleCache.get(ruleId)!;
  }
}
```

**Why this is OK**: Provider state is **internal implementation detail**. As long as Engine doesn't depend on provider state, we maintain statelessness at the **Engine orchestration level**.

### Architecture Boundary

```
┌─────────────────────────────────────┐
│   Decision Engine (STATELESS)       │ ← No state, pure orchestration
│   ┌─────────────────────────────┐   │
│   │ evaluate(context) → result  │   │
│   └─────────────────────────────┘   │
└──────────────┬──────────────────────┘
               │ delegates to
               ↓
┌─────────────────────────────────────┐
│   Providers (MAY be stateful)       │ ← Internal state OK
│   ┌─────────────────────────────┐   │
│   │ RuleProvider (cached rules) │   │
│   │ BIProvider (connection pool)│   │
│   │ AIProvider (model cache)    │   │
│   └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### Summary

✅ **Stateless Engine** = Scalable, testable, predictable, crash-safe

❌ **Stateful Engine** = Cannot scale horizontally, hard to test, unpredictable, fragile

**The Rule**: Engine is stateless. State belongs to:
- **Business Modules** (session, workflow)
- **External Services** (cache, database, event store)
- **Providers** (internal implementation details)

---

## 4. Decision Engine ≠ Rule Engine ⭐

### The Critical Distinction

**Decision Engine is NOT the same as Rule Engine.**

Many developers make this mistake because rules are the most common decision source. But equating "Decision Engine" with "Rule Engine" is like equating "Database" with "PostgreSQL" — it's just one implementation.

### What is a Rule Engine?

```
Rule Engine = A system that evaluates IF-THEN-ELSE rules
Example: Drools, Easy Rules, JSON Rules Engine
```

**Rule Engine characteristics**:
- Evaluates boolean conditions (IF age > 18 THEN approve)
- Uses rule definition language (JSON, DSL, RETE algorithm)
- Returns pass/fail based on rule matching
- **Singular decision source**: Rules only

### What is Decision Engine Platform?

```
Decision Engine = A platform that provides decisions from MULTIPLE sources
Example: Bella Decision Engine Platform
```

**Decision Engine characteristics**:
- **Multi-source**: Rules, BI queries, AI predictions, External APIs, Manual approvals
- **Provider-based**: Rule Provider is ONE provider among many
- **Orchestration**: Selects appropriate provider based on context
- **Extensible**: Add new decision sources without changing Engine core

### Visual Comparison

```
Rule Engine (Narrow Scope):
    Business Module
        ↓
    Rule Engine
        ↓
    IF-THEN Rules
        ↓
    true/false

Decision Engine Platform (Broad Scope):
    Business Module
        ↓
    Decision Engine (Orchestrator)
        ↓ selects provider based on context
    ┌────────┬────────┬────────┬──────────┬─────────┐
    ↓        ↓        ↓        ↓          ↓         
  Rule    BI      AI     External   Manual
 Provider Provider Provider Provider  Approval
    ↓        ↓        ↓        ↓          ↓
 IF-THEN  Query   ML     API      Human
  Rules   Result  Model  Call     Review
    ↓        ↓        ↓        ↓          ↓
    └────────┴────────┴────────┴──────────┘
               ↓
        DecisionResult
```

### Provider Ecosystem

```typescript
// Rule Engine mindset (limited):
const result = ruleEngine.evaluate(rule, data);
// Only supports rules ❌

// Decision Engine mindset (flexible):
const result = await decisionEngine.evaluate({
  ruleType: 'if-then',        // or 'bi-query' or 'ml-model'
  rule: autoApprovalRule,      // or biQuery or mlModelId
  data: { amount: 5000000 }
});
// Supports multiple decision sources ✅
```

### Why This Matters

#### Scenario 1: Evolution Over Time

```
Year 1: Use rules (simple thresholds)
    "If amount < 5M → auto-approve"

Year 2: Use BI (data-driven insights)
    "Query approval rate by customer segment"

Year 3: Use AI (predictive models)
    "Predict approval likelihood based on 50+ features"

Year 4: Composite (rules + AI + manual review)
    "Rules filter → AI scores → Human approves edge cases"
```

**With Rule Engine**: Need to rewrite entire system 4 times ❌

**With Decision Engine Platform**: Just add/switch providers ✅

#### Scenario 2: Different Decisions Need Different Sources

```
Decision Type          Best Source
─────────────────────────────────────────────────────
Auto-approval          Rule (fast, deterministic)
Fraud detection        AI (pattern recognition)
Discount optimization  BI (historical data analysis)
Credit limit           External (credit bureau API)
Edge cases             Manual (human judgment)
```

**Rule Engine**: Forces everything through rules (one-size-fits-all) ❌

**Decision Engine Platform**: Use right tool for each decision ✅

### Architecture Comparison

```
┌──────────────────────────────────────────────────────────┐
│ Rule Engine Architecture (Monolithic)                    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Business Logic                                          │
│       ↓                                                  │
│  Rule Engine Core                                        │
│       ↓                                                  │
│  Rule Evaluator (IF-THEN only)                          │
│       ↓                                                  │
│  true/false                                              │
│                                                          │
│  ❌ Cannot add new decision sources                      │
│  ❌ Rules are hardcoded into engine                      │
│  ❌ No support for BI/AI/External                        │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ Decision Engine Platform Architecture (Modular)          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Business Logic                                          │
│       ↓                                                  │
│  Decision Engine Core (Orchestrator)                     │
│       ↓                                                  │
│  Provider Registry (Selector)                            │
│       ↓                                                  │
│  ┌────────┬────────┬────────┬──────────┐               │
│  │  Rule  │   BI   │   AI   │ External │               │
│  │Provider│Provider│Provider│ Provider │               │
│  └────────┴────────┴────────┴──────────┘               │
│                                                          │
│  ✅ Add providers without changing Engine                │
│  ✅ Each provider has its own implementation             │
│  ✅ Supports any decision source (current + future)      │
└──────────────────────────────────────────────────────────┘
```

### Real-World Example: Auto-Approval Evolution

**Phase 1: Simple Rule (Rule Provider)**
```typescript
// Rule: Auto-approve if amount < 5M VND
const rule = {
  type: 'if-then',
  condition: { field: 'amount', operator: '<', value: 5000000 },
  action: { approve: true }
};

const result = await decisionEngine.evaluate({
  ruleType: 'if-then',
  rule: rule,
  data: { amount: 3000000 }
});
// Uses RuleProvider internally
```

**Phase 2: Data-Driven Threshold (BI Provider)**
```typescript
// Query: Get approval threshold based on customer tier
const biQuery = {
  type: 'bi-query',
  query: 'SELECT approval_threshold FROM customer_segments WHERE tier = :tier',
  params: { tier: 'vip' }
};

const result = await decisionEngine.evaluate({
  ruleType: 'bi-query',
  rule: biQuery,
  data: { amount: 8000000, tier: 'vip' }
});
// Uses BIProvider internally
```

**Phase 3: AI Prediction (AI Provider)**
```typescript
// ML Model: Predict approval likelihood
const mlModel = {
  type: 'ml-model',
  modelId: 'booking-approval-v2',
  features: ['amount', 'customerHistory', 'seasonality', 'capacity']
};

const result = await decisionEngine.evaluate({
  ruleType: 'ml-model',
  rule: mlModel,
  data: {
    amount: 10000000,
    customerHistory: { bookings: 15, cancellations: 1 },
    seasonality: 'peak',
    capacity: 0.8
  }
});
// Uses AIProvider internally
```

**Key Point**: Same `decisionEngine.evaluate()` API, different providers. **Business modules don't need to change.**

### When to Use Each

| Use Case | Provider | Why |
|----------|----------|-----|
| Simple thresholds | Rule Provider | Fast, deterministic, easy to debug |
| Historical analysis | BI Provider | Leverages existing BI infrastructure |
| Pattern recognition | AI Provider | Handles complex, non-linear patterns |
| External data | External Provider | Integrates 3rd-party services |
| Edge cases | Manual Provider | Human judgment for ambiguous cases |
| Multi-stage | Composite Provider | Chains multiple providers |

### Common Misconceptions

❌ **Misconception 1**: "Decision Engine is just a fancy name for Rule Engine"
✅ **Reality**: Decision Engine is a **platform** that supports rules as ONE option among many.

❌ **Misconception 2**: "We only need rules, so we don't need Decision Engine"
✅ **Reality**: Today you need rules. Tomorrow you may need BI insights or AI predictions. Decision Engine gives you **future flexibility** without refactoring.

❌ **Misconception 3**: "Decision Engine is over-engineered for simple rules"
✅ **Reality**: The abstraction cost is minimal, but the **evolution cost savings** are massive. Pay a little upfront for 10x easier scaling later.

### The Provider Principle

> **Rule Provider is ONE provider. Decision Engine is the PLATFORM.**

```
Decision Engine Platform
    │
    ├─ RuleProvider (phase 1) ✅
    ├─ BIProvider (phase 2) 🚧
    ├─ AIProvider (phase 3) 📅
    ├─ ExternalProvider (phase 4) 📅
    ├─ ManualProvider (phase 5) 📅
    └─ CompositeProvider (phase 6) 📅
```

### Summary

| Aspect | Rule Engine | Decision Engine Platform |
|--------|-------------|--------------------------|
| **Scope** | Single decision source (rules) | Multiple decision sources |
| **Extensibility** | Hard to add new sources | Easy to add new providers |
| **Evolution** | Requires refactoring | Swap providers, no refactoring |
| **Flexibility** | One-size-fits-all | Right tool for each decision |
| **Architecture** | Monolithic | Provider-based |

**Remember**: When you see "Decision Engine" in Bella EIP, think **"Platform for all decision sources"**, not just **"Rule Engine"**.

---

## 5. What is Decision Engine Platform?

### Definition

**Decision Engine Platform** is a **domain-agnostic infrastructure component** that provides automated decision-making capabilities to business modules across any industry vertical.

```
Decision Engine Platform = Orchestration Layer + Provider Ecosystem + Observability
```

### What It Is

```
✅ Platform capability (like Database, Auth, Cache)
✅ Decision orchestrator (selects and delegates to providers)
✅ Provider ecosystem (supports multiple decision sources)
✅ Domain-agnostic (works for any industry)
✅ Stateless service (pure orchestration, no state)
✅ Event-driven (publishes decision events)
✅ Auditable (full trace of every decision)
✅ Extensible (add providers without changing Engine)
```

### What It Is NOT

```
❌ Business module (not tied to Payroll, CRM, Booking, etc.)
❌ Rule Engine (rules are ONE provider, not the Engine itself)
❌ Workflow Engine (doesn't manage approval chains)
❌ Database (doesn't persist data)
❌ Business logic repository (logic lives in Providers)
❌ UI component (no visual rule builder in Engine core)
❌ Industry-specific (not built for Spa/Clinic/Retail only)
```

### Core Responsibilities

```typescript
// Engine does 5 things:
class DecisionEngine {
  async evaluate(context: DecisionContext): Promise<DecisionResult> {
    // 1. Select provider based on context
    const provider = this.selectProvider(context.ruleType);
    
    // 2. Delegate evaluation to provider
    const result = await provider.evaluate(context);
    
    // 3. Handle errors (with fallback strategy)
    if (!result) {
      return this.handleError(context);
    }
    
    // 4. Publish decision events
    await this.eventPublisher.publish({
      type: 'decision.evaluated',
      data: { context, result }
    });
    
    // 5. Return standardized result
    return result;
  }
}
```

**That's it.** Engine does NOT:
- Validate business rules ← Provider's job
- Query database ← Provider's job
- Calculate KPIs ← Provider's job
- Manage workflows ← Workflow Engine's job
- Store decisions ← Business Module's job

### Multi-Industry Support

Decision Engine Platform is designed to work across **any industry vertical**:

```
Bella EIP
    │
    ├─ Beauty Spa Industry
    │   └─ Uses Decision Engine for: Auto-booking, KPI thresholds, Discount rules
    │
    ├─ Healthcare Clinic Industry
    │   └─ Uses Decision Engine for: Appointment approval, Treatment plans, Insurance claims
    │
    ├─ Manufacturing Industry
    │   └─ Uses Decision Engine for: Quality control, Production scheduling, Supplier selection
    │
    ├─ Logistics Industry
    │   └─ Uses Decision Engine for: Route optimization, Delivery approval, Pricing rules
    │
    └─ Education Industry
        └─ Uses Decision Engine for: Course enrollment, Scholarship approval, Grading rules
```

**Key point**: Engine doesn't know about "Spa sessions" or "Clinic appointments". It only knows `DecisionContext` and `DecisionResult`.

### Platform Layer Positioning

```
┌───────────────────────────────────────────────────────────┐
│                    Application Layer                       │
│  (Spa App, Clinic App, Manufacturing App, Logistics App)  │
└─────────────────────────┬─────────────────────────────────┘
                          │
┌─────────────────────────▼─────────────────────────────────┐
│                  Business Modules Layer                    │
│  (Payroll, CRM, Booking, Finance, HR, Inventory, Sales)   │
└─────────────────────────┬─────────────────────────────────┘
                          │ uses
┌─────────────────────────▼─────────────────────────────────┐
│             Platform Capabilities Layer ⭐                │
│  ┌──────────────┐ ┌─────────────┐ ┌──────────────┐      │
│  │ Decision     │ │ Workflow    │ │ Auth         │      │
│  │ Engine       │ │ Engine      │ │ Service      │      │
│  └──────────────┘ └─────────────┘ └──────────────┘      │
│  ┌──────────────┐ ┌─────────────┐ ┌──────────────┐      │
│  │ Event Bus    │ │ Cache       │ │ Notification │      │
│  └──────────────┘ └─────────────┘ └──────────────┘      │
└───────────────────────────────────────────────────────────┘
```

Decision Engine is at the **same layer** as Auth, Cache, and Workflow Engine. It's **infrastructure**, not a feature.

### Industry-Agnostic Design

**Example: Auto-Approval**

```typescript
// ❌ WRONG: Industry-specific
class DecisionEngine {
  async approveBooking(booking: SpaBooking): Promise<boolean> {
    if (booking.totalAmount < 5000000) return true;
    return false;
  }
}

// ✅ CORRECT: Industry-agnostic
class DecisionEngine {
  async evaluate(context: DecisionContext): Promise<DecisionResult> {
    const provider = this.registry.getProvider(context.ruleType);
    return provider.evaluate(context);
  }
}

// Spa module maps its domain to context
const result = await decisionEngine.evaluate({
  tenantId: 'spa-bella-vn',
  module: 'booking',
  decisionType: 'auto-approval',
  ruleType: 'if-then',
  rule: { condition: { field: 'amount', operator: '<', value: 5000000 } },
  data: { amount: booking.totalAmount }
});

// Clinic module uses same Engine with different context
const result = await decisionEngine.evaluate({
  tenantId: 'clinic-medcenter',
  module: 'appointment',
  decisionType: 'auto-approval',
  ruleType: 'if-then',
  rule: { condition: { field: 'insuranceCoverage', operator: '>=', value: 80 } },
  data: { insuranceCoverage: appointment.coverage }
});
```

### Value Proposition

| Before Decision Engine | After Decision Engine |
|------------------------|------------------------|
| IF-ELSE hardcoded in modules | Centralized decision orchestration |
| Difficult to change rules | Change rules without code |
| No audit trail | Full decision traceability |
| Cannot scale to multiple industries | Works for any industry |
| Cannot evolve (rules → BI → AI) | Easy evolution via providers |
| Duplicated logic across modules | Single source of truth |

### Design Goals

1. **Domain Independence**: Works for any industry (Spa, Clinic, Manufacturing, Logistics, Retail, Education, Finance, Healthcare, etc.)
2. **Provider Flexibility**: Support any decision source (Rules, BI, AI, External APIs, Human Review)
3. **Stateless Scaling**: Horizontal scaling without state synchronization
4. **Auditability**: Complete trace of every decision for compliance
5. **Extensibility**: Add capabilities without modifying Engine core
6. **Performance**: Sub-50ms decision latency (target), <10ms with cache
7. **Reliability**: Fallback strategies for provider failures

### Usage Pattern

```typescript
// Step 1: Business module prepares context
const context: DecisionContext = {
  tenantId: 'bella-spa-vietnam',
  module: 'payroll',
  decisionType: 'kpi-eligibility',
  user: { id: '123', role: 'ktv' },
  correlationId: uuidv4(),
  
  // Provider-specific
  ruleType: 'if-then',
  rule: {
    condition: {
      and: [
        { field: 'totalSessions', operator: '>=', value: 26 },
        { field: 'avgRating', operator: '>=', value: 4.5 }
      ]
    },
    action: { eligible: true }
  },
  
  // Input data
  data: {
    totalSessions: employee.sessionsCount,
    avgRating: employee.avgRating
  },
  
  metadata: {
    month: '2026-06',
    employeeId: employee.id
  }
};

// Step 2: Call Decision Engine
const result = await decisionEngine.evaluate(context);

// Step 3: Handle result
if (result.approved) {
  await payrollService.applyKPIBonus(employee, result.metadata.bonusAmount);
} else {
  await notificationService.notify(employee, result.reason);
}

// Step 4: Audit (automatic via events)
// Engine already published 'decision.evaluated' event
// Audit handler saves to audit log automatically
```

### Summary

Decision Engine Platform is:
- **A platform capability** (like Auth, Cache, Database)
- **Domain-agnostic** (works for any industry)
- **Provider-based** (supports multiple decision sources)
- **Stateless** (horizontally scalable)
- **Event-driven** (observable and auditable)
- **Extensible** (grow without core refactoring)

It's **NOT** a Rule Engine, NOT a Workflow Engine, NOT a Business Module. It's the **decision-making infrastructure** that powers Bella EIP across all industries.

---

## 6. Core Components (5 Components)

Decision Engine Platform consists of **5 core components**:

```
┌─────────────────────────────────────────────────────────────┐
│                    1. DecisionEngine                         │
│                  (Stateless Orchestrator)                    │
└────────────────────────┬────────────────────────────────────┘
                         │ uses
┌────────────────────────▼────────────────────────────────────┐
│              2. DecisionProviderRegistry                     │
│                  (Provider Selector)                         │
└────────────────────────┬────────────────────────────────────┘
                         │ returns
┌────────────────────────▼────────────────────────────────────┐
│              3. IDecisionProvider                            │
│           (Provider Interface/Abstraction)                   │
└────────────────────────┬────────────────────────────────────┘
                         │ implements
         ┌───────────────┼───────────────┬────────────┐
         │               │               │            │
┌────────▼────┐  ┌───────▼──────┐ ┌─────▼──────┐  ┌─▼─────────┐
│ RuleProvider│  │ BIProvider   │ │ AIProvider │  │ External  │
│  (Phase 1)  │  │  (Phase 2)   │ │ (Phase 3)  │  │ (Phase 4) │
└─────────────┘  └──────────────┘ └────────────┘  └───────────┘

┌─────────────────────────────────────────────────────────────┐
│                 4. DecisionContext                           │
│               (Input to Engine)                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                 5. DecisionResult                            │
│              (Output from Engine)                            │
└─────────────────────────────────────────────────────────────┘
```

---

### Component 1: DecisionEngine

**Role**: Stateless orchestrator that coordinates decision evaluation.

**Responsibilities**:
1. Receive `DecisionContext` from business modules
2. Select appropriate provider from registry
3. Delegate evaluation to provider
4. Handle errors with fallback strategy
5. Publish decision events
6. Return `DecisionResult`

**Interface**:
```typescript
interface IDecisionEngine {
  /**
   * Evaluate a decision based on context
   * @param context - Decision context with all input data
   * @returns Promise<DecisionResult> - Standardized decision result
   */
  evaluate(context: DecisionContext): Promise<DecisionResult>;
}
```

**Implementation** (simplified):
```typescript
class DecisionEngine implements IDecisionEngine {
  constructor(
    private readonly registry: DecisionProviderRegistry,
    private readonly eventPublisher: IEventPublisher,
    private readonly logger: ILogger
  ) {}

  async evaluate(context: DecisionContext): Promise<DecisionResult> {
    const startTime = Date.now();
    
    try {
      // 1. Select provider
      const provider = this.registry.getProvider(context.ruleType);
      if (!provider) {
        throw new ProviderNotFoundError(context.ruleType);
      }

      // 2. Delegate to provider
      const result = await provider.evaluate(context);

      // 3. Enrich with execution metadata
      const enrichedResult = {
        ...result,
        executionTime: Date.now() - startTime,
        provider: provider.name,
        timestamp: new Date()
      };

      // 4. Publish event
      await this.publishDecisionEvent(context, enrichedResult);

      // 5. Log for observability
      this.logger.info('Decision evaluated', {
        tenantId: context.tenantId,
        module: context.module,
        decisionType: context.decisionType,
        approved: result.approved,
        executionTime: enrichedResult.executionTime
      });

      return enrichedResult;
    } catch (error) {
      // 6. Handle errors with fallback
      return this.handleError(context, error, startTime);
    }
  }

  private async publishDecisionEvent(
    context: DecisionContext,
    result: DecisionResult
  ): Promise<void> {
    await this.eventPublisher.publish({
      type: 'decision.evaluated',
      timestamp: new Date(),
      data: {
        tenantId: context.tenantId,
        module: context.module,
        decisionType: context.decisionType,
        correlationId: context.correlationId,
        input: context.data,
        output: result
      }
    });
  }

  private async handleError(
    context: DecisionContext,
    error: Error,
    startTime: number
  ): Promise<DecisionResult> {
    // Error handling strategy (see section 18)
    this.logger.error('Decision evaluation failed', {
      context,
      error: error.message,
      executionTime: Date.now() - startTime
    });

    // Return safe default
    return {
      approved: false,
      confidence: 0,
      reason: `Evaluation failed: ${error.message}`,
      executionTime: Date.now() - startTime,
      provider: 'error-handler',
      timestamp: new Date()
    };
  }
}
```

**Key Characteristics**:
- ✅ Stateless (no instance variables except injected dependencies)
- ✅ Pure orchestrator (no business logic)
- ✅ Error-resilient (fallback strategy)
- ✅ Observable (logs and events)

---

### Component 2: DecisionProviderRegistry

**Role**: Provider selector and manager.

**Responsibilities**:
1. Store registered providers
2. Select provider based on `ruleType`
3. Validate provider registration
4. Support provider discovery

**Interface**:
```typescript
interface IDecisionProviderRegistry {
  /**
   * Register a decision provider
   * @param provider - Provider instance
   */
  register(provider: IDecisionProvider): void;

  /**
   * Get provider by rule type
   * @param ruleType - Type of rule/decision (e.g., 'if-then', 'bi-query', 'ml-model')
   * @returns Provider instance or undefined
   */
  getProvider(ruleType: string): IDecisionProvider | undefined;

  /**
   * Get all registered providers
   * @returns Array of provider names
   */
  listProviders(): string[];
}
```

**Implementation**:
```typescript
class DecisionProviderRegistry implements IDecisionProviderRegistry {
  private providers = new Map<string, IDecisionProvider>();

  register(provider: IDecisionProvider): void {
    // Validate provider
    if (!provider.name || !provider.supportedRuleTypes) {
      throw new Error('Invalid provider: missing name or supportedRuleTypes');
    }

    // Register for each supported rule type
    for (const ruleType of provider.supportedRuleTypes) {
      if (this.providers.has(ruleType)) {
        throw new Error(
          `Provider conflict: ${ruleType} already handled by ${
            this.providers.get(ruleType)!.name
          }`
        );
      }
      this.providers.set(ruleType, provider);
    }
  }

  getProvider(ruleType: string): IDecisionProvider | undefined {
    return this.providers.get(ruleType);
  }

  listProviders(): string[] {
    const uniqueProviders = new Set(
      Array.from(this.providers.values()).map((p) => p.name)
    );
    return Array.from(uniqueProviders);
  }
}
```

**Usage**:
```typescript
// Bootstrap: Register providers
const registry = new DecisionProviderRegistry();
registry.register(new RuleProvider());
registry.register(new BIProvider());
registry.register(new AIProvider());

// Runtime: Engine uses registry
const engine = new DecisionEngine(registry, eventPublisher, logger);

// Context specifies rule type → Registry selects provider
const result = await engine.evaluate({
  ruleType: 'if-then', // ← Registry returns RuleProvider
  // ...
});
```

---

### Component 3: IDecisionProvider

**Role**: Abstraction for all decision providers.

**Interface**:
```typescript
interface IDecisionProvider {
  /**
   * Provider name (e.g., 'RuleProvider', 'BIProvider')
   */
  readonly name: string;

  /**
   * Rule types this provider supports (e.g., ['if-then', 'decision-table'])
   */
  readonly supportedRuleTypes: string[];

  /**
   * Evaluate decision based on context
   * @param context - Decision context
   * @returns Promise<DecisionResult> - Decision result
   */
  evaluate(context: DecisionContext): Promise<DecisionResult>;

  /**
   * Validate if this provider can handle the context
   * @param context - Decision context
   * @returns boolean - True if provider can handle context
   */
  canHandle(context: DecisionContext): boolean;
}
```

**Example Implementations**:

```typescript
// RuleProvider (Phase 1)
class RuleProvider implements IDecisionProvider {
  readonly name = 'RuleProvider';
  readonly supportedRuleTypes = ['if-then', 'decision-table', 'decision-tree'];

  async evaluate(context: DecisionContext): Promise<DecisionResult> {
    // Parse rule definition
    const rule = this.parseRule(context.rule);
    
    // Evaluate rule against data
    const matched = this.evaluateRule(rule, context.data);
    
    return {
      approved: matched,
      confidence: 1.0, // Rules are deterministic
      reason: matched ? 'Rule matched' : 'Rule not matched',
      matchedRules: matched ? [rule.id] : [],
      executionTime: 0, // Filled by Engine
      provider: this.name,
      timestamp: new Date()
    };
  }

  canHandle(context: DecisionContext): boolean {
    return this.supportedRuleTypes.includes(context.ruleType);
  }

  private parseRule(ruleDef: unknown): Rule {
    // Implementation: Parse JSON rule definition
    // ...
  }

  private evaluateRule(rule: Rule, data: Record<string, unknown>): boolean {
    // Implementation: Evaluate IF-THEN-ELSE logic
    // ...
  }
}

// BIProvider (Phase 2 - future)
class BIProvider implements IDecisionProvider {
  readonly name = 'BIProvider';
  readonly supportedRuleTypes = ['bi-query', 'sql-query', 'dashboard-metric'];

  constructor(private readonly biClient: IBIClient) {}

  async evaluate(context: DecisionContext): Promise<DecisionResult> {
    // Execute BI query
    const query = context.rule as BIQuery;
    const result = await this.biClient.execute(query);
    
    return {
      approved: result.value > query.threshold,
      confidence: 0.9, // BI results have some uncertainty
      reason: `BI metric: ${result.value} (threshold: ${query.threshold})`,
      metadata: { biResult: result },
      executionTime: 0,
      provider: this.name,
      timestamp: new Date()
    };
  }

  canHandle(context: DecisionContext): boolean {
    return this.supportedRuleTypes.includes(context.ruleType);
  }
}

// AIProvider (Phase 3 - future)
class AIProvider implements IDecisionProvider {
  readonly name = 'AIProvider';
  readonly supportedRuleTypes = ['ml-model', 'ai-prediction', 'neural-network'];

  constructor(private readonly mlClient: IMLClient) {}

  async evaluate(context: DecisionContext): Promise<DecisionResult> {
    // Call ML model
    const model = context.rule as MLModel;
    const prediction = await this.mlClient.predict(model.id, context.data);
    
    return {
      approved: prediction.result === 'approve',
      confidence: prediction.confidence, // 0.0 to 1.0
      reason: prediction.explanation,
      metadata: { prediction },
      executionTime: 0,
      provider: this.name,
      timestamp: new Date()
    };
  }

  canHandle(context: DecisionContext): boolean {
    return this.supportedRuleTypes.includes(context.ruleType);
  }
}
```

**Key Points**:
- All providers implement same interface
- Each provider handles specific rule types
- Providers are independent and replaceable
- Engine doesn't know provider internals

---

### Component 4: DecisionContext

**See detailed structure in [Section 7](#7-decisioncontext-detailed-structure)**

Quick overview:
```typescript
interface DecisionContext {
  // Tenant & Module
  tenantId: string;
  module: string;
  decisionType: string;
  
  // User & Tracing
  user?: { id: string; role: string };
  correlationId?: string;
  
  // Provider-specific
  ruleType: string; // 'if-then', 'bi-query', 'ml-model', etc.
  rule: unknown; // Rule definition (provider-specific)
  
  // Input data
  data: Record<string, unknown>;
  
  // Metadata
  metadata?: Record<string, unknown>;
  timestamp?: Date;
}
```

---

### Component 5: DecisionResult

**See detailed structure in [Section 8](#8-decisionresult-standard-contract)**

Quick overview:
```typescript
interface DecisionResult {
  // Core decision
  approved: boolean;
  confidence: number; // 0.0 to 1.0
  
  // Optional details
  action?: { type: string; data: Record<string, unknown> };
  reason?: string;
  matchedRules?: string[];
  recommendations?: string[];
  nextActions?: string[];
  metadata?: Record<string, unknown>;
  
  // Execution context
  executionTime: number; // milliseconds
  provider: string;
  timestamp: Date;
}
```

---

### Component Interaction Flow

```
Business Module
    │
    │ 1. Prepares DecisionContext
    ↓
DecisionEngine
    │
    │ 2. Calls registry.getProvider(context.ruleType)
    ↓
DecisionProviderRegistry
    │
    │ 3. Returns IDecisionProvider instance
    ↓
IDecisionProvider (e.g., RuleProvider)
    │
    │ 4. Evaluates context and returns DecisionResult
    ↓
DecisionEngine
    │
    │ 5. Publishes event
    ↓
Event Bus
    │
    │ 6. Returns DecisionResult
    ↓
Business Module
    │
    │ 7. Handles result (approve/reject/recommend)
    ↓
Business Logic Execution
```

---

### Summary

The 5 core components work together:

1. **DecisionEngine**: Orchestrates the entire flow
2. **DecisionProviderRegistry**: Selects the right provider
3. **IDecisionProvider**: Abstraction implemented by all providers
4. **DecisionContext**: Standard input contract
5. **DecisionResult**: Standard output contract

**Key principles**:
- Engine is stateless
- Providers are pluggable
- Contracts are standardized
- Flow is event-driven

---

## 7. DecisionContext (Detailed Structure)

### Purpose

`DecisionContext` is the **standard input contract** for all decision evaluations. It carries:
- Business context (tenant, module, user)
- Decision metadata (type, correlation)
- Provider instructions (rule type, rule definition)
- Input data (facts to evaluate)
- Tracing information (timestamps, metadata)

### Full Structure

```typescript
interface DecisionContext {
  // ============ Tenant & Module Context ============
  /**
   * Tenant identifier (multi-tenancy support)
   * Example: 'bella-spa-vn', 'clinic-medcenter', 'factory-xyz'
   */
  tenantId: string;

  /**
   * Business module making the decision
   * Example: 'payroll', 'booking', 'crm', 'inventory', 'finance'
   */
  module: string;

  /**
   * Type of decision being made (module-specific)
   * Example: 'auto-approval', 'kpi-eligibility', 'discount-calculation'
   */
  decisionType: string;

  // ============ User & Authorization Context ============
  /**
   * User initiating the decision (optional)
   * Used for audit trail and authorization
   */
  user?: {
    id: string;
    role: string;
    email?: string;
    name?: string;
    permissions?: string[];
  };

  // ============ Tracing & Correlation ============
  /**
   * Correlation ID for distributed tracing
   * Links decisions across services and workflows
   */
  correlationId?: string;

  /**
   * Parent decision ID (for chained decisions)
   * Example: Discount decision → Approval decision
   */
  parentDecisionId?: string;

  /**
   * Request timestamp (when decision was initiated)
   */
  timestamp?: Date;

  // ============ Provider Selection ============
  /**
   * Rule type determines which provider handles this decision
   * 
   * Supported types (extensible):
   * - 'if-then': Simple conditional rules (RuleProvider)
   * - 'decision-table': Table-based rules (RuleProvider)
   * - 'decision-tree': Tree-based rules (RuleProvider)
   * - 'bi-query': Business Intelligence queries (BIProvider)
   * - 'sql-query': Direct SQL queries (BIProvider)
   * - 'ml-model': Machine Learning models (AIProvider)
   * - 'ai-prediction': AI predictions (AIProvider)
   * - 'external-api': External service calls (ExternalProvider)
   * - 'manual-review': Human review (ManualProvider)
   * - 'composite': Chain multiple providers (CompositeProvider)
   */
  ruleType: string;

  /**
   * Rule definition (provider-specific structure)
   * 
   * For RuleProvider (if-then):
   *   {
   *     condition: { field: 'amount', operator: '<', value: 5000000 },
   *     action: { approve: true }
   *   }
   * 
   * For BIProvider (bi-query):
   *   {
   *     query: 'SELECT approval_rate FROM metrics WHERE segment = :segment',
   *     params: { segment: 'vip' },
   *     threshold: 0.8
   *   }
   * 
   * For AIProvider (ml-model):
   *   {
   *     modelId: 'booking-approval-v2',
   *     features: ['amount', 'customerHistory', 'seasonality']
   *   }
   */
  rule: unknown; // Provider-specific type

  // ============ Input Data ============
  /**
   * Data to evaluate (facts for decision-making)
   * 
   * Example for booking approval:
   *   {
   *     amount: 8000000,
   *     customerTier: 'vip',
   *     bookingHistory: { total: 15, cancelled: 1 },
   *     capacity: 0.8,
   *     seasonality: 'peak'
   *   }
   * 
   * Example for KPI eligibility:
   *   {
   *     totalSessions: 28,
   *     avgRating: 4.7,
   *     violations: 0
   *   }
   */
  data: Record<string, unknown>;

  // ============ Metadata & Extensions ============
  /**
   * Additional context (module-specific)
   * 
   * Examples:
   * - Booking: { customerId, packageId, serviceDate }
   * - Payroll: { employeeId, month, year }
   * - CRM: { leadId, campaignId, source }
   */
  metadata?: Record<string, unknown>;

  /**
   * Execution options (advanced)
   */
  options?: {
    /** Enable caching for this decision (default: true) */
    cache?: boolean;
    
    /** Cache TTL in seconds (default: 300) */
    cacheTTL?: number;
    
    /** Timeout for provider evaluation in ms (default: 5000) */
    timeout?: number;
    
    /** Fallback strategy if primary provider fails */
    fallback?: 'default' | 'manual' | 'error';
    
    /** Dry-run mode (evaluate but don't apply) */
    dryRun?: boolean;
  };
}
```

### Usage Examples

#### Example 1: Auto-Approval (Spa Booking)

```typescript
const context: DecisionContext = {
  // Tenant & Module
  tenantId: 'bella-spa-vietnam',
  module: 'booking',
  decisionType: 'auto-approval',

  // User
  user: {
    id: 'staff-456',
    role: 'receptionist',
    email: 'receptionist@bella.vn'
  },

  // Tracing
  correlationId: 'booking-7890-abcd',
  timestamp: new Date(),

  // Provider
  ruleType: 'if-then',
  rule: {
    condition: {
      or: [
        { field: 'amount', operator: '<', value: 5000000 },
        {
          and: [
            { field: 'customerTier', operator: '==', value: 'vip' },
            { field: 'amount', operator: '<', value: 10000000 }
          ]
        }
      ]
    },
    action: { approve: true }
  },

  // Input
  data: {
    amount: 8000000,
    customerTier: 'vip',
    bookingHistory: {
      totalBookings: 15,
      cancelledBookings: 1,
      avgSpending: 7500000
    },
    requestedDate: '2026-06-25',
    capacity: 0.75
  },

  // Metadata
  metadata: {
    customerId: 'cust-123',
    packageId: 'pkg-combo-vip',
    receptionistId: 'staff-456'
  }
};
```

#### Example 2: KPI Eligibility (Payroll)

```typescript
const context: DecisionContext = {
  tenantId: 'bella-spa-vietnam',
  module: 'payroll',
  decisionType: 'kpi-eligibility',

  correlationId: 'payroll-2026-06-ktv-789',

  ruleType: 'if-then',
  rule: {
    condition: {
      and: [
        { field: 'totalSessions', operator: '>=', value: 26 },
        { field: 'avgRating', operator: '>=', value: 4.5 },
        { field: 'violations', operator: '==', value: 0 }
      ]
    },
    action: { eligible: true }
  },

  data: {
    employeeId: 'ktv-789',
    totalSessions: 28,
    avgRating: 4.7,
    violations: 0,
    attendanceRate: 0.96
  },

  metadata: {
    month: '2026-06',
    year: 2026,
    calculatedBy: 'system'
  }
};
```

#### Example 3: BI-Powered Decision (Future)

```typescript
const context: DecisionContext = {
  tenantId: 'bella-spa-vietnam',
  module: 'booking',
  decisionType: 'dynamic-pricing',

  ruleType: 'bi-query',
  rule: {
    query: `
      SELECT recommended_discount
      FROM pricing_intelligence
      WHERE
        segment = :segment AND
        day_of_week = :dayOfWeek AND
        capacity_forecast < :capacityThreshold
    `,
    params: {
      segment: 'vip',
      dayOfWeek: 'wednesday',
      capacityThreshold: 0.6
    }
  },

  data: {
    basePrice: 8000000,
    customerSegment: 'vip',
    bookingDate: '2026-06-25', // Wednesday
    currentCapacity: 0.45
  }
};
```

#### Example 4: AI Prediction (Future)

```typescript
const context: DecisionContext = {
  tenantId: 'bella-spa-vietnam',
  module: 'crm',
  decisionType: 'churn-prediction',

  ruleType: 'ml-model',
  rule: {
    modelId: 'customer-churn-v3',
    features: [
      'daysSinceLastVisit',
      'totalLifetimeValue',
      'avgMonthlySpending',
      'customerSatisfactionScore',
      'competitorProximity'
    ]
  },

  data: {
    customerId: 'cust-123',
    daysSinceLastVisit: 45,
    totalLifetimeValue: 85000000,
    avgMonthlySpending: 6000000,
    customerSatisfactionScore: 4.2,
    competitorProximity: 2.5 // km
  },

  metadata: {
    predictionDate: '2026-06-22',
    modelVersion: 'v3.1.2'
  }
};
```

### Context Validation

Engine validates context before evaluation:

```typescript
function validateContext(context: DecisionContext): void {
  // Required fields
  if (!context.tenantId) throw new Error('tenantId is required');
  if (!context.module) throw new Error('module is required');
  if (!context.decisionType) throw new Error('decisionType is required');
  if (!context.ruleType) throw new Error('ruleType is required');
  if (!context.rule) throw new Error('rule is required');
  if (!context.data) throw new Error('data is required');

  // Optional field defaults
  context.correlationId = context.correlationId || uuidv4();
  context.timestamp = context.timestamp || new Date();
  context.options = context.options || {};
}
```

### Context Factory Pattern

Business modules can use factory functions to create contexts:

```typescript
// Factory for booking decisions
function createBookingDecisionContext(
  booking: Booking,
  user: User,
  rule: Rule
): DecisionContext {
  return {
    tenantId: booking.tenantId,
    module: 'booking',
    decisionType: 'auto-approval',
    
    user: {
      id: user.id,
      role: user.role,
      email: user.email
    },
    
    correlationId: `booking-${booking.id}-${Date.now()}`,
    timestamp: new Date(),
    
    ruleType: 'if-then',
    rule: rule,
    
    data: {
      amount: booking.totalAmount,
      customerTier: booking.customer.tier,
      bookingHistory: booking.customer.history,
      requestedDate: booking.serviceDate,
      capacity: await getCapacity(booking.serviceDate)
    },
    
    metadata: {
      customerId: booking.customerId,
      packageId: booking.packageId,
      receptionistId: user.id
    }
  };
}
```

### Summary

`DecisionContext` is:
- **Standardized**: Same structure across all modules
- **Extensible**: Metadata allows module-specific fields
- **Traceable**: Correlation IDs link decisions
- **Flexible**: Provider-specific rule definitions
- **Rich**: Carries all information needed for decisions

---

## 8. DecisionResult (Standard Contract)

### Purpose

`DecisionResult` is the **standard output contract** returned by all decision evaluations. It provides:
- Primary decision (approved/rejected)
- Confidence level (certainty of decision)
- Rationale (why the decision was made)
- Recommended actions (what to do next)
- Execution metadata (performance, provider, timing)

### Full Structure

```typescript
interface DecisionResult {
  // ============ Core Decision ============
  /**
   * Primary decision outcome
   * true = approved/accepted/positive
   * false = rejected/declined/negative
   */
  approved: boolean;

  /**
   * Confidence level of the decision (0.0 to 1.0)
   * 
   * Confidence ranges:
   * - 1.0: Deterministic (e.g., rule-based exact match)
   * - 0.9-0.99: High confidence (e.g., BI with strong data)
   * - 0.7-0.89: Medium confidence (e.g., AI prediction)
   * - 0.5-0.69: Low confidence (e.g., insufficient data)
   * - <0.5: Very low confidence (consider manual review)
   */
  confidence: number;

  // ============ Decision Details ============
  /**
   * Recommended action (optional)
   * Tells business module what to do next
   */
  action?: {
    /** Action type (e.g., 'approve', 'reject', 'escalate', 'discount') */
    type: string;
    
    /** Action data (action-specific parameters) */
    data: Record<string, unknown>;
  };

  /**
   * Human-readable reason for the decision
   * Used for UI display and audit logs
   */
  reason?: string;

  /**
   * Matched rules (for rule-based providers)
   * Array of rule IDs that matched
   */
  matchedRules?: string[];

  /**
   * Recommendations (optional)
   * Suggestions for business user
   */
  recommendations?: string[];

  /**
   * Next actions (optional)
   * Workflow steps after this decision
   */
  nextActions?: string[];

  // ============ Metadata & Context ============
  /**
   * Provider-specific metadata
   * 
   * Examples:
   * - RuleProvider: { evaluatedConditions, matchedPath }
   * - BIProvider: { queryResult, threshold, actualValue }
   * - AIProvider: { modelVersion, featureImportance, explainability }
   */
  metadata?: Record<string, unknown>;

  // ============ Execution Context ============
  /**
   * Execution time in milliseconds
   * Used for performance monitoring
   */
  executionTime: number;

  /**
   * Provider that generated this result
   * Example: 'RuleProvider', 'BIProvider', 'AIProvider'
   */
  provider: string;

  /**
   * Result timestamp
   * When the decision was made
   */
  timestamp: Date;

  // ============ Error Handling ============
  /**
   * Error information (if evaluation failed but returned fallback result)
   */
  error?: {
    /** Error message */
    message: string;
    
    /** Error code (for programmatic handling) */
    code: string;
    
    /** Stack trace (for debugging) */
    stack?: string;
  };

  /**
   * Whether this is a fallback result (due to provider failure)
   */
  isFallback?: boolean;
}
```

### Usage Examples

#### Example 1: Simple Approval (Rule-Based)

```typescript
const result: DecisionResult = {
  // Core decision
  approved: true,
  confidence: 1.0, // Deterministic rule

  // Details
  action: {
    type: 'auto-approve',
    data: {
      approvalLevel: 'automatic',
      requiresConfirmation: false
    }
  },
  reason: 'Booking amount (3,500,000 VND) is below auto-approval threshold (5,000,000 VND)',
  matchedRules: ['auto-approval-threshold-basic'],

  // Execution
  executionTime: 12, // ms
  provider: 'RuleProvider',
  timestamp: new Date('2026-06-22T10:30:00Z')
};
```

#### Example 2: Conditional Approval with Recommendations

```typescript
const result: DecisionResult = {
  approved: true,
  confidence: 0.95,

  action: {
    type: 'approve-with-conditions',
    data: {
      requiresManagerApproval: false,
      suggestedDiscount: 0.05 // 5%
    }
  },
  reason: 'VIP customer with excellent booking history. Small discount recommended to ensure booking.',
  matchedRules: ['vip-approval-extended', 'discount-recommendation-low-capacity'],
  
  recommendations: [
    'Offer 5% discount to secure booking',
    'Prioritize VIP service preparation',
    'Send booking confirmation with welcome message'
  ],
  
  nextActions: [
    'Send booking confirmation email',
    'Notify assigned KTV',
    'Update capacity forecast'
  ],

  metadata: {
    customerTier: 'vip',
    historicalCancellationRate: 0.03,
    projectedCapacity: 0.78
  },

  executionTime: 45,
  provider: 'RuleProvider',
  timestamp: new Date()
};
```

#### Example 3: Rejection with Clear Reason

```typescript
const result: DecisionResult = {
  approved: false,
  confidence: 1.0,

  action: {
    type: 'reject',
    data: {
      rejectionReason: 'capacity_exceeded',
      alternativeDates: ['2026-06-24', '2026-06-26']
    }
  },
  reason: 'Requested date (2026-06-23) is at full capacity (100%). No available time slots.',
  matchedRules: ['capacity-limit-reject'],
  
  recommendations: [
    'Suggest alternative dates: June 24 or 26',
    'Offer to add customer to waiting list',
    'Provide discount for off-peak booking'
  ],
  
  nextActions: [
    'Show alternative date picker to customer',
    'Offer waiting list registration',
    'Send capacity notification to manager'
  ],

  metadata: {
    requestedDate: '2026-06-23',
    currentCapacity: 1.0,
    availableSlots: 0,
    waitlistCount: 5
  },

  executionTime: 18,
  provider: 'RuleProvider',
  timestamp: new Date()
};
```

#### Example 4: KPI Eligibility

```typescript
const result: DecisionResult = {
  approved: true,
  confidence: 1.0,

  action: {
    type: 'kpi-eligible',
    data: {
      bonusAmount: 2000000,
      bonusTier: 'excellent'
    }
  },
  reason: 'KTV exceeded all KPI targets: 28 sessions (target: 26), 4.7 rating (target: 4.5), 0 violations.',
  matchedRules: ['kpi-eligibility-base', 'kpi-bonus-tier-excellent'],
  
  recommendations: [
    'Apply KPI bonus: 2,000,000 VND',
    'Recognize KTV in team meeting',
    'Consider for advanced training program'
  ],

  metadata: {
    totalSessions: 28,
    targetSessions: 26,
    avgRating: 4.7,
    targetRating: 4.5,
    violations: 0,
    attendanceRate: 0.96
  },

  executionTime: 23,
  provider: 'RuleProvider',
  timestamp: new Date()
};
```

#### Example 5: BI-Powered Decision (Future)

```typescript
const result: DecisionResult = {
  approved: true,
  confidence: 0.88, // BI-based, not deterministic

  action: {
    type: 'dynamic-pricing',
    data: {
      recommendedDiscount: 0.15, // 15%
      pricingStrategy: 'fill-capacity'
    }
  },
  reason: 'Historical data shows 15% discount increases booking rate by 40% for mid-week VIP customers during low-capacity periods.',
  
  recommendations: [
    'Apply 15% discount for Wednesday booking',
    'Highlight VIP benefits in confirmation',
    'Upsell premium add-ons to maintain revenue'
  ],

  metadata: {
    biQuery: 'pricing_intelligence_vip_midweek',
    historicalBookingRate: 0.35,
    projectedBookingRate: 0.49,
    revenueImpact: -0.08, // 8% revenue reduction, but 40% more bookings
    threshold: 0.6,
    actualCapacity: 0.45
  },

  executionTime: 156, // BI query takes longer
  provider: 'BIProvider',
  timestamp: new Date()
};
```

#### Example 6: AI Prediction (Future)

```typescript
const result: DecisionResult = {
  approved: false,
  confidence: 0.73, // Medium confidence AI prediction

  action: {
    type: 'churn-risk-detected',
    data: {
      churnProbability: 0.73,
      recommendedIntervention: 'retention-campaign'
    }
  },
  reason: 'ML model predicts 73% churn probability based on reduced visit frequency, declining satisfaction scores, and competitor proximity.',
  
  recommendations: [
    'Launch personalized retention campaign',
    'Offer exclusive VIP loyalty bonus',
    'Schedule account manager call within 7 days',
    'Send satisfaction survey to identify pain points'
  ],
  
  nextActions: [
    'Add to high-risk churn list',
    'Trigger automated retention workflow',
    'Notify account manager',
    'Track intervention effectiveness'
  ],

  metadata: {
    modelId: 'customer-churn-v3',
    modelVersion: 'v3.1.2',
    featureImportance: {
      daysSinceLastVisit: 0.35,
      satisfactionScore: 0.28,
      competitorProximity: 0.22,
      avgMonthlySpending: 0.15
    },
    explainability: 'Customer has not visited in 45 days (previous avg: 12 days). Satisfaction dropped from 4.8 to 4.2. Competitor opened 2.5km away.',
    churnProbability: 0.73
  },

  executionTime: 287, // AI inference takes longer
  provider: 'AIProvider',
  timestamp: new Date()
};
```

#### Example 7: Error with Fallback

```typescript
const result: DecisionResult = {
  approved: false,
  confidence: 0.0, // No confidence due to error

  reason: 'Decision provider timeout. Using safe default (reject).',
  
  error: {
    message: 'RuleProvider evaluation timeout after 5000ms',
    code: 'PROVIDER_TIMEOUT'
  },
  
  isFallback: true,

  recommendations: [
    'Manual review required',
    'Check system health',
    'Retry decision evaluation'
  ],

  executionTime: 5000, // Timeout threshold
  provider: 'ErrorHandler',
  timestamp: new Date()
};
```

### Result Interpretation Guide

```typescript
function interpretResult(result: DecisionResult): string {
  // High confidence approval
  if (result.approved && result.confidence >= 0.9) {
    return 'Auto-approve with high confidence';
  }

  // Medium confidence approval
  if (result.approved && result.confidence >= 0.7) {
    return 'Approve but monitor closely';
  }

  // Low confidence approval (escalate)
  if (result.approved && result.confidence < 0.7) {
    return 'Requires manual review before approval';
  }

  // High confidence rejection
  if (!result.approved && result.confidence >= 0.9) {
    return 'Auto-reject with clear reason';
  }

  // Fallback result (error)
  if (result.isFallback) {
    return 'Manual review required due to system error';
  }

  return 'Standard rejection';
}
```

### Business Module Integration

```typescript
// Step 1: Request decision
const result = await decisionEngine.evaluate(context);

// Step 2: Handle result
if (result.approved) {
  // Execute approval action
  if (result.action?.type === 'auto-approve') {
    await bookingService.approve(booking);
    
    // Apply recommendations
    if (result.recommendations) {
      for (const recommendation of result.recommendations) {
        await applyRecommendation(recommendation);
      }
    }
  }
} else {
  // Handle rejection
  await bookingService.reject(booking, result.reason);
  
  // Suggest alternatives
  if (result.metadata?.alternativeDates) {
    await notificationService.suggestAlternatives(
      booking.customerId,
      result.metadata.alternativeDates
    );
  }
}

// Step 3: Audit (always)
await auditService.logDecision({
  decisionId: uuidv4(),
  context: context,
  result: result,
  appliedAction: result.approved ? 'approved' : 'rejected',
  executionTime: result.executionTime,
  provider: result.provider,
  timestamp: result.timestamp
});
```

### Summary

`DecisionResult` provides:
- ✅ **Clear decision**: `approved` boolean
- ✅ **Confidence**: How certain the decision is
- ✅ **Actionable**: `action`, `recommendations`, `nextActions`
- ✅ **Explainable**: `reason`, `matchedRules`, `metadata`
- ✅ **Traceable**: `provider`, `timestamp`, `executionTime`
- ✅ **Error-safe**: `error`, `isFallback` for failure cases

**Standard contract ensures**:
- All providers return same structure
- Business modules have consistent handling
- Audit logs are uniform
- UI can display results predictably

---

## 9. Responsibilities (What it DOES)

Decision Engine Platform is responsible for:

### 1. Decision Orchestration

```
✅ Receive DecisionContext from business modules
✅ Select appropriate provider based on ruleType
✅ Delegate evaluation to provider
✅ Return standardized DecisionResult
```

**Example**:
```typescript
// Engine orchestrates the flow
const result = await engine.evaluate(context);
// Internally: engine.registry.getProvider(context.ruleType).evaluate(context)
```

### 2. Provider Management

```
✅ Register providers via DI container
✅ Validate provider compatibility
✅ Support multiple providers simultaneously
✅ Enable provider discovery
```

**Example**:
```typescript
registry.register(new RuleProvider());
registry.register(new BIProvider());
registry.register(new AIProvider());
```

### 3. Error Handling

```
✅ Catch provider evaluation errors
✅ Execute fallback strategy
✅ Return safe default decisions
✅ Log errors for observability
```

**Example**:
```typescript
try {
  return await provider.evaluate(context);
} catch (error) {
  return this.fallback(context, error);
}
```

### 4. Event Publishing

```
✅ Publish 'decision.evaluated' events
✅ Include context, result, and metadata
✅ Enable event subscribers (audit, workflow, analytics)
```

**Example**:
```typescript
await eventPublisher.publish({
  type: 'decision.evaluated',
  data: { context, result, timestamp: new Date() }
});
```

### 5. Observability

```
✅ Log every decision evaluation
✅ Record execution time
✅ Track provider performance
✅ Emit metrics (latency, throughput, error rate)
```

**Example**:
```typescript
logger.info('Decision evaluated', {
  tenantId, module, decisionType,
  approved: result.approved,
  provider: result.provider,
  executionTime: result.executionTime
});
```

### 6. Input Validation

```
✅ Validate DecisionContext structure
✅ Ensure required fields present
✅ Set default values (correlationId, timestamp)
```

**Example**:
```typescript
if (!context.tenantId) throw new ValidationError('tenantId required');
context.correlationId = context.correlationId || uuidv4();
```

### 7. Standardized Output

```
✅ All providers return DecisionResult
✅ Engine adds execution metadata (time, provider, timestamp)
✅ Consistent contract for all consumers
```

**Example**:
```typescript
return {
  ...providerResult,
  executionTime: Date.now() - startTime,
  provider: provider.name,
  timestamp: new Date()
};
```

---

## 10. Out of Scope ⭐ (What we DON'T support)

**Inspired by AWS/Azure/Google Cloud architecture documents**, we explicitly define what Decision Engine Platform **intentionally does NOT support**. This prevents scope creep and maintains focus.

---

### ❌ Workflow Management

**Not Supported**: Decision Engine does NOT manage approval chains, multi-step workflows, or task orchestration.

```typescript
// ❌ Engine does NOT do this:
class DecisionEngine {
  async approveWithWorkflow(context: DecisionContext): Promise<void> {
    const result = await this.evaluate(context);
    
    if (result.requiresManagerApproval) {
      await this.workflow.createApprovalTask(manager);
      await this.workflow.waitForApproval();
      await this.workflow.notifyUser();
    }
  }
}
```

**Why**: Workflow management belongs to **Workflow Engine** (separate platform capability).

**Alternative**: Engine returns decision. Business module or Workflow Engine handles workflow.

```typescript
// ✅ Correct approach:
const result = await decisionEngine.evaluate(context);

// Business module decides what to do with result
if (result.nextActions?.includes('manager-approval')) {
  await workflowEngine.start({
    type: 'approval-chain',
    approvers: [managerId],
    context: { decisionResult: result }
  });
}
```

---

### ❌ Scheduling & Cron Jobs

**Not Supported**: Engine does NOT schedule recurring decisions, batch evaluations, or cron-based triggers.

```typescript
// ❌ Engine does NOT do this:
class DecisionEngine {
  scheduleRecurringEvaluation(cron: string, context: DecisionContext): void {
    // NO! Not Engine's job
  }
}
```

**Why**: Scheduling belongs to **Job Scheduler** or **Event-driven Architecture**.

**Alternative**: External scheduler triggers decision evaluations.

```typescript
// ✅ Correct approach:
// Job scheduler calls Engine
cron.schedule('0 0 * * *', async () => {
  const contexts = await getContextsForDailyEvaluation();
  
  for (const context of contexts) {
    await decisionEngine.evaluate(context);
  }
});
```

---

### ❌ Retry Logic

**Not Supported**: Engine does NOT automatically retry failed provider evaluations.

**Why**: Retry strategy is infrastructure concern (handled by API Gateway, Service Mesh, or Workflow Engine).

**Alternative**: Business module or infrastructure layer handles retries.

```typescript
// ✅ Correct approach:
async function evaluateWithRetry(
  context: DecisionContext,
  maxRetries: number = 3
): Promise<DecisionResult> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await decisionEngine.evaluate(context);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await sleep(1000 * attempt); // Exponential backoff
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

### ❌ Notification/Alerting

**Not Supported**: Engine does NOT send emails, SMS, push notifications, or alerts.

**Why**: Notification belongs to **Notification Service**.

**Alternative**: Business module subscribes to decision events and sends notifications.

```typescript
// ✅ Correct approach:
eventBus.subscribe('decision.evaluated', async (event) => {
  const { context, result } = event.data;
  
  if (!result.approved) {
    await notificationService.send({
      to: context.user.email,
      subject: 'Decision Rejected',
      body: result.reason
    });
  }
});
```

---

### ❌ Database CRUD Operations

**Not Supported**: Engine does NOT insert, update, or delete records from business tables.

**Why**: Data persistence belongs to **Business Modules**.

**Alternative**: Business module saves decision results to database.

```typescript
// ❌ Engine does NOT do this:
class DecisionEngine {
  async evaluate(context: DecisionContext): Promise<DecisionResult> {
    const result = await provider.evaluate(context);
    
    // ❌ NO! Engine shouldn't save to DB
    await db.insert('decisions', {
      contextId: context.id,
      result: result
    });
    
    return result;
  }
}

// ✅ Correct approach:
const result = await decisionEngine.evaluate(context);

// Business module saves decision
await db.insert('booking_decisions', {
  bookingId: booking.id,
  decision: result.approved,
  reason: result.reason,
  timestamp: result.timestamp
});
```

---

### ❌ KPI/Metrics Calculation

**Not Supported**: Engine does NOT calculate business KPIs (revenue, sessions, ratings, etc.).

**Why**: Business logic belongs to **Business Modules** or **BI Layer**.

**Alternative**: Providers MAY query BI/Database for pre-calculated KPIs.

```typescript
// ❌ Engine does NOT calculate KPIs:
class DecisionEngine {
  async evaluate(context: DecisionContext): Promise<DecisionResult> {
    // ❌ NO! Engine shouldn't calculate business metrics
    const totalRevenue = await this.calculateRevenue(context.tenantId);
    const avgRating = await this.calculateAvgRating(context.userId);
    // ...
  }
}

// ✅ Correct approach:
// Business module or BI Provider calculates KPIs
const kpi = await kpiService.getEmployeeKPI(employeeId, month);

const result = await decisionEngine.evaluate({
  ruleType: 'if-then',
  rule: kpiEligibilityRule,
  data: {
    totalSessions: kpi.sessions, // Pre-calculated
    avgRating: kpi.rating // Pre-calculated
  }
});
```

---

### ❌ Approval UI / Rule Designer UI

**Not Supported**: Engine does NOT provide UI components for rule design, approval forms, or decision visualization.

**Why**: UI belongs to **Frontend/Application Layer**.

**Alternative**: Frontend calls Engine API and displays results.

```typescript
// ✅ Frontend handles UI:
// src/app/admin/rules/components/RuleDesigner.tsx
export function RuleDesigner() {
  const [rule, setRule] = useState<Rule>();
  
  const handleTest = async () => {
    const result = await decisionEngineAPI.evaluate({
      ruleType: 'if-then',
      rule: rule,
      data: testData
    });
    
    setTestResult(result);
  };
  
  return <RuleEditor rule={rule} onChange={setRule} />;
}
```

---

### ❌ Plugin Marketplace

**Not Supported**: Engine does NOT provide a marketplace for discovering, installing, or purchasing decision providers.

**Why**: Marketplace is a **separate product concern**.

**Alternative**: Providers are registered via code/config at deployment time.

---

### ❌ Multi-Tenant Data Isolation

**Not Supported**: Engine does NOT enforce tenant data isolation at database level.

**Why**: Data isolation belongs to **Data Access Layer** and **Database Schema Design**.

**Alternative**: Business modules enforce tenant isolation when querying data for context.

```typescript
// ✅ Business module enforces tenant isolation:
const booking = await db.bookings.findOne({
  id: bookingId,
  tenantId: currentTenant // Enforced by module
});

const result = await decisionEngine.evaluate({
  tenantId: currentTenant,
  data: { amount: booking.amount }
});
```

---

### ❌ Authentication & Authorization

**Not Supported**: Engine does NOT authenticate users or enforce access control.

**Why**: Auth belongs to **Auth Service**.

**Alternative**: Business modules enforce auth before calling Engine.

```typescript
// ✅ Business module handles auth:
export async function evaluateDecision(
  context: DecisionContext,
  user: User
): Promise<DecisionResult> {
  // Auth check happens BEFORE engine call
  if (!user.permissions.includes('decision:evaluate')) {
    throw new ForbiddenError('User cannot evaluate decisions');
  }
  
  return decisionEngine.evaluate(context);
}
```

---

### ❌ Cache Management

**Not Supported**: Engine does NOT manage cache invalidation, cache warming, or cache strategies.

**Why**: Caching belongs to **Cache Layer** (Redis, Memcached) or **Providers** (internal caching).

**Alternative**: Providers implement caching internally if needed.

```typescript
// ✅ Provider manages its own cache:
class RuleProvider implements IDecisionProvider {
  private ruleCache: Map<string, Rule> = new Map();
  
  async evaluate(context: DecisionContext): Promise<DecisionResult> {
    // Provider caches rules internally
    const rule = await this.getRuleCached(context.rule);
    return this.evaluateRule(rule, context.data);
  }
  
  private async getRuleCached(ruleId: string): Promise<Rule> {
    if (!this.ruleCache.has(ruleId)) {
      const rule = await this.loadRule(ruleId);
      this.ruleCache.set(ruleId, rule);
    }
    return this.ruleCache.get(ruleId)!;
  }
}
```

---

### ❌ Business Logic Implementation

**Not Supported**: Engine does NOT implement industry-specific logic (spa booking rules, clinic appointment validation, manufacturing quality checks, etc.).

**Why**: Business logic belongs to **Business Modules** and **Providers**.

**Alternative**: Business modules define rules and pass to Engine.

```typescript
// ✅ Business module owns logic:
const spaBookingRule = {
  condition: {
    or: [
      { field: 'amount', operator: '<', value: 5000000 },
      { field: 'customerTier', operator: '==', value: 'vip' }
    ]
  },
  action: { approve: true }
};

const result = await decisionEngine.evaluate({
  ruleType: 'if-then',
  rule: spaBookingRule, // Module-defined rule
  data: booking
});
```

---

### ❌ State Management

**Not Supported**: Engine does NOT store session state, user context, or workflow progress.

**Why**: Stateless architecture (see Section 3).

**Alternative**: State lives in Database, Workflow Engine, or Business Modules.

---

### ❌ Transaction Management

**Not Supported**: Engine does NOT manage database transactions or distributed transactions.

**Why**: Transaction management belongs to **Business Modules** or **Database Layer**.

**Alternative**: Business module wraps Engine call in transaction.

```typescript
// ✅ Business module manages transaction:
await db.transaction(async (trx) => {
  const result = await decisionEngine.evaluate(context);
  
  if (result.approved) {
    await trx.bookings.update(bookingId, { status: 'approved' });
    await trx.revenue.insert({ amount: booking.amount });
  } else {
    await trx.bookings.update(bookingId, { status: 'rejected' });
  }
});
```

---

### Summary: Out of Scope

| Concern | Engine Support | Belongs To |
|---------|----------------|------------|
| Workflow management | ❌ | Workflow Engine |
| Scheduling | ❌ | Job Scheduler / Event System |
| Retry logic | ❌ | Infrastructure / API Gateway |
| Notifications | ❌ | Notification Service |
| Database CRUD | ❌ | Business Modules |
| KPI Calculation | ❌ | Business Modules / BI Layer |
| Approval UI | ❌ | Frontend / Application Layer |
| Rule Designer UI | ❌ | Frontend / Application Layer |
| Plugin Marketplace | ❌ | Separate Product |
| Data Isolation | ❌ | Data Access Layer |
| Authentication | ❌ | Auth Service |
| Authorization | ❌ | Auth Service |
| Cache Management | ❌ | Cache Layer / Providers |
| Business Logic | ❌ | Business Modules / Providers |
| State Management | ❌ | Database / Workflow Engine |
| Transactions | ❌ | Business Modules / Database |

**Why This Matters**: By clearly defining what we **DON'T** do, we:
- Prevent scope creep
- Maintain focus on core responsibility (decision orchestration)
- Avoid duplicating functionality of other platform components
- Keep architecture clean and maintainable

**The Rule**: Decision Engine is a **decision orchestrator**, not a full application framework.

---

## 11. Dependency Rules

Decision Engine Platform follows **strict dependency rules** to maintain clean architecture.

### Dependency Direction

```
┌─────────────────────────────────────────────────────────┐
│             Application Layer (UI)                      │
└─────────────────────┬───────────────────────────────────┘
                      │ calls
┌─────────────────────▼───────────────────────────────────┐
│          Business Modules Layer                         │
│  (Payroll, CRM, Booking, Finance, HR, Inventory)       │
└─────────────────────┬───────────────────────────────────┘
                      │ uses (ONE-WAY only)
┌─────────────────────▼───────────────────────────────────┐
│        Decision Engine Platform ⭐                      │
│  (Orchestrator + Providers + Contracts)                 │
└─────────────────────┬───────────────────────────────────┘
                      │ uses
┌─────────────────────▼───────────────────────────────────┐
│       Infrastructure Layer                              │
│  (Event Bus, Logger, DI Container)                      │
└─────────────────────────────────────────────────────────┘
```

### Allowed Dependencies

#### ✅ Engine MAY depend on:
- **Infrastructure abstractions**: `IEventPublisher`, `ILogger`, `ICache`
- **DI Container**: For provider registration and resolution
- **Standard libraries**: Date, UUID, JSON utilities
- **Type definitions**: TypeScript interfaces and types

```typescript
// ✅ ALLOWED: Infrastructure dependencies
class DecisionEngine {
  constructor(
    private readonly registry: DecisionProviderRegistry,
    private readonly eventPublisher: IEventPublisher, // ✅ Infrastructure
    private readonly logger: ILogger // ✅ Infrastructure
  ) {}
}
```

#### ❌ Engine MUST NOT depend on:
- **Business modules**: NO imports from `src/modules/payroll`, `src/modules/booking`, etc.
- **Database clients**: NO direct imports of Supabase client, Prisma, TypeORM
- **Business entities**: NO imports of `Employee`, `Booking`, `Customer`, `Invoice`
- **Business services**: NO imports of `PayrollService`, `BookingService`, etc.
- **UI components**: NO imports from `src/app`, `src/components`

```typescript
// ❌ FORBIDDEN: Business module dependencies
import { Employee } from '@/modules/payroll/entities/employee'; // ❌ NO!
import { BookingService } from '@/modules/booking/services'; // ❌ NO!
import { supabase } from '@/lib/supabase'; // ❌ NO!

class DecisionEngine {
  async evaluate(context: DecisionContext): Promise<DecisionResult> {
    // ❌ NO! Engine doesn't query database
    const employee = await supabase
      .from('employees')
      .select('*')
      .eq('id', context.data.employeeId);
  }
}
```

### Provider Dependencies

Providers have **more flexibility** than Engine core:

#### ✅ Providers MAY depend on:
- **Data access abstractions**: `IDatabase`, `IRepository` (via interfaces)
- **External APIs**: BI clients, ML model APIs, 3rd-party services
- **Rule parsers**: JSON schema validators, DSL parsers
- **Provider-specific libraries**: ML libraries, BI SDKs

```typescript
// ✅ ALLOWED: Provider has data access
class RuleProvider implements IDecisionProvider {
  constructor(
    private readonly ruleRepository: IRuleRepository // ✅ Via interface
  ) {}
  
  async evaluate(context: DecisionContext): Promise<DecisionResult> {
    const rule = await this.ruleRepository.findById(context.rule.id);
    return this.evaluateRule(rule, context.data);
  }
}
```

#### ❌ Providers MUST NOT depend on:
- **Other providers**: No cross-provider dependencies
- **Business modules directly**: Must use interfaces/contracts
- **Engine core**: No circular dependencies back to Engine

### Package Structure

```
src/
├── lib/
│   ├── decision-engine/
│   │   ├── core/
│   │   │   ├── DecisionEngine.ts ⭐ (Core orchestrator)
│   │   │   ├── DecisionProviderRegistry.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── abstractions/
│   │   │   ├── IDecisionProvider.ts
│   │   │   ├── DecisionContext.ts
│   │   │   ├── DecisionResult.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── providers/
│   │   │   ├── RuleProvider.ts
│   │   │   ├── BIProvider.ts (future)
│   │   │   ├── AIProvider.ts (future)
│   │   │   └── index.ts
│   │   │
│   │   └── index.ts (Public API)
│   │
│   ├── events/
│   │   └── IEventPublisher.ts
│   │
│   ├── di/
│   │   └── ServiceContainer.ts
│   │
│   └── logger/
│       └── ILogger.ts
│
└── modules/ (Business Modules)
    ├── payroll/
    ├── booking/
    └── crm/
```

### Import Rules

```typescript
// ✅ CORRECT: Business module imports Engine
// src/modules/booking/services/booking-approval.service.ts
import { decisionEngine } from '@/lib/decision-engine';
import type { DecisionContext, DecisionResult } from '@/lib/decision-engine';

export class BookingApprovalService {
  async approve(booking: Booking): Promise<boolean> {
    const context: DecisionContext = {
      tenantId: booking.tenantId,
      module: 'booking',
      decisionType: 'auto-approval',
      ruleType: 'if-then',
      rule: autoApprovalRule,
      data: { amount: booking.totalAmount }
    };
    
    const result = await decisionEngine.evaluate(context);
    return result.approved;
  }
}

// ❌ WRONG: Engine imports Business module
// src/lib/decision-engine/core/DecisionEngine.ts
import { Booking } from '@/modules/booking/entities'; // ❌ CIRCULAR!
import { BookingService } from '@/modules/booking/services'; // ❌ CIRCULAR!

class DecisionEngine {
  async evaluate(context: DecisionContext): Promise<DecisionResult> {
    // ❌ NO! Engine cannot call business services
    const booking = await bookingService.findById(context.data.bookingId);
  }
}
```

### Dependency Injection

Engine receives dependencies via constructor (Dependency Inversion Principle):

```typescript
// ✅ CORRECT: Depend on abstractions
class DecisionEngine {
  constructor(
    private readonly registry: IDecisionProviderRegistry, // Abstraction
    private readonly eventPublisher: IEventPublisher, // Abstraction
    private readonly logger: ILogger // Abstraction
  ) {}
}

// Bootstrap: Inject concrete implementations
const engine = new DecisionEngine(
  new DecisionProviderRegistry(),
  new InMemoryEventPublisher(),
  new ConsoleLogger()
);
```

### Enforcement

#### Static Analysis

```bash
# Check for forbidden imports in Engine core
eslint --rule "no-restricted-imports: [
  'error',
  {
    'paths': [
      { 'name': '@/modules/**', 'message': 'Engine cannot import business modules' },
      { 'name': '@/lib/supabase', 'message': 'Engine cannot import database client' }
    ]
  }
]" src/lib/decision-engine/core/**/*.ts
```

#### Code Review Checklist

- [ ] Does Engine import from `@/modules/**`? (Must be NO)
- [ ] Does Engine import database client directly? (Must be NO)
- [ ] Are all Engine dependencies injected via constructor? (Must be YES)
- [ ] Do Providers depend on abstractions (interfaces) only? (Must be YES)

### Summary

| Layer | Can Depend On | Cannot Depend On |
|-------|---------------|------------------|
| **Engine Core** | Infrastructure abstractions, DI container | Business modules, Database, UI |
| **Providers** | Data abstractions, External APIs, Parser libraries | Other providers, Business modules (direct), Engine |
| **Business Modules** | Engine, Providers (via Engine), Database | Nothing (top-level consumers) |

**The Rule**: Dependencies flow **downward** only. Engine is a platform capability, not a business module.

---

## 12. Provider Model & Roadmap

### Provider Ecosystem

Decision Engine supports multiple decision sources through a **provider-based architecture**.

```
Decision Engine (Orchestrator)
    │
    ├─ Phase 1: Rule Provider ✅ (Current)
    │   └─ IF-THEN rules, Decision tables, Decision trees
    │
    ├─ Phase 2: Business Intelligence Provider 📅 (Q3 2026)
    │   └─ BI queries, Dashboard metrics, Historical analysis
    │
    ├─ Phase 3: Composite Provider 📅 (Q4 2026)
    │   └─ Chain multiple providers, Multi-stage decisions
    │
    ├─ Phase 4: AI/ML Provider 📅 (Q1 2027)
    │   └─ Machine Learning models, AI predictions, Pattern recognition
    │
    └─ Phase 5: External & Manual Providers 📅 (Q2 2027)
        ├─ External API Provider (3rd-party services)
        └─ Manual Review Provider (Human-in-the-loop)
```

### Phase 1: Rule Provider (Current)

**Status**: ✅ In development

**Capabilities**:
- IF-THEN conditional rules
- Decision tables (multi-condition matrix)
- Decision trees (hierarchical rules)

**Rule Types Supported**:
```typescript
- 'if-then': Simple conditional logic
- 'decision-table': Table-based rules
- 'decision-tree': Hierarchical decision paths
```

**Example**:
```typescript
const result = await decisionEngine.evaluate({
  ruleType: 'if-then',
  rule: {
    condition: { field: 'amount', operator: '<', value: 5000000 },
    action: { approve: true }
  },
  data: { amount: 3000000 }
});
```

**Rule Management Evolution**:
```
Phase 1a: Developer (JSON/Code) ← Current
Phase 1b: Admin Dashboard (Visual Rule Builder) ← Q2 2026
Phase 1c: Business User (No-code Rule Designer) ← Q3 2026
```

---

### Phase 2: Business Intelligence Provider

**Status**: 📅 Planned Q3 2026

**Capabilities**:
- Execute BI queries (SQL, Dashboard APIs)
- Leverage historical data analysis
- Dynamic thresholds based on trends

**Rule Types Supported**:
```typescript
- 'bi-query': SQL queries on data warehouse
- 'dashboard-metric': Metrics from BI dashboards
- 'trend-analysis': Time-series analysis
```

**Example**:
```typescript
const result = await decisionEngine.evaluate({
  ruleType: 'bi-query',
  rule: {
    query: 'SELECT approval_threshold FROM customer_segments WHERE tier = :tier',
    params: { tier: 'vip' },
    operator: '>',
    field: 'amount'
  },
  data: { amount: 8000000, tier: 'vip' }
});
```

**Integration Targets**:
- Power BI
- Tableau
- Metabase
- Custom SQL (Postgres/MySQL)

---

### Phase 3: Composite Provider

**Status**: 📅 Planned Q4 2026

**Capabilities**:
- Chain multiple providers
- Multi-stage decision pipelines
- Fallback strategies

**Rule Types Supported**:
```typescript
- 'composite': Sequential provider chain
- 'parallel': Parallel provider execution with consensus
- 'fallback': Primary + fallback provider chain
```

**Example**:
```typescript
const result = await decisionEngine.evaluate({
  ruleType: 'composite',
  rule: {
    pipeline: [
      { provider: 'rule', weight: 0.3 },
      { provider: 'bi-query', weight: 0.4 },
      { provider: 'ml-model', weight: 0.3 }
    ],
    strategy: 'weighted-average'
  },
  data: { amount: 10000000, customerHistory: {...} }
});
```

---

### Phase 4: AI/ML Provider

**Status**: 📅 Planned Q1 2027

**Capabilities**:
- Machine Learning model inference
- AI predictions
- Pattern recognition
- Feature importance analysis

**Rule Types Supported**:
```typescript
- 'ml-model': Trained ML models
- 'ai-prediction': AI-powered predictions
- 'neural-network': Deep learning models
```

**Example**:
```typescript
const result = await decisionEngine.evaluate({
  ruleType: 'ml-model',
  rule: {
    modelId: 'booking-approval-v2',
    features: ['amount', 'customerHistory', 'seasonality', 'capacity']
  },
  data: {
    amount: 10000000,
    customerHistory: { bookings: 15, cancellations: 1 },
    seasonality: 'peak',
    capacity: 0.8
  }
});
```

**Integration Targets**:
- OpenAI API
- Azure ML
- Google Vertex AI
- Custom ML models (TensorFlow, PyTorch)

---

### Phase 5: External & Manual Providers

**Status**: 📅 Planned Q2 2027

#### 5a. External API Provider

**Capabilities**:
- Call 3rd-party decision APIs
- Integrate external services
- Credit checks, fraud detection, etc.

**Rule Types Supported**:
```typescript
- 'external-api': REST/GraphQL API calls
- 'webhook': Webhook-based decisions
```

**Example**:
```typescript
const result = await decisionEngine.evaluate({
  ruleType: 'external-api',
  rule: {
    endpoint: 'https://credit-bureau.example.com/api/check',
    method: 'POST',
    auth: { type: 'bearer', token: '...' },
    mapping: {
      input: { customerId: 'data.customerId' },
      output: { approved: 'response.creditApproved' }
    }
  },
  data: { customerId: 'cust-123' }
});
```

#### 5b. Manual Review Provider

**Capabilities**:
- Human-in-the-loop decisions
- Manual approval workflows
- Expert review for edge cases

**Rule Types Supported**:
```typescript
- 'manual-review': Requires human approval
- 'expert-review': Domain expert consultation
```

**Example**:
```typescript
const result = await decisionEngine.evaluate({
  ruleType: 'manual-review',
  rule: {
    reviewerRole: 'finance-manager',
    timeoutMinutes: 60,
    fallback: 'reject'
  },
  data: { amount: 50000000, reason: 'Large booking requires manual review' }
});

// Returns pending result, human reviews later
// {
//   approved: false,
//   confidence: 0.0,
//   reason: 'Pending manual review by finance-manager',
//   nextActions: ['await-human-review']
// }
```

---

### Provider Interface (All Phases)

All providers implement the same interface:

```typescript
interface IDecisionProvider {
  readonly name: string;
  readonly supportedRuleTypes: string[];
  
  evaluate(context: DecisionContext): Promise<DecisionResult>;
  canHandle(context: DecisionContext): boolean;
}
```

### Provider Roadmap Summary

| Phase | Provider | Timeline | Complexity | Use Cases |
|-------|----------|----------|------------|-----------|
| 1 | Rule Provider | Q2 2026 | Low | Thresholds, simple conditions |
| 2 | BI Provider | Q3 2026 | Medium | Data-driven decisions, trends |
| 3 | Composite Provider | Q4 2026 | Medium | Multi-source decisions |
| 4 | AI Provider | Q1 2027 | High | Predictions, pattern recognition |
| 5a | External Provider | Q2 2027 | Medium | 3rd-party integrations |
| 5b | Manual Provider | Q2 2027 | Low | Human review, expert approval |

**Design Principle**: Start simple (rules), evolve to sophisticated (AI + human).

---

## 13. Decision Lifecycle (Flow Diagram)

### High-Level Flow

```
┌─────────────────┐
│ Business Module │
└────────┬────────┘
         │ 1. Prepare Context
         ↓
┌─────────────────────────────────────┐
│ DecisionContext                     │
│ - tenantId, module, decisionType    │
│ - ruleType, rule, data              │
└────────┬────────────────────────────┘
         │ 2. Call evaluate()
         ↓
┌─────────────────────────────────────┐
│ Decision Engine (Orchestrator)      │
│ ┌─────────────────────────────────┐ │
│ │ 1. Validate context             │ │
│ │ 2. Select provider              │ │
│ │ 3. Delegate to provider         │ │
│ │ 4. Handle errors (fallback)     │ │
│ │ 5. Publish events               │ │
│ │ 6. Return result                │ │
│ └─────────────────────────────────┘ │
└────────┬────────────────────────────┘
         │ 3. Provider evaluation
         ↓
┌─────────────────────────────────────┐
│ IDecisionProvider                   │
│ (Rule / BI / AI / External)         │
│ ┌─────────────────────────────────┐ │
│ │ 1. Parse rule definition        │ │
│ │ 2. Evaluate logic               │ │
│ │ 3. Return DecisionResult        │ │
│ └─────────────────────────────────┘ │
└────────┬────────────────────────────┘
         │ 4. Return result
         ↓
┌─────────────────────────────────────┐
│ DecisionResult                      │
│ - approved, confidence, reason      │
│ - action, recommendations           │
│ - executionTime, provider, timestamp│
└────────┬────────────────────────────┘
         │ 5. Return to module
         ↓
┌─────────────────┐
│ Business Module │ ← 6. Handle result (approve/reject)
└─────────────────┘

         │ (Parallel)
         ↓
┌─────────────────────────────────────┐
│ Event Bus                           │
│ - decision.evaluated                │
│ - Audit, Analytics, Workflow        │
└─────────────────────────────────────┘
```

### Detailed Sequence Diagram

```
Business Module    Engine          Registry        Provider        Event Bus
      │               │                │               │               │
      │ prepare       │                │               │               │
      │ context       │                │               │               │
      │──────────┐    │                │               │               │
      │          │    │                │               │               │
      │<─────────┘    │                │               │               │
      │               │                │               │               │
      │ evaluate()    │                │               │               │
      │──────────────>│                │               │               │
      │               │                │               │               │
      │               │ validate       │               │               │
      │               │────────┐       │               │               │
      │               │        │       │               │               │
      │               │<───────┘       │               │               │
      │               │                │               │               │
      │               │ getProvider()  │               │               │
      │               │───────────────>│               │               │
      │               │                │               │               │
      │               │ provider inst  │               │               │
      │               │<───────────────│               │               │
      │               │                │               │               │
      │               │ evaluate()     │               │               │
      │               │───────────────────────────────>│               │
      │               │                │               │               │
      │               │                │               │ parse rule    │
      │               │                │               │──────┐        │
      │               │                │               │      │        │
      │               │                │               │<─────┘        │
      │               │                │               │               │
      │               │                │               │ evaluate logic│
      │               │                │               │──────┐        │
      │               │                │               │      │        │
      │               │                │               │<─────┘        │
      │               │                │               │               │
      │               │ DecisionResult │               │               │
      │               │<───────────────────────────────│               │
      │               │                │               │               │
      │               │ enrich metadata│               │               │
      │               │────────┐       │               │               │
      │               │        │       │               │               │
      │               │<───────┘       │               │               │
      │               │                │               │               │
      │               │ publish event  │               │               │
      │               │───────────────────────────────────────────────>│
      │               │                │               │               │
      │ DecisionResult│                │               │               │
      │<──────────────│                │               │               │
      │               │                │               │               │
      │ handle result │                │               │               │
      │──────────┐    │                │               │               │
      │          │    │                │               │               │
      │<─────────┘    │                │               │               │
```

### Step-by-Step Breakdown

#### Step 1: Context Preparation (Business Module)

```typescript
const context: DecisionContext = {
  tenantId: 'bella-spa-vn',
  module: 'booking',
  decisionType: 'auto-approval',
  ruleType: 'if-then',
  rule: autoApprovalRule,
  data: { amount: booking.totalAmount },
  correlationId: uuidv4()
};
```

#### Step 2: Engine Receives Context

```typescript
async evaluate(context: DecisionContext): Promise<DecisionResult> {
  const startTime = Date.now();
  
  // 2a. Validate context
  this.validateContext(context);
```

#### Step 3: Provider Selection

```typescript
  // 2b. Select provider based on ruleType
  const provider = this.registry.getProvider(context.ruleType);
  
  if (!provider) {
    throw new ProviderNotFoundError(context.ruleType);
  }
```

#### Step 4: Provider Evaluation

```typescript
  // 2c. Delegate to provider
  try {
    const result = await provider.evaluate(context);
```

#### Step 5: Error Handling (if needed)

```typescript
  } catch (error) {
    return this.handleError(context, error, startTime);
  }
```

#### Step 6: Result Enrichment

```typescript
  // 2d. Enrich with execution metadata
  const enrichedResult = {
    ...result,
    executionTime: Date.now() - startTime,
    provider: provider.name,
    timestamp: new Date()
  };
```

#### Step 7: Event Publishing

```typescript
  // 2e. Publish event (non-blocking)
  await this.eventPublisher.publish({
    type: 'decision.evaluated',
    data: {
      tenantId: context.tenantId,
      module: context.module,
      decisionType: context.decisionType,
      correlationId: context.correlationId,
      approved: result.approved,
      provider: provider.name,
      executionTime: enrichedResult.executionTime
    }
  });
```

#### Step 8: Return Result

```typescript
  // 2f. Return result
  return enrichedResult;
}
```

#### Step 9: Business Module Handles Result

```typescript
const result = await decisionEngine.evaluate(context);

if (result.approved) {
  await bookingService.approve(booking);
  await notificationService.sendConfirmation(booking);
} else {
  await bookingService.reject(booking, result.reason);
}

// Audit (automatic via event subscription)
```

### Error Flow

```
Business Module → Engine → Provider → ❌ Error
                     │
                     ↓ catch error
              Fallback Strategy
                     │
                     ├─ default: Return safe default (reject)
                     ├─ manual: Trigger manual review
                     └─ error: Re-throw error
                     │
                     ↓
              DecisionResult (with error metadata)
                     │
                     ↓
Business Module ← Handle fallback result
```

### Caching Flow (Optional)

```
Business Module → Engine → Cache Layer
                     │           │
                     │           ↓ cache miss
                     ↓           
              Provider Evaluation
                     │
                     ↓
Cache Layer ← Store result (TTL)
      │
      ↓
DecisionResult → Business Module
```

### Parallel Event Flow

```
Decision Engine
      │
      ├─ (sync) Return result to Business Module
      │
      └─ (async) Publish event
            │
            ├─ Audit Listener → Save to audit log
            ├─ Analytics Listener → Update dashboards
            ├─ Workflow Listener → Trigger next step
            └─ Notification Listener → Send alerts
```

### Lifecycle Summary

1. **Preparation**: Business module creates `DecisionContext`
2. **Orchestration**: Engine validates, selects provider
3. **Evaluation**: Provider executes decision logic
4. **Enrichment**: Engine adds execution metadata
5. **Events**: Engine publishes event (async)
6. **Return**: Business module receives `DecisionResult`
7. **Action**: Business module applies decision
8. **Audit**: Event listeners handle audit, analytics, workflow

**Total Time**: Typically <50ms (rule-based), <200ms (BI/AI-based)

---

## 14. Decision Types (Domain-Agnostic)

Decision Engine supports a **domain-agnostic taxonomy** of decision types. These types are independent of industry or business module.

### Core Decision Types

```
Decision Type Taxonomy (Industry-Agnostic)
├── Validation
├── Approval
├── Recommendation
├── Classification
├── Routing
├── Scoring
├── Eligibility
├── Forecast (Future)
└── Prediction (Future)
```

---

### 1. Validation

**Purpose**: Verify if input data meets criteria.

**Output**: Pass/fail with validation errors.

**Examples**:
- Validate booking data completeness
- Check employee eligibility for payroll
- Verify invoice data correctness

```typescript
const result = await decisionEngine.evaluate({
  decisionType: 'validation',
  ruleType: 'if-then',
  rule: {
    conditions: [
      { field: 'email', operator: 'matches', value: EMAIL_REGEX },
      { field: 'phone', operator: 'matches', value: PHONE_REGEX },
      { field: 'amount', operator: '>', value: 0 }
    ]
  },
  data: { email: 'customer@example.com', phone: '0901234567', amount: 5000000 }
});

// Result:
// {
//   approved: true,
//   reason: 'All validation rules passed',
//   metadata: { validatedFields: ['email', 'phone', 'amount'] }
// }
```

---

### 2. Approval

**Purpose**: Decide whether to approve or reject a request.

**Output**: Approved/rejected with rationale.

**Examples**:
- Auto-approve booking (if amount < threshold)
- Approve leave request (if balance available)
- Approve expense (if within budget)

```typescript
const result = await decisionEngine.evaluate({
  decisionType: 'auto-approval',
  ruleType: 'if-then',
  rule: {
    condition: { field: 'amount', operator: '<', value: 5000000 },
    action: { approve: true }
  },
  data: { amount: 3000000 }
});

// Result:
// {
//   approved: true,
//   confidence: 1.0,
//   reason: 'Amount below auto-approval threshold'
// }
```

---

### 3. Recommendation

**Purpose**: Suggest best action/option based on context.

**Output**: Ranked recommendations.

**Examples**:
- Recommend discount percentage
- Suggest next product to offer
- Recommend optimal service date

```typescript
const result = await decisionEngine.evaluate({
  decisionType: 'discount-recommendation',
  ruleType: 'bi-query', // Future: BI-based
  rule: {
    query: 'SELECT recommended_discount FROM pricing WHERE segment = :segment',
    params: { segment: 'vip' }
  },
  data: { customerSegment: 'vip', basePrice: 8000000 }
});

// Result:
// {
//   approved: true,
//   action: {
//     type: 'apply-discount',
//     data: { discountPercent: 0.10 }
//   },
//   recommendations: [
//     '10% discount for VIP customer',
//     'Upsell premium package'
//   ]
// }
```

---

### 4. Classification

**Purpose**: Classify input into categories.

**Output**: Category label with confidence.

**Examples**:
- Classify customer tier (VIP, Standard, New)
- Classify lead quality (Hot, Warm, Cold)
- Classify risk level (High, Medium, Low)

```typescript
const result = await decisionEngine.evaluate({
  decisionType: 'customer-classification',
  ruleType: 'decision-tree', // Future: AI-based
  rule: customerClassificationTree,
  data: {
    totalSpending: 50000000,
    visitFrequency: 'monthly',
    avgRating: 4.8
  }
});

// Result:
// {
//   approved: true,
//   action: {
//     type: 'classify',
//     data: { category: 'vip', tier: 1 }
//   },
//   confidence: 0.95,
//   reason: 'High spending + frequent visits + excellent ratings'
// }
```

---

### 5. Routing

**Purpose**: Route request to appropriate handler/team.

**Output**: Target destination with routing rules.

**Examples**:
- Route support ticket to team
- Route lead to sales agent
- Route approval to manager

```typescript
const result = await decisionEngine.evaluate({
  decisionType: 'ticket-routing',
  ruleType: 'decision-table',
  rule: supportRoutingTable,
  data: {
    ticketType: 'technical',
    priority: 'high',
    customerTier: 'vip'
  }
});

// Result:
// {
//   approved: true,
//   action: {
//     type: 'route',
//     data: {
//       team: 'technical-support',
//       priority: 'high',
//       assignee: 'senior-engineer'
//     }
//   },
//   reason: 'VIP customer + high priority → senior engineer'
// }
```

---

### 6. Scoring

**Purpose**: Calculate numerical score based on criteria.

**Output**: Score value with contributing factors.

**Examples**:
- Calculate credit score
- Score lead quality
- Calculate employee performance score

```typescript
const result = await decisionEngine.evaluate({
  decisionType: 'lead-scoring',
  ruleType: 'ml-model', // Future: AI-based scoring
  rule: {
    modelId: 'lead-score-v2',
    features: ['engagement', 'budget', 'timeline', 'authority']
  },
  data: {
    engagement: 0.8,
    budget: 100000000,
    timeline: 'immediate',
    authority: 'decision-maker'
  }
});

// Result:
// {
//   approved: true,
//   action: {
//     type: 'score',
//     data: { score: 85, category: 'hot-lead' }
//   },
//   metadata: {
//     featureScores: {
//       engagement: 20,
//       budget: 25,
//       timeline: 20,
//       authority: 20
//     }
//   },
//   reason: 'High engagement + large budget + immediate timeline'
// }
```

---

### 7. Eligibility

**Purpose**: Determine if entity qualifies for benefit/program.

**Output**: Eligible/ineligible with criteria breakdown.

**Examples**:
- Check KPI bonus eligibility
- Check promotion eligibility
- Check program enrollment eligibility

```typescript
const result = await decisionEngine.evaluate({
  decisionType: 'kpi-eligibility',
  ruleType: 'if-then',
  rule: {
    condition: {
      and: [
        { field: 'totalSessions', operator: '>=', value: 26 },
        { field: 'avgRating', operator: '>=', value: 4.5 },
        { field: 'violations', operator: '==', value: 0 }
      ]
    },
    action: { eligible: true }
  },
  data: {
    totalSessions: 28,
    avgRating: 4.7,
    violations: 0
  }
});

// Result:
// {
//   approved: true,
//   action: {
//     type: 'kpi-eligible',
//     data: { bonusAmount: 2000000 }
//   },
//   reason: 'All KPI criteria met',
//   matchedRules: ['kpi-eligibility-base']
// }
```

---

### 8. Forecast (Future)

**Purpose**: Predict future value based on trends.

**Output**: Forecasted value with confidence interval.

**Examples**:
- Forecast next month revenue
- Forecast capacity demand
- Forecast customer churn rate

```typescript
const result = await decisionEngine.evaluate({
  decisionType: 'revenue-forecast',
  ruleType: 'ml-model',
  rule: {
    modelId: 'revenue-forecast-v1',
    horizon: 'next-month',
    features: ['historical-revenue', 'seasonality', 'marketing-spend']
  },
  data: {
    historicalRevenue: [800000000, 850000000, 900000000],
    seasonality: 'high-season',
    marketingSpend: 50000000
  }
});

// Result:
// {
//   approved: true,
//   action: {
//     type: 'forecast',
//     data: {
//       predicted: 950000000,
//       confidenceInterval: [920000000, 980000000],
//       confidence: 0.85
//     }
//   },
//   reason: 'Strong historical trend + high season + increased marketing'
// }
```

---

### 9. Prediction (Future)

**Purpose**: Predict categorical outcome (yes/no, category).

**Output**: Predicted class with probability.

**Examples**:
- Predict customer churn
- Predict booking cancellation
- Predict loan default

```typescript
const result = await decisionEngine.evaluate({
  decisionType: 'churn-prediction',
  ruleType: 'ml-model',
  rule: {
    modelId: 'customer-churn-v3',
    features: ['daysSinceLastVisit', 'satisfactionScore', 'competitorProximity']
  },
  data: {
    daysSinceLastVisit: 45,
    satisfactionScore: 4.2,
    competitorProximity: 2.5
  }
});

// Result:
// {
//   approved: false, // Churn predicted
//   action: {
//     type: 'churn-risk',
//     data: { churnProbability: 0.73, riskLevel: 'high' }
//   },
//   confidence: 0.73,
//   reason: 'Long gap since last visit + declining satisfaction',
//   recommendations: [
//     'Launch retention campaign',
//     'Offer loyalty bonus',
//     'Schedule account manager call'
//   ]
// }
```

---

### Decision Type Matrix

| Decision Type | Input | Output | Primary Use Case | Provider |
|---------------|-------|--------|------------------|----------|
| **Validation** | Data object | Pass/fail | Data quality checks | Rule |
| **Approval** | Request object | Approve/reject | Authorization decisions | Rule, BI |
| **Recommendation** | Context object | Ranked options | Guidance/suggestions | BI, AI |
| **Classification** | Entity object | Category label | Segmentation | AI, Rule |
| **Routing** | Request object | Target destination | Workflow routing | Rule |
| **Scoring** | Entity object | Numerical score | Ranking/prioritization | AI, Rule |
| **Eligibility** | Entity object | Qualify/disqualify | Program access | Rule, BI |
| **Forecast** | Historical data | Future value | Planning/budgeting | AI |
| **Prediction** | Features | Outcome probability | Risk management | AI |

---

### Industry Mapping Examples

Same decision types work across industries:

```
Decision Type: Approval
├── Spa Industry: Auto-approve booking
├── Clinic Industry: Auto-approve appointment
├── Manufacturing: Auto-approve purchase order
├── Logistics: Auto-approve delivery route
└── Education: Auto-approve course enrollment

Decision Type: Classification
├── Spa Industry: Classify customer tier (VIP/Standard)
├── Clinic Industry: Classify patient risk (High/Medium/Low)
├── Manufacturing: Classify product quality (A/B/C)
├── Logistics: Classify shipment priority (Express/Standard)
└── Education: Classify student performance (Excellent/Good/Poor)

Decision Type: Prediction
├── Spa Industry: Predict customer churn
├── Clinic Industry: Predict patient no-show
├── Manufacturing: Predict equipment failure
├── Logistics: Predict delivery delay
└── Education: Predict student dropout
```

**Key Point**: Decision types are **domain-agnostic**. Business modules map their specific decisions to these types.

---

## 15. Cache Strategy

### Caching Principles

1. **Engine is stateless** - Caching is external concern
2. **Providers MAY cache** - Internal implementation detail
3. **Business modules MAY cache** - Results caching layer
4. **Cache key includes tenant** - Multi-tenant isolation

### Cache Layers

```
┌──────────────────────────────────────────────────┐
│ Business Module Layer                            │
│ ┌──────────────────────────────────────────────┐ │
│ │ Result Cache (Optional)                      │ │
│ │ TTL: 60-300 seconds                          │ │
│ └──────────────────────────────────────────────┘ │
└────────────────────┬─────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────┐
│ Decision Engine (Stateless, No Cache)            │
└────────────────────┬─────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────┐
│ Provider Layer                                    │
│ ┌──────────────────────────────────────────────┐ │
│ │ Provider-Level Cache (Optional)              │ │
│ │ - Rule definitions cache                     │ │
│ │ - BI query results cache                     │ │
│ │ - ML model cache                             │ │
│ │ TTL: Provider-specific                       │ │
│ └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

### When to Cache

✅ **Good candidates**:
- Rule definitions (change infrequently)
- BI query results (expensive to compute)
- ML model results (same input → same output)
- Static reference data

❌ **Bad candidates**:
- User-specific decisions (require fresh context)
- Real-time approvals (need immediate evaluation)
- Audit-critical decisions (must be traceable)

### Cache Implementation (Provider Level)

```typescript
// Example: RuleProvider with internal caching
class RuleProvider implements IDecisionProvider {
  private ruleCache = new Map<string, Rule>();
  private cacheTimestamps = new Map<string, number>();
  private readonly CACHE_TTL = 300000; // 5 minutes

  async evaluate(context: DecisionContext): Promise<DecisionResult> {
    const rule = await this.getRuleCached(context.rule.id);
    return this.evaluateRule(rule, context.data);
  }

  private async getRuleCached(ruleId: string): Promise<Rule> {
    const cached = this.ruleCache.get(ruleId);
    const timestamp = this.cacheTimestamps.get(ruleId);
    
    if (cached && timestamp && Date.now() - timestamp < this.CACHE_TTL) {
      return cached; // Cache hit
    }
    
    // Cache miss - load from database
    const rule = await this.ruleRepository.findById(ruleId);
    this.ruleCache.set(ruleId, rule);
    this.cacheTimestamps.set(ruleId, Date.now());
    
    return rule;
  }
}
```

### Cache Implementation (Business Module Level)

```typescript
// Example: Business module caches decision results
class BookingService {
  constructor(
    private readonly decisionEngine: IDecisionEngine,
    private readonly cache: ICache
  ) {}

  async evaluateApproval(booking: Booking): Promise<DecisionResult> {
    // Cache key includes all relevant factors
    const cacheKey = `decision:booking-approval:${booking.tenantId}:${booking.totalAmount}:${booking.customerTier}`;
    
    // Check cache
    const cached = await this.cache.get<DecisionResult>(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Cache miss - evaluate decision
    const context = this.buildContext(booking);
    const result = await this.decisionEngine.evaluate(context);
    
    // Store in cache (TTL: 5 minutes)
    await this.cache.set(cacheKey, result, 300);
    
    return result;
  }
}
```

### Cache Key Design

```typescript
// Cache key structure
const cacheKey = [
  'decision',
  decisionType,
  tenantId,
  hash(inputData) // MD5 or SHA256 of input data
].join(':');

// Examples:
'decision:auto-approval:bella-spa-vn:a1b2c3d4'
'decision:kpi-eligibility:bella-spa-vn:e5f6g7h8'
'decision:discount-recommendation:bella-spa-vn:i9j0k1l2'
```

### Cache Invalidation

```typescript
// Invalidate cache when rules change
eventBus.subscribe('rule.updated', async (event) => {
  const { ruleId, tenantId } = event.data;
  
  // Clear affected cache entries
  await cache.delete(`decision:*:${tenantId}:*`);
  
  // Or more targeted:
  await cache.delete(`rule:${ruleId}`);
});

// Invalidate cache when data changes
eventBus.subscribe('customer.updated', async (event) => {
  const { customerId, tenantId } = event.data;
  
  // Clear customer-specific decisions
  await cache.delete(`decision:*:${tenantId}:customer:${customerId}:*`);
});
```

### Performance Targets

| Scenario | Target | With Cache |
|----------|--------|------------|
| Rule-based decision | <50ms | <10ms |
| BI-based decision | <200ms | <20ms |
| AI-based decision | <500ms | <50ms |
| Cache hit rate | N/A | >80% |

### Cache Summary

- **Engine**: No caching (stateless)
- **Providers**: MAY cache internally (rules, queries, models)
- **Business Modules**: MAY cache results (with short TTL)
- **Strategy**: Cache expensive operations, not Engine logic
- **Invalidation**: Event-driven cache clearing

---

## 16. Event Strategy

### Event Types

Decision Engine publishes events for:
1. **Audit**: Complete trace of every decision
2. **Analytics**: Performance metrics, trends
3. **Workflow**: Trigger downstream processes
4. **Observability**: Monitoring, alerting

### Core Event: decision.evaluated

```typescript
interface DecisionEvaluatedEvent {
  type: 'decision.evaluated';
  timestamp: Date;
  data: {
    // Context
    tenantId: string;
    module: string;
    decisionType: string;
    correlationId: string;
    
    // Input
    ruleType: string;
    inputData: Record<string, unknown>;
    
    // Output
    approved: boolean;
    confidence: number;
    reason?: string;
    action?: unknown;
    
    // Execution
    provider: string;
    executionTime: number;
    
    // User (optional)
    userId?: string;
    userRole?: string;
  };
}
```

### Event Publishing (Engine)

```typescript
class DecisionEngine {
  async evaluate(context: DecisionContext): Promise<DecisionResult> {
    const result = await provider.evaluate(context);
    
    // Publish event (fire-and-forget, non-blocking)
    await this.eventPublisher.publish({
      type: 'decision.evaluated',
      timestamp: new Date(),
      data: {
        tenantId: context.tenantId,
        module: context.module,
        decisionType: context.decisionType,
        correlationId: context.correlationId,
        ruleType: context.ruleType,
        inputData: context.data,
        approved: result.approved,
        confidence: result.confidence,
        reason: result.reason,
        action: result.action,
        provider: result.provider,
        executionTime: result.executionTime,
        userId: context.user?.id,
        userRole: context.user?.role
      }
    });
    
    return result;
  }
}
```

### Event Subscribers

#### 1. Audit Logger

```typescript
eventBus.subscribe('decision.evaluated', async (event) => {
  await auditLog.insert({
    id: uuidv4(),
    type: 'decision',
    tenantId: event.data.tenantId,
    module: event.data.module,
    decisionType: event.data.decisionType,
    correlationId: event.data.correlationId,
    input: event.data.inputData,
    output: {
      approved: event.data.approved,
      confidence: event.data.confidence,
      reason: event.data.reason
    },
    provider: event.data.provider,
    executionTime: event.data.executionTime,
    userId: event.data.userId,
    timestamp: event.timestamp
  });
});
```

#### 2. Analytics Tracker

```typescript
eventBus.subscribe('decision.evaluated', async (event) => {
  // Track metrics
  await analytics.track({
    event: 'decision_made',
    properties: {
      tenant: event.data.tenantId,
      module: event.data.module,
      decision_type: event.data.decisionType,
      approved: event.data.approved,
      provider: event.data.provider,
      execution_time_ms: event.data.executionTime,
      confidence: event.data.confidence
    }
  });
  
  // Update dashboards
  await metrics.increment(`decisions.${event.data.module}.total`);
  await metrics.increment(`decisions.${event.data.module}.${event.data.approved ? 'approved' : 'rejected'}`);
  await metrics.histogram(`decisions.${event.data.module}.latency`, event.data.executionTime);
});
```

#### 3. Workflow Trigger

```typescript
eventBus.subscribe('decision.evaluated', async (event) => {
  // Trigger workflows based on decision
  if (event.data.approved && event.data.action?.type === 'requires-followup') {
    await workflowEngine.start({
      type: 'post-approval-workflow',
      context: {
        decisionId: event.data.correlationId,
        tenantId: event.data.tenantId,
        module: event.data.module
      }
    });
  }
  
  // Manual review workflow
  if (!event.data.approved && event.data.confidence < 0.7) {
    await workflowEngine.start({
      type: 'manual-review',
      context: {
        decisionId: event.data.correlationId,
        reason: event.data.reason
      }
    });
  }
});
```

#### 4. Notification Handler

```typescript
eventBus.subscribe('decision.evaluated', async (event) => {
  // Send notifications for certain decisions
  if (event.data.decisionType === 'high-value-approval' && event.data.approved) {
    await notificationService.send({
      to: 'manager@example.com',
      subject: 'High-Value Decision Approved',
      body: `Decision ${event.data.correlationId} approved automatically. Amount: ${event.data.inputData.amount}`
    });
  }
});
```

### Event Best Practices

1. **Non-blocking**: Event publishing must not slow down decision evaluation
2. **Fire-and-forget**: Engine doesn't wait for subscribers
3. **Idempotent handlers**: Subscribers must handle duplicate events
4. **Retry strategy**: Failed event processing should retry
5. **Dead letter queue**: Unprocessable events go to DLQ

### Event Flow

```
Decision Engine
    │
    │ evaluate()
    ↓
Provider Evaluation
    │
    │ return DecisionResult
    ↓
Engine (publish event)
    │
    └──> Event Bus
            │
            ├──> Audit Logger (save to DB)
            ├──> Analytics (track metrics)
            ├──> Workflow Engine (trigger workflows)
            └──> Notification Service (send alerts)

(All subscribers run asynchronously, independent of Engine)
```

---

## 17. Observability (Metrics, Logs, Traces)

### Observability Pillars

Decision Engine supports **enterprise-grade observability** through three pillars:

```
Observability
├── Metrics (Performance & Business KPIs)
├── Logs (Structured logging for debugging)
└── Traces (Distributed tracing across services)
```

---

### 1. Metrics

#### Performance Metrics

```typescript
// Execution latency histogram
metrics.histogram('decision.engine.latency', {
  tags: {
    tenant_id: context.tenantId,
    module: context.module,
    decision_type: context.decisionType,
    provider: provider.name
  },
  value: executionTime
});

// Throughput counter
metrics.increment('decision.engine.evaluations.total', {
  tags: {
    tenant_id: context.tenantId,
    module: context.module,
    result: result.approved ? 'approved' : 'rejected'
  }
});

// Error rate counter
metrics.increment('decision.engine.errors.total', {
  tags: {
    tenant_id: context.tenantId,
    provider: provider.name,
    error_type: error.name
  }
});

// Confidence distribution
metrics.histogram('decision.engine.confidence', {
  tags: {
    tenant_id: context.tenantId,
    provider: provider.name
  },
  value: result.confidence
});
```

#### Business Metrics

```typescript
// Approval rate by module
metrics.gauge('decision.engine.approval_rate', {
  tags: {
    tenant_id: context.tenantId,
    module: context.module
  },
  value: approvalRate
});

// Provider usage distribution
metrics.increment('decision.engine.provider.usage', {
  tags: {
    provider: provider.name,
    tenant_id: context.tenantId
  }
});

// Decision types distribution
metrics.increment('decision.engine.decision_type', {
  tags: {
    decision_type: context.decisionType,
    tenant_id: context.tenantId
  }
});
```

#### Sample Metrics Dashboard

```
Decision Engine Performance Dashboard

┌────────────────────────────────────────────────────────┐
│ Latency (P50, P95, P99)                                │
│ ● P50: 28ms   ● P95: 95ms   ● P99: 180ms             │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ Throughput (requests/sec)                              │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 2,450 req/s                        │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ Error Rate                                             │
│ ● 0.05% (1 error per 2,000 requests)                  │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ Approval Rate by Module                                │
│ Booking:  ██████████████████░░ 87%                    │
│ Payroll:  ████████████████████ 95%                    │
│ CRM:      ████████████░░░░░░░░ 62%                    │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ Provider Usage                                         │
│ RuleProvider:     ████████████████████ 82%            │
│ BIProvider:       ████░░░░░░░░░░░░░░░░ 15%            │
│ AIProvider:       █░░░░░░░░░░░░░░░░░░░  3%            │
└────────────────────────────────────────────────────────┘
```

---

### 2. Logs

#### Structured Logging Format

```typescript
// Log every decision evaluation
logger.info('Decision evaluated', {
  // Identification
  correlationId: context.correlationId,
  tenantId: context.tenantId,
  module: context.module,
  decisionType: context.decisionType,
  
  // Input
  ruleType: context.ruleType,
  ruleId: context.rule?.id,
  inputData: sanitizeForLog(context.data),
  
  // Output
  approved: result.approved,
  confidence: result.confidence,
  reason: result.reason,
  matchedRules: result.matchedRules,
  
  // Execution
  provider: result.provider,
  executionTime: result.executionTime,
  timestamp: result.timestamp,
  
  // User
  userId: context.user?.id,
  userRole: context.user?.role
});
```

#### Log Levels

```typescript
// DEBUG: Detailed provider execution
logger.debug('Provider evaluating rule', {
  provider: 'RuleProvider',
  ruleId: rule.id,
  conditions: rule.conditions
});

// INFO: Successful evaluations
logger.info('Decision approved', {
  correlationId: context.correlationId,
  approved: true,
  executionTime: 42
});

// WARN: Slow evaluations
if (executionTime > 1000) {
  logger.warn('Slow decision evaluation', {
    correlationId: context.correlationId,
    executionTime: executionTime,
    threshold: 1000
  });
}

// ERROR: Provider failures
logger.error('Provider evaluation failed', {
  correlationId: context.correlationId,
  provider: provider.name,
  error: error.message,
  stack: error.stack
});
```

#### Log Sanitization

```typescript
function sanitizeForLog(data: Record<string, unknown>): Record<string, unknown> {
  const sensitive = ['password', 'token', 'apiKey', 'ssn', 'creditCard'];
  
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => {
      if (sensitive.some(s => key.toLowerCase().includes(s))) {
        return [key, '***REDACTED***'];
      }
      return [key, value];
    })
  );
}
```

---

### 3. Traces

#### Distributed Tracing with OpenTelemetry

```typescript
import { trace, context as otelContext } from '@opentelemetry/api';

class DecisionEngine {
  private tracer = trace.getTracer('decision-engine');

  async evaluate(decisionContext: DecisionContext): Promise<DecisionResult> {
    // Start trace span
    return await this.tracer.startActiveSpan('decision.evaluate', async (span) => {
      try {
        // Add trace attributes
        span.setAttributes({
          'decision.tenant_id': decisionContext.tenantId,
          'decision.module': decisionContext.module,
          'decision.type': decisionContext.decisionType,
          'decision.rule_type': decisionContext.ruleType,
          'decision.correlation_id': decisionContext.correlationId || ''
        });

        // Select provider (child span)
        const provider = await this.tracer.startActiveSpan('decision.select_provider', (providerSpan) => {
          const p = this.registry.getProvider(decisionContext.ruleType);
          providerSpan.setAttributes({
            'provider.name': p?.name || 'unknown'
          });
          providerSpan.end();
          return p;
        });

        // Evaluate decision (child span)
        const result = await this.tracer.startActiveSpan('decision.provider_evaluate', async (evalSpan) => {
          evalSpan.setAttributes({
            'provider.name': provider.name
          });
          
          const r = await provider.evaluate(decisionContext);
          
          evalSpan.setAttributes({
            'decision.approved': r.approved,
            'decision.confidence': r.confidence
          });
          evalSpan.end();
          return r;
        });

        // Publish event (child span)
        await this.tracer.startActiveSpan('decision.publish_event', async (eventSpan) => {
          await this.eventPublisher.publish({
            type: 'decision.evaluated',
            data: { ...decisionContext, result }
          });
          eventSpan.end();
        });

        // Add result attributes to main span
        span.setAttributes({
          'decision.approved': result.approved,
          'decision.confidence': result.confidence,
          'decision.execution_time_ms': result.executionTime,
          'decision.provider': result.provider
        });

        span.end();
        return result;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message }); // ERROR
        span.end();
        throw error;
      }
    });
  }
}
```

#### Trace Visualization

```
Request ID: booking-7890-abcd

┌─────────────────────────────────────────────────────────┐
│ booking.service.approve            [120ms]              │
│   ├─ decision.evaluate             [45ms]               │
│   │   ├─ decision.select_provider  [2ms]                │
│   │   ├─ decision.provider_evaluate [38ms]              │
│   │   │   └─ rule.parse            [5ms]                │
│   │   │   └─ rule.evaluate         [30ms]               │
│   │   └─ decision.publish_event    [3ms]                │
│   ├─ booking.database.update       [35ms]               │
│   └─ notification.send             [28ms]               │
└─────────────────────────────────────────────────────────┘
```

#### Correlation Across Services

```typescript
// Business Module → Decision Engine → Provider → Database

// 1. Business Module starts trace
const span = tracer.startSpan('booking.approve');
const correlationId = uuidv4();

// 2. Context passed to Decision Engine
const result = await decisionEngine.evaluate({
  correlationId: correlationId,
  // ...
});

// 3. Decision Engine creates child span
// 4. Provider creates child span
// 5. Database query creates child span

// All spans share same trace ID for correlation
```

---

### Observability Best Practices

#### 1. Metric Cardinality

```typescript
// ❌ BAD: High cardinality (too many unique combinations)
metrics.increment('decision.evaluations', {
  tenant_id: context.tenantId,
  user_id: context.user?.id, // ❌ Too many users!
  rule_id: context.rule.id,   // ❌ Too many rules!
  timestamp: Date.now()        // ❌ Infinite values!
});

// ✅ GOOD: Low cardinality
metrics.increment('decision.evaluations', {
  tenant_id: context.tenantId,
  module: context.module,
  decision_type: context.decisionType,
  provider: provider.name
});
```

#### 2. Sampling for High-Volume

```typescript
// Sample traces for high-volume decisions (1% sampling)
const shouldTrace = Math.random() < 0.01;

if (shouldTrace) {
  return tracer.startActiveSpan('decision.evaluate', async (span) => {
    // Full tracing
  });
} else {
  // No tracing, just execute
  return provider.evaluate(context);
}
```

#### 3. Alerting Thresholds

```yaml
alerts:
  - name: high_decision_latency
    condition: p95(decision.engine.latency) > 200ms for 5min
    severity: warning
    
  - name: high_error_rate
    condition: rate(decision.engine.errors.total) > 1% for 2min
    severity: critical
    
  - name: low_confidence_decisions
    condition: avg(decision.engine.confidence) < 0.5 for 10min
    severity: warning
    
  - name: provider_timeout
    condition: rate(decision.engine.provider.timeout) > 0.1% for 1min
    severity: critical
```

---

### Observability Summary

| Pillar | Purpose | Tools | Retention |
|--------|---------|-------|-----------|
| **Metrics** | Performance & business KPIs | Prometheus, Datadog, CloudWatch | 30 days |
| **Logs** | Debugging & audit trail | Elasticsearch, CloudWatch Logs | 90 days |
| **Traces** | Distributed request flow | Jaeger, Zipkin, X-Ray | 7 days |

**Key Principles**:
- Every decision is logged
- Performance metrics are tracked
- Traces link decisions across services
- Sensitive data is sanitized
- Alerts notify on anomalies

---

## 18. Error Strategy (Fallback Chain)

### Error Handling Philosophy

**Principle**: Decision Engine must **never crash**. Always return a decision (even if it's a safe default).

```
Primary Provider
    ↓ (failure)
Fallback Strategy
    ↓
Safe Default Decision
```

---

### Error Types

#### 1. Provider Not Found

```typescript
// Error: No provider registered for rule type
async evaluate(context: DecisionContext): Promise<DecisionResult> {
  const provider = this.registry.getProvider(context.ruleType);
  
  if (!provider) {
    return {
      approved: false,
      confidence: 0.0,
      reason: `No provider found for rule type: ${context.ruleType}`,
      error: {
        message: 'Provider not found',
        code: 'PROVIDER_NOT_FOUND'
      },
      isFallback: true,
      executionTime: 0,
      provider: 'error-handler',
      timestamp: new Date()
    };
  }
}
```

#### 2. Provider Timeout

```typescript
async evaluateWithTimeout(
  provider: IDecisionProvider,
  context: DecisionContext,
  timeoutMs: number = 5000
): Promise<DecisionResult> {
  return Promise.race([
    provider.evaluate(context),
    new Promise<DecisionResult>((_, reject) =>
      setTimeout(() => reject(new TimeoutError('Provider timeout')), timeoutMs)
    )
  ]).catch((error) => {
    if (error instanceof TimeoutError) {
      return {
        approved: false,
        confidence: 0.0,
        reason: `Provider timeout after ${timeoutMs}ms`,
        error: {
          message: error.message,
          code: 'PROVIDER_TIMEOUT'
        },
        isFallback: true,
        executionTime: timeoutMs,
        provider: provider.name,
        timestamp: new Date()
      };
    }
    throw error;
  });
}
```

#### 3. Provider Evaluation Error

```typescript
async evaluate(context: DecisionContext): Promise<DecisionResult> {
  try {
    const result = await provider.evaluate(context);
    return result;
  } catch (error) {
    logger.error('Provider evaluation failed', {
      provider: provider.name,
      error: error.message,
      context: context
    });
    
    return {
      approved: false,
      confidence: 0.0,
      reason: `Provider evaluation failed: ${error.message}`,
      error: {
        message: error.message,
        code: 'PROVIDER_EVALUATION_ERROR',
        stack: error.stack
      },
      isFallback: true,
      executionTime: Date.now() - startTime,
      provider: provider.name,
      timestamp: new Date()
    };
  }
}
```

#### 4. Invalid Context

```typescript
function validateContext(context: DecisionContext): void {
  const errors: string[] = [];
  
  if (!context.tenantId) errors.push('tenantId is required');
  if (!context.module) errors.push('module is required');
  if (!context.decisionType) errors.push('decisionType is required');
  if (!context.ruleType) errors.push('ruleType is required');
  if (!context.rule) errors.push('rule is required');
  if (!context.data) errors.push('data is required');
  
  if (errors.length > 0) {
    throw new ValidationError(`Invalid context: ${errors.join(', ')}`);
  }
}
```

---

### Fallback Strategies

```typescript
interface ErrorHandlingOptions {
  /** Fallback strategy when primary provider fails */
  fallbackStrategy: 'default' | 'manual' | 'error' | 'chain';
  
  /** Safe default decision (used for 'default' strategy) */
  safeDefault?: boolean;
  
  /** Fallback provider chain (used for 'chain' strategy) */
  fallbackChain?: string[];
  
  /** Timeout for each provider evaluation */
  timeoutMs?: number;
  
  /** Maximum retry attempts */
  maxRetries?: number;
}
```

#### Strategy 1: Safe Default (Recommended)

```typescript
async evaluateWithFallback(context: DecisionContext): Promise<DecisionResult> {
  try {
    return await this.evaluate(context);
  } catch (error) {
    // Return safe default: REJECT
    return {
      approved: false, // Safe default: reject when uncertain
      confidence: 0.0,
      reason: 'Decision evaluation failed. Safe default applied (reject).',
      error: {
        message: error.message,
        code: 'FALLBACK_SAFE_DEFAULT'
      },
      isFallback: true,
      executionTime: Date.now() - startTime,
      provider: 'fallback-handler',
      timestamp: new Date()
    };
  }
}
```

#### Strategy 2: Manual Review

```typescript
async evaluateWithFallback(context: DecisionContext): Promise<DecisionResult> {
  try {
    return await this.evaluate(context);
  } catch (error) {
    // Trigger manual review workflow
    await this.workflowEngine.start({
      type: 'manual-review',
      reason: 'Automated decision failed',
      context: context,
      error: error.message
    });
    
    return {
      approved: false,
      confidence: 0.0,
      reason: 'Decision requires manual review due to system error.',
      nextActions: ['manual-review'],
      error: {
        message: error.message,
        code: 'FALLBACK_MANUAL_REVIEW'
      },
      isFallback: true,
      executionTime: Date.now() - startTime,
      provider: 'fallback-handler',
      timestamp: new Date()
    };
  }
}
```

#### Strategy 3: Provider Chain Fallback

```typescript
async evaluateWithChain(context: DecisionContext): Promise<DecisionResult> {
  const providerChain = [
    'rule',     // Primary: Rule-based
    'bi-query', // Fallback 1: BI-based
    'default'   // Fallback 2: Safe default
  ];
  
  for (const providerType of providerChain) {
    try {
      if (providerType === 'default') {
        return this.safeDefault(context);
      }
      
      const provider = this.registry.getProvider(providerType);
      if (provider) {
        return await provider.evaluate(context);
      }
    } catch (error) {
      logger.warn(`Provider ${providerType} failed, trying next in chain`, {
        error: error.message
      });
      continue;
    }
  }
  
  // All providers failed
  return this.safeDefault(context);
}
```

#### Strategy 4: Re-throw Error

```typescript
async evaluateStrict(context: DecisionContext): Promise<DecisionResult> {
  // No fallback - let error propagate
  return await this.evaluate(context);
}

// Business module handles error
try {
  const result = await decisionEngine.evaluateStrict(context);
} catch (error) {
  // Custom error handling at business level
  await notifyAdmin('Decision system failure', error);
  await booking.markAsPendingManualReview();
  throw error;
}
```

---

### Retry Strategy

```typescript
async evaluateWithRetry(
  context: DecisionContext,
  maxRetries: number = 3,
  backoffMs: number = 1000
): Promise<DecisionResult> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await this.evaluate(context);
    } catch (error) {
      if (attempt === maxRetries) {
        // All retries exhausted - return fallback
        return this.safeDefault(context, error);
      }
      
      // Exponential backoff
      const delay = backoffMs * Math.pow(2, attempt - 1);
      logger.warn(`Decision evaluation failed, retrying in ${delay}ms`, {
        attempt: attempt,
        maxRetries: maxRetries,
        error: error.message
      });
      
      await sleep(delay);
    }
  }
}
```

---

### Error Flow Diagram

```
Business Module
    │
    │ evaluate()
    ↓
Decision Engine
    │
    ├─ validate context → ❌ ValidationError → Return error result
    │
    ├─ select provider → ❌ ProviderNotFoundError → Return error result
    │
    ├─ evaluate with timeout
    │   ├─ provider.evaluate() → ❌ TimeoutError → Try fallback
    │   └─ provider.evaluate() → ❌ EvaluationError → Try fallback
    │
    ├─ Fallback Strategy
    │   ├─ default → Return safe default (reject)
    │   ├─ manual → Trigger manual review workflow
    │   ├─ chain → Try next provider in chain
    │   └─ error → Re-throw error
    │
    ↓
DecisionResult (always returned, even on error)
```

---

### Error Monitoring

```typescript
// Metrics
metrics.increment('decision.engine.errors.total', {
  error_type: error.code,
  provider: provider.name,
  fallback_used: true
});

// Alerts
if (errorRate > 0.01) { // >1% error rate
  alerting.send({
    severity: 'critical',
    message: 'Decision Engine error rate above threshold',
    errorRate: errorRate
  });
}
```

---

### Error Handling Best Practices

1. **Never crash**: Always return a decision (even if fallback)
2. **Log everything**: Every error must be logged with context
3. **Safe defaults**: When uncertain, reject (or require manual review)
4. **Fail fast**: Use timeouts to prevent hanging
5. **Retry transient errors**: Network issues, temporary unavailability
6. **Don't retry permanent errors**: Validation errors, configuration errors
7. **Monitor error rates**: Alert when errors spike
8. **Graceful degradation**: Fall back to simpler providers

---

## 19. Future AI/ML Integration

### Vision

Decision Engine Platform is designed to evolve from **rule-based** to **AI-powered** decisions over time:

```
Phase 1 (Current): Rule-Based Decisions
Phase 2 (Q3 2026): BI-Powered Insights
Phase 3 (Q1 2027): AI/ML Predictions ⭐
Phase 4 (Q2 2027): Hybrid (Rules + AI + Human)
```

---

### AI Provider Architecture

```typescript
interface IDecisionProvider {
  readonly name: string;
  readonly supportedRuleTypes: string[];
  
  evaluate(context: DecisionContext): Promise<DecisionResult>;
  canHandle(context: DecisionContext): boolean;
}

// AI Provider Implementation
class AIProvider implements IDecisionProvider {
  readonly name = 'AIProvider';
  readonly supportedRuleTypes = ['ml-model', 'ai-prediction', 'neural-network'];
  
  constructor(
    private readonly mlClient: IMLClient,
    private readonly modelRegistry: IModelRegistry
  ) {}
  
  async evaluate(context: DecisionContext): Promise<DecisionResult> {
    // 1. Load ML model
    const modelId = context.rule.modelId;
    const model = await this.modelRegistry.getModel(modelId);
    
    // 2. Prepare features
    const features = this.extractFeatures(context.data, model.featureSchema);
    
    // 3. Run inference
    const prediction = await this.mlClient.predict(model, features);
    
    // 4. Map to DecisionResult
    return {
      approved: prediction.result === 'approve',
      confidence: prediction.confidence,
      reason: prediction.explanation,
      metadata: {
        modelId: modelId,
        modelVersion: model.version,
        features: features,
        prediction: prediction,
        featureImportance: prediction.featureImportance
      },
      executionTime: 0, // Filled by Engine
      provider: this.name,
      timestamp: new Date()
    };
  }
}
```

---

### Use Cases for AI/ML

#### 1. Predictive Approvals

```typescript
// Use ML to predict booking approval likelihood
const result = await decisionEngine.evaluate({
  decisionType: 'booking-approval-prediction',
  ruleType: 'ml-model',
  rule: {
    modelId: 'booking-approval-v3',
    features: [
      'amount',
      'customerLifetimeValue',
      'bookingHistory',
      'seasonality',
      'capacity',
      'customerSatisfaction'
    ]
  },
  data: {
    amount: 10000000,
    customerLifetimeValue: 85000000,
    bookingHistory: { total: 15, cancelled: 1 },
    seasonality: 'peak',
    capacity: 0.8,
    customerSatisfaction: 4.7
  }
});

// Result includes AI explanation
// {
//   approved: true,
//   confidence: 0.89,
//   reason: 'High-value customer with excellent history. 89% approval confidence.',
//   metadata: {
//     featureImportance: {
//       customerLifetimeValue: 0.35,
//       bookingHistory: 0.28,
//       customerSatisfaction: 0.22,
//       amount: 0.15
//     }
//   }
// }
```

#### 2. Fraud Detection

```typescript
const result = await decisionEngine.evaluate({
  decisionType: 'fraud-detection',
  ruleType: 'neural-network',
  rule: {
    modelId: 'fraud-detector-v2',
    threshold: 0.7
  },
  data: {
    transactionAmount: 50000000,
    userBehaviorPattern: {...},
    deviceFingerprint: {...},
    ipAddress: '...',
    timeOfDay: 'late-night'
  }
});
```

#### 3. Customer Churn Prediction

```typescript
const result = await decisionEngine.evaluate({
  decisionType: 'churn-prediction',
  ruleType: 'ml-model',
  rule: {
    modelId: 'customer-churn-v3'
  },
  data: {
    daysSinceLastVisit: 45,
    satisfactionScore: 4.2,
    competitorProximity: 2.5,
    lifetimeValue: 85000000
  }
});
```

#### 4. Dynamic Pricing

```typescript
const result = await decisionEngine.evaluate({
  decisionType: 'dynamic-pricing',
  ruleType: 'ml-model',
  rule: {
    modelId: 'pricing-optimizer-v1'
  },
  data: {
    basePrice: 8000000,
    demand: 0.75,
    competitorPricing: [7500000, 8200000, 7800000],
    customerSegment: 'vip',
    timeUntilService: 48 // hours
  }
});
```

---

### AI Model Lifecycle

```
┌─────────────────────────────────────────────────┐
│ Model Development (Offline)                     │
│ ├─ Data Collection                              │
│ ├─ Feature Engineering                          │
│ ├─ Model Training                               │
│ ├─ Model Evaluation                             │
│ └─ Model Versioning                             │
└────────────┬────────────────────────────────────┘
             │ deploy
┌────────────▼────────────────────────────────────┐
│ Model Registry (Online)                         │
│ ├─ Model Versioning (v1, v2, v3...)            │
│ ├─ Feature Schema                               │
│ ├─ Model Metadata                               │
│ └─ A/B Test Configuration                       │
└────────────┬────────────────────────────────────┘
             │ load
┌────────────▼────────────────────────────────────┐
│ AI Provider (Decision Engine)                   │
│ ├─ Load Model                                   │
│ ├─ Extract Features                             │
│ ├─ Run Inference                                │
│ ├─ Map to DecisionResult                        │
│ └─ Log for Monitoring                           │
└────────────┬────────────────────────────────────┘
             │ return
┌────────────▼────────────────────────────────────┐
│ Business Module                                 │
│ ├─ Apply Decision                               │
│ ├─ Collect Feedback                             │
│ └─ Feed to Retraining Pipeline                  │
└─────────────────────────────────────────────────┘
```

---

### Hybrid Decisions (Rules + AI)

```typescript
// Composite Provider: Combine rules and AI
const result = await decisionEngine.evaluate({
  decisionType: 'booking-approval-hybrid',
  ruleType: 'composite',
  rule: {
    pipeline: [
      {
        provider: 'rule',
        rule: basicThresholdRule,
        weight: 0.3,
        veto: true // Can veto AI decision
      },
      {
        provider: 'ml-model',
        rule: { modelId: 'booking-approval-v3' },
        weight: 0.5
      },
      {
        provider: 'bi-query',
        rule: historicalApprovalQuery,
        weight: 0.2
      }
    ],
    strategy: 'weighted-average'
  },
  data: bookingData
});

// Result combines all three sources
// {
//   approved: true,
//   confidence: 0.82, // Weighted average
//   metadata: {
//     ruleResult: { approved: true, confidence: 1.0 },
//     mlResult: { approved: true, confidence: 0.75 },
//     biResult: { approved: true, confidence: 0.80 }
//   }
// }
```

---

### AI Integration Targets

| Platform | Use Case | Timeline |
|----------|----------|----------|
| **OpenAI API** | Natural language decisions, embeddings | Q1 2027 |
| **Azure ML** | Custom ML models, AutoML | Q1 2027 |
| **Google Vertex AI** | TensorFlow models, predictions | Q2 2027 |
| **AWS SageMaker** | Hosted models, batch inference | Q2 2027 |
| **Custom Models** | On-premise TensorFlow/PyTorch | Q3 2027 |

---

### Explainability & Trust

AI decisions must be explainable:

```typescript
{
  approved: true,
  confidence: 0.89,
  reason: 'AI prediction: 89% approval likelihood',
  metadata: {
    featureImportance: {
      customerLifetimeValue: 0.35, // Most important
      bookingHistory: 0.28,
      customerSatisfaction: 0.22,
      amount: 0.15
    },
    explainability: 'High lifetime value customer (85M VND) with excellent booking history (15 bookings, 1 cancellation) and high satisfaction (4.7/5).',
    modelConfidence: 0.89,
    confidenceInterval: [0.82, 0.94]
  }
}
```

---

## 20. Migration Path

### From Hardcoded Rules to Decision Engine

#### Current State (Before)

```typescript
// ❌ Hardcoded business logic in module
class BookingService {
  async approve(booking: Booking): Promise<boolean> {
    // Hardcoded rules scattered across codebase
    if (booking.totalAmount < 5000000) {
      return true; // Auto-approve small bookings
    }
    
    if (booking.customer.tier === 'vip' && booking.totalAmount < 10000000) {
      return true; // VIP gets higher threshold
    }
    
    if (booking.customer.bookingHistory.cancelledRate > 0.3) {
      return false; // High cancellation rate
    }
    
    return false; // Default: reject
  }
}
```

#### Target State (After)

```typescript
// ✅ Declarative decision via Decision Engine
class BookingService {
  constructor(
    private readonly decisionEngine: IDecisionEngine
  ) {}
  
  async approve(booking: Booking): Promise<boolean> {
    const context: DecisionContext = {
      tenantId: booking.tenantId,
      module: 'booking',
      decisionType: 'auto-approval',
      ruleType: 'if-then',
      rule: autoApprovalRule, // Externalized rule definition
      data: {
        amount: booking.totalAmount,
        customerTier: booking.customer.tier,
        cancellationRate: booking.customer.bookingHistory.cancelledRate
      }
    };
    
    const result = await this.decisionEngine.evaluate(context);
    return result.approved;
  }
}
```

---

### Migration Steps

#### Phase 1: Setup Engine Infrastructure

```bash
# 1. Install dependencies
npm install @bella/decision-engine

# 2. Bootstrap Engine
import { DecisionEngine, DecisionProviderRegistry, RuleProvider } from '@bella/decision-engine';
import { eventPublisher } from '@bella/events';

const registry = new DecisionProviderRegistry();
registry.register(new RuleProvider());

const engine = new DecisionEngine(registry, eventPublisher, logger);

export { engine as decisionEngine };
```

#### Phase 2: Extract Rules from Code

```typescript
// Before: Hardcoded
if (booking.totalAmount < 5000000) return true;

// After: Externalized rule
const autoApprovalRule = {
  type: 'if-then',
  condition: {
    field: 'amount',
    operator: '<',
    value: 5000000
  },
  action: { approve: true }
};
```

#### Phase 3: Migrate One Module at a Time

```
Migration Order (Recommended):
1. Booking Module (simple rules) ✅
2. Payroll Module (medium complexity)
3. CRM Module (complex rules)
4. Finance Module (high-stakes decisions)
```

#### Phase 4: Parallel Run (Shadow Mode)

```typescript
// Run both old and new logic in parallel
const oldResult = await this.approveOld(booking);
const newResult = await this.decisionEngine.evaluate(context);

// Compare results
if (oldResult !== newResult.approved) {
  logger.warn('Decision mismatch detected', {
    bookingId: booking.id,
    old: oldResult,
    new: newResult.approved
  });
}

// Use old logic (safe)
return oldResult;
```

#### Phase 5: Cutover

```typescript
// Switch to Engine
return result.approved;
```

#### Phase 6: Cleanup

```typescript
// Remove old hardcoded logic
// ❌ Delete this method
async approveOld(booking: Booking): Promise<boolean> {
  // Old logic removed
}
```

---

### Migration Checklist

**Pre-Migration**:
- [ ] Identify all hardcoded decision logic
- [ ] Document current rules in decision tables
- [ ] Set up Decision Engine infrastructure
- [ ] Train team on Engine usage

**During Migration**:
- [ ] Extract rules to JSON definitions
- [ ] Implement Engine integration
- [ ] Run parallel (shadow mode)
- [ ] Monitor for discrepancies
- [ ] Fix mismatches

**Post-Migration**:
- [ ] Remove old hardcoded logic
- [ ] Set up observability dashboards
- [ ] Configure alerting
- [ ] Document rule management process
- [ ] Train business users on rule updates

---

### Rollback Strategy

```typescript
// Feature flag for gradual rollout
const useDecisionEngine = featureFlags.isEnabled('decision-engine', tenantId);

if (useDecisionEngine) {
  return await this.approveWithEngine(booking);
} else {
  return await this.approveOld(booking);
}
```

---

### Success Criteria

Migration is successful when:
- ✅ All decisions use Engine (no hardcoded rules)
- ✅ Audit trail is complete (all decisions logged)
- ✅ Performance is acceptable (<50ms P95)
- ✅ Business users can update rules without code changes
- ✅ Observability dashboards show health metrics

---

## Conclusion

Decision Engine Platform is:
- **Domain-agnostic**: Works across any industry
- **Provider-based**: Supports multiple decision sources
- **Stateless**: Horizontally scalable
- **Event-driven**: Observable and auditable
- **Extensible**: Grow from rules → BI → AI without refactoring
- **Production-ready**: Error handling, observability, fallback strategies

**The Foundation is Frozen.** Focus now shifts to implementation.

---

## Related Documents

- [Decision Engine Principles](./DECISION_ENGINE_PRINCIPLES.md) - The 10 Commandments
- [Extension Architecture](./EXTENSION_ARCHITECTURE.md) - Phase 0 foundation
- [Industry Module Development Playbook](./INDUSTRY_MODULE_DEVELOPMENT_PLAYBOOK.md) - Integration guide

---

**Decision Engine Platform Architecture v1.0.0** 🏗️

**Status**: 🔒 **Architecture Frozen** (2026-06-22)

Changes only for: Critical bugs OR Real enterprise requirements (with approval)

