# Manual Database Migration - Feature Flags Table

**Status:** ⚠️ Supabase CLI migration sync conflict  
**Solution:** Apply migration manually via SQL Editor

---

## ❌ Issue: Migration Sync Conflict

Supabase CLI detected migration history mismatch:
```
Remote migration versions not found in local migrations directory.
supabase migration repair --status reverted 20260807100039
```

**Root cause:** Production database has migrations that aren't in local `supabase/migrations/` folder.

---

## ✅ Solution: Manual SQL Execution

### Step 1: Open Supabase SQL Editor

1. Go to: https://supabase.com/dashboard/project/lvnvkpyxtuilhrabtlwv
2. Click **SQL Editor** in left sidebar
3. Click **+ New query**

### Step 2: Paste Migration SQL

Copy this entire SQL block and paste into SQL Editor:

```sql
-- ============================================================================
-- Feature Flags Platform - Database Migration
-- ============================================================================
-- Purpose: Create feature_flags table for Host Platform
-- Constitution: Law 9 (Zero Regression Guarantee)
-- Phase: Phase 0 (Week 1)
-- Date: 2026-08-07
-- ============================================================================

-- Create feature_flags table
CREATE TABLE IF NOT EXISTS feature_flags (
  -- Primary key
  key VARCHAR(255) PRIMARY KEY,
  
  -- Metadata
  name VARCHAR(255) NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  
  -- Rollout configuration
  rollout_strategy VARCHAR(50) NOT NULL DEFAULT 'off',
  rollout_config JSONB DEFAULT '{}'::jsonb,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled 
  ON feature_flags(enabled);

CREATE INDEX IF NOT EXISTS idx_feature_flags_rollout_strategy 
  ON feature_flags(rollout_strategy);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_feature_flags_updated_at 
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS (Row Level Security)
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- RLS Policy: All authenticated users can read feature flags
CREATE POLICY "Anyone can read feature flags"
  ON feature_flags
  FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policy: Only service_role can insert/update/delete
CREATE POLICY "Service role can manage feature flags"
  ON feature_flags
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON feature_flags TO authenticated;
GRANT ALL ON feature_flags TO service_role;

-- ============================================================================
-- Verification Query
-- ============================================================================
-- Run this after migration to verify table created:
-- SELECT table_name, column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'feature_flags'
-- ORDER BY ordinal_position;
-- ============================================================================
```

### Step 3: Click "RUN" Button

- Button location: Bottom right of SQL Editor
- Expected result: **Success. No rows returned.**

### Step 4: Verify Table Created

Run this verification query in a new SQL Editor tab:

```sql
-- Check table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'feature_flags';

-- Check columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'feature_flags'
ORDER BY ordinal_position;

-- Check indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'feature_flags';

-- Check RLS policies
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'feature_flags';
```

**Expected output:**
- ✅ Table: `feature_flags`
- ✅ Columns: 9 columns (key, name, description, enabled, rollout_strategy, rollout_config, metadata, created_at, updated_at)
- ✅ Indexes: 2 indexes (enabled, rollout_strategy)
- ✅ RLS Policies: 2 policies (read for authenticated, all for service_role)

---

## 🎯 Next Step: Insert Feature Flag Record

After table is created, insert the Phase 0 feature flag:

```sql
INSERT INTO feature_flags (
  key,
  name,
  description,
  enabled,
  rollout_strategy,
  rollout_config,
  metadata
) VALUES (
  'healthcare.new-engine-architecture',
  'Healthcare Platform-of-Platforms Architecture',
  'Phase 0: Bed, Nursing, Pharmacy engines with Contract Registry',
  true,  -- Enable immediately for pilot
  'manual',
  jsonb_build_object(
    'enabledTenants', 
    jsonb_build_array('YOUR_TEST_TENANT_ID')  -- ⚠️ REPLACE with actual tenant ID
  ),
  jsonb_build_object(
    'deployedAt', NOW(),
    'phase', 'Phase 0',
    'constitutionCompliance', '91/100',
    'engines', jsonb_build_array('BedEngine', 'NursingEngine', 'PharmacyEngine')
  )
)
ON CONFLICT (key) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  rollout_config = EXCLUDED.rollout_config,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();
```

**⚠️ Important:** Replace `'YOUR_TEST_TENANT_ID'` with actual tenant ID from your database:

```sql
-- Find a test tenant ID
SELECT id, name, email 
FROM tenants 
WHERE name ILIKE '%test%' OR name ILIKE '%dev%'
LIMIT 5;
```

---

## ✅ Verification Checklist

After running all SQL:

- [ ] `feature_flags` table exists
- [ ] Table has 9 columns with correct data types
- [ ] 2 indexes created (enabled, rollout_strategy)
- [ ] 2 RLS policies active
- [ ] Feature flag record inserted for `healthcare.new-engine-architecture`
- [ ] Feature flag `enabled = true`
- [ ] `rollout_config` contains test tenant ID

---

## 🔍 Troubleshooting

### Issue: "relation feature_flags already exists"
**Solution:** Table already created! Skip CREATE TABLE, run INSERT only.

### Issue: "duplicate key value violates unique constraint"
**Solution:** Feature flag already inserted! Run UPDATE instead:
```sql
UPDATE feature_flags
SET enabled = true,
    rollout_config = jsonb_build_object(
      'enabledTenants', 
      jsonb_build_array('YOUR_TEST_TENANT_ID')
    ),
    updated_at = NOW()
WHERE key = 'healthcare.new-engine-architecture';
```

### Issue: "permission denied for table feature_flags"
**Solution:** You're not logged in as service_role. Use SQL Editor with "Run as service_role" option (top right dropdown).

---

## 📊 Post-Migration Test

Test feature flag query from application:

```typescript
// In Next.js app, test this API route:
// GET /api/feature-flags?key=healthcare.new-engine-architecture

// Expected response:
{
  "key": "healthcare.new-engine-architecture",
  "enabled": true,
  "rollout_strategy": "manual",
  "rollout_config": {
    "enabledTenants": ["YOUR_TEST_TENANT_ID"]
  }
}
```

Or test via `curl`:
```bash
curl -X GET \
  "https://lvnvkpyxtuilhrabtlwv.supabase.co/rest/v1/feature_flags?key=eq.healthcare.new-engine-architecture" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

---

## 🎯 Success Criteria

✅ **Database migration complete when:**
1. `feature_flags` table exists in production
2. Feature flag record inserted with `enabled = true`
3. API query returns flag data successfully
4. No errors in application logs

**Next:** Proceed to smoke testing (see `QUICK_DEPLOY_COMMANDS.md`)

---

**File:** `supabase/migrations/20260807000001_create_feature_flags_table.sql`  
**Status:** ⚠️ Manual execution required  
**Reason:** Supabase CLI migration sync conflict  
**Alternative:** Apply via SQL Editor (this guide)
