# Harden Attendance Actions Typing

Date: 2026-06-03

## Goal

Remove loose runtime `any` from attendance server actions while preserving attendance, leave approval, and salary-adjacent behavior.

## Scope

- Type monthly attendance KTV rows from generated `users` table types.
- Type monthly attendance logs from generated `attendance` table types.
- Normalize attendance status through a typed helper instead of inline loose checks.
- Type leave conflict session rows from generated `session_logs`, `bookings`, and `customers` table types.
- Replace conflict-session `any` filters with typed helper-based morning/afternoon filtering.

## Acceptance Checks

- `src/services/attendance-actions.ts` contains no explicit TypeScript `any`.
- Monthly attendance summary keeps present/late/absent/half-day day counts unchanged.
- Conflict session filtering still separates morning before 13:00 and afternoon from 13:00.
- Typecheck passes after tightening attendance action typing.

## Verification

- `npx.cmd tsc --noEmit --pretty false`
- `npm.cmd run lint -- src/services/attendance-actions.ts`
- `npm.cmd test -- src/__tests__/attendance-actions.test.ts --runInBand`
- `npm.cmd test -- --runInBand`
- `git diff --check`
