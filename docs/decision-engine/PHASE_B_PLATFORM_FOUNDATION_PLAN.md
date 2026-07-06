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

## Week 1-2: Policy Registry (Modular Monolith Architecture v2) ⭐ **REVISED**

### Objective
Centralize all policy definitions with metadata, status tracking, and lifecycle management using a **Modular Monolith** architecture.

### Architecture Decision

**v2 Modular Monolith (APPROVED 9.8/10)**

**Why Modular Monolith:**
- Current scale: ~10K-50K decisions/month
- Team size: 3-5 developers
- Single deployment unit
- Single Postgres database
- No microservices overhead needed

**See detailed documentation:**
- `src/lib/decision-engine/registry/README.md`
- `src/lib/decision-engine/registry/ARCHITECTURE_COMPARISON.md`
- `src/lib/decision-engine/registry/MIGRATION_GUIDE.md`

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
const registry = await PolicyRegistry.list();
// Returns: All policies with status, version, metadata
```

### Technical Design

#### 1.1 Database Schema (Simplified - Statistics Merged)
```sql
CREATE TABLE policy_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id TEXT NOT NULL,
  version TEXT NOT NULL, -- Semver: "1.0.0"
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL, -- 'draft', 'active', 'deprecated', 'archived'
  category TEXT, -- 'leave', 'booking', 'pricing', 'payroll'
  tenant_id UUID REFERENCES tenants(id),
  is_active BOOLEAN NOT NULL DEFAULT false, -- Only one active version per policy
  parent_version TEXT, -- For version lineage
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  published_by TEXT,
  deprecated_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  
  -- Soft Delete
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT,
  
  -- Governance
  owner_department TEXT, -- 'HR', 'Finance', 'Operations'
  business_owner TEXT,
  business_owner_email TEXT,
  technical_owner TEXT,
  technical_owner_email TEXT,
  review_date DATE,
  effective_date DATE,
  expire_date DATE,
  
  -- Config
  config JSONB, -- Policy definition
  metadata JSONB, -- Tags, documentation, etc.
  
  -- Statistics (MERGED - no separate table needed at current scale)
  total_decisions INTEGER DEFAULT 0,
  total_approvals INTEGER DEFAULT 0,
  total_rejections INTEGER DEFAULT 0,
  avg_confidence NUMERIC(3,2),
  last_decision_at TIMESTAMPTZ,
  
  -- Constraints
  UNIQUE (policy_id, version),
  CONSTRAINT valid_status CHECK (status IN ('draft', 'active', 'deprecated', 'archived'))
);

-- Only one active version per policy
CREATE UNIQUE INDEX idx_policy_active 
ON policy_registry (policy_id) 
WHERE is_active = true AND deleted_at IS NULL;

-- Audit Trail Table
CREATE TABLE policy_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id TEXT NOT NULL,
  version TEXT NOT NULL,
  action TEXT NOT NULL, -- 'created', 'published', 'deprecated', 'updated', etc.
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

#### 1.2 File Structure (Modular Monolith)
```
registry/
├── PolicyRegistry.ts       (~650 LOC) - Façade + Lifecycle + Governance + Statistics
├── PolicyRepository.ts     (~300 LOC) - Pure data access
├── audit.ts               (~150 LOC) - Audit utilities
├── validation.ts          (~150 LOC) - Validation functions
├── types.ts              (~350 LOC) - Type definitions
├── constants.ts          (~200 LOC) - Constants and RBAC mappings
├── index.ts              (~50 LOC)  - Barrel export
├── README.md             - Architecture overview
├── MIGRATION_GUIDE.md    - Step-by-step migration
└── ARCHITECTURE_COMPARISON.md - v1 vs v2 comparison

Total: 7 files, ~1,850 LOC (vs 12 files, 3,600 LOC in v1)
```

#### 1.3 PolicyRegistry (Modular Monolith)
```typescript
// src/lib/decision-engine/registry/PolicyRegistry.ts

/**
 * PolicyRegistry - Policy Management Façade (Modular Monolith)
 * 
 * Orchestrates policy lifecycle, governance, and statistics.
 * 
 * Logical Boundaries (not yet separate services):
 * - Lifecycle → private methods
 * - Governance → private methods
 * - Statistics → private methods
 * 
 * Extraction Rule (Rule of Three):
 * Extract to service when:
 * 1. Module exceeds ~300 LOC, OR
 * 2. Module is reused by multiple modules, OR
 * 3. Module has independent lifecycle/scaling needs
 */
export class PolicyRegistry {
  // ========================================
  // PUBLIC API - Registration
  // ========================================
  
  /**
   * Register a new policy in the registry
   */
  static async register(
    input: RegisterPolicyInput,
    userId: string
  ): Promise<PolicyRegistryEntry> {
    // Permission check
    await this.requirePermission(userId, 'policy:create');
    
    // Validate policy
    const validation = validatePolicy(input.policy);
    if (!validation.valid) {
      throw new Error(`Policy validation failed: ${validation.errors.join(', ')}`);
    }
    
    // Create via repository
    const policy = await PolicyRepository.create(input, userId);
    
    // Log creation
    await writeAudit({
      policyId: policy.policyId,
      version: policy.version,
      action: 'created',
      userId,
    });
    
    return policy;
  }
  
  // ========================================
  // PUBLIC API - Lifecycle
  // ========================================
  
  /**
   * Publish a policy (draft → active)
   */
  static async publish(
    policyId: string,
    version: string,
    userId: string,
    reason?: string
  ): Promise<PolicyRegistryEntry> {
    await this.requirePermission(userId, 'policy:publish');
    
    // Validate governance
    const governanceCheck = await this.checkPublishEligibility(policyId, version);
    if (!governanceCheck.passed) {
      throw new GovernanceValidationError(
        'Policy does not meet governance requirements',
        governanceCheck.errors
      );
    }
    
    // Deactivate other versions
    await this.deactivateOtherVersions(policyId, version, userId);
    
    // Update status
    const updated = await PolicyRepository.update(policyId, version, {
      status: 'active',
      publishedAt: new Date().toISOString(),
      publishedBy: userId,
    }, userId);
    
    await PolicyRepository.setActive(policyId, version, true);
    
    // Log publish
    await writeAudit({
      policyId,
      version,
      action: 'published',
      reason,
      userId,
    });
    
    return updated;
  }
  
  /**
   * Deprecate a policy (active → deprecated)
   */
  static async deprecate(
    policyId: string,
    version: string,
    userId: string,
    reason: string
  ): Promise<PolicyRegistryEntry> {
    await this.requirePermission(userId, 'policy:deprecate');
    
    // Update status
    const updated = await PolicyRepository.update(policyId, version, {
      status: 'deprecated',
      deprecatedAt: new Date().toISOString(),
    }, userId);
    
    // Deactivate if currently active
    if (updated.isActive) {
      await PolicyRepository.setActive(policyId, version, false);
    }
    
    // Log deprecation
    await writeAudit({
      policyId,
      version,
      action: 'deprecated',
      reason,
      userId,
    });
    
    return updated;
  }
  
  // ========================================
  // PUBLIC API - Query
  // ========================================
  
  static async get(policyId: string, version?: string): Promise<PolicyRegistryEntry> {
    if (version) {
      return PolicyRepository.findByIdAndVersion(policyId, version);
    } else {
      const active = await PolicyRepository.findActiveVersion(policyId);
      if (!active) throw new PolicyNotFoundError(policyId);
      return active;
    }
  }
  
  static async list(filters?: PolicyRegistryFilters): Promise<PolicyListResult> {
    return PolicyRepository.findAll(filters);
  }
  
  // ========================================
  // PUBLIC API - Statistics
  // ========================================
  
  /**
   * Record a decision (non-blocking)
   */
  static async recordDecision(
    policyId: string,
    version: string,
    outcome: DecisionOutcome,
    confidence?: number
  ): Promise<void> {
    try {
      await this.updateStatistics(policyId, version, outcome, confidence);
    } catch (error) {
      // Silently log - statistics are non-critical
      console.error(`Failed to record decision for ${policyId} v${version}:`, error);
    }
  }
  
  static async getStatistics(
    policyId: string,
    version?: string
  ): Promise<PolicyStatistics | null> {
    const policy = version
      ? await PolicyRepository.findByIdAndVersion(policyId, version)
      : await PolicyRepository.findActiveVersion(policyId);
    
    if (!policy) return null;
    
    return {
      policyId: policy.policyId,
      version: policy.version,
      totalDecisions: policy.totalDecisions || 0,
      totalApprovals: policy.totalApprovals || 0,
      totalRejections: policy.totalRejections || 0,
      approvalRate: this.calculateApprovalRate(policy),
      avgConfidence: policy.avgConfidence,
      lastDecisionAt: policy.lastDecisionAt,
    };
  }
  
  // ========================================
  // PRIVATE - Lifecycle (extraction point)
  // ========================================
  
  /**
   * Deactivate other versions
   * 
   * Extract to PolicyLifecycleService when:
   * - Lifecycle logic exceeds 300 LOC
   * - Requires workflow engine integration
   */
  private static async deactivateOtherVersions(
    policyId: string,
    currentVersion: string,
    userId: string
  ): Promise<void> {
    const versions = await PolicyRepository.findAllVersions(policyId);
    
    for (const version of versions) {
      if (version.isActive && version.version !== currentVersion) {
        await PolicyRepository.setActive(policyId, version.version, false);
        await writeAudit({
          policyId,
          version: version.version,
          action: 'deactivated',
          reason: `Deactivated when v${currentVersion} was published`,
          userId,
        });
      }
    }
  }
  
  // ========================================
  // PRIVATE - Governance (extraction point)
  // ========================================
  
  /**
   * Check publish eligibility
   * 
   * Extract to PolicyGovernanceService when:
   * - Governance rules exceed 300 LOC
   * - Requires external policy engine
   */
  private static async checkPublishEligibility(
    policyId: string,
    version: string
  ): Promise<GovernanceCheckResult> {
    const policy = await PolicyRepository.findByIdAndVersion(policyId, version);
    
    const errors: string[] = [];
    
    // MUST have business owner
    if (!policy.businessOwner || !policy.businessOwnerEmail) {
      errors.push('Business owner is required for publishing');
    }
    
    // MUST have technical owner
    if (!policy.technicalOwner || !policy.technicalOwnerEmail) {
      errors.push('Technical owner is required for publishing');
    }
    
    // MUST have department
    if (!policy.ownerDepartment) {
      errors.push('Owner department is required for publishing');
    }
    
    // MUST have effective date
    if (!policy.effectiveDate) {
      errors.push('Effective date is required for publishing');
    }
    
    // MUST NOT be expired
    if (policy.expireDate && new Date(policy.expireDate) < new Date()) {
      errors.push('Cannot publish expired policy');
    }
    
    return {
      policyId,
      version,
      passed: errors.length === 0,
      errors,
      warnings: [],
      checks: {},
    };
  }
  
  // ========================================
  // PRIVATE - Statistics (extraction point)
  // ========================================
  
  /**
   * Update statistics
   * 
   * Simple direct UPDATE - no SQL function needed at current scale.
   * 
   * Extract to PolicyStatisticsService when:
   * - Decision volume exceeds 1M/month
   * - Requires real-time aggregation
   */
  private static async updateStatistics(
    policyId: string,
    version: string,
    outcome: DecisionOutcome,
    confidence?: number
  ): Promise<void> {
    // Get current stats
    const policy = await PolicyRepository.findByIdAndVersion(policyId, version);
    
    // Calculate new average confidence
    let newAvgConfidence = policy.avgConfidence;
    if (confidence !== undefined) {
      const currentSum = (policy.avgConfidence || 0) * policy.totalDecisions;
      newAvgConfidence = (currentSum + confidence) / (policy.totalDecisions + 1);
    }
    
    // Simple UPDATE - sufficient for <1M decisions/month
    await PolicyRepository.update(policyId, version, {
      totalDecisions: policy.totalDecisions + 1,
      totalApprovals: policy.totalApprovals + (outcome === 'approve' ? 1 : 0),
      totalRejections: policy.totalRejections + (outcome === 'reject' ? 1 : 0),
      avgConfidence: newAvgConfidence,
      lastDecisionAt: new Date().toISOString(),
    }, 'system');
  }
  
  // ========================================
  // EXTENSION POINTS - Integration Wrappers
  // ========================================
  
  private static async requirePermission(userId: string, permission: string): Promise<void> {
    // TODO: Integrate with AuthService
    // await AuthService.requirePermission(userId, permission);
  }
  
  private static calculateApprovalRate(policy: any): number {
    if (policy.totalDecisions === 0) return 0;
    return Math.round((policy.totalApprovals / policy.totalDecisions) * 10000) / 100;
  }
}
```

### Implementation Timeline (2 Weeks)

#### Day 1-4: Database + Types + Repository
- [x] Database migrations (policy_registry, policy_history)
- [x] TypeScript types and interfaces
- [x] PolicyRepository (pure data access)
- [x] Validation utilities
- [x] Constants

#### Day 5-7: PolicyRegistry + Services
- [x] PolicyRegistry façade with lifecycle methods
- [x] Audit utilities (audit.ts)
- [x] Governance validation (private methods)
- [x] Statistics tracking (private methods)

#### Day 8-9: Integration & Testing
- [x] Integration tests created (PolicyRegistry.integration.test.ts)
- [x] Test helpers created (test-helpers.ts)
- [x] RBAC permission checks (activate permission added)
- [x] Unit tests passing (62/62 tests ✅)
- [ ] Integration tests execution (blocked: pending Day 14 database deployment)

#### Day 10-11: Migration
- [x] Migration script for existing policies
- [x] NPM scripts (policy:migrate, policy:verify, policy:rollback)
- [x] Comprehensive migration documentation
- [ ] Test migration on staging (blocked: pending Day 14 database deployment)
- [ ] Verify data integrity (blocked: pending Day 14 database deployment)

#### Day 12-13: Documentation & Review
- [ ] API documentation
- [ ] Usage examples
- [ ] Architecture diagrams
- [ ] Code review

#### Day 14: Deployment
- [ ] Deploy to production
- [ ] Monitor for 24-48 hours
- [ ] Archive old enterprise files (after stable)

### Deliverables (Week 1-2)

- [x] Database schema (policy_registry, policy_history)
- [x] PolicyRegistry.ts (~650 LOC)
- [x] PolicyRepository.ts (~300 LOC)
- [x] audit.ts (~150 LOC)
- [x] validation.ts (~150 LOC)
- [x] types.ts (~350 LOC)
- [x] constants.ts (~200 LOC)
- [x] Migration scripts (migrate, verify, rollback) (~450 LOC)
- [x] NPM scripts (policy:migrate, policy:verify, policy:rollback)
- [x] Unit tests (62/62 passing ✅ >90% coverage)
- [x] Integration tests (11 test cases, ready for Day 14)
- [x] Documentation (README, MIGRATION_GUIDE, ARCHITECTURE_COMPARISON, POLICY_MIGRATION_GUIDE)
- [ ] Integration tests execution (Day 14)
- [ ] Production deployment (Day 14)

### Success Criteria

- ✅ All existing policies registered in database
- ✅ PolicyRegistry API working correctly
- ✅ Decision statistics automatically updated
- ✅ Audit trail complete for all changes
- ✅ Tests passing with >90% coverage
- ✅ Code reduced by 52% (vs v1 Enterprise approach)
- ✅ No breaking changes to public API

### Migration from v1 (if applicable)

If you previously started with v1 Enterprise architecture, follow:
- `src/lib/decision-engine/registry/MIGRATION_GUIDE.md`

Key steps:
1. Archive old service files (don't delete)
2. Rename v2 files to active
3. Update imports
4. Run database migrations
5. Test thoroughly
6. Deploy to staging
7. Monitor for 2 weeks
8. Delete archive after confirmed stable

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
