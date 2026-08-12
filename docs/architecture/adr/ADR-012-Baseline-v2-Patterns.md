# ADR-012: Healthcare OS Architecture Baseline v2 & Pattern Ratification

**Status:** ✅ APPROVED & RATIFIED (Architecture Constitution)  
**Effective Date:** 2026-08-12  
**Deciders:** ARB (Architecture Review Board), Core Platform Team  
**Scope:** Healthcare OS Kernel & All Vertical Modules (H1 Inpatient, H2 Emergency, H3 ICU/CCU, H4 Surgery/OR)  

---

## 1. Context & Architecture Baseline Evolution

Healthcare OS architectural maturity follows a strict evidence-based progression:

```text
Baseline v1 (H1 Inpatient: 383 Guardian Tests)
       │
       ▼
H1.1 Self-Defending Architecture CI Gate
       │
       ▼
H2 Emergency Vertical Slice Execution
       │
       ▼
Baseline v2 RATIFIED = H1 Baseline (383 Tests) + H2 Tests (27 Tests) = 410 Executable Tests (35 Test Suites)
```

Baseline v2 does NOT replace Baseline v1 history; rather, **Baseline v2 builds directly on Baseline v1**, proving that Healthcare OS Kernel can absorb time-critical clinical domains without modifying any H1 production code (0 lines mutated) and without creating redundant vertical engines (0 duplicate engines created).

---

## 2. Evidence-Based Ratification (Bằng Chứng Thực Nghiệm)

Mỗi Pattern trong Baseline v2 được Ratify dựa trên bằng chứng code & test thực tế đã được chứng minh trong hệ thống:

| Ratified Pattern | Empirical Code & Test Evidence (Bằng Chứng Thực Tế) | Status |
| :--- | :--- | :---: |
| **Pattern 1: Time-Critical Workflow** | `triage.entity.ts`, `emergency-assessment.entity.ts` (`reassessmentHistory`, `encounterId` audit trail, `acuity-escalated` events) | ✅ RATIFIED |
| **Pattern 2: Resource Allocation & Concurrency Defense** | H1 Bed Allocation (`bed.allocate`) + H2 Emergency Bay (`EmergencyBay.allocateConditional` with `Promise.all` race-condition test) | ✅ RATIFIED |
| **Pattern 3: Protocol-Driven Decision** | `ITriageProtocol` interface strategy + `EsiTriageProtocol` implementation (`esi-triage.protocol.test.ts`) | ✅ RATIFIED |
| **Pattern 4: Disposition Orchestration** | H2 `decideDisposition()` + `ITransferContract` & H1 `AdmissionEngineService` / `BedEngineService` (`emergency-3-scenarios.integration.test.ts`) | ✅ RATIFIED |

---

## 3. Detailed Pattern Definitions

### Pattern 1: Time-Critical Workflow Pattern
- **Scope**: `Triage -> Rapid Assessment -> Time-Sensitive Reassessment -> Acuity Escalation -> Audit Trail`.
- **Classification**: Domain Workflow Pattern (phạm vi Bounded Context khẩn cấp: Emergency, ICU, Trauma), **KHÔNG** đưa sớm thành Kernel Engine chung.
- **Invariant**: Mọi thao tác reassessment & escalation phải gắn chặt với `encounterId`, ghi lại timestamp, người thực hiện, và lưu lại lịch sử thay đổi acuity (`reassessmentHistory`) để đảm bảo khả năng truy nguyên (traceability).

### Pattern 2: Resource Allocation & Concurrency Defense Pattern
- **Scope**: Atomic Conditional Updates (`.eq('status', 'AVAILABLE')` hoặc DB-level locking) áp dụng cho tài nguyên vật lý (`Bed` entity ở H1, `EmergencyBay` resource ở H2).
- **Invariant**: Ngăn ngừa triệt để Race Condition ghi nhận trùng tài nguyên dưới tải cao (`Promise.all` concurrency test).

### Pattern 3: Protocol-Driven Decision Pattern
- **Scope**: `Clinical Domain Entity -> Strategy Interface (ITriageProtocol) -> Concrete Protocol (EsiTriageProtocol) -> Clinical Score / Decision`.
- **Classification**: Clinical Strategy Pattern.
- **Invariant**: Domain Aggregate làm chủ ý nghĩa nghiệp vụ (`AcuityLevel`, `Priority`); Protocol Implementation làm chủ phương pháp tính (scoring formula). Cho phép thay đổi hay hoán đổi giữa ESI, CTAS, Manchester mà không làm hỏng hay biến đổi Aggregate.

### Pattern 4: Disposition Orchestration Pattern
- **Scope**: `Clinical Decision (EmergencyDisposition) -> Destination Contract (ITransferContract / IAdmissionContract) -> Destination Engine làm chủ Vòng Đời Thực Thi`.
- **Classification**: **Healthcare OS Platform Pattern** (áp dụng toàn hệ thống cho các luồng: Emergency → Inpatient, Emergency → Transfer, Clinic → Surgery, ED → ICU, Ward → OR).
- **Invariant**: **Quyền Làm Chủ Quyết Định (Decision Ownership) ≠ Quyền Làm Chủ Vòng Đời Điểm Đến (Lifecycle Ownership)**. Engine nguồn chỉ ra quyết định chuyên môn nơi đến; Engine đích làm chủ tiến triển trạng thái của điểm đến.

---

## 4. Rule Against Premature Kernel Abstraction (Luật Chống Trừu Tượng Hóa Sớm)

> [!CAUTION]
> **CONSTITUTIONAL RULE**: Không bao giờ trừu tượng hóa một capability xuống Shared Kernel chỉ dựa trên 1 hoặc 2 implementations độc lập. Một capability/abstraction CHỈ ĐƯỢC PHÉP xem xét đưa xuống Kernel khi có **ít nhất 3 Bounded Contexts độc lập** chứng minh cùng một invariant, cùng semantics, và cùng lifecycle requirements.
>
> *Ví dụ*: H1 có `Bed`, H2 có `EmergencyBay`. Dù cả 2 đều sử dụng Atomic Conditional Lock, hệ thống **KHÔNG TẠO** `ResourceEngine` chung ở Baseline v2. Chỉ khi H3 (ICU resource) hoặc H4 (OR resource) độc lập chứng minh nhu cầu tương đương, ARB mới xem xét abstraction.

---

## 5. Consequences & Merging Authority

- **Zero Regression Invariant**: Pipeline `npm run ci:healthcare-gate` bắt buộc đạt **EXIT CODE 0** với 410/410 tests PASS (383 Baseline v1 + 27 Baseline v2) trước khi chấp nhận bất kỳ Pull Request mới nào.
- **Roadmap Readiness**: Khóa **Baseline v2 RATIFIED**. Hệ thống sẵn sàng cho **Milestone H3 (ICU / CCU Vertical Slice)**.
