# Week 1-2: Policy Registry - Quick Reference Card

**Version:** 2.0 (Enterprise-Grade)  
**Timeline:** July 1-14, 2026  
**Status:** Ready to implement

---

## 🎯 5 Critical Improvements

| # | Problem | Solution | Impact |
|---|---------|----------|--------|
| 1 | **God Class** | Service-Oriented (6 services) | Maintainability ⬆️⬆️ |
| 2 | **Race Condition** | Atomic Postgres function | Data Integrity ⬆️⬆️⬆️ |
| 3 | **No Audit** | policy_history table | Compliance ⬆️⬆️⬆️ |
| 4 | **Single Version** | (policy_id, version) unique key | Flexibility ⬆️⬆️⬆️ |
| 5 | **No RBAC** | Permission checks | Security ⬆️⬆️ |

---

## 📦 Database Tables

### 1. policy_registry (Main Table)
```sql
-- Composite key: (policy_id, version)
-- Multiple versions per policy: v1.0.0, v1.1.0, v2.0.0
-- Only one is_active = true per policy
CREATE TABLE policy_registry (
  policy_id TEXT,
  version TEXT, -- Semver: "1.0.0"
  is_active BOOLEAN, -- Current active version
  parent_version TEXT, -- Lineage tracking
  deleted_at TIMESTAMPTZ, -- Soft delete
  ...
  UNIQUE (policy_id, version)
);
```

### 2. policy_history (Audit Trail)
```sql
-- Logs all changes for compliance
CREATE TABLE policy_history (
  policy_id TEXT,
  version TEXT,
  action TEXT, -- 'created', 'published', 'deprecated'
  field_changed TEXT, -- 'status', 'business_owner'
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ,
  created_by UUID
);
```

### 3. policy_statistics (Atomic Updates)
```sql
-- Separate table to avoid UPDATE locks
CREATE TABLE policy_statistics (
  policy_id TEXT,
  version TEXT,
  total_decisions INTEGER,
  confidence_sum NUMERIC, -- For avg calculation
  confidence_count INTEGER,
  PRIMARY KEY (policy_id, version)
);

-- Atomic increment function (NO RACE CONDITION)
CREATE FUNCTION increment_policy_statistics(...) ...
```

---

## 🏗️ Service Architecture

```
PolicyRegistry (Façade)
├── PolicyRepository (Data Access)
├── PolicyLifecycleService (publish, deprecate, archive)
├── PolicyStatisticsService (recordDecision, getStatistics)
├── PolicyGovernanceService (checkReviewDate, checkExpiryDate)
└── PolicyAuditService (logChange, getHistory)
```

### PolicyRegistry (Thin Façade)
```typescript
class PolicyRegistry {
  constructor(
    private repo: PolicyRepository,
    private lifecycle: PolicyLifecycleService,
    private stats: PolicyStatisticsService,
    private governance: PolicyGovernanceService,
    private audit: PolicyAuditService
  ) {}
  
  // Orchestrate calls to services
  async register(policy, metadata, userId) {
    // 1. Check permissions
    await checkPermission(userId, 'policy:create');
    
    // 2. Create policy
    const entry = await this.repo.create(policy, metadata);
    
    // 3. Log audit trail
    await this.audit.logChange(policy.id, policy.version, 'created', null, entry, userId, 'Initial registration');
    
    return entry;
  }
}
```

---

## ⚡ Atomic Statistics (No Race Condition)

### Before (WRONG):
```typescript
const policy = await db.get(policyId); // Read
policy.total_decisions += 1;
await db.update(policyId, policy); // Write
// ❌ 100 concurrent requests = lost updates
```

### After (CORRECT):
```typescript
await db.query(
  'SELECT increment_policy_statistics($1, $2, $3, $4)',
  [policyId, version, outcome, confidence]
);
// ✅ Atomic, no race condition
```

---

## 📝 Multi-Version Example

```typescript
// Register v1.0.0
await PolicyRegistry.register({
  policy: { id: 'leave-approval', version: '1.0.0', ... },
  createdBy: 'user-123'
});
await PolicyRegistry.publish('leave-approval', '1.0.0', 'user-123');
// is_active = true

// Register v1.1.0 (minor update)
await PolicyRegistry.register({
  policy: { id: 'leave-approval', version: '1.1.0', parent_version: '1.0.0', ... },
  createdBy: 'user-123'
});
await PolicyRegistry.publish('leave-approval', '1.1.0', 'user-123');
// v1.0.0: is_active = false
// v1.1.0: is_active = true

// Get latest version
const latest = await PolicyRepository.findLatestVersion('leave-approval');
// Returns v1.1.0

// Get all versions
const allVersions = await PolicyRepository.findAllVersions('leave-approval');
// Returns [v1.0.0, v1.1.0]

// Replay decision from March (uses v1.0.0)
const oldPolicy = await PolicyRepository.findByIdAndVersion('leave-approval', '1.0.0');
```

---

## 🔒 RBAC Integration

```typescript
// Before operations, check permission
class PolicyLifecycleService {
  async publish(policyId: string, version: string, userId: string) {
    // 1. Check permission
    if (!await hasPermission(userId, 'policy:publish')) {
      throw new Error('Unauthorized: policy:publish required');
    }
    
    // 2. Check governance
    await this.governance.checkExpiryDate(policyId, version);
    
    // 3. Update status
    await this.repo.update(policyId, version, { status: 'active' });
    
    // 4. Log audit
    await this.audit.logChange(
      policyId,
      version,
      'published',
      { status: 'draft' },
      { status: 'active' },
      userId,
      'Published to production'
    );
  }
}
```

---

## 📊 Day-by-Day Checklist

### Day 1-2: Database
- [ ] Create `policy_registry` table (multi-version)
- [ ] Create `policy_history` table (audit)
- [ ] Create `policy_statistics` table (atomic)
- [ ] Create `increment_policy_statistics()` function
- [ ] Test migrations

### Day 3-4: Types
- [ ] Define `PolicyRegistryEntry` (updated for multi-version)
- [ ] Define `PolicyHistory`, `PolicyStatistics`
- [ ] Define service interfaces

### Day 5-7: Services
- [ ] `PolicyRepository.ts` (data access)
- [ ] `PolicyLifecycleService.ts` (publish, deprecate, archive)
- [ ] `PolicyStatisticsService.ts` (recordDecision, getStatistics)
- [ ] `PolicyGovernanceService.ts` (checkReviewDate, checkExpiryDate)
- [ ] `PolicyAuditService.ts` (logChange, getHistory)
- [ ] `PolicyRegistry.ts` (façade)

### Day 8-9: Lifecycle
- [ ] Implement publish with audit logging
- [ ] Implement deprecate with reason
- [ ] Implement archive
- [ ] Add RBAC checks

### Day 10-11: Statistics
- [ ] Use atomic Postgres function
- [ ] Test concurrent updates (no race condition)
- [ ] Integration with Decision Engine

### Day 12-13: Migration & Tests
- [ ] Migrate existing policies to v1.0.0
- [ ] Unit tests (>90% coverage)
- [ ] Integration tests
- [ ] Test multi-version scenarios

### Day 14: Documentation
- [ ] API documentation
- [ ] Multi-version usage guide
- [ ] Audit trail query examples

---

## 🧪 Key Tests to Write

### 1. Atomic Statistics (Race Condition Test)
```typescript
it('should handle 100 concurrent decision recordings', async () => {
  const promises = Array.from({ length: 100 }, (_, i) =>
    PolicyStatisticsService.recordDecision('test-policy', '1.0.0', 'approve', 0.95)
  );
  
  await Promise.all(promises);
  
  const stats = await PolicyStatisticsService.getStatistics('test-policy', '1.0.0');
  expect(stats.totalDecisions).toBe(100); // ✅ No lost updates
});
```

### 2. Multi-Version Support
```typescript
it('should support multiple versions', async () => {
  await PolicyRegistry.register({ policy: { id: 'test', version: '1.0.0' }, ... });
  await PolicyRegistry.register({ policy: { id: 'test', version: '1.1.0', parent_version: '1.0.0' }, ... });
  
  const versions = await PolicyRepository.findAllVersions('test');
  expect(versions).toHaveLength(2);
  expect(versions[0].version).toBe('1.0.0');
  expect(versions[1].version).toBe('1.1.0');
  expect(versions[1].parent_version).toBe('1.0.0');
});
```

### 3. Audit Trail
```typescript
it('should log all changes to audit trail', async () => {
  await PolicyRegistry.publish('test-policy', '1.0.0', 'user-123');
  
  const history = await PolicyAuditService.getHistory('test-policy', '1.0.0');
  expect(history).toHaveLength(1);
  expect(history[0].action).toBe('published');
  expect(history[0].field_changed).toBe('status');
  expect(history[0].old_value).toEqual({ status: 'draft' });
  expect(history[0].new_value).toEqual({ status: 'active' });
});
```

---

## ⚠️ Common Pitfalls

| Pitfall | Impact | Solution |
|---------|--------|----------|
| **Read-modify-write for stats** | Race condition | Use atomic Postgres function |
| **Forget to log audit trail** | Compliance gap | Always call `audit.logChange()` |
| **No permission check** | Security hole | Check RBAC before operations |
| **Hard delete** | Audit lost | Use soft delete (`deleted_at`) |
| **Single version only** | Can't replay old decisions | Support multi-version |

---

## 🚀 Getting Started

1. **Read this quick reference**
2. **Read full plan:** `WEEK_1_2_POLICY_REGISTRY_TASKS.md`
3. **Read improvements:** `WEEK_1_2_IMPROVEMENTS_SUMMARY.md`
4. **Create feature branch:** `git checkout -b feature/policy-registry-v2`
5. **Start Day 1 tasks:** Database schema + migrations

---

## 📞 Need Help?

- **Architecture questions:** Review `WEEK_1_2_IMPROVEMENTS_SUMMARY.md`
- **Implementation details:** Check `WEEK_1_2_POLICY_REGISTRY_TASKS.md`
- **Strategic context:** Read `PHASE_B_PLATFORM_FOUNDATION_PLAN.md`

---

**Remember:** Enterprise-grade doesn't mean longer timeline - it means better architecture from day 1! 🚀
