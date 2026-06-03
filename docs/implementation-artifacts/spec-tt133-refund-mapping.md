# Spec: TT133 Refund Mapping

Status: Done
Date: 2026-06-03

## Problem

Bella's accounting runtime still posted customer refunds to account `521`. That is unsafe for the current TT133 service-accounting direction because revenue recognition now uses `5113` for service revenue and `3387` for unearned revenue.

## Decision

Refund posting must split by accounting substance:

- Unperformed service refund: debit `3387`, credit `111` or `112`.
- Already recognized service refund: debit `5113`, credit `111` or `112`.
- Legacy outbox payloads without split fields remain processable and default to debit `5113`, credit `111` or `112`.

If both split fields are supplied, their sum must match the refund amount. Mismatches fail explicitly so accounting errors cannot be silently posted.

## Scope

- Runtime refund journal generation.
- Accounting worker payload routing.
- TT133 template default and migration for existing templates.
- Regression tests for default and split refund postings.

## Out of Scope

- Removing legacy `521` from historical reports. Existing reports may still read `521` so old posted data remains visible.
- Building a UI for accountant refund split review.

## Verification Plan

- `npm.cmd test -- src/__tests__/accounting-engine.test.ts src/__tests__/accounting-outbox.test.ts --runInBand`
- `npm.cmd run build`
