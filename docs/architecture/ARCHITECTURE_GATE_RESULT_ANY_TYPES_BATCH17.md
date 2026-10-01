# ARCHITECTURE GATE RESULT - ANY TYPES BATCH 17

## Kết Luận

`PASS`

## Phạm Vi

- Campaign: `check:any-types`
- Batch: 17
- File dự kiến sửa:
  - `src/__tests__/bella-auto-phase11-rollback.test.ts`
  - `src/__tests__/update-booking-conflicts.test.ts`
  - `src/__tests__/state-machine.test.ts`
- Loại thay đổi: root test mock/query-chain type cleanup
- File dirty có sẵn ngoài scope: `src/products/bella-education/__tests__/preschool-enrollment-operational.integration.test.ts`
- Source/runtime production: không sửa
- Database/schema/RPC/generated type: không sửa
- Kernel/Core/Frozen OS: không sửa

## Truth / Source Of Truth

- Truth: sau Batch 16, `npm run check:any-types` còn 832 violation trong 197 file.
- Source of Truth:
  - `scripts/check-any-types.js`
  - `docs/architecture/ANY_TYPES_BATCH16_RESULT_2026_09_30.md`
- Canonical contract cho batch này: test doubles phải giữ behavior hiện có; không thay đổi service runtime, rollback semantics, booking conflict semantics, hoặc state machine rules.

## Ownership

| Capability | Owner | Scope |
| --- | --- | --- |
| Root test mocks/query chains | QA/Test | Có quyền sửa trong batch |
| Bella Auto rollback services | Product/runtime | Không sửa |
| Booking/session/salary/inventory runtime | Core/Product runtime | Không sửa |
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

1. Type hóa chainable mocks bằng structural test-local types.
2. Type hóa mock store rows bằng `Record<string, unknown>` hoặc generated row type có sẵn.
3. Type hóa callback/rest args bằng `unknown`.
4. Không đổi assertion, không skip test, không đổi production behavior.

## Verification Plan

1. `rg` pattern `any` trên file Batch 17.
2. `npm run check:any-types`.
3. Targeted Jest cho 3 file Batch 17.
4. `npx eslint` cho 3 file Batch 17.
5. `git diff --check`.
6. `npm run arch:guard`.
