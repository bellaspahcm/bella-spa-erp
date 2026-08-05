# Bella Healthcare Platform — Industry Platform Blueprint
## Implementation Plan v8 (Architecture Freeze Edition)

> **Ngày:** 2026-08-05  
> **Tác giả:** Antigravity AI Partner  
> **Vị trí:** `docs/health-care/implementation_plan.md`  
> **Tầm nhìn 20 năm:** Kiến trúc Enterprise Industry Platform đa ngành (Healthcare, Auto, Real Estate, Spa, Retail).  
> **Trạng thái:** Đóng băng Kiến trúc (Architecture Freeze) với **15 Platform Engines**, **Context Engine**, **Composition Engine**, và **Platform SDK**.

---

## 1. Bản Đồ Kiến Trúc: Blueprint & Platform Core v8

```
Bella AI Platform Core
│
├── [PLATFORM SDK] — src/platform/sdk/
│   └── Giao diện chuẩn (Domain, Repository, Query, Event, Command, Validation, Projection SDK)
│
├── [CONTEXT ENGINE] — src/platform/context/
│   └── Platform Core Service định hình Execution Context (Tenant, Branch, Roles, Capabilities, Flags)
│
├── [COMPOSITION ENGINE] — src/platform/composition/
│   └── Lifecycle Manager: install, activate, suspend, upgrade, rollback, uninstall capabilities
│   └── Verification Pipeline: Health Check, Compatibility Check, Migration Check, Rollback Check
│
├── [PLATFORM BLUEPRINT ENGINES] — src/platform/ (15 Core Engines)
│   ├── Party Engine        ← Identity Aggregate (Person/Org, Identifiers, Relationships)
│   ├── Journey Engine      ← Business Aggregate Root (Journey → SubJourney → Milestones → Encounters)
│   ├── Timeline Engine     ← Platform Event Store (Business, Audit, AI, System; seq_number, hash, causation)
│   ├── Workflow Engine     ← BPMN-like (Workflow Definition vs Workflow Instance)
│   ├── Resource Engine     ← Schedulable Resource (Capacity, Utilization, Reservation, Skills)
│   ├── Asset Engine        ← Managed Asset (Tooth, Vehicle, Apartment, Device, Xray)
│   ├── Contract Engine     ← Commitment & Warranty (Package, Installment, BHYT, Warranty Contract)
│   ├── Document Engine     ← Form & File Generator (SOAP, Invoice, Consent, Signatures)
│   ├── Policy Engine       ← Rule Engine (Rule Set → Policy → Rule → Condition → Action; Versioned & Simulation)
│   ├── Knowledge Engine    ← 5-Layer AI RAG (Facts, Inference, Prompts, Embeddings, Ontology)
│   ├── PlatformAIOrchestrator ← Pure AI (LLM → Prompt Builder → Tool Registry → Provider → Engine)
│   ├── EventBus (Platform) ← Platform Event Hub (healthcare.*, auto.*)
│   ├── Notification Engine ← Multi-channel Dispatcher (SMS, Email, Webpush, Zalo, Webhook)
│   ├── Integration Engine  ← Connector Manager (LIS, PACS, BHYT, VNPay; Webhook, Queue, DLQ, Idempotency)
│   └── Capability Registry ← Dependency Graph (depends_on, optional_dependencies, conflicts_with, replaces)
│
└── [VERTICAL KERNELS] — src/modules/
    ├── Healthcare Kernel (HOS)
    │     Providers: HealthcareKnowledgeProvider, HealthcarePolicyProvider, HealthcareWorkflowProvider
    │     Party → Patient, Doctor, Nurse, Hospital, Insurer
    │     Journey → Care Journey (Implant Journey, Ortho Journey)
    │     Adapter → Accounting Adapter (kết nối Platform Accounting Outbox)
    │     Capabilities: Odontogram (UI), SOAP AI (AI), BHYT (Connector)
    │
    ├── Auto Kernel         ← [FUTURE]
    └── Real Estate Kernel  ← [FUTURE]
```

---

## 2. 15 Blueprint Engines & Core Infrastructure (v8 Updates)

### 0. Context Engine (Platform Core)
- Cung cấp `PlatformContext` chứa thông tin về Tenant, Chi nhánh, User Roles, các Capabilities đang kích hoạt, Feature Flags, Múi giờ và Ngôn ngữ.
- Mọi API, Workflow Task, và AI Agent hoạt động trong Platform đều bắt buộc phải inject `PlatformContext` qua constructor hoặc tham số đầu vào.

### 1. Composition Engine & Capability Lifecycle
- **Dependency Graph:** Giải quyết quan hệ phụ thuộc đầy đủ của Capabilities: `depends_on`, `optional_dependencies`, `conflicts_with`, `replaces`, `requires_license`, `minimum_platform_version`, `maximum_platform_version`, `api_contract_version`.
- **Verification Pipeline:** Trước khi cài đặt/nâng cấp capability sẽ chạy qua 4 bước kiểm tra tự động:
  - `Health Check`: Đo lường sức khỏe tài nguyên hiện tại.
  - `Compatibility Check`: Đánh giá mức độ tương thích với các capability đã cài.
  - `Migration Check`: Chạy thử schema migration dry-run.
  - `Rollback Check`: Đảm bảo quy trình hoàn trả trạng thái ban đầu hoạt động nếu có sự cố.

### 2. Party Engine (Identity, Identifiers & Relationships)
- **External Identifiers:** Bảng `party_identifiers` lưu CCCD, Passport, BHYT, Tax ID, Mã định danh HIS bệnh viện ngoài, Mã CRM cũ... thông qua cặp `identifier_type` và `identifier_value`.
- **Relationship Manager:** Bảng `party_relationships` mô hình hóa các mối quan hệ đa chiều: `parent`, `child`, `guardian`, `belongs_to`, `works_for`, `member_of`, `owner_of`, `referred_by`... để AI và hệ thống phân quyền có thể duyệt cây quan hệ mà không cần JOIN phức tạp.

### 3. Journey Engine (Journey → SubJourney → Milestone)
- **SubJourneys:** Hỗ trợ chia nhỏ một hành trình dài hạn thành các giai đoạn có vòng đời riêng (ví dụ: Implant Journey gồm SubJourneys: *Phẫu thuật cấy ghép trụ* → *Healing* → *Lắp phục hình sứ*). Mỗi SubJourney quản lý các Milestones và Encounters độc lập.
- **Milestone Engine:** Quản lý tiến độ nghiệp vụ, tự động đánh giá trạng thái hoàn thành Milestone bằng AI hoặc Workflow.

### 4. Timeline Engine (Platform Event Store)
Timeline Engine hoạt động như một Event Store thực thụ hỗ trợ replay chính xác:
- **Event Schema:** Bổ sung các trường `event_version`, `schema_version`, `aggregate_id`, `aggregate_type`, `sequence_number` (tự tăng per aggregate), và `event_hash` (đảm bảo tính toàn vẹn của chuỗi sự kiện).
- **Causation & Correlation ID:** Lưu vết chuỗi nhân quả để AI dễ hành trình lại quá khứ để lý giải các biến động chỉ số kinh doanh.
- **Event Categorization:** Phân biệt `business`, `audit`, `ai`, `system` events.

### 5. Resource Engine (Capacity, Skills & Certifications)
- **Schedulable Resources:** Lên lịch sử dụng cho Con người, Thiết bị, Phòng khám, Ghế nha, Bed, v.v.
- **Skills & Certifications:** Cấu trúc `resource_skills` và `resource_certifications` (ví dụ: Bác sĩ có kỹ năng *Cấy Implant Level 3*, chứng chỉ *Invisalign*). AI Scheduling và Workflow Engine sử dụng dữ liệu này để tự động gán tài nguyên phù hợp nhất.
- **Capacity & Reservation:** Theo dõi công suất hoạt động (`capacity`), hiệu suất thực tế (`utilization`) và lịch giữ chỗ trước (`reservation`).

### 6. Asset Engine
Quản lý vòng đời tài sản (khác với Resource - thứ dùng để schedule). Asset là đối tượng chịu sự quản lý, chăm sóc, sửa chữa hoặc giao dịch của hệ thống.
- **Healthcare Assets:** Răng (Tooth) của bệnh nhân, Trụ Implant được cấy, Phim X-Ray, CBCT.
- **Auto Assets:** Xe (Vehicle), Động cơ (Engine), Ắc quy (Battery).
- **Real Estate Assets:** Chung cư (Apartment), Tòa nhà (Building), Bãi đỗ xe (Parking Space).
- **Retail Assets:** Mặt hàng tồn kho (Inventory Item).

### 7. Contract Engine
Quản lý các cam kết tài chính hoặc dịch vụ dài hạn.
- **Contracts:** Phác đồ điều trị đã chốt (Treatment Contract), Hợp đồng đặt cọc (Deposit Contract), Hợp đồng mua xe (Sale Contract), Gói bảo hành (Warranty Contract), Thẻ hội viên (Membership), Hợp đồng trả góp (Installment).
- **Trạng thái:** Quản lý hạn mức, điều khoản thanh toán, và tự động đối chiếu hóa đơn (Invoices).

### 8. Document Engine
Tái dụng `platform/document-engine` hiện có. Quản lý việc sinh biểu mẫu y tế, hóa đơn, Consent Form, hồ sơ bệnh án có chữ ký điện tử.

### 9. Policy Engine (Versioning, Simulation & Structure)
Tách biệt rõ cấu trúc Rule trong Database:
- **Cơ cấu phân cấp:** **Rule Set → Policy → Rule → Condition → Action** thay vì lưu JSON thô, giúp AI đọc hiểu và mô phỏng luật dễ dàng hơn.
- **Versioning:** Mỗi Policy Definition đều có `version`, `effective_from`, và `effective_to` để hệ thống áp dụng đúng luật tại thời điểm giao dịch xảy ra trong quá khứ khi thực hiện kiểm toán (audit replay).
- **Simulation Interface:** Hỗ trợ chạy giả lập thử nghiệm tác động của luật mới trên dữ liệu lịch sử.

### 10. Knowledge Engine (Facts, Inference & Ontology)
Phân tầng tri thức rõ rệt:
- **Facts:** Danh mục ICD-10, ATC Drug Catalog, SOP, Treatment Templates.
- **Inference (Reasoning Rules):** Quy tắc suy luận logic (Allergy Penicillin → Block Amoxicillin).
- **Prompt Templates:** Các prompt mẫu phục vụ cho AI RAG.
- **Embeddings:** Vector embedding tương ứng của từng entry.
- **Ontology (Mô hình ngữ nghĩa):** Định nghĩa quan hệ thực thể (Patient - Doctor - Drug - Procedure) giúp AI Reasoning có độ chính xác y khoa tuyệt đối.

### 11. PlatformAIOrchestrator (Tool Registry Layer)
- Trừu tượng hóa hoàn toàn. AI Orchestrator không gọi trực tiếp bất kỳ Engine nào.
- Luồng xử lý: **LLM → Prompt Builder → Tool Registry → Provider → Engine**.
- AI chỉ làm việc với các Tools được đăng ký trong `Tool Registry` của platform. Điều này giúp dễ dàng thay đổi/nâng cấp mô hình LLM mà không ảnh hưởng tới core engine logic.

### 12. Notification Engine
Tái dụng `platform/notification-hub`. Nhận các sự kiện từ EventBus và điều phối gửi đi đa kênh (SMS, Email, Webpush, Zalo, Webhook) theo cấu hình của người nhận.

### 13. Integration Engine
Tái dụng `platform/integration-hub`. Quản lý các kết nối bên ngoài (PACS, LIS, BHYT cổng quốc gia, VNPay, DMS, MISA). Quản lý connector, webhook, queue, retry, dead letter queue (DLQ), idempotency, data mapping.

### 14. Platform SDK
Cung cấp bộ Base SDK chuẩn hóa tại `src/platform/sdk/`:
- `Domain SDK`: Tạo domain models chuẩn hóa.
- `Repository SDK` & `Query SDK`: Chuẩn hóa các thao tác đọc ghi DB có RLS và optimistic locking.
- `Command SDK` & `Event SDK`: Phát lệnh Command và phát sự kiện Event đồng bộ/bất đồng bộ.
- `Validation SDK` & `Projection SDK`: Validate dữ liệu và cập nhật Read Models (projections).

---

## 3. Database Schema Blueprint v8

> [!WARNING]
> **Tất cả các bảng đều ADDITIVE. Prefix `party_`, `journey_`, `timeline_`, `policy_`, `workflow_`, `knowledge_`, `resource_`, `contract_`, `asset_` (Platform) và `hc_`, `den_` (Healthcare). Không ALTER bảng cũ.**

```sql
-- 1. PARTY ENGINE (Platform-level)
CREATE TABLE IF NOT EXISTS public.party_parties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    party_type TEXT NOT NULL CHECK (party_type IN ('person', 'organization')),
    display_name TEXT NOT NULL,
    legal_name TEXT,
    tax_code TEXT,
    dob DATE,
    gender TEXT CHECK (gender IN ('male', 'female', 'other')),
    blood_type TEXT,
    -- Auditing & Versioning (Optimistic Locking)
    version INTEGER NOT NULL DEFAULT 1,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.party_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    source_party_id UUID NOT NULL REFERENCES public.party_parties(id) ON DELETE CASCADE,
    target_party_id UUID NOT NULL REFERENCES public.party_parties(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL, -- 'parent_of', 'guardian_of', 'works_for', 'referred_by'
    attributes JSONB NOT NULL DEFAULT '{}',
    active_from DATE DEFAULT CURRENT_DATE,
    active_to DATE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (tenant_id, source_party_id, target_party_id, relationship_type)
);

-- 2. JOURNEY ENGINE (With SubJourneys & Milestones)
CREATE TABLE IF NOT EXISTS public.journey_journeys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    vertical TEXT NOT NULL,
    journey_type TEXT NOT NULL,
    primary_party_id UUID NOT NULL REFERENCES public.party_parties(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
    started_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    completed_at TIMESTAMPTZ,
    ai_summary TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.journey_sub_journeys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    journey_id UUID NOT NULL REFERENCES public.journey_journeys(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. TIMELINE ENGINE (Event Store Spec)
CREATE TABLE IF NOT EXISTS public.timeline_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    vertical TEXT NOT NULL,
    primary_party_id UUID NOT NULL REFERENCES public.party_parties(id) ON DELETE CASCADE,
    journey_id UUID REFERENCES public.journey_journeys(id) ON DELETE SET NULL,
    correlation_id UUID NOT NULL,
    causation_id UUID,
    event_category TEXT NOT NULL CHECK (event_category IN ('business', 'audit', 'ai', 'system')),
    event_type TEXT NOT NULL,
    event_version TEXT NOT NULL DEFAULT 'v1',
    schema_version TEXT NOT NULL DEFAULT '1.0.0',
    aggregate_id UUID NOT NULL, -- target entity ID (e.g. Encounter ID, Invoice ID)
    aggregate_type TEXT NOT NULL, -- 'encounter', 'invoice', 'prescription'
    sequence_number INTEGER NOT NULL, -- Per aggregate sequence for event replay
    event_hash TEXT NOT NULL, -- SHA-256 integrity hash
    reference_table TEXT,
    reference_id UUID,
    summary TEXT NOT NULL,
    ai_insight TEXT,
    event_data JSONB NOT NULL DEFAULT '{}',
    recorded_by UUID REFERENCES public.party_parties(id),
    occurred_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (tenant_id, aggregate_type, aggregate_id, sequence_number)
);

CREATE RULE timeline_events_no_update AS ON UPDATE TO public.timeline_events DO INSTEAD NOTHING;
CREATE RULE timeline_events_no_delete AS ON DELETE TO public.timeline_events DO INSTEAD NOTHING;

-- 4. ASSET ENGINE
CREATE TABLE IF NOT EXISTS public.asset_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    vertical TEXT NOT NULL,
    asset_type TEXT NOT NULL, -- 'tooth', 'vehicle', 'apartment', 'device'
    name TEXT NOT NULL,
    owner_party_id UUID REFERENCES public.party_parties(id) ON DELETE SET NULL,
    status TEXT NOT NULL, -- 'healthy', 'damaged', 'active', 'sold'
    metadata JSONB NOT NULL DEFAULT '{}',
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    deleted_at TIMESTAMPTZ
);

-- 5. CONTRACT ENGINE
CREATE TABLE IF NOT EXISTS public.contract_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    vertical TEXT NOT NULL,
    contract_type TEXT NOT NULL, -- 'treatment_plan', 'warranty', 'membership'
    party_id UUID NOT NULL REFERENCES public.party_parties(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
    start_date DATE,
    end_date DATE,
    value_amount NUMERIC(15,2),
    terms JSONB NOT NULL DEFAULT '{}',
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    deleted_at TIMESTAMPTZ
);
```

---

## 4. Proposed Changes: Platform SDK & Providers

### 1. Platform SDK (Giao diện chuẩn hóa)

```typescript
// src/platform/sdk/domain-sdk.ts
export abstract class BaseDomainModel {
  id!: string;
  tenantId!: string;
  version!: number;
  createdAt!: Date;
  updatedAt!: Date;
  deletedAt?: Date;
}

// src/platform/sdk/repository-sdk.ts
export interface RepositorySDK<T extends BaseDomainModel> {
  findById(id: string): Promise<T | null>;
  save(entity: T): Promise<T>; // Phải check optimistic locking (version)
  delete(id: string): Promise<void>;
}
```

### 2. PlatformAIOrchestrator & Tool Registry

```typescript
// src/platform/ai/ai-orchestrator.ts
export interface AiTool {
  name: string;
  description: string;
  parameters: object;
  execute: (args: Record<string, unknown>, context: PlatformContext) => Promise<unknown>;
}

export class PlatformAIOrchestrator {
  private toolRegistry = new Map<string, AiTool>();

  registerTool(tool: AiTool) {
    this.toolRegistry.set(tool.name, tool);
  }

  // LLM chỉ làm việc với Tool Registry
  async runAgentSession(prompt: string, context: PlatformContext) {
    // 1. Gửi prompt + danh sách tools từ Tool Registry sang LLM
    // 2. LLM chọn Tool và trả về tham số (e.g. tool: 'verify_drug_interaction')
    // 3. Orchestrator thực thi Tool tương ứng và trả kết quả cho LLM
  }
}
```

---

## 5. UI Architecture & Digital Twin

### Digital Twin 3 Layers (realtime):

```
Panel 1: Business Twin (CEO Panel)
  Doanh thu thực tế theo giờ (Dental vs General Clinic)
  Chi phí vận hành & dự báo dòng tiền cuối tháng
  Lương accrued tạm tính của bác sĩ (commissions)
  Trợ lý AI Executive: Q&A hỏi đáp nguyên nhân tăng giảm doanh số

Panel 2: Operational Twin (COO/Manager Panel)
  Monitor dòng bệnh nhân (Patient Flow): Chờ tiếp tân → Chờ chụp phim → Phòng khám
  Đo lường thắt nút cổ chai (Bottleneck): Nơi nào bệnh nhân phải chờ lâu nhất (>30 phút)
  Tỷ lệ lấp đầy ghế nha (Chair Utilization Rate)
  Trợ lý AI Operational: Cảnh báo thiếu thuốc kho, phân phối ca trực bác sĩ

Panel 3: AI Twin (Insights Panel)
  Dự đoán tỷ lệ huỷ lịch (No-show Risk Prediction) cho 48 giờ tới
  Phát hiện bất thường (Anomaly Detection): Invoice có giá dịch vụ lệch khỏi Policy
  Đề xuất tối ưu (AI Recommendation): Chiến dịch recall khách hàng tẩy trắng định kỳ
```

---

## 6. Zero Regression & Integration Tests

> [!IMPORTANT]
> **Checklist bắt buộc phải pass trước khi code được đẩy lên Production.**

### Test Suites cho Blueprint v8:
1. **`composition-verification-pipeline.test.ts`**: Test 4 bước kiểm tra của capability (Health, Compatibility, Migration, Rollback).
2. **`timeline-event-store-replay.test.ts`**: Đảm bảo chuỗi event của timeline_events có sequence_number liên tục, kiểm tra event_hash tính toàn vẹn và thực hiện replay chính xác.
3. **`contract-lifecycle.test.ts`**: Test vòng đời hợp đồng bảo hành y tế và đối chiếu hóa đơn tự động.
4. **`asset-management-lifecycle.test.ts`**: Assert vòng đời Asset (Tooth, Device) chuyển đổi trạng thái khi có encounter can thiệp.
5. **`optimistic-locking.test.ts`**: Đảm bảo cập nhật đồng thời lên Party/Journey kích hoạt Exception nếu version mismatch.

---

## 7. Kế Hoạch Triển Khai Chi Tiết

| Phase | Deliverable | Thời gian |
|-------|-------------|-----------|
| **Phase 0** | Triển khai Platform Core Extensions: Context, Composition Verification Pipeline, Platform SDK, 15 Core Engines | 3 ngày |
| **Phase 1** | Database Migration: 16 file migration additive (party_*, journey_*, timeline_*, asset_*, contract_*, RLS, indexes...) | 4 ngày |
| **Phase 2** | Healthcare Kernel Engine Implementation (Party relationships, SubJourneys, Resource skills, Accounting Adapter) | 7 ngày |
| **Phase 3** | Core UI: Dashboard Digital Twin 3 layers, Party profile, Journey tracker, Visual Workflow Builder | 4 ngày |
| **Phase 4** | Dental Pack MVP: Odontogram SVG, Treatment plan builder, X-Ray comparator | 4 ngày |
| **Phase 5** | AI Engine (Operational/Professional/Executive) + Knowledge Base RAG integration | 3 ngày |
| **Buffer** | Regression tests, E2E testing, Performance tuning | 2 ngày |
| **Tổng** | | **~4–5 tuần** |
