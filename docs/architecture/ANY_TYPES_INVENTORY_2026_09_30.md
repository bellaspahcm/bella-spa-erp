# KIỂM KÊ ANY TYPES - 2026-09-30

## P0 - Bằng Chứng Hiện Tại

- Lệnh đã chạy: `npm run check:any-types`
- Kết quả: `FAIL`
- Số file TypeScript đã quét: 2,785
- Tổng số dòng đã quét: 836,149
- Số file có vi phạm: 226
- Tổng số vi phạm theo checker: 1,567
- Số vị trí dòng duy nhất: 1,150
- Số dòng bị đếm trùng do pattern overlap: 216
- Thay đổi source code: không

## Phát Hiện Về Gate

- Checker hiện tại đếm tổng vi phạm đúng theo regex đang enforce, nhưng phân nhóm priority không đáng tin trên Windows.
- Lý do: script dùng path check kiểu `src/platform/`, trong khi Windows trả về path có dấu `\`, nên các file `src\platform\...` không vào đúng bucket `CRITICAL`.
- Inventory này normalize path chỉ để phân loại layer/risk. Chưa sửa checker, chưa nới lỏng gate.

## Top 20 File Có Nhiều Vi Phạm Nhất

| # | File | Vi phạm | Layer | Product/Domain | Owner | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/__tests__/e2e-pipeline.test.ts` | 68 | root-tests | shared/core | QA/Test | LOW/MEDIUM - test-only nếu không đổi behavior |
| 2 | `src/__tests__/inter-branch-clearing.test.ts` | 67 | root-tests | shared/core | QA/Test | LOW/MEDIUM - test-only nếu không đổi behavior |
| 3 | `src/__tests__/brand-service-master.test.ts` | 49 | root-tests | shared/core | QA/Test | LOW/MEDIUM - test-only nếu không đổi behavior |
| 4 | `src/__tests__/franchise-royalty.test.ts` | 48 | root-tests | shared/core | QA/Test | LOW/MEDIUM - test-only nếu không đổi behavior |
| 5 | `src/__tests__/inventory-transfer.test.ts` | 46 | root-tests | warehouse/inventory | QA/Test | LOW/MEDIUM - test-only nếu không đổi behavior |
| 6 | `src/__tests__/ai-coo-agents.test.ts` | 43 | root-tests | shared/core | QA/Test | LOW/MEDIUM - test-only nếu không đổi behavior |
| 7 | `src/__tests__/hq-audit-explorer.test.ts` | 39 | root-tests | shared/core | QA/Test | LOW/MEDIUM - test-only nếu không đổi behavior |
| 8 | `src/__tests__/security-hardening.test.ts` | 39 | root-tests | security | QA/Test | LOW/MEDIUM - test-only nếu không đổi behavior |
| 9 | `src/__tests__/subscription.test.ts` | 37 | root-tests | shared/core | QA/Test | LOW/MEDIUM - test-only nếu không đổi behavior |
| 10 | `src/__tests__/ai-agent.test.ts` | 34 | root-tests | shared/core | QA/Test | LOW/MEDIUM - test-only nếu không đổi behavior |
| 11 | `src/__tests__/gps-geocode-attendance.test.ts` | 34 | root-tests | shared/core | QA/Test | LOW/MEDIUM - test-only nếu không đổi behavior |
| 12 | `src/platform/real-estate/__tests__/real-estate-kernel.integration.test.ts` | 33 | platform-os | real-estate | Platform OS | HIGH - platform tests |
| 13 | `src/__tests__/accounting-reports.test.ts` | 31 | root-tests | finance | QA/Test | LOW/MEDIUM - test-only nếu không đổi behavior |
| 14 | `src/__tests__/transaction-safety.test.ts` | 27 | root-tests | shared/core | QA/Test | LOW/MEDIUM - test-only nếu không đổi behavior |
| 15 | `src/__tests__/portal-chat.test.ts` | 25 | root-tests | shared/core | QA/Test | LOW/MEDIUM - test-only nếu không đổi behavior |
| 16 | `src/__tests__/auto-phase4-sales-lead.test.ts` | 22 | root-tests | bella-auto | QA/Test | LOW/MEDIUM - test-only nếu không đổi behavior |
| 17 | `src/__tests__/helpers/supabase-test-helpers.ts` | 22 | root-tests | shared/core | QA/Test | LOW/MEDIUM - test-only nếu không đổi behavior |
| 18 | `src/__tests__/update-booking-conflicts.test.ts` | 21 | root-tests | booking | QA/Test | LOW/MEDIUM - test-only nếu không đổi behavior |
| 19 | `src/__tests__/customer-actions.test.ts` | 20 | root-tests | shared/core | QA/Test | LOW/MEDIUM - test-only nếu không đổi behavior |
| 20 | `src/__tests__/bella-auto-phase11-rollback.test.ts` | 19 | root-tests | bella-auto | QA/Test | LOW/MEDIUM - test-only nếu không đổi behavior |

## Top Runtime / Non-Test

| # | File | Vi phạm | Layer | Product/Domain | Risk |
| --- | --- | --- | --- | --- | --- |
| 1 | `src/app/dashboard/education/scheduling/page.tsx` | 10 | app-ui | preschool/education | MEDIUM - UI type-local |
| 2 | `src/platform/logistics/warehouse/receipt.service.ts` | 10 | platform-os | logistics | CRITICAL - sealed Logistics OS |
| 3 | `src/services/healthcare-hospital-services.ts` | 8 | other | healthcare | MEDIUM |
| 4 | `src/app/dashboard/education/facilities/page.tsx` | 7 | app-ui | preschool/education | MEDIUM - UI type-local |
| 5 | `src/products/bella-education/facilities/repositories/preschool-facilities.repository.ts` | 7 | product | preschool/education | MEDIUM/HIGH - product runtime |
| 6 | `src/services/intelligence/finance/balance-sheet.ts` | 7 | other | finance | MEDIUM |
| 7 | `src/products/bella-education/analytics/repositories/preschool-analytics.repository.ts` | 6 | product | preschool/education | MEDIUM/HIGH - product runtime |
| 8 | `src/products/bella-education/facilities/bridges/facilities-projection.bridge.ts` | 6 | product | preschool/education | MEDIUM/HIGH - product runtime |
| 9 | `src/products/bella-education/facilities/services/maintenance-job.service.ts` | 6 | product | preschool/education | MEDIUM/HIGH - product runtime |
| 10 | `src/products/bella-education/facilities/services/safety-inspection.service.ts` | 6 | product | preschool/education | MEDIUM/HIGH - product runtime |

## Vi Phạm Theo Layer

| Layer | Vi phạm |
| --- | --- |
| root-tests | 1,030 |
| platform-os | 244 |
| product | 98 |
| other | 71 |
| lib | 54 |
| app-ui | 27 |
| module-product | 23 |
| api | 12 |
| component-ui | 6 |
| adapter | 1 |
| core | 1 |

## Vi Phạm Theo Product / Domain

| Product/Domain | Vi phạm |
| --- | --- |
| shared/core | 816 |
| finance | 145 |
| security | 96 |
| bella-auto | 84 |
| preschool/education | 75 |
| real-estate | 71 |
| logistics | 70 |
| warehouse/inventory | 61 |
| booking | 53 |
| healthcare | 49 |
| beauty-spa/haircut/nail | 19 |
| commission/payroll | 18 |
| partner-api | 10 |

## Vi Phạm Theo Owner

| Owner | Vi phạm |
| --- | --- |
| QA/Test | 1,193 |
| Platform OS | 88 |
| Logistics OS | 70 |
| Finance OS | 57 |
| Product/Module | 54 |
| Product UI | 35 |
| Shared | 24 |
| Healthcare OS | 23 |
| Service/Integration | 16 |
| Education OS | 6 |
| Core | 1 |

## Vi Phạm Theo Pattern

| Pattern | Vi phạm |
| --- | --- |
| `: any` | 692 |
| `as any` | 432 |
| `any[]` | 200 |
| `: any[]` | 176 |
| `<any>` | 39 |
| `Promise<any>` | 16 |
| `Record<*, any>` | 12 |

## Ứng Viên Batch Đầu Tiên

- Batch A nên bắt đầu từ test/mock lặp lại, không chạm runtime: `src/__tests__/helpers/supabase-test-helpers.ts` + một file test dùng mock pattern tương tự, tổng khoảng 40-80 vi phạm.
- Batch B có thể là UI/Product type-local trong Education: `src/app/dashboard/education/scheduling/page.tsx`, `src/app/dashboard/education/facilities/page.tsx`.
- Defer trước: Logistics OS sealed, Healthcare OS frozen, Finance OS runtime, DB/RPC generated contract gap.

## Artifact

- Full line-level JSON: `.cache/any-types-inventory-2026-09-30.json`
- Tóm tắt Markdown: `docs/architecture/ANY_TYPES_INVENTORY_2026_09_30.md`
