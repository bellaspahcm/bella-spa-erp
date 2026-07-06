# Week 1-2: Policy Registry - Implementation Tasks (REVISED)

**Timeline:** July 1-14, 2026 (2 weeks)  
**Component:** Policy Registry  
**Priority:** ⭐⭐⭐⭐⭐ CRITICAL (Priority 1, Foundation)  
**Status:** 📋 Ready to Start  
**Revision:** 2.0 (Enterprise-Grade)

---

## 📋 Revision Summary

**Assessment:** Original plan 8.5/10 - Good for MVP, needs improvements for Enterprise

**Key Improvements (Original → Revised):**
1. ❌ God Class → ✅ **Service-Oriented Architecture** (Repository, Lifecycle, Statistics, Governance, Audit)
2. ❌ Race Condition in Stats → ✅ **Atomic SQL Updates** (no read-modify-write)
3. ❌ No Audit Trail → ✅ **Full History Tracking** (`policy_history` table)
4. ❌ Single Version → ✅ **Multi-Version Support** (`policy_id` + `version` unique key)
5. ❌ No Permissions → ✅ **RBAC Integration** (check permissions before publish/archive)

**Result:** Plan upgraded to **9.5/10 Enterprise-Grade**

---

## 🎯 Objectives (Revised)

Build **enterprise-grade** policy registry with:
1. ✅ Multi-version policy storage (multiple versions per policy)
2. ✅ Service-oriented architecture (avoid God Class)
3. ✅ Atomic statistics updates (no race conditions)
4. ✅ Full audit trail (compliance-ready)
5. ✅ RBAC integration (permission checks)
6. ✅ Cache layer (Redis for performance)
7. ✅ Governance fields (owner, review date, expiry)
8. ✅ Migration of existing policies

**Success Criteria:**
- ✅ All existing policies migrated with version 1.0.0
- ✅ Multi-version support working (can have v1.0.0, v1.1.0, v2.0.0)
- ✅ Statistics updates are atomic (no race conditions)
- ✅ All policy changes logged in audit trail
- ✅ RBAC permissions enforced
- ✅ Tests passing with >90% coverage

---

## 📅 Day-by-Day Breakdown

### Day 1-2: Database Schema & Migration (REVISED)

#### Tasks:
1. **Create policy_registry table (MULTI-VERSION SUPPORT)**
   - [ ] Write migration file `20260701_create_policy_registry.sql`
   - [ ] **CHANGE:** Use composite unique key `(policy_id, version)` instead of single `policy_id`
   - [ ] Add `is_active` boolean to mark currently active version
   - [ ] Add `deleted_at` for soft delete
   - [ ] Create indexes for performance
   - [ ] Run migration in development

2. **Create policy_history table (AUDIT TRAIL)**
   - [ ] Write migration file `20260701_create_policy_history.sql`
   - [ ] Track all changes: status, metadata, governance
   - [ ] Store old_value, new_value, action, user, timestamp, reason
   - [ ] Create index on `policy_id` and `created_at`

3. **Create policy_statistics table (ATOMIC UPDATES)**
   - [ ] Write migration file `20260701_create_policy_statistics.sql`
   - [ ] Separate table for statistics (avoid UPDATE race conditions)
   - [ ] Use Postgres function for atomic increment
   - [ ] Create index on `policy_id` and `version`

4. **Generate TypeScript types**
   - [ ] Run Supabase type generation
   - [ ] Verify types in `src/types/database.types.ts`

5. **Test migrations**
   - [ ] Insert sample policy with multiple versions
   - [ ] Verify composite unique key works
   - [ ] Test audit trail logging
   - [ ] Test atomic statistics increment

#### Deliverables:
- ✅ `src/migrations/20260701_create_policy_registry.sql`
- ✅ `src/migrations/20260701_create_policy_history.sql`
- ✅ `src/migrations/20260701_create_policy_statistics.sql`
- ✅ `src/migrations/20260701_create_atomic_stats_function.sql`
- ✅ Updated `src/types/database.types.ts`
- ✅ Migrations tested in dev environment

---

### Day 3-4: TypeScript Types & Interfaces

#### Tasks:
1. **Create registry types file**
   - [ ] Create `src/lib/decision-engine/registry/types.ts`
   - [ ] Define `PolicyStatus` type
   - [ ] Define `PolicyRegistryEntry` interface
   - [ ] Define `PolicyMetadata` interface
   - [ ] Export all types

2. **Create constants**
   - [ ] Create `src/lib/decision-engine/registry/constants.ts`
   - [ ] Define valid policy statuses
   - [ ] Define valid categories
   - [ ] Define default SLA values

#### Deliverables:
- ✅ `src/lib/decision-engine/registry/types.ts`
- ✅ `src/lib/decision-engine/registry/constants.ts`

---

### Day 5-7: Service-Oriented Architecture (REVISED)

#### Tasks:
1. **Create PolicyRepository (Data Access Layer)**
   - [ ] Create `src/lib/decision-engine/registry/PolicyRepository.ts`
   - [ ] Implement `create(data)` - Insert policy version
   - [ ] Implement `findByIdAndVersion(policyId, version)` - Get specific version
   - [ ] Implement `findLatestVersion(policyId)` - Get latest version
   - [ ] Implement `findAllVersions(policyId)` - Get all versions of a policy
   - [ ] Implement `findAll(filters)` - List policies with filters
   - [ ] Implement `update(policyId, version, updates)` - Update policy version
   - [ ] **NEW:** Implement `setActive(policyId, version)` - Mark version as active

2. **Create PolicyLifecycleService**
   - [ ] Create `src/lib/decision-engine/registry/PolicyLifecycleService.ts`
   - [ ] Implement `publish(policyId, version, userId)` - Publish draft
   - [ ] Implement `deprecate(policyId, version, userId, reason)` - Deprecate version
   - [ ] Implement `archive(policyId, version, userId, reason)` - Archive version
   - [ ] Implement `activate(policyId, version, userId)` - Reactivate version
   - [ ] **NEW:** Validate status transitions
   - [ ] **NEW:** Log all transitions to audit trail

3. **Create PolicyStatisticsService**
   - [ ] Create `src/lib/decision-engine/registry/PolicyStatisticsService.ts`
   - [ ] Implement `recordDecision(policyId, version, outcome, confidence)` - Atomic increment
   - [ ] Implement `getStatistics(policyId, version)` - Get stats for specific version
   - [ ] Implement `getAggregatedStatistics(policyId)` - Aggregate all versions
   - [ ] **NEW:** Use Postgres function for atomic updates (no race conditions)

4. **Create PolicyGovernanceService**
   - [ ] Create `src/lib/decision-engine/registry/PolicyGovernanceService.ts`
   - [ ] Implement `checkReviewDate(policyId, version)` - Warn if review date passed
   - [ ] Implement `checkExpiryDate(policyId, version)` - Error if expired
   - [ ] Implement `updateGovernance(policyId, version, governance, userId)` - Update governance fields
   - [ ] **NEW:** Send notifications for expiring policies

5. **Create PolicyAuditService**
   - [ ] Create `src/lib/decision-engine/registry/PolicyAuditService.ts`
   - [ ] Implement `logChange(policyId, version, action, oldValue, newValue, userId, reason)` - Log to policy_history
   - [ ] Implement `getHistory(policyId, version)` - Get change history
   - [ ] Implement `getAuditTrail(filters)` - Query audit trail with filters

6. **Create PolicyRegistry (Façade)**
   - [ ] Create `src/lib/decision-engine/registry/PolicyRegistry.ts`
   - [ ] Orchestrate calls to Repository, Lifecycle, Statistics, Governance, Audit services
   - [ ] **NEW:** Check RBAC permissions before operations
   - [ ] Add input validation for all methods
   - [ ] Keep this class thin (no business logic)

#### Deliverables:
- ✅ `src/lib/decision-engine/registry/PolicyRepository.ts`
- ✅ `src/lib/decision-engine/registry/PolicyLifecycleService.ts`
- ✅ `src/lib/decision-engine/registry/PolicyStatisticsService.ts`
- ✅ `src/lib/decision-engine/registry/PolicyGovernanceService.ts`
- ✅ `src/lib/decision-engine/registry/PolicyAuditService.ts`
- ✅ `src/lib/decision-engine/registry/PolicyRegistry.ts` (façade)
- ✅ `src/lib/decision-engine/registry/db.ts` (database utilities)

2. **Create database service**
   - [ ] Create `src/lib/decision-engine/registry/db.ts`
   - [ ] Implement `createPolicy(data)` - Insert policy
   - [ ] Implement `findByPolicyId(policyId)` - Find by policy ID
   - [ ] Implement `findAll(filters)` - Find all with filters
   - [ ] Implement `updatePolicy(policyId, updates)` - Update policy
   - [ ] Add error handling for all queries

3. **Add validation**
   - [ ] Create `src/lib/decision-engine/registry/validation.ts`
   - [ ] Validate policy structure (id, name, version required)
   - [ ] Validate version format (Semver: "1.0.0")
   - [ ] Validate status values
   - [ ] Validate governance fields (email format, date format)

#### Deliverables:
- ✅ `src/lib/decision-engine/registry/PolicyRegistry.ts`
- ✅ `src/lib/decision-engine/registry/db.ts`
- ✅ `src/lib/decision-engine/registry/validation.ts`

---

### Day 8-9: Lifecycle Management

#### Tasks:
1. **Implement lifecycle methods**
   - [ ] Add `deprecate(policyId, userId)` - Mark policy as deprecated
   - [ ] Add `archive(policyId, userId)` - Archive policy
   - [ ] Add `activate(policyId, userId)` - Reactivate deprecated policy
   - [ ] Add `publish(policyId, userId)` - Publish draft policy

2. **Add status transitions**
   - [ ] Validate status transitions (draft → active → deprecated → archived)
   - [ ] Prevent invalid transitions (archived → active)
   - [ ] Log status changes in audit trail

3. **Add governance checks**
   - [ ] Check review date before publishing
   - [ ] Check expiry date (warn if expired)
   - [ ] Require approval for status changes (optional for now)

#### Deliverables:
- ✅ Lifecycle methods in `PolicyRegistry.ts`
- ✅ Status transition validation
- ✅ Governance checks

---

### Day 10-11: Statistics Tracking

#### Tasks:
1. **Implement statistics methods**
   - [ ] Add `recordDecision(policyId, outcome, confidence)` - Increment counters
   - [ ] Add `getStatistics(policyId)` - Get policy statistics
   - [ ] Add `resetStatistics(policyId)` - Reset counters (admin only)

2. **Add denormalized stats**
   - [ ] Update `total_decisions` on each decision
   - [ ] Update `total_approvals` / `total_rejections`
   - [ ] Calculate `avg_confidence` (rolling average)
   - [ ] Update `last_decision_at` timestamp

3. **Integrate with Decision Engine**
   - [ ] Hook into Decision Engine after evaluation
   - [ ] Call `PolicyRegistry.recordDecision()` automatically
   - [ ] Handle errors gracefully (stats failure shouldn't block decisions)

#### Deliverables:
- ✅ Statistics methods in `PolicyRegistry.ts`
- ✅ Integration with Decision Engine
- ✅ Error handling for stats updates

---

### Day 12-13: Migration & Testing

#### Tasks:
1. **Migrate existing policies**
   - [ ] Create migration script `scripts/migrate-policies-to-registry.ts`
   - [ ] Identify all existing policies:
     - `leave-approval-policy.ts`
     - `booking-policy.ts`
     - (Any others)
   - [ ] Extract metadata from existing policies
   - [ ] Register each policy in registry
   - [ ] Verify migration success

2. **Write unit tests**
   - [ ] Create `src/lib/decision-engine/registry/__tests__/PolicyRegistry.test.ts`
   - [ ] Test `register()` - Happy path + validation errors
   - [ ] Test `get()` - Found + not found
   - [ ] Test `list()` - With filters (status, category, tenant)
   - [ ] Test `updateMetadata()` - Valid + invalid updates
   - [ ] Test lifecycle methods (deprecate, archive, activate)
   - [ ] Test statistics tracking
   - [ ] Aim for >90% coverage

3. **Write integration tests**
   - [ ] Test full policy registration flow
   - [ ] Test policy retrieval with real database
   - [ ] Test statistics increment on decisions
   - [ ] Test concurrent updates (race conditions)

#### Deliverables:
- ✅ Migration script executed successfully
- ✅ Unit tests with >90% coverage
- ✅ Integration tests passing
- ✅ All existing policies in registry

---

### Day 14: Documentation & Review

#### Tasks:
1. **Write documentation**
   - [ ] Create `docs/decision-engine/POLICY_REGISTRY_API.md`
   - [ ] Document all public methods with examples
   - [ ] Document governance fields and their purpose
   - [ ] Document lifecycle (draft → active → deprecated → archived)
   - [ ] Add usage examples for common scenarios

2. **Code review preparation**
   - [ ] Self-review all code
   - [ ] Check TypeScript types (no `any` types)
   - [ ] Check error handling (all errors caught)
   - [ ] Check logging (appropriate log levels)
   - [ ] Run linter and fix all warnings

3. **Demo preparation**
   - [ ] Prepare demo script
   - [ ] Show policy registration
   - [ ] Show policy retrieval with filters
   - [ ] Show statistics tracking
   - [ ] Show governance metadata

#### Deliverables:
- ✅ Complete API documentation
- ✅ Code review ready
- ✅ Demo script prepared

---

## 📋 Detailed Task Checklist

### Database Schema (REVISED - Enterprise-Grade)
```sql
-- File: src/migrations/20260701_create_policy_registry.sql

-- Main policy registry table (MULTI-VERSION SUPPORT)
CREATE TABLE policy_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id TEXT NOT NULL, -- Policy family ID (e.g., "leave-approval")
  version TEXT NOT NULL, -- Semver version (e.g., "1.0.0", "1.1.0", "2.0.0")
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  category TEXT,
  tenant_id UUID REFERENCES tenants(id),
  
  -- Multi-version support
  is_active BOOLEAN DEFAULT FALSE, -- Only one version can be active
  parent_version TEXT, -- Previous version (for lineage tracking)
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id),
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES profiles(id),
  deprecated_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  
  -- Soft delete
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES profiles(id),
  
  -- Governance
  owner_department TEXT,
  business_owner TEXT,
  business_owner_email TEXT,
  technical_owner TEXT,
  technical_owner_email TEXT,
  review_date DATE,
  effective_date DATE,
  expire_date DATE,
  
  -- Config (use sparingly - prefer columns for important fields)
  config JSONB,
  metadata JSONB,
  
  -- Composite unique key: policy_id + version
  CONSTRAINT pk_policy_version UNIQUE (policy_id, version),
  
  -- Validations
  CONSTRAINT valid_status CHECK (status IN ('draft', 'active', 'deprecated', 'archived')),
  CONSTRAINT valid_version CHECK (version ~ '^\d+\.\d+\.\d+$'), -- Semver format
  CONSTRAINT valid_email_business CHECK (business_owner_email ~ '^[^@]+@[^@]+\.[^@]+$' OR business_owner_email IS NULL),
  CONSTRAINT valid_email_technical CHECK (technical_owner_email ~ '^[^@]+@[^@]+\.[^@]+$' OR technical_owner_email IS NULL),
  
  -- Only one active version per policy
  CONSTRAINT one_active_version EXCLUDE USING gist (
    policy_id WITH =,
    is_active WITH =
  ) WHERE (is_active = true AND deleted_at IS NULL)
);

-- Indexes for performance
CREATE INDEX idx_policy_registry_policy_id ON policy_registry(policy_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_policy_registry_status ON policy_registry(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_policy_registry_active ON policy_registry(policy_id, is_active) WHERE is_active = true AND deleted_at IS NULL;
CREATE INDEX idx_policy_registry_tenant ON policy_registry(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_policy_registry_category ON policy_registry(category) WHERE deleted_at IS NULL;
CREATE INDEX idx_policy_registry_review_date ON policy_registry(review_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_policy_registry_expire_date ON policy_registry(expire_date) WHERE deleted_at IS NULL;

-- Audit trail table
CREATE TABLE policy_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id TEXT NOT NULL,
  version TEXT NOT NULL,
  action TEXT NOT NULL, -- 'created', 'updated', 'published', 'deprecated', 'archived', 'deleted'
  field_changed TEXT, -- Which field was changed (e.g., 'status', 'business_owner')
  old_value JSONB, -- Previous value
  new_value JSONB, -- New value
  reason TEXT, -- Why the change was made
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  
  -- Reference to policy version
  FOREIGN KEY (policy_id, version) REFERENCES policy_registry(policy_id, version)
);

CREATE INDEX idx_policy_history_policy ON policy_history(policy_id, version);
CREATE INDEX idx_policy_history_created_at ON policy_history(created_at DESC);
CREATE INDEX idx_policy_history_action ON policy_history(action);

-- Statistics table (ATOMIC UPDATES - NO RACE CONDITIONS)
CREATE TABLE policy_statistics (
  policy_id TEXT NOT NULL,
  version TEXT NOT NULL,
  total_decisions INTEGER DEFAULT 0,
  total_approvals INTEGER DEFAULT 0,
  total_rejections INTEGER DEFAULT 0,
  
  -- For avg_confidence calculation
  confidence_sum NUMERIC(12,2) DEFAULT 0, -- Sum of all confidence values
  confidence_count INTEGER DEFAULT 0, -- Count for average calculation
  
  last_decision_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  PRIMARY KEY (policy_id, version),
  FOREIGN KEY (policy_id, version) REFERENCES policy_registry(policy_id, version)
);

CREATE INDEX idx_policy_statistics_last_decision ON policy_statistics(last_decision_at DESC);

-- Atomic statistics increment function (PREVENTS RACE CONDITIONS)
CREATE OR REPLACE FUNCTION increment_policy_statistics(
  p_policy_id TEXT,
  p_version TEXT,
  p_outcome TEXT, -- 'approve' or 'reject'
  p_confidence NUMERIC
) RETURNS VOID AS $$
BEGIN
  INSERT INTO policy_statistics (
    policy_id,
    version,
    total_decisions,
    total_approvals,
    total_rejections,
    confidence_sum,
    confidence_count,
    last_decision_at,
    updated_at
  ) VALUES (
    p_policy_id,
    p_version,
    1,
    CASE WHEN p_outcome = 'approve' THEN 1 ELSE 0 END,
    CASE WHEN p_outcome = 'reject' THEN 1 ELSE 0 END,
    p_confidence,
    1,
    NOW(),
    NOW()
  )
  ON CONFLICT (policy_id, version) DO UPDATE SET
    total_decisions = policy_statistics.total_decisions + 1,
    total_approvals = policy_statistics.total_approvals + CASE WHEN p_outcome = 'approve' THEN 1 ELSE 0 END,
    total_rejections = policy_statistics.total_rejections + CASE WHEN p_outcome = 'reject' THEN 1 ELSE 0 END,
    confidence_sum = policy_statistics.confidence_sum + p_confidence,
    confidence_count = policy_statistics.confidence_count + 1,
    last_decision_at = NOW(),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION increment_policy_statistics IS 'Atomically increment policy statistics without race conditions';
```


### TypeScript Types
```typescript
// File: src/lib/decision-engine/registry/types.ts

export type PolicyStatus = 'draft' | 'active' | 'deprecated' | 'archived';

export interface PolicyRegistryEntry {
  id: string;
  policyId: string;
  name: string;
  description?: string;
  version: string;
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
  
  // Governance
  ownerDepartment?: string;
  businessOwner?: string;
  businessOwnerEmail?: string;
  technicalOwner?: string;
  technicalOwnerEmail?: string;
  reviewDate?: string; // ISO date string
  effectiveDate?: string;
  expireDate?: string;
  
  // Config
  config?: Record<string, any>;
  metadata?: PolicyMetadata;
  
  // Statistics
  totalDecisions: number;
  totalApprovals: number;
  totalRejections: number;
  avgConfidence?: number;
  lastDecisionAt?: string;
}

export interface PolicyMetadata {
  tags?: string[];
  owner?: string;
  contact?: string;
  sla?: {
    maxLatency: number; // ms
    targetAvailability: number; // 99.9%
  };
  documentation?: string; // URL or markdown
  changelog?: string;
}

export interface RegisterPolicyInput {
  policy: Policy; // From existing Policy type
  createdBy: string;
  category?: string;
  ownerDepartment?: string;
  businessOwner?: string;
  businessOwnerEmail?: string;
  technicalOwner?: string;
  technicalOwnerEmail?: string;
  reviewDate?: string;
  effectiveDate?: string;
  expireDate?: string;
  tags?: string[];
}

export interface PolicyRegistryFilters {
  status?: PolicyStatus;
  category?: string;
  tenantId?: string;
  ownerDepartment?: string;
  expiringSoon?: boolean; // expires within 30 days
  needsReview?: boolean; // review date passed
}
```

### PolicyRegistry Service Skeleton
```typescript
// File: src/lib/decision-engine/registry/PolicyRegistry.ts

import { Policy } from '../types';
import type {
  PolicyRegistryEntry,
  RegisterPolicyInput,
  PolicyRegistryFilters,
  PolicyStatus
} from './types';
import * as db from './db';
import { validatePolicy, validateVersion, validateEmail } from './validation';

export class PolicyRegistry {
  /**
   * Register a new policy in the registry
   */
  static async register(input: RegisterPolicyInput): Promise<PolicyRegistryEntry> {
    // 1. Validate policy structure
    validatePolicy(input.policy);
    
    // 2. Validate version format (Semver)
    validateVersion(input.policy.version || '1.0.0');
    
    // 3. Validate emails if provided
    if (input.businessOwnerEmail) validateEmail(input.businessOwnerEmail);
    if (input.technicalOwnerEmail) validateEmail(input.technicalOwnerEmail);
    
    // 4. Check for duplicate policy ID
    const existing = await this.get(input.policy.id);
    if (existing) {
      throw new Error(`Policy ${input.policy.id} already registered`);
    }
    
    // 5. Insert into database
    const entry = await db.createPolicy({
      policyId: input.policy.id,
      name: input.policy.name,
      description: input.policy.description,
      version: input.policy.version || '1.0.0',
      status: 'draft', // Start as draft
      category: input.category,
      createdBy: input.createdBy,
      updatedBy: input.createdBy,
      ownerDepartment: input.ownerDepartment,
      businessOwner: input.businessOwner,
      businessOwnerEmail: input.businessOwnerEmail,
      technicalOwner: input.technicalOwner,
      technicalOwnerEmail: input.technicalOwnerEmail,
      reviewDate: input.reviewDate,
      effectiveDate: input.effectiveDate,
      expireDate: input.expireDate,
      config: input.policy.config,
      metadata: { tags: input.tags }
    });
    
    return entry;
  }
  
  /**
   * Get policy by ID
   */
  static async get(policyId: string): Promise<PolicyRegistryEntry | null> {
    return await db.findByPolicyId(policyId);
  }
  
  /**
   * List all policies (with optional filters)
   */
  static async list(filters?: PolicyRegistryFilters): Promise<PolicyRegistryEntry[]> {
    return await db.findAll(filters);
  }
  
  /**
   * Update policy metadata (without changing version)
   */
  static async updateMetadata(
    policyId: string,
    updates: Partial<PolicyRegistryEntry>,
    updatedBy: string
  ): Promise<PolicyRegistryEntry> {
    // Validate emails if being updated
    if (updates.businessOwnerEmail) validateEmail(updates.businessOwnerEmail);
    if (updates.technicalOwnerEmail) validateEmail(updates.technicalOwnerEmail);
    
    return await db.updatePolicy(policyId, {
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy
    });
  }
  
  /**
   * Publish a draft policy (make it active)
   */
  static async publish(policyId: string, userId: string): Promise<PolicyRegistryEntry> {
    const policy = await this.get(policyId);
    if (!policy) throw new Error(`Policy ${policyId} not found`);
    if (policy.status !== 'draft') {
      throw new Error(`Cannot publish policy with status ${policy.status}`);
    }
    
    // Check governance: review date and expiry
    if (policy.reviewDate && new Date(policy.reviewDate) < new Date()) {
      console.warn(`⚠️ Policy ${policyId} review date passed: ${policy.reviewDate}`);
    }
    if (policy.expireDate && new Date(policy.expireDate) < new Date()) {
      throw new Error(`Cannot publish expired policy (expires: ${policy.expireDate})`);
    }
    
    return await db.updatePolicy(policyId, {
      status: 'active',
      publishedAt: new Date().toISOString(),
      publishedBy: userId,
      updatedAt: new Date().toISOString(),
      updatedBy: userId
    });
  }
  
  /**
   * Deprecate a policy (soft delete)
   */
  static async deprecate(policyId: string, userId: string): Promise<PolicyRegistryEntry> {
    const policy = await this.get(policyId);
    if (!policy) throw new Error(`Policy ${policyId} not found`);
    if (policy.status === 'archived') {
      throw new Error('Cannot deprecate archived policy');
    }
    
    return await db.updatePolicy(policyId, {
      status: 'deprecated',
      deprecatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: userId
    });
  }
  
  /**
   * Archive a policy (hard delete from active use)
   */
  static async archive(policyId: string, userId: string): Promise<PolicyRegistryEntry> {
    const policy = await this.get(policyId);
    if (!policy) throw new Error(`Policy ${policyId} not found`);
    
    return await db.updatePolicy(policyId, {
      status: 'archived',
      archivedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: userId
    });
  }
  
  /**
   * Reactivate a deprecated policy
   */
  static async activate(policyId: string, userId: string): Promise<PolicyRegistryEntry> {
    const policy = await this.get(policyId);
    if (!policy) throw new Error(`Policy ${policyId} not found`);
    if (policy.status === 'archived') {
      throw new Error('Cannot activate archived policy');
    }
    
    return await db.updatePolicy(policyId, {
      status: 'active',
      publishedAt: new Date().toISOString(),
      publishedBy: userId,
      updatedAt: new Date().toISOString(),
      updatedBy: userId
    });
  }
  
  /**
   * Record a decision for statistics (called after each decision)
   */
  static async recordDecision(
    policyId: string,
    outcome: 'approve' | 'reject',
    confidence: number
  ): Promise<void> {
    try {
      const policy = await this.get(policyId);
      if (!policy) return; // Silently skip if policy not found
      
      const newTotal = policy.totalDecisions + 1;
      const newApprovals = policy.totalApprovals + (outcome === 'approve' ? 1 : 0);
      const newRejections = policy.totalRejections + (outcome === 'reject' ? 1 : 0);
      
      // Calculate rolling average confidence
      const oldAvg = policy.avgConfidence || 0;
      const newAvg = ((oldAvg * policy.totalDecisions) + confidence) / newTotal;
      
      await db.updatePolicy(policyId, {
        totalDecisions: newTotal,
        totalApprovals: newApprovals,
        totalRejections: newRejections,
        avgConfidence: Math.round(newAvg * 100) / 100, // Round to 2 decimals
        lastDecisionAt: new Date().toISOString()
      });
    } catch (error) {
      // Don't throw - stats failure shouldn't block decisions
      console.error(`Failed to record decision for policy ${policyId}:`, error);
    }
  }
  
  /**
   * Get policy statistics
   */
  static async getStatistics(policyId: string) {
    const policy = await this.get(policyId);
    if (!policy) return null;
    
    return {
      policyId: policy.policyId,
      totalDecisions: policy.totalDecisions,
      totalApprovals: policy.totalApprovals,
      totalRejections: policy.totalRejections,
      approvalRate: policy.totalDecisions > 0
        ? (policy.totalApprovals / policy.totalDecisions) * 100
        : 0,
      avgConfidence: policy.avgConfidence || 0,
      lastDecisionAt: policy.lastDecisionAt
    };
  }
}
```


### Database Service
```typescript
// File: src/lib/decision-engine/registry/db.ts

import { createClient } from '@/lib/supabase/server';
import type { PolicyRegistryEntry, PolicyRegistryFilters } from './types';

export async function createPolicy(
  data: Omit<PolicyRegistryEntry, 'id' | 'createdAt' | 'updatedAt' | 'totalDecisions' | 'totalApprovals' | 'totalRejections'>
): Promise<PolicyRegistryEntry> {
  const supabase = await createClient();
  
  const { data: policy, error } = await supabase
    .from('policy_registry')
    .insert({
      policy_id: data.policyId,
      name: data.name,
      description: data.description,
      version: data.version,
      status: data.status,
      category: data.category,
      tenant_id: data.tenantId,
      created_by: data.createdBy,
      updated_by: data.updatedBy,
      owner_department: data.ownerDepartment,
      business_owner: data.businessOwner,
      business_owner_email: data.businessOwnerEmail,
      technical_owner: data.technicalOwner,
      technical_owner_email: data.technicalOwnerEmail,
      review_date: data.reviewDate,
      effective_date: data.effectiveDate,
      expire_date: data.expireDate,
      config: data.config,
      metadata: data.metadata
    })
    .select()
    .single();
  
  if (error) throw error;
  return mapDbToEntry(policy);
}

export async function findByPolicyId(policyId: string): Promise<PolicyRegistryEntry | null> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('policy_registry')
    .select('*')
    .eq('policy_id', policyId)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
  return data ? mapDbToEntry(data) : null;
}

export async function findAll(filters?: PolicyRegistryFilters): Promise<PolicyRegistryEntry[]> {
  const supabase = await createClient();
  
  let query = supabase.from('policy_registry').select('*');
  
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.category) {
    query = query.eq('category', filters.category);
  }
  if (filters?.tenantId) {
    query = query.eq('tenant_id', filters.tenantId);
  }
  if (filters?.ownerDepartment) {
    query = query.eq('owner_department', filters.ownerDepartment);
  }
  if (filters?.expiringSoon) {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    query = query
      .lte('expire_date', thirtyDaysFromNow.toISOString())
      .gte('expire_date', new Date().toISOString());
  }
  if (filters?.needsReview) {
    query = query.lt('review_date', new Date().toISOString());
  }
  
  const { data, error } = await query;
  if (error) throw error;
  
  return data.map(mapDbToEntry);
}

export async function updatePolicy(
  policyId: string,
  updates: Partial<PolicyRegistryEntry>
): Promise<PolicyRegistryEntry> {
  const supabase = await createClient();
  
  const dbUpdates: any = {
    updated_at: new Date().toISOString()
  };
  
  // Map camelCase to snake_case
  if (updates.status) dbUpdates.status = updates.status;
  if (updates.publishedAt) dbUpdates.published_at = updates.publishedAt;
  if (updates.publishedBy) dbUpdates.published_by = updates.publishedBy;
  if (updates.deprecatedAt) dbUpdates.deprecated_at = updates.deprecatedAt;
  if (updates.archivedAt) dbUpdates.archived_at = updates.archivedAt;
  if (updates.ownerDepartment) dbUpdates.owner_department = updates.ownerDepartment;
  if (updates.businessOwner) dbUpdates.business_owner = updates.businessOwner;
  if (updates.businessOwnerEmail) dbUpdates.business_owner_email = updates.businessOwnerEmail;
  if (updates.technicalOwner) dbUpdates.technical_owner = updates.technicalOwner;
  if (updates.technicalOwnerEmail) dbUpdates.technical_owner_email = updates.technicalOwnerEmail;
  if (updates.reviewDate) dbUpdates.review_date = updates.reviewDate;
  if (updates.effectiveDate) dbUpdates.effective_date = updates.effectiveDate;
  if (updates.expireDate) dbUpdates.expire_date = updates.expireDate;
  if (updates.totalDecisions !== undefined) dbUpdates.total_decisions = updates.totalDecisions;
  if (updates.totalApprovals !== undefined) dbUpdates.total_approvals = updates.totalApprovals;
  if (updates.totalRejections !== undefined) dbUpdates.total_rejections = updates.totalRejections;
  if (updates.avgConfidence !== undefined) dbUpdates.avg_confidence = updates.avgConfidence;
  if (updates.lastDecisionAt) dbUpdates.last_decision_at = updates.lastDecisionAt;
  if (updates.updatedBy) dbUpdates.updated_by = updates.updatedBy;
  
  const { data, error } = await supabase
    .from('policy_registry')
    .update(dbUpdates)
    .eq('policy_id', policyId)
    .select()
    .single();
  
  if (error) throw error;
  return mapDbToEntry(data);
}

// Helper: Map database snake_case to TypeScript camelCase
function mapDbToEntry(dbRow: any): PolicyRegistryEntry {
  return {
    id: dbRow.id,
    policyId: dbRow.policy_id,
    name: dbRow.name,
    description: dbRow.description,
    version: dbRow.version,
    status: dbRow.status,
    category: dbRow.category,
    tenantId: dbRow.tenant_id,
    createdAt: dbRow.created_at,
    createdBy: dbRow.created_by,
    updatedAt: dbRow.updated_at,
    updatedBy: dbRow.updated_by,
    publishedAt: dbRow.published_at,
    publishedBy: dbRow.published_by,
    deprecatedAt: dbRow.deprecated_at,
    archivedAt: dbRow.archived_at,
    ownerDepartment: dbRow.owner_department,
    businessOwner: dbRow.business_owner,
    businessOwnerEmail: dbRow.business_owner_email,
    technicalOwner: dbRow.technical_owner,
    technicalOwnerEmail: dbRow.technical_owner_email,
    reviewDate: dbRow.review_date,
    effectiveDate: dbRow.effective_date,
    expireDate: dbRow.expire_date,
    config: dbRow.config,
    metadata: dbRow.metadata,
    totalDecisions: dbRow.total_decisions || 0,
    totalApprovals: dbRow.total_approvals || 0,
    totalRejections: dbRow.total_rejections || 0,
    avgConfidence: dbRow.avg_confidence,
    lastDecisionAt: dbRow.last_decision_at
  };
}
```

### Validation Utilities
```typescript
// File: src/lib/decision-engine/registry/validation.ts

import type { Policy } from '../types';

/**
 * Validate policy structure
 */
export function validatePolicy(policy: Policy): void {
  if (!policy.id) {
    throw new Error('Policy ID is required');
  }
  if (!policy.name) {
    throw new Error('Policy name is required');
  }
  if (!/^[a-z0-9_-]+$/i.test(policy.id)) {
    throw new Error('Policy ID must contain only alphanumeric characters, hyphens, and underscores');
  }
}

/**
 * Validate Semver version format
 */
export function validateVersion(version: string): void {
  const semverRegex = /^\d+\.\d+\.\d+$/;
  if (!semverRegex.test(version)) {
    throw new Error(`Invalid version format: ${version}. Expected Semver (e.g., "1.0.0")`);
  }
}

/**
 * Validate email format
 */
export function validateEmail(email: string): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error(`Invalid email format: ${email}`);
  }
}

/**
 * Validate status transition
 */
export function validateStatusTransition(
  currentStatus: string,
  newStatus: string
): void {
  const allowedTransitions: Record<string, string[]> = {
    draft: ['active'],
    active: ['deprecated', 'archived'],
    deprecated: ['active', 'archived'],
    archived: [] // Cannot transition from archived
  };
  
  const allowed = allowedTransitions[currentStatus] || [];
  if (!allowed.includes(newStatus)) {
    throw new Error(
      `Invalid status transition: ${currentStatus} → ${newStatus}. Allowed: ${allowed.join(', ')}`
    );
  }
}
```

### Migration Script
```typescript
// File: scripts/migrate-policies-to-registry.ts

import { PolicyRegistry } from '@/lib/decision-engine/registry/PolicyRegistry';
import { LeaveApprovalPolicy } from '@/lib/decision-engine/policies/leave-approval-policy';
import { BookingPolicy } from '@/lib/decision-engine/policies/booking-policy';

async function main() {
  console.log('🚀 Starting policy migration...\n');
  
  const userId = 'system'; // System user for migration
  
  // Migrate Leave Approval Policy
  try {
    console.log('📝 Migrating Leave Approval Policy...');
    await PolicyRegistry.register({
      policy: LeaveApprovalPolicy,
      createdBy: userId,
      category: 'leave',
      ownerDepartment: 'HR',
      businessOwner: 'HR Manager',
      businessOwnerEmail: 'hr@bella.vn',
      technicalOwner: 'Backend Team',
      technicalOwnerEmail: 'tech@bella.vn',
      reviewDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 6 months
      effectiveDate: new Date().toISOString().split('T')[0],
      tags: ['leave', 'approval', 'hr']
    });
    
    // Publish immediately
    await PolicyRegistry.publish(LeaveApprovalPolicy.id, userId);
    console.log('✅ Leave Approval Policy migrated and published\n');
  } catch (error) {
    console.error('❌ Failed to migrate Leave Approval Policy:', error);
  }
  
  // Migrate Booking Policy
  try {
    console.log('📝 Migrating Booking Policy...');
    await PolicyRegistry.register({
      policy: BookingPolicy,
      createdBy: userId,
      category: 'booking',
      ownerDepartment: 'Operations',
      businessOwner: 'Operations Manager',
      businessOwnerEmail: 'ops@bella.vn',
      technicalOwner: 'Backend Team',
      technicalOwnerEmail: 'tech@bella.vn',
      reviewDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      effectiveDate: new Date().toISOString().split('T')[0],
      tags: ['booking', 'customer', 'operations']
    });
    
    await PolicyRegistry.publish(BookingPolicy.id, userId);
    console.log('✅ Booking Policy migrated and published\n');
  } catch (error) {
    console.error('❌ Failed to migrate Booking Policy:', error);
  }
  
  // List all policies
  console.log('📋 All registered policies:');
  const policies = await PolicyRegistry.list();
  policies.forEach(p => {
    console.log(`  - ${p.name} (${p.policyId}) - ${p.status}`);
  });
  
  console.log('\n✅ Migration complete!');
}

main().catch(console.error);
```

### Unit Tests
```typescript
// File: src/lib/decision-engine/registry/__tests__/PolicyRegistry.test.ts

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PolicyRegistry } from '../PolicyRegistry';
import type { Policy } from '../../types';

describe('PolicyRegistry', () => {
  const mockPolicy: Policy = {
    id: 'test-policy',
    name: 'Test Policy',
    description: 'A test policy',
    version: '1.0.0',
    rules: []
  };
  
  const mockUserId = 'test-user-123';
  
  afterEach(async () => {
    // Cleanup: delete test policy if exists
    try {
      const policy = await PolicyRegistry.get(mockPolicy.id);
      if (policy) {
        await PolicyRegistry.archive(mockPolicy.id, mockUserId);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });
  
  describe('register', () => {
    it('should register a new policy', async () => {
      const entry = await PolicyRegistry.register({
        policy: mockPolicy,
        createdBy: mockUserId,
        category: 'test',
        ownerDepartment: 'Engineering',
        businessOwner: 'Test Owner'
      });
      
      expect(entry.policyId).toBe(mockPolicy.id);
      expect(entry.name).toBe(mockPolicy.name);
      expect(entry.status).toBe('draft');
      expect(entry.ownerDepartment).toBe('Engineering');
    });
    
    it('should throw error for duplicate policy ID', async () => {
      await PolicyRegistry.register({
        policy: mockPolicy,
        createdBy: mockUserId,
        category: 'test'
      });
      
      await expect(
        PolicyRegistry.register({
          policy: mockPolicy,
          createdBy: mockUserId,
          category: 'test'
        })
      ).rejects.toThrow('already registered');
    });
    
    it('should validate version format', async () => {
      const invalidPolicy = {
        ...mockPolicy,
        version: 'invalid'
      };
      
      await expect(
        PolicyRegistry.register({
          policy: invalidPolicy,
          createdBy: mockUserId
        })
      ).rejects.toThrow('Invalid version format');
    });
    
    it('should validate email format', async () => {
      await expect(
        PolicyRegistry.register({
          policy: mockPolicy,
          createdBy: mockUserId,
          businessOwnerEmail: 'invalid-email'
        })
      ).rejects.toThrow('Invalid email format');
    });
  });
  
  describe('get', () => {
    it('should retrieve policy by ID', async () => {
      await PolicyRegistry.register({
        policy: mockPolicy,
        createdBy: mockUserId
      });
      
      const entry = await PolicyRegistry.get(mockPolicy.id);
      expect(entry).not.toBeNull();
      expect(entry!.policyId).toBe(mockPolicy.id);
    });
    
    it('should return null for non-existent policy', async () => {
      const entry = await PolicyRegistry.get('non-existent');
      expect(entry).toBeNull();
    });
  });
  
  describe('list', () => {
    it('should list all policies', async () => {
      await PolicyRegistry.register({
        policy: mockPolicy,
        createdBy: mockUserId,
        category: 'test'
      });
      
      const policies = await PolicyRegistry.list();
      expect(policies.length).toBeGreaterThan(0);
    });
    
    it('should filter by status', async () => {
      await PolicyRegistry.register({
        policy: mockPolicy,
        createdBy: mockUserId
      });
      
      const draftPolicies = await PolicyRegistry.list({ status: 'draft' });
      expect(draftPolicies.every(p => p.status === 'draft')).toBe(true);
    });
    
    it('should filter by category', async () => {
      await PolicyRegistry.register({
        policy: mockPolicy,
        createdBy: mockUserId,
        category: 'test'
      });
      
      const testPolicies = await PolicyRegistry.list({ category: 'test' });
      expect(testPolicies.every(p => p.category === 'test')).toBe(true);
    });
  });
  
  describe('lifecycle', () => {
    beforeEach(async () => {
      await PolicyRegistry.register({
        policy: mockPolicy,
        createdBy: mockUserId
      });
    });
    
    it('should publish draft policy', async () => {
      const published = await PolicyRegistry.publish(mockPolicy.id, mockUserId);
      expect(published.status).toBe('active');
      expect(published.publishedAt).toBeDefined();
      expect(published.publishedBy).toBe(mockUserId);
    });
    
    it('should deprecate active policy', async () => {
      await PolicyRegistry.publish(mockPolicy.id, mockUserId);
      const deprecated = await PolicyRegistry.deprecate(mockPolicy.id, mockUserId);
      
      expect(deprecated.status).toBe('deprecated');
      expect(deprecated.deprecatedAt).toBeDefined();
    });
    
    it('should archive policy', async () => {
      const archived = await PolicyRegistry.archive(mockPolicy.id, mockUserId);
      expect(archived.status).toBe('archived');
      expect(archived.archivedAt).toBeDefined();
    });
    
    it('should not publish non-draft policy', async () => {
      await PolicyRegistry.publish(mockPolicy.id, mockUserId);
      
      await expect(
        PolicyRegistry.publish(mockPolicy.id, mockUserId)
      ).rejects.toThrow('Cannot publish policy with status active');
    });
  });
  
  describe('statistics', () => {
    beforeEach(async () => {
      await PolicyRegistry.register({
        policy: mockPolicy,
        createdBy: mockUserId
      });
      await PolicyRegistry.publish(mockPolicy.id, mockUserId);
    });
    
    it('should record decision and update statistics', async () => {
      await PolicyRegistry.recordDecision(mockPolicy.id, 'approve', 0.95);
      
      const stats = await PolicyRegistry.getStatistics(mockPolicy.id);
      expect(stats!.totalDecisions).toBe(1);
      expect(stats!.totalApprovals).toBe(1);
      expect(stats!.avgConfidence).toBeCloseTo(0.95, 2);
    });
    
    it('should calculate approval rate correctly', async () => {
      await PolicyRegistry.recordDecision(mockPolicy.id, 'approve', 0.95);
      await PolicyRegistry.recordDecision(mockPolicy.id, 'approve', 0.90);
      await PolicyRegistry.recordDecision(mockPolicy.id, 'reject', 0.80);
      
      const stats = await PolicyRegistry.getStatistics(mockPolicy.id);
      expect(stats!.totalDecisions).toBe(3);
      expect(stats!.totalApprovals).toBe(2);
      expect(stats!.approvalRate).toBeCloseTo(66.67, 1);
    });
    
    it('should not throw on stats failure', async () => {
      // Should not throw even if policy doesn't exist
      await expect(
        PolicyRegistry.recordDecision('non-existent', 'approve', 0.95)
      ).resolves.not.toThrow();
    });
  });
});
```


---

## 🎯 Success Checklist

At the end of Week 2, verify these criteria:

### Database
- [ ] `policy_registry` table created in database
- [ ] All indexes created and working
- [ ] Can insert, update, query policies
- [ ] TypeScript types generated from schema

### Code
- [ ] `PolicyRegistry` class implemented
- [ ] All CRUD methods working (register, get, list, update)
- [ ] Lifecycle methods working (publish, deprecate, archive, activate)
- [ ] Statistics tracking working (recordDecision, getStatistics)
- [ ] Validation working (policy, version, email, status transition)
- [ ] Database service working (createPolicy, findByPolicyId, findAll, updatePolicy)

### Migration
- [ ] Existing policies migrated to registry
- [ ] All policies have governance metadata
- [ ] All policies publishable (status = active)

### Tests
- [ ] Unit tests written with >90% coverage
- [ ] All tests passing
- [ ] Integration tests passing
- [ ] Manual testing completed

### Documentation
- [ ] API documentation complete
- [ ] Usage examples provided
- [ ] Governance fields explained
- [ ] Migration guide written

---

## 📚 Reference Documents

- **Phase B Overview:** `PHASE_B_PLATFORM_FOUNDATION_PLAN.md`
- **Strategic Roadmap:** `BELLA_EIP_STRATEGIC_ROADMAP.md`
- **Executive Summary:** `PHASE_B_EXECUTIVE_SUMMARY.md`
- **Existing Decision Engine:** `src/lib/decision-engine/`

---

## 🚀 Getting Started

### Day 1 Morning:
1. Read this document thoroughly
2. Review existing Decision Engine code
3. Create feature branch: `git checkout -b feature/policy-registry`
4. Create migration file: `src/migrations/20260701_create_policy_registry.sql`

### Day 1 Afternoon:
1. Run migration in development
2. Generate TypeScript types
3. Test database manually (insert sample policy)

### Day 2:
1. Create types file: `src/lib/decision-engine/registry/types.ts`
2. Create constants file: `src/lib/decision-engine/registry/constants.ts`
3. Create validation file: `src/lib/decision-engine/registry/validation.ts`

### Day 3-7:
Follow the day-by-day tasks above.

### Day 8-14:
Complete lifecycle, statistics, migration, tests, and documentation.

---

## 💡 Tips for Success

### 1. Start Simple
- Get basic CRUD working first
- Add governance fields second
- Add statistics last

### 2. Test As You Go
- Write unit tests immediately after each method
- Don't wait until the end

### 3. Database Performance
- Test query performance with indexes
- Use `.explain()` to verify index usage

### 4. Error Handling
- Use try/catch for all database operations
- Provide helpful error messages
- Don't swallow errors silently

### 5. Type Safety
- Avoid `any` types
- Use proper TypeScript interfaces
- Validate inputs at boundaries

### 6. Backwards Compatibility
- Don't break existing policies
- Migration should be zero-downtime
- Existing code continues to work during migration

---

## 🐛 Common Pitfalls to Avoid

### 1. Blocking Operations
❌ Don't make statistics tracking synchronous
✅ Statistics updates should not block decision evaluation

### 2. Race Conditions
❌ Don't update statistics without proper locking
✅ Use database transactions or atomic updates

### 3. Validation Gaps
❌ Don't trust input data
✅ Validate everything: policy structure, version, emails, status transitions

### 4. Missing Indexes
❌ Don't forget indexes on frequently queried columns
✅ Create indexes for status, category, tenant_id, review_date

### 5. Poor Error Messages
❌ "Error" or "Failed"
✅ "Policy 'leave-approval' already registered. Use updateMetadata() to modify."

---

## 📊 Progress Tracking

Track your progress daily:

### Day 1: Database
- [ ] Migration file created
- [ ] Migration run successfully
- [ ] Types generated

### Day 2: Types & Constants
- [ ] Types file complete
- [ ] Constants file complete
- [ ] Validation file complete

### Day 3-4: Core CRUD
- [ ] register() implemented
- [ ] get() implemented
- [ ] list() implemented
- [ ] updateMetadata() implemented

### Day 5-7: Database Service
- [ ] createPolicy() implemented
- [ ] findByPolicyId() implemented
- [ ] findAll() implemented
- [ ] updatePolicy() implemented

### Day 8-9: Lifecycle
- [ ] publish() implemented
- [ ] deprecate() implemented
- [ ] archive() implemented
- [ ] activate() implemented

### Day 10-11: Statistics
- [ ] recordDecision() implemented
- [ ] getStatistics() implemented
- [ ] Integration with Decision Engine

### Day 12-13: Migration & Tests
- [ ] Migration script complete
- [ ] Existing policies migrated
- [ ] Unit tests written (>90% coverage)
- [ ] Integration tests written

### Day 14: Documentation
- [ ] API docs complete
- [ ] Usage examples added
- [ ] Ready for code review

---

## 🎉 Week 2 Completion

When all tasks are complete, you should have:

✅ **Centralized Policy Registry** with full governance
✅ **All existing policies** migrated and tracked
✅ **Statistics dashboard-ready** (decision counts, approval rates)
✅ **Enterprise-grade metadata** (owners, review dates, expiry)
✅ **Production-ready code** (tested, documented, reviewed)

**This is the foundation for all future Decision Engine work.**

---

## 📞 Need Help?

If you encounter issues:
1. Review the detailed schemas and examples above
2. Check existing Decision Engine code for patterns
3. Consult Phase B documentation for context
4. Ask team for code review

**Remember:** Policy Registry is the foundation. Take time to get it right.

---

**Next Step:** After Week 2 completion, proceed to **Week 3-4: Rule Registry**

Good luck! 🚀
