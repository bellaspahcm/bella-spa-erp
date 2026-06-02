# Core Platform Extraction Roadmap

## Mục Tiêu

Biến Bella từ ERP spa hiện tại thành nền tảng ERP lõi có thể mở rộng nhiều ngành, nhưng không làm "đại phẫu" một lần.

Chiến lược đúng là **core-readiness refactor**:

- Mỗi batch refactor tiếp theo phải xác định phần đang chạm là `core`, `spa module`, hay `mixed`.
- Core chỉ chứa primitive trung lập ngành.
- Spa/Babycare là industry module đầu tiên, tiếp tục chạy ổn trong suốt quá trình tách.
- Không đưa logic spa vào core chỉ vì hiện tại nhiều màn hình đang dùng chung.

## Nguyên Tắc Không Được Phá

- Không làm yếu tenant isolation, RLS, RBAC hoặc audit.
- Không nuốt lỗi database. Query lỗi phải throw hoặc trả failure explicit.
- Không đổi công thức lương/hoa hồng nếu chưa có spec riêng và test side effects.
- Không sửa generated database types thủ công.
- Không chuyển toàn bộ business flow sang rule engine sớm.
- Không đổi schema lớn nếu chưa có migration path giữ nguyên hành vi Bella Spa.
- Không tách microservices ở giai đoạn này. Modular monolith là hướng đúng.

## Phân Loại Boundary Hiện Tại

### Core Platform Candidates

Các phần này có khả năng trở thành lõi dùng chung cho nhiều ngành:

| Khu vực | File/thư mục hiện tại | Ghi chú |
| --- | --- | --- |
| Tenant và settings | `src/services/tenant-actions.ts`, `src/app/hq/` | Cần giữ trung lập ngành, hỗ trợ Super Admin/module registry sau này. |
| Subscription, quota, billing | `src/services/subscription-actions.ts`, `src/services/hq-subscription-actions.ts`, migrations `20260601010000*`, `20260601011000*`, `20260602010000*` | Nên là core SaaS. |
| Auth/RBAC/proxy | `src/proxy.ts`, user/role checks trong services | Hiện còn có nhánh `ktv`; về sau cần role abstraction. |
| Audit | `src/services/audit-actions.ts`, `src/app/dashboard/audit/` | Core observability/compliance. |
| Notification | `src/services/notification-actions.ts`, app notifications | Core communication primitive. |
| Accounting core | `src/services/accounting/*`, `src/lib/accounting-outbox.ts` | Core finance ledger/outbox, nhưng payload event còn dính spa/session. |
| Finance primitives | `src/services/finance/*` | Core nếu giữ expense/revenue/accounting period generic. |
| AI orchestration shell | `src/services/ai/*`, `src/services/ai-coo-service.ts` | Core assistant shell, nhưng prompts/insights có thể là module-specific. |

### Spa/Babycare Module Candidates

Các phần này nên nằm trong industry module spa/babycare:

| Khu vực | File/thư mục hiện tại | Ghi chú |
| --- | --- | --- |
| KTV portal/workflow | `src/app/ktv/`, `src/services/ktv-actions.ts` | Đặc thù spa/homecare KTV. |
| Session điều trị | `src/app/dashboard/sessions/`, `src/modules/booking/actions/session-*` | Có thể trừu tượng thành service execution sau này, nhưng hiện là spa-heavy. |
| Booking spa | `src/modules/booking/actions/*`, `src/app/dashboard/bookings/` | Core có thể giữ order/booking primitive; spa module giữ package/session/KTV. |
| Package liệu trình | `src/services/package-actions.ts`, `src/app/dashboard/services/` | Cần tách generic service catalog và spa package fields. |
| HR/KTV salary | `src/modules/hr-salary/actions/*`, `src/app/dashboard/salary/` | Đặc thù lương KTV, session multiplier, attendance, rating. |
| Attendance KTV | `src/services/attendance-actions.ts` | Một phần HR core, nhưng rule hiện tại nghiêng KTV/spa. |
| CRM/Zalo chăm sóc khách | `src/services/crm-*`, `src/app/dashboard/crm/` | Có thể là module CRM shared về sau; hiện gắn spa/babycare. |
| Portal khách hàng | `src/app/portal/`, `src/services/portal-chat-actions.ts` | Có thể thành customer portal core, nhưng nội dung hiện gắn booking/package spa. |

### Mixed / Cần Tách Boundary

Các phần đang trộn core và spa, nên là trọng tâm refactor:

| Khu vực | Vấn đề | Hướng tách |
| --- | --- | --- |
| `src/app/dashboard/page.tsx` | Dashboard tổng quan trộn stats, session, alert, performance spa. | Tách `core dashboard shell` và `spa dashboard widgets`. |
| `src/app/dashboard/ai-copilot/ai-copilot-client.tsx` | AI shell và draft actions/insights trộn nhau. | Tách AI shell core, action renderer module-specific. |
| `src/app/hq/financial-overview/` | HQ finance core nhưng có salary/commission semantics spa. | Tách financial summary core và spa salary adapter. |
| `src/services/dashboard-actions.ts` | Có nguy cơ gom data core/spa trong một action. | Phân loại query theo widget domain. |
| Accounting outbox payload | Core outbox nhưng event `SESSION_DONE`, `SALARY_PAID`, `INVENTORY_CONSUMED` đang spa-heavy. | Giữ outbox core, tạo event adapter theo module. |
| Booking/session completion | Booking, payment, inventory, salary, accounting cùng một flow. | Tách orchestration rõ: core payment/accounting, spa session/salary adapter. |

## Target Architecture Trong Giai Đoạn Modular Monolith

```text
src/core/
  tenant/
  auth/
  audit/
  billing/
  notification/
  service-catalog/
  booking-order/
  payment/
  accounting/
  workflow/
  module-registry/

src/modules/
  spa/
    booking/
    sessions/
    packages/
    ktv/
    salary/
    crm/
  cleaning/        (future)
  home-service/    (future)
```

Không cần tạo cấu trúc này ngay. Mỗi lần refactor chỉ di chuyển khi boundary đã đủ rõ và test đã bảo vệ hành vi cũ.

## Thứ Tự Tách An Toàn

### Phase 0 - Documentation & Guardrails

Trạng thái: đã bắt đầu.

- Có `docs/index.md`.
- Có `docs/AI_AGENT_ONBOARDING.md`.
- Có `docs/KNOWLEDGE_STORAGE_PROCESS.md`.
- Roadmap này là điểm neo cho core-readiness refactor.

Điều kiện hoàn tất:

- Mỗi refactor sau phải link hoặc nhắc đến roadmap này khi có quyết định core/spa.

### Phase 1 - Core-Readiness Refactor Không Đổi Behavior

Mục tiêu: giảm nợ kỹ thuật và phân loại boundary trước khi di chuyển file lớn.

Thứ tự đề xuất:

1. `src/app/dashboard/page.tsx`
   - Bỏ explicit `any`.
   - Tách type/view-model cho dashboard widgets.
   - Gắn nhãn widget nào là core, widget nào là spa.

2. `src/app/dashboard/ai-copilot/ai-copilot-client.tsx`
   - Type hóa AI report/draft action.
   - Tách AI chat shell khỏi renderer của action nghiệp vụ.

3. `src/app/hq/financial-overview/page.tsx`
   - Type hóa P&L rows.
   - Ghi rõ phần nào là finance core, phần nào là salary/commission adapter.

4. `src/components/features/landing/ServiceWizard.tsx`
   - Type hóa service/package input.
   - Phân biệt service catalog generic và spa package UX.

5. `src/services/dashboard-actions.ts`
   - Tách query theo dashboard widget.
   - Không trộn query core/spa trong một object không typed.

### Phase 2 - Core Service Contracts

Mục tiêu: tạo contract trước khi di chuyển module.

Core contracts cần định nghĩa:

- `TenantContext`
- `ModuleId`
- `FeatureFlag`
- `CoreServiceCatalogItem`
- `CoreBookingOrder`
- `PaymentIntent` / `Invoice`
- `AuditEvent`
- `NotificationEvent`
- `WorkflowInstance`
- `ModuleAdapter`

Không nên đổi DB ngay trong phase này. Ưu tiên type/interface và adapter quanh code hiện tại.

### Phase 3 - Spa Module Boundary

Mục tiêu: gom logic spa vào boundary rõ ràng.

Ứng viên:

- `src/modules/booking/actions/session-*` -> spa service execution adapter.
- `src/modules/hr-salary/actions/*` -> spa compensation module.
- `src/services/ktv-actions.ts` -> spa KTV module.
- `src/services/attendance-actions.ts` -> tách HR attendance primitive và spa KTV leave/session reassignment.
- `src/services/package-actions.ts` -> tách core service catalog và spa package fields.

Điều kiện bắt buộc:

- Full Jest green trước và sau.
- Side-effect tests cho booking/session/salary/inventory/accounting không giảm.
- Không đổi user-facing workflow Bella Spa.

### Phase 4 - Module Registry & Tenant Entitlements

Mục tiêu: tenant bật/tắt module theo plan.

Core cần biết:

- tenant nào bật module nào
- plan nào cho phép module nào
- menu/permission nào thuộc module nào
- quota nào là core, quota nào theo module

Không làm trước khi Phase 1 và Phase 2 đủ sạch.

### Phase 5 - Ngành Thứ Hai Để Validate Core

Ngành đề xuất: Cleaning.

Lý do:

- Đủ khác spa để kiểm tra core có thật sự trung lập không.
- Có booking/order, nhân sự, checklist, SLA, payment.
- Không phụ thuộc KTV/session multiplier/salary spa.

Mục tiêu của ngành thứ hai không phải full product ngay, mà là chứng minh:

- Core booking/order dùng lại được.
- Core service catalog dùng lại được.
- Core payment/audit/notification dùng lại được.
- Module-specific workflow không làm bẩn core.

## Database & Migration Risk

### Không Nên Làm Ngay

- Rename bảng lớn như `bookings`, `packages`, `session_logs`, `salary_records`.
- Gộp mọi ngành vào bảng JSON generic.
- Tách DB per tenant.
- Tạo rule engine thay thế logic lương/booking hiện tại.

### Nên Làm Trước

- Thêm adapter/type layer quanh bảng hiện tại.
- Tạo view-model hoặc service function trung lập ngành.
- Ghi decision record trước mọi schema split.
- Nếu thêm bảng mới cho module registry, phải có migration rollback/smoke checklist.

## Test Bắt Buộc Khi Tách Core/Spa

Không được giảm test coverage hiện có ở các luồng:

- create booking -> revenue/payment side effects
- complete session -> booking progress, inventory, salary, revenue/accounting side effects
- salary recalculation -> package multiplier, KPI, pro-rata, non-draft preservation
- subscription quota -> usage counter, branch select, plan entitlement
- audit log -> mutation trace
- finance P&L -> confirmed revenue, approved/paid expense, saved salary records
- tenant isolation/RLS/security-hardening

Với mỗi extraction batch, tối thiểu:

- `npx.cmd tsc --noEmit --pretty false`
- `npm.cmd run lint -- <changed files>`
- targeted Jest theo module
- full Jest nếu chạm booking, salary, finance, tenant, audit, inventory hoặc shared services
- `git diff --check`

## Decision Template Cho Mỗi Batch Sau

Mỗi spec/refactor liên quan core-platform phải trả lời:

```markdown
## Core Boundary Decision

- Classification: core | spa-module | mixed | undecided
- Why:
- Future industry reuse:
- Spa behavior preserved by:
- Database impact:
- Tests required:
- Deferred extraction:
```

## Batch Tiếp Theo Được Khuyến Nghị

Batch tiếp theo nên là:

`src/app/dashboard/page.tsx`

Mục tiêu:

- Bỏ explicit `any`.
- Tách type/view-model cho dashboard data.
- Đánh dấu các widget:
  - core: business KPI shell, notification/alert shell nếu generic
  - spa: sessions, KTV, package/service performance, care workflow
- Không đổi UI.
- Không đổi query behavior.

Lý do chọn trước:

- Đây là màn hình tổng quan dễ bị trộn core/spa.
- Refactor ở đây giúp các batch sau có mẫu phân loại widget.
- Rủi ro thấp hơn so với tách booking/session/salary ngay.

## Trạng Thái

- Roadmap status: active.
- Kiến trúc mục tiêu: modular monolith trước, module registry sau, microservices sau cùng nếu thật sự cần.
- Quyết định hiện tại: tiếp tục tối ưu codebase theo hướng core-readiness; chưa chuyển đổi core-platform bằng migration lớn.
