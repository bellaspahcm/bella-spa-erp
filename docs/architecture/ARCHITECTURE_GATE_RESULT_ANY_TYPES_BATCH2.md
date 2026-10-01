# ARCHITECTURE GATE RESULT - ANY TYPES BATCH 2

## Kết Luận

`PASS`

## Phạm Vi

- Campaign: `check:any-types`
- Batch: 2
- File dự kiến sửa:
  - `src/__tests__/gps-geocode-attendance.test.ts`
  - `src/__tests__/portal-chat.test.ts`
- Loại thay đổi: test/mock type cleanup
- File dirty có sẵn ngoài scope: `src/products/bella-education/__tests__/preschool-enrollment-operational.integration.test.ts`
- Source/runtime production: không sửa
- Database/schema/RPC/generated type: không sửa
- Kernel/Core/Frozen OS: không sửa

## Truth / Source Of Truth

- Truth: sau Batch 1, `npm run check:any-types` còn 1,525 violation trong 224 file.
- Source of Truth:
  - `scripts/check-any-types.js`
  - `.cache/any-types-inventory-2026-09-30.json`
  - `docs/architecture/ANY_TYPES_BATCH1_RESULT_2026_09_30.md`
- Canonical contract cho batch này: local Jest test double phải model Supabase query boundary tối thiểu, không invent schema hoặc runtime behavior.

## Ownership

| Capability | Owner | Scope |
| --- | --- | --- |
| GPS/customer geocoding tests | QA/Test | Có quyền sửa trong batch |
| Portal chat action tests | QA/Test | Có quyền sửa trong batch |
| Production customer/ktv/portal actions | Product runtime | Không sửa |
| DB/RPC/generated type | Database contract | Không sửa |

## Change Authority

User đã authorize Batch 2:

- root-tests
- test/mock only
- cùng pattern Batch 1
- 40-80 violations
- no runtime production behavior
- no DB schema change
- no contract change
- no kernel change

## Minimal Implementation Plan

1. Thay explicit `any` trong local `MockQueryBuilder` bằng `unknown`.
2. Thay callback `then` bằng typed callback tối thiểu.
3. Thay mock forwarding rest params bằng `unknown[]`.
4. Không đổi assertion, không skip test, không đổi behavior mock.

## Verification Plan

1. `rg` pattern `any` trên 2 file Batch 2.
2. `npm run check:any-types`.
3. `git diff --check`.
4. `npx eslint` trên 2 file Batch 2.
5. Targeted Jest:
   - `npx jest src/__tests__/gps-geocode-attendance.test.ts --runInBand`
   - `npx jest src/__tests__/portal-chat.test.ts --runInBand`
6. `npm run arch:guard`.
