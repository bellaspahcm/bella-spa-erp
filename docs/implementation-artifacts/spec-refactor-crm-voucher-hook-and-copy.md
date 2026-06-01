# Refactor CRM Voucher Hook And Copy

Date: 2026-06-02

## Goal

Keep the CRM page as a thin container by moving voucher campaign modal state into a dedicated hook and fixing the CRM UI copy so Vietnamese text renders correctly.

## Scope

- Extract local voucher campaign state and create handler into `useCrmVoucherCampaigns`.
- Keep the voucher modal as a presentational component receiving explicit props.
- Keep CRM data loading and Zalo actions unchanged.
- Rewrite CRM UI copy affected by mojibake in the page, tabs, header, error banner, tab components, and voucher modal.
- Add a regression test that rejects mojibake markers in CRM UI source files.

## Acceptance Checks

- Given the CRM page renders, when marketing voucher state is needed, then it comes from `useCrmVoucherCampaigns` instead of inline page state.
- Given a voucher is created, when the form submits with a non-empty code, then the voucher is appended and the modal closes.
- Given CRM UI source files are checked, when mojibake markers are present, then `crm-ui.test.ts` fails.
- Given CRM data or Zalo actions run, then existing hooks and action flows remain unchanged.

## Verification

- `npm.cmd test -- src/__tests__/crm-ui.test.ts src/__tests__/crm-zalo-quota.test.ts --runInBand`
- `npm.cmd run lint -- src/app/dashboard/crm/page.tsx src/app/dashboard/crm/components/CrmHeader.tsx src/app/dashboard/crm/components/CrmTabs.tsx src/app/dashboard/crm/components/CrmLoadErrorBanner.tsx src/app/dashboard/crm/components/CrmOverviewTab.tsx src/app/dashboard/crm/components/CrmRemindersTab.tsx src/app/dashboard/crm/components/CrmMarketingTab.tsx src/app/dashboard/crm/components/CrmLogsTab.tsx src/app/dashboard/crm/components/CrmVoucherModal.tsx src/app/dashboard/crm/hooks/useCrmVoucherCampaigns.ts src/__tests__/crm-ui.test.ts`
- `npx.cmd tsc --noEmit --pretty false`
