# Bella Governance Files Index

**Purpose:** Quick reference for AI agents and IDEs to locate all governance documentation.

**Last Updated:** 2026-09-03

---

## 🎯 Entry Points (Read in Order)

### 1. AI Coding Contract (MUST READ FIRST)
- **File:** [`AI_CODING_CONTRACT.md`](../AI_CODING_CONTRACT.md)
- **Version:** 1.1
- **Purpose:** Canonical coding rules, Known Pattern workflow, frozen boundaries
- **Status:** ACTIVE

### 2. Architecture Principles
- **File:** [`AGENTS.md`](../AGENTS.md)
- **Purpose:** Bella architecture principles (Kernel-first, reuse before rebuild), Platform status
- **Status:** ACTIVE

### 3. AI Entry Point
- **File:** [`CLAUDE.md`](../CLAUDE.md)
- **Purpose:** Domain-specific documentation for AI agents
- **Status:** ACTIVE

---

## 📋 Governance Policies

### Known Pattern Rule
- **File:** [`docs/architecture/KNOWN_PATTERN_RULE_ADOPTION.md`](../docs/architecture/KNOWN_PATTERN_RULE_ADOPTION.md)
- **Status:** ACTIVE (field-tested)
- **Field Tests:** Host `6ee30569`, Real-Estate `6e5926ac`
- **Patterns:** 3 documented (duplicate exports, vocabulary/schema, import paths)

### Regression Gate Policy
- **File:** [`docs/architecture/GOVERNANCE_REGRESSION_GATE_POLICY.md`](../docs/architecture/GOVERNANCE_REGRESSION_GATE_POLICY.md)
- **Status:** CANONICAL
- **Purpose:** Baseline comparison protocol, Known Pattern integration

### Phase 1 Regression Protection
- **File:** [`docs/architecture/PHASE1_REGRESSION_PROTECTION_CLOSURE.md`](../docs/architecture/PHASE1_REGRESSION_PROTECTION_CLOSURE.md)
- **Status:** CLOSED / FIELD-TESTED
- **Date:** 2026-09-01

---

## 🔒 Architecture Guard

### Healthcare Kernel Constitution
- **File:** [`docs/architecture/HEALTHCARE_ARCHITECTURE_GUARD.md`](../docs/architecture/HEALTHCARE_ARCHITECTURE_GUARD.md)
- **Status:** ENFORCED
- **Kernels:** H1-H12 FROZEN

### Frozen Manifests
- **Education Kernel:** Constitution compliance required
- **Logistics E7 Kernel:** SEALED

---

## 📊 Platform Status

**Current State (2026-09-03):**
```
40 PASS / 3 FAIL / 1 HOTSPOT

✅ RESOLVED:
  - Real-Estate: 3→0 (commit 6e5926ac)

❌ BASELINE:
  - Host: 47 diagnostics (next target)
  - Healthcare: 16 diagnostics (example code)
  - Education: 102 diagnostics

🔥 HOTSPOT:
  - Logistics: >30s timeout
```

---

## 🛠️ Commands Reference

### Gate B — TypeScript Compliance
```bash
npm run governance:typecheck
```
**Purpose:** Check all 44 scopes for TypeScript errors

### Regression Protection
```bash
npm run governance:check-regression
```
**Exit Codes:**
- 0 (ALLOW) = no new regressions
- 1 (BLOCK) = new regressions detected
- 2 (ERROR) = baseline missing

### Architecture Guard
```bash
npm run arch:guard
```
**Purpose:** Verify no frozen kernel modifications

### Capture Baseline
```bash
npm run governance:baseline
```
**Purpose:** Create/update diagnostic baseline

---

## 📖 Evidence & Field Tests

### Host Field Test
- **Commit:** `6ee30569`
- **Pattern:** Duplicate export blocks
- **Result:** 59→47 diagnostics
- **File:** `src/platform/host/feature-flags/types.ts`

### Real-Estate Field Test
- **Commit:** `6e5926ac`
- **Pattern:** Vocabulary/schema mismatch
- **Result:** 3→0 diagnostics
- **Evidence:** [`docs/architecture/REAL_ESTATE_OWNERSHIP_INVESTIGATION.md`](../docs/architecture/REAL_ESTATE_OWNERSHIP_INVESTIGATION.md)
- **Migration:** `supabase/migrations/20260802100000_fix_partner_portal_schema_conflicts.sql`

### P1 Overall Closure
- **File:** [`docs/architecture/P1_OVERALL_CLOSURE.md`](../docs/architecture/P1_OVERALL_CLOSURE.md)
- **Date:** 2026-09-01
- **Status:** CLOSED with evidence integrity

### Runtime Regression Evidence
- **File:** [`docs/architecture/P1_RUNTIME_REGRESSION_EVIDENCE.md`](../docs/architecture/P1_RUNTIME_REGRESSION_EVIDENCE.md)
- **Purpose:** Baseline comparison protocol evidence

---

## 🎓 Known Patterns Registry

**Patterns are "known" ONLY when documented with evidence.**

### 1. Duplicate Export Blocks
- **Fix:** Mechanical removal
- **Evidence:** Host `6ee30569`
- **Criteria:** Types exported inline AND in export block

### 2. Vocabulary/Schema Mismatch
- **Fix:** Align to DB enum (when DB is canonical)
- **Evidence:** Real-Estate `6e5926ac` + migration evidence
- **Criteria:** Migration shows explicit mapping, DB enum authoritative

### 3. Import Path Errors
- **Fix:** Correct module path
- **Evidence:** Multiple fixes with clear boundaries
- **Criteria:** Module boundaries unambiguous

**Adding new patterns:** Requires investigation, documentation, and field test evidence.

---

## 🚦 Engineering Workflow

```text
Diagnostic Detected
    ↓
Pattern Classification
    ├─ Known Pattern
    │   ├─ Evidence documented? YES
    │   ├─ Ownership clear? YES
    │   ├─ Semantics unambiguous? YES
    │   └→ Minimal Fix → Mandatory Gates → Commit
    │
    └─ New/Ambiguous Pattern
        └→ STOP → Investigate → Document → Fix → Gates → Commit

Mandatory Gates (NEVER bypassed):
  1. TypeScript Check (Gate B)
  2. Regression Protection
  3. Architecture Guard
  4. Relevant Tests
```

---

## ⚠️ STOP Conditions

**Immediately STOP coding if:**
1. Root cause unclear
2. Canonical ownership ambiguous
3. Schema/contract/enum semantics uncertain
4. Cross-Kernel boundaries affected
5. Frozen code modification required without ACR
6. "Fix" requires guessing mapping/semantics
7. TypeCheck PASS but semantics unclear
8. Regression check shows new fingerprints
9. New semantic ambiguity emerges during known pattern fix

**Document the blocker. Wait for human decision.**

---

## 🔄 Governance Status

**Phase 1 Regression Protection:** ✅ CLOSED / FIELD-TESTED  
**Known Pattern Rule:** ✅ ACTIVE  
**Gate B:** 🔒 VERIFIED / FROZEN  
**Architecture Guard:** ✅ ENFORCED  
**Governance Expansion:** 🔒 STOPPED (no new infrastructure until proven need)

**Engineering Status:** ✅ ACTIVE (Host remediation next)

---

## 📚 Related Documentation

### Forensic Evidence
- Healthcare: [`docs/architecture/P1_HEALTHCARE_PROVENANCE_COMPLETE.md`](../docs/architecture/P1_HEALTHCARE_PROVENANCE_COMPLETE.md)
- Logistics: [`docs/architecture/P1_LOGISTICS_PRODUCTS_FORENSICS.md`](../docs/architecture/P1_LOGISTICS_PRODUCTS_FORENSICS.md)
- Forensic Remediation: [`docs/architecture/P1_FORENSIC_REMEDIATION_COMPLETE.md`](../docs/architecture/P1_FORENSIC_REMEDIATION_COMPLETE.md)

### Investigation Records
- Compiler: [`docs/architecture/P1_COMPILER_BOTTLENECK_INVESTIGATION.md`](../docs/architecture/P1_COMPILER_BOTTLENECK_INVESTIGATION.md)
- Cluster Status: [`docs/architecture/P1_CLUSTER_STATUS_SUMMARY.md`](../docs/architecture/P1_CLUSTER_STATUS_SUMMARY.md)

---

## 🎯 Quick Start for New AI Agent

**Before coding on Bella:**

1. Read [`AI_CODING_CONTRACT.md`](../AI_CODING_CONTRACT.md) (MANDATORY)
2. Read [`AGENTS.md`](../AGENTS.md) (architecture principles)
3. Check Platform Status (in this file or AGENTS.md)
4. Review Known Patterns (above)
5. Run `npm run governance:typecheck` to see current state

**When fixing diagnostics:**
- Classify pattern first
- Known pattern → fix quickly, run gates
- New pattern → STOP, investigate, document
- ALL fixes must pass mandatory gates

**Success = Fix real errors + Zero regressions + Proper documentation**

---

**Index Status:** CANONICAL  
**Last Updated:** 2026-09-03  
**Commit Chain:** b19aba78 → 57b54035 → 6ee30569 → 8750beb4 → 6e5926ac → 1876ccab → f0ac378f → e9464473 → f2be19e0

**This index provides complete governance context for any AI coding agent or IDE.**
