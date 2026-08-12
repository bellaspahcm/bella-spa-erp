# ADR-013: Healthcare OS Architecture Baseline v3 & Critical Care Pattern Ratification

**Status:** ✅ APPROVED & RATIFIED (Architecture Constitution)  
**Effective Date:** 2026-08-12  
**Deciders:** ARB (Architecture Review Board), Core Platform Team  
**Scope:** Healthcare OS Kernel & All Bounded Contexts (Inpatient, Emergency, ICU/CCU, Surgery/OR)  

---

## 1. Context & Architecture Baseline Evolution

Healthcare OS architectural maturity progresses strictly based on empirical evidence:

```text
Baseline v1 (H1 Inpatient: 383 Guardian Tests)
       │
       ▼
Baseline v2 (H1 + H2 Emergency: 410 Guardian Tests)
       │
       ▼
Baseline v3 (H1 + H2 + H3 ICU: 428 Guardian Tests)
```

Baseline v3 integrates the high-frequency state transitions, continuous care metrics, and automated clinical safety logic of **H3 ICU/CCU** with **0 lines of legacy code mutations** in H1 and H2. This proves the adaptive capacity of the Healthcare Kernel.

---

## 2. Ratified Critical Care Patterns (Bằng Chứng Thực Nghiệm)

H3 demonstrates and locks 6 specific patterns in the architecture:

### Pattern 1: Continuous Monitoring & Telemetry Ingestion
- **Scope**: Ingesting high-frequency vital stats and telemetry without overwhelming the primary domain aggregates or transactional stores.
- **Invariant**: Domain Aggregates only ingest processed, periodic summaries or validated thresholds rather than raw telemetry feeds. This maintains lightweight transaction scopes.
- **Evidence**: `ICriticalObservationContract` decouples telemetry writers from clinical state machines.

### Pattern 2: Safety Barrier & Hard Block Pattern
- **Scope**: Automated clinical safety guards that intercept state changes and prevent hazardous conditions at the aggregate and database layers.
- **Invariant**: If parameters exceed safety ranges (e.g., $FiO_2 > 100\%$), the aggregate immediately rejects the transaction, transitions to a safety state, emits a safety violation event (`hos.icu.ventilator_safety_blocked.v1`), and enforces a **HARD BLOCK** preventing further execution.
- **Evidence**: `VentilatorSession` validation rules and unit tests verifying state rejection.

### Pattern 3: Clinical Critical Care Scoring Strategy
- **Scope**: Calculation of clinical prognostic index formulas (SOFA, APACHE II) using dynamic assessment data.
- **Invariant**: Domain Aggregate (`IcuStay`) remains strategy-agnostic. It communicates strictly via `IScoringStrategy` abstract interfaces. Scoring rules can change or expand without mutating aggregate fields.
- **Evidence**: `IScoringStrategy`, `SofaScoringStrategy`, and `SofaScoringStrategy.test.ts`.

### Pattern 4: Decoupled Observation Consumption
- **Scope**: Consuming vital observations from other contexts (like Nursing or Lab) without introducing circular imports.
- **Invariant**: Target engines read observations strictly through read-only contracts (`IMARReader`, etc.) rather than importing domain entities directly.
- **Evidence**: `supabase-mar-reader.ts` implementation.

### Pattern 5: Critical Resource Concurrency & Conditional Allocation
- **Scope**: Allocation of limited physical/clinical resources (ICU Bay, Emergency Bay, Operating Room).
- **Invariant**: Concurrent requests for the same bay are blocked at both the domain entity layer and database layer utilizing optimistic concurrency or unique conditional bounds.
- **Evidence**: `IcuBay` concurrency integration tests demonstrating race-condition failure on duplicate requests.

### Pattern 6: Multi-Domain Clinical Continuity Workflow
- **Scope**: Patient transfer and clinical handoff across vertical modules.
- **Invariant**: Decision Ownership $\neq$ Lifecycle Ownership. The originating engine decides disposition destination; the destination engine controls the lifecycle admission state.
- **Evidence**: `icu-h2-h3-h1-continuity.integration.test.ts` executing the complete chain: `Emergency ADMIT` $\rightarrow$ `Inpatient Admission` $\rightarrow$ `Bed Allocation` $\rightarrow$ `ICU Critical Care` $\rightarrow$ `Stabilization` $\rightarrow$ `Step-down`.

---

## 3. Constitutional Rules Added in Baseline v3

1. **Internal Domain Entities Constraint**:
   - Entities like `VentilatorSession` must be kept internal to the parent aggregate root (`IcuStay`) and not exposed as separate repositories or independent engines, avoiding domain engine inflation.
2. **Zero-Regression Invariant**:
   - The CI Gate `npm run ci:healthcare-gate` must maintain a **100% green rate across all 428 tests** (comprising Inpatient, Emergency, and ICU suites) before any branch merge.
