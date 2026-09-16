# Gates 4-7: Production Deployment — Manual Execution Required

**Date:** 2026-09-16  
**Status:** ⏸️ AWAITING PR MERGE & MANUAL TRIGGER  
**Authority:** Deployment/Operations (not automated)

---

## Prerequisites

**Gates 1-3 Status:**
1. ✅ Gate 1: BabyCare Regression — PASS
2. ✅ Gate 2: Migration Review — APPROVED
3. ⏸️ Gate 3: Merge to `main` — PR Required (branch protection)

**Before proceeding with Gates 4-7:**
- Create PR: `feat/haircut-h2-contract-extraction` → `main`
- Wait for status checks (4/4)
- Merge PR
- **DO NOT auto-deploy** after merge

---

## Gate 4: Production Backup

### Actions Required
1. **Full database backup** of production `lvnvkpyxtuilhrabtlwv`
2. **Backup verification** (restore test to confirm integrity)
3. **Rollback plan review** (ensure DROP statements ready)

### Commands (Supabase CLI)
```bash
# Backup production database
supabase db dump --project-ref lvnvkpyxtuilhrabtlwv --file backup-$(date +%Y%m%d-%H%M%S).sql

# Verify backup (dry-run restore test recommended)
```

### Success Criteria
- ✅ Backup file created
- ✅ Backup size reasonable (>100MB expected)
- ✅ Restore test successful (or dry-run validated)
- ✅ Rollback plan reviewed

### Timeline
**Estimated:** 1 hour

---

## Gate 5: Migration Execution

### Actions Required
1. **Apply Beauty OS H8 migration** to production
2. **Verify migration success** (6 tables created, RLS enabled)
3. **Confirm no errors** in migration log

### Commands (Supabase CLI)
```bash
# Apply migrations to production
supabase db push --project-ref lvnvkpyxtuilhrabtlwv

# Or apply specific migration
supabase migration up --project-ref lvnvkpyxtuilhrabtlwv
```

### Migration File
`supabase/migrations/20260916000000_beauty_os_h8_persistence.sql`

### Verification Queries
```sql
-- Verify 6 Beauty tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE 'beauty_%';
-- Expected: 6 rows

-- Verify RLS enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' AND tablename LIKE 'beauty_%';
-- Expected: rowsecurity = true for all 6

-- Check BabyCare tables unchanged
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name IN ('bookings', 'session_logs', 'customers');
-- Expected: 3 rows, no schema changes
```

### Success Criteria
- ✅ Migration applied without errors
- ✅ 6 Beauty tables created
- ✅ RLS policies active
- ✅ BabyCare tables unchanged

### Timeline
**Estimated:** 30 minutes

---

## Gate 6: Smoke Tests

### Actions Required
Test all products in production to confirm functionality:

#### 6.1 BabyCare Smoke Test
**Critical Path:** Booking creation → Session completion

1. Navigate to `/dashboard/bookings`
2. Create new BabyCare booking
3. Assign KTV
4. Complete session
5. Verify invoice generation

**Expected:** ✅ All steps complete without errors

---

#### 6.2 Haircut Smoke Test
**Critical Path:** UI accessibility

1. Navigate to `/dashboard/bookings` (Beauty tenant)
2. Verify timeline renders
3. Navigate to `/dashboard/services`
4. Verify service catalog loads
5. Navigate to `/dashboard/sessions`
6. Verify sessions page loads

**Expected:** ✅ All routes accessible, no crashes

---

#### 6.3 Nail Smoke Test (If Deployed)
**Critical Path:** UI accessibility

1. Navigate to `/dashboard/nail`
2. Verify 3 journey tiles render:
   - Multi-Resource Booking
   - Capacity/Waitlist
   - Technician Reassignment
3. Confirm no console errors

**Expected:** ✅ UI renders without errors

---

### Success Criteria
- ✅ BabyCare booking workflow functional
- ✅ Haircut UI routes accessible
- ✅ Nail UI routes accessible (if deployed)
- ✅ No critical errors in production logs

### Timeline
**Estimated:** 1-2 hours

---

## Gate 7: Monitoring

### Actions Required
Monitor production for 24-48 hours post-deployment:

#### Metrics to Track
1. **Error Rates**
   - Overall error rate
   - BabyCare booking errors
   - Beauty route errors

2. **BabyCare Booking Success Rate**
   - Booking creation success %
   - Session completion success %
   - Invoice generation success %

3. **Beauty Routes Accessibility**
   - `/dashboard/bookings` uptime
   - `/dashboard/services` uptime
   - `/dashboard/sessions` uptime
   - `/dashboard/nail` uptime (if deployed)

4. **Database Query Performance**
   - Beauty table query latency
   - BabyCare table query latency
   - RLS policy overhead

#### Monitoring Tools
- Supabase Dashboard: Database metrics
- Application logs: Error tracking
- User reports: Functional issues

### Success Criteria
- ✅ Error rates stable (no spike)
- ✅ BabyCare booking success rate >95%
- ✅ Beauty routes accessible (>99% uptime)
- ✅ Database query performance acceptable (<500ms p95)
- ✅ No user-reported critical issues

### Timeline
**Estimated:** 24-48 hours

---

## Rollback Procedure

### If Smoke Tests Fail (Gate 6)

**Immediate Actions:**
1. Execute rollback script:
   ```sql
   DROP TABLE IF EXISTS beauty_resource_allocation_history CASCADE;
   DROP TABLE IF EXISTS beauty_professional_assignment_history CASCADE;
   DROP TABLE IF EXISTS beauty_resource_allocations CASCADE;
   DROP TABLE IF EXISTS beauty_professional_assignments CASCADE;
   DROP TABLE IF EXISTS beauty_sessions CASCADE;
   DROP TABLE IF EXISTS beauty_appointments CASCADE;
   ```
2. Restore from backup (Gate 4)
3. Verify BabyCare functionality
4. Document failure root cause

**Do NOT proceed to Gate 7 if rollback executed.**

---

### If Monitoring Detects Issues (Gate 7)

**Assessment:**
- Minor issues: Document and monitor
- Major issues: Execute rollback
- Critical issues: Execute rollback immediately

**Rollback Decision Matrix:**
| Issue | Impact | Action |
|-------|--------|--------|
| Error rate spike <5% | Low | Monitor, document |
| Error rate spike 5-10% | Medium | Investigate, prepare rollback |
| Error rate spike >10% | High | Execute rollback |
| BabyCare booking failure | Critical | Execute rollback immediately |
| Data corruption | Critical | Execute rollback immediately |

---

## Deployment Checklist

### Pre-Deployment (Gates 1-3)
- [x] BabyCare regression: PASS
- [x] Migration review: APPROVED
- [ ] PR merged to `main`

### Deployment (Gates 4-7)
- [ ] Gate 4: Production backup complete
- [ ] Gate 5: Migration applied successfully
- [ ] Gate 6: Smoke tests PASS (BabyCare + Haircut + Nail)
- [ ] Gate 7: 24-48hr monitoring clean

### Post-Deployment
- [ ] Deployment report created
- [ ] Rollback procedure verified (if executed)
- [ ] Monitoring continued for 7 days
- [ ] Beauty OS Foundation status updated to DEPLOYED

---

## Authority

**Gates 4-7:** Manual execution required (not automated)  
**Owner:** Deployment/Operations team  
**Approval:** Required for production changes  
**Date:** 2026-09-16  
**Branch:** `feat/haircut-h2-contract-extraction` @ `87b84b0b`

---

## Success = All 7 Gates PASS

**When complete:**
- Beauty OS Foundation: DEPLOYED
- Bella Haircut Shop: PRODUCTION
- Bella Nail Shop: PRODUCTION (if deployed)
- BabyCare: VERIFIED NO REGRESSION

**Then:** Beauty OS enters Maintenance/Factory mode in production.
