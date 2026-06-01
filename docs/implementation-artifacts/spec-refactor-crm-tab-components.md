# Refactor CRM Tab Components

Date: 2026-06-02

## Goal

Reduce `src/app/dashboard/crm/page.tsx` responsibility by moving large CRM tab bodies and the voucher modal into dedicated client components while preserving existing data loading, action handling, and UI behavior.

## Scope

- Keep `page.tsx` as the container for tab state, voucher demo state, CRM data hook, and CRM action hook.
- Move overview/Zalo configuration UI into `CrmOverviewTab`.
- Move reminder table UI into `CrmRemindersTab`.
- Move birthday marketing and voucher campaign UI into `CrmMarketingTab`.
- Move ZNS log table UI into `CrmLogsTab`.
- Move voucher creation form into `CrmVoucherModal`.
- Update CRM UI source tests to verify the new component boundaries.

## Acceptance Checks

- Given the CRM page loads successfully, when a user switches tabs, then each tab renders through a dedicated component.
- Given CRM data loading fails, when a tab has no rows, then the tab still receives `loadError` and renders the explicit failure empty state.
- Given a user sends a reminder, birthday voucher, or saves Zalo config, when the action completes, then existing hook-driven refresh behavior remains unchanged.
- Given voucher demo state changes, when the user creates a voucher, then the modal still closes and the new campaign is appended locally.

## Verification

- `npm.cmd test -- src/__tests__/crm-ui.test.ts src/__tests__/crm-zalo-quota.test.ts --runInBand`
- `npm.cmd run lint -- src/app/dashboard/crm/page.tsx src/app/dashboard/crm/components/CrmOverviewTab.tsx src/app/dashboard/crm/components/CrmRemindersTab.tsx src/app/dashboard/crm/components/CrmMarketingTab.tsx src/app/dashboard/crm/components/CrmLogsTab.tsx src/app/dashboard/crm/components/CrmVoucherModal.tsx src/__tests__/crm-ui.test.ts`
- `npx.cmd tsc --noEmit --pretty false`
