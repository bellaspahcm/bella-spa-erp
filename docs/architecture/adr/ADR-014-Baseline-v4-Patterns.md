# ADR-014: Healthcare OS Architecture Baseline v4 & Perioperative Pattern Ratification

**Status:** ✅ APPROVED & RATIFIED (Architecture Constitution)  
**Effective Date:** 2026-08-12  
**Deciders:** ARB (Architecture Review Board), Core Platform Team  
**Scope:** Healthcare OS Kernel & All Bounded Contexts (Inpatient, Emergency, ICU, Surgery)  

---

## 1. Context & Architecture Baseline Evolution

With the successful completion of the **H4 Surgery/Perioperative Vertical Slice** (435 Executable Tests PASS across 42 Test Suites, Exit 0), we officially ratify **Architecture Baseline v4**.

```text
Baseline v1 (H1 Inpatient: 383 Guardian Tests)
       │
       ▼
Baseline v2 (H1 + H2 Emergency: 410 Guardian Tests)
       │
       ▼
Baseline v3 (H1 + H2 + H3 ICU: 428 Guardian Tests)
       │
       ▼
Baseline v4 (H1 + H2 + H3 + H4 Surgery: 435 Guardian Tests)
```

Baseline v4 integrates complex multi-stage scheduling, surgical safety checklists, and anesthesia verification logic with zero mutations to the core models of H1, H2, and H3. This further validates the robustness of the Healthcare Kernel.

---

## 2. Ratified Perioperative Patterns (Bằng Chứng Thực Nghiệm)

H4 demonstrates and locks 4 specific patterns in the architecture:

### Pattern 1: WHO Checklist Gates as Aggregated Invariants
- **Scope**: Clinical workflows with multi-stage safety checklists where proceeding to the next stage is contingent on completing checklist audits.
- **Invariant**: The `SurgicalCase` aggregate root strictly enforces WHO safety checklist phases (`signinCompleted`, `timeoutCompleted`, `signoutCompleted`) at the domain level. Transitions (`startProcedure`, `completeCase`) fail immediately if checklist parameters are incomplete.
- **Evidence**: `SurgicalCase.startProcedure` throws if `signinCompleted` or `timeoutCompleted` is false.

### Pattern 2: Multi-Engine Safety Gate Checking via Decoupled Contracts
- **Scope**: Verifying conditions managed by an external engine (e.g. CSSD) without taking ownership of its lifecycle.
- **Invariant**: The surgery engine queries `ISterilizationContract.isSterile` using a reference token. It checks the sterile status of equipment before starting a procedure, but never creates, modifies, or owns the sterilization cycles.
- **Evidence**: `ISterilizationContract` interface and its invocation in `SurgicalEngineService.startProcedure`.

### Pattern 3: Anesthesia Safety Gate and External Record Alignment
- **Scope**: Aligning procedural progression with external assessments and consents (e.g. Anesthesia pre-op and ASA classification).
- **Invariant**: The service layer coordinates cross-engine checks by ensuring that an anesthesia record exists in the database and has been updated to `pre_op_complete` with a valid ASA classification score (1-5) before permitting the surgical case to be marked as `ANESTHETIZED`.
- **Evidence**: `SurgicalEngineService.administerAnesthesia` validates the database state of the anesthesia record before updating the `SurgicalCase` aggregate.

### Pattern 4: Database-level Exclusion Constraints for Concurrent Resource Scheduling
- **Scope**: Preventing concurrent double-booking of resources (Operating Rooms and Surgeons) in high-volume, concurrent environments.
- **Invariant**: Rather than using complex application-level lock loops, scheduling is protected via PostgreSQL functional index exclusion constraints (`exclude_or_overlap`, `exclude_surgeon_overlap`). Under concurrent race conditions (`Promise.all`), exactly one transaction succeeds, and others are cleanly rolled back with database overlap violations.
- **Evidence**: `20260812070000_create_surgery_schema.sql` exclusion constraints and `SurgicalConcurrencyAndSafety.test.ts` concurrent tests.

---

## 3. Crucial Architectural Distinction: Pattern Proven $\neq$ Abstraction Created

A fundamental design law of Bella ERP is highlighted in Baseline v4:

> [!IMPORTANT]
> **Pattern Proven $\neq$ Abstraction Created**
> - Proving that Bed, Emergency Bay, ICU Bay, and Operating Room all follow the **Resource Scheduling and Concurrency Defense Pattern** does NOT mean we pull them into a shared `PlatformResourceAllocationPrimitive` in the Shared Kernel.
> - Pulling them into a single abstraction would introduce premature coupling. The business semantics, lifecycles, and transaction boundaries of a ward bed (long-term, nursing-owned), an emergency bay (short-term, triage-owned), and an operating room (multi-stage, surgeon-owned) are completely different.
> - **Rule**: Technical similarity (using PostgreSQL constraints or conditional locks) must not be confused with Business Semantic similarity. Keep domain models isolated.

---

## 4. Constitutional Rules Added in Baseline v4

1.  **Service-level Coordination for Cross-Engine Logic**:
    - Domain aggregate roots must remain independent. Cross-engine checks (such as verifying anesthesia records or CSSD tokens) must be orchestrated at the Application Service layer via repositories or contracts, rather than importing domain concepts directly into the aggregate root.
2.  **Strict Regression Invariant (435 Test Guardian)**:
    - The CI Gate `npm run ci:healthcare-gate` must maintain a **100% green rate across all 435 tests** before any code changes can be merged.
