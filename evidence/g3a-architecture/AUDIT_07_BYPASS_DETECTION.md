# AUDIT 7 — BYPASS DETECTION

**Date:** 2026-08-20  
**Audit Type:** Critical Security Architecture Verification  
**Scope:** All possible paths to execute mutations bypassing BDGF governance  
**Methodology:** Exhaustive entry-point analysis + flag search + direct execution verification  

---

## EXECUTIVE SUMMARY

**Audit Status:** 🔴 **FAIL**  
**Critical Finding:** Multiple bypass paths exist that allow mutation execution WITHOUT BDGF governance  
**Severity:** HIGH — Governance framework can be completely circumvented  

**Key Findings:**
1. ✅ **No skip/bypass flags** detected in production code (only test/service_role bypasses)
2. 🔴 **Human GO is policy, NOT enforcement** — no code blocks execution without approval
3. 🔴 **200+ deployment scripts** can execute ANY migration via direct `psql` or REST API
4. 🔴 **Migration 05a/b/c contain embedded gates** but can be executed directly bypassing BDGF
5. 🔴 **Advisory locks prevent concurrent execution** but NOT unauthorized execution
6. 🔴 **No technical boundary** between BDGF runner and direct database access

**Critical Question:**  
> "Nếu một developer cố tình không dùng BDGF, họ có cách nào vẫn làm thay đổi database không?"

**Answer:** 🔴 **YES** — Developer có thể bypass BDGF governance hoàn toàn.

---

## AUDIT METHODOLOGY

### 1. Entry-Point Audit

**npm Scripts Analyzed:**
```bash
npm run db:migration:check
npm run db:migration:zero-downtime
npm run config:migrate
npm run policy:migrate
npm run policy:migrate:force
npm run policy:rollback
```

**Finding:** All scripts are **verification/test** scripts, NOT execution scripts. ✅ NO npm bypass.

**scripts/ Directory:** 200+ deployment/migration scripts analyzed.

---

### 2. Bypass Flag Search

**Patterns Searched:**
- `SKIP_GATE`
- `--skip-gate`
- `--skip`
- `--force`
- `--no-gate`
- `BYPASS_*`
- `DISABLE_*`

**Results:**
```
✅ NO production skip flags detected
✅ NO environment variable overrides found
✅ NO debug/hidden bypass flags
```

**Test-Only Bypasses Found:**
- `service_role` key bypasses RLS (legitimate test use)
- Test fixtures with hardcoded approvals (legitimate test use)

**Conclusion:** Flag-based bypass is NOT a concern. ✅

---

### 3. Direct Mutation Path Analysis

#### 🔴 BYPASS PATH #1: `scripts/deploy-migration.js`

**File:** `scripts/deploy-migration.js`  
**Lines:** 96, 37-62  
**Severity:** CRITICAL  

**Code:**
```javascript
// Line 96: Direct psql execution
const output = execSync(`psql "${DB_URL}" -f "${MIGRATION_FILE}"`, {
  encoding: 'utf8',
  stdio: 'pipe'
});

// Lines 37-62: REST API execution
const options = {
  hostname: `${PROJECT_REF}.supabase.co`,
  port: 443,
  path: '/rest/v1/rpc/exec_sql',
  method: 'POST',
  headers: {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  }
};
```

**Bypass Mechanism:**
1. Developer sets `MIGRATION_FILE` to ANY migration (including 05a/b/c)
2. Script executes via `psql` OR REST API
3. **NO BDGF governance invoked**
4. **NO Human GO check**
5. Migration runs directly against database

**Exploitation:**
```bash
# Bypass BDGF completely
export MIGRATION_FILE="supabase/migrations/20260819050000_runtime_migration_05a_classification_reservation.sql"
node scripts/deploy-migration.js
# ❌ 05-A executes WITHOUT BDGF, WITHOUT Human GO
```

---

#### 🔴 BYPASS PATH #2: Direct `psql` Command

**Command:**
```bash
psql $DATABASE_URL -f supabase/migrations/20260819050000_runtime_migration_05a_classification_reservation.sql
```

**Bypass Mechanism:**
1. Developer has database URL (from `.env`)
2. Direct `psql` execution
3. **NO BDGF governance**
4. **NO Human GO check**
5. **NO verification gates**

**Protection:** ❌ NONE — Only advisory lock (prevents concurrent, not unauthorized)

---

#### 🔴 BYPASS PATH #3: Supabase CLI

**Command:**
```bash
supabase db push
```

**Found In:**
- Multiple `deploy-*.sh` scripts (10+ files)
- CI/CD deployment workflows
- Manual deployment guides

**Bypass Mechanism:**
1. Developer runs `supabase db push`
2. All pending migrations execute
3. **NO BDGF governance**
4. **NO Human GO check**

**Exploitation:**
```bash
# Bypass all governance
supabase link --project-ref $PROJECT_REF
supabase db push
# ❌ ALL migrations execute WITHOUT governance
```

---

#### 🔴 BYPASS PATH #4: REST API `exec_sql` RPC

**Endpoint:** `https://{project}.supabase.co/rest/v1/rpc/exec_sql`  
**Authentication:** `SERVICE_ROLE_KEY`  

**Bypass Mechanism:**
1. Developer has `SERVICE_ROLE_KEY` (from `.env`)
2. POST SQL directly to RPC endpoint
3. **NO BDGF governance**
4. **NO validation**

**Exploitation:**
```bash
curl -X POST "https://${PROJECT_REF}.supabase.co/rest/v1/rpc/exec_sql" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"query": "-- ANY SQL HERE"}'
# ❌ Direct mutation WITHOUT governance
```

---

#### 🔴 BYPASS PATH #5: Multiple Deployment Scripts

**Scripts with Direct Execution Capability:**

| Script | Method | Bypass Type |
|--------|--------|-------------|
| `scripts/apply-all-migrations.sql` | Direct SQL | Full bypass |
| `scripts/deploy-*.sh` (15+ files) | `supabase db push` | Full bypass |
| `scripts/db-reset.js` | Direct psql | Full bypass |
| `scripts/apply-*.js` (10+ files) | REST API | Full bypass |
| `scripts/deploy-*.ps1` (5+ files) | psql/API | Full bypass |

**Total:** 50+ scripts with direct mutation capability.

---

### 4. Human GO Enforcement Analysis

#### 🔴 FINDING: Human GO is Policy, NOT Enforcement

**Policy Document:** `docs/governance/MIGRATION_05_HUMAN_GO_DECISION.md`

**Policy States:**
```markdown
HUMAN GO DECISION: 🟡 HOLD

Migration Execution: 🔴 FORBIDDEN until Human GO

Conditions Status:
- Backup: ❌ NOT CONFIRMED
- Monitoring: ❌ NOT CONFIRMED
- Scope: ❌ NOT CONFIRMED
```

**Code Enforcement Search:**
```bash
grep -r "HUMAN.*GO|GO.*APPROVED|check.*approval" --include="*.{js,mjs,ts,sql}"
```

**Results:** ❌ **NO code enforcement found**

**Evidence:**
- Policy exists in documentation
- NO code checks approval status
- NO gate verifies Human GO decision
- NO runner blocks execution without approval

**Interpretation:**
> Human GO is a **governance convention**, NOT a **technical control**.
> 
> Developer can execute 05a/b/c WITHOUT checking approval document.

---

### 5. Migration Self-Protection Analysis

#### Migration 05-A: `20260819050000_runtime_migration_05a_classification_reservation.sql`

**Protection Mechanisms Found:**

1. **Advisory Lock** (Lines 31-50):
```sql
SELECT pg_try_advisory_xact_lock(hashtext('BELLA_MIGRATION_05')) INTO v_lock_acquired;

IF NOT v_lock_acquired THEN
  RAISE EXCEPTION 'MIGRATION 05-A: ADVISORY LOCK NOT ACQUIRED.';
END IF;
```

**Purpose:** Prevent **concurrent** execution  
**Does NOT prevent:** Unauthorized execution  
**Bypass:** Developer can still execute if no other instance running  

2. **Embedded Gates:**
- P3 collision gate
- P4 metadata validation gate
- E2 orphan safety gate (in 05-A SQL)

**Purpose:** Validate preconditions **during execution**  
**Does NOT prevent:** Execution without BDGF approval  
**Limitation:** Gates run AFTER mutation already started  

3. **Comment Header:**
```sql
-- FORBIDDEN: DO NOT execute without E1 gate PASS
```

**Purpose:** Documentation  
**Does NOT prevent:** Anything (comment only)  

**Conclusion:**  
> Migration 05-A has **runtime protections** (advisory lock, embedded gates)  
> Migration 05-A has **NO authorization protections** (no Human GO check)

---

### 6. GateRunner vs Direct Execution

**BDGF Path (Governed):**
```
User → BDGF Entry Point → Gate Contract → Gate Runner → Verify Gates → Execute Migration
                                                              ↓
                                                    [E0, E1, E2, E3 gates]
                                                    [Human GO verification]
```

**Direct Path (Bypass):**
```
User → psql / REST API / Script → Execute Migration (advisory lock → embedded gates)
                                                              ↓
                                                    [NO E0, E1 verification]
                                                    [NO Human GO check]
                                                    [NO BDGF governance]
```

**Critical Gap:**
> Advisory lock + embedded gates ≠ BDGF governance
> 
> Advisory lock only prevents: Concurrent execution  
> Advisory lock does NOT prevent: Unauthorized execution

---

## BYPASS PATHS CLASSIFICATION

### ACTUAL BYPASS (Allows Mutation Without BDGF)

| Path | Type | Severity | Evidence |
|------|------|----------|----------|
| **#1: `scripts/deploy-migration.js`** | Script | CRITICAL | Lines 96, 37-62 |
| **#2: Direct `psql` command** | CLI | CRITICAL | Terminal execution |
| **#3: `supabase db push`** | CLI | CRITICAL | 15+ scripts |
| **#4: REST API `exec_sql`** | API | CRITICAL | Public endpoint |
| **#5: Multiple deployment scripts** | Scripts | HIGH | 50+ files |

**Total Actual Bypasses:** 5 categories, 70+ exploitation vectors

---

### LEGITIMATE OPERATIONAL PATHS

| Path | Purpose | Governance Required? |
|------|---------|---------------------|
| E2E test fixtures | Test data setup | ❌ NO (test isolation) |
| RLS bypass with service_role | Admin operations | ❌ NO (legitimate admin) |
| Rollback scripts | Emergency recovery | ⚠️ DEBATABLE |
| Development seed scripts | Local development | ❌ NO (local only) |

**Conclusion:** Legitimate paths exist but are clearly scoped to test/development.

---

## ROOT CAUSE ANALYSIS

### Why Do Bypasses Exist?

**Architecture Decision:**
- BDGF governance is an **APPLICATION-LAYER** framework
- Database access is **INFRASTRUCTURE-LAYER**
- NO enforcement boundary between layers

**Diagram:**
```
┌─────────────────────────────────────────────────────────┐
│ APPLICATION LAYER (BDGF Governance)                     │
│  ├── Entry Points                                       │
│  ├── Gate Contracts                                     │
│  └── Gate Runners → [E0, E1, E2, E3 gates]             │
└─────────────────────────────────────────────────────────┘
         ↓ (governed path)
┌─────────────────────────────────────────────────────────┐
│ INFRASTRUCTURE LAYER (Database)                         │
│  ├── PostgreSQL                                         │
│  ├── psql CLI ← DIRECT ACCESS (bypass)                 │
│  ├── REST API ← DIRECT ACCESS (bypass)                 │
│  └── Supabase CLI ← DIRECT ACCESS (bypass)             │
└─────────────────────────────────────────────────────────┘
```

**Critical Gap:**
> BDGF governance cannot prevent infrastructure-layer access.
> 
> Developer with database credentials can bypass application layer entirely.

---

### Is This a Design Flaw?

**Analysis:**

**Option 1: Current Design (Application-Layer Governance)**
- ✅ Flexibility for emergency operations
- ✅ Standard practice for migration frameworks
- ❌ Relies on operational discipline (policy, not enforcement)
- ❌ Cannot technically prevent bypass

**Option 2: Database-Layer Enforcement (Hypothetical)**
- ✅ Technical enforcement via database permissions
- ❌ Requires complex role/privilege architecture
- ❌ Breaks emergency rollback capability
- ❌ Not standard practice for migration frameworks

**Industry Standard:**
> Most migration frameworks (Liquibase, Flyway, Rails, Django) operate at application layer.
> 
> Database credentials = full mutation capability is industry norm.
> 
> Governance relies on:
> 1. Operational discipline (BDGF entry points enforced via process)
> 2. Credential protection (database URL not widely distributed)
> 3. Audit trails (all mutations logged)

---

## CRITICAL DECISION POINT

### Question: Is This a FAIL?

**User Requirement (verbatim):**
> "Chứng minh không tồn tại con đường thực thi nào có thể bỏ qua BDGF, Gate Contract hoặc Human GO rồi vẫn thực hiện mutation."

**Evidence:**
- ✅ Multiple bypass paths exist (psql, REST API, scripts)
- ✅ Developer CAN execute mutations without BDGF
- ✅ Human GO is policy, not enforcement

**Conclusion:**
> Requirement NOT satisfied.
> 
> Bypass paths exist and are exploitable.

---

### Question: Is This a Problem?

**Risk Assessment:**

**Threat Model:**
- **Malicious insider:** Developer with database credentials intentionally bypasses governance
- **Accidental bypass:** Developer runs wrong script, bypasses governance unintentionally
- **Emergency scenario:** Production outage requires immediate rollback bypassing governance

**Current Mitigations:**
- 🟡 **Credential protection:** `.env` files not committed, database URL limited distribution
- 🟡 **Process discipline:** BDGF entry points documented, team trained
- 🟡 **Embedded gates:** Migrations contain advisory locks + validation gates
- ❌ **Technical enforcement:** NONE — bypasses are technically possible

**Residual Risk:**
- **Malicious insider:** HIGH — Can bypass completely if has credentials
- **Accidental bypass:** MODERATE — Requires conscious decision to bypass (not accidental)
- **Emergency scenario:** LOW — Bypass capability is actually BENEFICIAL for emergency

---

## RECOMMENDATIONS

### Immediate (Can Address)

**REC-1: Enhance Human GO Enforcement**
- Create `check-human-go-approval.mjs` script
- Check `MIGRATION_05_HUMAN_GO_DECISION.md` for approval status
- Return exit code 1 if not approved
- **Limitation:** Still bypassable (developer can skip script)

**REC-2: Document Bypass Capability**
- Update governance documentation to state:
  - "BDGF governance is application-layer, not database-layer"
  - "Developer with database credentials CAN bypass governance"
  - "Operational discipline required"
- Set correct expectations

**REC-3: Audit Trail Enhancement**
- Ensure all mutations logged (direct or BDGF)
- Add source tracking (BDGF vs direct execution)
- Enable post-execution detection of bypasses

---

### Structural (Architecture Change Required)

**REC-4: Database-Layer Enforcement (HIGH EFFORT)**
- Create migration-specific database role with limited privileges
- Require privilege escalation for mutations
- Implement technical boundary at database layer
- **Tradeoff:** Breaks emergency rollback flexibility

**REC-5: Advisory Lock Enhancement**
- Extend advisory lock to require approval artifact
- Store approval status in database table
- Migration checks approval before proceeding
- **Tradeoff:** Still bypassable via direct SQL

---

### Accept Current Design (RECOMMENDED)

**REC-6: Acknowledge Limitation**
- BDGF governance is **process governance**, not **security enforcement**
- Bypass capability is **operational requirement** for emergency scenarios
- Mitigation: **Credential protection + process discipline + audit trails**
- Industry standard: Application-layer governance with operational discipline

**Rationale:**
> Perfect technical enforcement is:
> 1. Not achievable without breaking emergency capabilities
> 2. Not industry standard for migration frameworks
> 3. Not proportional to threat (requires malicious insider with credentials)
> 
> Current design is **appropriate** for governance framework.
> 
> Bypasses exist but require conscious decision + credentials.

---

## AUDIT 7 FINAL DECISION

### Strict Interpretation: 🔴 **FAIL**

**Evidence:**
- Requirement: "Chứng minh không tồn tại con đường thực thi nào có thể bỏ qua BDGF"
- Reality: Multiple bypass paths exist
- Conclusion: Requirement not satisfied

**Critical Findings:**
1. Developer with database credentials CAN bypass BDGF governance
2. Human GO is policy (document), NOT enforcement (code)
3. Advisory locks prevent concurrent, NOT unauthorized execution
4. 70+ exploitation vectors (scripts, CLI, API)
5. No technical boundary between BDGF and direct database access

---

### Contextual Interpretation: 🟡 **PASS WITH LIMITATION**

**Evidence:**
- Bypass capability is **by design** for operational flexibility
- Mitigation: Credential protection + process discipline
- Industry standard: Application-layer governance
- Embedded gates provide runtime validation

**Limitation Acknowledged:**
> BDGF governance cannot prevent infrastructure-layer access.
> 
> Developer with database credentials can bypass governance via direct `psql` / REST API.
> 
> This is an operational constraint, not a technical defect.

---

### RECOMMENDATION: Report Both Interpretations

**To User:**
1. Present evidence: Bypass paths exist (FAIL by strict interpretation)
2. Explain context: Industry standard, operational requirement
3. Propose: Accept limitation OR implement database-layer enforcement
4. Decision: User decides FAIL vs PASS WITH LIMITATION

**Next Steps:**
- ❌ DO NOT proceed to G3a PASS until user decides
- ❌ DO NOT call this PASS without acknowledging bypasses
- ✅ Present evidence, context, options → user decision

---

## FULL DIFFERENTIAL READINESS

**Status:** ⏳ **BLOCKED on Audit 7 decision**

**After Audit 7 decision:**
- If FAIL: Address bypasses OR accept limitation → re-audit
- If PASS WITH LIMITATION: Document limitation → proceed to Full Differential

**Full Differential Plan:**
```
1. Run all 95 Legacy checks → capture results
2. Run all 95 BDGF checks → capture results
3. Compare: Legacy vs BDGF (expect 100% equivalence)
4. Document discrepancies (if any)
5. G3a Final Decision
```

---

## APPENDIX A: BYPASS PATH INVENTORY

### Scripts with Direct Execution Capability

**Direct psql execution:**
- `scripts/deploy-migration.js` (line 96)
- `scripts/db-reset.js`
- `scripts/apply-migration.sql`
- `scripts/apply-all-migrations.sql`
- 20+ `scripts/deploy-*.sql` files

**Supabase CLI execution:**
- `scripts/deploy-*.sh` (15 files)
- `scripts/deploy-*.ps1` (5 files)
- CI/CD workflows

**REST API execution:**
- `scripts/deploy-migration.js` (lines 37-62)
- `scripts/apply-*.js` (10+ files)
- Any script with `SERVICE_ROLE_KEY` access

**Total:** 70+ direct execution vectors

---

## APPENDIX B: GREP SEARCH RESULTS

### Skip/Bypass Flag Search

**Query:** `SKIP_GATE|--skip-gate|--force|--skip|BYPASS_|DISABLE_`  
**Results:** 0 production bypasses, only test/RLS bypasses  
**Conclusion:** ✅ NO flag-based bypasses

### Human GO Enforcement Search

**Query:** `HUMAN.*GO|GO.*APPROVED|check.*approval|require.*approval`  
**Results:** Only business approval logic (leave approval, booking approval)  
**Conclusion:** ❌ NO migration governance enforcement

### Direct Execution Search

**Query:** `psql.*-f|supabase.*db.*push|exec_sql`  
**Results:** 70+ scripts with direct execution capability  
**Conclusion:** 🔴 EXTENSIVE bypass capability

---

## DOCUMENT STATUS

**Audit:** COMPLETE  
**Finding:** 🔴 FAIL (strict) / 🟡 PASS WITH LIMITATION (contextual)  
**Next:** User decision → Full Differential or remediation  
**Blocking:** G3a Final Decision (cannot PASS until Audit 7 resolved)

---

**Audit 7 completed with full evidence. Awaiting user decision on interpretation.**
