# Rollback Procedures & Emergency Recovery

## Overview

Bella ERP rollback strategy: **Deploy fast, rollback faster**.

**Recovery Time Objective (RTO):** < 5 minutes  
**Recovery Point Objective (RPO):** < 1 minute (transaction loss acceptable)

## Rollback Decision Tree

```
                 Is production broken?
                         │
          ┌──────────────┴──────────────┐
          │                             │
     YES - ROLLBACK                 NO - Monitor
          │
   What's broken?
          │
   ┌──────┴──────┐
   │             │
Code Only    Database
   │             │
   ▼             ▼
Vercel      DB + Code
Instant     Rollback
Rollback    (Complex)
```

## Rollback Types

### Type 1: Vercel Instant Rollback (Code Only)

**When to use:**
- Application code bugs
- UI regressions
- API logic errors
- NO database schema changes

**Procedure:**

1. **Identify broken deployment:**
```bash
# Vercel Dashboard → Deployments → Production
# OR
vercel ls bella-spa-erp
```

2. **Instant rollback via Dashboard:**
- Navigate to **Vercel Dashboard → bella-spa-erp → Deployments**
- Find previous working deployment
- Click **"⋯"** → **"Promote to Production"**
- Confirm rollback
- **Done in 30 seconds** ✅

3. **Instant rollback via CLI:**
```bash
# List recent deployments
vercel ls bella-spa-erp

# Promote previous deployment to production
vercel promote <previous-deployment-url> --scope=bella-spa-erp

# Example:
# vercel promote bella-spa-erp-abc123.vercel.app --scope=bella-spa-s-projects
```

4. **Verify rollback:**
```bash
# Check health endpoint
curl https://bella-spa-erp.vercel.app/api/health

# Run smoke test
npm run e2e:auth-smoke
```

**Rollback Time:** **~1 minute**

### Type 2: Git Revert (Code + CI/CD)

**When to use:**
- Need to permanently remove bad code
- Multiple commits need reverting
- Team review before re-deploy

**Procedure:**

1. **Revert commit:**
```bash
# Revert single commit
git revert <commit-sha>

# Revert multiple commits
git revert <commit-sha-1> <commit-sha-2>

# Revert merge commit
git revert -m 1 <merge-commit-sha>
```

2. **Push to trigger re-deploy:**
```bash
git push origin main
```

3. **Wait for CI/CD:**
- GitHub Actions runs tests
- Auto-deploy to Vercel (if tests pass)
- **~5-10 minutes**

**Rollback Time:** **5-10 minutes**

### Type 3: Database Rollback (Complex)

**When to use:**
- Database migration caused issues
- Data integrity violations
- Schema changes broke queries

**⚠️ WARNING: Database rollbacks risk data loss!**

#### Option A: Forward Fix (Preferred)

**Create new migration to fix issue:**

```sql
-- supabase/migrations/20260618140000_fix_broken_migration.sql
BEGIN;

-- Fix the issue with new migration
ALTER TABLE customers
ALTER COLUMN phone TYPE VARCHAR(20); -- Fix incorrect type

-- Backfill any missing data
UPDATE customers
SET phone = '+84'
WHERE phone IS NULL;

COMMIT;
```

```bash
# Deploy fix migration
supabase db push --db-url $PRODUCTION_DATABASE_URL

# Deploy code fix
git push origin main
```

**Rollback Time:** **5-15 minutes**

#### Option B: Revert Migration (Data Loss Risk)

**1. Create rollback migration:**
```sql
-- supabase/migrations/20260618150000_rollback_add_phone.sql
BEGIN;

-- Reverse previous migration
DROP INDEX IF EXISTS idx_customers_phone;
ALTER TABLE customers DROP COLUMN phone;

COMMIT;
```

**2. Deploy rollback:**
```bash
supabase db push --db-url $PRODUCTION_DATABASE_URL
```

**3. Revert application code:**
```bash
git revert <migration-commit-sha>
git push origin main
```

**Rollback Time:** **10-20 minutes**

#### Option C: Restore from Backup (Last Resort)

**When to use:**
- Data corruption
- Catastrophic migration failure
- All other options failed

**Procedure:**

1. **Stop all writes:**
```bash
# Emergency: Put app in maintenance mode
# (Implement maintenance mode feature first)
```

2. **Restore from Supabase backup:**
```bash
# Supabase Dashboard → Database → Backups
# Select backup timestamp (before bad migration)
# Click "Restore" → Confirm

# Restoration takes ~5-30 minutes depending on DB size
```

3. **Verify restoration:**
```bash
# Check database version
supabase db version

# Run data integrity check
psql $DATABASE_URL -c "SELECT COUNT(*) FROM tenants;"
```

4. **Replay lost transactions (if applicable):**
```sql
-- Check accounting outbox for pending entries
SELECT * FROM pending_accounting_entries
WHERE created_at > '2026-06-18 12:00:00'
  AND status = 'pending';

-- Re-process manually or via worker
```

5. **Take app out of maintenance mode**

**Rollback Time:** **30-60 minutes** (includes data loss)

### Type 4: Emergency Hotfix

**When to use:**
- Critical production bug
- Security vulnerability
- Data corruption in progress

**Procedure:**

1. **Create hotfix branch:**
```bash
git checkout -b hotfix/critical-bug main
```

2. **Make minimal fix:**
```typescript
// Fix only the critical issue
// No refactoring, no feature additions
```

3. **Fast-track testing:**
```bash
# Run critical tests only
npm run test:critical

# Manual smoke test
npm run dev # Test locally
```

4. **Deploy directly to production:**
```bash
git push origin hotfix/critical-bug

# Manually trigger production deploy
# OR use GitHub Actions workflow_dispatch
```

5. **Merge back to main:**
```bash
git checkout main
git merge hotfix/critical-bug
git push origin main
```

**Rollback Time:** **5-15 minutes**

## Rollback Runbook

### Production Incident Response

**Step 1: Detect Issue (Auto or Manual)**

**Auto-detection:**
- Sentry error spike alert
- Health check failures
- Monitoring dashboard anomaly

**Manual detection:**
- User reports
- Customer support tickets
- Team member noticed bug

**Step 2: Assess Severity**

**Severity Levels:**

| Level | Description | Response Time | Rollback? |
|-------|-------------|---------------|-----------|
| **P0 - Critical** | Data loss, auth broken, payments failing | **Immediate** | **YES** |
| **P1 - High** | Major feature broken, performance degradation | **< 15 min** | **YES** |
| **P2 - Medium** | Minor feature broken, UI glitch | **< 1 hour** | **Maybe** |
| **P3 - Low** | Cosmetic issue, typo | **< 1 day** | **NO** |

**Step 3: Make Rollback Decision**

**Rollback if:**
- ✅ Severity P0 or P1
- ✅ Bug affecting > 10% of users
- ✅ Data integrity at risk
- ✅ No quick forward fix available

**Don't rollback if:**
- ❌ Severity P2 or P3
- ❌ Issue affects < 1% of users
- ❌ Quick forward fix available (< 10 minutes)
- ❌ Rollback would cause more issues than current bug

**Step 4: Execute Rollback**

Follow appropriate rollback type procedure (see above).

**Step 5: Post-Rollback Verification**

```bash
# 1. Health check
curl https://bella-spa-erp.vercel.app/api/health

# 2. Smoke tests
npm run e2e:auth-smoke

# 3. Manual verification
# - Login works
# - Create booking works
# - Payment works
# - Dashboard loads

# 4. Monitor for 15 minutes
# - Check Sentry for errors
# - Check Vercel analytics for traffic
# - Check user reports
```

**Step 6: Post-Mortem**

After incident resolved, create post-mortem document:

**Template:** `docs/incidents/YYYY-MM-DD-incident-name.md`

```markdown
# Incident Post-Mortem: [Title]

**Date:** 2026-06-18  
**Duration:** 12:00 PM - 12:15 PM (15 minutes)  
**Severity:** P1  
**Impact:** 50 users affected, 3 failed payments  

## Timeline

- 12:00 PM: Deployment v1.2.3 to production
- 12:05 PM: Sentry alerts - payment errors spiking
- 12:07 PM: Team investigates, identifies bug in payment webhook
- 12:10 PM: Decision made to rollback
- 12:12 PM: Vercel instant rollback executed
- 12:15 PM: Production stable, payment errors resolved

## Root Cause

Deployed code had a typo in webhook HMAC signature validation...

## Action Items

- [ ] Add integration test for webhook signatures
- [ ] Add pre-deployment webhook smoke test
- [ ] Update payment error monitoring thresholds

## Lessons Learned

- Webhook changes need extra scrutiny
- Rollback decision was made quickly (good)
- Need better staging environment test coverage
```

## Rollback Scripts

### Automated Rollback Script

The canonical implementation is scripts/emergency-rollback.sh. It validates Ready state and project ownership through Vercel before every dry-run or promotion. It will not promote unless --execute is supplied and the operator types the exact verified target URL.

    # Offline dry-run against a known Ready deployment
    ./scripts/emergency-rollback.sh "payment-webhook-broken" --target https://known-ready-deployment.vercel.app

    # Re-run only after reviewing the target
    ./scripts/emergency-rollback.sh "payment-webhook-broken" --target https://known-ready-deployment.vercel.app       --execute

When --target is omitted, the script queries project bella-spa-erp in scope bella-spa-s-projects and selects the previous Ready production deployment. VERCEL_TOKEN and jq are required. Override defaults with VERCEL_PROJECT_NAME, VERCEL_SCOPE, and PRODUCTION_BASE_URL.
### Database Rollback Script

**`scripts/rollback-migration.sh`:**
```bash
#!/bin/bash
# Database Migration Rollback Script
# Usage: ./scripts/rollback-migration.sh <migration-file>

set -e

MIGRATION_FILE=$1

if [ -z "$MIGRATION_FILE" ]; then
  echo "Usage: ./scripts/rollback-migration.sh <migration-file>"
  exit 1
fi

echo "🗃️  DATABASE ROLLBACK INITIATED"
echo "Migration: $MIGRATION_FILE"
echo ""

# Create backup first
echo "📦 Creating backup snapshot..."
echo "Go to Supabase Dashboard → Database → Backups → Create Backup"
echo "Press ENTER when backup complete..."
read -r

# Show rollback SQL
echo "📄 Rollback SQL:"
grep -A 20 "ROLLBACK PROCEDURE" "supabase/migrations/$MIGRATION_FILE" || echo "⚠️  No rollback procedure documented!"
echo ""

echo "⚠️  This will modify production database!"
echo "Type 'ROLLBACK' to confirm:"
read -r confirmation

if [ "$confirmation" != "ROLLBACK" ]; then
  echo "❌ Rollback cancelled"
  exit 1
fi

# Execute rollback migration
echo "⏳ Executing rollback..."
psql "$PRODUCTION_DATABASE_URL" -f "supabase/migrations/rollback_$MIGRATION_FILE"

echo "✅ Database rollback complete"
echo ""
echo "Next steps:"
echo "1. Verify database schema"
echo "2. Run data integrity checks"
echo "3. Rollback application code if needed"
```

## Testing Rollback Procedures

### Chaos Engineering (Staging)

Test rollback procedures regularly:

**Monthly Rollback Drill:**
```bash
# 1. Deploy to staging
npm run deploy:staging

# 2. Immediately rollback
./scripts/emergency-rollback.sh "rollback-drill"

# 3. Verify rollback worked
npm run test:e2e:staging

# 4. Document timing and issues
```

### Rollback Simulation Checklist

- [ ] Vercel instant rollback (< 2 minutes)
- [ ] Git revert rollback (< 10 minutes)
- [ ] Database migration rollback (< 20 minutes)
- [ ] Backup restoration (< 60 minutes)
- [ ] Team notification working
- [ ] Health checks passing
- [ ] Smoke tests passing

## Prevention > Rollback

### Reduce Need for Rollbacks

1. **Comprehensive Testing**
   - 846 automated tests
   - E2E smoke tests before production
   - Load testing for performance regressions

2. **Staged Rollouts**
   - Deploy to staging first
   - Canary deployments (1% traffic → 100%)
   - Feature flags for risky changes

3. **Monitoring & Alerts**
   - Sentry error tracking
   - Performance monitoring
   - Custom business metrics

4. **Code Review**
   - Require 1+ approvals
   - Security scan before merge
   - Database changes reviewed by senior dev

## Emergency Contacts

**Incident Response Team:**

| Role | Name | Contact | Availability |
|------|------|---------|--------------|
| **On-Call Engineer** | [Name] | [Phone] | 24/7 |
| **Database Admin** | [Name] | [Phone] | Business hours |
| **DevOps Lead** | [Name] | [Phone] | Business hours |
| **CTO** | [Name] | [Phone] | Escalation only |

**Escalation Path:**
1. On-Call Engineer (immediate)
2. DevOps Lead (if > 30 min)
3. CTO (if > 1 hour or data loss)

## References

- [Vercel Rollback Docs](https://vercel.com/docs/deployments/rollbacks)
- [Supabase Backup Docs](https://supabase.com/docs/guides/platform/backups)
- [Incident Response Guide](https://response.pagerduty.com/)
