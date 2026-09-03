# Migration Governance Forensics - 2026-08-31

Status: P0 migration governance reconciliation checkpoint.

## Guardrails

- Remote database was confirmed by the owner as the official Bella test/pre-production target with no customers.
- Remote mutations were limited to migration-history reconciliation and one forward-only RPC completion migration.
- Remote migration history was backed up before mutation in `docs/architecture/MIGRATION_REMOTE_HISTORY_BACKUP_2026_08_31.json`.
- Local migration hygiene was canonicalized with `git mv` where filenames/versions prevented meaningful drift analysis.
- No application data migration or destructive schema rollback was performed.

## Closed local hygiene layers

### Invalid filenames

The following legacy 8-digit migration filenames were renamed to Supabase-compatible 14-digit timestamps while preserving dependency order:

| Old | New | Rationale |
| --- | --- | --- |
| `20260820_r4_approval_contract.sql` | `20260820150000_r4_approval_contract.sql` | R4 approval base contract first |
| `20260820_r4_3_gate_tokens.sql` | `20260820151000_r4_3_gate_tokens.sql` | Depends on approval contract |
| `20260820_r4_4_monitoring_audit.sql` | `20260820152000_r4_4_monitoring_audit.sql` | Depends on R4 gate/audit objects |
| `20260821_create_freight_audit_tables.sql` | `20260821120000_create_freight_audit_tables.sql` | Logistics freight invoice base tables first |
| `20260821_create_carrier_rates_table.sql` | `20260821121000_create_carrier_rates_table.sql` | Logistics rate table |
| `20260821_create_accessorial_rates_table.sql` | `20260821122000_create_accessorial_rates_table.sql` | Logistics accessorial rate table |
| `20260821_create_discrepancies_table.sql` | `20260821123000_create_discrepancies_table.sql` | Depends on freight invoice and line item tables |

### Duplicate local versions

The following duplicate version collisions were resolved locally:

| Previous duplicate | Canonical result | Rationale |
| --- | --- | --- |
| `20260824070000_f2_bank_account_gl_map_contract.sql` and `20260824070000_f2_opening_balance_provenance.sql` | Keep `20260824070000_f2_bank_account_gl_map_contract.sql`; rename provenance to `20260824070500_f2_opening_balance_provenance.sql` | F5.6 migrations immediately call `finance_bank_account_gl_map`; provenance remains before `20260824071000` |
| `20260826154323_phase4b3_verification_rpc.sql` and `20260825120000_test_scenario3_db_only.sql` | Keep `20260826154323_phase4b3_verification_rpc.sql`; archive test scenario 3 as `archive/20260825110000_test_scenario3_db_only.sql.ARCHIVED` | Git history records Phase 4B.3 RPC functions as deployed evidence; scenario 3 is a test-routing artifact |

## Reconciliation actions

### Schema-present local-only versions marked applied

Remote schema inspection showed the R4, Logistics, and Finance objects for the following local-only migrations already existed on the test/pre-production database. These versions were marked applied in migration history:

```text
20260820150000
20260820151000
20260820152000
20260821120000
20260821121000
20260821122000
20260821123000
20260824000000
20260824040000
20260824050000
20260824060000
20260824070500
```

### Remote-generated 2026-08-26 versions aligned locally

The five `202608261543xx` remote records were classified as legitimate generated/manual history entries for the healthcare hardening batch and the corresponding local files were renamed to match remote history:

```text
20260826154323
20260826154332
20260826154338
20260826154348
20260826154354
```

### Test-routing migrations archived

The following migration files were moved to `supabase/migrations/archive/` because schema reality did not show product-schema objects requiring application, and the files are test-routing artifacts rather than canonical product migrations:

```text
20260825110000_test_scenario3_db_only.sql.ARCHIVED
20260825120001_test_scenario4_mixed.sql.ARCHIVED
```

### Legacy invalid remote history rows removed

Supabase CLI could not repair the seven old non-14-digit history records because its parser rejects those versions before executing `migration repair`. After backup and schema/history confirmation, the seven legacy rows were deleted directly from `supabase_migrations.schema_migrations`:

```text
20260820_r4_3_gate_tokens
20260820_r4_4_monitoring_audit
20260820_r4_approval_contract
20260821_create_accessorial_rates_table
20260821_create_carrier_rates_table
20260821_create_discrepancies_table
20260821_create_freight_audit_tables
```

### Forward-only RPC completion

Remote schema reality showed Phase 4B.3 verification RPC support was partial:

```text
query_tables        present
query_table_exists  present
query_columns       present
query_rls_status    present
query_primary_key   missing
query_foreign_keys  missing
query_rls_policies  missing
```

Migration `20260831040000_phase4b3_query_rpc_completion.sql` was added and applied with `supabase db push --linked --yes`. Supabase reported only that migration was applied.

Post-apply schema reality confirms all seven query RPCs now exist.

## Current `db:migration:check` state

After reconciliation:

- Local latest migration: `20260831040000`
- Remote latest migration: `20260831040000`
- Invalid local filenames: closed
- Duplicate local versions: closed
- Local/remote drift: closed
- Result: PASS, `Supabase migrations are in sync.`

## Decision

P0 migration governance is closed for the test/pre-production target.

Remaining production-readiness work is not migration history reconciliation. It is now the normal verification sequence: full type-check, OS-level regression, full regression, and evidence/documentation convergence.

## Verification performed

- `npm.cmd run security:secrets` - PASS
- `npm.cmd run security:audit` - PASS
- `npm.cmd run db:migration:check` - PASS
- `npm.cmd run arch:guard` - PASS
- `git diff --check` - PASS
- `npm.cmd test -- src/__tests__/supabase-migration-check.test.ts --runInBand` - PASS, 7/7
- Targeted lint for changed checker/security files - PASS
- Remote schema query for Phase 4B.3 verification RPCs - PASS, 7/7 query RPCs present

Broad lint over old reconciliation scripts was not used as a P0 gate because those scripts contain pre-existing `any` and unused-variable lint debt unrelated to migration identity canonicalization.

## Security note - DB URL exposure during schema evidence attempt

During the authorized evidence-acquisition attempt, local `.env`, `.env.local`, and `.env.test` files were found to contain database connection URLs. These files are not tracked by Git, but the values must be treated as exposed because they appeared in command output during this investigation.

Immediate remediation performed:

- Redacted `SUPABASE_DB_URL`, `SUPABASE_DATABASE_URL`, and `DATABASE_URL` in local env files.
- Expanded `scripts/check-secret-leaks.mjs` to scan `.env`, `.env.local`, and `.env.test` in addition to env templates/config files.
- Added DB URL variable names to the blocking secret scanner.
- Re-ran `npm.cmd run security:secrets` - PASS.

Operational requirement:

- Rotate the exposed database credentials.
- Keep the local env files redacted.
- Do not treat the exposed DB URLs as acceptable long-term credentials even though the target is test/pre-production.