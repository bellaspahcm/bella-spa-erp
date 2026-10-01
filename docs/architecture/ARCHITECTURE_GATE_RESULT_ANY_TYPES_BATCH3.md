# ARCHITECTURE GATE RESULT - ANY TYPES BATCH 3

## Kết Luận

`PASS`

## Phạm Vi

- Campaign: `check:any-types`
- Batch: 3
- File dự kiến sửa:
  - `src/__tests__/brand-service-master.test.ts`
- Loại thay đổi: test/mock type cleanup
- File dirty có sẵn ngoài scope: `src/products/bella-education/__tests__/preschool-enrollment-operational.integration.test.ts`
- Source/runtime production: không sửa
- Database/schema/RPC/generated type: không sửa
- Kernel/Core/Frozen OS: không sửa

## Truth / Source Of Truth

- Truth: sau Batch 2, `npm run check:any-types` còn 1,466 violation trong 222 file.
- Source of Truth:
  - `scripts/check-any-types.js`
  - `.cache/any-types-inventory-2026-09-30.json`
  - `docs/architecture/ANY_TYPES_BATCH2_RESULT_2026_09_30.md`
- Canonical contract cho batch này: local Jest test double phải model Supabase query boundary tối thiểu, không invent schema hoặc runtime behavior.

## Ownership

| Capability | Owner | Scope |
| --- | --- | --- |
| Brand service master tests | QA/Test | Có quyền sửa trong batch |
| Production brand service actions | Product runtime | Không sửa |
| DB/RPC/generated type | Database contract | Không sửa |

## Change Authority

User đã authorize Batch 3:

- root-tests
- test/mock only
- cùng pattern Batch 1/2
- không bắt buộc đủ 40-80 nếu pattern sạch
- no runtime production behavior
- no DB schema change
- no contract change
- no kernel/frozen OS change

## Minimal Implementation Plan

1. Thay `(global as any)` bằng typed `globalThis` test mock bridge.
2. Thay mock forwarding rest params bằng `unknown[]`.
3. Thay local `MockQueryBuilder` explicit `any` bằng `unknown` và typed callback tối thiểu.
4. Không đổi assertion, không skip test, không đổi behavior mock.

## Verification Plan

1. `rg` pattern `any` trên file Batch 3.
2. `npm run check:any-types`.
3. `git diff --check`.
4. `npx eslint src/__tests__/brand-service-master.test.ts`.
5. Targeted Jest:
   - `npx jest src/__tests__/brand-service-master.test.ts --runInBand`
6. `npm run arch:guard`.
