# ARCHITECTURE GATE RESULT - ANY TYPES BATCH 9

## Kết Luận

`PASS`

## Phạm Vi

- Campaign: `check:any-types`
- Batch: 9
- File dự kiến sửa:
  - `src/__tests__/security-hardening.test.ts`
- Loại thay đổi: test/mock type cleanup
- File dirty có sẵn ngoài scope: `src/products/bella-education/__tests__/preschool-enrollment-operational.integration.test.ts`
- Source/runtime production: không sửa
- Database/schema/RPC/generated type: không sửa
- Kernel/Core/Frozen OS: không sửa

## Truth / Source Of Truth

- Truth: sau Batch 8, `npm run check:any-types` còn 1,190 violation trong 216 file.
- Source of Truth:
  - `scripts/check-any-types.js`
  - `docs/architecture/ANY_TYPES_BATCH8_RESULT_2026_09_30.md`
- Canonical contract cho batch này: local Jest security store phải giữ behavior hiện có, không invent production schema hoặc runtime security contract.

## Ownership

| Capability | Owner | Scope |
| --- | --- | --- |
| Security hardening tests | QA/Test | Có quyền sửa trong batch |
| Production RLS/RBAC/security services | Runtime/security | Không sửa |
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

1. Thay local mock security store rows từ explicit `any` sang `MockSecurityRow`.
2. Thay local query-builder filters/payload explicit `any` bằng `unknown`/`MockSecurityRow`.
3. Thay `then` callback bằng typed callback tối thiểu.
4. Không đổi assertion, không skip test, không đổi behavior mock.

## Verification Plan

1. `rg` pattern `any` trên file Batch 9.
2. `npm run check:any-types`.
3. Targeted Jest:
   - `npx jest src/__tests__/security-hardening.test.ts --runInBand`
4. `npx eslint src/__tests__/security-hardening.test.ts`
5. `git diff --check`.
6. `npm run arch:guard`.
