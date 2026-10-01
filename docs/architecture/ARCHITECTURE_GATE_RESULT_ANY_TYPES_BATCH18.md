# ARCHITECTURE GATE RESULT - ANY TYPES BATCH 18

## Kết Luận

`PASS`

## Phạm Vi

- Campaign: `check:any-types`
- Batch: 18
- File dự kiến sửa:
  - `src/__tests__/hq-actions.test.ts`
  - `src/__tests__/onboarding.test.ts`
  - `src/__tests__/finance.lockMonth.test.ts`
  - `src/__tests__/policy-registry/plugin-demo.test.ts`
- Loại thay đổi: root test mock/query-chain và demo policy type cleanup
- File dirty có sẵn ngoài scope: `src/products/bella-education/__tests__/preschool-enrollment-operational.integration.test.ts`
- Source/runtime production: không sửa
- Database/schema/RPC/generated type: không sửa
- Kernel/Core/Frozen OS: không sửa

## Truth / Source Of Truth

- Truth: sau Batch 17, `npm run check:any-types` còn 775 violation trong 194 file.
- Source of Truth:
  - `scripts/check-any-types.js`
  - `docs/architecture/ANY_TYPES_BATCH17_RESULT_2026_09_30.md`
- Canonical contract cho batch này: test doubles phải giữ behavior hiện có; không thay đổi Finance runtime, HQ runtime, onboarding flow, policy registry hoặc business process executor.

## Ownership

| Capability | Owner | Scope |
| --- | --- | --- |
| Root test mocks/query chains | QA/Test | Có quyền sửa trong batch |
| HQ/onboarding/finance services | Product/runtime | Không sửa |
| Policy registry/business process runtime | Platform/lib runtime | Không sửa |
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

1. Type hóa mock query builders bằng structural test-local types.
2. Type hóa callback/rest args bằng `unknown`.
3. Type hóa demo policy input/output bằng type cục bộ trong test.
4. Không đổi assertion, không skip test, không đổi production behavior.

## Verification Plan

1. `rg` pattern `any` trên file Batch 18.
2. `npm run check:any-types`.
3. Targeted Jest cho 4 file Batch 18.
4. `npx eslint` cho 4 file Batch 18.
5. `git diff --check`.
6. `npm run arch:guard`.
