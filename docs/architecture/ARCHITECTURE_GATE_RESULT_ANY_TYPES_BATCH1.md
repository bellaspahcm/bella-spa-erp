# ARCHITECTURE GATE RESULT - ANY TYPES BATCH 1

## Kết Luận

`PASS`

## Phạm Vi

- Campaign: `check:any-types`
- Batch: 1
- File dự kiến sửa:
  - `src/__tests__/helpers/supabase-test-helpers.ts`
  - `src/__tests__/customer-actions.test.ts`
- Loại thay đổi: test/mock type cleanup
- Source/runtime production: không sửa
- Database/schema/RPC/generated type: không sửa
- Kernel/Core/Frozen OS: không sửa

## Truth / Source Of Truth

- Truth: `npm run check:any-types` đang fail với 1,567 violation trong 226 file.
- Source of Truth:
  - `scripts/check-any-types.js`
  - `.cache/any-types-inventory-2026-09-30.json`
  - `docs/architecture/ANY_TYPES_INVENTORY_2026_09_30.md`
- Canonical contract cho batch này: test double phải model boundary Supabase tối thiểu, không invent schema hoặc runtime behavior.

## Ownership

| Capability | Owner | Scope |
| --- | --- | --- |
| Test helpers | QA/Test | Có quyền sửa trong batch |
| Customer action tests | QA/Test | Có quyền sửa trong batch |
| Production customer actions | Service/Product runtime | Không sửa |
| DB/RPC/generated type | Database contract | Không sửa |

## Change Authority

User đã authorize Batch 1:

- 40-80 violations
- test/mock only
- type-local
- no runtime production behavior
- no DB schema change
- no contract change
- no kernel change

## Boundary

Thay đổi chỉ nằm trong test double:

```text

Jest mock / fixture
  ↓
Supabase-like query boundary tối thiểu
  ↓
Production action under test

```

Không đổi production flow:

```text

Database -> Repository/Service -> API/UI

```

## Minimal Implementation Plan

1. Thay explicit `any` trong helper bằng `unknown`, generic `QueryResult<T>`, và typed chain mock.
2. Thay explicit `any` trong `customer-actions.test.ts` bằng `unknown`, tuple/array param type, và callback result type tối thiểu.
3. Không đổi assertion, không skip test, không đổi behavior mock.

## Verification Plan

1. `npm run check:any-types`
2. `git diff --check`
3. Targeted test:
   - `npx jest src/__tests__/customer-actions.test.ts --runInBand`
4. `npm run arch:guard`

Nếu sửa type kéo sang production contract hoặc generated DB type, batch phải dừng và ghi `DEFER/CONTRACT GAP`.
