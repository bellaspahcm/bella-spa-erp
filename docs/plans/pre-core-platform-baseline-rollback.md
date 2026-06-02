# Pre-Core Platform Baseline Rollback

## Baseline

Tag name:

```text
pre-core-platform-baseline-2026-06-03
```

Purpose:

- Preserve the latest stable Bella Spa ERP state before core-platform conversion work starts.
- Provide a safe rollback target if later core-readiness or core-platform extraction breaks production behavior.
- Keep this baseline before any broad module migration, schema split, or module-registry rollout.

## Rollback Options

### Inspect The Baseline

```powershell
git checkout pre-core-platform-baseline-2026-06-03
```

Use this only to inspect or run the baseline locally. It leaves Git in detached HEAD mode.

### Create A Rollback Branch

```powershell
git checkout -b rollback/pre-core-platform pre-core-platform-baseline-2026-06-03
git push origin rollback/pre-core-platform
```

Use this when production needs a rollback branch or a rollback PR.

### Move Main Back To Baseline

```powershell
git checkout main
git reset --hard pre-core-platform-baseline-2026-06-03
git push --force-with-lease origin main
```

Use this only when the team intentionally wants to roll back `main`. This rewrites remote branch history and must be treated as a high-risk operation.

## Guardrail

Before any future core-platform extraction batch starts, verify this tag exists both locally and on GitHub:

```powershell
git tag --list pre-core-platform-baseline-2026-06-03
git ls-remote --tags origin pre-core-platform-baseline-2026-06-03
```
