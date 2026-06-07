---
title: 'Centralize Platform Rule Engines'
type: 'refactor'
created: '2026-06-07'
status: 'done'
---

## Intent

Gom các công thức nền tảng còn nằm rải trong service, UI và API guard về các helper thuần để giảm rủi ro lệch logic khi mở rộng Bella ERP sang nhiều chi nhánh và nhiều ngành dịch vụ.

## Scope

- Subscription/quota/billing rules:
  - Tính hạn mức gói cước từ entitlement.
  - Tính trạng thái bị chặn theo usage hiện tại.
  - Tính tiền hóa đơn nâng cấp gói.
  - Validate quota override của HQ.
- Franchise/clearing rules:
  - Tính phí nhượng quyền theo phần trăm hoặc cố định.
  - Tính số tiền bù trừ liên chi nhánh.
  - Chuẩn hóa payload kế toán cho bù trừ liên chi nhánh.
- Permission/access rules:
  - Sidebar module mapping và fallback role rule.
  - AI Copilot role access.
  - User manual access by role.

## Non-Goals

- Không đổi schema database.
- Không đổi chính sách gói cước, phí nhượng quyền, bù trừ hoặc phân quyền.
- Không thay đổi RLS/RPC authorization.

## Code Map

- `src/lib/business-rules/subscription.ts`
- `src/lib/business-rules/franchise.ts`
- `src/lib/business-rules/permissions.ts`
- `src/__tests__/platform-rule-engines.test.ts`

## Acceptance

- Given một entitlement unlimited, usage state không bị chặn và max dùng hằng `UNLIMITED_QUOTA`.
- Given invoice nâng cấp có giá tháng và số tháng, amount được tính từ engine dùng chung.
- Given phí nhượng quyền percentage/fixed, lock month và AI franchise agent dùng cùng công thức.
- Given role KTV/accountant/admin, sidebar, manual và AI guard dùng cùng access helper.
