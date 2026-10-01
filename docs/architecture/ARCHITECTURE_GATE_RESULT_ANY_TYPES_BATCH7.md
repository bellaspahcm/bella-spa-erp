# ARCHITECTURE GATE RESULT - ANY TYPES BATCH 7

## Kết Luận

`PASS`

## Phạm Vi

- Campaign: `check:any-types`
- Batch: 7
- File dự kiến sửa:
  - `src/__tests__/inventory-transfer.test.ts`
- Loại thay đổi: test/mock type cleanup
- File dirty có sẵn ngoài scope: `src/products/bella-education/__tests__/preschool-enrollment-operational.integration.test.ts`
- Source/runtime production: không sửa
- Database/schema/RPC/generated type: không sửa
- Kernel/Core/Frozen OS: không sửa

## Truth / Source Of Truth

- Truth: sau Batch 6, `npm run check:any-types` còn 1,263 violation trong 218 file.
- Source of Truth:
  - `scripts/check-any-types.js`
  - `docs/architecture/ANY_TYPES_BATCH6_RESULT_2026_09_30.md`
- Canonical contract cho batch này: local Jest in-memory fake DB phải giữ behavior hiện có, không invent production schema hoặc runtime contract.

## Ownership

| Capability | Owner | Scope |
| --- | --- | --- |
| Inventory transfer tests | QA/Test | Có quyền sửa trong batch |
| Production inventory transfer actions | Product/runtime | Không sửa |
| DB/RPC/generated type | Database contract | Không sửa |

## Change Authority

User đã authorize tiếp tục các cluster `root-tests` nếu:

- test/mock only
- type/mock-local
- no runtime production behavior
- no DB schema change
- no RPC/generated contract change
- no Core/Frozen OS change
- verification pass thì tiếp tục; fail thì dừng

## Minimal Implementation Plan

1. Thay `(global as any)` bằng typed `globalThis` test mock bridge.
2. Thay mock forwarding rest params bằng `unknown[]`.
3. Thay local mock DB rows từ explicit `any` sang `MockRow`.
4. Thay local `MockQueryBuilder` payload/filter explicit `any` bằng `unknown`/`MockRow`.
5. Không đổi assertion, không skip test, không đổi behavior mock.

## Verification Plan

1. `rg` pattern `any` trên file Batch 7.
2. `npm run check:any-types`.
3. Targeted Jest:
   - `npx jest src/__tests__/inventory-transfer.test.ts --runInBand`
4. `npx eslint src/__tests__/inventory-transfer.test.ts`
5. `git diff --check`.
6. `npm run arch:guard`.
