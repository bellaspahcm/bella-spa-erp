---
product: bella-english-center
purpose: baseline_metrics_for_registry_effectiveness
created: 2026-09-12
status: sealed
product_number: 2
next_measurement: product_3
---

# E0 BASELINE METRICS — BELLA ENGLISH CENTER

> **Purpose:** Establish baseline metrics for English Center (Product #2) to measure Registry/Manifest effectiveness when Product #3 is built.

---

## 🎯 MEASUREMENT GOAL

**Hypothesis:** Registry + Manifest create **compounding engineering leverage**.

**Evidence Required:** Product #3 discovery time/effort significantly lower than Product #2.

**This Document:** Baseline (Product #2 actual). NOT prediction for Product #3.

---

## 📊 PRODUCT #2 ACTUAL METRICS (ENGLISH CENTER)

### Discovery Time

```text
E0.1   Preschool Reuse Inventory          [X hours]
E0.1A  Semantic Ownership Matrix          [X hours]
E0.1A-1 Person/Party Reconciliation       [X hours]
E0.1B  Finance Reuse Reconciliation       [X hours]
E0.1C  Course/Class/Session Ownership     [X hours]
E0.2   Chain Authorization Model          [X hours]
E0.3   English-Specific Capabilities      [X hours]
E0.4   Business Invariants                [X hours]
E0.4R  Rule Reconciliation                [X hours]
E0.5   Product Manifest Lock              [X hours]

TOTAL E0 DISCOVERY TIME:                  [X hours]
```

**Note:** Actual hours to be filled when data available. Estimate from session logs/commits.

---

### Investigation Volume

```text
Files Read:                               ~100+ (E0.1A full scan, E0.1B, E0.1C targeted)
Repository Scans:                         Multiple (healthcare/, preschool/, platform/)
Contract Searches:                        6+ (Student, Enrollment, Finance, etc.)
Schema Reviews:                           10+ migrations reviewed
Architecture Documents Created:           10 documents (E0.1 → E0.5)

Manual Investigation Intensity:           HIGH (no prior registry)
```

---

### Registry Hit Rate

```text
E0.1C Course/Class Ownership:             16.7% (1/6 baseline)
E0.2  Chain Authorization:                66.7% (4/6)
E0.3  English-Specific Capabilities:      27.3% (6/22)

AVERAGE REGISTRY HIT RATE:                ~37% (weighted by phase size)
```

**Interpretation:** Low hit rate expected — English Center is **building** the registry, not consuming it.

---

### Capability Classification

```text
Total Capabilities Investigated:          22
Unknown at Start:                         22 (100%)
Unknown at End:                           0 (0%)

Platform Reuse Found:                     10 (45.5%)
Product-Specific Defined:                 9 (40.9%)
Promotion Candidates:                     3 (13.6%)

Classification Method:                    Manual discovery + targeted investigation
```

---

### Architectural Gaps Found

```text
Total Gaps Identified:                    2

E0.1A-R Identity Migration:               Platform Core responsibility
E0.1B-R Finance AR Contract:              Platform Finance responsibility

Gap Discovery Phase:                      E0.1A, E0.1B (early discovery)
Gap Resolution Owner:                     Platform teams (not English Center)
```

---

### Rule Definition

```text
Total Rules Defined:                      44
  Business Invariants:                    24
  Architecture Invariants:                5
  Policies:                               10
  Workflows:                              5

Definition Method:                        Manual lifecycle analysis
Cross-Domain Identification:              6 rules (manual boundary review)
```

---

### Time to Implementation-Ready

```text
E0 Start:                                 2026-09-12
E0 Sealed:                                2026-09-12
Remediation Required:                     2-3 weeks (Platform teams)
E1 Authorization (projected):             2026-10-XX

Time from Intent → Architecture Ready:    [X days/weeks] (E0 only)
Time from Intent → Implementation Ready:  [X days/weeks] (E0 + remediation)
```

---

## 🎯 PRODUCT #3 TARGET METRICS

### Expected Improvements (TARGET, NOT PREDICTION)

```text
METRIC                          PRODUCT #2 (BASELINE)    PRODUCT #3 (TARGET)

E0 Discovery Time:              [X hours]                -70% reduction
Manual Investigation:           HIGH                     MINIMAL
Registry Hit Rate:              37%                      70-80%
Unknown Capabilities:           22 → 0                   ~5 → 0 (product-specific only)
Architectural Gaps Found:       2                        0-1 (Platform already hardened)
Files Read:                     ~100+                    <20 (Registry lookup only)
Contract Searches:              6+ (scan)                0 (Registry reference)
Time to Implementation-Ready:   [X weeks]                -50% reduction
```

**Hypothesis:** Registry + Manifest eliminate repetitive discovery.

---

## 📏 MEASUREMENT PROTOCOL FOR PRODUCT #3

### When Product #3 Begins:

**Step 1: Record Start Timestamp**
```text
Product #3 Intent Received:    YYYY-MM-DD HH:MM
E0 Discovery Start:            YYYY-MM-DD HH:MM
```

**Step 2: Track Discovery Activities**
```text
- Files read (count)
- Repository scans (count)
- Contract searches (count via grep/search logs)
- Unknown capabilities at start
- Registry queries vs manual investigations
- E0 phase time (hours per phase)
```

**Step 3: Record Discovery Completion**
```text
E0 Discovery Complete:         YYYY-MM-DD HH:MM
Total E0 Time:                 [X hours]
Implementation-Ready Date:     YYYY-MM-DD
```

**Step 4: Calculate Deltas**
```text
Δ Discovery Time:              Product #3 vs Product #2 (%)
Δ Investigation Volume:        Files read, searches (absolute + %)
Δ Registry Hit Rate:           Product #3 vs Product #2 (percentage points)
Δ Architectural Gaps:          Product #3 vs Product #2 (absolute)
Δ Time-to-Ready:               Product #3 vs Product #2 (%)
```

**Step 5: Evidence Analysis**
```text
IF Δ Discovery Time < -50% 
   AND Δ Registry Hit Rate > +30 percentage points
   AND Δ Architectural Gaps ≤ 1
THEN
   ✅ Hypothesis SUPPORTED: Registry creates compounding leverage
ELSE
   ❌ Hypothesis NOT SUPPORTED: Registry did not reduce discovery overhead
```

---

## 🎯 SUCCESS CRITERIA

**Registry/Manifest is EFFECTIVE if Product #3 shows:**

1. ✅ **Significant time reduction** (-50% or more)
2. ✅ **High registry hit rate** (70%+ capabilities resolved from Registry)
3. ✅ **Low unknown count** (<5 unknowns, product-specific only)
4. ✅ **Minimal architecture gaps** (0-1 gaps, Platform already stable)
5. ✅ **Reduced investigation volume** (read <20 files vs 100+)

**If all 5 criteria met:**
```text
CONCLUSION: Bella Platform accumulates engineering leverage.
Each product does NOT start from zero.
Registry + Manifest enable faster product delivery.
```

**If criteria NOT met:**
```text
ACTION: Analyze why Registry did not reduce discovery overhead.
Possible reasons:
  - Product #3 domain too different from #2
  - Registry not maintained/updated
  - Manifest not machine-readable enough
  - Factory not using Registry properly
```

---

## 📊 BASELINE SUMMARY

```text
════════════════════════════════════════════════════════════════
 BELLA ENGLISH CENTER (PRODUCT #2) — E0 BASELINE
════════════════════════════════════════════════════════════════

PURPOSE:                 Build Registry + Manifest (first user)
DISCOVERY INTENSITY:     HIGH (no prior registry)
REGISTRY HIT RATE:       37% (building, not consuming)

E0 DISCOVERY TIME:       [X hours] (to be measured)
INVESTIGATION VOLUME:    ~100+ files, multiple scans
UNKNOWN CAPABILITIES:    22 → 0 (100% discovery)
ARCHITECTURAL GAPS:      2 (Platform responsibility)
RULES DEFINED:           44 (manual lifecycle analysis)

TIME TO READY:           [X weeks] (E0 + remediation)

════════════════════════════════════════════════════════════════
NEXT MEASUREMENT:        Product #3 (compare against this baseline)
════════════════════════════════════════════════════════════════
```

---

## 🚀 NEXT STEPS

### After Product #3 E0 Complete:

1. **Measure actual Product #3 metrics** (same protocol)
2. **Calculate deltas** (Product #3 vs Product #2)
3. **Document findings** in `docs/products/product-3/E0_MEASUREMENT_RESULTS.md`
4. **Update Platform Architecture Registry** with Product #3 discoveries
5. **Validate hypothesis** (Registry effectiveness proven or not)

### If Hypothesis Validated:

```text
✅ Evidence: Registry + Manifest create compounding leverage
✅ Action: Continue investing in Registry/Manifest maintenance
✅ Target: Product #4 achieves 90%+ hit rate, minimal discovery
```

### If Hypothesis Not Validated:

```text
❌ Evidence: Registry did not reduce discovery overhead
❌ Action: Analyze root cause, improve Registry architecture
❌ Consider: Different approach for knowledge accumulation
```

---

**BASELINE ESTABLISHED:** 2026-09-12
**PRODUCT #2:** Bella English Center
**NEXT:** Product #3 measurement

