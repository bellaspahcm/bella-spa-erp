# Migration Guide: Enterprise → Modular Monolith

This guide provides step-by-step instructions for migrating from the Enterprise architecture (v1) to the Modular Monolith architecture (v2).

---

## Overview

**Goal:** Simplify codebase while preserving architectural boundaries and maintaining stable public API.

**Approach:** Safe, incremental migration with rollback capability at each step.

**Timeline:** 2-4 hours

---

## Pre-Migration Checklist

Before starting migration, ensure:

- [ ] All existing tests pass
- [ ] You have a clean git state (no uncommitted changes)
- [ ] You have reviewed the ARCHITECTURE_COMPARISON.md document
- [ ] You understand the differences between v1 and v2
- [ ] You have database backup (if running migrations)

---

## Phase 1: Preparation (15 minutes)

### Step 1.1: Create Git Branch

```bash
git checkout -b refactor/policy-registry-modular-monolith
git add .
git commit -m "checkpoint: before policy registry refactoring"
```

### Step 1.2: Archive Old Files

Create archive directory:

```bash
mkdir -p src/lib/decision-engine/registry/archive
```

Move (don't delete) old service files:

```bash
# Archive service files
mv src/lib/decision-engine/registry/PolicyLifecycleService.ts \
   src/lib/decision-engine/registry/archive/

mv src/lib/decision-engine/registry/PolicyGovernanceService.ts \
   src/lib/decision-engine/registry/archive/

mv src/lib/decision-engine/registry/PolicyStatisticsService.ts \
   src/lib/decision-engine/registry/archive/

mv src/lib/decision-engine/registry/PolicyAuditService.ts \
   src/lib/decision-engine/registry/archive/

mv src/lib/decision-engine/registry/rbac.ts \
   src/lib/decision-engine/registry/archive/

# Archive old README and index
mv src/lib/decision-engine/registry/README.md \
   src/lib/decision-engine/registry/archive/README.v1.md

mv src/lib/decision-engine/registry/index.ts \
   src/lib/decision-engine/registry/archive/index.v1.ts
```

Create archive README:

```bash
cat > src/lib/decision-engine/registry/archive/README.md << 'EOF'
# Archived Files - Enterprise Architecture (v1)

These files are archived but not deleted to preserve rollback capability.

**DO NOT DELETE** until:
- All tests pass with v2 implementation
- Database migrations complete successfully
- Production deployment is stable for at least 1 week

## Rollback Instructions

If you need to rollback to v1:

1. Stop using v2 files (PolicyRegistry.ts, audit.ts)
2. Restore archived files from this directory
3. Revert database migrations
4. Run tests to verify

## Files in This Archive

- PolicyLifecycleService.ts - Lifecycle management service
- PolicyGovernanceService.ts - Governance validation service
- PolicyStatisticsService.ts - Statistics tracking service
- PolicyAuditService.ts - Audit trail service
- rbac.ts - Permission checking framework
- README.v1.md - Original README
- index.v1.ts - Original barrel export

## When to Delete

Delete this archive after:
- 2+ weeks of stable production operation with v2
- All team members familiar with v2 architecture
- No rollback concerns
EOF
```

### Step 1.3: Commit Archive

```bash
git add src/lib/decision-engine/registry/archive
git commit -m "archive: move v1 enterprise files to archive/"
```

---

## Phase 2: Activate v2 Implementation (20 minutes)

### Step 2.1: Rename v2 Files to Active

```bash
# Activate v2 implementation
mv src/lib/decision-engine/registry/PolicyRegistry.v2.ts \
   src/lib/decision-engine/registry/PolicyRegistry.ts

mv src/lib/decision-engine/registry/README.v2.md \
   src/lib/decision-engine/registry/README.md

mv src/lib/decision-engine/registry/index.v2.ts \
   src/lib/decision-engine/registry/index.ts
```

### Step 2.2: Create audit.ts from AuditService

The `audit.ts` file should already exist. If not, create it:

```bash
# audit.ts should already be created
# If not, copy from v2 implementation
```

### Step 2.3: Update Imports

Search for any imports of archived services:

```bash
# Search for old imports
grep -r "from './PolicyLifecycleService'" src/
grep -r "from './PolicyGovernanceService'" src/
grep -r "from './PolicyStatisticsService'" src/
grep -r "from './PolicyAuditService'" src/
grep -r "from './rbac'" src/lib/decision-engine/
```

Replace with new imports:

```typescript
// OLD
import { PolicyLifecycleService } from './PolicyLifecycleService';
import { PolicyAuditService } from './PolicyAuditService';

// NEW - Everything through PolicyRegistry
import { PolicyRegistry } from './PolicyRegistry';
```

### Step 2.4: Commit Changes

```bash
git add .
git commit -m "refactor: activate v2 modular monolith implementation"
```

---

## Phase 3: Database Migration (30 minutes)

### Step 3.1: Review Migrations

Review the migration files:

```bash
cat supabase/migrations/20260701000005_simplify_statistics.sql
```

This migration:
- Adds statistics columns to `policy_registry` table
- Migrates data from `policy_statistics` table (if exists)
- Drops old `policy_statistics` table
- Drops old Postgres functions

### Step 3.2: Backup Database

```bash
# Create backup before migration
pg_dump bella_erp > backup_before_policy_registry_v2_$(date +%Y%m%d_%H%M%S).sql
```

Or via Supabase dashboard:
1. Go to Database → Backups
2. Create manual backup
3. Note the backup ID

### Step 3.3: Run Migration (Local First)

```bash
# Local/staging environment first
supabase db push

# Verify migration succeeded
supabase db diff
```

### Step 3.4: Verify Data Migration

```sql
-- Check that statistics were migrated
SELECT 
  policy_id,
  version,
  total_decisions,
  total_approvals,
  total_rejections,
  avg_confidence,
  last_decision_at
FROM policy_registry
WHERE total_decisions > 0;

-- Verify policy_statistics table is dropped
SELECT EXISTS (
  SELECT FROM pg_tables 
  WHERE schemaname = 'public' 
  AND tablename = 'policy_statistics'
);
-- Should return false
```

### Step 3.5: Commit Migration Checkpoint

```bash
git add .
git commit -m "migration: database schema updated to v2"
```

---

## Phase 4: Testing (45 minutes)

### Step 4.1: Run Unit Tests

```bash
# Run all registry tests
npm test src/lib/decision-engine/registry

# Expected: All tests should pass or be skipped (if not yet written)
```

### Step 4.2: Run Integration Tests

```bash
# Run integration tests
npm test -- --grep "Policy Registry Integration"

# Test specific workflows
npm test -- --grep "register.*publish.*deprecate"
```

### Step 4.3: Manual Testing

Test the core workflows manually:

```typescript
// Test 1: Register a policy
const policy = await PolicyRegistry.register({
  policy: {
    id: 'test-policy',
    version: '1.0.0',
    name: 'Test Policy',
    rules: [],
  },
  businessOwner: 'Test Owner',
  businessOwnerEmail: 'test@example.com',
  technicalOwner: 'Dev',
  technicalOwnerEmail: 'dev@example.com',
  ownerDepartment: 'IT',
  effectiveDate: '2026-01-01',
}, userId);

// Test 2: Publish policy
await PolicyRegistry.publish('test-policy', '1.0.0', userId, 'Initial release');

// Test 3: Record decision
await PolicyRegistry.recordDecision('test-policy', '1.0.0', 'approve', 0.95);

// Test 4: Get statistics
const stats = await PolicyRegistry.getStatistics('test-policy', '1.0.0');
console.log('Stats:', stats);

// Test 5: Get audit history
const history = await PolicyRegistry.getHistory('test-policy', '1.0.0');
console.log('History:', history);
```

### Step 4.4: Commit Test Results

```bash
git add .
git commit -m "test: verify v2 implementation works correctly"
```

---

## Phase 5: Production Deployment (30 minutes)

### Step 5.1: Code Review

Before deploying, ensure:
- [ ] Code review completed
- [ ] All tests pass
- [ ] Database migration tested in staging
- [ ] Team is aware of the changes

### Step 5.2: Deploy to Staging

```bash
# Merge to staging branch
git checkout staging
git merge refactor/policy-registry-modular-monolith

# Deploy to staging environment
# (deployment process varies by setup)
```

### Step 5.3: Verify Staging

- [ ] Application starts without errors
- [ ] Policy registry operations work
- [ ] Audit trail is logging correctly
- [ ] Statistics are updating
- [ ] No performance regressions

### Step 5.4: Deploy to Production

```bash
# Merge to main
git checkout main
git merge refactor/policy-registry-modular-monolith

# Tag release
git tag -a v2.0.0-policy-registry -m "Policy Registry v2: Modular Monolith"
git push origin main --tags

# Deploy to production
# (deployment process varies by setup)
```

### Step 5.5: Monitor Production

Monitor for 24-48 hours:
- [ ] Error rates (should not increase)
- [ ] Response times (should be similar or better)
- [ ] Database query performance
- [ ] Audit log completeness

---

## Phase 6: Cleanup (After 2 Weeks Stable) (15 minutes)

**ONLY AFTER** production is stable for 2+ weeks:

### Step 6.1: Delete Archive

```bash
# Remove archived files
rm -rf src/lib/decision-engine/registry/archive/

git add .
git commit -m "cleanup: remove archived v1 files after successful migration"
```

### Step 6.2: Update Documentation

- [ ] Update team wiki/docs with new architecture
- [ ] Update onboarding materials
- [ ] Archive old architecture diagrams

---

## Rollback Procedures

### If Issues Found in Testing (Before Production)

```bash
# Revert commits
git reset --hard HEAD~N  # N = number of commits to revert

# Restore archived files
mv src/lib/decision-engine/registry/archive/*.ts \
   src/lib/decision-engine/registry/

# Revert database migration
supabase db reset
```

### If Issues Found in Staging

```bash
# Revert staging deployment
git checkout staging
git revert <commit-hash>

# Restore database from backup
# (process varies by hosting)
```

### If Issues Found in Production

**Emergency Rollback:**

1. **Code Rollback:**
```bash
git revert <migration-commit>
git push origin main
# Deploy previous version
```

2. **Database Rollback:**
```sql
-- Recreate policy_statistics table
CREATE TABLE policy_statistics (...);

-- Migrate data back
INSERT INTO policy_statistics (...)
SELECT ... FROM policy_registry;

-- Remove statistics columns from policy_registry
ALTER TABLE policy_registry 
  DROP COLUMN total_decisions,
  DROP COLUMN total_approvals,
  DROP COLUMN total_rejections,
  DROP COLUMN avg_confidence,
  DROP COLUMN last_decision_at;
```

3. **Restore Archived Files:**
```bash
cp -r backup/archive/* src/lib/decision-engine/registry/
git add .
git commit -m "rollback: restore v1 enterprise architecture"
```

---

## Post-Migration Checklist

- [ ] All tests pass in production
- [ ] No error rate increase
- [ ] Audit logs are complete
- [ ] Statistics are accurate
- [ ] Team is trained on new structure
- [ ] Documentation updated
- [ ] Monitoring dashboards updated
- [ ] Archive directory can be deleted (after 2 weeks stable)

---

## Common Issues & Solutions

### Issue: Import Errors

**Symptom:** `Cannot find module './PolicyLifecycleService'`

**Solution:**
```typescript
// Change imports from services to PolicyRegistry
import { PolicyRegistry } from '@/lib/decision-engine/registry';
```

### Issue: Statistics Not Updating

**Symptom:** `total_decisions` stays at 0

**Solution:**
- Check that migration added statistics columns
- Verify `recordDecision()` is being called
- Check for errors in `updateStatistics()` method

### Issue: Audit Trail Missing Entries

**Symptom:** `policy_history` table has gaps

**Solution:**
- Verify `writeAudit()` is being called in all lifecycle methods
- Check for errors in audit logging
- Ensure `policy_history` table exists

### Issue: Permission Errors

**Symptom:** All operations return 403 Forbidden

**Solution:**
- Implement `requirePermission()` wrapper in PolicyRegistry
- Integrate with existing AuthService
- Update RLS policies on database tables

---

## Success Metrics

After migration, you should see:

- ✅ **-52% less code** (~1,750 LOC vs ~3,600 LOC)
- ✅ **-42% fewer files** (7 files vs 12 files)
- ✅ **Same or better performance** (fewer objects, simpler call stack)
- ✅ **Same public API** (no breaking changes for consumers)
- ✅ **Easier maintenance** (fewer files to navigate)
- ✅ **Clear extension points** (easy to extract services later)

---

## Next Steps After Migration

1. **Monitor for 2 weeks** - Watch error rates, performance, audit completeness
2. **Team training** - Ensure all developers understand new structure
3. **Update documentation** - Reflect new architecture in team docs
4. **Plan future extractions** - Identify which modules might need extraction first
5. **Delete archive** - After confirming stability, remove archived files

---

## Questions?

If you encounter issues not covered in this guide:

1. Check `ARCHITECTURE_COMPARISON.md` for design rationale
2. Review `README.md` for usage examples
3. Check git history for context: `git log --oneline src/lib/decision-engine/registry/`
4. Consult with team lead

---

**Remember:** This migration is **safe and reversible** at every step. Take your time, test thoroughly, and don't delete the archive until production is stable.
