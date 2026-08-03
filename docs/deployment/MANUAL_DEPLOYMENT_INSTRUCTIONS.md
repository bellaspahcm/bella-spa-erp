# Manual Deployment Instructions - Real Estate Module

## ❌ Supabase CLI Deployment Failed

**Error:** Conflicting migrations from 20260622 already exist in remote database

**Solution:** Manual deployment via Supabase SQL Editor

---

## ✅ Manual Deployment Steps (10-15 minutes)

### Step 1: Open Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/lvnvkpyxtuilhrabtlwv
2. Click **SQL Editor** in left sidebar

---

### Step 2: Deploy Core Schema

1. In SQL Editor, create **New Query**
2. Copy entire content from: `supabase/migrations/20260802150000_real_estate_core_schema.sql`
3. **Remove lines with `\echo` and `\i` commands** (psql-specific, not supported)
4. Click **Run** (Ctrl+Enter)
5. ✅ Verify: No errors, ~9 tables created

**Expected output:**
```
CREATE EXTENSION
CREATE TYPE (5 times - enums)
CREATE TABLE (9 times - tables)
CREATE INDEX (multiple times)
CREATE POLICY (9 times - RLS)
```

---

### Step 3: Deploy RPC Functions

1. Create **New Query**
2. Copy entire content from: `supabase/migrations/20260802151000_real_estate_rpc_functions.sql`
3. **Remove lines with `\echo` commands**
4. Click **Run**
5. ✅ Verify: No errors, ~9 functions created

**Expected output:**
```
CREATE FUNCTION (9 times)
```

---

### Step 4: Verify Deployment

Run this verification query:

```sql
-- Check tables exist
SELECT 
  table_name,
  'OK' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'real_estate_properties',
    'real_estate_units', 
    'real_estate_leads',
    'real_estate_bookings',
    'real_estate_contracts',
    'real_estate_payment_schedules',
    'real_estate_transactions',
    'real_estate_developer_partners',
    'real_estate_partner_commissions'
  )
ORDER BY table_name;

-- Should return 9 rows
```

```sql
-- Check RPCs exist  
SELECT 
  routine_name as rpc_name,
  'OK' as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE 'rpc_real_estate%'
ORDER BY routine_name;

-- Should return 9 rows
```

---

### Step 5: Mark Migrations as Applied (Optional)

Update migration history to avoid future conflicts:

```sql
-- Mark Real Estate migrations as applied
INSERT INTO supabase_migrations.schema_migrations (version, name, inserted_at)
VALUES 
  ('20260802150000', 'real_estate_core_schema', NOW()),
  ('20260802151000', 'real_estate_rpc_functions', NOW())
ON CONFLICT (version) DO NOTHING;
```

---

### Step 6: Seed Demo Data (Optional)

If you want demo data for testing:

1. Create **New Query**
2. Copy content from: `scripts/seed-real-estate-demo.sql`
3. Click **Run**
4. ✅ Verify: 3 properties, 10 units, 5 leads created

---

### Step 7: Test Application

```bash
# Update environment variables (if needed)
# Edit .env.local with Supabase credentials

# Start dev server
npm run dev

# Open browser
http://localhost:3000/dashboard/real-estate
```

---

## 🔍 Troubleshooting

### Error: "relation already exists"

**Solution:** Objects already deployed, safe to ignore OR drop and recreate:

```sql
-- Drop table (careful!)
DROP TABLE IF EXISTS real_estate_properties CASCADE;

-- Then re-run migration
```

### Error: "type already exists"

**Solution:** Enums already exist, safe to ignore

### Error: "RLS policy already exists"

**Solution:** Policies already exist, safe to ignore

---

## 📊 Deployment Checklist

- [ ] Step 1: Open Supabase Dashboard
- [ ] Step 2: Deploy core schema (20260802150000)
- [ ] Step 3: Deploy RPC functions (20260802151000)
- [ ] Step 4: Run verification queries (9 tables, 9 RPCs)
- [ ] Step 5: Mark migrations as applied
- [ ] Step 6: (Optional) Seed demo data
- [ ] Step 7: Test application locally

---

## ⏱️ Expected Time

- **Core deployment:** 5 minutes
- **Verification:** 2 minutes  
- **Demo data:** 3 minutes
- **Total:** 10-15 minutes

---

## 📝 Notes

**Why manual deployment?**
- Supabase CLI detected migration conflicts (20260622)
- CLI tried to re-apply already-applied migrations
- Manual deployment gives fine-grained control

**Migration files:**
- ✅ `20260802150000_real_estate_core_schema.sql` (9 tables, 5 enums, 9 RLS)
- ✅ `20260802151000_real_estate_rpc_functions.sql` (9 RPCs)
- ✅ `scripts/seed-real-estate-demo.sql` (optional demo data)

**Next phase:**
- After deployment complete → Test UI
- After testing complete → Production pilot with 1-2 real partners
- After pilot successful → Full rollout

---

## 🆘 Need Help?

If you encounter issues:
1. Check error message in SQL Editor
2. Look for "already exists" → safe to ignore
3. Look for syntax errors → check migration file format
4. Contact dev team with screenshot of error
