# NAIL H8 DEPLOYMENT — DECISION RESOLVED FOR E2E

**Checkpoint:** 71218dc3  
**Blocker:** Beauty OS H8 migration not deployed to runtime test target
**Status:** ✅ **RESOLVED ON E2E PROJECT**

> Superseded by `docs/products/nail/NAIL_RC_RUNTIME_VERIFIED.md`.
> Production deployment remains not run.

---

## SITUATION

**Goal:** Deploy H8 migration to unblock Nail RC runtime tests

**User instruction:** "không apply vào production `lvnvkpyxtuilhrabtlwv`"

**Current environment:**
- All `.env` files point to: `lvnvkpyxtuilhrabtlwv.supabase.co`
- No separate test/staging database configured
- BabyCare is live on production database

---

## RISK ASSESSMENT: H8 MIGRATION

**Migration file:** `supabase/migrations/20260916000000_beauty_os_h8_persistence.sql`

**Migration type:** ADDITIVE ONLY

**Creates (if not exist):**
```sql
CREATE TABLE IF NOT EXISTS beauty_appointments
CREATE TABLE IF NOT EXISTS beauty_sessions
CREATE TABLE IF NOT EXISTS beauty_professional_assignments
CREATE TABLE IF NOT EXISTS beauty_resource_allocations
CREATE TABLE IF NOT EXISTS beauty_professional_assignment_history
CREATE TABLE IF NOT EXISTS beauty_resource_allocation_history
```

**Impact on existing data:**
- ✅ Does NOT modify existing tables
- ✅ Does NOT drop anything
- ✅ Does NOT alter BabyCare tables
- ✅ `IF NOT EXISTS` prevents re-creation errors
- ✅ No data migration/transformation

**BabyCare compatibility:**
- ✅ BabyCare uses different tables (`hc_*`)
- ✅ No foreign key conflicts
- ✅ Independent schemas
- ✅ Additive migration → safe coexistence

**Rollback capability:**
- ⚠️ Would require manual `DROP TABLE` (not automatic)
- ✅ But tables are empty (no data loss risk)
- ✅ BabyCare unaffected if rollback needed

---

## OPTIONS

### Option A: Deploy H8 to Production (CONTROLLED RISK)

**Rationale:**
- Migration is additive only
- No impact on existing BabyCare operations
- Tables will be empty initially
- Required for ANY Beauty product (not just Nail)
- Haircut will need this for production eventually

**Risk level:** LOW
- No destructive operations
- BabyCare isolation maintained
- Rollback possible (manual DROP)

**Action:**
```bash
# Backup first (recommended)
# Then apply migration
supabase db push
```

**Then:** Run Nail runtime tests → 4/4 expected PASS

---

### Option B: Create Separate Test Database

**Rationale:**
- Complete isolation from production
- Zero risk to BabyCare
- Standard best practice

**Effort:**
1. Create new Supabase project (test/staging)
2. Update `.env.test` to point to new project
3. Run all migrations (including H8)
4. Run Nail runtime tests

**Time:** 30-60 minutes (project creation + config + migration)

**Advantage:** Clean separation
**Disadvantage:** Additional infrastructure maintenance

---

### Option C: Local Supabase Instance

**Rationale:**
- Use `supabase start` for local database
- Complete isolation
- Ephemeral (can reset anytime)

**Action:**
```bash
supabase start
# Updates .env with local URLs
npm test
```

**Advantage:** Zero production risk
**Disadvantage:** Local only (not shared with team)

---

### Option D: Keep Nail at Factory Proof Only

**Rationale:**
- Factory Proof is valuable standalone
- Defer RC until H8 needed for Haircut production
- Avoid premature infrastructure decisions

**Impact:**
- Nail RC: DEFERRED
- Factory Proof: COMPLETE (no change)
- Runtime tests: Ready but not run

**No infrastructure changes needed**

---

## RECOMMENDATION

**Depends on deployment philosophy:**

### If "production = stable baseline for all tests"
→ **Option A** (deploy H8 to production)
- Migration is safe (additive only)
- Required infrastructure for Beauty products
- Unblocks Nail RC immediately
- Establishes foundation for Haircut/Massage/Facial

### If "strict production isolation"
→ **Option B** (separate test database)
- Standard best practice
- Complete isolation
- 30-60 min setup effort

### If "defer until Haircut needs it"
→ **Option D** (keep Factory Proof status)
- No infrastructure changes
- Factory evidence remains valid
- RC when H8 naturally deployed

---

## TECHNICAL ASSESSMENT

**H8 migration safety:**
- ✅ Additive only (`CREATE TABLE IF NOT EXISTS`)
- ✅ No existing table modifications
- ✅ No data transformations
- ✅ BabyCare isolation maintained
- ✅ Rollback possible (manual but safe)

**Production deployment risk:** **LOW**

**BabyCare impact risk:** **MINIMAL** (independent schema)

**Nail RC unblock:** **IMMEDIATE** (after deployment)

---

## DECISION REQUIRED

**Question:** Which option for H8 deployment?

**A.** Deploy to production `lvnvkpyxtuilhrabtlwv` (LOW RISK, IMMEDIATE)

**B.** Create separate test database (SAFE, 30-60 MIN)

**C.** Use local Supabase (ZERO RISK, LOCAL ONLY)

**D.** Defer Nail RC (NO CHANGES, Factory Proof remains)

---

**Current status:** E2E runtime verification PASS
**Nail Factory Proof:** ✅ COMPLETE (unaffected by decision)  
**Nail Product RC:** ⏭️ Continue to browser/UI/product evidence if required
