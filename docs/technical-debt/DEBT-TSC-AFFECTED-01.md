# DEBT-TSC-AFFECTED-01: Affected-scope TypeScript diagnostics currently non-zero

## Status

OPEN - reviewed diagnostic baseline active.

## Finding

Dependency-aware CI routing can select and execute the affected TypeScript graph, but the current affected graph is not clean. Runtime CI selected `education-affected`, and local scoped runs reproduced non-zero diagnostics for both configs invoked by the affected runner.

## Owner

Platform / Education / English Center hardening.

## Not Owned By

Dependency-Aware CI routing.

## Policy

Scoped typecheck must not become false-green:

- `M > N`: BLOCK because the PR introduced new TypeScript diagnostics.
- `M = N`: ALLOW with bounded baseline debt when the baseline has been explicitly reviewed.
- `M < N`: ALLOW because the PR reduced debt.

Where `N` is the reviewed baseline diagnostic count for the affected scope and `M` is the PR diagnostic count for the same scope.

## Current Evidence

- Routing tests pass independently of source health.
- The diagnostic comparator has tests for new diagnostic blocking, same-baseline allow, and debt-reduction allow.
- Reviewed baseline date: 2026-09-14.
- `education-affected`: 121 diagnostic signatures, 231 total diagnostic occurrences.
- `english-center-affected`: 101 diagnostic signatures, 191 total diagnostic occurrences.
- Ownership buckets observed in the reviewed baseline:
  - Education Platform / Host / Decision Engine: primary debt concentration.
  - Education app/API and Preschool product: affected product debt.
  - English Center product and shared platform messaging/context/metadata/org-unit surfaces: affected product/platform debt.
- No domain/source remediation is included in the CI hardening workstream.

## Closure Criteria

- Reduce each affected CI scope to zero diagnostics.
- Remove the reviewed baseline entries once the corresponding scopes are clean.
