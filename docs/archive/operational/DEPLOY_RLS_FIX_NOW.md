# 🔥 DEPLOY RLS FIX NOW (CRITICAL)

## ⚡ Quick Deploy (2 minutes)

### Step 1: Open Supabase Dashboard
👉 https://supabase.com/dashboard/project/lvnvkpyxtuilhrabtlwv/sql/new

### Step 2: Copy & Execute SQL

**Option A: Use Cleaned File (Recommended)**
1. Open: `scripts/deploy-critical-fixes.sql.cleaned`
2. Copy ALL content (Ctrl+A, Ctrl+C)
3. Paste into Supabase SQL Editor
4. Click **RUN** (or Ctrl+Enter)

**Option B: Use Original File**
1. Open: `scripts/deploy-critical-fixes.sql`
2. Copy ALL content
3. **REMOVE all lines with `\echo`** (search `\echo`, delete those lines)
4. Paste into Supabase SQL Editor
5. Click **RUN**

### Step 3: Verify Output

**Expected Output:**
```
✅ user_roles policies: 2
✅ partner_applications: 0 rows
✅ partner_application_logs: 0 rows
✅ Partner RPC functions: 2
✅ DEPLOYMENT COMPLETED SUCCESSFULLY
```

**If you see errors:**
- `relation already exists` → Safe, skip
- `type already exists` → Safe, skip
- Other errors → Check error message, may need rollback

---

## 🎯 What This Fixes

### Part 1: RLS Infinite Recursion (CRITICAL)
**Problem:** Admin users hit infinite recursion when checking roles  
**Fix:** Simplify RLS policies on `user_roles` table  
**Impact:** Admin login works without errors

### Part 2: Partner Portal (BUSINESS CRITICAL)
**Problem:** Partner registration system not deployed  
**Fix:** Create partner tables, policies, RPC functions  
**Impact:** `/partner/register` page works

---

## ✅ Verification Steps (1 minute)

### Test 1: Check Policies Deployed
```sql
SELECT COUNT(*) FROM pg_policies WHERE tablename = 'user_roles';
-- Expect: 2
```

### Test 2: Check Partner Tables
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_name LIKE 'partner_%'
ORDER BY table_name;
-- Expect: partner_applications, partner_application_logs
```

### Test 3: Check RPC Functions
```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_name LIKE '%partner%'
ORDER BY routine_name;
-- Expect: add_partner_document, remove_partner_document
```

### Test 4: Test Admin Login
1. Open: http://localhost:3000/login
2. Login with admin credentials
3. Should NOT see recursion errors
4. Check browser console: No infinite loop errors

---

## 🔴 Rollback (If Needed)

If deployment fails or causes issues:

```sql
-- Rollback Part 1: Restore original RLS
DROP POLICY IF EXISTS "Authenticated users can view all roles" ON user_roles;
DROP POLICY IF EXISTS "Only service role can modify roles" ON user_roles;

-- Rollback Part 2: Drop partner tables
DROP TABLE IF EXISTS partner_application_logs CASCADE;
DROP TABLE IF EXISTS partner_applications CASCADE;
DROP TYPE IF EXISTS partner_application_log_action CASCADE;
DROP TYPE IF EXISTS partner_applicant_type CASCADE;
DROP TYPE IF EXISTS partner_application_status CASCADE;
```

**Recovery time:** < 1 minute

---

## 📋 Deployment Checklist

- [ ] Opened Supabase SQL Editor
- [ ] Copied cleaned SQL file
- [ ] Executed SQL (RUN button)
- [ ] Verified output: "✅ DEPLOYMENT COMPLETED SUCCESSFULLY"
- [ ] Tested admin login (no recursion)
- [ ] Checked browser console (no errors)
- [ ] Verified partner tables exist

---

## 🆘 Troubleshooting

**Error: "relation already exists"**
- **Cause:** Tables already deployed
- **Action:** Safe to ignore, continue

**Error: "type already exists"**
- **Cause:** Enums already exist
- **Action:** Safe to ignore, continue

**Error: "syntax error near \echo"**
- **Cause:** Didn't remove `\echo` commands
- **Action:** Use cleaned file OR remove all `\echo` lines manually

**Error: "infinite recursion detected"**
- **Cause:** Old policies still active
- **Action:** Drop old policies first:
  ```sql
  DROP POLICY IF EXISTS "Admins can view all roles" ON user_roles;
  DROP POLICY IF EXISTS "Super admins can manage roles" ON user_roles;
  ```

---

## ⏱️ Time Estimate

| Step | Time |
|------|------|
| Open Supabase SQL Editor | 30 sec |
| Copy & paste SQL | 30 sec |
| Execute SQL | 30 sec |
| Verify output | 30 sec |
| **Total** | **~2 minutes** |

---

**PRIORITY:** 🔥 CRITICAL - Deploy ASAP  
**IMPACT:** Fixes admin login + enables partner portal  
**RISK:** Low (tables/policies only, no data modification)  
**ROLLBACK:** Easy (< 1 minute)
