---
title: 'Guard Tenant Isolation Hard Refresh'
type: 'bugfix'
created: '2026-06-10'
status: 'done'
route: 'one-shot'
---

# Guard Tenant Isolation Hard Refresh

## Intent

**Problem:** Bella admin va Beauty admin da tung gap loi nhin lan du lieu/ngon ngu giua hai tenant, dac biet sau F5 hoac trong luc tenant module/brand dang load. Loi nay anh huong truc tiep den van hanh Bella Spa hien tai va rui ro ro ri du lieu khi thuong mai hoa Beauty Spa.

**Approach:** Them guard nho vao source test va E2E smoke hien co: trang customers khong duoc fallback ve babycare khi module chua load, va hard refresh khong duoc flash marker/du lieu/copy cua tenant khac.

## Suggested Review Order

1. `../../src/__tests__/tenant-isolation-source-guards.test.ts` -- Kiem tra guard source cho customers page khong fallback `tenantModuleKey ?? 'babycare'` va tiep tuc dung neutral/module-aware presentation.
2. `../../e2e/tests/13-tenant-isolation-smoke.spec.ts` -- Kiem tra helper hard-refresh sampling va marker cam cho Bella/Beauty admin de tranh false positive nhung van bat duoc F5 leak.
