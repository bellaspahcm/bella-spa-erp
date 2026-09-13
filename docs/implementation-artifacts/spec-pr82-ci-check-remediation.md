---
title: 'PR82 CI Check Remediation'
type: 'bugfix'
created: '2026-09-13'
status: 'done'
route: 'one-shot'
---

# PR82 CI Check Remediation

## Intent

**Problem:** PR #82 had confirmed CI blockers from stale API documentation script paths and Semgrep OSS workflow annotations, while runner execution itself was working.

**Approach:** Bound API documentation and live DB checks to relevant change scopes, point API documentation scripts at the existing canonical docs, remove direct GitHub context interpolation from shell steps, and pin the exact mutable action tag reported by Semgrep OSS.

## Suggested Review Order

1. `../../.github/workflows/quality-security.yml` -- Review API docs/live DB gating and skipped-check behavior.
2. `../../scripts/check-api-docs.mjs` -- Confirm API docs coverage reads the canonical API reference.
3. `../../scripts/check-api-versioning.mjs` -- Confirm versioning policy reads the canonical policy document.
4. `../../.github/workflows/ci-tests.yml` -- Confirm GitHub context data is read from environment variables in shell steps.
5. `../../.github/workflows/static-analysis.yml` -- Confirm Trivy changed-file detection uses environment variables.
6. `../../.github/workflows/branch-cleanup-on-merge.yml` -- Confirm the Semgrep-reported mutable GitHub Script tag is pinned.
7. `../../docs/implementation-artifacts/deferred-work.md` -- Confirm broader mutable-action pinning is explicitly deferred.
