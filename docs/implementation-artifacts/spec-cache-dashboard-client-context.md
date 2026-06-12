---
title: 'Cache Dashboard Client Context'
type: 'refactor'
created: '2026-06-12'
status: 'done'
baseline_commit: '4d0f9d599e9a5175cf2c38e3414137a9fb8966b7'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/AI_AGENT_ONBOARDING.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Vấn đề:** Luồng khởi tạo dashboard hiện để layout, sidebar và trang settings tự gọi riêng cùng một dữ liệu current user và tenant settings. Điều này tạo các lượt gọi Server Function trùng lặp và làm tăng khả năng nhấp nháy brand tenant hoặc trạng thái tab không nhất quán khi tải lần đầu.

**Cách làm:** Thêm một cache context nhỏ chỉ chạy phía client cho hai Server Function hiện có là `getCurrentUser()` và `getTenantSettings()`, sau đó cho dashboard layout, sidebar và settings đọc dữ liệu thông qua cache này. Giữ cơ chế bypass cache khi refresh cưỡng bức và xóa cache rõ ràng khi logout/save để tenant identity và settings không bị stale âm thầm.

## Boundaries & Constraints

**Luôn luôn:** Giữ `user-actions.ts` và `tenant-actions.ts` là source of truth cho auth, tenant scoping và database reads. Bảo toàn quy tắc zero silent DB failure: lỗi đọc tenant settings vẫn phải nổi lên cho caller. Chỉ dùng cache để chia sẻ các lượt đọc bootstrap phía client; refresh cưỡng bức phải bypass cache.

**Hỏi trước:** Hỏi trước khi thay đổi ngữ nghĩa auth/RLS, luật resolve tenant module, hành vi save settings, hoặc chuyển luồng này sang kiến trúc API route/provider mới.

**Không bao giờ:** Không thêm query Supabase phía browser để lấy tenant identity. Không giữ cache qua logout. Không làm yếu xử lý redirect KTV hoặc tenant bị suspended. Không đưa các file report generated không liên quan vào lát cắt triển khai này.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Shared dashboard boot | Layout và sidebar mount cùng lúc | Cả hai tái sử dụng promise/value cache hiện có cho user và tenant settings khi có thể | Auth failure vẫn redirect về login; tenant brand failure được log và không làm gãy auth flow |
| Manual settings refresh | Trang settings nhận page-refresh event | Tenant settings reload với `force: true` và bypass giá trị cache | Load failure hiển thị toast settings hiện có |
| Settings save/logout | Tenant settings được save hoặc user logout | Cache dashboard client context trong memory được xóa | Save action failure giữ nguyên cache và hiển thị toast hiện có |
| Settings tab URL sync | User click lại tab đang active/default nhiều lần | `router.replace` chỉ chạy khi path tính ra khác current path | Không tạo navigation loop do replace trùng lặp |

</frozen-after-approval>

## Code Map

- `src/lib/dashboard-client-context.ts` -- cache promise/result mới chỉ chạy phía client cho hai Server Function current user và tenant settings.
- `src/app/dashboard/layout.tsx` -- auth gate dashboard và luồng apply tenant brand runtime.
- `src/components/layout/sidebar.tsx` -- bootstrap user, permissions và tenant branding của sidebar.
- `src/app/dashboard/settings/page.tsx` -- load tenant settings, invalidation sau save, đồng bộ tab URL và page refresh của settings page.
- `src/__tests__/tenant-isolation-source-guards.test.ts` -- regression guard cấp source cho kỳ vọng tenant/client boundary.

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/dashboard-client-context.ts` -- thêm helper cache rõ ràng cho current user và tenant settings -- chia sẻ các lượt đọc bootstrap dashboard bị trùng mà không đổi quyền sở hữu server action.
- [x] `src/app/dashboard/layout.tsx` -- dùng cached current user/settings và apply tenant brand trước khi render authorized shell -- giảm mismatch brand ở lần tải đầu.
- [x] `src/components/layout/sidebar.tsx` -- dùng cached current user/settings và xóa cache khi logout -- tránh stale user context giữa các session.
- [x] `src/app/dashboard/settings/page.tsx` -- dùng cached tenant settings, bypass cache khi page refresh, xóa cache sau save thành công và tránh `router.replace` dư thừa -- giữ UI settings tươi và ổn định.
- [x] `src/__tests__/tenant-isolation-source-guards.test.ts` -- assert contract dashboard client cache và đảm bảo direct service imports không quay lại layout/sidebar/settings page -- bắt regression với chi phí thấp.

**Acceptance Criteria:**
- Given dashboard layout và sidebar khởi tạo trong cùng browser session, when cả hai cần current user hoặc tenant settings, then chúng gọi `getCachedCurrentUser()` / `getCachedTenantSettings()` thay vì import trực tiếp user/tenant read actions.
- Given settings page refresh được kích hoạt, when settings reload, then page gọi cached tenant settings helper với `force: true`.
- Given settings save thành công hoặc logout bắt đầu, when action hoàn tất, then dashboard client context cache trong memory được xóa.
- Given tab settings hiện tại đã khớp URL mong muốn, when logic đổi tab chạy, then không gọi `router.replace` với cùng path.

## Spec Change Log

## Design Notes

Docs Next 16.2 xác nhận Client Components có thể gọi Server Functions được import từ file `use server`. Cache được giữ trong một module `use client` riêng vì các caller hiện đã là dashboard shell components phía client. Cache này chỉ lưu các giá trị vốn đã được Server Functions hiện có trả về client và không thêm đường truy cập database mới.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/tenant-isolation-source-guards.test.ts --runInBand` -- passed: 1 suite / 16 tests.
- `npm.cmd run lint -- src/lib/dashboard-client-context.ts src/app/dashboard/layout.tsx src/app/dashboard/settings/page.tsx src/components/layout/sidebar.tsx src/__tests__/tenant-isolation-source-guards.test.ts` -- passed: không có lint errors.
- `git diff --check` -- passed: không có whitespace errors.

## Suggested Review Order

**Client Context Cache**

- Entry point: shared in-memory cache and invalidation boundary.
  [`dashboard-client-context.ts:19`](../../src/lib/dashboard-client-context.ts#L19)

- Version counters prevent stale in-flight requests from overwriting forced refreshes.
  [`dashboard-client-context.ts:59`](../../src/lib/dashboard-client-context.ts#L59)

**Dashboard Consumers**

- Layout reuses cached auth/settings before rendering the authorized shell.
  [`layout.tsx:70`](../../src/app/dashboard/layout.tsx#L70)

- Sidebar shares bootstrap reads and resolves tenant branding from cached settings.
  [`sidebar.tsx:283`](../../src/components/layout/sidebar.tsx#L283)

- Logout clears dashboard context before leaving the session.
  [`sidebar.tsx:414`](../../src/components/layout/sidebar.tsx#L414)

**Settings Refresh**

- Settings reload supports forced cache bypass for page refresh events.
  [`page.tsx:102`](../../src/app/dashboard/settings/page.tsx#L102)

- Tab navigation avoids replacing the URL with the same path.
  [`page.tsx:165`](../../src/app/dashboard/settings/page.tsx#L165)

- Successful save clears cached tenant settings for future reads.
  [`page.tsx:179`](../../src/app/dashboard/settings/page.tsx#L179)

**Regression Guard**

- Source guard locks the cache contract and race-prevention markers.
  [`tenant-isolation-source-guards.test.ts:122`](../../src/__tests__/tenant-isolation-source-guards.test.ts#L122)
