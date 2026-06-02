---
title: 'Harden Brand Service Actions Typing'
type: 'refactor'
created: '2026-06-02'
status: 'done'
route: 'one-shot'
---

# Harden Brand Service Actions Typing

## Intent

**Problem:** `src/services/brand-service-actions.ts` con dung `any` trong catch, payload update/propagation va distribution matrix mapping; dong thoi query kiem tra package da phan phoi trong `distributeTemplateToTenants` dang bo qua DB error.

**Approach:** Dung generated `Database` types cho package/tenant rows va insert/update payload, chuyen catch sang `unknown` voi helper lay message, va fail ro tung tenant neu duplicate distribution lookup loi truoc khi update/insert package.

## Suggested Review Order

- [../../src/services/brand-service-actions.ts](../../src/services/brand-service-actions.ts) -- Kiem tra type aliases, catch unknown, distribution lookup error handling, va matrix nullable fallback.
- [../../src/__tests__/brand-service-master.test.ts](../../src/__tests__/brand-service-master.test.ts) -- Kiem tra regression khi existing distribution lookup loi thi khong update/insert package.

## Code Map

- `src/services/brand-service-actions.ts` -- Server actions cho HQ package templates, distribution matrix, phan phoi template xuong tenant, va branch override price.
- `src/__tests__/brand-service-master.test.ts` -- Jest coverage cho brand service master workflow.

## Review Notes

- Patch applied: `getErrorMessage` duoc mo rong de giu message tu `Error`, string, va object co `message`.
- Patch applied: nullable `tenant_id`, `template_id`, `status` trong distribution matrix duoc normalize thanh string de giu contract client hien tai.
- Deferred: test file hien van co nhieu mock `any` cu, khong thuoc pham vi production service refactor nay.
- Sub-agent review note: sub-agent tooling in this session is policy-gated unless explicitly requested by the user, so review was performed locally using the adversarial checklist.

## Verification

**Commands:**
- `npm.cmd run lint -- src/services/brand-service-actions.ts` -- passed, 0 warnings.
- `npx.cmd tsc --noEmit --pretty false` -- passed.
- `npm.cmd test -- src/__tests__/brand-service-master.test.ts --runInBand` -- passed, 13 tests.
