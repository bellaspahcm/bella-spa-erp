---
tier: GOVERNANCE
domain: healthcare
status: ACTIVE
last_verified: "2026-08-17"
description: "20 Laws bắt buộc cho mọi Healthcare Product Vertical. Đọc TRƯỚC KHI code."
freeze_status: "H1-H12 FROZEN"
---

# BELLA HEALTHCARE OS — HEALTHCARE VERTICAL CODING CONSTITUTION

> **Status:** FINAL MANDATORY SPECIFICATION FOR ALL AI CODING AGENTS  
> **Effective Milestone:** Phase H12 Kernel Candidate Freeze (Kernel H1–H12 Locked)  
> **Scope:** Mandatory for all Healthcare Product Verticals (Bella Hospital, Bella Medical Clinic, Bella Dental, Bella Pharmacy, Bella Laboratory, Bella Home Care, and Specialty Clinics).

---

## I. NGUYÊN TẮC TỐI CAO (THE SUPREME CONSTITUTION)

### 🔴 HARD KERNEL FREEZE LOCK
```
BELLA HEALTHCARE OS — KERNEL FREEZE RULE

Healthcare OS Kernel H1–H12 is FROZEN.

The AI MUST NOT:
1. Create "H13" or any new core Healthcare Kernel engine.
2. Modify existing H1–H12 bounded-context responsibilities.
3. Bypass existing engine contracts or direct-query internal persistence tables (`hc_*`).
4. Introduce duplicate clinical logic or entities already owned by the Kernel.
5. Modify Kernel invariants merely to simplify product implementation.

The AI MUST:
1. Build strictly inside the Product Vertical Layer.
2. Consume H1–H12 capabilities through public contracts (`Product → Contract → Kernel`).
3. Reuse existing Kernel entities, engines, events, and governance.
4. Extend behavior additively without breaking Kernel invariants.
5. Pass all 11 Automated Verification Gates & full Kernel regression tests before completion.
```

---

## II. SƠ ĐỒ AI CODING FIREWALL & MA TRẬN QUYỀN SỞ HỮU DỮ LIỆU

### AI Coding Firewall Model
```
                    AI CODING AGENT
                           │
                           ▼
                ┌─────────────────────┐
                │ ARCHITECTURAL       │
                │ CONTROL GATE        │
                └──────────┬──────────┘
                           │
                 PASS ─────┼───── FAIL → ARCHITECTURAL GAP REPORTED
                           │
                           ▼
              PRODUCT VERTICAL LAYER
                           │
                  Public Contracts
                           │
                           ▼
              ┌──────────────────────┐
              │ HEALTHCARE OS KERNEL │
              │      H1 – H12        │
              │       🔒 FROZEN      │
              └──────────────────────┘
```

### Operational Execution Lifecycle
```
AI CODING REQUEST
       │
       ▼
ARCHITECTURAL CONTROL GATE
       │
       ├── FAIL ──► ARCHITECTURAL GAP DETECTED ──► HUMAN ARCHITECT REVIEW
       │
       └── PASS
             │
             ▼
      PRODUCT MANIFEST
             │
             ▼
       OWNERSHIP MAP
             │
             ▼
   CONTRACT DEPENDENCY MAP
             │
             ▼
   ADDITIVE DB MIGRATIONS
             │
             ▼
        PRODUCT CODE
             │
             ▼
     11 VERIFICATION GATES
             │
             ▼
  52/52 SUITES — 504/504 PASS (FULL KERNEL REGRESSION)
             │
             ▼
       PRODUCT RELEASE
```

### Ví dụ triển khai Bella Dental trên Frozen Kernel:
```
Dental Assessment
Dental Treatment Plan
Dental Procedure
Dental Tooth Chart
Dental Workflow
Dental Billing Projection
        │
        ▼
Product Vertical Layer (`src/products/dental` or `src/platform/healthcare/verticals/dental`)
        │
        ▼
Public Contracts / Events
        │
        ▼
H1–H12 Kernel (FROZEN)
```

### Ma Trận Quyền Sở Hữu Dữ Liệu ("WHO OWNS THIS DATA?")

| Dữ Liệu / Thực Thể (Entity) | Cơ Quan Chủ Quản (Owner) | Cơ Chế Phân Cấp / Truy Xung |
| :--- | :--- | :--- |
| **Patient / Person Profile** | **Person Engine (Kernel)** | Reused Kernel Aggregate |
| **Encounter State** | **Encounter Engine (Kernel)** | Law 1 Aggregate Root |
| **Clinical Order & Meds** | **Clinical / Pharmacy Engine (Kernel)** | Reused Kernel Aggregate |
| **Clinical Safety Rules** | **Rule Governance Engine (H10 Kernel)** | SemVer & SHA-256 Rule Checksum |
| **Historical State @ T** | **Temporal Engine (H9 Kernel)** | Bitemporal Timeline Snapshot |
| **Legal Audit & Evidence** | **Audit Compliance Engine (H11 Kernel)** | Append-Only Ledger & SHA-256 Fingerprint |
| **Dental Charting / Tooth State** | **Product Vertical (Dental)** | Product Additive Extension |
| **Dental Implant Procedure** | **Product Vertical (Dental)** | Product Additive Extension |
| **Dermatology Laser Assessment** | **Product Vertical (Dermatology)** | Product Additive Extension |

---

## III. 20 NON-NEGOTIABLE LAWS (20 ĐỊNH LUẬT BẮT BUỘC)

1. **Law 1: NO H13 LOCK.** Cấm tuyệt đối tạo H13 hay Engine lõi mới trong Kernel.
2. **Law 2: Product Boundary Scoping.** Code sản phẩm chỉ nằm trong `src/products/<product-name>` hoặc `src/platform/healthcare/verticals/<vertical-name>`.
3. **Law 3: Contract-Only Access.** Tương tác giữa Product và Kernel bắt buộc theo luồng `Product → Contract → Kernel`. Cấm query trực tiếp các bảng DB nội bộ như `hc_temporal_events` hay `hc_clinical_audit_ledger`.
4. **Law 4: Additive Database Migrations.** Chỉ được `CREATE` bảng sản phẩm mới (`dental_procedures`), `ADD` indexes. Cấm `ALTER`/`DROP` cột của Kernel.
5. **Law 5: Zero Entity Duplication.** Cấm tạo các bảng trùng lặp thực thể Kernel như `dental_patients`, `clinic_doctors`, `hospital_encounters`.
6. **Law 6: Transaction-First Event Publishing.** Tuân thủ nghiêm ngặt: `DB COMMIT → DOMAIN EVENT → CONSUMER`.
7. **Law 7: Zero-Tolerance Tenant Isolation (Gate 0 / P0).** Mọi truy vấn và dịch vụ phải kiểm tra `tenant_id`. Cross-tenant query lập tức bị chặn.
8. **Law 8: Mandatory Clinical Safety Routing.** Mọi quy tắc an toàn lâm sàng phải sử dụng đúng các Kernel capabilities tương ứng của H8 CDS, H10 Governance, H9 Temporal và H11 Audit & Evidence. Product không được tự triển khai hoặc bypass các capability này. Việc gọi engine được thực hiện thông qua Public Contracts và Event Bus theo đúng bounded-context responsibility.
9. **Law 9: Full Auditability.** Mọi hành động lâm sàng quan trọng phải tạo được gói bằng chứng H11 (`WHO, WHAT, WHEN, WHY, RULE_CHECKSUM, FINGERPRINT`).
10. **Law 10: Mandatory 11 Automated Verification Gates.** Tính năng chỉ được coi là hoàn thành khi viết đủ 11 loại test tự động và vượt qua full Kernel Regression Suite (`52/52 Suites GREEN`).
11. **Law 11: Architectural Gap Reporting.** Nếu sản phẩm thiếu hợp đồng Kernel, AI KHÔNG ĐƯỢC tự ý sửa Kernel mà phải báo cáo `ARCHITECTURAL GAP DETECTED`.
12. **Law 12: Encounter Aggregate Boundary Enforcement.** Mọi thao tác lâm sàng của ngành nhỏ bắt buộc phải gắn với đúng `encounter_id` của Kernel.
13. **Law 13: Bitemporal Provenance Preservation.** Sản phẩm không được ghi đè lịch sử quá khứ; mọi mutation phải ghi nhận bitemporal event qua Temporal Engine (H9).
14. **Law 14: Strict Typing.** Cấm tuyệt đối kiểu `any` trong toàn bộ code DTO, Domain Model, Event Payload, Service Contract và Product Vertical. Vi phạm phải bị phát hiện tự động trong Architecture Compliance Test.
15. **Law 15: Non-Bypassable ABSOLUTE_BLOCK.** Không một UI hay API ngành nhỏ nào được phép bypass quyết định `ABSOLUTE_BLOCK` từ CDS/Rule Engine.
16. **Law 16: Anti-False-Compliance Invariant.** Thiếu thông tin bằng chứng CDS/Temporal/Rule Checksum bắt buộc trả về trạng thái `REQUIRES_REVIEW` và `PARTIAL/BROKEN`.
17. **Law 17: Read-Model Projection Isolation.** Các bảng báo cáo/projection của ngành nhỏ phải tách biệt với write-model và tự động rebuild được từ Event Log.
18. **Law 18: Idempotent Event Consumer Invariant.** Mọi consumer tiếp nhận sự kiện trong ngành nhỏ phải đảm bảo tính idempotent, 0 nhân bản dữ liệu khi replay.
19. **Law 19: RLS & Authorization Governance.** Mọi bảng sản phẩm mới bắt buộc phải kích hoạt Row Level Security (RLS) và kiểm tra role-based authorization.
20. **Law 20: Full Kernel Regression Integrity.** Sau khi triển khai bất kỳ tính năng ngành nhỏ nào, lệnh `npx jest src/platform/healthcare/ --runInBand` bắt buộc phải ra `52/52 Suites PASS`.

---

## IV. ĐỊNH NGHĨA 11 AUTOMATED VERIFICATION GATES

Mỗi ngành nhỏ khi hoàn tất triển khai bắt buộc phải vượt qua đủ **11 loại kiểm thử tự động**:

| Gate # | Tên Automated Verification Gate | Mục Tiêu & Phạm Vi Thẩm Định |
| :---: | :--- | :--- |
| **Gate 1** | **Architecture Compliance Test** | Tự động kiểm tra Product Boundary, Encounter Aggregate Boundary, Strict Typing, không tạo H13 và không vi phạm các Kernel Architectural Laws. |
| **Gate 2** | **Contract Boundary Test** | Xác minh Product chỉ gọi qua Public Contracts; không truy vấn trực tiếp bảng DB nội bộ Kernel. |
| **Gate 3** | **Tenant Isolation Test (Gate 0 / P0)** | Thử nghiệm cách ly dữ liệu giữa Tenant A và Tenant B trên toàn bộ API, Service, Event và DB. |
| **Gate 4** | **RLS & Authorization Test** | Thẩm định Row Level Security và phân quyền vai trò bác sĩ / kỹ thuật viên / quản trị viên. |
| **Gate 5** | **Database Migration Safety Test** | Kiểm tra migration bổ sung tính năng hoàn toàn là Additive (CREATE/INDEX), không sửa/xóa bảng Kernel. |
| **Gate 6** | **Event-After-Persistence Test** | Kiểm tra thứ tự DB Commit thành công trước khi Domain Event được publish lên Event Bus. |
| **Gate 7** | **Clinical Safety Routing Test** | Kiểm tra các quy tắc an toàn lâm sàng được điều hướng đúng qua CDS (H8) và Governance (H10). |
| **Gate 8** | **Temporal Provenance Test** | Kiểm tra việc băm timeline bitemporal (H9) và tái dựng lịch sử quá khứ tại thời điểm T. |
| **Gate 9** | **Rule Governance Test** | Kiểm tra quy tắc lâm sàng tuân thủ SemVer và SHA-256 Rule Checksum của H10. |
| **Gate 10** | **Audit & Evidence Integrity Test** | Kiểm tra việc tạo gói bằng chứng H11 có SHA-256 Fingerprint write-once & Anti-False-Compliance. |
| **Gate 11** | **Full Kernel Regression Test** | Chạy toàn bộ Kernel Test Suite (`52/52 Suites GREEN`, `504/504 Tests PASS`) bảo toàn nền tảng. |

---

## V. ARCHITECTURAL CONTROL GATE MASTER PROMPT

Khi giao bất kỳ nhiệm vụ triển khai ngành nhỏ nào (Bella Hospital, Medical Clinic, Dental, Pharmacy, Lab, Home Care...), người quản trị bắt buộc gắn **Master Prompt** sau đây ở đầu yêu cầu:

```text
You are implementing a new Healthcare Product Vertical on top of Bella Healthcare OS.

ARCHITECTURAL STATUS:
Healthcare OS Kernel H1–H12 = KERNEL CANDIDATE FREEZE.

NON-NEGOTIABLE RULES:
1. DO NOT create H13 or new core Healthcare Kernel engines.
2. DO NOT modify H1–H12 responsibilities.
3. DO NOT directly access another engine's internal database tables (`hc_*`).
4. USE CONTRACTS ONLY across bounded contexts (Product → Contract → Kernel).
5. USE existing Kernel capabilities before creating new Product logic.
6. Product-specific logic belongs ONLY to Product Vertical Layer (`src/products/` or `src/platform/healthcare/verticals/`).
7. Database changes must be additive (CREATE new product tables, ADD product indexes).
8. Never duplicate Kernel-owned entities (Patient, Doctor, Encounter).
9. Preserve multi-tenant isolation (Gate 0 / P0).
10. Preserve RLS and authorization boundaries.
11. Preserve Encounter aggregate boundaries (Law 1).
12. Preserve Event-After-Persistence (DB COMMIT → DOMAIN EVENT).
13. Preserve Temporal provenance (H9).
14. Preserve Rule Governance (H10).
15. Preserve Audit & Evidence provenance (H11).
16. Clinical safety rules must use the appropriate CDS/Governance path via public contracts/events.
17. All important clinical actions must remain auditable.
18. Every new feature requires automated tests across all 11 Verification Gates.
19. Full Healthcare Kernel regression must remain GREEN (52/52 Suites PASS, 504/504 Tests PASS).
20. Report any Architectural Gap Detected instead of modifying Kernel silently.

BEFORE CODING, YOU MUST PROVIDE:
A. Product Manifest (Capabilities & Scope)
B. Ownership Map ("WHO OWNS THIS DATA?")
C. Contract Dependency Map
D. Required Additive Database Migrations
E. Required 11 Automated Verification Test Suite List

DO NOT CODE UNTIL THIS ARCHITECTURE ANALYSIS IS COMPLETE.
```
