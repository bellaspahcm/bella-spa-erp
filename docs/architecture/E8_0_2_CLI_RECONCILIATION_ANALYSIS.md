# E8.0.2: CLI Reconciliation Root Cause Analysis

**Date:** 2026-08-24  
**Status:** 🔍 ACTIVE INVESTIGATION  
**Type:** READ-ONLY (NO DATABASE MODIFICATIONS)

---

## Problem Statement

**Supabase CLI cannot reconcile 7 legacy migrations:**

```
20260820       |              | 20260820            (3 entries)
20260821       |              | 20260821            (4 entries)
```

**Symptom:** Remote column BLANK in `migration list`

**Impact:** CLI `db push` blocked

---

## Investigation Goal

**Determine:**
1. Why CLI cannot find these 7 migrations on remote
2. What makes them different from other migrations
3. Can reconciliation be fixed WITHOUT modifying schema_migrations?

---

## E7 Evidence (Baseline)

**From E7 investigation:**
- ✅ 16/16 migrations have exact local ↔ remote identity match
- ✅ 7 legacy migrations use abbreviated format (8-digit)
- ✅ Database provenance is CORRECT
- ✅ E7 verified: no corruption

**E7 conclusion:** Database truth > CLI representation

---

## CLI Reconciliation Mechanism

**CLI matches migrations by:**
1. Version string exact match
2. Migration file existence in local directory
3. Remote record in `schema_migrations` table

**Hypothesis:** CLI version matching logic doesn't handle:
- 8-digit abbreviated format (`20260820` vs `20260820000000`)
- Mixed format coexistence

---

## Investigation Steps

### Step 1: Identify Exact 7 Migrations
- [ ] List versions from `migration list` output
- [ ] Verify local file names
- [ ] Verify remote schema_migrations records

### Step 2: Analyze Version Format Discrepancy
- [ ] Compare 8-digit vs 14-digit format
- [ ] Check if remote records use abbreviated version
- [ ] Check if local files use full version

### Step 3: Check CLI Version Compatibility
- [ ] Current CLI version: 2.115.0
- [ ] Does CLI support mixed format?
- [ ] CLI changelog for migration reconciliation fixes

### Step 4: Explore CLI Configuration
- [ ] `supabase/config.toml` settings
- [ ] CLI feature flags
- [ ] Migration history reconciliation options

### Step 5: Test CLI Reconciliation Options
- [ ] `npx supabase migration repair` (READ-ONLY check)
- [ ] CLI migration history sync
- [ ] Any CLI command to refresh migration state

---

## Possible Solutions (Ranked by Safety)

### Option A: CLI Configuration Fix
**If CLI has reconciliation option:**
- ✅ No database modification
- ✅ No migration file modification
- ✅ Preserves E7 baseline
- ⚠️  Requires CLI support

### Option B: CLI Version Format Adapter
**If CLI can be configured to handle mixed format:**
- ✅ No database modification
- ✅ Preserves E7 baseline
- ⚠️  May require CLI update/config

### Option C: Local File Rename (RISKY)
**Rename local files to match remote format:**
- ⚠️  Changes migration identity
- ❌ Violates E7 principle (provenance is source of truth)
- ❌ May cause Git history divergence

### Option D: Remote Record Update (VERY RISKY)
**Update version in schema_migrations:**
- ❌ Modifies E7 baseline
- ❌ Violates provenance integrity
- ❌ NOT APPROVED

### Option E: Custom Deployment Adapter
**Build Bella Platform deployment mechanism:**
- ✅ Bypasses CLI reconciliation
- ✅ Preserves E7 baseline
- ✅ Establishes governance-safe deployment path
- ⚠️  Requires implementation

---

## Success Criteria

**E8.0.2 PASS requires:**
1. Root cause identified
2. Safe solution path determined
3. No E7 baseline modifications
4. Clear recommendation for E8.3 deployment

---

## Constraints

**DO NOT:**
- ❌ Modify schema_migrations
- ❌ Delete/rename migration files without governance approval
- ❌ Reset migration history
- ❌ Bypass provenance tracking

**PRESERVE:**
- ✅ E7 baseline integrity
- ✅ Database provenance
- ✅ Migration identity

---

## Next Steps

1. Execute Step 1-5 investigations
2. Evaluate Option A-E feasibility
3. Recommend deployment path for E8.3
4. Document governance boundary for future deployments

---

**DO NOT deploy E8 until E8.0.2 complete and path approved.**
