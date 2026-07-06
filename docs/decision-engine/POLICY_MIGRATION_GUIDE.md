# Policy Migration Guide
**Policy Registry v2 - Migration from Code to Database**

This guide explains how to migrate existing legacy policies from code files to the PolicyRegistry v2 database.

---

## 📋 Overview

The Policy Registry v2 migration process converts legacy policy definitions (TypeScript files) into structured database records with full audit trails, versioning, and governance metadata.

### What Gets Migrated
- **Policy metadata**: ID, name, description, scope
- **Rules**: Conditions and actions with priorities
- **Governance**: Author, approver, effective dates
- **Audit trail**: Creation timestamp, migration source

### What Doesn't Get Migrated
- Code-specific logic (custom functions, complex conditions)
- External dependencies (imports, utilities)
- Comments and documentation (except inline rule descriptions)

---

## 🚀 Quick Start

### Prerequisites
1. Database tables must exist (`policy_registry`, `policy_history`)
2. Supabase credentials configured in `.env` or `.env.local`
3. `tsx` installed (dev dependency)

### Basic Workflow

```bash
# 1. Preview migration (dry-run mode - no database writes)
npm run policy:migrate:dry-run

# 2. Migrate to draft status (can be edited before publishing)
npm run policy:migrate

# 3. Verify migration
npm run policy:verify

# 4. If needed, rollback migration
npm run policy:rollback -- --confirm
```

---

## 📚 Detailed Commands

### 1. Dry-Run Migration (Preview Only)

```bash
npm run policy:migrate:dry-run
```

**What it does:**
- ✅ Reads legacy policy file
- ✅ Transforms to PolicyRegistry format
- ✅ Validates structure
- ✅ Prints preview to console
- ❌ **Does NOT write to database**

**Use when:**
- First time running migration
- Testing format transformations
- Reviewing before actual migration

**Example output:**
```
🔍 Dry-run mode: No database writes will be performed.

📋 Policy to migrate:
{
  "id": "leave-approval-v1",
  "name": "Leave Approval Policy",
  "description": "Automated leave request approval...",
  "scope": "booking",
  "governance": {
    "author": "system-migration",
    "effectiveDate": "2026-06-22T00:00:00.000Z"
  },
  "rules": [...]
}

✅ Dry-run complete. Policy structure validated.
```

---

### 2. Migrate to Draft

```bash
npm run policy:migrate
```

**What it does:**
- Reads legacy policy file
- Transforms to PolicyRegistry format
- Inserts into `policy_registry` with `status: 'draft'`
- Creates audit trail in `policy_history`
- **Does NOT auto-publish** (requires manual approval)

**Use when:**
- Ready to migrate but want to review in database first
- Need to edit/refine rules after migration
- Testing in staging environment

**Example output:**
```
📦 Migrating policy: leave-approval-v1

✅ Migration successful!
   - Policy ID: leave-approval-v1
   - Status: draft
   - Rules: 8
   - Database record created

💡 Next steps:
   1. Review policy in database: SELECT * FROM policy_registry WHERE id = 'leave-approval-v1';
   2. Publish when ready: UPDATE policy_registry SET status = 'published' WHERE id = 'leave-approval-v1';
```

---

### 3. Migrate and Auto-Publish

```bash
npm run policy:migrate:force
```

**What it does:**
- Reads legacy policy file
- Transforms to PolicyRegistry format
- Inserts into database with `status: 'published'`
- **Immediately activates policy** (no review needed)
- **Overwrites existing policy** if ID already exists

**Use when:**
- Migrating to production (after testing in staging)
- Re-migrating after policy updates
- Confident in policy structure

**⚠️ WARNING:** This command:
- Skips draft review process
- Overwrites existing policies without confirmation
- Immediately affects production decisions

**Example output:**
```
📦 Migrating policy: leave-approval-v1
🚨 Force mode: Policy will be auto-published and overwrite existing records.

✅ Migration successful!
   - Policy ID: leave-approval-v1
   - Status: published ← Active now!
   - Rules: 8
   - Existing policy overwritten

✅ Policy is now LIVE and will be used in decision evaluations.
```

---

### 4. Verify Migration

```bash
npm run policy:verify
```

**What it does:**
- Queries database for migrated policy
- Validates data integrity
- Checks audit trail
- Reports discrepancies

**Checks performed:**
1. Policy exists in `policy_registry`
2. Governance metadata present (author, effective date)
3. Rules count matches source
4. Audit trail recorded in `policy_history`
5. Status is valid (`draft` or `published`)

**Example output:**
```
🔍 Verifying migration for policy: leave-approval-v1

✅ Policy found in database
✅ Governance metadata present
   - Author: system-migration
   - Effective: 2026-06-22
✅ Rules count matches: 8 rules
✅ Audit trail recorded: 1 history entry
✅ Status: draft

🎉 Verification complete. Migration integrity confirmed.
```

---

### 5. Rollback Migration

```bash
npm run policy:rollback -- --confirm
```

**What it does:**
- Deletes policy from `policy_registry`
- Deletes audit trail from `policy_history`
- Prints summary of deletions
- **Requires `--confirm` flag** (safety measure)

**Use when:**
- Migration failed or produced incorrect data
- Need to re-migrate from scratch
- Testing rollback procedures

**⚠️ WARNING:** This is **DESTRUCTIVE** and cannot be undone!

**Example output:**
```
🗑️  Rolling back policy: leave-approval-v1
⚠️  This will DELETE the policy and its history. Continue? (--confirm flag required)

✅ Rollback complete!
   - Deleted from policy_registry: 1 record
   - Deleted from policy_history: 1 record

💡 You can now re-migrate if needed: npm run policy:migrate
```

---

## 📁 Legacy Policy File Structure

The migration scripts expect legacy policies to follow this structure:

```typescript
// src/lib/decision-engine/policies/leave-approval-policy.ts

import type { Policy, DecisionRule } from '../types';

export const leaveApprovalPolicy: Policy = {
  id: 'leave-approval-v1',
  name: 'Leave Approval Policy',
  description: 'Automated leave request approval based on advance notice',
  scope: 'booking' as const,
  effectiveDate: '2024-01-01',
  rules: [
    {
      id: 'advance-notice-24h',
      priority: 1,
      conditions: {
        type: 'operator',
        operator: 'and',
        conditions: [
          {
            type: 'comparison',
            field: 'hoursUntilLeave',
            operator: '>=',
            value: 24,
          },
        ],
      },
      action: {
        outcome: 'APPROVE',
        reason: 'Leave requested with ≥24h advance notice',
        metadata: {
          autoApproved: true,
          notificationRequired: true,
        },
      },
    },
    // ... more rules
  ],
};
```

### Required Fields
- `id`: Unique identifier (kebab-case, alphanumeric + hyphens)
- `name`: Human-readable name
- `description`: Purpose and context
- `scope`: Domain (`'booking'`, `'payment'`, `'leave'`, etc.)
- `rules`: Array of decision rules with conditions and actions

### Optional Fields
- `effectiveDate`: ISO date string (defaults to migration date)
- `expiryDate`: ISO date string (null = no expiry)
- `metadata`: Additional key-value data

---

## 🔧 Customizing Migration

### Migrating Multiple Policies

Create a batch migration script:

```bash
# scripts/migrate-all-policies.sh

npm run policy:migrate:dry-run -- --policy=leave-approval-policy
npm run policy:migrate:dry-run -- --policy=payment-approval-policy
npm run policy:migrate:dry-run -- --policy=booking-cancellation-policy

# After review:
npm run policy:migrate -- --policy=leave-approval-policy
npm run policy:migrate -- --policy=payment-approval-policy
npm run policy:migrate -- --policy=booking-cancellation-policy
```

### Adding Custom Metadata

Edit `scripts/migrate-policies-to-registry.ts`:

```typescript
const policyInput: Database['public']['Tables']['policy_registry']['Insert'] = {
  id: legacyPolicy.id,
  name: legacyPolicy.name,
  description: legacyPolicy.description,
  scope: legacyPolicy.scope,
  rules: legacyPolicy.rules,
  status: isDryRun ? 'draft' : (isForce ? 'published' : 'draft'),
  governance: {
    author: 'system-migration',
    approver: 'admin', // ← Add custom approver
    effectiveDate: new Date().toISOString(),
    reviewDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // ← Add review date (90 days)
  },
  metadata: {
    migrationSource: 'src/lib/decision-engine/policies/leave-approval-policy.ts',
    migrationDate: new Date().toISOString(),
    environment: process.env.NODE_ENV, // ← Add environment tracking
  },
};
```

---

## 🧪 Testing Migration

### Local Development

1. **Setup test database:**
   ```bash
   # Apply migrations to local Supabase
   npx supabase db reset
   npx supabase migration up
   ```

2. **Test dry-run:**
   ```bash
   npm run policy:migrate:dry-run
   ```

3. **Test actual migration:**
   ```bash
   npm run policy:migrate
   ```

4. **Verify in database:**
   ```bash
   npx supabase db psql
   ```
   ```sql
   SELECT id, name, status, created_at FROM policy_registry;
   SELECT policy_id, action, timestamp FROM policy_history;
   ```

5. **Test rollback:**
   ```bash
   npm run policy:rollback -- --confirm
   ```

### Staging Environment

1. **Set staging credentials:**
   ```bash
   export SUPABASE_URL="https://your-project.supabase.co"
   export SUPABASE_SECRET_KEY="your-secret-key"
   ```

2. **Run migration:**
   ```bash
   npm run policy:migrate
   ```

3. **Verify via API:**
   ```bash
   curl -X GET "https://your-project.supabase.co/rest/v1/policy_registry?id=eq.leave-approval-v1" \
     -H "apikey: your-anon-key" \
     -H "Authorization: Bearer your-secret-key"
   ```

### Production Deployment

**⚠️ CRITICAL: Test in staging first!**

1. **Backup database:**
   ```bash
   pg_dump -h db.your-project.supabase.co -U postgres -d postgres -t policy_registry -t policy_history > policy-backup.sql
   ```

2. **Apply migrations:**
   ```bash
   npx supabase db push
   ```

3. **Migrate policies:**
   ```bash
   npm run policy:migrate:force -- --policy=leave-approval-policy
   npm run policy:verify
   ```

4. **Monitor logs:**
   ```bash
   npx supabase logs --tail -f
   ```

---

## 🚨 Troubleshooting

### Error: "Table 'policy_registry' does not exist"

**Cause:** Database migrations not applied.

**Fix:**
```bash
# Local:
npx supabase db reset

# Production:
npx supabase db push
```

---

### Error: "Duplicate key value violates unique constraint"

**Cause:** Policy with same ID already exists in database.

**Fix:**
```bash
# Option 1: Use --force to overwrite
npm run policy:migrate:force

# Option 2: Rollback first, then migrate
npm run policy:rollback -- --confirm
npm run policy:migrate
```

---

### Error: "Invalid policy structure"

**Cause:** Legacy policy file doesn't match expected format.

**Fix:**
1. Run dry-run to see transformation output:
   ```bash
   npm run policy:migrate:dry-run
   ```

2. Check legacy policy structure matches expected format (see "Legacy Policy File Structure" above)

3. Fix missing required fields (`id`, `name`, `description`, `scope`, `rules`)

---

### Error: "Connection refused" / "Failed to connect to Supabase"

**Cause:** Invalid or missing Supabase credentials.

**Fix:**
1. Check `.env` or `.env.local`:
   ```bash
   cat .env | grep SUPABASE
   ```

2. Ensure variables are set:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SECRET_KEY=your-secret-key
   ```

3. Test connection:
   ```bash
   curl -X GET "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/" \
     -H "apikey: ${SUPABASE_SECRET_KEY}"
   ```

---

## 📊 Migration Checklist

### Pre-Migration
- [ ] Database migrations applied (`policy_registry`, `policy_history` tables exist)
- [ ] Supabase credentials configured in `.env`
- [ ] Legacy policy file exists and follows expected structure
- [ ] Run dry-run to preview transformation: `npm run policy:migrate:dry-run`
- [ ] Review dry-run output for correctness

### Migration
- [ ] Run migration: `npm run policy:migrate` (draft) or `npm run policy:migrate:force` (published)
- [ ] Check console output for success message
- [ ] Verify in database: `SELECT * FROM policy_registry WHERE id = 'your-policy-id';`
- [ ] Run verification script: `npm run policy:verify`

### Post-Migration
- [ ] If draft, review policy in database before publishing
- [ ] Test policy evaluation via PolicyRegistry API
- [ ] Monitor decision logs for correct policy application
- [ ] Document migration in changelog
- [ ] Update legacy policy file with deprecation notice (if removing)

### Rollback (if needed)
- [ ] Backup database first (if in production)
- [ ] Run rollback: `npm run policy:rollback -- --confirm`
- [ ] Verify deletion: `SELECT * FROM policy_registry WHERE id = 'your-policy-id';` (should return 0 rows)
- [ ] Fix issues in legacy policy file
- [ ] Re-migrate: `npm run policy:migrate`

---

## 🔗 Related Documentation

- **PolicyRegistry v2 API:** `docs/decision-engine/POLICY_REGISTRY_V2_API.md`
- **Phase B Plan:** `docs/decision-engine/PHASE_B_PLATFORM_FOUNDATION_PLAN.md`
- **Integration Tests:** `src/lib/decision-engine/registry/__tests__/README.md`
- **Database Schema:** `supabase/migrations/20260701000001_create_policy_registry.sql`

---

## 📝 Next Steps

After completing migration:

1. **Week 1 Day 12-13:** Documentation & Review
   - Update API documentation
   - Create user guides
   - Review migration process

2. **Week 1 Day 14:** Production Deployment
   - Apply database migrations to production
   - Run integration tests
   - Migrate all legacy policies

3. **Week 2:** Policy Builder UI & Advanced Features
   - Visual policy editor
   - Conflict detection
   - Performance monitoring

---

**Status:** Ready for use (after database deployment on Day 14)

**Last Updated:** June 22, 2026
