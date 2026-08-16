# 🛡️ SECURITY GATE PROTOCOL - RLS AUDIT & TENANT ISOLATION

**STATUS:** 🔴 IN PROGRESS  
**TRIGGER:** F5 Hardening discovered `USING (true)` RLS violations  
**SEVERITY:** P0 - Gate 0 Constitutional Violation  
**BLOCKING:** F5 Feature Implementation (PAUSED until Security Gate PASS)

---

## 🚨 CRITICAL FINDINGS (Preliminary)

### Healthcare Tables (`hc_*`)
**SOURCE:** `supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:169`

```sql
-- ❌ VIOLATION: USING (true) bypasses tenant isolation
CREATE POLICY "hc_mpi_tenant_policy" 
ON public.hc_master_patient_index
FOR ALL TO authenticated
USING (true);  -- 🚨 ANY authenticated user can see ALL patients
```

**Affected Tables:**
- `hc_master_patient_index` ← Patient identity (HIPAA-critical)
- `hc_inpatient_admissions` ← Patient PHI
- `hc_nursing_vital_signs` ← Clinical data
- `hc_medication_administration_records` ← MAR (patient safety risk)
- `hc_buildings`, `hc_wards`, `hc_rooms`, `hc_beds`
- `hc_security_break_glass_logs`, `hc_enterprise_registries`

### Real Estate Tables (`re_*`, `rm_*`)
**SOURCE:** `supabase/migrations/20260801010000_real_estate_foundation_tables.sql:163`

```sql
-- ❌ VIOLATION: USING (true) bypasses tenant isolation
CREATE POLICY "Allow authenticated users full access to re_zones"
ON public.re_zones
FOR ALL TO authenticated
USING (true);  -- 🚨 Cross-tenant pricing/inventory leak
```

**Affected Tables:**
- `re_zones`, `re_blocks`
- `re_price_lists`, `re_product_prices` ← Commercially sensitive
- `re_promotions`, `re_price_history`
- `rm_inventory_matrix` ← Competitive intelligence

---

## 🎯 SECURITY GATE WORKFLOW

```
F5 PAUSED
    ↓
Gate 1: RLS Global Inventory
    ↓
Gate 2: Classify Violations (SAFE / SUSPICIOUS / CRITICAL)
    ↓
Gate 3: Verify Remote State
    ↓
Gate 4: Migration History Reconciliation
    ↓
Gate 5: Cross-Tenant Adversarial Testing
    ↓
Gate 6: Design Fix (DROP + CREATE, not just CREATE)
    ↓
Gate 7: Apply Fix Migrations
    ↓
Gate 8: Re-run Adversarial Tests
    ↓
Gate 9: Freeze & Document
    ↓
SECURITY GATE PASS ✓
    ↓
Resume F5 Implementation
```

---

## 📋 GATE 1: RLS GLOBAL INVENTORY

### Objectives
1. Enumerate **ALL** RLS policies across **ALL** tables
2. Find **ALL** `USING (true)` violations
3. Find **ALL** `WITH CHECK (true)` violations
4. Identify tables with `tenant_id` but no RLS
5. Check policy type (PERMISSIVE vs RESTRICTIVE)
6. Check policy roles (anon / authenticated / service_role)

### Tools
- **Audit Script:** `scripts/security/rls-audit.sql`
- **Run:** `psql -f scripts/security/rls-audit.sql > docs/security/RLS_AUDIT_REPORT.txt`

### Scope
- ✅ Healthcare (`hc_*`)
- ✅ Real Estate (`re_*`, `rm_*`)
- ⏳ Finance (`finance_*`)
- ⏳ Spa legacy (`customers`, `bookings`, `revenue`, `expenses`)
- ⏳ Shared/platform tables
- ⏳ Education (if exists)

### Success Criteria
- Complete inventory of ALL policies
- No table with `tenant_id` missing RLS
- Classification: SAFE / SUSPICIOUS / CRITICAL

---

## 📋 GATE 2: CLASSIFY VIOLATIONS

### Classification Matrix

| Category | Definition | Example | Action |
|----------|-----------|---------|--------|
| **SAFE** | `USING (true)` for service_role only | System tables | Document, no fix |
| **SAFE** | Intentional public table (no tenant_id) | `countries`, `currencies` | Document, no fix |
| **SUSPICIOUS** | `USING (true)` for authenticated, no tenant data | Lookup tables | Review, may fix |
| **CRITICAL** | `USING (true)` for authenticated + tenant_id | Healthcare, RE, Finance | FIX IMMEDIATELY |

### CRITICAL Violations (P0)

**Definition:**
```
USING (true) 
+ TO authenticated 
+ table has tenant_id column
+ table contains tenant-owned data
```

**Impact:**
- Healthcare → HIPAA violation, patient data leak
- Real Estate → Competitive intelligence leak
- Finance → Cross-tenant GL visibility

---

## 📋 GATE 3: VERIFY REMOTE STATE

### Objectives
1. Run audit script on **REMOTE** database (not local)
2. Confirm which migrations actually applied
3. Check if hardening migration `20260523010000` applied

### How
```bash
# Connect to remote Supabase
npx supabase db remote --linked

# Run audit
psql <connection-string> -f scripts/security/rls-audit.sql > docs/security/REMOTE_RLS_AUDIT.txt

# Compare with local
diff docs/security/RLS_AUDIT_REPORT.txt docs/security/REMOTE_RLS_AUDIT.txt
```

### Success Criteria
- Know exact remote policy state
- Identify drift between local migrations and remote state

---

## 📋 GATE 4: MIGRATION HISTORY RECONCILIATION

### Problem
```
supabase/migrations/ contains:
- .SKIP files (experiments)
- .APPLIED files (manual runs)
- .PARTIAL files (incomplete)
- duplicate timestamps
- MANUAL_*.sql files
```

### Objectives
1. Identify which migrations were applied manually to remote
2. Reconcile `.SKIP` / `.APPLIED` / `.PARTIAL` files
3. Ensure migration history is linear and reproducible
4. Fix duplicate timestamps properly

### Actions
- [ ] List remote migrations: `SELECT * FROM supabase_migrations.schema_migrations ORDER BY version;`
- [ ] Compare with local `supabase/migrations/` directory
- [ ] Document remote-only migrations
- [ ] Archive `.SKIP` / `.APPLIED` / `.PARTIAL` to `supabase/migrations/archive/`
- [ ] Resolve timestamp conflicts

### ⚠️ DO NOT
- ❌ Run `--include-all` before reconciliation complete
- ❌ Assume renaming timestamp fixes remote state

---

## 📋 GATE 5: CROSS-TENANT ADVERSARIAL TESTING

### Objectives
Prove tenant isolation works (or expose violations).

### Test Matrix

| Test | Expected Result |
|------|----------------|
| User A → SELECT Tenant A data | ✅ ALLOW |
| User A → SELECT Tenant B data | ❌ DENY |
| User B → SELECT Tenant A data | ❌ DENY |
| User B → SELECT Tenant B data | ✅ ALLOW |
| User A → INSERT Tenant B record | ❌ DENY |
| User A → UPDATE Tenant B record | ❌ DENY |
| User A → DELETE Tenant B record | ❌ DENY |

### Critical Tables to Test
- Healthcare: `hc_master_patient_index`, `hc_inpatient_admissions`, `hc_nursing_vital_signs`
- Real Estate: `re_price_lists`, `rm_inventory_matrix`
- Finance: `finance_transactions`
- Core: `customers`, `revenue`, `expenses`

### Tools
- **Test Suite:** `src/__tests__/security/cross-tenant-isolation.test.ts`
- **Run:** `npm test -- cross-tenant-isolation`

### Success Criteria
- ALL cross-tenant reads return empty (not error, but filtered)
- ALL cross-tenant writes fail with RLS violation error

---

## 📋 GATE 6: DESIGN FIX

### Principles

#### ✅ DO
1. **DROP old policy first:**
   ```sql
   DROP POLICY IF EXISTS "old_policy" ON table_name;
   CREATE POLICY "new_policy" ON table_name ...;
   ```

2. **Fix BOTH `USING` and `WITH CHECK`:**
   ```sql
   CREATE POLICY "tenant_isolation" ON table_name
   FOR ALL TO authenticated, service_role
   USING (
       current_user IN ('service_role', 'postgres', 'supabase_admin')
       OR tenant_id = public.get_auth_tenant_id()
   )
   WITH CHECK (  -- ← Don't forget!
       current_user IN ('service_role', 'postgres', 'supabase_admin')
       OR tenant_id = public.get_auth_tenant_id()
   );
   ```

3. **Service role exception:**
   - `service_role` can cross tenants (system operations)
   - `authenticated` users CANNOT cross tenants

#### ❌ DON'T
- ❌ Only fix `USING`, forget `WITH CHECK`
- ❌ Only fix `SELECT`, forget `INSERT/UPDATE/DELETE`
- ❌ Create new policy without dropping old `USING (true)` policy

### Migration Template
```sql
-- Migration: YYYYMMDDHHMMSS_fix_<vertical>_rls_tenant_isolation.sql

-- For each table:
DROP POLICY IF EXISTS "old_permissive_policy" ON table_name;

CREATE POLICY "table_name_tenant_isolation" ON table_name
    FOR ALL TO authenticated, service_role
    USING (
        current_user IN ('service_role', 'postgres', 'supabase_admin')
        OR tenant_id = public.get_auth_tenant_id()
    )
    WITH CHECK (
        current_user IN ('service_role', 'postgres', 'supabase_admin')
        OR tenant_id = public.get_auth_tenant_id()
    );

COMMENT ON POLICY "table_name_tenant_isolation" ON table_name IS
    'P0 Gate 0: Strict tenant isolation. Service roles can cross tenants for system operations.';
```

---

## 📋 GATE 7: APPLY FIX MIGRATIONS

### Process
1. Review migration with human architect
2. Test in local database first
3. Run adversarial tests locally (should PASS)
4. Apply to remote with explicit confirmation
5. Monitor for errors

### Commands
```bash
# Local test
npm run db:reset
npm test -- cross-tenant-isolation

# Apply to remote (only after approval)
npx supabase db push --linked

# Verify
psql <remote> -f scripts/security/rls-audit.sql
```

---

## 📋 GATE 8: RE-RUN ADVERSARIAL TESTS

After applying fix migrations, re-run cross-tenant tests on **REMOTE** database.

**Expected:**
- ✅ ALL cross-tenant access attempts DENIED
- ✅ Same-tenant access ALLOWED
- ✅ Service role can cross tenants

---

## 📋 GATE 9: FREEZE & DOCUMENT

### Deliverables
1. `docs/security/RLS_AUDIT_REPORT.txt` (before)
2. `docs/security/RLS_AUDIT_REPORT_AFTER_FIX.txt` (after)
3. `docs/security/CROSS_TENANT_TEST_RESULTS.md`
4. Update `CHANGELOG.md` with security fix
5. Git tag: `security-gate-v1-pass`

### Freeze Statement
```
🛡️ SECURITY GATE PASS

Date: YYYY-MM-DD
Scope: Healthcare, Real Estate, Finance, Core
Violations Fixed: X tables, Y policies
Adversarial Tests: Z/Z PASS

Tenant isolation now enforced at Gate 0 level.
F5 implementation may resume.
```

---

## 🚫 BLOCKING ISSUES

### Current Blockers
1. ⏳ Migration history unclear (`.SKIP`, `.APPLIED`, `.PARTIAL` files)
2. ⏳ Remote state not verified
3. ⏳ Cross-tenant tests not implemented (JWT context needed)
4. ⏳ Fix migrations created but not reviewed

### DO NOT PROCEED UNTIL
- [ ] Gate 1 complete (full inventory)
- [ ] Gate 3 complete (remote state verified)
- [ ] Gate 4 complete (migration history reconciled)
- [ ] Gate 5 complete (adversarial tests pass)

---

## 📊 CURRENT STATUS

| Gate | Status | Blocker |
|------|--------|---------|
| Gate 1: Inventory | 🟡 IN PROGRESS | Audit script created, not run on remote |
| Gate 2: Classify | 🔴 BLOCKED | Need Gate 1 output |
| Gate 3: Verify Remote | 🔴 BLOCKED | Not started |
| Gate 4: Migration History | 🔴 BLOCKED | Not started |
| Gate 5: Adversarial Test | 🟡 IN PROGRESS | Test template created, JWT context needed |
| Gate 6: Design Fix | 🟡 PARTIAL | Migrations created but not reviewed |
| Gate 7: Apply Fix | 🔴 BLOCKED | Gates 1-5 not complete |
| Gate 8: Re-test | 🔴 BLOCKED | Gate 7 not complete |
| Gate 9: Freeze | 🔴 BLOCKED | Gate 8 not complete |

---

## 📞 ESCALATION

If ANY gate fails or reveals unexpected violations:
1. **STOP** immediately
2. Document findings
3. Escalate to Human Architect
4. Do NOT attempt to fix without approval

---

**Last Updated:** 2026-08-16  
**Owner:** Security Audit Team  
**Reviewer:** Human Architect (pending)
