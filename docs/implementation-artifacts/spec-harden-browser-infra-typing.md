# Harden Browser Infra Typing

Date: 2026-06-03

## Goal

Remove loose runtime `any` from browser/infrastructure helpers while preserving current PWA install, offline sync, and log redaction behavior.

## Scope

- Replace the loose Sentry redactor event shape with structural object typing and internal field guards.
- Type offline queue payloads for KTV check-in, checkout, notes, ratings, and shift actions.
- Validate offline sync payloads before replaying actions from IndexedDB.
- Replay stored GPS coordinates during offline check-in and checkout sync.
- Replace the PWA deferred install prompt state with a typed `BeforeInstallPromptEvent` guard.

## Acceptance Checks

- `src/lib/log-redactor.ts` contains no explicit TypeScript `any`.
- `src/lib/offline-db.ts` contains no explicit TypeScript `any`.
- `src/components/common/PwaRegister.tsx` contains no explicit TypeScript `any`.
- `src/services/sync-actions.ts` contains no explicit TypeScript `any`.
- Typecheck passes after tightening Sentry and offline payload typing.

## Verification

- `npx.cmd tsc --noEmit --pretty false`
- `npm.cmd run lint -- src/lib/log-redactor.ts src/lib/offline-db.ts src/components/common/PwaRegister.tsx src/services/sync-actions.ts`
- `npm.cmd test -- src/__tests__/log-redactor.test.ts --runInBand`
- `npm.cmd test -- --runInBand`
- `git diff --check`
