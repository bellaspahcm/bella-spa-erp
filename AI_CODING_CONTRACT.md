# Bella AI Coding Contract

**Version:** 1.2  
**Last Updated:** 2026-09-03  
**Status:** Active

This document defines the rules that ANY AI coding agent must follow when working on Bella Platform. These rules are non-negotiable and backed by automated gates.

---

## Core Principles

1. **Evidence before infrastructure**
2. **Kernel-first, not kernel-perfect**
3. **Reuse before rebuild**
4. **Minimal complexity**
5. **No claim without evidence**

---

## Before Any Code Change

### 1. Inventory First, Code Later

❌ **WRONG:**
```
See error → write fix → commit
```

✅ **CORRECT:**
```
See error → inventory scope → gather evidence → verify ownership
→ root cause analysis → minimal fix → validate → commit
```

### 2. Never Guess Semantics

**STOP if any of these are unclear:**
- Schema ownership (which is canonical: domain or database?)
- Contract semantics (does type rename change behavior?)
- Enum mappings (what is the authoritative source?)
- RPC protocol changes (are they backward-compatible?)
- Domain boundaries (which Kernel owns this logic?)

**When ownership is ambiguous:**
- Document the ambiguity
- **Do NOT implement a guess**
- Wait for human decision

### 3. Understand Bella Architecture Layers

```
Product (Industry-specific)
    ↓
Industry OS (Reusable industry patterns)
    ↓
Kernel (Frozen industry DNA)
    ↓
Platform Core (Cross-industry foundation)
```

**Bella Development Strategy:**
> Build the industry → capture reusable DNA → reuse it immediately → build the next industry faster.

**Classification BEFORE building:**

1. **Platform Core** — cross-industry capability (Tenant, Auth, RLS, Audit)
2. **Industry Kernel** — reusable industry capability (Finance, Healthcare, Spa patterns)
3. **Product-specific** — capability unique to one product

**⚠️ CRITICAL RULE:**

> **Do NOT build in Product layer first and plan to extract into Kernel later when reusable nature is already apparent.**

### The 4-Question Filter

Before implementing ANY new capability:

#### Q1: Is it mandatory for correctness/security/compliance?
- **YES → Build it** (non-negotiable)

#### Q2: Will this capability be reused in other industries?
- **YES → Consider Kernel**
- **NO → Keep in Product**

#### Q3: If Kernel, will it actually make the next Industry faster?
- **NO → Keep in Product** (don't force abstraction)

#### Q4: Does this make the next Industry OS faster?
- **NO → Default: don't build** (unless mandatory from Q1)

### Reuse Before Rebuild

For every new requirement:

```
Requirement
    ↓
Can Platform Core provide it?
    ↓
Can an existing Kernel provide it?
    ↓
Can an existing Kernel be extended?
    ↓
Only then build new Industry-specific capability.
```

**Never duplicate** an existing capability without first explaining why reuse is inappropriate.

### Kernel Is an Asset, Not a Goal

**Do NOT create:**
- Kernel registries
- Kernel marketplaces
- Kernel compilers
- Kernel factories
- Learning engines
- Universal industry abstractions

unless real development pain from multiple industries demonstrates necessity.

### Freeze Good-Enough Kernels

A Kernel does not need perfect before next Industry OS starts.

**Once a Kernel has:**
- Correct business behavior
- Stable reusable boundaries
- Sufficient tests/evidence
- No known critical correctness issue

→ Treat as **reusable baseline**. Extend only when real subsequent Industry requires additional capability.

---

## Bella Development Metrics

### Primary Metric

> **Is the next Industry OS faster to build than the previous one?**

If development is becoming slower, investigate which boundary or Kernel is failing to provide sufficient reuse.

**Do NOT** respond to slower development by automatically adding:
- ❌ Frameworks
- ❌ Governance layers
- ❌ Abstraction ceremonies
- ❌ Process overhead

### Success Criteria

**WRONG approach:**
```
1. Start building Product features
2. Build more features
3. Product complete
4. "Oh, this could be a Kernel"
5. Extract/refactor
```

**CORRECT approach:**
```
1. Analyze requirements
2. For each capability:
   - Can Platform Core provide it? → Use Platform
   - Can existing Kernel provide it? → Use Kernel
   - Can existing Kernel be extended? → Extend Kernel
   - Is it reusable across industries? → New Kernel
   - Is it industry-specific? → Product
3. Build in correct layer immediately
4. Measure: Was this Industry OS faster than previous?
5. Capture new reusable patterns → Update Kernels
```

### Every Industry Must Teach Bella Something

After building an Industry OS, identify **only the reusable patterns that have demonstrated value:**

```
Industry N
    ↓
Reusable pattern discovered
    ↓
Capture in Kernel
    ↓
Industry N+1 reuses it
```

**Do not create abstractions merely because they might be reusable.**

---

## Frozen Boundaries — DO NOT MODIFY

### Healthcare Kernel (H1-H12)
- **Status:** 🔒 FROZEN
- **Constitution:** `HEALTHCARE_ARCHITECTURE_GUARD.md`
- **Modification:** Requires Architecture Change Request (ACR)

### Education Kernel
- **Status:** 🔒 FROZEN
- **Constitution:** Constitution compliance required
- **Modification:** Requires ACR

### Logistics E7 Kernel
- **Status:** 🔒 SEALED
- **Modification:** Requires evidence of production necessity

**If you must modify frozen code:**
1. Read applicable Constitution
2. Verify modification does not violate Kernel boundaries
3. Create Architecture Change Request (ACR)
4. Wait for approval

---

## Code Quality Rules

### 1. TypeScript Compliance

❌ **NEVER use:**
- `any` types to silence errors
- `@ts-ignore` or `@ts-expect-error` suppressions
- `tsconfig.json` workarounds to hide diagnostics
- Fake types to make compiler green

✅ **ALWAYS:**
- Fix root cause
- Use proper types
- Preserve type safety

### 2. Minimal Fixes Only

**Prefer:**
- Smallest change that fixes root cause
- No refactoring unless necessary for correctness
- No "while we're here" improvements
- No defensive code beyond requirements

**Example from Host field test:**
```typescript
// ❌ WRONG: Refactor entire file, rename types, add abstractions
// ✅ CORRECT: Remove duplicate export block (lines 172-186) only
```

---

## Decision Rule: Known Pattern vs New Pattern

**Before diving into code changes, classify the issue:**

### Known Pattern Classification

**A pattern is "known" when:**
1. Root cause type is documented in governance/evidence docs
2. Canonical ownership rules already established
3. Fix approach is mechanical and documented
4. No new semantic ambiguity introduced

**Known patterns (as of 2026-09-03):**
- Duplicate export blocks (mechanical removal)
- Vocabulary/schema mismatch with established DB enum as canonical source
- Import path errors with clear module boundaries

### Decision Flow

```text
Issue Detected
    ↓
Is pattern documented? ────NO───→ STOP → Investigate → Document
    ↓ YES
    │
Ownership clear? ──────────NO───→ STOP → Gather evidence
    ↓ YES
    │
Semantics unambiguous? ────NO───→ STOP → Document ambiguity
    ↓ YES
    │
Known Pattern: PROCEED WITH MINIMAL FIX
```

### Known Pattern Workflow

**When pattern is known:**
1. Apply minimal fix directly (no re-investigation)
2. Run mandatory gates (below)
3. If gates pass → commit
4. If new semantic conflict appears → STOP immediately

**When pattern is new or ambiguous:**

---

## Contract-Schema Conformance Checkpoint

**When to run:** Before implementing new Product/Industry OS/Kernel capability, or modifying existing contract/schema/state/RPC.

**Command:**
```bash
npm run governance:contract-schema <scope> <table-name>
```

**Example:**
```bash
npm run governance:contract-schema real-estate real_estate_products
```

### Three Verdicts

**✅ PASS** → Continue implementation
- Contract + Schema + generated types conform
- No action needed

**❌ FAIL** → Fix or block implementation
- Objective mismatch detected (missing fields, stale types, enum absent)
- Fix required before proceeding

**⚠️ REVIEW_REQUIRED** → Architectural decision needed
- Semantic mismatch detected (vocabulary differs, state lifecycle unclear)
- AI cannot auto-decide semantic mapping
- Human decision required on canonical owner

### What This Gate Does

**Answers:**
> "Do Contract and Schema conform according to current evidence?"

**Does NOT answer:**
> "Should I fix DB or fix code?"  
> "How should I map these states?"  
> "Which is the canonical owner?"

These remain architectural decisions.

### Evidence Priority

**Schema Truth:**
1. Migration / canonical DB schema
2. `database.types.ts` (generated from DB, shows current state)

**Contract Truth:**
3. Canonical public contract + ownership

**Behavioral Evidence:**
4. Repository/service usage
5. Tests

**Documentation:**
6. Docs/ADR (intent explanation, NOT override)

**Critical:** Generated types prove DB *current state*, NOT what it *should be*.

### MVP Scope

Current checks (4):
- Contract existence / ownership
- Schema field presence
- Enum / state vocabulary
- Generated DB type consistency

**NOT in MVP:** RPC/function signatures, advanced ownership detection, duplicate capability checks

**Status:** Local execution only. No pre-commit/CI enforcement until field evidence proves value.

---

## TypeScript Remediation Rules

**When pattern is new or ambiguous:
1. STOP coding
2. Gather evidence
3. Document findings
4. Determine canonical ownership
5. Only then proceed with fix

### Field Test Evidence

**Real-Estate remediation (commit `6e5926ac`):**
- Pattern: vocabulary/schema mismatch (documented)
- Evidence: migration shows DB enum as canonical
- Fix: align Platform Kernel to DB vocabulary
- Result: 3 → 0 diagnostics, 0 regressions
- Duration: ~30 minutes (vs. multi-hour investigation)

**Key lesson:** Known patterns enable safe speed without ceremony.

---

## After Every Code Change — Mandatory Gates

**Run in this order:**

### 1. TypeScript Check (Gate B)

```bash
npm run governance:typecheck
```

- Must PASS for changed scope
- Existing baseline errors are NOT failures
- New diagnostics are FAILURES

### 2. Regression Protection

```bash
npm run governance:check-regression
```

- Exit 0 (ALLOW) = no new regressions → proceed
- Exit 1 (BLOCK) = new regressions detected → STOP, investigate
- Exit 2 (ERROR) = baseline missing → capture baseline first

### 3. Architecture Guard

```bash
npm run arch:guard
```

- Must PASS
- Verifies no frozen boundaries violated
- Checks Kernel compliance

### 4. Relevant Tests

```bash
# Run tests for affected scope/module
npm test -- <relevant-test-pattern>
```

**Only after ALL gates pass: commit.**

### Gate Philosophy

**Known Pattern + All Gates PASS = Safe to proceed quickly**

**New Pattern OR Any Gate FAIL = STOP and investigate**

This is NOT about avoiding investigation. It's about:
- Investing investigation effort once per pattern type
- Reusing documented patterns for speed
- Stopping immediately when new ambiguity appears

---

## Understanding Baseline vs Regression

### Baseline Diagnostics
- Pre-existing errors captured in `baseline.json`
- NOT considered failures during remediation
- Technical debt, not governance violations

**Example:** Host has 47 baseline diagnostics after field test. This is acceptable.

### Regressions
- NEW diagnostics introduced by your change
- Detected via diagnostic fingerprinting:
  ```typescript
  {
    file: string,
    line: number,
    column: number,
    code: number,        // e.g., 2339, 2554
    messagePattern: string
  }
  ```
- **ANY new fingerprint = BLOCK**

### Improvements
- Resolved baseline fingerprints + zero new fingerprints = ALLOW
- Reduction in diagnostic count without new issues = safe change

---

## Field-Tested Workflow (Proven)

**From commit `6ee30569` — Host feature-flags/types.ts:**
```
1. Inventory: 59 Host diagnostics
2. Identify: 12 duplicate export errors (TS2484)
3. Root cause: Types exported inline AND in export block
4. Ownership: Clear (feature-flags module owner)
5. Minimal fix: Remove duplicate export block only
6. TypeCheck: 59 → 47 diagnostics (12 resolved)
7. Regression: 12 resolved, 0 new → ALLOW (exit 0)
8. Arch Guard: PASS
9. Commit: 6ee30569
10. Push: Remote preserved
```

**This is the standard.** Follow this workflow.

---

## Real Evidence from Phase 1

### ✅ CORRECT Decisions

**Host G3 (feature-flags):**
- Evidence: Duplicate export block, mechanical fix
- Ownership: Clear
- Action: Remove duplicate block
- Result: SUCCESS

**Real-Estate (commit `6e5926ac`):**
- Issue: Enum/domain-schema mismatch
- Evidence: Migration shows DB enum as canonical (line 114: `completed → handed_over`)
- Action: Align Platform Kernel to DB vocabulary
- Result: 3 → 0 diagnostics, 0 regressions, RESOLVED

### ❌ BLOCKED Decisions

**Healthcare:**
- Issue: 16 diagnostics in example-usage.ts
- Classification: Non-production example code
- Action: DEFER (not production-critical)
- Result: DEFERRED (correct decision)

**Host G1 (ContractDefinition):**
- Issue: Type rename ContractDefinition → ContractMetadata
- Evidence: Schema structure changed (not just rename)
- Old: `{id, provider, consumers, methods}`
- New: `{name, type, owner, status, endpoints}`
- Action: STOP (semantic change unclear)
- Result: BLOCKED (correct decision)

---

## Commands Reference

```bash
# Full Gate B check (44 scopes)
npm run governance:typecheck

# Single scope check
npx tsc -p tsconfig.platform-<scope>.json --noEmit

# Capture baseline
npm run governance:baseline

# Check regressions
npm run governance:check-regression

# Architecture Guard
npm run arch:guard

# Run tests
npm test
```

---

## When To STOP

**Immediately STOP coding if:**
1. Root cause is unclear
2. Canonical ownership is ambiguous
3. Schema/contract/enum semantics uncertain
4. Cross-Kernel boundaries affected
5. Frozen code modification required without ACR
6. "Fix" requires guessing mapping/semantics
7. TypeCheck PASS but semantics unclear
8. Regression check shows new fingerprints

**Document the blocker. Wait for human decision.**

---

## Platform Status (as of 2026-09-03)

```
Platform: 40 PASS / 3 FAIL / 1 HOTSPOT

FAIL:
  - education: 102 diagnostics (baseline)
  - host: 47 diagnostics (baseline, 12 resolved in field test)
  - healthcare: 16 diagnostics (example code)

HOTSPOT:
  - logistics: >30s timeout

RESOLVED:
  - real-estate: 3 → 0 diagnostics (vocabulary alignment, commit 6e5926ac)
```

**Goal:** NOT to make everything GREEN immediately.

**Goal:** Controlled, evidence-based remediation with regression protection.

---

## Governance Maturity

### Phase 1: Regression Protection (CURRENT)
- ✅ COMPLETE / FIELD-TESTED
- Allow baseline diagnostics
- Block new regressions
- Safety net during remediation

### Phase 2: Enforced Gate (FUTURE)
- Requires: 44 PASS / 0 FAIL / 0 HOTSPOT first
- Zero tolerance for diagnostics
- Strict production gate

### Phase 3: Multi-Gate Pipeline (FUTURE)
- Only build when operational evidence requires
- Do NOT build speculatively

**Current posture:** Phase 1 sufficient. No expansion until concrete need proven.

---

## For AI Agents

**When you start working on Bella:**
1. Read this file first
2. Read `docs/architecture/PHASE1_REGRESSION_PROTECTION_CLOSURE.md`
3. Read `docs/architecture/GOVERNANCE_REGRESSION_GATE_POLICY.md`
4. Check Architecture Guard rules for frozen Kernels
5. Run governance commands to understand current state
6. Follow the workflow above for EVERY code change

**Key mindset shift:**

> You are not here to "fix all errors fast."
>
> You are here to "make safe, evidence-based changes that preserve correctness and architectural boundaries."

**When in doubt:** STOP and ask. Bella values correctness over speed.

---

## Success Criteria

A code change is successful when:

1. ✅ Root cause identified with evidence
2. ✅ Canonical ownership verified
3. ✅ Minimal fix implemented (no unnecessary changes)
4. ✅ TypeCheck PASS for changed scope
5. ✅ Regression check: ALLOW (exit 0)
6. ✅ Architecture Guard: PASS
7. ✅ Relevant tests: PASS
8. ✅ No semantic ambiguity remains
9. ✅ Commit message documents evidence chain
10. ✅ No frozen boundaries violated

**Anything less = incomplete work.**

---

## Final Principle

> **Evidence before infrastructure.**
>
> **Proven mechanism sufficient.**
>
> **Don't build more until concrete need demonstrated.**

This contract reflects lessons learned from real compiler remediation campaign. It is the result of field-tested governance, not theoretical policy.

**Respect the boundaries. Follow the workflow. Preserve the evidence chain.**

---

**Repository Governance Status:** Active  
**Phase 1 Field Tests:**
- Commit `6ee30569` (Host feature-flags/types.ts)
- Commit `6e5926ac` (Real-Estate vocabulary alignment)

**Next Review:** After Phase 2 conditions met (44 PASS / 0 FAIL / 0 HOTSPOT)
