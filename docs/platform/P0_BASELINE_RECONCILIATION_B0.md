# P0 Phase B0: Canonical Schema Reconciliation

**Date:** 2026-09-16  
**Phase:** Baseline Decision Gate  
**Status:** ⏸️ AWAITING canonical source designation

---

## **Objective**

Determine authoritative schema source before generating Baseline V2 migration.

---

## **Schema Inventory Results**

### **E2E Database (bmnbqbcdbuklhopfbopv)**

**Total Tables:** 70

**Categories:**
- Core BabyCare/Spa: 16 tables (tenants, users, customers, bookings, etc.)
- Beauty OS: 8 tables (beauty_appointments, beauty_sessions, etc.)
- Healthcare Platform: ~15 tables (hc_*, patient_profiles, etc.)
- Education Platform: ~10 tables (courses, students, edu_*, etc.)
- Real Estate: ~5 tables (real_estate_products, real_estate_projects, etc.)
- Supporting Systems: ~16 tables (accounting_*, marketing_*, etc.)

### **Migration History (458 files)**

**Total CREATE TABLE References:** 305

**Categories:**
- Live in E2E: 44 tables (14%)
- Not in E2E: 261 tables (86%)
  - Dropped/renamed tables (legitimate history)
  - Never-created tables (dead references)
  - Future/abandoned features

---

## **Critical Findings**

### **1. Core Business Tables Missing from Migration History**

**14 of 16 core tables** have NO `CREATE TABLE` in canonical migrations:

```text
❌ tenants              (root isolation boundary)
❌ users                (authentication/staff)
❌ bookings             (core booking system)
❌ session_logs         (service delivery tracking)
❌ session_reviews      (quality management)
❌ packages             (service catalog)
❌ inventory_logs       (inventory movements)
❌ revenue              (financial tracking)
❌ expenses             (cost tracking)
❌ salary_records       (payroll)
❌ package_materials    (service-inventory link)
❌ shifts               (staff scheduling)
❌ attendance           (staff attendance)
❌ kpi_records          (performance tracking)

✅ customers            (EXISTS in migrations)
✅ inventory_items      (RECOVERED in Iteration 1)
```

**Impact:** 87.5% of core business layer cannot be reproduced from migrations.

---

### **2. Migration Ledger System**

**System Used:** `_prisma_migrations` table

**Structure:**
```sql
CREATE TABLE _prisma_migrations (
    id VARCHAR(36) PRIMARY KEY,
    checksum VARCHAR(64) NOT NULL,
    finished_at TIMESTAMPTZ,
    migration_name VARCHAR(255) NOT NULL,
    logs TEXT,
    rolled_back_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    applied_steps_count INT DEFAULT 0
);
```

**Observations:**
- Prisma-style ledger (not native Supabase)
- Tracks migration application state
- Used for preventing re-application

**Baseline Transition Strategy:**
- New baseline must be recorded in ledger
- Existing databases must NOT re-apply baseline
- Requires ledger pre-population strategy

---

### **3. Production vs E2E Comparison**

**Status:** ❌ NOT COMPLETED

**Reason:** Production database credentials not accessible (placeholder keys in `.env.production`)

**Risk Assessment:**
- **Assumption:** E2E reflects production schema (both serve BabyCare)
- **Evidence:** E2E used for Beauty OS testing (recently validated)
- **Confidence:** HIGH that E2E ≈ Production
- **Recommendation:** Validate assumption through alternative means:
  - Application code compatibility
  - Recent deployment logs
  - Schema version tags
  - Business stakeholder confirmation

---

## **LIVE_NOT_IN_HISTORY Analysis**

**26 tables exist in E2E but have NO CREATE in migrations:**

### **Core Business (14 tables)**
```
tenants, users, bookings, session_logs, session_reviews
packages, inventory_logs, revenue, expenses, salary_records
package_materials, shifts, attendance, kpi_records
```

### **Beauty OS (8 tables)**
```
beauty_appointments, beauty_sessions
beauty_professional_assignments, beauty_professional_assignment_history
beauty_resource_allocations, beauty_resource_allocation_history
```
**Note:** Beauty tables EXIST in E2E despite being newly merged to main.
**Explanation:** E2E database updated independently of migration chain.

### **Supporting (4 tables)**
```
_prisma_migrations (ledger)
knowledge_documents (feature)
Notification (legacy naming)
membership_records (business feature)
```

---

## **HISTORY_NOT_LIVE Analysis**

**261 table references in migrations NOT in E2E:**

**Sample Categories:**

**Automotive Vertical (~25 tables):**
```
auto_bookings, auto_brands, auto_vehicles, auto_leads
auto_customer_profiles, auto_deposits, auto_touchpoints
```
**Status:** Likely created then dropped, OR never deployed to E2E

**Architecture/Tooling (~10 tables):**
```
arch_arb_reviews, arch_decisions, arch_maturity_scores
api_partners, api_rate_limit_counters
```
**Status:** Likely experimental/development-only

**Education Extensions (~30 tables):**
```
edu_allergens, edu_assessments, edu_child_allergies
edu_comm_deliveries, edu_fin_*, edu_meal_*
```
**Status:** Some exist (courses, students), extensions may be newer

**Real Estate/Contracts (~15 tables):**
```
contract_contracts, real_estate_units, real_estate_sale_contracts
```
**Status:** Migration #8 "THE GREAT PURGE" dropped many of these

**Conclusion:** 261 NOT_LIVE includes:
- ✅ Legitimately dropped tables (cleanup migrations)
- ❓ Never-deployed features (development artifacts)
- ❓ Vertical-specific extensions (may exist in other environments)

**Not necessarily errors** - many are historical/intentional.

---

## **Schema Reconciliation Status**

### **E2E vs Production**

**Status:** ⚠️ CANNOT COMPARE (no production access)

**Mitigation Options:**

**Option A: Accept E2E as Canonical**
- Pros: E2E is operational, recently tested
- Cons: Unverified assumption E2E = Production
- Risk: LOW (E2E serves same BabyCare app)

**Option B: Request Production Schema Dump**
- Pros: Authoritative comparison
- Cons: Requires credentials/approval
- Risk: MEDIUM (delays baseline reconstruction)

**Option C: Verify via Application Testing**
- Pros: Functional validation
- Cons: Indirect schema verification
- Risk: MEDIUM (may miss schema drift)

---

## **Migration Ledger Transition Strategy**

### **Problem**

Baseline V2 will be a **new single migration** replacing 458 historical migrations.

**Risk:** Existing databases (E2E, Production) will attempt to re-apply baseline schema.

### **Solution: Ledger Pre-Seeding**

**For Existing Databases (E2E, Production):**
```sql
-- Mark baseline as already applied
INSERT INTO _prisma_migrations (
    id, 
    checksum,
    migration_name,
    finished_at,
    started_at,
    applied_steps_count
) VALUES (
    gen_random_uuid()::varchar,
    '[baseline-checksum]',
    '20260916100000_baseline_v2_e2e_recovery',
    NOW(),
    NOW(),
    1
) ON CONFLICT DO NOTHING;
```

**For New Databases (Clean Build):**
- Apply baseline migration normally
- Ledger entry auto-created by migration system

**Verification:**
```sql
SELECT migration_name, finished_at 
FROM _prisma_migrations 
WHERE migration_name LIKE '%baseline%';
```

---

## **Recommendation**

### **Proceed with Baseline Reconstruction Using E2E as Source**

**Rationale:**
1. ✅ E2E contains 70 operational tables
2. ✅ Core business layer complete in E2E
3. ✅ Recently validated (Beauty OS testing)
4. ✅ Migration history 87.5% incomplete for core tables
5. ⚠️ Production comparison blocked (credential access)
6. ⚠️ Assumption: E2E ≈ Production (high confidence)

**Conditions:**
1. **Pre-Deployment Validation:**
   - Test baseline against staging environment
   - Verify application compatibility
   - Confirm no production-only tables missed

2. **Ledger Transition:**
   - Pre-seed ledger in E2E/Production before baseline deployment
   - Test clean-build separately
   - Document rollback procedure

3. **Schema Version Tag:**
   - Tag E2E schema snapshot: `baseline-v2-20260916`
   - Archive old migrations: `supabase/migrations/archive-incomplete-chain/`
   - Document reconstruction in ADR-009

---

## **Next Phase: Baseline Generation**

**IF APPROVED:**

**Phase B1: Generate Baseline V2**
```bash
# Extract complete E2E schema
supabase db dump --linked --schema public --data-only=false \
    -f supabase/migrations/20260916100000_baseline_v2_e2e_recovery.sql

# Clean up dump (remove data, comments, specific to baseline needs)
# Add proper migration header
# Test clean-build
```

**Phase B2: Archive Old Chain**
```bash
mkdir supabase/migrations/archive-incomplete-chain/
mv supabase/migrations/202605*.sql archive-incomplete-chain/
mv supabase/migrations/202606*.sql archive-incomplete-chain/
# ... etc (keep only baseline)
```

**Phase B3: Test & Document**
- Clean-build test: empty → baseline → ✅
- Create ADR-009
- Update P0 documentation
- Prepare ledger pre-seed script

---

## **Open Questions**

1. **Production Schema:** Can production database be accessed for verification?
2. **E2E Authority:** Stakeholder confirmation that E2E reflects production?
3. **Beauty Tables:** Should Beauty OS tables be in baseline or separate migration?
4. **Ledger Transition:** Who will execute pre-seed on production?

## **B0 Status: PAUSED (Production Verification Required for Baseline)**

**Date:** 2026-09-16  
**Phase:** Baseline Decision Gate  
**Status:** ⏸️ PAUSED - awaiting Production schema OR strategic pivot to Census-First

**Strategic Decision:** Do NOT proceed with Baseline V2 generation until:
1. Production schema obtained and E2E ↔ Production reconciled, OR
2. Migration Census (Phase M1) completes and provides alternative path

**Reason for Pause:**  
Creating canonical baseline from E2E without Production verification risks enshrining schema drift. If E2E and Production have diverged, baseline will be wrong for one of them.

**Alternative Path (APPROVED):**  
Proceed with Phase M1 (Migration Census) instead. Census may reveal that selective repair or hybrid approach is viable without requiring Production access immediately.

**Phase M1 can proceed in parallel with Production schema acquisition.**

---

## **CRITICAL: Production Schema Access Required**

**Current Blocker:** Cannot complete canonical schema reconciliation without Production database access.

**Available Information:**
- GitHub secret exists: `PRODUCTION_SUPABASE_DB_URL` (used in `.github/workflows/deploy-production.yml`)
- Local `.env.production` contains placeholder credentials only
- No direct Production connection available from this environment

**Required Access:**
- **Read-only schema metadata** from Production database
- **NO customer/application data needed**
- **NO write permissions required**

**Schema Metadata Required:**
```sql
-- Tables & Columns
SELECT table_name, column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- Constraints (PK/FK/Unique/Check)
SELECT * FROM information_schema.table_constraints
WHERE table_schema = 'public';

-- Indexes
SELECT * FROM pg_indexes
WHERE schemaname = 'public';

-- Enums/Types
SELECT * FROM pg_type
WHERE typnamespace = 'public'::regnamespace;

-- Functions
SELECT * FROM information_schema.routines
WHERE routine_schema = 'public';

-- Views
SELECT * FROM information_schema.views
WHERE table_schema = 'public';

-- RLS Policies
SELECT * FROM pg_policies
WHERE schemaname = 'public';

-- Extensions
SELECT * FROM pg_extension;

-- Migration Ledger
SELECT * FROM _prisma_migrations ORDER BY started_at;
-- OR
SELECT * FROM supabase_migrations.schema_migrations;
```

**Options to Provide Access:**

**Option A: Direct Database Connection (Preferred)**
Provide read-only connection string:
```bash
postgresql://readonly_user:password@host:port/database
```

**Option B: Schema Dump Export**
Run from environment with Production access:
```bash
pg_dump -h [host] -U [user] -d [database] \
  --schema-only \
  --no-owner \
  --no-acl \
  -f production_schema_dump.sql
```

**Option C: Supabase CLI Export**
If using Supabase CLI with Production project linked:
```bash
supabase db dump --linked --schema public --data-only=false \
  -f production_schema.sql
```

**Option D: Manual Query Results**
Execute the schema metadata queries above and provide results as CSV/JSON.

---

**Status:** ⏸️ AWAITING Production schema access


---

## **Migration Ledger Architecture Investigation**

### **System Ownership: Supabase CLI (NOT Prisma)**

**Evidence:**

1. **Migration Runner:** `scripts/check-supabase-migrations.cjs`
   ```javascript
   npx supabase migration list --db-url $SUPABASE_DB_URL
   npx supabase db push --linked --yes
   ```

2. **Supabase Config:** `supabase/config.toml`
   ```toml
   [db.migrations]
   enabled = true
   schema_paths = []
   ```

3. **Native Ledger:** `supabase_migrations.schema_migrations`
   - Schema: `supabase_migrations` (Supabase-managed schema)
   - Table: `schema_migrations`
   - Columns: `version`, `statements`, `name`

4. **Manual Production Apply:** `supabase/APPLY_FEATURES_15_16_JUL_2026.sql`
   ```sql
   INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
   VALUES ('20260715200000', ARRAY['ALTER TABLE tenants'], 'enable_break_time_buffer')
   ON CONFLICT (version) DO NOTHING;
   ```

### **_prisma_migrations Mystery**

**Status:** Found in E2E schema dump, but NOT used by current migration system.

**Possible Origins:**
1. **Legacy Experiment:** Early development may have tested Prisma migrations before switching to Supabase CLI
2. **Product-Specific:** Some Bella products (Education OS?) may use Prisma independently
3. **Abandoned:** Table exists but is not actively maintained

**Recommendation:** Ignore `_prisma_migrations` for baseline transition. Use `supabase_migrations.schema_migrations` as authoritative ledger.

### **Baseline Transition Strategy (REVISED)**

**For Existing Databases (E2E, Production):**

```sql
-- Mark baseline as already applied (Supabase native ledger)
INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
VALUES (
    '20260916100000',
    ARRAY['CREATE TABLE tenants', 'CREATE TABLE users', '... (all baseline DDL)'],
    'baseline_v2_e2e_recovery'
)
ON CONFLICT (version) DO NOTHING;
```

**For New Databases (Clean Build):**
- Supabase CLI auto-tracks: `npx supabase db push`
- Ledger entry created automatically on successful apply

**Verification:**
```sql
SELECT version, name 
FROM supabase_migrations.schema_migrations 
WHERE version = '20260916100000';
```

### **Production Schema Access - Next Steps**

**Option 1: GitHub Secret Access (Preferred)**
Use the existing `PRODUCTION_SUPABASE_DB_URL` secret:

```bash
# In GitHub Actions or environment with secret access:
export SUPABASE_DB_URL="${PRODUCTION_SUPABASE_DB_URL}"
npx supabase db dump --db-url "$SUPABASE_DB_URL" \
  --schema public --data-only=false \
  -f production_schema.sql
```

**Option 2: Supabase Dashboard Manual Export**
1. Login to Supabase Dashboard: https://supabase.com/dashboard
2. Navigate to Production project
3. SQL Editor → Run metadata queries
4. Export results

**Option 3: Request Temporary Read-Only Credentials**
Generate read-only PostgreSQL role:
```sql
CREATE ROLE readonly_audit WITH LOGIN PASSWORD '[secure-password]';
GRANT CONNECT ON DATABASE postgres TO readonly_audit;
GRANT USAGE ON SCHEMA public TO readonly_audit;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_audit;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO readonly_audit;
-- Expires after audit:
ALTER ROLE readonly_audit VALID UNTIL '2026-09-17 23:59:59';
```

---

## **Updated Status**

```text
P0 BASELINE RECONCILIATION B0

Completed:
✅ E2E schema inventory (70 tables)
✅ Migration history analysis (305 references, 14/16 core missing)
✅ Migration ledger architecture verified (Supabase CLI, NOT Prisma)
✅ Baseline transition strategy designed

Blocked:
❌ Production schema inventory
❌ E2E ↔ Production reconciliation matrix

Next Action Required:
→ Obtain Production schema access (read-only, schema-only)
→ Options: GitHub secret access, Dashboard export, or temporary credentials
```

**Confidence Assessment:**
- E2E Schema: ✅ HIGH (direct dump obtained)
- Migration System: ✅ HIGH (Supabase CLI confirmed)
- Production Schema: ❌ ZERO (no access, no data)
- E2E ≈ Production: ❓ UNPROVEN (assumption only)

**Risk if proceeding without Production verification:**
- MEDIUM-HIGH: May generate baseline from E2E that diverges from actual Production
- Impact: Staging tests may pass, Production deployment may fail/corrupt
- Mitigation: MUST validate Production schema before B1

