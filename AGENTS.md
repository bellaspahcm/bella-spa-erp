# Bella Development Principles

**Purpose:** Decision framework for AI agents and developers building Bella Platform of Platforms.

**Last updated:** 2026-09-07

---

## ⚠️ MANDATORY READING BEFORE CREATING NEW OS/PRODUCT

**[New OS/Product Creation Policy](docs/architecture/NEW_PRODUCT_CREATION_POLICY.md)** — 5 Mandatory Gates, Decision Rules, Factory Usage

**Read this policy BEFORE starting any new Industry OS or Product development.**

**Key principles:**
- 5 Mandatory Gates protect invariants (Definition, Architecture, Verification, Evidence, Qualification)
- Decision Rules guide choices (reuse-first, minimal capability, additive extension)
- Factory Automation assists (P1/P2 optional, not mandatory)
- No gate proliferation, no approval for every step

---

## 1. Kernel-First, Not Kernel-Perfect

Bella follows:

> Build the industry → capture reusable DNA → reuse it immediately → build the next industry faster.

When implementing any new capability, classify it BEFORE building:

1. **Platform Core** — cross-industry capability (Tenant, Auth, RLS, Audit)
2. **Industry Kernel** — reusable industry capability (Finance, Healthcare, Spa patterns)
3. **Product-specific** — capability unique to one product

**Do NOT** build a capability in the Product layer first and plan to extract it into a Kernel later when its reusable nature is already apparent.

---

## 2. Kernel Is an Asset, Not a Goal

A Kernel exists to make future Industry OS development faster.

**Do NOT create:**
- Kernel registries
- Kernel marketplaces
- Kernel compilers
- Kernel factories
- Learning engines
- Universal industry abstractions

unless real development pain from multiple industries demonstrates that they are necessary.

---

## 3. Freeze Good-Enough Kernels

A Kernel does not need to be perfect before the next Industry OS starts.

Once a Kernel has:
- Correct business behavior
- Stable reusable boundaries
- Sufficient tests/evidence
- No known critical correctness issue

treat it as a **reusable baseline**.

Extend it only when a real subsequent Industry requires additional capability.

---

## 4. Reuse Before Rebuild

For every new Industry OS:

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

---

## 5. Every Industry Must Teach Bella Something

After building an Industry OS, identify only the reusable patterns that have demonstrated value.

```
Industry N
    ↓
Reusable pattern discovered
    ↓
Capture in Kernel
    ↓
Industry N+1 reuses it
```

Do not create abstractions merely because they might be reusable.

---

## 6. Optimize for Time-to-Industry

The primary architectural learning metric is:

> Is the next Industry OS faster to build than the previous one?

If development is becoming slower, investigate which boundary or Kernel is failing to provide sufficient reuse.

**Do NOT** respond to slower development by automatically adding frameworks, governance, abstraction, or process.

---

## 7. Minimal Complexity

Prefer:

> The simplest design that protects correctness, security, compliance, and reuse.

Add complexity only when it provides a demonstrated benefit.

**Non-negotiable:**
- Correctness
- Security
- Compliance

**Negotiable:**
- Architecture ceremony
- Framework perfection
- Additional abstraction layers

---

## 8. Before Starting Significant Work

Ask:

> "Does this make the next Industry OS faster, safer, or more correct?"

**If YES → Build it.**

**If NO → Question whether it is necessary.**

Do not build infrastructure merely to support a future architecture that has not yet demonstrated a real need.

---

## 9. The 4-Question Filter

Before implementing ANY new capability:

### Q1: Is it mandatory for correctness/security/compliance?
- **YES → Build it** (non-negotiable)

### Q2: Will this capability be reused in other industries?
- **YES → Consider Kernel**
- **NO → Keep in Product**

### Q3: If Kernel, will it actually make the next Industry faster?
- **NO → Keep in Product** (don't force abstraction)

### Q4: Does this make the next Industry OS faster?
- **NO → Default: don't build** (unless mandatory from Q1)

---

## 10. Architecture Guard Compliance

Bella enforces architectural boundaries through automated Architecture Guard:

- **Healthcare Kernel (H1-H12):** FROZEN
- **Education Kernel:** FROZEN (Constitution compliance required)
- **Logistics E7 Kernel:** SEALED

**Before modifying frozen/sealed code:**
1. Read applicable Constitution (Healthcare/Education)
2. Verify modification does not violate Kernel boundaries
3. If modification required, create Architecture Change Request (ACR)

**Reference:** See `AGENTS.md` workspace rules for detailed Kernel freeze policies.

---

## Current Kernel Baselines

See `docs/architecture/KERNELS.md` for detailed baseline versions and status.

| Kernel | Status | Purpose |
|--------|--------|---------|
| **Spa Kernel** | 🔒 Baseline | Service/appointment/membership/commission patterns |
| **Finance Kernel** | 🔒 Baseline | Ledger/cash/TT133/accounting invariants |
| **Healthcare Kernel** | 🔒 Baseline | Patient/clinical/workflow patterns |

**Baseline = reusable, not necessarily complete.**

Kernels evolve only when a real Industry OS requires additional reusable capability.

---

## Example: Building Industry #4

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
1. Analyze Industry #4 requirements
2. For each capability:
   - Can Platform Core provide it? → Use Platform
   - Can existing Kernel provide it? → Use Kernel
   - Can existing Kernel be extended? → Extend Kernel
   - Is it reusable across industries? → New Kernel
   - Is it Industry #4-specific? → Product
3. Build in correct layer immediately
4. Measure: Was Industry #4 faster than previous?
5. Capture new reusable patterns → Update Kernels
```

---

## What This Is NOT

This is **NOT:**
- ❌ A new governance system
- ❌ An approval process
- ❌ A ceremony framework
- ❌ A phase in development lifecycle

This **IS:**
- ✅ A decision filter when classifying capabilities
- ✅ A reminder to reuse before rebuilding
- ✅ A principle: simplicity over ceremony

---

**Strategy:** Build → Learn → Reuse → Build Faster

**Success metric:** Each Industry OS faster than the previous one

**Core belief:** Bella becomes a Platform not by perfecting Kernels first, but by proving Kernels accelerate real Industry OS development.


---

## 📊 Governance & Platform Status (as of 2026-09-06)

### Factory Test #1 — CLOSED ✅

**Status:** 🔒 **SUCCESS** — Retail OS Core Baseline validated for General Merchandise

**Achievement:**
- Factory generated 2,023 LOC autonomous (R1+R2 engines + repositories + tests)
- Human judgment → Factory execution → Evidence validation workflow proven
- Governance as automated checkpoints (not approval loops) validated
- Lean Platform principle demonstrated (build → capture → reuse → STOP)

**Key learning:**
> **Human defines WHAT + WHY, Factory executes HOW, Evidence validates outcome.**

**Governance efficiency:** 1 human decision per 8 agent execution steps

**Status:** Experiment closed, workflow proven, no further Factory tests until next Industry OS

---

### Factory Test #2 — DEFERRED ⏸️

**Status:** ⏸️ **DEFERRED** — No artificial Product #2 without business demand

**Hypothesis preserved (not implemented):**
> When real Product #2 requires Retail Core, can Factory construct it primarily through R1/R2 reuse?

**Why deferred:**
- No proven business need for bella-specialty-store (or similar Product #2)
- Building artificial Product #2 purely for reuse metrics violates "Demand first, supply second"
- Real Product #2 (when it exists) provides natural experiment without selection bias

**Trigger conditions for reopening:**
1. Real Product #2 business demand (customer contract, revenue projection, operational need)
2. Retail OS extension requirement (Fashion/Pharmacy with Variant/Batch need)

**Recommended next:** Different Industry OS (Healthcare/Hospitality/Logistics) — more strategic value than another Retail product

**Documents:**
- [Factory Test #2 Deferred](docs/architecture/FACTORY_TEST_2_DEFERRED.md) ⏸️

---

### Factory Test #4 — Bella Preschool — CLOSED ✅

**Status:** 🔒 **CLOSED** — Controlled Product Production field-validated

**Achievement:**
- 4 capabilities field-verified: Student+Guardian (P3.1), Classroom (P3.2), Enrollment (P3.3), Attendance (P3.4)
- Complete core vertical slice: Student → Guardian → Classroom → Enrollment → Attendance
- 26/26 isolated E2E scenarios PASS
- Learning transfer demonstrated across consecutive capabilities
- Product defects: 2 → 1 → 0 → 0 (decreasing trend)

**Key learning:**
> **Cross-capability learning transfer field-demonstrated. Test infrastructure (real auth, stable identity, isolated fixtures, failure classification) reused across P3.2/P3.3/P3.4 without rework.**

**Proven patterns:**
- Real authentication requirement (Supabase JWT, not mock)
- Stable identity lifecycle (reuse test user across scenarios)
- Isolated business data (unique prefixes per scenario)
- Failure classification before remediation

**Candidate patterns (not codified):**
- !inner join guard (2 occurrences in P3.1/P3.2, need more evidence)

**Status:** Experiment closed, patterns proven, no further capabilities required

**Documents:**
- [Factory Test #4 Closure](docs/architecture/FACTORY_TEST_4_CLOSURE.md) 🔒
- [P3.1 Student+Guardian Closure](docs/products/bella-preschool/P3_1_CLOSURE.md) ✅
- [P3.2 Classroom Closure](docs/products/bella-preschool/P3_2_CLASSROOM_CLOSURE.md) ✅
- [P3.3 Enrollment Closure](docs/products/bella-preschool/P3_3_ENROLLMENT_CLOSURE.md) ✅
- [P3.4 Attendance Closure](docs/products/bella-preschool/P3_4_ATTENDANCE_CLOSURE.md) ✅

---

**Status:** 🟡 **BASELINE PROVEN, F-G1 RECONCILIATION REQUIRED**

**Achievement:**
- AutoMove Product constructed autonomously (~2,300 LOC)
- 4 runtime defects detected, investigated, remediated autonomously
- Complete recovery loop demonstrated: Construct → Validate → Detect → Investigate → Fix → Re-validate
- Final validation: Product tests 32/32 ✅, E2E 16/16 ✅, Architecture Guard ✅, Build ✅

**Key learning:**
> Factory demonstrated **autonomous recovery capability** — not just code generation, but detect-investigate-fix-revalidate cycle on real runtime failures (FK issues, table privileges, schema mismatches, RLS policy incompatibility).

**F-G1 field observation:**
- 4 DB/RLS incidents reached E2E validation despite F-G1 preflight passing
- Classification required: Guard deficiency vs capability gap vs contract ambiguity
- **Reconciliation checkpoint active** — no F-G1 changes until contract mapping complete

**Status:**
- Construction phase: ✅ COMPLETE
- Validation phase: ✅ COMPLETE
- Learning extraction: ⏸️ IN PROGRESS (F-G1 contract reconciliation)

**Documents:**
- [AutoMove Construction Complete](docs/products/bella-automove/CONSTRUCTION_COMPLETE.md) ✅
- [Factory Test #3 Assessment](docs/architecture/FACTORY_TEST_3_ASSESSMENT.md) 🟡
- [F-G1 Contract Reconciliation](docs/architecture/F-G1_CONTRACT_RECONCILIATION.md) ⏸️ ACTIVE

**Blocked:**
- ❌ F-G1 implementation changes (until reconciliation complete)
- ❌ Factory capability expansion (until learning extracted)
- ❌ Product #4 construction (until Test #3 formally closed)

**Next:** Complete F-G1 contract reconciliation (map AutoMove incidents → contract → classify Gap/Defect/Ambiguity → decide scope)

---

### Retail OS — EXPERIMENT CLOSED 🔒

**Status:** SUCCESS — Core Baseline validated, further work demand-driven only

**See:** [Retail OS Status](#retail-os-status--experiment-closed-) section above

---

### Governance Checkpoint — CLOSED

**Phase 1 Regression Protection + Known Pattern Rule:** ACTIVE / FIELD-TESTED

**Status:** Engineering mode active. No further governance expansion until proven need.

**⚠️ TYPE-SYSTEM ROOT-CAUSE & HARDENING — IN PROGRESS**

**Status:** Gate 3 Architectural Hardening active (TG-1 complete, TG-2/3/4 pending)

**Documents:**
- [Gate 3 Architectural Hardening](docs/architecture/GATE3_ARCHITECTURAL_HARDENING.md) 🟡 IN PROGRESS
- [Gate 2 Root-Cause Proof](docs/architecture/GATE2_ROOT_CAUSE_PROOF_CLOSURE.md) 🔒 CLOSED
- [Gate 1 Canonical Diagnosis](docs/architecture/GATE1_CANONICAL_DIAGNOSIS_CLOSURE.md) 🔒 CLOSED

**Type Gates Status:**
```text
TG-1 Schema-Type Sync         🔒 COMPLETE (6/6 tests PASS)
TG-2 Coverage Integrity       ⚪ NOT STARTED
TG-3 Contract Enforcement     ⚪ NOT STARTED  
TG-4 Diagnostic Fingerprint   ⚪ NOT STARTED
```

**TG-1 Evidence:**
- T1 Healthy PASS: ✅
- T2 Drift BLOCK: ✅
- T3 Recovery PASS: ✅
- T4 Timestamp resistance: ✅
- T5 Deterministic: ✅
- Root cause: Windows PowerShell UTF-16 encoding (resolved)
- [TG-1 Root Cause Resolution](docs/architecture/TG1_ROOT_CAUSE_RESOLUTION.md)

**Next:** TG-2 Coverage Integrity Gate

---

**⚠️ Industry Discovery Governance — APPROVED FOR IMPLEMENTATION DESIGN**

**Status:** Human decision approved, implementation design checkpoint required before coding

**Decision Record:** [Industry Discovery Governance Decision](docs/governance/INDUSTRY_DISCOVERY_GOVERNANCE_DECISION.md) ✅ Approved 2026-09-06

**Key decisions:**
- ✅ Industry Discovery Governance = Platform-level reusable capability
- ✅ Canonical ownership: Reuse existing mechanisms (Architecture Guard, BDGF, Evidence Collector)
- ✅ New governance only for genuine gaps (discovery lifecycle, reference product limit)
- ✅ Capability Identity = Option B (DEFER semantic duplication detection)
- ❌ No quantitative estimates until implementation design complete
- 🔒 Implementation BLOCKED until Implementation Design checkpoint

**6 Governance Principles Locked:**
1. No quantitative claims without measurement
2. No implementation design in reconciliation
3. No parallel enforcement mechanisms
4. Capability Identity blocks semantic detection only (not entire framework)
5. Do not automate judgment
6. Do not automate unproven patterns ← **NEW**

**Next checkpoint:** Implementation Design (evidence collection + design, NOT coding)

**Reconciliation:** [Governance Reconciliation](docs/architecture/GOVERNANCE_RECONCILIATION.md) 🟡 Conditionally accepted

**⚠️ NEW OS/PRODUCT DEVELOPMENT:**

**MANDATORY:** Read [New Product Creation Policy](docs/architecture/NEW_PRODUCT_CREATION_POLICY.md) before starting any new Industry OS or Product

**5 Mandatory Gates:**
1. G1: Definition & Boundary
2. G2: Architecture / Contract Compliance
3. G3: Verification
4. G4: Evidence
5. G5: Human Qualification

**Decision Rules:** Reuse-first, minimal capability, additive extension  
**Factory Automation:** P1 Schema Generation, P2 Evidence Collection (optional, not mandatory)

### Retail OS Status — EXPERIMENT CLOSED ✅

**Status:** 🔒 **CLOSED** (2026-09-06)

**Outcome:** SUCCESS — Core Baseline validated for General Merchandise

**What was built:**
- R1 Product Catalog (5 operations, 19/19 tests, FROZEN)
- R2 Inventory Movement (4 operations, 17/17 tests, FROZEN)
- bella-retail-store integration (9/9 canonical ops migrated, 19/19 tests)

**Validation evidence:**
- Tests: 55/55 PASS ✅
- TypeScript: GREEN ✅
- Architecture Guard: PASS ✅
- Production Build: SUCCESS ✅
- Regressions: ZERO ✅
- Contract expansions: ZERO ✅

**Final claim:**
> **Retail OS Core Baseline (R1+R2) validated for General Merchandise. NOT validated for Fashion/Pharmacy/Electronics (Variant/Batch/Serial gaps documented).**

**NOT claimed:**
- ❌ "Retail OS complete"
- ❌ "R1/R2 universal for all retail"

**Reopen conditions (demand-driven ONLY):**
1. Product #2 with proven R1/R2 requirement
2. Specialized archetype (Fashion/Pharmacy) with business case
3. Multi-Product orchestration pattern (N ≥ 2)

**Do NOT reopen for:**
- ❌ "R1/R2 looks incomplete"
- ❌ "Let's add Variant just in case"
- ❌ "Build Product #2 to prove reuse"

**Principle locked:** **Demand first, supply second.**

**Documents:**
- [Retail OS Experiment Closure](docs/architecture/RETAIL_OS_EXPERIMENT_CLOSURE.md) 🔒
- [Phase 3 Closure](docs/architecture/RETAIL_OS_PHASE3_CLOSURE.md) ✅
- [Coverage Study](docs/architecture/RETAIL_OS_COVERAGE_STUDY.md) ✅

**Next:** Different Industry OS OR demand-driven Product #2 (when business need proven)

---

### Industry Discovery Governance — INVESTIGATION COMPLETE, FRAMEWORK STOPPED

**Investigation Phase:** ✅ COMPLETE (Sept 6, 2026)

**Key findings:**
- 2 genuine policy gaps identified (Discovery lifecycle, Reference Product limit)
- Evidence collection methodology proven
- Gap analysis process validated

**Framework Development:** 🛑 **STOPPED**

**Decision:** Do not build governance framework before proving pattern repeats

**Rationale:**
> **Đừng xây Industry Discovery Governance Framework để chứng minh Factory có thể tự động hóa Product Manufacturing. Hãy dùng Retail để chứng minh điều đó trước. Nếu governance pattern thực sự lặp lại, lúc đó mới biến nó thành framework.**

**What we will NOT build (yet):**
- ❌ Discovery lifecycle engine
- ❌ Reference Product Guard
- ❌ Capability Identity Model
- ❌ Semantic duplicate detector
- ❌ Governance workflow automation
- ❌ Product registry

**What to do instead:**
1. Build 2 Reference Products for Retail OS
2. Extract Retail OS from Products
3. Qualify Retail OS
4. Use Factory to create Product #3
5. **Measure actual evidence:**
   - Product #3 speed vs Product #1/2
   - LOC reduction (reused vs new)
   - Human decisions required
   - Factory automation effectiveness

**6th Governance Principle validated:**

> **Do not automate unproven patterns.**

**Status:** Investigation complete → Framework development stopped → Return to Retail OS

**Documents:**
- [Governance Decision](docs/governance/INDUSTRY_DISCOVERY_GOVERNANCE_DECISION.md) ✅ Preserved
- [Governance Reconciliation](docs/architecture/GOVERNANCE_RECONCILIATION.md) ✅ Preserved
- [Implementation Design](docs/governance/INDUSTRY_DISCOVERY_GOVERNANCE_IMPLEMENTATION_DESIGN.md) 🛑 Marked STOPPED

**Next:** Prove Factory leverage with Retail, then revisit governance automation if pattern repeats.

**Manufacturing Phase 3.5:** ✅ COMPLETE (Factory qualified)
- P1 Schema Generation: ✅ COMPLETE (21/21 tests)
- P2 Evidence Collection: ✅ COMPLETE (23/23 tests)
- P3 Kernel Binding: ⏸️ DEFERRED (no proven bottleneck)
- P4 Test Scaffolding: ⏸️ DEFERRED (no proven bottleneck)

**Components:**
- ✅ Gate B: VERIFIED / FROZEN (44 scopes, diagnostic fingerprinting)
- ✅ Regression Protection: FIELD-TESTED (commits `6ee30569`, `6e5926ac`)
- ✅ Known Pattern Rule: ACTIVE (3 patterns documented)
- ✅ Architecture Guard: ENFORCED (frozen Kernels protected)
- ✅ AI Coding Contract: v1.1 (canonical)

### Platform TypeScript Status

```
43 PASS / 0 FAIL / 1 HOTSPOT

✅ RESOLVED:
  - Real-Estate: 3→0 (vocabulary alignment, commit 6e5926ac)
  - Host: 47→0 (ContractDefinition + boundary violations, commit 8c91b7c1)
  - Healthcare: 16→0 (example-only file removed, commit 53b270c6)
  - Education: 102→0 (RESET - deleted broken repos, commit dd0afa2e)

🔥 HOTSPOT:
  - Logistics: >180s compilation timeout (infrastructure issue)
```

### Known Patterns (Strict Boundaries)

Patterns are "known" ONLY when documented with evidence:

1. **Duplicate export blocks** → mechanical removal (Host `6ee30569`)
2. **Vocabulary/schema mismatch** → DB enum canonical with migration evidence (Real-Estate `6e5926ac`)
3. **Import path errors** → clear module boundaries (multiple fixes)
4. **Schema/code fundamental mismatch** → RESET decision for test products without production data (Education `dd0afa2e`)

### Engineering Workflow — Proven

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

### Core Principle

> **Governance không để làm chậm AI.**
>
> **Governance để giúp AI:**
> - Phát hiện sớm (gates)
> - Sửa nhanh khi đã biết (known patterns)
> - Dừng ngay khi gặp điều chưa biết (STOP conditions)

### Success Metrics

**NOT:** Eliminate all diagnostics immediately  
**BUT:**
- Fix real errors without regressions
- Decrease time for known pattern processing
- Properly document new patterns when discovered
- Maintain all safety gates

### Commands Reference

```bash
# Gate B — TypeScript compliance (44 scopes)
npm run governance:typecheck

# Regression check (exit 0 = ALLOW, 1 = BLOCK)
npm run governance:check-regression

# Architecture Guard
npm run arch:guard

# Capture baseline (when needed)
npm run governance:baseline
```

### Documentation

**Must-read for AI agents (in order):**
1. [AI_CODING_CONTRACT.md](AI_CODING_CONTRACT.md) — Canonical coding rules, Known Pattern workflow
2. [AGENTS.md](AGENTS.md) — This file, Bella architecture principles
3. [CLAUDE.md](CLAUDE.md) — AI entry point with domain documentation

**Governance evidence:**
- [Known Pattern Rule Adoption](docs/architecture/KNOWN_PATTERN_RULE_ADOPTION.md)
- [Phase 1 Closure](docs/architecture/PHASE1_REGRESSION_PROTECTION_CLOSURE.md)
- [Governance Regression Policy](docs/architecture/GOVERNANCE_REGRESSION_GATE_POLICY.md)

### Field Test Evidence

| Commit | Scope | Pattern | Result | Duration |
|--------|-------|---------|--------|----------|
| `6ee30569` | Host | Duplicate exports | 59→47 diagnostics | Initial investigation |
| `6e5926ac` | Real-Estate | Vocabulary/schema | 3→0 diagnostics | ~30 min (known pattern) |
| `8c91b7c1` | Host | ContractDefinition + boundaries | 47→0 diagnostics | Architecture-preserving fix |
| `53b270c6` | Healthcare | Example-only file | 16→0 diagnostics | Scope verification |
| `dd0afa2e` | Education | Schema mismatch | 102→0 diagnostics | RESET decision (test product) |

**Key learning:** Known Pattern workflow proven to reduce remediation time while maintaining safety.

### Next Engineering Target

**Logistics HOTSPOT:** >180s compilation timeout (DEFERRED)

**Classification:** TEST PRODUCT / PLATFORM EXPANSION PROOF (NO real customers)

**Status:**
- Platform GREEN achieved: 43 PASS / 0 FAIL / 1 HOTSPOT
- All FAIL scopes resolved (Host, Healthcare, Real-Estate, Education)
- Logistics DEFERRED (compiler infrastructure issue, NOT code defect)

**Product Tier Classification:**

```
Production (Real Customers) → PROTECT AGGRESSIVELY
Test — High Architectural Value → PRESERVE ASSETS, can REFACTOR/RESET if evidence warrants
Test — Low Value → RESET FAST
```

**Why DEFER Logistics (not RESET like Education):**

| Factor | Education (RESET) | Logistics (DEFER) |
|--------|-------------------|-------------------|
| **Product Tier** | Test — Low Value | **Test — HIGH Architectural Value** |
| **Customers** | ❌ None | ❌ None |
| **Code** | ~100 lines | ~30K LOC |
| **Schema** | 2 tables | 6 tables + RLS |
| **Domain** | Minimal | Rich (5+ domains) |
| **Issue** | 102 diagnostics (code defect) | 0 diagnostics (compiler timeout) |
| **Decision** | RESET (cheap to rebuild) | DEFER (preserve OS expansion proof) |

**Key Insight:**
- Both are test products with NO customers
- Education: Low architectural value → RESET fast
- Logistics: High architectural value (OS proof) → Preserve assets, defer investigation
- **However:** Logistics can still be RESET if future investigation proves code has no value

**Logistics Investigation (when prioritized):**
- Phase 1: Evidence gathering (compiler profiling, code quality assessment)
- Phase 2: Classify as FIX / REFACTOR / TARGETED RESET / FULL RESET
- Phase 3: Execute based on evidence (safe because no customers)
- Do NOT increase timeout indefinitely
- Do NOT use workarounds (skipLibCheck, exclusions)

**No further governance work until concrete operational gap discovered.**

**See:** [LOGISTICS_HOTSPOT_ANALYSIS.md](docs/architecture/LOGISTICS_HOTSPOT_ANALYSIS.md)

---

**Governance Status:** 🔒 CLOSED  
**Engineering Status:** ✅ ACTIVE  
**Last Updated:** 2026-09-03  
**Next Review:** After Host remediation OR discovery of operational governance gap
