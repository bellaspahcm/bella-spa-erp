# Platform Backup / Restore Readiness Root-Cause Trace - 2026-10-07

## Scope

This is a read-only Platform / Ops trace for production backup and restore readiness.

Out of scope:

- Hospital code.
- Beauty V2 code.
- Product runtime code.
- Schema changes.
- Migrations.
- Production restore execution.
- Production data mutation.
- Go-Live decision.

## Canonical Result

```text
PLATFORM_BACKUP_RESTORE_READINESS_ROOT_CAUSE_TRACE = PASS

BACKUP_RESTORE_READINESS = BLOCKED_NOT_VERIFIED
PRODUCTION_INTEGRITY = BLOCKED
HOSPITAL_CODE_FIX = NOT_INDICATED
PRODUCT_CODE_FIX = NOT_INDICATED

ROOT_CAUSE = NO_AVAILABLE_RESTORE_POINT
OWNER = PLATFORM / OPS / SUPABASE PRODUCTION CONFIGURATION

PRODUCTION_MUTATION_REQUIRED_FOR_THIS_TRACE = NO
PRODUCTION_OPS_ACTION_REQUIRED_TO_UNBLOCK = YES
PRODUCTION_MUTATION_REQUIRED = YES
PRODUCTION_MUTATION_AUTHORIZED_HERE = NO
```

This trace proves the blocker is operational backup / restore evidence, not Hospital application code.

## Current Production Project

Read-only command:

```bash
supabase projects list
```

Relevant production project:

```text
project_ref = lvnvkpyxtuilhrabtlwv
name = bellaspahcm's Project
status = ACTIVE_HEALTHY
region = ap-southeast-1
database_host = db.lvnvkpyxtuilhrabtlwv.supabase.co
linked = false
```

Production being healthy is useful availability evidence, but it is not backup / restore evidence.

## Current Backup / Restore Mechanism

Authoritative external mechanism:

- Supabase Dashboard database backups.
- Supabase Management API / CLI backup listing for `/v1/projects/{ref}/database/backups`.
- Supabase PITR restore API / CLI for timestamp-based restore.

Current read-only evidence:

```bash
supabase backups list --project-ref lvnvkpyxtuilhrabtlwv
```

Output:

```json
{
  "region": "ap-southeast-1",
  "walg_enabled": true,
  "pitr_enabled": false,
  "backups": [],
  "physical_backup_data": {},
  "message": ""
}
```

Restore command help was inspected read-only:

```bash
supabase backups restore --help
```

Observed restore shape:

```text
Restore to a specific timestamp using PITR
supabase backups restore --project-ref <ref> --timestamp <unix_timestamp>
```

No restore command was executed.

## Why `NO_AVAILABLE_RESTORE_POINT` Is True

The production Supabase backup listing returns:

```text
pitr_enabled = false
backups = []
physical_backup_data = {}
```

That means the current read-only evidence does not contain:

- a completed backup entry;
- a PITR recovery window;
- earliest / latest physical backup timestamps;
- a successful restore rehearsal tied to this production project.

Therefore:

```text
NO_AVAILABLE_RESTORE_POINT = TRUE
BACKUP_RESTORE_READINESS = BLOCKED_NOT_VERIFIED
```

## Existing Valid Restore Point

```text
EXISTING_VALID_RESTORE_POINT = NOT_FOUND
```

Based on the current Supabase Management / CLI backup listing, there is no listed completed backup and no PITR window for project `lvnvkpyxtuilhrabtlwv`.

## Repository / CI Evidence Checked

### `scripts/backup-database.sh`

This script is scoped to Decision Engine logical dumps only.

It dumps:

```text
policy_registry
decision_audit_logs
decision_metrics
rule_version_history
workflow_definitions
workflow_executions
```

It does not prove a full production Supabase backup, PITR window, or restore point for the Bella production database.

### `scripts/run-staging-dr-drill.ts`

This is a staging DR drill utility. It explicitly warns not to run against production database services and requires manual isolated DR steps.

It is useful as a drill primitive, but it is not executed production restore-point evidence.

### `.github/workflows/deploy-production.yml`

This workflow validates, builds, smokes an immutable preview, promotes it, and samples production health.

It does not:

- list Supabase backups;
- verify PITR;
- create or prove a restore point;
- execute a restore drill.

### `.github/workflows/production-cron-smoke.yml`

This workflow runs accounting worker and business-rule production smoke checks.

It does not prove backup / restore readiness.

## Required Evidence To Change Status

Minimum evidence to move out of `BLOCKED_NOT_VERIFIED`:

```text
Supabase production project lvnvkpyxtuilhrabtlwv has a valid restore point.
```

Acceptable evidence:

- Supabase Dashboard or Management API evidence showing at least one completed backup in `backups[]`; or
- PITR enabled with a valid earliest/latest recovery window in `physical_backup_data`; and
- read-only rerun of `supabase backups list --project-ref lvnvkpyxtuilhrabtlwv` showing the same evidence.

For a stronger production-integrity claim, require a non-production restore rehearsal:

- restore to an isolated clone / staging drill target;
- verify data read-back and tenant integrity;
- record RTO / RPO;
- prove no production mutation occurred during verification.

## Available Evidence

```text
Production project health = ACTIVE_HEALTHY
walg_enabled = true
pitr_enabled = false
backups = []
physical_backup_data = {}
deploy workflow health checks = PRESENT
cron smoke workflow = PRESENT
Decision Engine logical backup script = PRESENT
staging DR drill utility = PRESENT
```

Available evidence does not satisfy restore-point readiness.

## Missing Evidence

```text
completed Supabase production backup = MISSING
valid PITR recovery window = MISSING
physical backup earliest/latest restore timestamps = MISSING
production restore-point proof = MISSING
isolated restore rehearsal = MISSING
RTO/RPO evidence = MISSING
```

## Minimal Next Action

Ops / Platform owner must do one of the following outside this code slice:

1. Provide current Supabase Dashboard / Management API evidence showing a valid completed backup or PITR recovery window for `lvnvkpyxtuilhrabtlwv`; or
2. Enable / configure an authorized Supabase backup or PITR mechanism for the production project, then provide the evidence; or
3. Create an authorized non-production restore rehearsal from the valid backup / PITR source and provide read-back, RTO, and RPO evidence.

Then rerun read-only preflight:

```bash
supabase backups list --project-ref lvnvkpyxtuilhrabtlwv
```

Only after that passes should any production-safe field verification be considered.

## Explicit Non-Actions

```text
DO_NOT_MODIFY_HOSPITAL_CODE = TRUE
DO_NOT_MODIFY_PRODUCT_CODE = TRUE
DO_NOT_CREATE_PR_FOR_CODE_FIX = TRUE
DO_NOT_RUN_PRODUCTION_RESTORE = TRUE
DO_NOT_MUTATE_PRODUCTION = TRUE
DO_NOT_DECLARE_PRODUCTION_INTEGRITY_PASS = TRUE
DO_NOT_DECLARE_GO_LIVE_READY = TRUE
```

## Source References

- Supabase Database Backups: `https://supabase.com/docs/guides/platform/backups`
- Supabase List Backups API: `https://supabase.com/docs/reference/api/v1-list-all-backups`
- Supabase Restore PITR API: `https://supabase.com/docs/reference/api/v1-restore-pitr-backup`

## Verification

```text
READ_ONLY_SUPABASE_PROJECTS_LIST = PASS
READ_ONLY_SUPABASE_BACKUPS_LIST = PASS_CONFIRMS_BLOCKER
READ_ONLY_SUPABASE_RESTORE_HELP = PASS
REPO_BACKUP_SCRIPT_TRACE = PASS
DEPLOY_WORKFLOW_TRACE = PASS
CRON_SMOKE_WORKFLOW_TRACE = PASS
STAGING_DR_DRILL_TRACE = PASS
PRODUCTION_MUTATION = NOT_PERFORMED
```

Final status:

```text
BACKUP_RESTORE_READINESS = BLOCKED_NOT_VERIFIED
PRODUCTION_INTEGRITY = BLOCKED
ROOT_CAUSE = NO_AVAILABLE_RESTORE_POINT
OWNER = PLATFORM / OPS / SUPABASE PRODUCTION CONFIGURATION
MINIMAL_NEXT_ACTION = OBTAIN_VALID_RESTORE_POINT_EVIDENCE_THEN_RERUN_READ_ONLY_PREFLIGHT
```
