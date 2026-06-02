# Harden Portal KTV Typing

Date: 2026-06-03

## Goal

Remove loose `any` usage from the customer portal chat/booking UI and KTV self-service screens while preserving existing behavior and strengthening salary confirmation data handling.

## Scope

- Export the customer portal booking DTO from `src/services/customer-actions.ts`.
- Type customer portal booking/session/revenue reads from the exported DTO.
- Type portal chat messages from generated Supabase `chat_messages` table types, including optimistic messages.
- Type KTV leaderboard state from the `get_ktv_leaderboard` RPC return type and realtime payloads from Supabase types.
- Type KTV earnings state, leaderboard summary, salary confirmation data, session details, and package summaries.
- Propagate Supabase read errors from KTV salary confirmation reads instead of silently returning partial data.
- Fix KTV salary confirmation month bounds to use the selected month.
- Roll back salary status when creating a salary dispute record fails after the status update.

## Acceptance Checks

- Customer portal and portal chat target files contain no explicit TypeScript `any`.
- KTV leaderboard and KTV earnings target files contain no explicit TypeScript `any`.
- KTV salary confirmation reads throw explicit errors on Supabase failures.
- KTV salary dispute creation does not leave salary status changed if the dispute insert fails.
- Typecheck passes after replacing loose state and callback types.

## Verification

- `npx.cmd tsc --noEmit --pretty false`
- `npm.cmd run lint -- src/app/portal/[token]/page.tsx src/components/features/portal/PortalChatWidget.tsx src/app/ktv/leaderboard/page.tsx src/app/ktv/earnings/page.tsx src/modules/hr-salary/actions/base-salary-actions.ts src/services/customer-actions.ts src/__tests__/public-promotions-ui.test.ts`
- `npm.cmd test -- src/__tests__/public-promotions-ui.test.ts --runInBand`
- `npm.cmd test -- --runInBand`
- `git diff --check`
