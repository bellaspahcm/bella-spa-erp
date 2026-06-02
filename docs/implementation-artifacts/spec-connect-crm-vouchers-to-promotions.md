# Connect CRM Vouchers To Promotions

Date: 2026-06-02

## Goal

Replace the CRM voucher demo list with tenant-scoped promotion data so CRM marketing uses the same source of truth as the Settings promotions module.

## Scope

- Load voucher campaigns through `getPromotions`.
- Create new CRM vouchers through `createPromotion` with audit rollback behavior preserved by the existing service.
- Surface voucher-specific loading and error states in the CRM marketing tab.
- Revalidate `/dashboard/crm` when promotions are created, toggled, or deleted.
- Keep CRM birthday/Zalo send flows unchanged.

## Acceptance Checks

- Given promotions exist for the current tenant, when the CRM marketing tab opens, then voucher cards are mapped from `promotions`.
- Given promotions cannot be loaded, when the CRM marketing tab renders, then an explicit voucher load error is shown.
- Given a new voucher is submitted, when `createPromotion` succeeds, then the modal closes and the voucher list reloads from the database.
- Given a promotion changes, when server actions complete successfully, then both Settings and CRM paths are revalidated.

## Verification

- `npm.cmd test -- src/__tests__/crm-ui.test.ts src/__tests__/crm-zalo-quota.test.ts src/__tests__/promotions.test.ts --runInBand`
- `npm.cmd run lint -- src/app/dashboard/crm/page.tsx src/app/dashboard/crm/types.ts src/app/dashboard/crm/hooks/useCrmVoucherCampaigns.ts src/app/dashboard/crm/components/CrmMarketingTab.tsx src/app/dashboard/crm/components/CrmVoucherModal.tsx src/services/promotions-actions.ts src/__tests__/crm-ui.test.ts src/__tests__/promotions.test.ts`
- `npx.cmd tsc --noEmit --pretty false`
