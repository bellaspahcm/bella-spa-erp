# Rule Management UI - Architecture Design

**Version**: 1.0.0  
**Status**: 🚧 **Phase 2 - In Progress**  
**Last Updated**: 2026-07-09  
**Duration**: 7-10 days  
**Business Value**: ⭐⭐⭐⭐⭐ Very High

---

## Executive Summary

Rule Management UI là self-service platform cho phép business users (non-technical) tạo, edit, test, và deploy workflow rules **without writing code**.

### Key Goals
1. ✅ **Visual Rule Builder** - If-then-else logic editor
2. ✅ **Workflow Designer** - Drag-and-drop workflow steps
3. ✅ **Decision Simulator** - Test rules with sample data
4. ✅ **Admin Dashboard** - Monitor workflow performance

### Target Users
- 👤 **Business Analysts** - Create and test rules
- 👤 **Managers** - Approve rule changes
- 👤 **Operations** - Monitor workflow performance
- 👤 **Admins** - Manage workflows and versions

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                Rule Management UI (Frontend)                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Visual Rule Builder                                  │  │
│  │  - If-Then-Else Editor                                │  │
│  │  - Condition Builder (field, operator, value)        │  │
│  │  - Action Builder (approve, reject, calculate)       │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Workflow Designer                                    │  │
│  │  - Drag-and-drop canvas (react-flow)                 │  │
│  │  - Step palette (Decision, Action, Condition, etc.)  │  │
│  │  - Connection editor (step transitions)              │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Decision Simulator                                   │  │
│  │  - Sample data input                                  │  │
│  │  - Dry-run execution                                  │  │
│  │  - Result visualization                               │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Admin Dashboard                                      │  │
│  │  - Workflow list & status                             │  │
│  │  - Performance metrics                                │  │
│  │  - Execution history                                  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                         │
                         ↓ API calls
┌─────────────────────────────────────────────────────────────┐
│                Backend API (Next.js API Routes)              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  POST /api/rules/create                               │  │
│  │  PUT  /api/rules/:id                                  │  │
│  │  GET  /api/rules                                      │  │
│  │  POST /api/rules/:id/simulate                         │  │
│  │  POST /api/rules/:id/publish                          │  │
│  │  GET  /api/workflows                                  │  │
│  │  POST /api/workflows/create                           │  │
│  │  PUT  /api/workflows/:id                              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                         │
                         ↓ Persists to
┌─────────────────────────────────────────────────────────────┐
│                Database (Supabase PostgreSQL)                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  workflow_definitions table                           │  │
│  │  workflow_rules table                                 │  │
│  │  workflow_versions table                              │  │
│  │  rule_simulations table (test history)               │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                         │
                         ↓ Executes via
┌─────────────────────────────────────────────────────────────┐
│                Workflow Engine (Production)                  │
│  - Loads rules from database                                │
│  - Executes workflows with user-defined rules               │
│  - Publishes metrics back to admin dashboard                │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Database Schema

### Table: `workflow_definitions`
```sql
CREATE TABLE workflow_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  
  -- Workflow metadata
  workflow_id TEXT NOT NULL UNIQUE,  -- e.g., 'booking-to-fulfillment-v1'
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,  -- 'booking', 'payroll', 'inventory', etc.
  
  -- Workflow configuration (JSONB)
  config JSONB NOT NULL DEFAULT '{}'::jsonb,  -- Steps, transitions, settings
  
  -- Version tracking
  version TEXT NOT NULL DEFAULT '1.0.0',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'testing', 'published', 'archived')),
  
  -- Metadata
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflow_definitions_tenant ON workflow_definitions(tenant_id);
CREATE INDEX idx_workflow_definitions_status ON workflow_definitions(status);
CREATE INDEX idx_workflow_definitions_category ON workflow_definitions(category);
```

### Table: `workflow_rules`
```sql
CREATE TABLE workflow_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  workflow_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  
  -- Rule identification
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL,  -- 'condition', 'action', 'decision'
  
  -- Rule definition (JSONB)
  rule_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Execution settings
  priority INTEGER NOT NULL DEFAULT 100,
  enabled BOOLEAN NOT NULL DEFAULT true,
  
  -- Metadata
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(workflow_id, rule_name)
);

CREATE INDEX idx_workflow_rules_workflow ON workflow_rules(workflow_id);
CREATE INDEX idx_workflow_rules_enabled ON workflow_rules(enabled);
```

### Table: `workflow_versions`
```sql
CREATE TABLE workflow_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  workflow_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  
  -- Version metadata
  version TEXT NOT NULL,
  snapshot JSONB NOT NULL,  -- Full workflow config snapshot
  changelog TEXT,
  
  -- Who and when
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(workflow_id, version)
);

CREATE INDEX idx_workflow_versions_workflow ON workflow_versions(workflow_id);
```

### Table: `rule_simulations`
```sql
CREATE TABLE rule_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  workflow_id UUID NOT NULL REFERENCES workflow_definitions(id),
  rule_id UUID REFERENCES workflow_rules(id),
  
  -- Simulation input/output
  input_data JSONB NOT NULL,
  output_data JSONB,
  
  -- Result
  success BOOLEAN NOT NULL,
  error_message TEXT,
  execution_time_ms INTEGER,
  
  -- Who and when
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rule_simulations_workflow ON rule_simulations(workflow_id);
CREATE INDEX idx_rule_simulations_created_at ON rule_simulations(created_at DESC);
```

---

## 3. Component Architecture

### 3.1. Visual Rule Builder

**Technology**: React + Shadcn UI + React Hook Form + Zod

**Components**:
```
RuleBuilder/
├── RuleBuilderCanvas.tsx       # Main canvas
├── ConditionBuilder.tsx         # If-then-else editor
├── ActionBuilder.tsx            # Action configuration
├── FieldSelector.tsx            # Select field from context
├── OperatorSelector.tsx         # Operators (===, >, <, contains, etc.)
├── ValueInput.tsx               # Value input (text, number, date, etc.)
└── RulePreview.tsx              # JSON/YAML preview
```

**Features**:
- ✅ Add/remove conditions (AND/OR logic)
- ✅ Nested conditions (groups)
- ✅ Field autocomplete from schema
- ✅ Operator validation per field type
- ✅ Value validation
- ✅ Real-time JSON preview
- ✅ Save as template

---

### 3.2. Workflow Designer

**Technology**: React Flow + Shadcn UI

**Components**:
```
WorkflowDesigner/
├── DesignerCanvas.tsx           # React Flow canvas
├── StepPalette.tsx              # Draggable step types
├── StepNode.tsx                 # Individual step node
├── ConnectionEdge.tsx           # Custom edge styling
├── StepConfigPanel.tsx          # Side panel for step config
└── WorkflowToolbar.tsx          # Zoom, save, undo/redo
```

**Step Types** (draggable from palette):
- 🔵 **DecisionStep** - Call Decision Engine
- 🟢 **ActionStep** - Execute business logic
- 🟡 **ConditionStep** - If-then-else branching
- 🟣 **ParallelStep** - Parallel execution
- ⚪ **StartNode** - Workflow start
- ⚫ **EndNode** - Workflow end

**Features**:
- ✅ Drag-and-drop from palette
- ✅ Connect steps with edges
- ✅ Configure step on click
- ✅ Validate workflow (no orphan nodes, circular refs)
- ✅ Auto-layout (optional)
- ✅ Export to JSON
- ✅ Import from JSON

---

### 3.3. Decision Simulator

**Technology**: React + Shadcn UI + Monaco Editor

**Components**:
```
Simulator/
├── SimulatorPanel.tsx           # Main panel
├── InputEditor.tsx              # JSON input editor (Monaco)
├── ExecuteButton.tsx            # Run simulation button
├── ResultViewer.tsx             # Visualize execution result
├── StepTraceViewer.tsx          # Step-by-step execution trace
└── HistoryPanel.tsx             # Previous simulations
```

**Features**:
- ✅ JSON input editor with syntax highlighting
- ✅ Sample data templates
- ✅ Dry-run execution (doesn't affect production)
- ✅ Step-by-step trace
- ✅ Highlight which rules fired
- ✅ Show execution time
- ✅ Save simulation to history
- ✅ Compare simulations

---

### 3.4. Admin Dashboard

**Technology**: React + Shadcn UI + Recharts

**Components**:
```
Dashboard/
├── WorkflowList.tsx             # List all workflows
├── WorkflowCard.tsx             # Individual workflow card
├── PerformanceMetrics.tsx       # Execution time, success rate
├── ExecutionHistory.tsx         # Recent executions table
├── WorkflowStatusBadge.tsx      # Draft/Testing/Published badge
└── QuickActions.tsx             # Create, Edit, Delete, Publish
```

**Metrics**:
- 📊 Total executions (last 24h, 7d, 30d)
- 📊 Success rate
- 📊 Average execution time
- 📊 Most used workflows
- 📊 Failed workflows (alerts)

---

## 4. API Endpoints

### 4.1. Workflow Management APIs

```typescript
// Create workflow
POST /api/workflows/create
Body: {
  name: string;
  description: string;
  category: string;
  config: WorkflowConfig;
}
Response: { workflowId: string }

// Update workflow
PUT /api/workflows/:id
Body: {
  name?: string;
  config?: WorkflowConfig;
}

// Get workflow
GET /api/workflows/:id
Response: WorkflowDefinition

// List workflows
GET /api/workflows?category=booking&status=published
Response: WorkflowDefinition[]

// Publish workflow
POST /api/workflows/:id/publish
Body: { changelog?: string }
Response: { version: string, publishedAt: string }

// Archive workflow
DELETE /api/workflows/:id
Response: { success: boolean }
```

### 4.2. Rule Management APIs

```typescript
// Create rule
POST /api/rules/create
Body: {
  workflowId: string;
  ruleName: string;
  ruleType: string;
  ruleConfig: RuleConfig;
}

// Update rule
PUT /api/rules/:id
Body: {
  ruleConfig: RuleConfig;
  priority?: number;
  enabled?: boolean;
}

// Get rules for workflow
GET /api/rules?workflowId=xxx
Response: WorkflowRule[]

// Delete rule
DELETE /api/rules/:id
```

### 4.3. Simulation APIs

```typescript
// Run simulation
POST /api/rules/:id/simulate
Body: {
  inputData: Record<string, unknown>;
}
Response: {
  success: boolean;
  outputData: Record<string, unknown>;
  executionTime: number;
  trace: StepTrace[];
}

// Get simulation history
GET /api/simulations?workflowId=xxx&limit=10
Response: RuleSimulation[]
```

---

## 5. UI/UX Design Principles

### 5.1. Design System
- **Framework**: Shadcn UI (already in project)
- **Icons**: Lucide React
- **Charts**: Recharts
- **Editor**: Monaco Editor (for JSON/code)
- **Drag-Drop**: React Flow

### 5.2. Color Coding
- 🔵 **Blue** - Decision steps
- 🟢 **Green** - Action steps
- 🟡 **Yellow** - Condition steps
- 🟣 **Purple** - Parallel steps
- 🔴 **Red** - Error/failed
- ⚪ **Gray** - Disabled

### 5.3. User Workflows

**Workflow 1: Create New Workflow** (Business Analyst)
1. Click "Create Workflow"
2. Enter name, description, category
3. Drag steps from palette to canvas
4. Connect steps
5. Configure each step
6. Validate workflow
7. Save as draft

**Workflow 2: Test Workflow** (Business Analyst)
1. Open workflow in simulator
2. Enter sample input data
3. Click "Run Simulation"
4. View step-by-step execution
5. Verify output is correct
6. Save simulation to history

**Workflow 3: Publish Workflow** (Manager)
1. Review workflow in designer
2. Check simulation results
3. Add changelog
4. Click "Publish"
5. Confirm version number
6. Workflow goes live

**Workflow 4: Monitor Performance** (Operations)
1. Open admin dashboard
2. View metrics (executions, success rate, time)
3. Check failed executions
4. Drill down to error details
5. Fix issues or rollback version

---

## 6. Implementation Plan

### Week 1: Foundation + Visual Rule Builder

**Day 1-2**: Database schema + API foundation
- Create tables (workflow_definitions, workflow_rules, etc.)
- Implement basic CRUD APIs
- Set up RLS policies

**Day 3-5**: Visual Rule Builder
- Build ConditionBuilder component
- Build ActionBuilder component
- Build RulePreview component
- Integrate with API

### Week 2: Workflow Designer + Simulator + Dashboard

**Day 6-8**: Workflow Designer
- Set up React Flow canvas
- Build step palette
- Implement drag-and-drop
- Build step configuration panel

**Day 9-10**: Decision Simulator
- Build input editor (Monaco)
- Implement dry-run API
- Build result viewer
- Build execution trace

**Day 11-12**: Admin Dashboard
- Build workflow list
- Build metrics cards
- Build execution history table
- Integrate all APIs

### Week 3 (Buffer): Testing + Polish + Documentation

**Day 13-14**: Integration testing
- Test all workflows end-to-end
- Test simulator with real data
- Fix bugs

**Day 15**: Documentation + Training
- User guide for business analysts
- Video tutorials
- Admin guide

---

## 7. Success Criteria

### Functional Requirements
- [ ] Can create workflow without writing code
- [ ] Can edit existing workflow
- [ ] Can test workflow with sample data
- [ ] Can publish workflow to production
- [ ] Can monitor workflow performance
- [ ] Can rollback to previous version

### Non-Functional Requirements
- [ ] UI responsive (desktop + tablet)
- [ ] Load time < 2s for workflow list
- [ ] Simulation execution < 1s
- [ ] Support 100+ workflows per tenant
- [ ] Undo/redo support in designer
- [ ] Auto-save every 30s

### User Acceptance
- [ ] Business analyst can create workflow in < 30 min
- [ ] Manager can review and publish in < 10 min
- [ ] Operations can monitor metrics in < 5 min

---

## 8. Risks & Mitigations

### Risk 1: Complexity for Non-Technical Users
**Mitigation**:
- Start with templates
- Provide step-by-step wizard
- In-app tutorials
- Contextual help

### Risk 2: Performance with Large Workflows
**Mitigation**:
- Lazy load steps
- Virtualize long lists
- Optimize React Flow rendering
- Cache workflow configs

### Risk 3: Version Conflicts
**Mitigation**:
- Optimistic locking
- Show "last edited by" timestamp
- Prevent concurrent edits
- Version history rollback

---

## 9. Future Enhancements (Post-MVP)

### Phase 3 (Future)
- [ ] Workflow templates marketplace
- [ ] AI-powered workflow suggestions
- [ ] Collaborative editing (real-time)
- [ ] Custom step types (plugins)
- [ ] Import from BPMN
- [ ] Export to code
- [ ] A/B testing workflows
- [ ] Workflow performance optimization suggestions

---

## 10. Tech Stack Summary

| Layer | Technology | Purpose |
|-------|------------|---------|
| UI Framework | React 18 + Next.js | Component library |
| UI Components | Shadcn UI | Design system |
| State Management | Zustand | Client state |
| Form Handling | React Hook Form + Zod | Forms + validation |
| Workflow Canvas | React Flow | Drag-and-drop designer |
| Code Editor | Monaco Editor | JSON/YAML editing |
| Charts | Recharts | Metrics visualization |
| Icons | Lucide React | Icon library |
| Database | Supabase PostgreSQL | Data persistence |
| API | Next.js API Routes | Backend APIs |
| Auth | Supabase Auth | Authentication |

---

**Document Status**: ✅ **COMPLETE**  
**Next**: Start implementation (Week 1: Day 1-2)  
**Duration**: 7-10 days total
