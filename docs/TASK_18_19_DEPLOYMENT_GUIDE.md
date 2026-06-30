# Tasks 18-19 Deployment Guide: Position Tier & Hire Date

**Date:** 2026-06-30  
**Status:** Ready for deployment  
**Estimated Time:** 15 minutes  

---

## Prerequisites

- ✅ Build passed (77/77 pages, 0 errors)
- ✅ Migration script created: `20260630192732_add_position_tier_hire_date_to_users.sql`
- ✅ Manual SQL script created: `scripts/manual-add-position-tier-hire-date.sql`
- ✅ Testing checklist ready: `docs/TASK_18_19_TESTING_CHECKLIST.md`

---

## Deployment Steps (Production)

### Step 1: Backup Database (CRITICAL)

**Option A: Supabase Dashboard**
1. Open Supabase Dashboard
2. Navigate to **Settings** > **Database**
3. Click **"Backup now"** button
4. Wait for backup completion
5. Download backup file (optional, for local copy)

**Option B: Command Line** (if you have database access)
```bash
pg_dump $SUPABASE_DB_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

**⚠️ DO NOT PROCEED without backup!**

---

### Step 2: Apply Migration (Choose One Method)

#### Method A: Manual SQL (RECOMMENDED - Safer)

1. **Open Supabase Dashboard**
   - Navigate to **SQL Editor**

2. **Paste SQL Script**
   - Open file: `scripts/manual-add-position-tier-hire-date.sql`
   - Copy entire content
   - Paste into SQL Editor

3. **Run Script**
   - Click **"Run"** button
   - Wait for completion

4. **Verify Success Messages**
   ```
   ✓ Added position_tier column
   ✓ Added hire_date column
   ✓ Added column comments
   ✓ Created index idx_users_position_tier
   ✓ Created index idx_users_hire_date
   ✅ Migration completed successfully!
   ```

5. **Check Verification Queries**
   - Should see 2 columns in output:
     - `hire_date` (date)
     - `position_tier` (text)

---

#### Method B: Supabase CLI Push (Advanced)

**⚠️ WARNING:** This will try to apply ALL pending migrations (16 total).  
Some migrations may fail due to missing tables (`user_profiles`).

Only use if you're confident about migration order.

```bash
# Dry run (see what will be applied)
supabase migration list

# Apply all pending migrations
supabase db push
# When prompted: Type "Y" and press Enter

# If fails, use Method A instead
```

---

### Step 3: Verify Migration Applied

**Run verification query in SQL Editor:**

```sql
-- Check columns exist
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name IN ('position_tier', 'hire_date')
ORDER BY column_name;

-- Expected output:
-- column_name   | data_type | is_nullable | column_default
-- --------------|-----------|-------------|---------------
-- hire_date     | date      | YES         | NULL
-- position_tier | text      | YES         | NULL
```

**Check indexes:**

```sql
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'users'
  AND (indexname LIKE '%position%' OR indexname LIKE '%hire%');

-- Expected output: 2 indexes
-- idx_users_position_tier
-- idx_users_hire_date
```

**✅ If both queries return expected results, migration is successful!**

---

### Step 4: Regenerate Database Types

**Local machine:**

```bash
# Generate types from production database
supabase gen types typescript --linked --schema public > src/types/database.types.ts

# Verify new columns are in types
# Open src/types/database.types.ts and search for "position_tier" and "hire_date"
```

**Expected in database.types.ts:**

```typescript
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          // ... other fields ...
          position_tier: "junior" | "senior" | "lead" | null
          hire_date: string | null  // ISO date string
        }
        Insert: {
          // ... other fields ...
          position_tier?: "junior" | "senior" | "lead" | null
          hire_date?: string | null
        }
        Update: {
          // ... other fields ...
          position_tier?: "junior" | "senior" | "lead" | null
          hire_date?: string | null
        }
      }
    }
  }
}
```

---

### Step 5: Remove Type Assertions (Code Cleanup)

**File:** `src/services/user-actions.ts`

**Before:**
```typescript
// Using type assertions (temporary workaround)
if (formData.position_tier !== undefined) {
  (updatePayload as any).position_tier = formData.position_tier;
}
if (formData.hire_date !== undefined) {
  (updatePayload as any).hire_date = formData.hire_date;
}
```

**After:**
```typescript
// Now properly typed (after types regeneration)
if (formData.position_tier !== undefined) {
  updatePayload.position_tier = formData.position_tier;
}
if (formData.hire_date !== undefined) {
  updatePayload.hire_date = formData.hire_date;
}
```

**Git commit:**
```bash
git add src/types/database.types.ts src/services/user-actions.ts
git commit -m "chore: regenerate database types with position_tier and hire_date"
```

---

### Step 6: Deploy Frontend

**Build verification:**

```bash
npm.cmd run build
```

**Expected:**
```
✓ Compiled successfully in ~11s
✓ Finished TypeScript in ~39s
✓ Generating static pages (77/77)
```

**Deploy:**

```bash
# Commit all changes
git add .
git commit -m "feat: Tasks 18-19 - Position Tier & Hire Date UI (complete)"
git push origin main

# Or your deployment command
# npm run deploy
# vercel --prod
# etc.
```

---

### Step 7: Smoke Testing (Production)

#### Test 1: Edit KTV User
1. Login as admin
2. Navigate to **Settings** > **Nhân sự & Quyền**
3. Click **Edit** on a KTV user
4. Verify **Position Tier** field is visible
5. Verify **Hire Date** field is visible

**✅ Expected:** Both fields visible, dropdowns/date picker working

---

#### Test 2: Set Position Tier
1. Select **"Senior (1.2x - Cao hơn 20%)"** from Position Tier dropdown
2. Click **"Lưu thay đổi"**

**✅ Expected:** 
- Success toast: "Đã cập nhật thông tin nhân viên"
- Modal closes
- No errors in browser console

---

#### Test 3: Set Hire Date
1. Edit same KTV user
2. Set hire date to `2022-01-01` (4 years ago)
3. Verify badge shows: **"4 năm thâm niên"** and **"+10% thưởng thâm niên"**
4. Click **"Lưu thay đổi"**

**✅ Expected:**
- Success toast
- Badge calculation correct
- No errors

---

#### Test 4: Verify Database
**Run in SQL Editor:**

```sql
SELECT 
  id, 
  full_name, 
  role, 
  position_tier, 
  hire_date,
  created_at,
  updated_at
FROM public.users
WHERE position_tier IS NOT NULL 
   OR hire_date IS NOT NULL
ORDER BY updated_at DESC
LIMIT 5;
```

**✅ Expected:** See the KTV you just edited with correct values

---

#### Test 5: Verify Salary Recalculation (Critical!)
1. Check current month's salary record for the edited KTV
2. Verify `position_bonus` field is populated
3. Verify `seniority_bonus` field is populated

**SQL Query:**

```sql
SELECT 
  user_id,
  period,
  base_salary,
  position_bonus,    -- Should be non-zero if position_tier set
  seniority_bonus,   -- Should be non-zero if hire_date set
  total_salary,
  updated_at
FROM salary_records
WHERE user_id = '<the_ktv_id>'  -- Replace with actual ID
  AND period = '2026-06'         -- Current month
ORDER BY updated_at DESC;
```

**✅ Expected:**
- `position_bonus` > 0 (if position_tier = 'senior' or 'lead')
- `seniority_bonus` > 0 (if hire_date indicates >= 1 year)
- `updated_at` recent (just updated)

---

### Step 8: Monitor Errors

**Check application logs for 24 hours:**

```bash
# If using Vercel
vercel logs --follow

# If using other platform
# Check your logging dashboard
```

**Watch for:**
- TypeScript errors related to `position_tier` or `hire_date`
- Salary recalculation errors
- User update failures

---

## Rollback Plan (If Something Goes Wrong)

### Rollback Step 1: Remove Columns

**SQL in Supabase Dashboard:**

```sql
-- Remove indexes
DROP INDEX IF EXISTS public.idx_users_position_tier;
DROP INDEX IF EXISTS public.idx_users_hire_date;

-- Remove columns
ALTER TABLE public.users DROP COLUMN IF EXISTS position_tier;
ALTER TABLE public.users DROP COLUMN IF EXISTS hire_date;

-- Verify removed
SELECT column_name 
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name IN ('position_tier', 'hire_date');

-- Expected: 0 rows (columns removed)
```

### Rollback Step 2: Revert Frontend Code

```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Or deploy previous version
# vercel rollback
```

### Rollback Step 3: Regenerate Types

```bash
supabase gen types typescript --linked --schema public > src/types/database.types.ts
git add src/types/database.types.ts
git commit -m "chore: regenerate types after rollback"
git push origin main
```

---

## Post-Deployment Checklist

- [ ] Database backup created
- [ ] Migration applied successfully (Method A or B)
- [ ] Columns verified in database
- [ ] Indexes created
- [ ] Types regenerated (`database.types.ts`)
- [ ] Type assertions removed (`user-actions.ts`)
- [ ] Frontend build successful
- [ ] Frontend deployed
- [ ] Smoke Test 1: UI fields visible ✅
- [ ] Smoke Test 2: Position tier saveable ✅
- [ ] Smoke Test 3: Hire date saveable ✅
- [ ] Smoke Test 4: Database values correct ✅
- [ ] Smoke Test 5: Salary recalculation working ✅
- [ ] No errors in logs (first 24 hours)
- [ ] User training materials updated (optional)

---

## Troubleshooting

### Issue 1: Types not generated

**Symptoms:**
- `position_tier` and `hire_date` not in `database.types.ts`

**Solution:**
```bash
# Check Supabase CLI version
supabase --version  # Should be >= 2.0

# Regenerate with verbose output
supabase gen types typescript --linked --schema public --debug > src/types/database.types.ts

# If still failing, check database connection
supabase projects list
```

---

### Issue 2: Migration fails with "relation does not exist"

**Symptoms:**
- Error: `relation "public.user_profiles" does not exist`

**Root Cause:**
- Migration 20260617 references a table that doesn't exist in production

**Solution:**
- Use **Method A** (Manual SQL) instead of CLI push
- Manual SQL script is isolated and doesn't depend on other migrations

---

### Issue 3: UI fields not showing

**Symptoms:**
- Position Tier and Hire Date fields not visible in Edit User modal

**Checklist:**
1. User role is `'ktv'` or `'ktv_lead'`? (fields only show for KTV)
2. Frontend deployed successfully?
3. Browser cache cleared? (Ctrl+Shift+R)
4. Check browser console for errors

---

### Issue 4: Salary recalculation not triggered

**Symptoms:**
- Position tier/hire date saved, but salary not updated

**Debug:**

```sql
-- Check if user update triggered audit log
SELECT * FROM audit_log
WHERE table_name = 'users'
  AND record_id = '<user_id>'
ORDER BY created_at DESC
LIMIT 1;

-- Check backend logs for recalculation message
-- Should see: "[updateUser] Recalculated salary for user <id> due to position/hire date change"
```

**Solution:**
- Check `user-actions.ts` has salary recalculation code
- Verify `recalculateAndSaveSalaryRecordEngine` function exists
- Manually trigger recalculation if needed

---

## Support Contacts

**If deployment fails:**
1. Check this guide's Troubleshooting section
2. Review error logs
3. Use Rollback Plan if critical
4. Contact: [Your team lead/DevOps]

---

## Success Criteria

✅ **Deployment is successful if:**
1. All 5 smoke tests pass
2. No errors in logs for 24 hours
3. KTV users can see their position tier and hire date
4. Admin can edit position tier and hire date
5. Salary calculations include position bonus and seniority bonus

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-30 | AI Agent | Initial deployment guide |
