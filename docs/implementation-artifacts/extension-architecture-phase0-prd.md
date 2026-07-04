# Phase 0: Extension Architecture Design - PRD

**Ngày tạo**: 2026-06-22  
**Tác giả**: Bella ERP Team  
**Trạng thái**: Draft → Ready for Implementation

---

## 1. Mục tiêu (Goal)

Thiết kế **Extension Points** (điểm mở rộng) cho Bella ERP để:
- Decision Engine có thể mở rộng providers mà không cần sửa Core
- Workflow Engine có thể thêm actions mới mà không cần refactor
- Event system có thể thay đổi transport layer mà không ảnh hưởng business logic
- Integration layer có thể thêm connectors mới mà không cần rebuild

**KHÔNG** build plugin marketplace, dynamic loading, hoặc plugin infrastructure.

## 2. Nguyên tắc thiết kế (Design Principles)

> **"Design for extension, implement for current needs."**

### Core Principles:
1. **Open/Closed Principle**: Open for extension, closed for modification
2. **Dependency Inversion**: Core phụ thuộc vào abstractions, không phụ thuộc implementations
3. **Interface Segregation**: Interfaces nhỏ, focused, dễ implement
4. **No Over-Engineering**: Chỉ thiết kế interfaces, KHÔNG build plugin framework

### Anti-Patterns tránh:
- ❌ Plugin marketplace
- ❌ Dynamic plugin loading (.dll/.so loading)
- ❌ Plugin version management
- ❌ Plugin sandboxing/isolation
- ❌ Plugin registry UI
- ❌ Plugin SDK với complex tooling

## 3. Scope (Phạm vi)

### IN SCOPE (Làm trong Phase 0):
- ✅ Thiết kế 4 nhóm interfaces:
  1. `IDecisionProvider` - Decision Engine extensions
  2. `IWorkflowAction` - Workflow Engine extensions
  3. `IEventPublisher` - Event system extensions
  4. `IIntegrationAdapter` - Integration layer extensions

- ✅ Dependency Injection structure
- ✅ Folder structure cho implementations
- ✅ Documentation với examples
- ✅ 1-2 reference implementations mỗi interface

### OUT OF SCOPE (Không làm):
- ❌ Plugin marketplace/registry
- ❌ Hot-reload plugins
- ❌ Plugin versioning system
- ❌ Plugin discovery mechanism
- ❌ Plugin configuration UI
- ❌ Plugin SDK/CLI tools

## 4. Extension Points Details

### 4.1. Decision Provider Extension

**Mục đích**: Cho phép thêm decision-making strategies mới

**Interface**:
```typescript
interface IDecisionProvider {
  readonly name: string;
  readonly version: string;
  
  evaluate(context: DecisionContext): Promise<DecisionResult>;
  validate(rule: Rule): ValidationResult;
  supports(ruleType: string): boolean;
}
```

**Implementations hiện tại**:
- `RuleProvider` - If-then rules
- `BIProvider` - Query-based decisions

**Implementations tương lai** (không làm giờ):
- `AIProvider` - ML/AI decisions
- `MLProvider` - Predictive models
- `CustomProvider` - User-defined logic

### 4.2. Workflow Action Extension

**Mục đích**: Cho phép thêm workflow actions mới

**Interface**:
```typescript
interface IWorkflowAction {
  readonly actionType: string;
  readonly version: string;
  
  execute(context: WorkflowContext): Promise<ActionResult>;
  validate(config: ActionConfig): ValidationResult;
  rollback(context: WorkflowContext): Promise<void>;
}
```

**Implementations hiện tại**:
- `EmailAction` - Send email
- `NotificationAction` - In-app notification
- `WebhookAction` - HTTP webhook

**Implementations tương lai**:
- `ZaloAction` - Zalo OA message
- `SlackAction` - Slack notification
- `TeamsAction` - MS Teams message
- `AIAction` - AI-powered actions

### 4.3. Event Publisher Extension

**Mục đích**: Cho phép thay đổi event transport layer

**Interface**:
```typescript
interface IEventPublisher {
  readonly name: string;
  
  publish(event: DomainEvent): Promise<void>;
  subscribe(pattern: string, handler: EventHandler): Unsubscribe;
  close(): Promise<void>;
}
```

**Implementations hiện tại**:
- `InMemoryEventPublisher` - Synchronous, in-process

**Implementations tương lai**:
- `RedisEventPublisher` - Redis Pub/Sub
- `RabbitMQEventPublisher` - Message queue
- `KafkaEventPublisher` - Event streaming

### 4.4. Integration Adapter Extension

**Mục đích**: Cho phép thêm external integrations mới

**Interface**:
```typescript
interface IIntegrationAdapter {
  readonly provider: string;
  readonly version: string;
  
  send(payload: IntegrationPayload): Promise<IntegrationResult>;
  receive(webhook: WebhookPayload): Promise<void>;
  validate(config: IntegrationConfig): ValidationResult;
  healthCheck(): Promise<HealthStatus>;
}
```

**Implementations hiện tại**:
- `ZaloAdapter` - Zalo OA
- `MetaAdapter` - Facebook/Instagram

**Implementations tương lai**:
- `SAPAdapter` - SAP ERP integration
- `GoogleAdapter` - Google Workspace
- `ShopeeAdapter` - E-commerce platform
- `BankAdapter` - Banking APIs

## 5. Success Criteria (Tiêu chí thành công)

### ✅ Done khi:

1. **Interfaces Defined**
   - [ ] 4 core interfaces đã được định nghĩa rõ ràng
   - [ ] Mỗi interface có JSDoc đầy đủ
   - [ ] Type definitions với generics nếu cần

2. **Folder Structure**
   - [ ] `src/lib/decision-engine/abstractions/` exists
   - [ ] `src/lib/workflow-engine/abstractions/` exists
   - [ ] `src/lib/events/abstractions/` exists
   - [ ] `src/lib/integrations/abstractions/` exists

3. **Reference Implementations**
   - [ ] 1-2 implementations cho mỗi interface
   - [ ] Implementations đơn giản, dễ hiểu
   - [ ] Test coverage >= 80%

4. **Documentation**
   - [ ] `docs/EXTENSION_ARCHITECTURE.md` complete
   - [ ] Each interface có usage examples
   - [ ] Architecture diagrams (Mermaid)
   - [ ] Migration path từ code hiện tại

5. **Dependency Injection**
   - [ ] DI container setup (hoặc simple factory pattern)
   - [ ] Provider registration mechanism
   - [ ] Lifetime management (singleton/scoped/transient)

6. **No Over-Engineering**
   - [ ] KHÔNG có dynamic plugin loading code
   - [ ] KHÔNG có plugin marketplace code
   - [ ] KHÔNG có plugin versioning system
   - [ ] KHÔNG có complex reflection/metadata

## 6. Timeline

**Phase 0 Duration**: 2-3 ngày

**Breakdown**:
- Day 1: Interface design + folder structure
- Day 2: Reference implementations + DI setup
- Day 3: Documentation + examples + review

## 7. Risks & Mitigations

### Risk 1: Over-abstraction
- **Risk**: Thiết kế interfaces quá phức tạp, khó implement
- **Mitigation**: Keep interfaces minimal, start simple

### Risk 2: Under-abstraction
- **Risk**: Interfaces quá simple, thiếu tính năng cần thiết
- **Mitigation**: Review với real use cases (Email, Webhook, Zalo)

### Risk 3: Premature optimization
- **Risk**: Thêm features không cần thiết
- **Mitigation**: Strict adherence to "current needs only"

## 8. Dependencies

**Technical**:
- TypeScript 5.x
- Node.js 18+
- Existing codebase structure

**Knowledge**:
- Current notification system
- Current webhook system
- Current event handling

## 9. Non-Goals (Không phải mục tiêu)

- ❌ Build plugin marketplace
- ❌ Plugin hot-reload
- ❌ Plugin versioning
- ❌ Plugin discovery service
- ❌ Plugin configuration UI
- ❌ Complex plugin SDK

## 10. Implementation Checklist

### Phase 0A: Interface Design (Day 1)
- [ ] Review existing notification/webhook/event code
- [ ] Identify common patterns and abstractions
- [ ] Draft IDecisionProvider interface with JSDoc
- [ ] Draft IWorkflowAction interface with JSDoc
- [ ] Draft IEventPublisher interface with JSDoc
- [ ] Draft IIntegrationAdapter interface with JSDoc
- [ ] Create folder structure for abstractions
- [ ] Validate interfaces with 2-3 real use cases

### Phase 0B: Reference Implementations (Day 2)
- [ ] Implement RuleProvider (simple if-then)
- [ ] Implement EmailAction (existing email logic)
- [ ] Implement InMemoryEventPublisher (sync events)
- [ ] Setup simple DI container or factory pattern
- [ ] Write unit tests for each implementation
- [ ] Verify test coverage >= 80%

### Phase 0C: Documentation & Validation (Day 3)
- [ ] Write EXTENSION_ARCHITECTURE.md with:
  - [ ] Overview and principles
  - [ ] Each interface documented
  - [ ] Usage examples
  - [ ] Architecture diagrams (Mermaid)
  - [ ] Migration guide
- [ ] Code review: Check for over-engineering
- [ ] Validate: No plugin framework code added
- [ ] Validate: Interfaces are simple and focused
- [ ] Final review and sign-off

---

## Appendix A: Example Usage

### Decision Provider Example

```typescript
// Core engine - KHÔNG biết implementation
class DecisionEngine {
  constructor(private providers: IDecisionProvider[]) {}
  
  async evaluate(context: DecisionContext) {
    const provider = this.providers.find(p => p.supports(context.ruleType));
    if (!provider) throw new Error(`No provider for ${context.ruleType}`);
    return provider.evaluate(context);
  }
}

// Usage
const engine = new DecisionEngine([
  new RuleProvider(),
  new BIProvider(),
  // Future: new AIProvider() - Core KHÔNG cần thay đổi
]);

await engine.evaluate({ ruleType: 'if-then', data: {...} });
```

### Workflow Action Example

```typescript
// Core engine - KHÔNG biết action cụ thể
class WorkflowEngine {
  constructor(private actions: Map<string, IWorkflowAction>) {}
  
  async execute(step: WorkflowStep) {
    const action = this.actions.get(step.actionType);
    if (!action) throw new Error(`Unknown action: ${step.actionType}`);
    
    const result = await action.execute(step.context);
    if (!result.success && step.rollbackOnError) {
      await action.rollback(step.context);
    }
    return result;
  }
}

// Usage
const engine = new WorkflowEngine(new Map([
  ['email', new EmailAction(emailConfig)],
  ['webhook', new WebhookAction()],
  // Future: ['zalo', new ZaloAction()] - Core KHÔNG cần thay đổi
]));

await engine.execute({ actionType: 'email', context: {...} });
```

---

## Sign-off

**Ready for Implementation**: ✅ YES  
**Approved by**: _____________  
**Date**: 2026-06-22
