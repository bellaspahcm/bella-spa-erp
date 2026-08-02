# Partner Portal Deployment Checklist

**Date Started:** August 2, 2026  
**Deploying to:** Production  
**Estimated Time:** 50 minutes

---

## 📋 Pre-Flight Check

### ✅ Code Status
- [x] All features complete (11/11)
- [x] Build passing (0 errors)
- [x] Code committed & pushed
- [x] Documentation complete

### ✅ Database Status
- [x] Migration file ready
- [x] Seed data prepared
- [x] RLS policies defined
- [x] Verification queries ready

---

## 🚀 Deployment Steps

### Step 1: Database Migration ⏳ IN PROGRESS

**Action Required:** Apply migration to Supabase

#### Instructions:
1. Open Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor**
4. Create new query
5. Copy content from: `supabase/migrations/20260802000000_real_estate_partner_portal.sql`
6. Click **Run**

#### Verification Commands:
```sql
-- Run these after migration:

-- 1. Check tables created (should return 6 rows)
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 're_%'
ORDER BY table_name;

-- 2. Check RLS enabled (all should be true)
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename LIKE 're_%';

-- 3. Check ENUMs created (should return 6 types)
SELECT typname 
FROM pg_type 
WHERE typname LIKE 're_%'
ORDER BY typname;

-- 4. Check RLS policies (should return 24+ rows)
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename LIKE 're_%'
ORDER BY tablename, policyname;
```

**Expected Results:**
- ✅ 6 tables created
- ✅ All tables have RLS enabled
- ✅ 6 ENUM types created
- ✅ 24+ RLS policies applied
- ✅ 1 RPC function created (reserve_product)

**Status:** ⏳ **WAITING FOR USER TO RUN MIGRATION**

---

### Step 2: Seed Demo Data (Optional) ⏸️ PENDING

**⚠️ IMPORTANT:** Only run on **staging/development**, NOT production!

**Skip this step if deploying to production with real data.**

If deploying to staging for testing:
1. Copy content from: `supabase/seed_data/partner_portal_demo_data.sql`
2. Run in SQL Editor
3. Verify with count queries

**Status:** ⏸️ **SKIPPED FOR PRODUCTION**

---

### Step 3: Regenerate Types ⏳ READY

**Action Required:** Run command after migration

```bash
# Navigate to project root
cd "d:\Antigravity\Projects\BELLA SPA ERP"

# Regenerate types from production DB
npx supabase gen types typescript --linked --schema public > src/types/database.types.ts
```

**Expected:**
- File size: ~350KB
- Should include all `re_*` tables
- Should include ENUM types with correct values

**Status:** ⏸️ **WAITING FOR STEP 1 TO COMPLETE**

---

### Step 4: Remove Type Assertions ⏳ READY

**Files to update:**
- `src/services/partner-actions.ts` (18 occurrences of `as any`)

**Search command:**
```bash
grep -n "as any" src/services/partner-actions.ts
```

**After types regenerated, replace:**
```typescript
// BEFORE
.from('re_reservations' as any)

// AFTER
.from('re_reservations')
```

**Verification:**
```bash
npm run build
# Should pass with 0 errors
```

**Status:** ⏸️ **WAITING FOR STEP 3 TO COMPLETE**

---

### Step 5: Build & Deploy ⏳ READY

**Option 1: Auto-deploy (Recommended)**
```bash
# Commit type updates
git add src/types/database.types.ts src/services/partner-actions.ts
git commit -m "chore: regenerate types and remove temporary assertions"
git push

# Vercel will auto-deploy
# Monitor at: https://vercel.com/bellaspahcm/bella-spa-erp
```

**Option 2: Manual deploy**
```bash
vercel --prod
```

**Expected:**
- Build time: 2-3 minutes
- Status: ✅ Deployed

**Status:** ⏸️ **WAITING FOR STEP 4 TO COMPLETE**

---

### Step 6: Verify Deployment ⏳ READY

**Checklist:**
- [ ] All pages load (11 pages)
- [ ] Dashboard shows metrics
- [ ] Inventory displays products
- [ ] Lead creation works
- [ ] Lead status update works
- [ ] Lead export works
- [ ] Booking creation works
- [ ] Commission history shows
- [ ] Document download works
- [ ] Profile update works
- [ ] Mobile view works

**Test URLs:**
```
/partner/dashboard
/partner/inventory
/partner/bookings
/partner/leads
/partner/commission
/partner/documents
/partner/inbox
/partner/profile
```

**Status:** ⏸️ **WAITING FOR STEP 5 TO COMPLETE**

---

### Step 7: Monitor & Celebrate 🎉

**Monitoring Dashboard:**
- Vercel Analytics
- Error logs
- Performance metrics
- User feedback

**Status:** ⏸️ **WAITING FOR STEP 6 TO COMPLETE**

---

## 📊 Progress Tracker

```
Step 1: Database Migration    ⏳ IN PROGRESS (user action needed)
Step 2: Seed Data             ⏸️ SKIPPED (production)
Step 3: Regenerate Types      ⏸️ PENDING (waiting for step 1)
Step 4: Remove Assertions     ⏸️ PENDING (waiting for step 3)
Step 5: Build & Deploy        ⏸️ PENDING (waiting for step 4)
Step 6: Verify                ⏸️ PENDING (waiting for step 5)
Step 7: Monitor               ⏸️ PENDING (waiting for step 6)

Overall Progress: ░░░░░░░░░░░░░░░░░░░░ 0% (0/7 complete)
```

---

## 🚨 Rollback Instructions (If Needed)

### Quick Rollback:
1. Go to Vercel Dashboard
2. Find previous deployment
3. Click "Redeploy"
4. Confirm

### Database Rollback:
```sql
-- Drop all Partner Portal tables
DROP TABLE IF EXISTS re_partner_leads CASCADE;
DROP TABLE IF EXISTS re_documents CASCADE;
DROP TABLE IF EXISTS re_commission_ledger CASCADE;
DROP TABLE IF EXISTS re_reservations CASCADE;
DROP TABLE IF EXISTS real_estate_products CASCADE;
DROP TABLE IF EXISTS real_estate_projects CASCADE;

-- Drop ENUMs
DROP TYPE IF EXISTS re_product_type CASCADE;
DROP TYPE IF EXISTS re_product_status CASCADE;
DROP TYPE IF EXISTS re_reservation_status CASCADE;
DROP TYPE IF EXISTS re_commission_status CASCADE;
DROP TYPE IF EXISTS re_document_type CASCADE;
DROP TYPE IF EXISTS re_transaction_type CASCADE;
```

---

## 📝 Notes & Issues

### Issues Encountered:
(None yet)

### Solutions Applied:
(None yet)

### Lessons Learned:
(To be updated after deployment)

---

## ✅ Sign-Off

- [ ] Database migration completed
- [ ] Types regenerated
- [ ] Build passing
- [ ] Deployment successful
- [ ] Verification complete
- [ ] Monitoring active

**Deployed by:** _________________  
**Date:** _________________  
**Time:** _________________  

---

## 🎊 Post-Deployment

### Immediate Tasks:
- [ ] Announce to partners
- [ ] Monitor errors (first hour)
- [ ] Test with real users
- [ ] Collect initial feedback

### Follow-up Tasks:
- [ ] User training session
- [ ] Create tutorials
- [ ] Optimize performance
- [ ] Plan enhancements

---

**Status:** 🟡 **DEPLOYMENT IN PROGRESS**  
**Next Action:** Apply database migration in Supabase Dashboard

---

*Last Updated: August 2, 2026*
