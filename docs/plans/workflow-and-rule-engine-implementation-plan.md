# Kế Hoạch Triển Khai Workflow Engine & Rule Engine
## Bella ERP - Enterprise Intelligence Platform

**Ngày lập:** 22/06/2026  
**Cập nhật:** 22/06/2026 (v1.1 - after technical review)  
**Người lập:** AI Assistant  
**Reviewed by:** Technical Lead ⭐⭐⭐⭐⭐  
**Mục tiêu:** Xây dựng **5 Engine cốt lõi** để tạo Enterprise Intelligence Platform

---

## 🎯 TẦM NHÌN: 5-ENGINE ARCHITECTURE

```
┌─────────────────────────────────────────────┐
│   Business Intelligence Engine (ĐÃ CÓ)     │
│   - Revenue, Cash Flow, KPI, ROI            │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│   Rule Engine (Decision) - PHASE 1         │
│   - IF Cash Flow < 2 months → Reject        │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│   Workflow Engine (Process) - PHASE 1      │
│   - Move State, Orchestrate                 │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│   Event Engine (Integration) - PHASE 2     │
│   - Publish Events → Workers                │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│   AI Intelligence Engine - PHASE 3         │
│   - Predictive, Recommendations             │
└─────────────────────────────────────────────┘
```

**USP (Unique Selling Point):**
> Bella không chỉ là ERP. Bella là nền tảng quyết định thông minh dựa trên dữ liệu thực tế của doanh nghiệp.

---

## 📋 TÓM TẮT EXECUTIVE (UPDATED)

### Tại sao cần 5-Engine Architecture?

**Hiện trạng:**
- ✅ **Business Intelligence Engine** đã có (revenue, cash flow, KPI, forecasting)
- ❌ Approval logic hard-code trong server actions
- ❌ Business rules (hoa hồng, discount) không connect với BI data
- ❌ Quyết định dựa trên "cảm tính" chứ không phải data
- ❌ Admin không thể tự config rules mà phải chờ dev

**Giải pháp (3 Phases):**

**Phase 1 (12 tuần):** Rule Engine + Workflow Engine
1. **Rule Engine**: Decision layer - đọc BI data để quyết định
   - Example: `IF Cash Flow < 2 months → Reject expense approval`
2. **Workflow Engine**: Process orchestration - move state only, ask Rule Engine for decisions

**Phase 2 (8 tuần):** Event Engine
3. **Event Engine**: Publish events thay vì direct actions
   - Workflow → Event → Workers (notification, webhook, AI, cache, BI refresh)

**Phase 3 (12 tuần):** AI Intelligence Engine  
4. **AI Intelligence Engine**: Predictive & recommendations
   - Example: "Suggest auto-approve based on 95% historical approval rate"

**Lợi ích:**
- ✅ **Data-Driven Decisions**: Rules đọc real-time BI metrics
- ✅ **Event-Driven Architecture**: Loose coupling, scalable
- ✅ **Visual Designer**: Drag & Drop (như Power Automate, n8n, Camunda)
- ✅ **Enterprise States**: Waiting, Suspended, Escalated, Delegated, Compensated
- ✅ **Workflow Variables**: Context-aware (salary, department, inventory)
- ✅ **Version Management**: Deploy new version without breaking running instances
- ✅ **Audit Trail**: CEO biết "Ai duyệt? Lúc nào? Vì sao?"

**Timeline:** 32 tuần (8 tháng) cho cả 3 phases  
**Phase 1 Focus:** 12 tuần (Rule + Workflow engines)  
**Risk Level:** Medium-High (affects core business logic)

---

## 🎯 PHẦN 1: WORKFLOW ENGINE (Build After Rule Engine)

> **REVIEW NOTE:** Workflow KHÔNG evaluate rules. Workflow chỉ hỏi Rule Engine và move state.

### 1.1 Định Nghĩa & Scope (UPDATED)

**Workflow Engine là gì?**
- **Process orchestration layer** - chỉ move state
- **KHÔNG** evaluate logic - hỏi Rule Engine
- State machine với transitions, timeouts, compensation
- **Event-driven** - publish events thay vì direct actions

**Kiến trúc mới (Decoupled):**

```
┌──────────────────────────────────┐
│       Workflow Engine            │
│  1. Receive transition request   │
│  2. Ask Rule Engine: Can move?   │ ◄─── KHÔNG tự evaluate
│  3. If yes, move state           │
│  4. Publish event                │ ◄─── KHÔNG gọi action trực tiếp
└──────────────┬───────────────────┘
               ▼
┌──────────────────────────────────┐
│        Event Bus                 │
│  workflow.approved               │
│  workflow.rejected               │
│  workflow.compensated            │
└──────────────┬───────────────────┘
               ▼
┌──────────────────────────────────┐
│        Event Workers             │
│  - Notification Worker           │
│  - Webhook Worker                │
│  - AI Analysis Worker            │
│  - Cache Refresh Worker          │
│  - BI Dashboard Worker           │
└──────────────────────────────────┘
```

**Use Cases MVP:**

| Workflow | Module | States | Priority | Event-Driven |
|----------|--------|--------|----------|--------------|
| Leave Request | HR | Pending → ManagerApproved → HRApproved → Approved | P0 | ✅ |
| Salary Approval | Finance | Draft → Accounting → CFOApproved → Published | P0 | ✅ |
| Booking Confirmation | Ops | Pending → Deposit → Confirmed → Completed/Cancelled | P1 | ✅ |
| Expense Approval | Finance | Submit → Manager → Accounting → Paid/Rejected | P1 | ✅ |

**Enterprise States (NEW):**

```typescript
type WorkflowState = 
  | 'pending'      // Chờ action
  | 'waiting'      // Chờ external event
  | 'suspended'    // Admin tạm dừng
  | 'escalated'    // Auto escalate khi timeout
  | 'delegated'    // Ủy quyền cho người khác
  | 'approved'     // End state - success
  | 'rejected'     // End state - failed
  | 'expired'      // Timeout không action
  | 'compensated'  // Rollback đã thực hiện
  | 'cancelled';   // User cancel
```

**Out of Scope (Phase 2+):**
- Parallel approvals (matrix approval)
- External system integration workflows
- Long-running workflows (>30 days)

---

### 1.2 Database Schema

```sql
-- Workflow Definition (template được HQ/Admin tạo)
CREATE TABLE workflow_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  module_key TEXT NOT NULL, -- 'babycare', 'beauty_spa', 'cleaning'
  workflow_key TEXT NOT NULL, -- 'leave_approval', 'salary_approval'
  name TEXT NOT NULL,
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  config JSONB NOT NULL, -- states, transitions, actions
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, module_key, workflow_key, version)
);

-- Workflow Instance (execution thực tế)
CREATE TABLE workflow_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  workflow_definition_id UUID NOT NULL REFERENCES workflow_definitions(id),
  reference_type TEXT NOT NULL, -- 'leave_request', 'salary_record', 'booking'
  reference_id UUID NOT NULL,
  current_state TEXT NOT NULL,
  
  -- NEW: Workflow Variables (context data)
  variables JSONB NOT NULL DEFAULT '{}', -- { salary: 50000000, department: 'Finance' }
  
  -- NEW: Enterprise states
  status TEXT NOT NULL DEFAULT 'running', -- 'running', 'waiting', 'suspended', 'completed', 'cancelled', 'compensated'
  
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  
  -- NEW: Compensation tracking
  compensation_state TEXT, -- track compensation progress
  
  error_message TEXT,
  created_by UUID REFERENCES users(id),
  
  -- NEW: Delegation
  delegated_to UUID REFERENCES users(id),
  delegated_at TIMESTAMPTZ,
  
  UNIQUE(tenant_id, reference_type, reference_id)
);

-- Workflow Transitions (audit log mỗi action)
CREATE TABLE workflow_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_instance_id UUID NOT NULL REFERENCES workflow_instances(id),
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  action TEXT NOT NULL, -- 'approve', 'reject', 'cancel', 'timeout'
  actor_id UUID REFERENCES users(id),
  actor_role TEXT,
  comment TEXT,
  metadata JSONB,
  transitioned_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflow Actions (side effects log)
CREATE TABLE workflow_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_instance_id UUID NOT NULL REFERENCES workflow_instances(id),
  transition_id UUID REFERENCES workflow_transitions(id),
  
  -- CHANGED: Event-driven instead of direct action
  event_type TEXT NOT NULL, -- 'workflow.approved', 'workflow.rejected', 'workflow.compensated'
  event_payload JSONB NOT NULL,
  
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'published', 'failed'
  published_at TIMESTAMPTZ,
  error_message TEXT
);

-- NEW: Workflow Compensation (for rollback)
CREATE TABLE workflow_compensations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_instance_id UUID NOT NULL REFERENCES workflow_instances(id),
  transition_id UUID REFERENCES workflow_transitions(id),
  compensation_action TEXT NOT NULL, -- 'restore_inventory', 'refund_payment'
  compensation_data JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'failed'
  executed_at TIMESTAMPTZ,
  error_message TEXT
);

-- RLS Policies (BAT BUOC theo AGENTS.md)
ALTER TABLE workflow_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON workflow_definitions 
  FOR ALL USING (tenant_id = get_auth_tenant_id());

ALTER TABLE workflow_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON workflow_instances 
  FOR ALL USING (tenant_id = get_auth_tenant_id());

ALTER TABLE workflow_transitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON workflow_transitions FOR ALL 
  USING (workflow_instance_id IN (
    SELECT id FROM workflow_instances WHERE tenant_id = get_auth_tenant_id()
  ));

ALTER TABLE workflow_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON workflow_actions FOR ALL 
  USING (workflow_instance_id IN (
    SELECT id FROM workflow_instances WHERE tenant_id = get_auth_tenant_id()
  ));

-- Indexes for performance
CREATE INDEX idx_workflow_instances_tenant ON workflow_instances(tenant_id, status);
CREATE INDEX idx_workflow_instances_reference ON workflow_instances(reference_type, reference_id);
CREATE INDEX idx_workflow_transitions_instance ON workflow_transitions(workflow_instance_id);
```

---

### 1.3 Workflow Config Format (JSONB)

```typescript
interface WorkflowConfig {
  states: {
    [key: string]: {
      type: 'start' | 'intermediate' | 'end';
      label: string;
      description?: string;
      allowedRoles?: string[]; // ai được action từ state này
      timeout?: number; // seconds
      timeoutAction?: string; // transition key nếu timeout
    };
  };
  transitions: {
    [key: string]: {
      from: string;
      to: string;
      label: string;
      requiresComment?: boolean;
      conditions?: RuleExpression[]; // evaluated by Rule Engine
      actions: WorkflowAction[]; // side effects
      notifications?: NotificationConfig[];
    };
  };
  initialState: string;
}

// Example: Leave Approval Workflow
const leaveApprovalWorkflow: WorkflowConfig = {
  states: {
    pending: { 
      type: 'start', 
      label: 'Chờ duyệt', 
      allowedRoles: ['manager', 'hr'] 
    },
    manager_approved: { 
      type: 'intermediate', 
      label: 'Quản lý đã duyệt', 
      allowedRoles: ['hr'] 
    },
    approved: { type: 'end', label: 'Đã duyệt' },
    rejected: { type: 'end', label: 'Từ chối' }
  },
  transitions: {
    manager_approve: {
      from: 'pending',
      to: 'manager_approved',
      label: 'Quản lý duyệt',
      actions: [
        { 
          type: 'send_notification', 
          config: { recipients: ['hr_team'], template: 'leave_pending_hr' } 
        }
      ]
    },
    hr_approve: {
      from: 'manager_approved',
      to: 'approved',
      label: 'HR duyệt',
      actions: [
        { 
          type: 'update_record', 
          config: { table: 'staff_leaves', field: 'status', value: 'approved' } 
        },
        { 
          type: 'create_attendance_record', 
          config: { leaveType: 'paid' } 
        },
        { 
          type: 'send_notification', 
          config: { recipients: ['requester'], template: 'leave_approved' } 
        }
      ]
    },
    reject: {
      from: 'pending',
      to: 'rejected',
      label: 'Từ chối',
      requiresComment: true,
      actions: [
        { 
          type: 'update_record', 
          config: { table: 'staff_leaves', field: 'status', value: 'rejected' } 
        }
      ]
    }
  },
  initialState: 'pending'
};
```

---

### 1.4 Service Architecture

```
src/services/workflow/
├── core/
│   ├── WorkflowEngine.ts          # Main orchestrator
│   ├── StateManager.ts            # State transitions logic
│   ├── ActionExecutor.ts          # Execute side effects
│   └── ConditionEvaluator.ts      # Evaluate conditions (dùng Rule Engine)
├── actions/
│   ├── UpdateRecordAction.ts
│   ├── SendNotificationAction.ts
│   ├── CreateExpenseAction.ts
│   ├── CreateAttendanceAction.ts
│   └── CallWebhookAction.ts
├── repository/
│   ├── WorkflowDefinitionRepository.ts
│   ├── WorkflowInstanceRepository.ts
│   └── WorkflowAuditRepository.ts
└── WorkflowService.ts             # Public API
```

**Core API:**

```typescript
class WorkflowService {
  // Start workflow instance
  async startWorkflow(
    tenantId: string,
    workflowKey: string,
    referenceType: string,
    referenceId: string,
    initialContext: Record<string, unknown>,
    userId: string
  ): Promise<WorkflowInstance>;

  // Execute transition
  async executeTransition(
    instanceId: string,
    transitionKey: string,
    actorId: string,
    comment?: string,
    metadata?: Record<string, unknown>
  ): Promise<WorkflowInstance>;

  // Cancel workflow
  async cancelWorkflow(
    instanceId: string,
    actorId: string,
    reason: string
  ): Promise<void>;

  // Get workflow status
  async getWorkflowStatus(
    referenceType: string,
    referenceId: string
  ): Promise<WorkflowInstance | null>;

  // Get audit trail
  async getWorkflowHistory(
    instanceId: string
  ): Promise<WorkflowTransition[]>;
}
```

---

### 1.5 Implementation Roadmap - Workflow Engine (UPDATED)

> **BUILD ORDER:** Rule Engine first → Workflow Engine second

#### **Phase 1.1: Foundation (Tuần 5-6)** *(sau khi Rule Engine xong)*
**Mục tiêu:** Basic workflow engine với Rule Engine integration

**Tasks:**
- [ ] Database schema migration (with variables, compensation, delegation)
- [ ] RLS policies & grants
- [ ] Core `WorkflowEngine` service
- [ ] `StateManager` - chỉ move state, KHÔNG evaluate logic
- [ ] **Integration:** Ask Rule Engine before each transition
- [ ] **Pilot:** Leave Request Approval workflow
- [ ] Integration tests với compensation scenarios
- [ ] Admin UI: View workflow status & variables (read-only)

**Deliverables:**
- Leave requests ask Rule Engine before state transition
- Workflow variables tracked in `variables` JSONB
- Compensation mechanism works
- Tests cover rollback + compensation

**Success Metrics:**
- 100% transitions gated by Rule Engine
- Zero logic evaluation in Workflow Engine
- Compensation restores state correctly

---

#### **Phase 1.2: Event-Driven Actions (Tuần 7-8)**
**Mục tiêu:** Publish events instead of direct actions

**Tasks:**
- [ ] Event Bus integration (use existing notification/queue system)
- [ ] `EventPublisher` service
- [ ] Migrate 3 event types:
  - `workflow.state_changed`
  - `workflow.approved`
  - `workflow.rejected`
- [ ] Event Workers (stub implementations):
  - Notification Worker (use existing service)
  - Audit Log Worker
  - Cache Refresh Worker
- [ ] Idempotency guards for event publishing
- [ ] Retry logic for failed events

**Deliverables:**
- Workflows publish events
- Workers consume events
- Failed events retry automatically

---

#### **Phase 1.3: Enterprise States & Delegation (Tuần 9-10)**
**Mục tiêu:** Support enterprise workflow patterns

**Tasks:**
- [ ] Implement 10 enterprise states (waiting, suspended, escalated, delegated, etc.)
- [ ] Timeout mechanism → auto-escalate
- [ ] Delegation feature (ủy quyền)
- [ ] Suspend/Resume workflow
- [ ] **Pilot:** Salary Approval + Booking Confirmation workflows
- [ ] Admin UI: Escalation dashboard

**Deliverables:**
- 3 workflows running with enterprise states
- Timeout auto-escalates
- Admins can delegate approvals

---

#### **Phase 1.4: Visual Workflow Designer (Tuần 11-12)** ⭐ **USP**
**Mục tiêu:** Drag & Drop workflow builder (như Power Automate, n8n, Camunda)

**Tasks:**
- [ ] React Flow / Xyflow integration
- [ ] Visual canvas:
  - Drag states from palette
  - Connect states với arrows
  - Configure state properties (timeout, roles, rules)
  - Configure transition conditions (Rule Engine rules)
- [ ] Save workflow as JSONB config
- [ ] Version management UI
- [ ] Preview mode (test with sample data)
- [ ] Clone workflow template

**Deliverables:**
- Admin creates workflow visually
- No code needed
- Real-time preview

**Success Metrics:**
- Admin creates simple workflow in < 5 minutes
- Complex workflow in < 20 minutes
- User satisfaction score > 4.5/5

---

## 🔧 PHẦN 2: RULE ENGINE (Priority: P0 - Build First)

> **REVIEW NOTE:** Rule Engine mới là phần quan trọng nhất. Workflow chỉ move state. Rule mới quyết định.

### 2.1 Định Nghĩa & Scope (UPDATED)

**Rule Engine là gì?**
- **Decision layer** của Enterprise Intelligence Platform
- Đọc **Business Intelligence data** để ra quyết định
- Declarative rules stored in database
- Versioned, audited, tenant-scoped
- Hot-reload without code deployment

**Kiến trúc mới:**

```
┌──────────────────────────────────┐
│  Business Intelligence Engine    │
│  (Revenue, Cash Flow, KPI, ROI)  │
└──────────────┬───────────────────┘
               ▼
┌──────────────────────────────────┐
│         Rule Engine              │
│  - Read BI Metrics               │
│  - Evaluate Conditions           │
│  - Return Decision               │
└──────────────┬───────────────────┘
               ▼
┌──────────────────────────────────┐
│       Workflow Engine            │
│  - Ask Rule Engine               │
│  - Move State based on Decision  │
└──────────────────────────────────┘
```

**Use Cases MVP (với BI Integration):**

| Rule Type | Example | BI Data Source | Priority |
|-----------|---------|----------------|----------|
| Financial Gate | "IF Cash Flow < 2 months → Reject expense" | `cash_flow_analysis` | P0 |
| Commission | "IF Rating ≥ 4.5 AND Revenue > Target → 20% bonus" | `ktv_performance`, `revenue_breakdown` | P0 |
| Discount | "IF Customer LTV > 50M AND Debt = 0 → 15% discount" | `customer_ltv`, `customer_segmentation` | P0 |
| Auto-Approval | "IF 95% historical approval → Auto-approve" | `approval_history_analysis` | P1 |
| Inventory | "IF Turnover < threshold → Auto-reorder" | `inventory_status`, `inventory_forecast` | P1 |

**Out of Scope (Phase 2+):**
- Machine learning rules (→ AI Intelligence Engine Phase 3)
- External data source rules (weather, stock market)
- Real-time streaming rules (CEP)

---

### 2.2 Database Schema (UPDATED - Add BI Integration)

```sql
-- Rule Definition (with BI data sources)
CREATE TABLE rule_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  module_key TEXT NOT NULL,
  rule_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 100,
  conditions JSONB NOT NULL, -- rule expression tree
  actions JSONB NOT NULL,
  
  -- NEW: BI Integration
  bi_data_sources TEXT[], -- ['cash_flow_analysis', 'customer_ltv']
  cache_ttl INTEGER DEFAULT 300, -- 5 minutes cache cho BI queries
  
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, module_key, rule_key, version)
);

-- Rule Execution Log (with BI snapshot)
CREATE TABLE rule_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  rule_definition_id UUID NOT NULL REFERENCES rule_definitions(id),
  context_type TEXT NOT NULL,
  context_id UUID NOT NULL,
  input_data JSONB NOT NULL,
  
  -- NEW: BI Data Snapshot (for audit)
  bi_data_snapshot JSONB, -- BI metrics tại thời điểm evaluate
  
  output_data JSONB,
  matched BOOLEAN NOT NULL,
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  execution_time_ms INTEGER,
  error_message TEXT
);


-- RLS Policies
ALTER TABLE rule_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON rule_definitions 
  FOR ALL USING (tenant_id = get_auth_tenant_id());

ALTER TABLE rule_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON rule_executions 
  FOR ALL USING (tenant_id = get_auth_tenant_id());

-- Indexes
CREATE INDEX idx_rule_defs_tenant_module ON rule_definitions(tenant_id, module_key) 
  WHERE is_active = true;
CREATE INDEX idx_rule_execs_context ON rule_executions(tenant_id, context_type, context_id);
```

---

### 2.3 Rule Expression Format (UPDATED - với BI Data)

```typescript
// Rule Expression với BI Integration
interface RuleExpression {
  operator: 'and' | 'or' | 'not' | 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains';
  operands: (RuleExpression | string | number | boolean | BIDataReference)[];
}

interface BIDataReference {
  type: 'bi_metric';
  source: string; // 'cash_flow_analysis', 'customer_ltv'
  metric: string; // 'current_balance', 'lifetime_value'
  filters?: Record<string, unknown>;
}

// Example 1: Financial Gate Rule (ĐỌC BI DATA)
const financialGateRule = {
  name: 'Expense Approval Financial Gate',
  bi_data_sources: ['cash_flow_analysis'],
  conditions: {
    operator: 'and',
    operands: [
      { 
        operator: 'gte', 
        operands: [
          { 
            type: 'bi_metric', 
            source: 'cash_flow_analysis', 
            metric: 'months_of_runway' 
          }, 
          2 // >= 2 months cash flow
        ] 
      },
      { operator: 'lte', operands: ['$.expense.amount', 10000000] } // <= 10M
    ]
  },
  actions: [
    { type: 'set_value', config: { field: 'can_approve', value: true } }
  ]
};

// Example 2: KTV Commission Rule (ĐỌC BI + CONTEXT)
const ktvCommissionRule = {
  name: 'High Performer Bonus',
  bi_data_sources: ['ktv_performance', 'revenue_breakdown'],
  conditions: {
    operator: 'and',
    operands: [
      { operator: 'gte', operands: ['$.ktv.rating', 4.5] },
      { 
        operator: 'gt', 
        operands: [
          { 
            type: 'bi_metric', 
            source: 'revenue_breakdown', 
            metric: 'revenue_by_ktv',
            filters: { ktv_id: '$.ktv.id', month: '$.month' }
          },
          { 
            type: 'bi_metric', 
            source: 'revenue_breakdown', 
            metric: 'average_revenue_per_ktv',
            filters: { month: '$.month' }
          }
        ] // revenue > average
      }
    ]
  },
  actions: [
    { 
      type: 'calculate', 
      config: { 
        formula: '$.base_commission * 1.2',
        output: '$.final_commission' 
      }
    }
  ]
};

// Example 3: Auto-Approval Rule (ĐỌC LỊCH SỬ)
const autoApprovalRule = {
  name: 'Historical Auto-Approval',
  bi_data_sources: ['approval_history_analysis'],
  conditions: {
    operator: 'and',
    operands: [
      { 
        operator: 'gte', 
        operands: [
          { 
            type: 'bi_metric', 
            source: 'approval_history_analysis', 
            metric: 'approval_rate',
            filters: { 
              requester_id: '$.requester.id', 
              request_type: '$.type',
              last_n_requests: 20
            }
          },
          0.95 // 95% approval rate
        ] 
      }
    ]
  },
  actions: [
    { type: 'set_value', config: { field: 'auto_approve_eligible', value: true } }
  ]
};
```

---
  actions: [
    { 
      type: 'calculate', 
      config: { 
        formula: '$.base_commission * 1.2', // 20% bonus
        output: '$.final_commission' 
      }
    }
  ]
};

// Example 2: Customer Discount Eligibility
const vipDiscountRule = {
  name: 'VIP Customer Discount',
  conditions: {
    operator: 'and',
    operands: [
      { operator: 'eq', operands: ['$.customer.tier', 'vip'] },
      { operator: 'lte', operands: ['$.customer.debt', 0] },
      { operator: 'gte', operands: ['$.customer.lifetime_value', 50000000] }
    ]
  },
  actions: [
    { 
      type: 'set_value', 
      config: { field: 'discount_percent', value: 15 } 
    }
  ]
};
```

---

### 2.4 Service Architecture (UPDATED - với BI Integration)

```
src/services/rules/
├── core/
│   ├── RuleEngine.ts              # Main evaluator
│   ├── ExpressionEvaluator.ts    # Parse & evaluate conditions
│   ├── BIDataResolver.ts         # NEW: Fetch BI metrics
│   ├── ActionExecutor.ts          # Execute rule actions
│   └── RuleCache.ts               # In-memory cache (5min TTL)
├── operators/
│   ├── LogicalOperators.ts        # and, or, not
│   ├── ComparisonOperators.ts     # eq, gt, lt, gte, lte
│   ├── CollectionOperators.ts     # in, contains
│   └── MathOperators.ts           # add, subtract, multiply, divide
├── functions/
│   ├── lookup.ts                  # Fetch related data
│   ├── calculate.ts               # Math expressions
│   └── bi-metrics/                # NEW: BI metric resolvers
│       ├── cashFlowResolver.ts
│       ├── customerLTVResolver.ts
│       ├── ktvPerformanceResolver.ts
│       └── approvalHistoryResolver.ts
├── repository/
│   ├── RuleDefinitionRepository.ts
│   └── RuleExecutionRepository.ts
└── RuleService.ts                 # Public API
```

**Core API (UPDATED):**

```typescript
class RuleService {
  // Evaluate với BI data
  async evaluateRules(
    tenantId: string,
    moduleKey: string,
    contextType: string,
    contextData: Record<string, unknown>
  ): Promise<RuleResult[]> {
    // 1. Get active rules
    const rules = await this.getRules(tenantId, moduleKey);
    
    // 2. Resolve BI data (cached 5min)
    for (const rule of rules) {
      const biData = await this.resolveBIData(rule.bi_data_sources, contextData);
      contextData._bi = biData; // Inject BI data vào context
    }
    
    // 3. Evaluate rules
    return await this.engine.evaluateAll(rules, contextData);
  }
  
  // NEW: Resolve BI metrics
  async resolveBIData(
    sources: string[],
    context: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const biData = {};
    
    for (const source of sources) {
      const resolver = this.getResolver(source);
      biData[source] = await resolver.resolve(context);
    }
    
    return biData;
  }
}

interface RuleResult {
  ruleId: string;
  matched: boolean;
  output: Record<string, unknown>;
  biDataSnapshot: Record<string, unknown>; // NEW: For audit
  executionTimeMs: number;
  error?: string;
}
```

---

### 2.5 Implementation Roadmap - Rule Engine

#### **Phase 2.1: Foundation (Tuần 1-2)**
**Mục tiêu:** Basic rule engine với 1 use case pilot

**Tasks:**
- [ ] Database schema migration (`rule_definitions`, `rule_executions`)
- [ ] RLS policies & grants
- [ ] Core `RuleEngine` service
- [ ] `ExpressionEvaluator` với basic operators (and, or, eq, gt, lt)
- [ ] **Pilot:** KTV Commission Calculation rules
- [ ] Integration với `recalculateAndSaveSalaryRecord`
- [ ] Unit tests for expression evaluation

**Deliverables:**
- Commission rules evaluated via Rule Engine
- Existing salary calculation still works
- Tests cover expression evaluation

**Success Metrics:**
- 100% commission calculations use rules
- Zero calculation drift vs old logic
- Rule evaluation < 50ms per rule

---

#### **Phase 2.2: Advanced Operators (Tuần 3-4)**
**Mục tiêu:** Support complex conditions

**Tasks:**
- [ ] Collection operators (in, contains, any, all)
- [ ] Math operators (add, subtract, multiply, divide, modulo)
- [ ] String operators (startsWith, endsWith, matches)
- [ ] Date operators (before, after, between, age)
- [ ] Lookup function (fetch related data from DB)
- [ ] **Pilot:** Discount Eligibility rules

**Deliverables:**
- Operators library complete
- Discount rules evaluated
- Performance benchmarks

---

#### **Phase 2.3: Multi-Module Support (Tuần 5-6)**
**Mục tiêu:** Generalize to 3 modules

**Tasks:**
- [ ] Migrate **Attendance Penalty** rules
- [ ] Migrate **Package Pricing** rules
- [ ] Migrate **Inventory Reorder** rules
- [ ] Rule priority & conflict resolution
- [ ] Rule execution audit log UI

**Deliverables:**
- 3 rule types running in production
- Priority system prevents conflicts
- Audit log shows which rules fired

---

#### **Phase 2.4: Tenant Configuration UI (Tuần 7-8)**
**Mục tiêu:** Admin có thể create/edit rules

**Tasks:**
- [ ] Rule Builder UI (visual condition editor)
- [ ] Expression builder với autocomplete
- [ ] Test mode với sample data
- [ ] Version management
- [ ] Clone rule to new tenant/module
- [ ] Rule analytics dashboard (hit rate, performance)

**Deliverables:**
- Admin create rules without code
- Changes versioned & audited
- Analytics show rule effectiveness

---

## 🔗 PHẦN 3: INTEGRATION & MIGRATION

### 3.1 Workflow Engine ↔ Rule Engine Integration

Workflows dùng rules cho transition conditions:

```typescript
// In workflow transition config
{
  from: 'pending',
  to: 'approved',
  label: 'Auto-approve',
  conditions: [
    {
      type: 'rule',
      ruleKey: 'auto_approval_eligibility',
      requiredOutput: { eligible: true }
    }
  ]
}
```

---

### 3.2 Migration Strategy

#### **Step 1: Identify Candidates**
Audit codebase cho hard-coded logic:

```bash
# Tìm approval logic
npm.cmd run grep -- "status.*=.*'approved'" src/services/**/*.ts

# Tìm calculation logic
npm.cmd run grep -- "commission|discount|penalty" src/services/**/*.ts
```

#### **Step 2: Migrate Incrementally**

1. Extract logic sang shared rule module (Phase 0)
2. Keep old logic as fallback
3. Add feature flag: `use_workflow_engine` / `use_rule_engine`
4. Run both parallel, log diffs
5. If diffs < 0.1% for 1 week → switch fully
6. Remove old logic after 2 weeks

**Example:**

```typescript
async function calculateCommission(ktvId: string, month: string) {
  const tenant = await getCurrentTenant();
  const useRuleEngine = tenant.features?.use_rule_engine ?? false;
  
  if (useRuleEngine) {
    // New: Rule Engine
    const result = await ruleService.evaluateRules(
      tenant.id, 
      'hr-salary', 
      'commission', 
      { ktvId, month }
    );
    return result[0]?.output.commission ?? 0;
  } else {
    // Old: Hard-coded
    return await calculateCommissionLegacy(ktvId, month);
  }
}
```

---

### 3.3 Testing Strategy (Theo AGENTS.md)

#### **Unit Tests**

```typescript
describe('RuleEngine', () => {
  it('should evaluate simple condition', async () => {
    const rule = {
      conditions: { operator: 'gt', operands: ['$.sessions', 10] },
      actions: [{ type: 'set_value', config: { field: 'bonus', value: 500000 } }]
    };
    
    const result = await ruleEngine.evaluate(rule, { sessions: 15 });
    expect(result.matched).toBe(true);
    expect(result.output.bonus).toBe(500000);
  });
  
  it('should handle tenant isolation', async () => {
    const tenantA = await createTenant({ name: 'Spa A' });
    const tenantB = await createTenant({ name: 'Spa B' });
    
    await createRule({ tenant_id: tenantA.id, rule_key: 'commission' });
    
    // Tenant B không thấy rule của Tenant A
    const rules = await ruleService.getRules(tenantB.id, 'hr-salary');
    expect(rules).toHaveLength(0);
  });
});
```

#### **Integration Tests**

```typescript
describe('WorkflowEngine + RuleEngine', () => {
  it('should auto-approve booking if VIP', async () => {
    // Setup rule: VIP auto-approve
    await createRule({
      tenant_id: tenantId,
      rule_key: 'vip_auto_approve',
      conditions: { operator: 'eq', operands: ['$.customer.tier', 'vip'] },
      actions: [{ type: 'set_value', config: { field: 'eligible', value: true } }]
    });
    
    // Start workflow
    const instance = await workflowService.startWorkflow(
      tenantId,
      'booking_approval',
      'booking',
      bookingId,
      { customer: { tier: 'vip' } },
      userId
    );
    
    // Execute transition (rule evaluated automatically)
    const result = await workflowService.executeTransition(
      instance.id,
      'auto_approve',
      userId
    );
    
    expect(result.current_state).toBe('confirmed');
  });
  
  it('should rollback if side effect fails (AGENTS.md Rule #2)', async () => {
    // Mock accounting outbox failure
    jest.spyOn(accountingService, 'createOutbox').mockRejectedValue(new Error('DB error'));
    
    const instance = await workflowService.startWorkflow(...);
    
    await expect(
      workflowService.executeTransition(instance.id, 'approve', userId)
    ).rejects.toThrow('DB error');
    
    // Verify rollback occurred
    const freshInstance = await workflowService.getWorkflowStatus('booking', bookingId);
    expect(freshInstance.current_state).toBe('pending'); // not 'approved'
  });
});
```

#### **E2E Tests**

```typescript
test('Salary approval workflow with commission rules', async ({ page }) => {
  // Setup
  const ktv = await createKTV({ sessions: 15, avgRating: 4.8 });
  
  // Navigate
  await page.goto('/dashboard/salary');
  await page.click(`[data-testid="approve-${ktv.salaryRecordId}"]`);
  
  // Verify commission calculated by rules
  const commission = await page.textContent(`[data-testid="commission"]`);
  expect(commission).toBe('750,000'); // 50k base + 20% bonus
  
  // Approve
  await page.click('[data-testid="confirm-approve"]');
  
  // Verify audit trail
  const audit = await page.textContent('[data-testid="workflow-history"]');
  expect(audit).toContain('Quản lý đã duyệt');
  expect(audit).toContain('Rule: high_rating_bonus matched');
});
```

---

## 🛡️ PHẦN 4: SECURITY & COMPLIANCE (Theo AGENTS.md)

### 4.1 Tenant Isolation (BẮT BUỘC)

```typescript
// ✅ ĐÚNG: Tenant-scoped workflow start
async function startLeaveApproval(leaveRequestId: string, userId: string) {
  const tenant = await getCurrentTenant(userId);
  if (!tenant) throw new Error('No tenant context');
  
  return await workflowService.startWorkflow(
    tenant.id, // BẮT BUỘC
    'leave_approval',
    'leave_request',
    leaveRequestId,
    { leaveRequestId },
    userId
  );
}

// ❌ SAI: Thiếu tenant filter
async function startLeaveApproval(leaveRequestId: string, userId: string) {
  return await workflowService.startWorkflow(
    null, // ❌ NGUY HIỂM
    'leave_approval',
    'leave_request',
    leaveRequestId,
    { leaveRequestId },
    userId
  );
}
```

### 4.2 Module Isolation

```typescript
// Beauty Spa: Commission per session
await createRule({
  tenant_id: beautySpaId,
  module_key: 'beauty_spa', // BẮT BUỘC
  rule_key: 'session_commission',
  conditions: { operator: 'gte', operands: ['$.sessions', 1] },
  actions: [{ type: 'calculate', config: { formula: '$.sessions * 100000' } }]
});

// Baby Care: Commission theo gói
await createRule({
  tenant_id: babyCareId,
  module_key: 'babycare', // KHÁC module
  rule_key: 'session_commission',
  conditions: { operator: 'gte', operands: ['$.sessions', 1] },
  actions: [{ type: 'calculate', config: { formula: '$.sessions * 50000' } }]
});
```

---

### 4.3 Side Effect Safety (AGENTS.md Rule #2)

**BẮT BUỘC kiểm tra side effects trong tests:**

```typescript
it('should create attendance record when leave approved', async () => {
  const leave = await createLeaveRequest({ ktv_id: ktvId, date: '2026-06-25' });
  
  // Approve via workflow
  const instance = await workflowService.startWorkflow(...);
  await workflowService.executeTransition(instance.id, 'approve', managerId);
  
  // ✅ ASSERT side effect occurred
  const attendance = await supabase
    .from('attendance')
    .select('*')
    .eq('ktv_id', ktvId)
    .eq('date', '2026-06-25')
    .single();
  
  expect(attendance.data).toBeDefined();
  expect(attendance.data.status).toBe('paid_leave');
});

it('should rollback if attendance creation fails', async () => {
  // Mock failure
  jest.spyOn(attendanceService, 'create').mockRejectedValue(new Error('DB error'));
  
  const leave = await createLeaveRequest({ ktv_id: ktvId });
  const instance = await workflowService.startWorkflow(...);
  
  await expect(
    workflowService.executeTransition(instance.id, 'approve', managerId)
  ).rejects.toThrow();
  
  // ✅ VERIFY rollback: leave still pending
  const freshLeave = await getLeaveRequest(leave.id);
  expect(freshLeave.status).toBe('pending'); // NOT 'approved'
  
  // ✅ VERIFY side effect NOT created
  const attendance = await supabase
    .from('attendance')
    .select('*')
    .eq('ktv_id', ktvId)
    .eq('date', leave.date);
  expect(attendance.data).toHaveLength(0);
});
```

---

### 4.4 Accounting Outbox (AGENTS.md Rule #7)

**BẮT BUỘC dùng accounting outbox, không ghi thẳng vào journal:**

```typescript
// ✅ ĐÚNG: Dùng accounting outbox
async function executeCreateExpenseAction(action: WorkflowAction) {
  const { amount, category, description } = action.config;
  
  // Push to outbox, worker sẽ xử lý
  await accountingOutboxService.create({
    tenant_id: action.tenant_id,
    event_type: 'salary_expense',
    reference_type: 'salary_record',
    reference_id: action.reference_id,
    amount,
    category,
    description,
    idempotency_key: `workflow_action_${action.id}` // AGENTS.md Rule #6
  });
}

// ❌ SAI: Ghi thẳng vào journal
async function executeCreateExpenseAction(action: WorkflowAction) {
  await supabase.from('journal_entries').insert({ ... }); // ❌ NGUY HIỂM
}
```

---

### 4.5 Idempotency (AGENTS.md Rule #6)

```typescript
class ActionExecutor {
  async execute(action: WorkflowAction): Promise<void> {
    // Check if already executed
    const existing = await supabase
      .from('workflow_actions')
      .select('*')
      .eq('id', action.id)
      .eq('status', 'completed')
      .single();
    
    if (existing.data) {
      console.log(`[ActionExecutor] Action ${action.id} already executed, skipping`);
      return;
    }
    
    // Execute action
    try {
      await this.executeActionType(action);
      
      // Mark completed
      await supabase
        .from('workflow_actions')
        .update({ status: 'completed', executed_at: new Date() })
        .eq('id', action.id);
    } catch (error) {
      // Mark failed but DON'T swallow error (AGENTS.md Rule #1)
      await supabase
        .from('workflow_actions')
        .update({ status: 'failed', error_message: error.message })
        .eq('id', action.id);
      
      throw error; // Re-throw để trigger rollback
    }
  }
}
```

---

## 📊 PHẦN 5: TIMELINE & RESOURCES

### 5.1 Timeline Overview (12 tuần)

```
Week 1-2:  Workflow Engine Foundation + Leave Approval Pilot
Week 3-4:  Workflow Actions & Notifications
Week 5-6:  Multi-Workflow Support (Salary, Booking)
Week 7-8:  Workflow Designer UI

Week 1-2:  Rule Engine Foundation + Commission Pilot (parallel)
Week 3-4:  Advanced Operators & Discount Rules (parallel)
Week 5-6:  Multi-Module Rules (parallel)
Week 7-8:  Rule Builder UI (parallel)

Week 9-10: Integration Testing & Migration (cả 2 engines)
Week 11:   E2E Testing & Performance Optimization
Week 12:   Documentation, Training, Go-Live Prep
```

### 5.2 Team Resources

**Backend Developers (2):**
- Dev 1: Workflow Engine lead
- Dev 2: Rule Engine lead
- Collaboration: Integration points, shared utilities

**Frontend Developer (1):**
- Workflow Designer UI
- Rule Builder UI
- Admin dashboards

**QA Engineer (1):**
- Integration tests
- E2E tests
- Regression testing (Bella Spa, Beauty Spa, Baby Care)

**Optional:**
- DevOps: Database migration planning
- Tech Writer: User documentation

---

### 5.3 Dependencies & Risks

**Dependencies:**
- ✅ Accounting outbox service (đã có)
- ✅ Notification service (đã có)
- ✅ Tenant context utilities (đã có)
- ⚠️ Shared business rule engines (cần refactor - xem `docs/implementation-artifacts/spec-refactor-shared-business-rule-engines.md`)

**Risks:**

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Migration breaks existing flows | Medium | High | Feature flags, parallel run, extensive testing |
| Performance degradation | Low | Medium | Caching, indexing, benchmarks before/after |
| Admin UI too complex | Medium | Medium | User testing, iterative design |
| Tenant data leakage | Low | Critical | RLS policies, automated isolation tests |
| Rollback logic bugs | Medium | High | Comprehensive side-effect testing |

---

## ✅ PHẦN 6: DEFINITION OF DONE

### 6.1 Workflow Engine Done When:

- [ ] 3 workflows running in production (Leave, Salary, Booking)
- [ ] All transitions logged in `workflow_transitions`
- [ ] Side effects execute atomically or rollback on failure
- [ ] Timeout mechanism works for stuck workflows
- [ ] Admin UI can view workflow status & history
- [ ] Admin UI can customize workflows (states, transitions, actions)
- [ ] RLS policies prevent tenant data leakage
- [ ] Integration tests cover happy path + rollback scenarios
- [ ] E2E tests verify UI workflow execution
- [ ] Documentation: API reference, Admin guide
- [ ] Performance: < 200ms per transition execution

### 6.2 Rule Engine Done When:

- [ ] 5 rule types running in production (Commission, Discount, Eligibility, Penalty, Pricing)
- [ ] All evaluations logged in `rule_executions`
- [ ] Operators library complete (logical, comparison, collection, math, date)
- [ ] Admin UI can create/edit rules visually
- [ ] Test mode allows rule preview with sample data
- [ ] Version history tracks rule changes
- [ ] Priority system resolves conflicts
- [ ] RLS policies prevent tenant data leakage
- [ ] Integration tests cover expression evaluation
- [ ] E2E tests verify rule-driven calculations
- [ ] Documentation: Rule language reference, Examples
- [ ] Performance: < 50ms per rule evaluation

### 6.3 Integration Done When:

- [ ] Workflow transitions can use rule conditions
- [ ] Feature flags allow gradual migration
- [ ] Parallel run shows < 0.1% diff vs old logic
- [ ] Old hard-coded logic removed after 2 weeks stable
- [ ] Regression tests prove Bella Spa, Beauty Spa, Baby Care unaffected
- [ ] Static analysis gates pass (Semgrep, Trivy, Gitleaks)
- [ ] `npm run test:critical` passes
- [ ] `npm run build` passes

---

## 📚 PHẦN 7: REFERENCES & RELATED DOCS

### Related Bella ERP Documentation:

- `AGENTS.md` - Quy tắc bắt buộc về database, side effects, accounting, tenant isolation
- `docs/INDUSTRY_MODULE_DEVELOPMENT_PLAYBOOK.md` - Quy trình phát triển module ngành mới
- `docs/implementation-artifacts/spec-refactor-shared-business-rule-engines.md` - Business rule refactoring spec
- `docs/implementation-artifacts/spec-harden-approve-salary-audit-rollback.md` - Salary approval rollback pattern
- `docs/implementation-artifacts/spec-harden-leave-reassignment-rollback.md` - Leave approval rollback pattern

### External References:

- **Workflow Patterns:** [workflowpatterns.com](http://www.workflowpatterns.com/)
- **JSON Logic:** [jsonlogic.com](https://jsonlogic.com/) (inspiration for rule expression format)
- **Business Rules Patterns:** Martin Fowler's "Implementing Business Rules" patterns
- **State Machine Design:** UML State Machine specification

### Similar Open Source Projects (for inspiration):

- **Temporal.io** - Durable workflow engine
- **Camunda** - BPMN workflow engine
- **Drools** - Business rule engine (Java)
- **json-rules-engine** - JavaScript rule engine

---

## 🎓 PHẦN 8: TRAINING & DOCUMENTATION

### 8.1 Developer Training (Week 12)

**Topics:**
1. Workflow Engine architecture & API
2. Rule Engine expression language
3. Creating custom actions & operators
4. Testing workflows & rules
5. Performance optimization
6. Debugging failed workflows

**Format:** 2-hour workshop + hands-on coding session

---

### 8.2 Admin User Training (Week 12)

**Topics:**
1. Viewing workflow status & history
2. Creating simple workflows (visual designer)
3. Creating business rules (rule builder)
4. Testing rules before activation
5. Troubleshooting stuck workflows

**Format:** 1-hour demo + Q&A session

---

### 8.3 Documentation Deliverables

- [ ] **API Reference:** Workflow & Rule services public APIs
- [ ] **Admin Guide:** How to create/edit workflows & rules
- [ ] **Developer Guide:** How to integrate workflows into new features
- [ ] **Rule Language Reference:** Complete operator & function docs
- [ ] **Migration Guide:** How to convert hard-coded logic to rules
- [ ] **Troubleshooting Guide:** Common issues & solutions

---

## 🚀 PHẦN 9: GO-LIVE CHECKLIST

### Pre-Launch (Week 11)

- [ ] All tests passing (unit, integration, E2E)
- [ ] Performance benchmarks meet targets
- [ ] Security audit completed (RLS, tenant isolation)
- [ ] Database migrations tested on staging
- [ ] Rollback plan documented
- [ ] Monitoring dashboards configured
- [ ] Alert rules configured (failed workflows, slow rules)
- [ ] Documentation completed
- [ ] Training completed

### Launch Day (Week 12)

- [ ] Deploy database migrations
- [ ] Deploy backend services
- [ ] Deploy frontend UI
- [ ] Enable feature flags for 10% traffic
- [ ] Monitor error rates, latency
- [ ] Verify tenant isolation (manual spot check)
- [ ] Increase to 50% traffic if stable (Day 2)
- [ ] Increase to 100% traffic if stable (Day 3)

### Post-Launch (Week 13+)

- [ ] Monitor for 1 week
- [ ] Collect admin feedback
- [ ] Remove old hard-coded logic
- [ ] Update INDUSTRY_MODULE_DEVELOPMENT_PLAYBOOK.md
- [ ] Archive this plan to `docs/archive/`
- [ ] Celebrate! 🎉

---

## 📞 CONTACTS & APPROVALS

**Plan Owner:** [Your Name]  
**Tech Lead Approval:** [ ] Approved [ ] Needs Revision  
**Product Owner Approval:** [ ] Approved [ ] Needs Revision  
**CTO Approval:** [ ] Approved [ ] Needs Revision  

**Questions/Feedback:**  
- Slack: #bella-erp-engineering
- Email: engineering@bella-erp.com

---

**Document Version:** 1.0  
**Last Updated:** 2026-06-22  
**Next Review:** After Phase 1 completion (Week 2)

---

END OF DOCUMENT


---

## 🌟 PHẦN 10: TECHNICAL REVIEW NOTES & IMPROVEMENTS

### 10.1 Điểm Mạnh Của Kế Hoạch Ban Đầu ⭐⭐⭐⭐⭐

1. **Tách Workflow và Rule thành Engine độc lập** - Đúng tư duy Platform
2. **Workflow Definition + Instance pattern** - Chuẩn Enterprise (Camunda, Temporal, Flowable)
3. **Version Management** - Workflow đang chạy không bị crash khi admin sửa config
4. **Audit Trail** - CEO biết "Ai duyệt? Lúc nào?"
5. **Tenant Isolation với RLS** - Bảo mật đúng chuẩn
6. **JSON Config** - Không hard-code, flexible

### 10.2 Improvements After Technical Review

#### **A. Workflow KHÔNG nên evaluate Rule**

**Before (❌):**
```
Workflow → Expression Parser → Eval Condition
```

**After (✅):**
```
Workflow → Ask Rule Engine → Get Decision → Move State
```

**Lý do:** Hai engines bị dính nhau nếu Workflow tự evaluate.

---

#### **B. Workflow Action → Business Event**

**Before (❌):**
```
Workflow → Execute Actions Directly
  ├─ Send Notification
  ├─ Update Record  
  └─ Create Expense
```

**After (✅):**
```
Workflow → Publish Event → Event Bus → Workers
  ├─ Notification Worker
  ├─ Webhook Worker
  ├─ AI Worker
  ├─ Cache Worker
  └─ BI Refresh Worker
```

**Lý do:** Event-Driven Architecture = Loose Coupling + Scalability.

---

#### **C. Visual Workflow Designer là USP**

**Before:** JSON config (technical)  
**After:** Drag & Drop visual builder (business user-friendly)

**USP (Unique Selling Point):**
- Giống Power Automate, n8n, Camunda
- Admin tạo workflow < 5 phút
- **Đây là thứ khách hàng thấy ngay giá trị**

---

#### **D. Enterprise Workflow States**

**Before:**
```
Pending → Approved → Rejected
```

**After:**
```
Pending → Waiting → Suspended → Escalated → 
Delegated → Expired → Rollback → Compensated → 
Paused → Approved → Rejected
```

**Lý do:** Enterprise cần states phức tạp hơn SME workflows.

---

#### **E. Workflow Variables (Context)**

**Before:** Implicit context  
**After:** Explicit variables schema

```typescript
variables_schema: {
  salary: { type: 'number', required: true },
  department: { type: 'string', required: true },
  leave_days: { type: 'number', required: true }
}
```

**Lý do:** Rule Engine cần đọc context để quyết định.

---

#### **F. Compensation (Rollback)**

**Before:** Simple rollback  
**After:** Compensation actions per state

```typescript
compensation: {
  approved: [
    { type: 'restore_inventory', config: {...} },
    { type: 'refund_payment', config: {...} }
  ]
}
```

**Lý do:** Enterprise transactions cần compensate phức tạp.

---

#### **G. Rule Engine + Business Intelligence Integration** ⭐⭐⭐⭐⭐

**ĐÂY LÀ ĐIỂM KHÁC BIỆT LỚN NHẤT:**

Bella đã có **Business Intelligence Engine** (Revenue, Cash Flow, KPI, ROI).  
Rule Engine có thể đọc BI data để quyết định!

**Example:**
```typescript
// Rule: Reject expense if cash flow < 2 months
{
  conditions: {
    operator: 'lt',
    operands: [
      { 
        type: 'bi_metric', 
        source: 'cash_flow_analysis', 
        metric: 'months_of_runway' 
      },
      2
    ]
  },
  actions: [
    { type: 'set_value', config: { field: 'can_approve', value: false } }
  ]
}
```

**Đây là thứ ERP SME gần như KHÔNG làm được.**

---

### 10.3 Tầm Nhìn 5-Engine Architecture

```
Business Intelligence Engine (ĐÃ CÓ)
    ├─ Revenue, Cash Flow, KPI, ROI
    │
    ▼
Rule Engine (Decision) ◄─── PHASE 1
    ├─ IF Cash Flow < 2 months → Reject
    │
    ▼
Workflow Engine (Process) ◄─── PHASE 1
    ├─ Move State, Orchestrate
    │
    ▼
Event Engine (Integration) ◄─── PHASE 2
    ├─ Publish Events → Workers
    │
    ▼
AI Intelligence Engine ◄─── PHASE 3
    └─ Predictive, Recommendations
```

**USP Final:**
> Bella không chỉ là ERP. Bella là **Enterprise Intelligence Platform** - quyết định thông minh dựa trên dữ liệu thực tế của doanh nghiệp.

---

### 10.4 Build Order (UPDATED)

**KHÔNG build theo thứ tự cũ (Workflow trước, Rule sau).**

**Build theo thứ tự mới:**

1. **Tuần 1-4: Rule Engine Foundation + BI Integration** (P0)
2. **Tuần 5-8: Workflow Engine + Rule Integration** (P0)
3. **Tuần 9-10: Enterprise States + Delegation** (P1)
4. **Tuần 11-12: Visual Designer** (P0 - USP!)

**Lý do:** Rule Engine là decision layer, build trước. Workflow chỉ orchestrate.

---

## 📝 CHANGE LOG

**v1.0** (2026-06-22)
- Initial plan: Workflow + Rule engines
- 12 tuần timeline
- Basic MVP scope

**v1.1** (2026-06-22) ⭐ **After Technical Review**
- **MAJOR:** Decoupled Workflow & Rule (Workflow asks, not evaluates)
- **MAJOR:** Event-Driven Architecture (publish events, not direct actions)
- **MAJOR:** BI Integration for Rule Engine (data-driven decisions)
- **NEW:** Enterprise workflow states (10 states)
- **NEW:** Workflow variables schema
- **NEW:** Compensation mechanism
- **NEW:** Visual Workflow Designer (USP)
- **NEW:** 5-Engine Architecture vision
- **CHANGED:** Build order (Rule first, Workflow second)
- **EXPANDED:** Timeline to support Phase 2 & 3 planning

---

**Next Review:** After Phase 1 Week 2 (Rule Engine Foundation complete)

---

END OF DOCUMENT (v1.1)
