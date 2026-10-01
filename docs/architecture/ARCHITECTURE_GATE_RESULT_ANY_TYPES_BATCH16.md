# ARCHITECTURE GATE RESULT - ANY TYPES BATCH 16

## Kết Luận

`PASS`

## Phạm Vi

- Campaign: `check:any-types`
- Batch: 16
- File dự kiến sửa:
  - `src/__tests__/concurrency.test.ts`
  - `src/__tests__/idempotency.test.ts`
  - `src/__tests__/edge-cases.test.ts`
- Loại thay đổi: fake Supabase query-builder test type cleanup
- File dirty có sẵn ngoài scope: `src/products/bella-education/__tests__/preschool-enrollment-operational.integration.test.ts`
- Source/runtime production: không sửa
- Database/schema/RPC/generated type: không sửa
- Kernel/Core/Frozen OS: không sửa

## Truth / Source Of Truth

- Truth: sau Batch 15, `npm run check:any-types` còn 876 violation trong 200 file.
- Source of Truth:
  - `scripts/check-any-types.js`
  - `docs/architecture/ANY_TYPES_BATCH15_RESULT_2026_09_30.md`
- Canonical contract cho batch này: fake Supabase builders trong tests phải giữ behavior hiện có và chỉ thay explicit `any` bằng structural mock-local types.

## Ownership

| Capability | Owner | Scope |
| --- | --- | --- |
| Root fake Supabase tests | QA/Test | Có quyền sửa trong batch |
| Order/session production services | Core/runtime consumer | Không sửa |
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

1. Thêm `MockRow`, `MockQueryResult`, `MockQueryNode` tại từng test file.
2. Type hóa fake query-builder method params bằng `unknown` / `MockRow`.
3. Type hóa thenable node callback bằng callback shape tối thiểu.
4. Không đổi assertion, không skip test, không đổi production service.

## Verification Plan

1. `rg` pattern `any` trên file Batch 16.
2. `npm run check:any-types`.
3. Targeted Jest cho 3 file Batch 16.
4. `npx eslint` cho 3 file Batch 16.
5. `git diff --check`.
6. `npm run arch:guard`.
