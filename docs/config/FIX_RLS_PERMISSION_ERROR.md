# Fix RLS Permission Error

**Error:** `KPI: permission denied for table tenant_payroll_config`

**Cause:** RLS policies reference non-existent `user_tenant_roles` table

**Fix:** Update RLS policies to use `public.users.tenant_id` instead

---

## Quick Fix (Run in Supabase Dashboard)

1. Go to **Supabase Dashboard** > **SQL Editor**
2. Copy and paste this SQL:

```sql
-- Drop old policies
DROP POLICY IF EXISTS "Users can view own tenant payroll config" ON tenant_payroll_config;
DROP POLICY IF EXISTS "Admins can update own tenant payroll config" ON tenant_payroll_config;
DROP POLICY IF EXISTS "Admins can insert own tenant payroll config" ON tenant_payroll_config;
DROP POLICY IF EXISTS "Admins can delete own tenant payroll config" ON tenant_payroll_config;
DROP POLICY IF EXISTS "Users can view own tenant payroll config history" ON tenant_payroll_config_history;

-- Create new policies using public.users.tenant_id
CREATE POLICY "Users can view own tenant payroll config"
  ON tenant_payroll_config
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.users
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can update own tenant payroll config"
  ON tenant_payroll_config
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.users
      WHERE id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Admins can insert own tenant payroll config"
  ON tenant_payroll_config
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.users
      WHERE id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Admins can delete own tenant payroll config"
  ON tenant_payroll_config
  FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.users
      WHERE id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Users can view own tenant payroll config history"
  ON tenant_payroll_config_history
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.users
      WHERE id = auth.uid()
    )
  );
```

3. Click **Run**
4. Verify success: "Query executed successfully"
5. Go back to Settings UI and try saving again

---

## Verify Fix

After running the SQL above, test:

1. Open Settings > Lương & Thưởng
2. Change KPI target from 32 → 35
3. Click "Lưu cấu hình"
4. Should see: ✅ "Đã lưu cấu hình lương thành công!"

---

## Why This Happened

**Original migration assumed:**
- `user_tenant_roles` table exists (multi-tenant pattern)
- Users can belong to multiple tenants

**Bella SPA reality:**
- `public.users` table has direct `tenant_id` column
- Users belong to ONE tenant only
- Simpler architecture

**Fix:** Updated RLS policies to match actual schema

---

## Alternative: Disable RLS (NOT RECOMMENDED)

If RLS fix doesn't work, you can temporarily disable RLS:

```sql
-- ⚠️ WARNING: This removes security! Only for testing!
ALTER TABLE tenant_payroll_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_payroll_config_history DISABLE ROW LEVEL SECURITY;
```

**DO NOT USE IN PRODUCTION!** This allows any user to see/edit any tenant's config.

---

## Root Cause Analysis

**File:** `supabase/migrations/20260622_create_tenant_payroll_config.sql`

**Bad Code (lines 107-115):**
```sql
CREATE POLICY "Users can view own tenant payroll config"
  ON tenant_payroll_config
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_roles  -- ❌ Table doesn't exist
      WHERE user_id = auth.uid()
    )
  );
```

**Good Code:**
```sql
CREATE POLICY "Users can view own tenant payroll config"
  ON tenant_payroll_config
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.users  -- ✅ Correct table
      WHERE id = auth.uid()
    )
  );
```

---

**Status:** ✅ Fix ready to apply  
**ETA:** 2 minutes to run SQL  
**Risk:** Low (only updates policies, doesn't touch data)
