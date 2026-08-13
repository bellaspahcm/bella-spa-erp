# H8 — Clinical Decision Support (CDS)
# ARB Design Freeze Document

**Status**: DESIGN FREEZE — LOCKED  
**Date**: 2026-08-13  
**Prerequisite**: Baseline v7 / ADR-017 (470/470 PASS)  
**Next step after approval**: Implementation Plan → Execution → Baseline v8

---

## Mission Statement

> H8 phải chứng minh: **Bella có thể hiểu bối cảnh lâm sàng, đánh giá quy tắc và kiểm soát quyết định lâm sàng.**

H1–H4 chứng minh Bella có thể **vận hành** quy trình lâm sàng.  
H5–H7 chứng minh Bella có thể **bảo vệ** các safety obligations lâm sàng.  
**H8 phải chứng minh Bella có thể **kiểm soát quyết định** lâm sàng.**

---

## Core Principle (LOCKED)

> **Đừng cố chứng minh H8 "thông minh". H8 trước tiên phải chứng minh nó: đúng, giải thích được, truy vết được, kiểm soát được và không phá kiến trúc.**

Prediction, AI chẩn đoán, machine learning, tối ưu điều trị → H9+. Không phải H8.

---

## 10 Architectural Invariants (ALL LOCKED)

### Invariant 1 — CDS không phải "God Engine"

```
CDS không được:
  ├── import trực tiếp Lab Engine
  ├── import trực tiếp Pharmacy Engine
  ├── import trực tiếp Blood Bank Engine
  ├── import trực tiếp bất kỳ engine nào
  └── sửa trực tiếp state của engine khác

CDS chỉ được:
  ├── subscribe domain events
  ├── maintain Clinical Context Read Model từ events
  ├── evaluate rules trên Read Model
  └── publish Decision events
```

Nếu H8 phá invariant này, giá trị kiến trúc của H1–H7 bị giảm đáng kể.

---

### Invariant 2 — Clinical Context từ Read Model, không phải direct call

**Câu hỏi kiến trúc quan trọng nhất của H8:**

> *"CDS cần biết: bệnh nhân, encounter, chẩn đoán, thuốc đang dùng, dị ứng, kết quả xét nghiệm, sinh tồn, chỉ định. Nhưng không được đọc trực tiếp từ engine nào."*

**Giải pháp: Clinical Context Read Model**

```
Lab Engine          → publishes → hos.lab.result.verified.v1
Pharmacy Engine     → publishes → hos.rx.dispensed.v1
Blood Bank Engine   → publishes → hos.blood.transfusion.completed.v1
Inpatient Engine    → publishes → hos.encounter.updated.v1
...
        │
        ▼
Clinical Context Projection
(CDS subscribes, maintains own read model)
        │
        ▼
CDS Rule Evaluation (reads only from its own projection)
```

CDS phải được thiết kế rõ ràng trước khi code:
- Schema của Clinical Context Projection
- Events nào được subscribe
- Staleness tolerance (context bao lâu thì coi là stale)

---

### Invariant 3 — 4 thứ phải tách biệt: Rule / Evaluation / Decision / Override

```
Rule          = định nghĩa điều kiện + action (có version)
Evaluation    = áp dụng Rule lên Context tại một thời điểm
Decision      = kết quả của một Evaluation (immutable sau khi tạo)
Override      = một hành động mới, không sửa Decision cũ
```

**Không được gộp** Rule + Evaluation vào cùng service.  
**Không được gộp** Decision + Override thành một record duy nhất.  
**Không được** xóa hoặc update Decision đã tạo.

---

### Invariant 4 — Override semantics LOCKED

```
Override KHÔNG có nghĩa là:
  "quyết định sai → sửa thành đúng"

Override CÓ nghĩa là:
  "có một ngoại lệ có thẩm quyền được ghi nhận"
```

Ví dụ đúng:
```
Decision: BLOCK (rule: DRUG_ALLERGY_001 v1.2)
      ↓
Override: { by: clinicianId, reason: "...", at: timestamp, ruleVersion: "1.2" }
      ↓
Status: BLOCK_OVERRIDDEN (không phải ALLOWED)
```

Block vẫn còn. Override chỉ ghi nhận ngoại lệ. Hai trạng thái hoàn toàn khác nhau.

---

### Invariant 5 — Decision Provenance IMMUTABLE

Mỗi Decision phải trả lời được tất cả:

```typescript
interface ClinicalDecision {
  decisionId:      string;   // immutable
  patientId:       string;
  encounterId:     string;
  ruleId:          string;
  ruleVersion:     string;   // e.g. "DRUG_ALLERGY_001@1.2.0"
  inputSnapshot:   Record<string, unknown>; // clinical context tại thời điểm evaluate
  result:          'ALLOW' | 'WARNING' | 'BLOCK';
  severity:        'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reasoning:       string;   // human-readable explanation
  createdAt:       string;

  // Override (nếu có)
  overridden:      boolean;
  overriddenBy?:   string;
  overrideReason?: string;
  overrideAt?:     string;
  overrideRuleVersion?: string;
}
```

**Không có UPDATE trên `hc_clinical_decisions`.** Chỉ INSERT.  
Override tạo một record mới tham chiếu `decisionId` gốc.

---

### Invariant 6 — Rule phải versioned

```
RULE-DRUG-ALLERGY-001
  version: 1.0.0  → deployed 2026-01-01
  version: 1.1.0  → deployed 2026-03-15
  version: 1.2.0  → deployed 2026-08-13  ← current
```

Decision phải lưu `ruleVersion` tại thời điểm evaluation.  
Khi rule thay đổi: `1.2.0 → 1.3.0`, Decision cũ vẫn biết nó được tạo bởi `1.2.0`.

Không được để rule là "current logic" không versioned.

---

### Invariant 7 — CDS không tự động "hành động" ở H8

H8 chỉ là **Decision Support / Decision Gate**:

```
CDS → WARNING  → hiển thị cho clinician
CDS → BLOCK    → ngăn action cho đến khi override
CDS → ALLOW    → tiếp tục
```

H8 **KHÔNG** được:
- Tự động thay đổi thuốc
- Tự động hủy order
- Tự động điều trị
- Tự động escalate sang engine khác

Hành động tự động → H8.3+ / H9.

---

### Invariant 8 — Concurrency phải được thiết kế, không phải xử lý sau

Các scenario phải có test riêng:

```
concurrent evaluations (2 clinicians cùng trigger evaluation)
duplicate evaluations  (same context, same rule, same time)
stale context          (context thay đổi trong khi evaluation đang chạy)
concurrent overrides   (2 clinicians cùng override một decision)
duplicate override     (override đã tồn tại)
```

Idempotency key bắt buộc cho mọi `evaluateRule` và `overrideDecision` request.

---

### Invariant 9 — Scope H8 = H8.1 + H8.2 (KHÔNG phải H8.3 hay H9)

```
H8.1  Context + Rules + Evaluation + Decision
H8.2  Block / Warning / Override + Governance
──────────────────────────────────────────────
      → Baseline v8

H8.3  Cross-engine Orchestration (Post-H8)
H9    Adaptive / AI Clinical Intelligence (tương lai)
```

H8 execution không được scope creep sang H8.3 hay H9.

---

### Invariant 10 — Kernel MUST remain frozen

Sau H8:
- `Kernel mutation = 0`
- `Cross-engine imports = 0`
- `CDS Engine imports from other engines = 0`
- `as any = 0`
- `Regression = 0`

Nếu một trong các số này khác 0, H8 FAIL bất kể test khác ra sao.

---

## 6 H8 Gates (DEFINED BEFORE CODE)

### Gate 1 — Context Isolation
**CDS lấy được clinical context mà không import trực tiếp bất kỳ engine nào.**

Test: CDS engine không có `import` nào từ `engines/lab-engine`, `engines/pharmacy-engine`, `engines/blood-bank-engine`, v.v.  
Test: Clinical Context Projection được populate từ domain events.  
Test: CDS có thể evaluate rule khi context đến từ events của Lab + Pharmacy cùng lúc.

### Gate 2 — Rule Versioning & Deterministic Evaluation
**Rule được version hóa và evaluation là deterministic với cùng input.**

Test: Same rule version + same input snapshot → same Decision output.  
Test: Rule v1.2 và rule v1.3 có thể tồn tại đồng thời.  
Test: Decision lưu đúng `ruleVersion` tại thời điểm evaluation.

### Gate 3 — Decision Safety (ALLOW / WARNING / BLOCK)
**Ba outcome hoạt động đúng với đúng severity.**

Test: Rule DRUG_ALLERGY → BLOCK khi drug code trùng allergy list.  
Test: Rule DRUG_INTERACTION → WARNING khi có tương tác nhẹ.  
Test: Rule DOSE_NORMAL → ALLOW khi liều trong ngưỡng an toàn.  
Test: BLOCK ngăn action tiếp theo cho đến khi có Override.

### Gate 4 — Override Governance
**Override bắt buộc có: người, lý do, thời điểm, version rule.**

Test: Override không có `reason` → REJECTED.  
Test: Override không có authorized `overriddenBy` → REJECTED.  
Test: Override lưu đúng `ruleVersion` của Decision bị override.  
Test: Status sau override = `BLOCK_OVERRIDDEN` (không phải `ALLOW`).  
Test: Duplicate override → idempotent (không tạo 2 override records).

### Gate 5 — Immutable Decision Provenance
**Decision history không thể bị sửa hoặc xóa.**

Test: `hc_clinical_decisions` không có UPDATE operation.  
Test: Override tạo record mới với `originalDecisionId`, không update record gốc.  
Test: `inputSnapshot` trong Decision phản ánh đúng context tại thời điểm evaluation.  
Test: Decision của rule v1.2 vẫn đọc được sau khi rule nâng lên v1.3.

### Gate 6 — Concurrency & Event Ordering
**Concurrent evaluations/overrides không tạo inconsistent state. Events chỉ phát sau persistence.**

Test: 2 concurrent `evaluateRule` cùng ruleId + encounterId → idempotent, không tạo 2 conflicting decisions.  
Test: 2 concurrent `overrideDecision` cùng decisionId → chỉ một thành công, một thất bại gracefully.  
Test: `eventBus.publish` chỉ được gọi sau khi DB write thành công.  
Test: Stale context (context updated trong khi evaluate) → evaluation bị reject hoặc retry với context mới.

---

## Phased Execution Plan

```
H8 ARB Design Freeze (tài liệu này)
        ↓
H8 Implementation Plan (schema + service + contracts)
        ↓
H8 Execution (H8.1 → H8.2)
        ↓
Baseline v8 (470 + H8 gates)
        ↓
ADR-018 Ratification
        ↓
H8.3 Cross-engine Orchestration (Post-H8)
```

---

## Schema Sketch (Pre-implementation)

```sql
-- Clinical Context Projection (CDS's own read model)
hc_clinical_context_snapshots
  id, tenant_id, encounter_id, patient_id
  allergies, active_medications, lab_results
  vital_signs, diagnoses, active_orders
  last_updated_at, version

-- Clinical Decision Rules (versioned)
hc_cds_rules
  id, tenant_id, rule_code, rule_version
  description, conditions (jsonb), outcome
  severity, active, created_at

-- Clinical Decisions (immutable — INSERT ONLY)
hc_clinical_decisions
  id, tenant_id, encounter_id, patient_id
  rule_id, rule_version, input_snapshot (jsonb)
  result (ALLOW|WARNING|BLOCK), severity, reasoning
  created_at

-- Decision Overrides (separate table)
hc_decision_overrides
  id, tenant_id, original_decision_id
  overridden_by, override_reason, rule_version_at_override
  override_at
```

---

## What Success Looks Like

H8 thành công khi:

```
Gate 1  Context Isolation             PASS
Gate 2  Rule Versioning               PASS
Gate 3  Decision Safety               PASS
Gate 4  Override Governance           PASS
Gate 5  Immutable Provenance          PASS
Gate 6  Concurrency & Event Ordering  PASS

Kernel mutation          = 0
Cross-engine imports     = 0
CDS → Engine imports     = 0
as any                   = 0
Regression               = 0
```

Và Healthcare OS evolution chain được chứng minh:

```
H1–H4   Clinical Operations Platform    ✅
H5–H7   Clinical Safety Platform        ✅
H8      Clinical Decision Platform      ← đây
```
