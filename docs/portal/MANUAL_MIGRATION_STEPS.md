# Manual Migration Steps - Partner Portal

**Date:** 2026-08-02  
**Migration File:** `supabase/migrations/20260802000000_real_estate_partner_portal.sql`  
**Status:** ⏳ Pending Application

---

## 🎯 Overview

This guide walks you through applying the Real Estate Partner Portal migration to your Supabase database when Docker/local Supabase is not available.

---

## 📋 Pre-requisites

- [ ] Supabase project access (Dashboard or CLI)
- [ ] Database connection credentials
- [ ] Migration file: `20260802000000_real_estate_partner_portal.sql`

---

## 🚀 Method 1: Supabase Dashboard (Recommended)

### Step 1: Open SQL Editor

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Click **SQL Editor** in left sidebar
4. Click **New Query**

### Step 2: Copy Migration SQL

```bash
# Copy the migration file content
cat supabase/migrations/20260802000000_real_estate_partner_portal.sql
```

### Step 3: Execute Migration

1. Paste the entire SQL content into the SQL Editor
2. Click **Run** button
3. Wait for execution (should take 2-5 seconds)
4. Verify success message appears

### Step 4: Verify Tables Created

Run this verification query:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'real_estate%' 
  OR table_name LIKE 're_%';
```

Expected output (6 tables):
- ✅ `real_estate_projects`
- ✅ `real_estate_products`
- ✅ `re_reservations`
- ✅ `re_commission_ledger`
- ✅ `re_documents`
- ✅ `re_partner_leads`

---

## 🔧 Method 2: Supabase CLI (If Docker Available)

### Step 1: Push Migration

```bash
# Option A: Include all pending migrations
supabase db push --include-all

# Option B: Apply only this migration (requires manual ordering)
supabase db push
```

### Step 2: Verify Applied

```bash
supabase migration list
```

Should show:
```
20260802000000_real_estate_partner_portal.sql ✓ Applied
```

---

## 🔧 Method 3: Direct Database Connection (Advanced)

### Step 1: Get Connection String

From Supabase Dashboard:
1. Go to **Settings** → **Database**
2. Copy **Connection String** (Postgres URI)
3. Replace `[YOUR-PASSWORD]` with actual password

Example:
```
postgresql://postgres:[YOUR-PASSWORD]@db.xxx.supabase.co:5432/postgres
```

### Step 2: Execute via psql

```bash
# Connect to database
psql "postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres"

# Execute migration
\i supabase/migrations/20260802000000_real_estate_partner_portal.sql

# Exit
\q
```

---

## ✅ Post-Migration Steps

### Step 1: Regenerate TypeScript Types

After migration is applied, regenerate types:

```bash
# Option A: From remote database
npx supabase gen types typescript --project-ref YOUR_PROJECT_REF --schema public > src/types/database.types.ts

# Option B: From local (if Docker running)
npx supabase gen types typescript --local --schema public > src/types/database.types.ts
```

### Step 2: Remove Temporary Types

1. Delete file: `src/types/real-estate-temp.types.ts`
2. Update imports in `src/services/partner-actions.ts`:

```typescript
// Remove these lines:
type RealEstateProduct = any;
type RealEstateReservation = any;
type CommissionLedger = any;
type RealEstateDocument = any;

// Replace with proper imports from database.types.ts
import type { Database } from '@/types/database.types';

type RealEstateProduct = Database['public']['Tables']['real_estate_products']['Row'];
type ReReservation = Database['public']['Tables']['re_reservations']['Row'];
// ... etc
```

### Step 3: Remove Type Assertions

Find and replace all `as any` in `partner-actions.ts`:

```typescript
// BEFORE (current):
.from('re_reservations' as any)

// AFTER (proper):
.from('re_reservations')
```

**Files to update:**
- `src/services/partner-actions.ts` (18 occurrences)

### Step 4: Verify Build

```bash
npm run build
```

Should complete with 0 errors.

---

## 🧪 Testing Checklist

After migration applied:

- [ ] Tables exist in database
- [ ] RLS policies are active
- [ ] RPC function `reserve_product` exists
- [ ] TypeScript types regenerated
- [ ] All `as any` removed
- [ ] Build passes with 0 errors
- [ ] Partner Portal pages load without errors

---

## 🔍 Verification Queries

### Check Tables Exist

```sql
SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables
WHERE schemaname = 'public'
  AND (tablename LIKE 'real_estate%' OR tablename LIKE 're_%')
ORDER BY tablename;
```

### Check RLS Policies

```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND (tablename LIKE 'real_estate%' OR tablename LIKE 're_%')
ORDER BY tablename, policyname;
```

### Check RPC Function

```sql
SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'reserve_product';
```

### Check ENUM Types

```sql
SELECT 
  t.typname AS enum_name,
  e.enumlabel AS enum_value
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname LIKE 're_%'
ORDER BY t.typname, e.enumsortorder;
```

---

## ⚠️ Troubleshooting

### Error: "relation already exists"

**Solution:** Tables may already exist. Check if migration was partially applied:

```sql
SELECT * FROM real_estate_projects LIMIT 1;
```

If table exists, migration was already applied. Skip to Post-Migration Steps.

### Error: "must be owner of table"

**Solution:** Make sure you're connected with the correct database role:

```sql
-- Check current role
SELECT current_user, session_user;

-- Should be 'postgres' or database owner
```

### Error: "function reserve_product already exists"

**Solution:** Drop existing function first:

```sql
DROP FUNCTION IF EXISTS public.reserve_product CASCADE;
```

Then re-run migration.

---

## 📞 Need Help?

**Common Issues:**
1. **Connection timeout** - Check firewall/VPN settings
2. **Permission denied** - Verify you're using postgres/admin user
3. **Syntax error** - Make sure entire SQL file was copied (603 lines)

**Resources:**
- [Supabase Migration Docs](https://supabase.com/docs/guides/cli/managing-environments#migrations)
- [PostgreSQL psql Guide](https://www.postgresql.org/docs/current/app-psql.html)

---

## 🎉 Success Indicators

After completing all steps, you should have:

✅ 6 new tables in Supabase  
✅ 6 ENUM types created  
✅ 24+ RLS policies active  
✅ 1 RPC function available  
✅ TypeScript types generated  
✅ Build passes with 0 errors  
✅ Partner Portal fully functional  

---

**Last Updated:** 2026-08-02  
**Migration Version:** 20260802000000
