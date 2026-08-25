# E7: Canonical Migration Identity Audit — Execution Instructions

**Status:** 🟡 READY TO EXECUTE (read-only forensic)  
**Date:** 2026-08-24  
**Objective:** Prove exact local↔remote identity for 16 affected migrations

---

## Prerequisites

✅ **E7 Local Inventory:** PASS
- 16/16 local migration files found
- 7 legacy 8-digit format
- 9 standard 14-digit format
- 0 unexpected formats

**Next:** Execute SQL audit queries via Dashboard to compare with remote

---

## Execution Steps

### Step 1: Open Dashboard SQL Editor

1. Navigate to: Supabase Dashboard → SQL Editor
2. Ensure you're connected to the correct project

### Step 2: Execute E7 SQL Audit

**File:** `scripts/e7_canonical_identity_audit.sql`

**Method:**
1. Open `scripts/e7_canonical_identity_audit.sql`
2. Copy **entire script**
3. Paste into Dashboard SQL Editor
4. Click "Run"

**Expected:** 6 result sets (E7.1 through E7.6)

### Step 3: Capture Results

**For each result set, verify:**

#### E7.1: Enumerate Exact Remote Identities
- [ ] **Expected:** 16 rows
- [ ] **Check:** 7 LEGACY_8DIGIT + 9 STANDARD_14DIGIT
- [ ] **Verify:** All versions have non-null `name` and `statements`

#### E7.2: Classify Each Migration
- [ ] **Expected:** 16 rows, all `CLASS_A_EXACT_MATCH`
- [ ] **BLOCKED if:** Any `CLASS_B_DIVERGENCE` or `CLASS_D_LOCAL_ONLY`
- [ ] **Verify:** `local_version` = `remote_version` for all 16

#### E7.3: Verify 20260824000000 is FREE
- [ ] **Expected:** `FREE`
- [ ] **BLOCKED if:** `OCCUPIED`
- [ ] **Purpose:** Confirm RPC deployment version available

#### E7.4: Detect Remote-Only Migrations
- [ ] **Expected:** 0 rows
- [ ] **BLOCKED if:** Any `CLASS_C_REMOTE_ONLY` detected
- [ ] **Purpose:** Confirm no remote migrations without local files

#### E7.5: Full Identity Matrix
- [ ] **Expected:** 16 rows
- [ ] **Check:** All `identity_status` = `CLASS_A_*` (no `UNEXPECTED`)
- [ ] **Verify:** Format classification matches E7 local inventory

#### E7.6: Summary Report
- [ ] **Expected:** 2 rows
  - `LEGACY_8DIGIT`: 7 count
  - `STANDARD_14DIGIT`: 9 count
- [ ] **BLOCKED if:** Any `OTHER` format detected

---

## E7 Gate: PASS Conditions

**E7 PASS if ALL of the following:**

1. ✅ E7.1: Exactly 16 rows returned
2. ✅ E7.2: All 16 classifications = `CLASS_A_EXACT_MATCH`
3. ✅ E7.3: `20260824000000` status = `FREE`
4. ✅ E7.4: 0 `CLASS_C_REMOTE_ONLY` migrations
5. ✅ E7.5: All `identity_status` = `CLASS_A_*` (no `UNEXPECTED`)
6. ✅ E7.6: 7 `LEGACY_8DIGIT` + 9 `STANDARD_14DIGIT` = 16 total

**E7 BLOCKED if ANY of the following:**

- ❌ `CLASS_B_DIVERGENCE` detected (local version ≠ remote version)
- ❌ `CLASS_C_REMOTE_ONLY` detected (remote migration without local file)
- ❌ `20260824000000` status = `OCCUPIED`
- ❌ Total count ≠ 16
- ❌ Any `identity_status` = `UNEXPECTED`

---

## After E7 Execution

### If E7 PASS:

**Proven:**
- All 16 affected migrations have exact local↔remote identity match
- `20260824000000` is FREE for RPC deployment
- No identity divergence detected
- CLI reconciliation limitation is tooling issue, NOT provenance corruption

**Next Gate:** E8 Deployment Method Decision
- Option: Dashboard deployment (bypass CLI limitation)
- Maintain migration provenance integrity
- Record deployment in audit log

### If E7 BLOCKED:

**Stop immediately. Do NOT proceed with:**
- Migration repair
- Migration rename
- Dashboard deployment
- Any schema changes

**Required:**
- Investigate identity divergence
- Document findings
- Escalate to Human Architect for governance review

---

## Comparison Matrix

After executing SQL audit, create comparison table:

| Local Version | Local Format | Remote Version | Remote Name | Classification | Match |
|---------------|--------------|----------------|-------------|----------------|-------|
| `20260820_r4_3_gate` | LEGACY_8DIGIT | `20260820_r4_3_gate_tokens` | `r4_3_gate_tokens` | CLASS_A | ✅ |
| `20260820_r4_4_monitoring` | LEGACY_8DIGIT | ... | ... | CLASS_A | ✅ |
| ... | ... | ... | ... | ... | ... |

**All 16 rows must show:**
- Classification = `CLASS_A_EXACT_MATCH`
- Match = ✅

---

## Governance Checkpoint

**E7 Purpose:**
- Establish canonical provenance state BEFORE deployment
- Prove CLI limitation does NOT indicate provenance corruption
- Verify exact local↔remote identity independent of CLI

**E7 Does NOT:**
- Modify migration history
- Repair CLI reconciliation
- Deploy any migrations
- Change schema state

**Principle:** Verify provenance → deploy. Not: deploy → hope.

---

## Expected Timeline

- **E7 SQL execution:** ~30 seconds
- **Result verification:** ~5 minutes
- **Documentation:** ~10 minutes
- **Total:** ~15 minutes

---

## Files Generated

After E7 execution:

1. `docs/architecture/E7_CANONICAL_IDENTITY_AUDIT_RESULTS.md`
   - All 6 SQL result sets
   - PASS/BLOCKED determination
   - Comparison matrix

2. `docs/architecture/E7_GATE_STATUS.md`
   - Executive summary
   - Next steps
   - Architect decision required (if any)

---

## Commands

```bash
# E7 Local Inventory (already executed)
npx tsx scripts/e7_local_file_inventory.ts

# E7 SQL Audit (execute via Dashboard)
# Copy scripts/e7_canonical_identity_audit.sql
# Paste into Dashboard SQL Editor
# Click "Run"
```

---

## Human Architect: Ready to Execute

**Current status:**
- E6 COMPLETE: CLI reconciliation limitation confirmed
- E7 Local Inventory: PASS (16/16 files verified)
- E7 SQL Audit: READY TO EXECUTE

**Awaiting:**
- Human Architect to execute `e7_canonical_identity_audit.sql` via Dashboard
- Capture all 6 result sets
- Verify against PASS conditions
- Report E7 PASS or BLOCKED

**Do NOT proceed until E7 results verified.**
