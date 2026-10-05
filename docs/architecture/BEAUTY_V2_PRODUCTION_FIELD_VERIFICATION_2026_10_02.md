# Beauty V2 Production Field Verification

Date: 2026-10-02
Project ref: `lvnvkpyxtuilhrabtlwv`
Scope: Production verification tenant creation and Beauty V2 field verification
Status: `BLOCKED_ON_PRODUCTION_H8_SCHEMA`

> Superseded status note, 2026-10-05:
> Read-only production H8 preflight later proved that the current 6-table Beauty H8 runtime schema is present on production for project `lvnvkpyxtuilhrabtlwv`.
> The old 8-table expectation in this document is stale because `beauty_customer_histories` and `beauty_service_commitments` are not part of the current exact H8 migration/runtime contract.
> Current blocker is backup / restore-point readiness, not missing current H8 runtime schema.
> See `docs/architecture/ARCHITECTURE_GATE_RESULT_BEAUTY_V2_PRODUCTION_H8_READ_ONLY_PREFLIGHT_2026_10_05.md`.

## Target Identity

```text
Production project = lvnvkpyxtuilhrabtlwv
Verification tenant = Beauty V2 Go-Live Verification
Verification branch = Main Branch
```

## Created Production Verification Data

Read-back confirmed:

| Entity | ID | Status |
| --- | --- | --- |
| Tenant | `cf5be9d3-60f2-41e0-bb78-ff2a4f337c67` | PASS |
| Branch | `1f7b3cfc-4292-4c6d-ba98-4eec818ed7a8` | PASS |
| Admin user | `276841df-75d2-4000-b050-e00905c2984c` | PASS |
| Staff user | `1fd4d0e3-bdf9-43eb-adac-c6e681402044` | PASS |
| Service/package | `2bc70201-85f0-41a0-afc8-af4b21a6f047` | PASS |
| Resource/room | `45297f2a-54d8-4fa7-874e-022bab689dbc` | PASS |
| Customer | `80f043b7-b0a5-43f6-80ca-bcd86627d736` | PASS |

Tenant isolation read-back:

```text
Tenant parent = Bella Spa Headquarter
Branch parent = Beauty V2 Go-Live Verification
All minimal users/package/resource/customer rows tenant_id = Main Branch
Verification marker exists only on the verification tenant and branch
```

## Field Verification Attempt

Beauty V2 field verification was attempted through:

```text
BeautySpaV2Service
-> Beauty OS H8 repository ports
-> Supabase Beauty H8 tables
```

First production workflow step:

```text
Create booking
```

Result:

```text
BLOCKED
```

Runtime evidence:

```text
create beauty appointment:
Could not find the table 'public.beauty_appointments' in the schema cache
```

Database metadata read-back confirmed the H8 tables are absent from production:

```text
beauty_appointments=false
beauty_customer_histories=false
beauty_professional_assignment_history=false
beauty_professional_assignments=false
beauty_resource_allocation_history=false
beauty_resource_allocations=false
beauty_service_commitments=false
beauty_sessions=false
```

## Classification

```text
Tenant / branch creation      PASS
Minimal verification data     PASS
Create booking                BLOCKED
Duplicate/conflict booking    NOT_RUN
Resource concurrency          NOT_RUN
Session start                 NOT_RUN
Session completion            NOT_RUN
Controlled failure            NOT_RUN
Rollback                      NOT_RUN
Immutable history             BLOCKED_BY_MISSING_H8_SCHEMA
Tenant isolation              PASS_FOR_CREATED_SEED_DATA
Final read-back               PARTIAL
```

## Boundary Decision

This is not a Beauty V2 code failure and not a reason to reopen Beauty V2
runtime implementation. Technical readiness remains based on PR `#190` and the
E2E Real DB proof.

Production business go-live is blocked because the production database target
does not currently contain the Beauty OS H8 persistence tables required by the
sealed Beauty V2 runtime contract.

No migration was run in this scope.
No Finance OS work was opened.
No existing production tenant was modified.

## Final Status

```text
BEAUTY_V2_TECHNICAL_READINESS = READY
BEAUTY_V2_PRODUCTION_TENANT_CREATED = PASS
BEAUTY_V2_BUSINESS_FIELD_VERIFICATION = BLOCKED_ON_PRODUCTION_H8_SCHEMA
BEAUTY_V2_GO_LIVE = NOT_VERIFIED
```
