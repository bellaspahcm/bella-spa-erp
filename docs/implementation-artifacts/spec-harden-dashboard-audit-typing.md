---
title: 'Harden Dashboard Audit Typing'
type: 'refactor'
created: '2026-06-03'
status: 'done'
route: 'one-shot'
---

# Harden Dashboard Audit Typing

## Intent

**Problem:** Trang audit production còn dùng explicit `any` và nhiều `eslint-disable` để né type checking cho `old_data`, `new_data`, catch error, và dữ liệu trả về từ Supabase.

**Approach:** Dùng `Json`/`Database` từ Supabase generated schema, chuẩn hóa audit row qua helper typed, render JSON qua helper text an toàn, và làm rõ lỗi query thay vì chỉ log.

## Suggested Review Order

**Typed audit boundary**

- Review JSON/action normalization before values reach UI render paths.
  [`page.tsx:22`](../../src/app/dashboard/audit/page.tsx#L22)

- Check fallback action labeling does not misrepresent unknown audit actions.
  [`page.tsx:49`](../../src/app/dashboard/audit/page.tsx#L49)

**Data loading**

- Confirm reference-map queries now surface Supabase errors explicitly.
  [`page.tsx:528`](../../src/app/dashboard/audit/page.tsx#L528)

- Verify audit log rows are converted to typed UI state without `any`.
  [`page.tsx:600`](../../src/app/dashboard/audit/page.tsx#L600)

**React and rendering**

- Confirm JSON field rendering converts object values before JSX.
  [`page.tsx:64`](../../src/app/dashboard/audit/page.tsx#L64)

- Review effect scheduling and callback dependencies for lint-clean hooks.
  [`page.tsx:623`](../../src/app/dashboard/audit/page.tsx#L623)
