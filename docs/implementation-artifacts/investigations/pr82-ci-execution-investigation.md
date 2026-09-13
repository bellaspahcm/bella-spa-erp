# PR82 CI Execution Investigation

## Case Info

- Date: 2026-09-13
- Scope: PR #82 GitHub Actions checks for `infra/git-workflow-constitution-install`
- Status: Active
- Constraint: Do not push further commits merely to retrigger CI.

## Problem Statement

PR #82 shows multiple failing or pending checks. The working hypothesis was that workflow triggering works but runner execution is blocked or queued at the GitHub Actions infrastructure/configuration layer.

## Confirmed Evidence

- PR #82 head SHA is `0675c92c8ad8df2705e4daba1efba75c48b8c88d`.
- GitHub reported multiple PR check runs for that SHA, including `Architecture Gate`, `Quality and Security`, `CI - Quality Gates`, `Static Analysis Security Suite`, and `Type Check`.
- Runner execution is not globally blocked: several jobs started and completed successfully, including `Architecture Gate`, `Static Analysis Security Suite`, `Lint`, `Migration Gates`, `Dependency and Secret Gates`, `Real Database Business E2E`, and `Production Build`.
- `Quality and Security / quality-security` failed in the `API documentation coverage` step.
- The failing command was `npm run docs:api:check`, which runs `node scripts/check-api-docs.mjs`.
- The script reads `docs/api-reference.md`, and the current checkout does not contain that file.
- `Semgrep CE` from `.github/workflows/static-analysis.yml` passed.
- A separate `Semgrep OSS` check failed from the `GitHub Advanced Security` app with 5 new code-scanning alerts, including 4 errors.
- The API caller used for this investigation can read PR checks and logs, but received `403` for repository Actions permissions and runner inventory APIs.
- The classic branch-protection details endpoint returned `404` despite the branch metadata reporting `main` as protected.

## Deduced Conclusions

- The current evidence does not support a blanket "runner unavailable" diagnosis. GitHub-hosted `ubuntu-latest` jobs are being assigned and executed.
- The visible hard failure in `Quality and Security` is caused by a missing documentation artifact expected by the workflow/script contract, not by PR #82 application code.
- The `Semgrep OSS` failure is not the same as the repo workflow `Semgrep CE` job; it comes from GitHub Advanced Security code scanning.
- Pending `typecheck` and `Unit and Integration Tests` are process-level running jobs, not queued jobs at the observed time. `typecheck` is specifically inside `npm run type-check`; this matches the known repository risk that root typecheck can stall without diagnostics.
- Full diagnosis of Actions enablement, runner-group restrictions, and billing/quota remains blocked on owner/admin settings access, not on local repository evidence.

## Open Items

- Owner/admin should inspect `Repository -> Settings -> Actions -> General` because the available token cannot read Actions policy APIs.
- Owner/admin should inspect `Settings -> Actions -> Runners`; local evidence only shows no custom `runs-on` labels in the relevant PR workflows.
- Inspect GitHub Advanced Security code-scanning annotations for `Semgrep OSS` to determine whether those alerts are policy-required or informational.
- Let the current `typecheck` and test jobs reach timeout/completion before deciding whether a new code/workflow change is justified.

## Current Best Explanation

PR #82 is not blocked by a repo-wide inability to start runners. The active blockers are a real `Quality and Security` workflow failure caused by missing `docs/api-reference.md`, a separate GitHub Advanced Security `Semgrep OSS` code-scanning failure, and still-running long jobs (`typecheck`, tests) whose final state was not yet available at the time of inspection.
