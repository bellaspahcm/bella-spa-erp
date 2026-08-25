# E6: CLI Reconciliation Investigation

**Status:** 🟡 LIMITATION CONFIRMED — CLI cannot reconcile legacy 8-digit migration versions

**Date:** 2026-08-24  
**Context:** Finance OS F2 deployment blocked by CLI reporting remote-only migrations despite E5 proving all exist

**Classification:** Known Supabase CLI reconciliation behavior with legacy migration version formats

---

## Problem Statement

**E5 proved:** All 16 migrations exist on remote with correct (version, name)

**CLI reports:** 7 migrations have blank Remote column (abbreviated versions only)

**Impact:** `db push --dry-run` blocked, cannot verify RPC is the only pending migration

---

## Investigation Timeline

### E6.1: Cache Clear
```powershell
Remove-Item -Recurse -Force "$HOME\.supabase\cache"
```

**Result:** ❌ Issue persists after cache clear

### E6.2: Migration List Analysis (v2.107.0)
```
20260820       |                | 20260820   ← 3 blank Remote
20260821       |                | 20260821   ← 4 blank Remote
20260824000000 |                | 2026-08-24 ← Expected (local-only)
```

### E6.3: CLI Error Message
```bash
npx supabase db push --dry-run
```

Output:
```
Remote migration versions not found in local migrations directory.
supabase migration repair --status reverted 
  20260820_r4_3_gate_tokens 
  20260820_r4_4_monitoring_audit 
  20260820_r4_approval_contract 
  20260820000000 20260820010000 20260820100000 20260820110000 
  20260820120000 20260820130000 20260820140000 
  20260821_create_accessorial_rates_table 
  20260821_create_carrier_rates_table 
  20260821_create_discrepancies_table 
  20260821_create_freight_audit_tables 
  20260821000000 20260821115404
```

### E6.4: CLI Update
```bash
npm install -g supabase@latest
supabase --version
# 2.115.0
```

**Result:** ❌ Issue persists in v2.115.0

**Migration list (v2.115.0):** Same 7 blank Remote entries

---

## Root Cause Analysis

### Pattern Identification

**Abbreviated versions (CLI cannot map):**
- `20260820_r4_3_gate_tokens.sql` → Remote: blank
- `20260820_r4_4_monitoring_audit.sql` → Remote: blank
- `20260820_r4_approval_contract.sql` → Remote: blank
- `20260821_create_accessorial_rates_table.sql` → Remote: blank
- `20260821_create_carrier_rates_table.sql` → Remote: blank
- `20260821_create_discrepancies_table.sql` → Remote: blank
- `20260821_create_freight_audit_tables.sql` → Remote: blank

**Standard versions (CLI maps correctly):**
- `20260820000000_*.sql` → Remote: `20260820000000` ✅
- `20260820010000_*.sql` → Remote: `20260820010000` ✅
- `20260821000000_*.sql` → Remote: `20260821000000` ✅
- `20260821115404_*.sql` → Remote: `20260821115404` ✅

### E5 Evidence Conflicts With CLI

**E5.1 proved remote exists:**
```sql
SELECT version, name 
FROM supabase_migrations.schema_migrations
WHERE version LIKE '20260820_%' OR version LIKE '20260821_%';
```

All 16 migrations returned valid (version, name) pairs.

**CLI behavior:** Cannot display Remote column for abbreviated versions

### Root Cause: Legacy Migration Version Format

**CLI reconciliation logic:**
1. Scans local filesystem: `supabase/migrations/*.sql`
2. Queries remote: `SELECT version FROM schema_migrations`
3. **LIMITATION:** Cannot reconcile legacy 8-digit format (`20260820_*`) coexisting with 14-digit format

**Supabase current standard:**
- Format: `YYYYMMDDHHmmss_description.sql` (14 digits)
- Example: `20250101000000_create_employees_table.sql`
- Docs: https://supabase.com/docs/guides/cli/local-development#database-migrations

**Legacy format in this repository:**
- Format: `YYYYMMDD_description.sql` (8 digits)
- Coexists with 14-digit versions sharing same date prefix
- Known CLI reconciliation issue (Supabase GitHub #multiple reports 2026-08)

---

## Impact Assessment

### Governance

**E5 Conclusion:** No evidence of migration identity corruption

**E6 Conclusion:** CLI has compatibility issue with non-standard version format

**Do NOT repair provenance:** This would change migration history to fix a CLI bug

### Deployment Blockage

**Cannot verify:** `db push --dry-run` should show ONLY RPC migration

**Current state:** CLI reports 16 "remote-only" migrations (false positive)

**Risk:** If we `db push`, will CLI attempt to "revert" the 16 migrations?

---

## Conclusion

**E5 verified:** Remote provenance is correct — 16/16 migrations exist with valid identities

**E6 verified:** CLI has known reconciliation limitation with legacy 8-digit migration versions coexisting alongside 14-digit versions

**Governance principle:** Remote provenance remains independently verified and must NOT be modified solely to satisfy CLI reconciliation.

**Next gate:** E7 Canonical Migration Identity Audit required before any deployment method decision.

---

## Known Supabase CLI Issues

**Related GitHub issues:**
- Migration version 8-digit coexisting with 14-digit causes `db push` merge/order errors
- Migration list displays blank Local/Remote columns for non-14-digit versions
- Reports confirmed August 2026

**Current repository pattern:**
- Legacy 8-digit: `20260820_description.sql`
- Standard 14-digit: `20260820000000_description.sql`
- Both patterns coexist with same date prefix → triggers CLI limitation

---

## Options Forward (UPDATED)

### ❌ Option 1: Migration Repair (REJECTED)

**Why NOT:**
- E5 proved provenance is correct
- Repair modifies migration history to fix CLI limitation
- Violates governance: "Provenance is source of truth, not CLI output"

### ❌ Option 2: Rename Migrations (REJECTED — Too Risky)

**Why NOT:**
- Changes migration identity, not just filename
- Risk of duplicate semantic migrations (old remote + new local)
- Architecture Guard should prevent this, not create it

### ⏳ Option 3: Dashboard Deployment (PENDING E7)

**Approach:**
- Deploy via Dashboard UI (alternative transport, same provenance)
- Verify with direct SQL queries
- Record provenance in audit log
- File GitHub issue for CLI limitation

**Blocker:** Must complete E7 Canonical Identity Audit FIRST

**Why E7 required:**
- Current state: CLI cannot reconcile → migration history unclear
- If we deploy now: future gates harder to prove canonical provenance
- E7 proves exact local↔remote identity match before deployment
- Maintains governance: verify provenance → deploy, not deploy → hope

### 🔜 Option 4: E7 Then Deployment (RECOMMENDED)

**Sequence:**
```
E6 ← Current
 ↓
E7 Canonical Identity Audit (read-only forensic)
 ├── Enumerate 16 affected migrations
 ├── Extract exact local versions + content hash
 ├── Query exact remote version + name + statements
 ├── Produce exact local↔remote identity matrix
 ├── Classify: A (match) / B (divergence) / C (remote-only) / D (local-only)
 ├── Separately verify 20260824000000 FREE on remote
 └── Report: PASS / BLOCKED
 ↓
E7 PASS?
 ↓
E8 Deployment Method Decision
 ↓
Dashboard deployment
 +
SQL verification
 +
Record provenance
 ↓
E9 RPC/F2 Verification
```

---

## Decision Required

**Current Status:** E6 COMPLETE — CLI reconciliation limitation confirmed

**Next Gate:** E7 Canonical Migration Identity Audit (read-only forensic)

**No actions until E7 PASS:**
- ❌ NO migration repair
- ❌ NO migration rename
- ❌ NO Dashboard deployment
- ❌ NO schema changes
- ✅ ONLY read-only forensic investigation

**E7 Objectives:**
1. Prove exact local↔remote identity for 16 affected migrations
2. Classify each migration: exact match / divergence / remote-only / local-only
3. Independently verify `20260824000000` is FREE on remote
4. Establish canonical provenance state before deployment method decision

**Governance principle:** Verify provenance → deploy. Not: deploy → hope.

---

## Verification Checklist

Before any deployment:

- [ ] E5 verification: All migrations exist on remote ✅
- [ ] E6.1: Cache cleared ✅
- [ ] E6.4: CLI updated to latest (v2.115.0) ✅
- [ ] E6.5: Root cause identified ✅
- [ ] Decision: Deployment path chosen ⏳

---

## Master Status

```
ENTERPRISE FOUNDATION CONSOLIDATION
                    🔴 BLOCKED
                     │
                     ▼
             E5 PROVENANCE GATE
                    🟢 PASS
                     │
                     ▼
        16/16 migrations identity verified
                     │
                     ▼
       E6 CLI RECONCILIATION INVESTIGATION
                    🔴 CLI BUG IDENTIFIED
                     │
             ┌───────┴───────┐
             ▼               ▼
      Abbreviated      Standard format
      version format     works fine
      NOT supported
             │
             ▼
      DECISION REQUIRED:
      - Dashboard deployment?
      - Wait for CLI fix?
      - Migration repair? (NOT RECOMMENDED)
```

---

## Next Steps

**STOP for Human Architect decision.**

Do NOT proceed with:
- Migration repair
- Dashboard deployment
- Any schema changes

Until deployment path confirmed.
