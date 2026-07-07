# Policy Registry - Modular Monolith Architecture

Policy Registry for Bella ERP Decision Engine. Manages policy lifecycle, governance, statistics, and audit trails using a **Modular Monolith** architecture.

## Design Philosophy

> **Design for tomorrow, implement for today.**

- ✅ **Preserve architectural boundaries** (logical separation of concerns)
- ✅ **Collapse physical boundaries** (minimal files/classes for Phase 1)
- ✅ **Clear extension points** (easy to extract services later)
- ✅ **YAGNI principle** (avoid premature abstractions)

---

## Architecture

### **Visual Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│                      Decision Engine                         │
│                   (Policy Execution)                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
         ┌───────────────────────────────┐
         │     PolicyRegistry (Façade)    │
         │  ┌──────────────────────────┐ │
         │  │ Lifecycle  (private)     │ │
         │  │ Governance (private)     │ │
         │  │ Statistics (private)     │ │
         │  └──────────────────────────┘ │
         └────┬─────────┬─────────┬──────┘
              │         │         │
     ┌────────▼─┐  ┌───▼────┐  ┌─▼───────┐
     │ Repo     │  │ Audit  │  │ Validate│
     │ (Data)   │  │ (Infra)│  │ (Utils) │
     └────┬─────┘  └────┬───┘  └─────────┘
          │             │
          ▼             ▼
    ┌──────────┐  ┌──────────┐
    │ Supabase │  │ policy_  │
    │ policy_  │  │ history  │
    │ registry │  │          │
    └──────────┘  └──────────┘
```

### **Current Architecture: Modular Monolith**

**NOT Microservices. NOT DDD. NOT CQRS.**

This is a deliberate architectural choice based on current requirements:

| Factor | Current Reality | Architecture Decision |
|--------|----------------|----------------------|
| **Decision Volume** | ~10K-50K/month | Modular Monolith (no need for service splitting) |
| **Team Size** | 3-5 developers | Modular Monolith (coordination overhead not justified) |
| **Deployment** | Single deployment unit | Modular Monolith (no independent scaling needed) |
| **Database** | Single Postgres instance | Modular Monolith (no distributed transactions) |
| **Complexity** | Manageable in ~2K LOC | Modular Monolith (premature abstraction avoided) |

**When to migrate to Microservices:**
- Decision volume > 1M/month (need independent scaling)
- Multiple teams (>10 developers) working on policy system
- Need polyglot persistence (different databases for different concerns)
- Independent deployment cycles required

### **Current Structure (Modular Monolith)**

```
PolicyRegistry (Façade)
│
├── PolicyRepository (Data Access)
│   └── Supabase
│
├── Audit Utilities (audit.ts)
│   └── policy_history table
│
├── Validation Utilities (validation.ts)
│
└── Internal Modules (private methods)
    ├── Lifecycle
    ├── Governance  
    └── Statistics
```

### **Logical Boundaries** (concepts that exist, but not yet separate services):

| Boundary | Current Implementation | Extraction Trigger |
|----------|----------------------|-------------------|
| **Lifecycle** | Private methods in PolicyRegistry | >300 LOC OR workflow engine needed |
| **Governance** | Private methods in PolicyRegistry | >300 LOC OR external policy engine needed |
| **Statistics** | Private methods in PolicyRegistry | >1M decisions/month OR real-time aggregation |
| **Repository** | Separate class (PolicyRepository) | ✅ Already extracted (infrastructure boundary) |
| **Audit** | Utility functions (audit.ts) | ✅ Already extracted (cross-cutting concern) |
| **Validation** | Utility functions (validation.ts) | ✅ Already extracted (reusable utilities) |

---

## File Structure

```
registry/
├── PolicyRegistry.ts       (~600 LOC)
│   ├── Public API
│   ├── Private: Lifecycle methods
│   ├── Private: Governance methods
│   ├── Private: Statistics methods
│   └── Extension points (EventBus, Cache)
│
├── PolicyRepository.ts     (~300 LOC)
│   └── Data access only
│
├── audit.ts               (~150 LOC)
│   ├── writeAudit()
│   ├── getHistory()
│   └── queryHistory()
│
├── validation.ts          (~150 LOC)
│   ├── validatePolicy()
│   ├── validateVersion()
│   ├── validateEmail()
│   └── validateStatusTransition()
│
├── types.ts              (~350 LOC)
├── constants.ts          (~200 LOC)
└── README.md
```

**Total: ~1,750 LOC** (simplified from 3,600 LOC)

---

## Key Principles

### 1. **Repository Must Stay Separate**

Repository is an **infrastructure boundary**. It must NEVER contain business logic.

**Repository Responsibilities:**
- ✅ CRUD operations
- ✅ Query construction
- ✅ Data mapping

**NOT Repository Responsibilities:**
- ❌ Validation (belongs to validation.ts)
- ❌ Governance checks (belongs to PolicyRegistry)
- ❌ Lifecycle transitions (belongs to PolicyRegistry)
- ❌ Audit logging (belongs to audit.ts)

### 2. **Audit is a Cross-Cutting Concern**

Audit is **infrastructure**, not business logic. Keep it separate.

```typescript
// ✅ Good
await writeAudit({ policyId, version, action, userId });

// ❌ Bad - don't merge into PolicyRegistry
this.logAudit(...); // Violates separation of concerns
```

### 3. **Validation Stays Separate**

Validation is **reusable utility**, not business logic.

```typescript
// ✅ Good
const result = validatePolicy(policy);
if (!result.valid) throw new Error(result.errors.join(', '));

// ❌ Bad - don't merge into PolicyRegistry
this.validatePolicyInternal(...); // Duplicates validation logic
```

### 4. **Statistics in policy_registry Table**

For Phase 1 (<1M decisions/month), statistics live in `policy_registry` as simple columns:

```sql
ALTER TABLE policy_registry ADD COLUMN
  total_decisions INTEGER DEFAULT 0,
  total_approvals INTEGER DEFAULT 0,
  total_rejections INTEGER DEFAULT 0,
  avg_confidence NUMERIC(3,2),
  last_decision_at TIMESTAMPTZ;
```

**No SQL functions needed at current scale.**

Simple direct UPDATE statements are sufficient:
```typescript
await supabase
  .from('policy_registry')
  .update({
    total_decisions: currentTotal + 1,
    total_approvals: currentApprovals + (outcome === 'approve' ? 1 : 0),
    avg_confidence: newAvgConfidence,
    last_decision_at: new Date().toISOString(),
  })
  .eq('policy_id', policyId)
  .eq('version', version);
```

**Migration Trigger:** When decisions exceed ~1M/month OR concurrent updates cause issues, then:
1. Extract to `policy_statistics` table with partitioning
2. Use Postgres functions for atomic updates
3. Consider real-time aggregation (materialized views, triggers)

### 5. **RBAC via Existing AuthService**

Don't build a new RBAC framework. Use existing `AuthService`:

```typescript
// Extension Point: Authorization
// await AuthService.requirePermission(userId, 'policy:publish');
```

### 6. **Extension Points, Not Empty Services**

Leave clear TODO comments instead of creating empty services:

```typescript
// Extension Point: Event emission
// await EventBus.emit('PolicyPublished', { policyId, version });

// Extension Point: Cache invalidation
// await Cache.delete(`policy:${policyId}`);

// Extension Point: Real-time metrics
// await Metrics.publish('policy.decision', { policyId, outcome });
```

---

## Service Extraction Guidelines (Rule of Three)

**Do NOT extract a new service unless it meets at least ONE of:**

1. **Size:** Module exceeds ~300 lines of code
2. **Reuse:** Module is used by multiple other modules
3. **Lifecycle:** Module has independent lifecycle (different deployment/scaling)
4. **Testing:** Module requires isolated test environment

### **Current Modules (Not Yet Services)**

| Module | Current LOC | Reused? | Independent Lifecycle? | Extract? |
|--------|------------|---------|----------------------|----------|
| Lifecycle | ~150 | No | No | ❌ Keep as private methods |
| Governance | ~120 | No | No | ❌ Keep as private methods |
| Statistics | ~80 | No | No | ❌ Keep as private methods |
| Repository | ~300 | Yes | No | ✅ Already extracted |
| Audit | ~150 | Yes | No | ✅ Already extracted |
| Validation | ~150 | Yes | No | ✅ Already extracted |

### **When to Extract?**

#### **Lifecycle → PolicyLifecycleService**
Extract when:
- Lifecycle logic exceeds 300 LOC
- Requires workflow engine integration (Temporal, Camunda)
- Needs complex approval workflows
- Multiple modules need lifecycle management

#### **Governance → PolicyGovernanceService**
Extract when:
- Governance rules exceed 300 LOC
- Requires integration with external policy engines (OPA, Cedar)
- Needs complex compliance workflows
- Multiple modules need governance checks

#### **Statistics → PolicyStatisticsService**
Extract when:
- Decision volume exceeds ~1M/month
- Requires real-time aggregation
- Needs separate scaling/optimization
- Multiple modules need statistics tracking

---

## Database Schema

### **policy_registry** (Consolidated)

```sql
CREATE TABLE policy_registry (
  id UUID PRIMARY KEY,
  policy_id TEXT NOT NULL,
  version TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'deprecated', 'archived')),
  category TEXT,
  tenant_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  parent_version TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  published_by TEXT,
  deprecated_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  
  -- Soft Delete
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT,
  
  -- Governance
  owner_department TEXT,
  business_owner TEXT,
  business_owner_email TEXT,
  technical_owner TEXT,
  technical_owner_email TEXT,
  review_date DATE,
  effective_date DATE,
  expire_date DATE,
  
  -- Statistics (NEW - Phase 1 simplification)
  total_decisions INTEGER DEFAULT 0,
  total_approvals INTEGER DEFAULT 0,
  total_rejections INTEGER DEFAULT 0,
  avg_confidence NUMERIC(3,2),
  last_decision_at TIMESTAMPTZ,
  
  -- Config
  config JSONB,
  metadata JSONB,
  
  -- Constraints
  UNIQUE (policy_id, version)
);

-- Only one active version per policy
CREATE UNIQUE INDEX idx_policy_active 
ON policy_registry (policy_id) 
WHERE is_active = true AND deleted_at IS NULL;
```

### **policy_history** (Audit Trail)

```sql
CREATE TABLE policy_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id TEXT NOT NULL,
  version TEXT NOT NULL,
  action TEXT NOT NULL,
  field_changed TEXT,
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX idx_policy_history_lookup 
ON policy_history (policy_id, version, created_at DESC);
```

---

## Usage Examples

### 1. Register a New Policy

```typescript
import { PolicyRegistry } from '@/lib/decision-engine/registry';

const policy = await PolicyRegistry.register(
  {
    policy: {
      id: 'leave-approval',
      version: '1.0.0',
      name: 'Leave Approval Policy',
      rules: [/* ... */],
    },
    category: 'leave',
    businessOwner: 'HR Manager',
    businessOwnerEmail: 'hr@bella.vn',
    technicalOwner: 'John Doe',
    technicalOwnerEmail: 'john@bella.vn',
    ownerDepartment: 'HR',
    reviewDate: '2026-12-31',
    effectiveDate: '2026-01-01',
    expireDate: '2027-12-31',
  },
  userId
);
```

### 2. Publish a Policy

```typescript
const published = await PolicyRegistry.publish(
  'leave-approval',
  '1.0.0',
  userId,
  'Initial production release'
);

// Automatically:
// - Validates governance
// - Deactivates other versions
// - Logs to audit trail
// - Sets is_active = true
```

### 3. Record Decision Statistics

```typescript
await PolicyRegistry.recordDecision(
  'leave-approval',
  '1.0.0',
  'approve',
  0.95, // confidence
  45    // latency in ms (optional)
);

// Non-blocking - failures are logged but don't throw
// Simple UPDATE to policy_registry (no separate table)
```

### 4. Check Governance

```typescript
const check = await PolicyRegistry.checkGovernance('leave-approval', '1.0.0');

if (!check.passed) {
  console.error('Governance errors:', check.errors);
  console.warn('Governance warnings:', check.warnings);
}

// Checks:
// - Business owner + email required
// - Technical owner + email required
// - Department required
// - Effective date required
// - Not expired
// - Review date (warning if missing)
```

### 5. View Audit History

```typescript
const history = await PolicyRegistry.getHistory('leave-approval', '1.0.0');

history.forEach(entry => {
  console.log(`${entry.action} by ${entry.createdBy} at ${entry.createdAt}`);
  console.log(`  Reason: ${entry.reason}`);
});
```

### 6. Get Statistics

```typescript
const stats = await PolicyRegistry.getStatistics('leave-approval', '1.0.0');

console.log(`Total decisions: ${stats.totalDecisions}`);
console.log(`Approval rate: ${stats.approvalRate}%`);
console.log(`Average confidence: ${stats.avgConfidence}`);
```

---

## Status Lifecycle

```
draft → active → deprecated → archived
         ↑          ↓
         └──────────┘ (reactivate)
```

**Valid Transitions:**
```typescript
VALID_STATUS_TRANSITIONS = {
  draft: ['active'],
  active: ['deprecated', 'archived'],
  deprecated: ['active', 'archived'],
  archived: [], // Cannot transition from archived
}
```

---

## Testing Strategy

### **Unit Tests**
Test each logical boundary in isolation:
- `PolicyRegistry.lifecycle.test.ts` - Test lifecycle private methods
- `PolicyRegistry.governance.test.ts` - Test governance private methods
- `PolicyRegistry.statistics.test.ts` - Test statistics private methods
- `PolicyRepository.test.ts` - Test data access
- `audit.test.ts` - Test audit functions
- `validation.test.ts` - Test validation functions

### **Integration Tests**
Test full workflows:
- `PolicyRegistry.integration.test.ts`
  - Full registration → publish flow
  - Multi-version scenarios
  - Statistics recording
  - Audit trail logging

### **Testing Principles**
- ✅ Test logical boundaries, not physical files
- ✅ Mock repository in unit tests
- ✅ Use real database in integration tests
- ✅ Test extension points (ensure they don't break when uncommented)

---

## Migration Path

### **From Modular Monolith to Microservices**

When extraction is needed (based on Rule of Three):

**Step 1: Extract Service Class**
```typescript
// Before (private methods in PolicyRegistry)
private static async checkGovernance(...) { ... }

// After (separate service)
export class PolicyGovernanceService {
  static async checkGovernance(...) { ... }
}
```

**Step 2: Update PolicyRegistry to Delegate**
```typescript
// Before
const check = await this.performGovernanceCheck(policyId, version);

// After
const check = await PolicyGovernanceService.checkGovernance(policyId, version);
```

**Step 3: Public API Stays the Same**
```typescript
// Caller code UNCHANGED
const check = await PolicyRegistry.checkGovernance(policyId, version);
```

**No breaking changes for consumers!**

---

## Common Pitfalls to Avoid

### ❌ **Don't Merge Repository into PolicyRegistry**
```typescript
// ❌ BAD
class PolicyRegistry {
  static async publish(...) {
    const { data } = await supabase.from('policy_registry').update(...);
    // Violates Repository pattern
  }
}

// ✅ GOOD
class PolicyRegistry {
  static async publish(...) {
    await PolicyRepository.update(...);
    // Uses repository layer
  }
}
```

### ❌ **Don't Create Empty Services**
```typescript
// ❌ BAD
class PolicyLifecycleService {
  // TODO: Implement later
}

// ✅ GOOD
class PolicyRegistry {
  // Extension Point: PolicyLifecycleService
  // Extract when lifecycle logic exceeds 300 LOC
  private static async publish(...) { ... }
}
```

### ❌ **Don't Build RBAC Framework**
```typescript
// ❌ BAD
class RBACService {
  static async checkPermission(...) { ... }
  static async hasRole(...) { ... }
}

// ✅ GOOD
await AuthService.requirePermission(userId, 'policy:publish');
// Uses existing auth infrastructure
```

### ❌ **Don't Premature Optimize Statistics**
```typescript
// ❌ BAD (for Phase 1)
CREATE TABLE policy_statistics (...);
CREATE FUNCTION increment_with_locks(...);

// ✅ GOOD (for Phase 1)
ALTER TABLE policy_registry ADD COLUMN total_decisions INTEGER;
// Simple UPDATE - sufficient for <1M decisions/month
```

---

## Comparison: Enterprise vs Modular Monolith

| Aspect | Enterprise (Before) | Modular Monolith (After) |
|--------|-------------------|------------------------|
| **Files** | 12 files | 6 files |
| **Services** | 6 service classes | 0 service classes (2 utilities) |
| **LOC** | ~3,600 | ~1,750 |
| **Statistics** | Separate table + Postgres function | Fields in policy_registry |
| **Governance** | Separate service | Private methods |
| **Lifecycle** | Separate service | Private methods |
| **Audit** | Separate service | Helper functions (audit.ts) |
| **RBAC** | New framework | Use existing AuthService |
| **EventBus** | Interface + TODO | Extension point comments |
| **Cache** | Interface + TODO | Extension point comments |
| **Complexity** | High | Low |
| **Extensibility** | High | High (clear extraction points) |
| **Maintainability** | Medium | High |
| **Time to Implement** | 14 days | 7 days |

---

## Summary

**Architecture Philosophy:**
- **Logical boundaries preserved** (concepts exist in code structure and comments)
- **Physical boundaries minimized** (fewer files, fewer classes)
- **Extension points clear** (TODO comments marking future extraction)
- **Rule of Three followed** (extract only when justified)

**Result:**
- ✅ Clean architecture
- ✅ Minimal complexity
- ✅ Easy to test
- ✅ Easy to extend
- ✅ Fast to implement

> **Design for tomorrow, implement for today.**

This is the way Microsoft, Shopify, GitHub, and Basecamp build systems in early stages. Start simple, extract when needed.

---

**Next Steps:**
1. Implement tests
2. Run migration scripts
3. Monitor decision volume
4. Extract services when Rule of Three triggers

