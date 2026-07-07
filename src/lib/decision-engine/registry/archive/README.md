# Archived Files - Enterprise Architecture (v1)

These files represent the **Enterprise service-oriented architecture** that was simplified to a **Modular Monolith** in v2.

**DO NOT DELETE** until:
- ✅ All tests pass with v2 implementation
- ✅ Database migrations complete successfully
- ✅ Production deployment is stable for at least 2 weeks
- ✅ Team is comfortable with v2 architecture

---

## Why These Files Were Archived

The v1 Enterprise architecture, while well-designed, was **over-engineered for current scale**:

| Metric | v1 (Enterprise) | v2 (Modular Monolith) | Issue |
|--------|----------------|----------------------|-------|
| Files | 12 | 7 | Too many files to navigate |
| LOC | ~3,600 | ~1,750 | Unnecessary complexity |
| Services | 6 classes | 0 classes | Premature abstraction |
| Decision Volume | ~10K/month | ~10K/month | Services not justified by scale |

**Decision:** Consolidate into Modular Monolith, preserving extraction points for future growth.

---

## Files in This Archive

### **Service Classes (archived, not deleted)**

1. **`PolicyLifecycleService.ts`** (443 LOC)
   - Lifecycle management (publish, deprecate, archive, activate)
   - **Merged into:** `PolicyRegistry.ts` as private methods
   - **Extract when:** Lifecycle logic exceeds 300 LOC OR workflow engine needed

2. **`PolicyGovernanceService.ts`** (341 LOC)
   - Governance validation and compliance checks
   - **Merged into:** `PolicyRegistry.ts` as private methods
   - **Extract when:** Governance rules exceed 300 LOC OR external policy engine needed

3. **`PolicyStatisticsService.ts`** (250 LOC)
   - Statistics tracking with atomic Postgres functions
   - **Merged into:** `PolicyRegistry.ts` as private methods
   - **Simplified:** No separate table, no Postgres functions (not needed at current scale)
   - **Extract when:** Decision volume exceeds 1M/month OR real-time aggregation needed

4. **`PolicyAuditService.ts`** (200 LOC)
   - Audit trail logging
   - **Replaced by:** `audit.ts` helper functions
   - **Reason:** Audit is infrastructure, not business logic - doesn't need service class

5. **`rbac.ts`** (335 LOC)
   - Complete RBAC permission framework
   - **Replaced by:** Wrapper methods in `PolicyRegistry.ts`
   - **Reason:** Should use existing AuthService, not build new framework

### **Supporting Files**

6. **`README.v1.md`**
   - Original documentation for Enterprise architecture
   - Preserved for reference

7. **`index.v1.ts`**
   - Original barrel export
   - Exported all 6 services individually

---

## Rollback Instructions

If you need to rollback to v1 Enterprise architecture:

### Step 1: Stop Using v2

```bash
# Archive v2 files
mv src/lib/decision-engine/registry/PolicyRegistry.ts \
   src/lib/decision-engine/registry/PolicyRegistry.v2.backup.ts

mv src/lib/decision-engine/registry/audit.ts \
   src/lib/decision-engine/registry/audit.v2.backup.ts
```

### Step 2: Restore Archived Files

```bash
# Restore v1 services
cp archive/PolicyLifecycleService.ts ../
cp archive/PolicyGovernanceService.ts ../
cp archive/PolicyStatisticsService.ts ../
cp archive/PolicyAuditService.ts ../
cp archive/rbac.ts ../

# Restore v1 documentation
cp archive/README.v1.md ../README.md
cp archive/index.v1.ts ../index.ts
```

### Step 3: Revert Database Migration

```sql
-- Recreate policy_statistics table
CREATE TABLE policy_statistics (
  policy_id TEXT NOT NULL,
  version TEXT NOT NULL,
  total_decisions INTEGER NOT NULL DEFAULT 0,
  total_approvals INTEGER NOT NULL DEFAULT 0,
  total_rejections INTEGER NOT NULL DEFAULT 0,
  confidence_sum NUMERIC(10, 2) NOT NULL DEFAULT 0,
  confidence_count INTEGER NOT NULL DEFAULT 0,
  last_decision_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (policy_id, version)
);

-- Migrate data back
INSERT INTO policy_statistics (
  policy_id, version, total_decisions, total_approvals, 
  total_rejections, last_decision_at
)
SELECT 
  policy_id, version, total_decisions, total_approvals,
  total_rejections, last_decision_at
FROM policy_registry
WHERE total_decisions > 0;

-- Remove statistics columns from policy_registry
ALTER TABLE policy_registry 
  DROP COLUMN IF EXISTS total_decisions,
  DROP COLUMN IF EXISTS total_approvals,
  DROP COLUMN IF EXISTS total_rejections,
  DROP COLUMN IF EXISTS avg_confidence,
  DROP COLUMN IF EXISTS last_decision_at;

-- Recreate Postgres functions
-- (see original migration files)
```

### Step 4: Update Imports

```typescript
// Change back to service imports
import { PolicyRegistry } from './PolicyRegistry';
import { PolicyLifecycleService } from './PolicyLifecycleService';
import { PolicyGovernanceService } from './PolicyGovernanceService';
import { PolicyStatisticsService } from './PolicyStatisticsService';
```

### Step 5: Run Tests

```bash
npm test src/lib/decision-engine/registry
```

---

## When to Delete This Archive

**Delete after all criteria met:**

1. ✅ **Stability:** Production running v2 for 2+ weeks without issues
2. ✅ **Confidence:** Team comfortable with v2 architecture
3. ✅ **No Rollback:** No concerns about reverting to v1
4. ✅ **Testing:** All tests pass consistently with v2
5. ✅ **Monitoring:** Metrics show v2 is performing well

**Command to delete:**
```bash
rm -rf src/lib/decision-engine/registry/archive/
git add .
git commit -m "cleanup: remove v1 enterprise architecture archive"
```

---

## Architecture Comparison

### v1 Enterprise (Archived)

```
PolicyRegistry (Thin Façade)
│
├── PolicyLifecycleService
├── PolicyGovernanceService
├── PolicyStatisticsService
├── PolicyAuditService
├── RBAC Module
└── PolicyRepository
```

**Pros:**
- Clear service boundaries
- Ready for microservices
- Easy to understand responsibilities

**Cons:**
- Over-engineered for current scale
- Too many files/abstractions
- Higher maintenance burden

### v2 Modular Monolith (Current)

```
PolicyRegistry (Façade + Logic)
│
├── Private: Lifecycle methods
├── Private: Governance methods
├── Private: Statistics methods
├── Audit utilities (audit.ts)
└── PolicyRepository
```

**Pros:**
- Right-sized for current scale
- Fewer files to navigate
- Easier to maintain
- Still extensible

**Cons:**
- Larger single file (but well-organized)
- Requires discipline to not over-grow

---

## Lessons Learned

1. **YAGNI (You Aren't Gonna Need It)** - Don't build abstractions before you need them
2. **Rule of Three** - Only extract services when justified by size, reuse, or lifecycle
3. **Stable APIs** - Public API stayed the same despite internal refactoring
4. **Reversibility** - Safe migration with rollback capability at each step
5. **Team Scale Matters** - 3-5 developers don't need 6 services

---

## References

- `ARCHITECTURE_COMPARISON.md` - Detailed comparison with metrics
- `MIGRATION_GUIDE.md` - Step-by-step migration instructions
- `README.md` - Current v2 documentation
- v1 Git History: `git log --before="2026-07-01" src/lib/decision-engine/registry/`

---

**Last Updated:** July 2026  
**Archive Retention:** Until production stable for 2+ weeks  
**Status:** ⏳ Pending deletion after stability confirmation
