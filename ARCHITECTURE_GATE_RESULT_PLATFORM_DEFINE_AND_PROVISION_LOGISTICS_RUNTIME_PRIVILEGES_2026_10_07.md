# ARCHITECTURE GATE RESULT - PLATFORM DEFINE AND PROVISION LOGISTICS RUNTIME PRIVILEGES - 2026-10-07

## Gate Status

```text
PLATFORM_DEFINE_LOGISTICS_RUNTIME_ROLE = PASS
DB_APPLY_AUTHORIZED = YES_BY_USER_TURN
WAREHOUSE_CODE_ACTION = STOP
```

This artifact started as audit/design for:

```text
PLATFORM_DEFINE_AND_PROVISION_LOGISTICS_RUNTIME_PRIVILEGES
```

No Warehouse runtime code or Logistics Kernel files were changed.

One additive Platform migration was added and applied to `.env.test` canonical
DB:

```text
supabase/migrations/20261007090000_platform_logistics_runtime_privileges.sql
```

The migration is guarded: databases without the sealed `logistics` schema or
required Logistics tables record the migration without creating Logistics
objects. Canonical Logistics databases with the schema deployed receive the
minimum `authenticated` grants and RLS policy alignment.

## Starting Context

```text
WAREHOUSE = STOP

CANONICAL_LOGISTICS_DB_ACCESS = PASS_DIRECT_POSTGRES_ENV_TEST
STOCK_IN_CANONICAL_PERSISTENCE = PASS
STOCK_IN_READ_BACK = PASS

REAL_DB_RLS = NOT_PROVEN

AUTHENTICATED_AS_BELLA_RUNTIME_ROLE = LIKELY_YES
AUTHENTICATED_AS_LOGISTICS_RUNTIME_ROLE = NOT_READY
CUSTOM_LOGISTICS_RUNTIME_ROLE_REQUIRED = NOT_PROVEN
CREATE_NEW_ROLE = NO
```

## Evidence Sources

### Bella Runtime Role Pattern

Repository evidence indicates Bella's normal Supabase RLS runtime pattern is
`authenticated`, with service role reserved for privileged setup/cleanup or
server-only bypass contexts:

```text
tests/utils/test-jwt-helper.ts
  Phase 3C uses anon key + tenant JWT (enforces RLS)
  JWT role = authenticated | anon
  client uses NEXT_PUBLIC_SUPABASE_ANON_KEY

tests/utils/e2e-test-setup.ts
  tenant clients use createAuthenticatedClient
  service_role is used for setup/cleanup

src/lib/supabase-server.ts
  production SSR client uses public key + cookies

src/lib/supabase-service-client.ts
  service role client is server-side only and bypasses RLS
```

Finance RLS tests also use:

```text
SET LOCAL role = authenticated
SET LOCAL request.jwt.claims = ...
```

### Logistics Persistence and RLS Source

The canonical Logistics domain kernel migration defines:

```text
logistics.items
logistics.locations
logistics.inventory
logistics.inventory_movements
logistics.traceability
```

RLS policies use:

```text
tenant_id = current_setting('app.tenant_id')::uuid
```

Runtime DB catalog confirms:

```text
logistics.items = RLS enabled, owner postgres
logistics.locations = RLS enabled, owner postgres
logistics.inventory = RLS enabled, owner postgres
logistics.inventory_movements = RLS enabled, owner postgres
logistics.traceability = RLS enabled, owner postgres
```

### Current Supabase Exposure

Current Supabase config exposes:

```text
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]
```

`logistics` is not exposed through PostgREST in the current config. Prior
runtime probe returned:

```text
REST logistics.items = PGRST106 Invalid schema: logistics
REST logistics.locations = PGRST106 Invalid schema: logistics
REST logistics.inventory = PGRST106 Invalid schema: logistics
REST logistics.inventory_movements = PGRST106 Invalid schema: logistics
REST logistics.traceability = PGRST106 Invalid schema: logistics
```

### Current Role and Grants

Catalog audit found non-bypass roles, but none with effective privileges on the
canonical Logistics tables:

```text
RLS_NON_BYPASS_ROLE_EXISTS = YES
RLS_NON_BYPASS_ROLE_WITH_LOGISTICS_PRIVILEGE = NO

anon = no logistics schema USAGE, no SELECT/INSERT/UPDATE/DELETE
authenticated = no logistics schema USAGE, no SELECT/INSERT/UPDATE/DELETE
authenticator = no logistics schema USAGE, no SELECT/INSERT/UPDATE/DELETE
bella_developer = no logistics schema USAGE, no SELECT/INSERT/UPDATE/DELETE
cli_login_postgres = no logistics schema USAGE, no SELECT/INSERT/UPDATE/DELETE
verification_executor = no logistics schema USAGE, no SELECT/INSERT/UPDATE/DELETE

postgres = owner/full privileges, but rolbypassrls = true
service_role = rolbypassrls = true
supabase_admin = rolbypassrls = true
```

`SET ROLE` probe:

```text
SET ROLE anon = PASS, SELECT logistics.items = FAIL 42501
SET ROLE authenticated = PASS, SELECT logistics.items = FAIL 42501
SET ROLE authenticator = PASS, SELECT logistics.items = FAIL 42501
SET ROLE bella_developer = FAIL 42501
SET ROLE cli_login_postgres = FAIL 42501
SET ROLE verification_executor = FAIL 42501
```

## Canonical Runtime Role Decision

```text
CANONICAL_RUNTIME_ROLE = authenticated
CONFIDENCE = PROVEN_FOR_ENV_TEST_RLS_PROOF
CUSTOM_LOGISTICS_RUNTIME_ROLE_REQUIRED = NOT_PROVEN
CREATE_NEW_ROLE = NO
```

Rationale:

```text
Bella's Supabase runtime and RLS test patterns consistently use authenticated.
No repository evidence proves a separate canonical Logistics runtime role.
Creating bella_logistics_runtime now would be premature and test-driven role drift.
```

After the Platform migration, `authenticated` is ready for the tested direct
PostgreSQL RLS path. PostgREST exposure for `logistics` remains not required and
not enabled for this proof.

## Minimum Logistics Privilege Design

This Platform proposal was implemented by:

```text
supabase/migrations/20261007090000_platform_logistics_runtime_privileges.sql
```

### Schema

```text
GRANT USAGE ON SCHEMA logistics TO authenticated
```

### Stock-In Runtime Reads

```text
logistics.items = SELECT
logistics.locations = SELECT
```

Reason:

```text
Stock-In validates canonical item and location/bin authority.
Stock-In runtime does not need to create or edit item/location master data.
```

### Stock-In Canonical Mutation

```text
logistics.inventory = SELECT, INSERT, UPDATE
logistics.inventory_movements = SELECT, INSERT
logistics.traceability = SELECT, INSERT, UPDATE
```

Reason:

```text
inventory needs read current balance, create first balance, update existing balance.
inventory_movements is append/read for receipt movement evidence.
traceability needs create lot/serial evidence and may need update to append custody events.
```

### Explicitly Not Proposed

```text
GRANT ALL ON SCHEMA logistics = NO
GRANT ALL ON ALL TABLES IN SCHEMA logistics = NO
items INSERT/UPDATE = NO for Stock-In proof
locations INSERT/UPDATE = NO for Stock-In proof
inventory_movements UPDATE/DELETE = NO for append-only movement proof
traceability DELETE = NO
```

### Sequence / Identity / Trigger Dependencies

Catalog audit:

```text
IDs use gen_random_uuid()
No sequence/identity privileges identified as required for the five Stock-In tables.
```

Triggers:

```text
logistics.items UPDATE -> update_updated_at_column()
logistics.locations UPDATE -> update_updated_at_column()
logistics.inventory UPDATE -> update_updated_at_column()
logistics.traceability UPDATE -> update_updated_at_column()
logistics.inventory_movements has no update trigger found in the audited catalog.
```

These triggers do not create a separate privilege requirement for the proposed
Stock-In table privileges, but Platform should verify function availability in
the official provisioning migration.

### Function / RPC Privileges

Catalog and source audit did not find a Logistics Stock-In RPC path:

```text
LOGISTICS_STOCK_IN_RPC = NOT_FOUND
LOGISTICS_SECURITY_DEFINER_STOCK_IN_PATH = NOT_FOUND
LOGISTICS_SECURITY_INVOKER_STOCK_IN_PATH = NOT_FOUND
```

Therefore the current minimum privilege design is table-level, unless Platform
chooses to introduce an official RPC/runtime boundary in a later Platform
design step.

## Tenant Context Injection

### Required Chain

```text
authenticated JWT
  -> public.get_auth_tenant_id()
  -> tenant_id
  -> PostgreSQL RLS
```

### Current Evidence

```text
TENANT_CONTEXT_SOURCE = authenticated JWT app_metadata.tenant_id
RLS_POLICY_INPUT = public.get_auth_tenant_id()
APP_TENANT_ID_INJECTION_PATH = NOT_REQUIRED_FOR_MINIMAL_FIX
TENANT_CONTEXT_TRUST_BOUNDARY = PROVEN_FOR_DIRECT_PG_AUTHENTICATED_ROLE_PROOF
```

Source scan found Bella's canonical `public.get_auth_tenant_id()` path already
exists and is used elsewhere. The minimal fix aligns Logistics RLS with that
existing canonical tenant source instead of inventing a new tenant-context
framework.

Supabase config still does not expose `logistics` through PostgREST and does not
define a pre-request hook to set `app.tenant_id`. That path is not required for
the current direct PostgreSQL proof.

This must not be replaced by:

```text
client supplied tenant_id -> SET app.tenant_id
```

unless the tenant is validated by a trusted server/database boundary first.

## RLS Tenant A/B Proof

Executed against `.env.test` canonical DB after applying the Platform migration:

```text
runId = 20261007142400-6f1dfb75
current_user = authenticated
rolbypassrls = false
Tenant A get_auth_tenant_id = <TENANT_A_UUID_REDACTED_FOR_CI>
Tenant B get_auth_tenant_id = <TENANT_B_UUID_REDACTED_FOR_CI>
```

Tenant A:

```text
item read = 1
location read = 1
Stock-In inventory write = PASS
quantity_on_hand = 23.7500
movement_status = COMPLETED
traceability compliance_status = COMPLIANT
custody_event_count = 1
```

Tenant B negative proof:

```text
read Tenant A inventory rows = 0
update Tenant A inventory rows = 0
insert Tenant A inventory = DENIED 42501
```

Cleanup:

```text
cleanup = PASS
```

## Official Provisioning Path

```text
OFFICIAL_PROVISIONING_PATH = ADDITIVE_PLATFORM_MIGRATION
DB_APPLY_AUTHORIZED = YES_BY_USER_TURN
```

Repository evidence shows normal database changes live in migrations, but this
audit does not establish an already-approved Platform migration/configuration
for Logistics runtime grants plus trusted tenant-context injection.

The likely official path is:

```text
Platform-reviewed additive migration/configuration
  -> grant minimum Logistics privileges to authenticated or approved runtime role
  -> implement/provision trusted app.tenant_id injection mechanism
  -> verify role is non-bypass
  -> run tenant A/B RLS proof
```

The path was applied only after explicit user direction to proceed with the
minimum sufficient fix.

## Final Output

```text
PLATFORM_DEFINE_LOGISTICS_RUNTIME_ROLE = PASS
CANONICAL_RUNTIME_ROLE = authenticated
CONFIDENCE = PROVEN_FOR_ENV_TEST_RLS_PROOF

MINIMUM_LOGISTICS_PRIVILEGES =
  SCHEMA logistics: USAGE
  logistics.items: SELECT
  logistics.locations: SELECT
  logistics.inventory: SELECT, INSERT, UPDATE
  logistics.inventory_movements: SELECT, INSERT
  logistics.traceability: SELECT, INSERT, UPDATE

TENANT_CONTEXT_SOURCE = authenticated JWT app_metadata.tenant_id
TENANT_CONTEXT_TRUST_BOUNDARY = PROVEN_FOR_DIRECT_PG_AUTHENTICATED_ROLE_PROOF
APP_TENANT_ID_INJECTION = NOT_REQUIRED_FOR_MINIMAL_FIX
RLS_POLICY_INPUT = public.get_auth_tenant_id()

OFFICIAL_PROVISIONING_PATH = ADDITIVE_PLATFORM_MIGRATION
DB_APPLY_AUTHORIZED = YES_BY_USER_TURN

NEXT_REQUIRED_CAPABILITY =
  RLS_ENFORCED_STOCK_IN_REAL_DB_PROOF = COMPLETE
```

## Verification

```text
REAL_DB_PLATFORM_MIGRATION_APPLY_ENV_TEST = PASS
AUTHENTICATED_MINIMUM_PRIVILEGE_CHECK = PASS
RLS_POLICY_INPUT_CHECK = PASS
TENANT_A_STOCK_IN_RLS_PROOF = PASS
TENANT_B_NEGATIVE_RLS_PROOF = PASS
CLEANUP = PASS

npm run arch:guard = PASS
npm run logistics:verify = PARTIAL_NOT_VERIFIED
  arch:guard substep = PASS
  jest logistics regression = NOT_VERIFIED (local worktree missing jest command)

npm run typecheck:changed = NOT_VERIFIED
  script exited 0, but TypeScript compiler module was missing

trailing_whitespace_check = PASS
git_diff_check = PASS
changed_file_no_any_check = PASS
```

## Stop Decision

```text
STOP
```

Reason:

```text
Authenticated is Bella's minimal runtime role for the tested Logistics direct PG
path, minimum Stock-In privileges are provisioned, RLS is enforced through
public.get_auth_tenant_id(), and tenant A/B proof passed.
```

No additional Platform role/framework work is required for the current Stock-In
RLS proof.
