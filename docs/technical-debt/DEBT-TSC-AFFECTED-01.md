# DEBT-TSC-AFFECTED-01: Affected-scope TypeScript diagnostics currently non-zero

## Status

OPEN - source-health baseline pending.

## Finding

Dependency-aware CI routing can select and execute the affected TypeScript graph, but the current affected graph is not clean. A local proof run of `typecheck:changed` for `english_center` entered the intended scoped config and returned non-zero TypeScript diagnostics.

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
- No domain/source remediation is included in the CI hardening workstream.

## Closure Criteria

- Review and commit a scoped TypeScript diagnostic baseline for each affected CI scope that still has source debt, or reduce that scope to zero diagnostics.
- Run the scoped typecheck comparator in CI and confirm new diagnostics block while unchanged/reduced baseline debt behaves according to policy.
