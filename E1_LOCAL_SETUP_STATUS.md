---
date: 2026-09-13
type: E1 Local Setup Attempt
status: BLOCKED
---

# E1 LOCAL SETUP STATUS

## ❌ BLOCKER: Migration Conflict

**Attempted:** Local Supabase start for E1 runtime verification

**Result:** Migration error at `20260512000000_fix_permissions.sql`
```
ERROR: relation "inventory_items" does not exist (SQLSTATE 42P01)
At statement: 14
ALTER TABLE inventory_items DISABLE ROW LEVEL SECURITY
```

**Root Cause:**
- Migration assumes `inventory_items` table exists
- Table likely created in earlier migration that failed/skipped
- Complex migration history (300+ migrations)
- Local fresh start requires full schema rebuild

---

## 🔍 ANALYSIS

**Migration Count:** 300+ migrations from 2026-05 to 2026-09
**Issue:** Early migration (May 12) references table from earlier migration
**Impact:** Cannot start fresh local instance without resolving dependencies

**Options:**

### Option A: Fix Migration Order (Complex)
- Analyze all 300+ migrations
- Identify dependency graph
- Fix order conflicts
- Time: Several hours
- Risk: High (may break production migrations)

### Option B: Use Linked Remote DB (Simpler)
- Project already linked: `lvnvkpyxtuilhrabtlwv`
- Use remote staging/dev database
- Apply new E1 migrations only
- Time: Minutes
- Risk: Medium (need staging credentials)

### Option C: Skip Local, Use Preview URL (Fastest)
- Vercel preview already deploying
- Use preview + remote staging DB
- Run smoke tests on preview
- Time: Wait for preview ready
- Risk: Low (environment may be limited)

---

## ✅ RECOMMENDED: Option C

**Why:**
1. **Time-efficient:** Preview already building
2. **Real environment:** Same as production
3. **E1 migrations included:** Already in codebase
4. **Minimal setup:** Just need preview URL

**Prerequisites:**
- Preview deployment: READY (check Vercel)
- Migrations: Auto-applied on preview deploy (OR need manual apply)
- Test data: May need seeding

**Next actions:**
1. Check Vercel for preview URL
2. Verify E1 migrations applied (or apply manually)
3. Run smoke tests (V1/V6 partial)
4. Document results

---

## 📋 ALTERNATIVE: Manual Migration Apply

**If using remote/staging:**

```bash
# Connect to remote
supabase link --project-ref lvnvkpyxtuilhrabtlwv

# Apply E1 migrations only
supabase db push --dry-run  # Check what will be applied

# Apply for real
supabase db push

# Or manual:
supabase db query --linked --file supabase/migrations/20260912000000_r3_education_identity_cutover.sql
supabase db query --linked --file supabase/migrations/20260912100000_org_unit_hierarchy_rpcs.sql
supabase db query --linked --file supabase/migrations/20260912120000_add_branch_id_to_education_tables.sql
```

---

## 🎯 DECISION REQUIRED

**User needs to decide:**

1. **Wait for Vercel preview** (recommended)
   - Check: https://vercel.com/bellaspahcm/bella-spa-erp/deployments
   - If ready → use preview URL for smoke tests
   - Continue with Option C

2. **Fix local migrations** (time-consuming)
   - Analyze migration dependencies
   - Fix conflicts
   - Not recommended for urgent verification

3. **Use remote staging DB** (requires credentials)
   - Apply E1 migrations to staging
   - Run full verification suite
   - Requires staging DB access

---

**Status:** ⏸️ AWAITING DECISION  
**Blocker:** Local migration conflict  
**Recommendation:** Use Vercel preview URL (Option C)

