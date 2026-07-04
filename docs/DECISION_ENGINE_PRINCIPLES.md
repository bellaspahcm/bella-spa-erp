# Decision Engine - Design Principles

**Version**: 1.0.0  
**Status**: 🔒 **Immutable Constitution**  
**Last Updated**: 2026-06-22

---

## Purpose of This Document

Đây là **"Hiến pháp"** của Decision Engine Platform. Những nguyên tắc trong tài liệu này là **bất di bất dịch** và phải được tuân thủ trong mọi quyết định thiết kế, implementation, và refactoring.

Khi có conflict giữa implementation convenience và principles, **principles luôn thắng**.

---

## The 10 Commandments of Decision Engine

### 1️⃣ Engine MUST NOT Know Business Modules

**Principle**: Decision Engine là **domain-agnostic platform capability**.

**Rules**:
- ❌ Engine KHÔNG được import bất kỳ business module nào (Payroll, CRM, HR, Inventory, Booking, Finance, Marketing, etc.)
- ❌ Engine KHÔNG được biết về business entities (Customer, Employee, Order, Invoice, Session, etc.)
- ❌ Engine KHÔNG được có business logic cụ thể (discount calculation, approval thresholds, KPI formulas, etc.)
- ✅ Engine CHỈ biết generic abstractions: `DecisionContext`, `DecisionResult`, `IDecisionProvider`

**Example - WRONG**:
```typescript
// ❌ BAD: Engine knows about Booking
class DecisionEngine {
  async approveBooking(booking: Booking): Promise<boolean> {
    if (booking.totalAmount < 5000000) return true;
    return false;
  }
}
```

**Example - CORRECT**:
```typescript
// ✅ GOOD: Engine only knows abstractions
class DecisionEngine {
  async evaluate(context: DecisionContext): Promise<DecisionResult> {
    const provider = this.selectProvider(context.ruleType);
    return provider.evaluate(context);
  }
}

// Business module maps its entities to context
const result = await engine.evaluate({
  ruleType: 'if-then',
  rule: autoApprovalRule,
  data: { totalAmount: booking.totalAmount }
});
```

**Why**: Nếu Engine biết về business modules, khi thêm industry mới (Manufacturing, Logistics, Education), Engine phải sửa code. Đây là **anti-pattern** của platform architecture.

---

### 2️⃣ Engine MUST Be Provider-Based

**Principle**: Tất cả decision logic nằm trong **Providers**, không nằm trong Engine.

**Rules**:
- ✅ Engine CHỈ là orchestrator - select provider và delegate execution
- ✅ Providers implement `IDecisionProvider` interface
- ✅ Mỗi provider là independent module
- ❌ Engine KHÔNG được có if/else logic cho business rules

**Provider Model**:
```
DecisionEngine (Orchestrator)
    ↓
ProviderRegistry (Selector)
    ↓
IDecisionProvider (Abstraction)
    ↓
RuleProvider | BIProvider | AIProvider | ExternalProvider (Implementations)
```

**Example**:
```typescript
// ✅ Engine delegates to providers
class DecisionEngine {
  constructor(private registry: DecisionProviderRegistry) {}
  
  async evaluate(context: DecisionContext): Promise<DecisionResult> {
    // Engine only orchestrates
    const provider = this.registry.getProvider(context.ruleType);
    if (!provider) throw new ProviderNotFoundError(context.ruleType);
    
    // All logic is in provider
    return provider.evaluate(context);
  }
}
```

**Why**: Provider-based architecture cho phép add/remove/replace decision sources mà không ảnh hưởng Engine core.

---

### 3️⃣ Providers MUST Be Replaceable

**Principle**: Providers là **plug-and-play** components.

**Rules**:
- ✅ Providers register via DI container
- ✅ Providers có thể add/remove tại runtime startup
- ✅ Multiple providers có thể coexist
- ✅ Provider replacement KHÔNG yêu cầu Engine code changes
- ❌ Engine KHÔNG được hardcode provider instances

**Registration Pattern**:
```typescript
// ✅ Providers are registered, not hardcoded
extensionRegistry.registerDecisionProvider(new RuleProvider());
extensionRegistry.registerDecisionProvider(new BIProvider());
extensionRegistry.registerDecisionProvider(new AIProvider());

// Engine uses registry, not direct instantiation
const engine = new DecisionEngine(extensionRegistry);
```

**Why**: Business needs evolve. Hôm nay dùng Rule-based, ngày mai có thể chuyển sang AI-based. Provider replacement phải là **zero-downtime operation**.

---

### 4️⃣ Engine MUST Be Stateless

**Principle**: Decision Engine KHÔNG lưu trữ state giữa các lần evaluate.

**Rules**:
- ❌ Engine KHÔNG có instance variables để cache results
- ❌ Engine KHÔNG có session/user context
- ❌ Engine KHÔNG có transaction management
- ✅ Mỗi `evaluate()` call là independent
- ✅ State management thuộc về Providers (nếu cần)

**Example - WRONG**:
```typescript
// ❌ BAD: Stateful engine
class DecisionEngine {
  private lastDecision: DecisionResult; // State!
  private userContext: UserContext; // State!
  
  async evaluate(context: DecisionContext): Promise<DecisionResult> {
    this.lastDecision = await this.provider.evaluate(context);
    return this.lastDecision;
  }
}
```

**Example - CORRECT**:
```typescript
// ✅ GOOD: Stateless engine
class DecisionEngine {
  async evaluate(context: DecisionContext): Promise<DecisionResult> {
    const provider = this.selectProvider(context.ruleType);
    return provider.evaluate(context); // No state stored
  }
}
```

**Why**: Stateless design cho phép horizontal scaling, easier testing, và no side effects.

---

### 5️⃣ Business Logic Belongs to Providers (Not Engine)

**Principle**: Engine chỉ **orchestrate**, không **implement** business logic.

**Rules**:
- ✅ Rule evaluation logic → RuleProvider
- ✅ BI query logic → BIProvider
- ✅ AI prediction logic → AIProvider
- ✅ External API logic → ExternalProvider
- ❌ Engine KHÔNG có business validation
- ❌ Engine KHÔNG có calculation logic

**Clear Separation**:
```
Engine Responsibilities:
- Select appropriate provider
- Execute provider.evaluate()
- Handle provider errors
- Publish decision events
- Return standardized result

Provider Responsibilities:
- Parse rule definitions
- Evaluate conditions
- Execute business logic
- Return DecisionResult
- Handle provider-specific errors
```

**Why**: Business logic thay đổi thường xuyên. Giữ nó trong Providers giúp Engine core **stable và unchanging**.

---

### 6️⃣ Providers MAY Use BI/AI/External Sources

**Principle**: Providers có **full autonomy** trong cách họ đưa ra decisions.

**Rules**:
- ✅ RuleProvider: Dùng if-then rules từ database/config
- ✅ BIProvider: Query BI dashboards/data warehouse
- ✅ AIProvider: Call ML models/APIs
- ✅ ExternalProvider: Integrate 3rd-party decision APIs
- ✅ CompositeProvider: Chain multiple providers
- ❌ Engine KHÔNG care về provider internals

**Provider Autonomy**:
```typescript
// ✅ Each provider decides how to make decisions
class BIProvider implements IDecisionProvider {
  async evaluate(context: DecisionContext): Promise<DecisionResult> {
    // Query Power BI / Tableau / Metabase
    const query = this.buildQuery(context);
    const result = await this.biClient.execute(query);
    return this.mapToDecisionResult(result);
  }
}

class AIProvider implements IDecisionProvider {
  async evaluate(context: DecisionContext): Promise<DecisionResult> {
    // Call OpenAI / Azure ML / Vertex AI
    const prediction = await this.mlModel.predict(context.data);
    return this.mapToDecisionResult(prediction);
  }
}
```

**Why**: Decision sources evolve. Từ rules → BI → AI là natural evolution. Provider autonomy cho phép evolution này mà không breaking Engine.

---

### 7️⃣ Engine Returns DecisionResult Only

**Principle**: Engine output là **standardized** `DecisionResult` object.

**Rules**:
- ✅ Tất cả providers return `DecisionResult`
- ✅ Engine trả về `DecisionResult` unchanged
- ❌ Engine KHÔNG transform/enrich result
- ❌ Engine KHÔNG wrap result trong custom types
- ✅ Business modules interpret `DecisionResult` theo nhu cầu của họ

**Standard Contract**:
```typescript
interface DecisionResult {
  // Core fields (required)
  approved: boolean;
  confidence: number; // 0.0 to 1.0
  
  // Optional fields
  action?: {
    type: string;
    data: Record<string, unknown>;
  };
  reason?: string;
  matchedRules?: string[];
  metadata?: Record<string, unknown>;
  
  // Execution context
  executionTime: number; // milliseconds
  provider: string;
  timestamp: Date;
}
```

**Why**: Standard contract cho phép business modules consume decisions mà không care về provider internals.

---

### 8️⃣ Engine Never Accesses Database Directly

**Principle**: Engine là **pure orchestrator**, không có data access layer.

**Rules**:
- ❌ Engine KHÔNG có database connections
- ❌ Engine KHÔNG query tables
- ❌ Engine KHÔNG save decisions to DB
- ✅ Providers MAY access database (cho rule definitions)
- ✅ Business modules save decisions (via audit/event handlers)

**Data Flow**:
```
Business Module
    ↓ (passes context)
DecisionEngine
    ↓ (delegates)
Provider
    ↓ (MAY query DB for rules)
Database

Decision Result
    ↓ (returns to)
Business Module
    ↓ (saves decision)
Audit/Event System
    ↓
Database
```

**Why**: Separation of concerns. Engine orchestrates, Providers decide, Business modules persist.

---

### 9️⃣ Engine Never Calls Business Modules

**Principle**: Dependency direction là **one-way**: Business Modules → Engine (NOT Engine → Business Modules).

**Rules**:
- ✅ Business modules call Engine
- ❌ Engine KHÔNG call business modules
- ❌ Engine KHÔNG import from business modules
- ❌ Engine KHÔNG trigger business workflows
- ✅ Engine publishes events (business modules subscribe)

**Dependency Direction**:
```
✅ CORRECT:
Business Module → DecisionEngine → Provider

❌ WRONG:
DecisionEngine → Business Module (circular dependency!)
```

**Communication via Events**:
```typescript
// ✅ Engine publishes events, doesn't call modules
class DecisionEngine {
  async evaluate(context: DecisionContext): Promise<DecisionResult> {
    const result = await this.provider.evaluate(context);
    
    // Publish event instead of calling business module
    await this.eventPublisher.publish({
      type: 'decision.evaluated',
      data: { context, result }
    });
    
    return result;
  }
}

// Business module subscribes to events
eventPublisher.subscribe('decision.evaluated', async (event) => {
  // Business module handles its own logic
  await bookingService.processDecision(event.data);
});
```

**Why**: Prevents circular dependencies và maintains clean architecture layers.

---

### 🔟 All Decisions Are Auditable and Traceable

**Principle**: Mọi decision phải có **complete audit trail**.

**Rules**:
- ✅ Engine logs every evaluation (input, output, provider, execution time)
- ✅ Engine emits decision events
- ✅ DecisionResult includes metadata (provider, timestamp, matchedRules)
- ✅ Business modules save audit records
- ❌ Engine KHÔNG delete audit logs

**Audit Trail**:
```typescript
// Every decision is traced
interface DecisionAudit {
  id: string;
  timestamp: Date;
  
  // Input
  context: DecisionContext;
  provider: string;
  
  // Output
  result: DecisionResult;
  
  // Execution
  executionTime: number;
  success: boolean;
  error?: string;
  
  // Metadata
  tenantId: string;
  userId?: string;
  correlationId?: string;
}
```

**Why**: Compliance, debugging, và business intelligence cần full traceability.

---

## Principles Summary Table

| # | Principle | Impact | Enforcement |
|---|-----------|--------|-------------|
| 1 | Engine MUST NOT know business modules | Domain independence | Code review, import analysis |
| 2 | Engine MUST be provider-based | Extensibility | Architecture review |
| 3 | Providers MUST be replaceable | Flexibility | DI container usage |
| 4 | Engine MUST be stateless | Scalability | No instance variables |
| 5 | Business logic belongs to Providers | Maintainability | Code review |
| 6 | Providers MAY use BI/AI/External | Innovation | Interface compliance |
| 7 | Engine returns DecisionResult only | Contract stability | Type checking |
| 8 | Engine never accesses DB directly | Separation of concerns | No DB imports |
| 9 | Engine never calls business modules | One-way dependency | Import analysis |
| 10 | All decisions are auditable | Compliance | Event emission |

---

## Violation Consequences

Nếu principles bị vi phạm:

⚠️ **Short-term**: 
- Technical debt tăng
- Testing khó khăn
- Coupling tăng

🔥 **Long-term**:
- Không thể add industry mới mà không sửa Engine
- Provider replacement becomes breaking change
- Scaling becomes impossible
- Audit trail bị mất

---

## Enforcement

**Pre-commit Checks**:
- ✅ Import analysis: Engine không import business modules
- ✅ Type checking: All returns are `DecisionResult`
- ✅ Stateless check: No instance state variables

**Code Review Checklist**:
- [ ] Does Engine import from business modules? (Must be NO)
- [ ] Does Engine have business logic? (Must be NO)
- [ ] Are providers replaceable via DI? (Must be YES)
- [ ] Is Engine stateless? (Must be YES)
- [ ] Are decisions auditable? (Must be YES)

**Architecture Review**:
- Quarterly review of Engine dependencies
- Annual review of provider architecture
- Continuous monitoring of import graph

---

## Evolution

Principles có thể evolve, nhưng chỉ khi:
1. **Có consensus** từ architecture team
2. **Có migration plan** cho existing code
3. **Không break** existing consumers
4. **Có approval** từ CTO/Lead Architect

**Version History**:
- v1.0.0 (2026-06-22): Initial principles established

---

## Related Documents

- [Extension Architecture](./EXTENSION_ARCHITECTURE.md) - Extension points design
- [Decision Engine Platform Architecture](./DECISION_ENGINE_PLATFORM_ARCHITECTURE.md) - Technical architecture (Next)

---

**Remember**: These principles are **immutable**. When in doubt, refer back to this document.

**The Constitution of Decision Engine Platform** 🏛️
