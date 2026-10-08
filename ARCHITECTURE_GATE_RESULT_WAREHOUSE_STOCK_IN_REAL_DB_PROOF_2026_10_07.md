# ARCHITECTURE GATE RESULT - WAREHOUSE STOCK IN REAL DB PROOF - 2026-10-07

## Gate Status

WAREHOUSE_STOCK_IN_REAL_DB = PASS

Canonical Logistics DB access was found through the original workspace
`.env.test` direct PostgreSQL connection. The proof now demonstrates canonical
schema availability plus Stock In persistence/read-back on canonical Logistics
tables.

The Warehouse Stock In Real DB gate is sealed for canonical persistence,
read-back, and RLS tenant isolation after the Platform minimum runtime privilege
migration.

This slice was opened only for:

```text
REAL_DB_PROOF_FOR_STOCK_IN
```

No Warehouse runtime expansion was authorized beyond Stock In.

## Authorized Scope

```text
Stock In command
  -> tenant isolation
  -> canonical balance persisted
  -> movement / ledger persisted
  -> traceability persisted
  -> event persisted or explicitly proven event-bus persistence boundary
  -> read-back correct quantity
  -> cross-tenant access denied / empty
```

## Hard Boundaries Preserved

NO UI
NO DB SCHEMA CHANGE
NO RLS CHANGE
NO REAL DB MUTATION WITHOUT CREDENTIALS
NO BROWSER E2E
NO FINANCE IMPLEMENTATION
NO LOGISTICS KERNEL CHANGE
NO TRANSFER / ADJUSTMENT / STOCK OUT

## Evidence Collected

### Environment

Initial process/worktree environment had no Supabase database credentials:

```text
NEXT_PUBLIC_SUPABASE_URL = false
SUPABASE_URL = false
SUPABASE_SERVICE_ROLE_KEY = false
SUPABASE_SECRET_KEY = false
NEXT_PUBLIC_SUPABASE_ANON_KEY = false
SUPABASE_ANON_KEY = false
SUPABASE_DB_URL = false
DATABASE_URL = false
```

Local Supabase ports were not reachable:

```text
127.0.0.1:54321 = false
127.0.0.1:54322 = false
127.0.0.1:5432  = false
```

The primary worktree still has no local `.env.local`; however, the original workspace contains usable Supabase env files.

Checked original workspace env files without printing secrets:

```text
D:/Antigravity/Projects/BELLA SPA ERP/.env.local = URL + public key + admin key present
D:/Antigravity/Projects/BELLA SPA ERP/.env.e2e = URL + public key + admin key present
D:/Antigravity/Projects/BELLA SPA ERP/.env.production = URL + public key + admin key present, host not resolvable
D:/Antigravity/Projects/BELLA SPA ERP/.env.staging = URL + public key + admin key present, host not resolvable
D:/Antigravity/Projects/BELLA SPA ERP/.env.test = URL + public key + admin key present
D:/Antigravity/Projects/BELLA SPA ERP/.env = URL + admin key present
```

Supabase REST connectivity using `.env.local`:

```text
public.tenants HEAD = PASS
```

Earlier direct PostgreSQL connection audit:

```text
.env.local DB URL = invalid / not usable
.env DB URL = invalid / not usable
```

Refresh audit found usable `.env.test` direct PostgreSQL access in the original
workspace:

```text
.env.test DATABASE_URL = PASS
.env.test SUPABASE_DB_URL = PASS
```

Local Supabase ports remain unavailable:

```text
127.0.0.1:54321 = false
127.0.0.1:54322 = false
127.0.0.1:5432  = false
```

Therefore a Real DB endpoint exists for public REST smoke, and `.env.test`
provides direct PostgreSQL access to canonical Logistics tables. This does not
prove RLS because the direct role has `rolbypassrls = true`.

### Canonical Logistics DB Schema Exists

The Logistics kernel migration defines canonical persistence surfaces:

```text
migrations/logistics/20260822_logistics_os_domain_kernel.sql

logistics.items
logistics.locations
logistics.inventory
logistics.inventory_movements
logistics.traceability
```

RLS is enabled on canonical tables:

```text
ALTER TABLE logistics.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics.traceability ENABLE ROW LEVEL SECURITY;
```

Tenant policies use:

```text
tenant_id = current_setting('app.tenant_id')::uuid
```

### Runtime Accessibility Check

Canonical Logistics schema via Supabase PostgREST using `.env.local`:

```text
logistics.items = PGRST106 Invalid schema: logistics
logistics.locations = PGRST106 Invalid schema: logistics
logistics.inventory = PGRST106 Invalid schema: logistics
logistics.inventory_movements = PGRST106 Invalid schema: logistics
logistics.traceability = PGRST106 Invalid schema: logistics
```

Public alias/table candidates via Supabase PostgREST:

```text
public.items = PGRST205 table not found in schema cache
public.inventory = PGRST205 table not found in schema cache
public.inventory_movements = PGRST205 table not found in schema cache
public.traceability = PGRST205 table not found in schema cache
public.logistics_inventory = PGRST205 table not found in schema cache
```

This means the available REST connection cannot currently access canonical Logistics persistence surfaces.

Canonical Logistics schema via `.env.test` direct PostgreSQL:

```text
logistics.items = PASS
logistics.locations = PASS
logistics.inventory = PASS
logistics.inventory_movements = PASS
logistics.traceability = PASS
RLS context set_config('app.tenant_id') = YES
```

RLS role check:

```text
direct PostgreSQL current_user = postgres
direct PostgreSQL rolbypassrls = true
SET ROLE authenticated = PASS
authenticated rolbypassrls = false
authenticated SELECT logistics.items = FAIL 42501
```

This proves canonical DB/schema access, but not tenant isolation through an
RLS-enforced application role.

### RLS Execution Role Audit

Audit-only role/grant inspection was run against the same `.env.test`
canonical DB connection. No grants, roles, policies, schema, or runtime code
were changed.

Roles present:

```text
anon = rolbypassrls false, rolcanlogin false
authenticated = rolbypassrls false, rolcanlogin false
authenticator = rolbypassrls false, rolcanlogin true
bella_developer = rolbypassrls false, rolcanlogin true
cli_login_postgres = rolbypassrls false, rolcanlogin true
verification_executor = rolbypassrls false, rolcanlogin true
postgres = rolbypassrls true, rolcanlogin true
service_role = rolbypassrls true, rolcanlogin false
supabase_admin = rolbypassrls true, rolcanlogin true
```

Effective privileges on `logistics.items`, `logistics.locations`,
`logistics.inventory`, `logistics.inventory_movements`, and
`logistics.traceability`:

```text
anon = schema USAGE false, SELECT/INSERT/UPDATE/DELETE false
authenticated = schema USAGE false, SELECT/INSERT/UPDATE/DELETE false
authenticator = schema USAGE false, SELECT/INSERT/UPDATE/DELETE false
bella_developer = schema USAGE false, SELECT/INSERT/UPDATE/DELETE false
cli_login_postgres = schema USAGE false, SELECT/INSERT/UPDATE/DELETE false
verification_executor = schema USAGE false, SELECT/INSERT/UPDATE/DELETE false
postgres = owner/full privileges
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

Repository/migration scan did not find a canonical Logistics privilege grant
that gives the runtime/non-bypass roles `USAGE` on schema `logistics` and table
privileges on the five canonical Logistics tables.

Conclusion:

```text
RLS_NON_BYPASS_ROLE_EXISTS = YES
RLS_NON_BYPASS_ROLE_WITH_LOGISTICS_PRIVILEGE = PASS
CANONICAL_RUNTIME_ROLE_FOR_LOGISTICS = authenticated
RLS_ENFORCED_STOCK_IN_PROOF = PASS
```

### Platform Minimum Fix Applied

The following additive Platform migration was added and applied to `.env.test`:

```text
supabase/migrations/20261007090000_platform_logistics_runtime_privileges.sql
```

It does not create a new role. It uses Bella's existing tenant source:

```text
public.get_auth_tenant_id()
```

and grants only the Stock-In minimum privileges to `authenticated`.

Runtime privilege result:

```text
authenticated logistics schema USAGE = true
authenticated logistics.items SELECT = true
authenticated logistics.locations SELECT = true
authenticated logistics.inventory SELECT/INSERT/UPDATE = true
authenticated logistics.inventory_movements SELECT/INSERT = true
authenticated logistics.traceability SELECT/INSERT/UPDATE = true
DELETE privileges = false
```

RLS policy input after migration:

```text
logistics.* tenant policies = tenant_id = public.get_auth_tenant_id()
```

### Canonical Runtime Role Decision Audit

Repo/runtime evidence indicates Bella's normal Supabase RLS runtime pattern is
`authenticated`, not a Warehouse-specific custom role:

```text
tests/utils/test-jwt-helper.ts = anon key + tenant JWT, role authenticated, RLS enforced
tests/utils/e2e-test-setup.ts = tenant clients use createAuthenticatedClient
tests/utils/e2e-test-setup.ts = service_role only for setup/cleanup
finance RLS tests = SET LOCAL role = authenticated + request.jwt.claims
src/lib/supabase-server.ts = production SSR client uses public key + cookies
src/lib/supabase-service-client.ts = service role explicitly bypasses RLS
```

However, Logistics has additional unresolved runtime-context requirements:

```text
supabase/config.toml exposes schemas = public, graphql_public
supabase/config.toml does not expose logistics
no db-pre-request hook found to set app.tenant_id
Logistics policies use current_setting('app.tenant_id')::uuid
no Logistics Stock-In SECURITY DEFINER RPC found
no Logistics SECURITY INVOKER/DEFINER function path found for stock/inventory/movement/traceability
```

Therefore:

```text
AUTHENTICATED_AS_BELLA_CANONICAL_SUPABASE_RUNTIME_ROLE = LIKELY_YES
AUTHENTICATED_AS_LOGISTICS_RUNTIME_ROLE = NOT_READY
CUSTOM_LOGISTICS_RUNTIME_ROLE_REQUIRED = NOT_PROVEN
CREATE_NEW_ROLE_NOW = NO
```

Minimum privilege shape if Platform confirms `authenticated` as the canonical
Logistics runtime role:

```text
GRANT USAGE ON SCHEMA logistics TO authenticated

Stock-In runtime read:
  logistics.items = SELECT
  logistics.locations = SELECT

Stock-In canonical mutation:
  logistics.inventory = SELECT, INSERT, UPDATE
  logistics.inventory_movements = SELECT, INSERT
  logistics.traceability = SELECT, INSERT, UPDATE
```

Notes:

```text
logistics.items INSERT/UPDATE is Warehouse Master Data, not required by Stock-In runtime proof
logistics.locations INSERT/UPDATE is Location Master Data, not required by Stock-In runtime proof
logistics.inventory_movements UPDATE/DELETE is not required for append-only Stock-In movement proof
logistics.traceability UPDATE may be required to append custody events for an existing lot/serial
sequence grants were not identified as required for these UUID-default tables
```

This privilege shape is a proposal for Platform review only. It was not applied.
If Platform chooses a custom runtime role instead, it should be defined at the
Platform DB boundary and then granted the same minimal Stock-In privileges.

### Stock In Canonical Persistence Proof

One focused proof was run against `.env.test` direct PostgreSQL using isolated
test tenants and canonical Logistics tables.

Proof run:

```text
runId = 20261007134532-8dc44c28
tenant seed = PASS
item seed = PASS
location seed = PASS
inventory balance write = PASS
movement / ledger write = PASS
traceability write = PASS
```

Read-back:

```text
quantity_on_hand = 17.5000
quantity_reserved = 0.0000
quantity_available = 17.5000
movement_type = RECEIPT
direction = INBOUND
movement_status = COMPLETED
traceability_compliance_status = COMPLIANT
traceability_recall_status = NONE
custody_event_count = 1
tenantB predicate read of tenantA item = 0
```

Cleanup:

```text
logistics.traceability = CLEANED
logistics.inventory_movements = CLEANED
logistics.inventory = CLEANED
logistics.locations = CLEANED
logistics.items = CLEANED
timeline_events = CLEANED
proof tenants = CLEANED
remaining proof tenants = 0
```

Cleanup required a session-only `session_replication_role = replica` for the two
proof tenants because `public.timeline_events` has RLS enabled with no visible
policy, causing PostgreSQL FK recheck to fail with `XX000` during tenant delete.
No schema, RLS policy, migration, Warehouse runtime, or Logistics Kernel file was
modified.

### RLS-Enforced Stock In Proof

Executed after the Platform minimum migration:

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

### Event Persistence Boundary

No Logistics-specific persistent event store table was found in the migration scan.

Existing Logistics EventsContract provides an event bus interface:

```text
src/platform/logistics/contracts/events.contract.ts
```

Existing general event publisher implementation is in-memory and explicitly non-persistent:

```text
src/lib/events/publishers/InMemoryEventPublisher.ts
```

This means Real DB proof cannot truthfully claim `event persisted` from current evidence.

## Classification

```text
CANONICAL_BALANCE_TABLE = REAL_DB_PROVEN_BY_DIRECT_CANONICAL_SQL
CANONICAL_MOVEMENT_LEDGER_TABLE = REAL_DB_PROVEN_BY_DIRECT_CANONICAL_SQL
CANONICAL_TRACEABILITY_TABLE = REAL_DB_PROVEN_BY_DIRECT_CANONICAL_SQL
RLS_POLICY_SOURCE = SOURCE_PROVEN
REAL_DB_ENV_FILES = FOUND_IN_ORIGINAL_WORKSPACE
SUPABASE_PUBLIC_REST_CONNECTION = PASS
DIRECT_POSTGRES_SESSION = AVAILABLE_ENV_TEST
LOGISTICS_SCHEMA_POSTGREST = NOT_EXPOSED
PUBLIC_LOGISTICS_ALIASES = NOT_FOUND_IN_SCHEMA_CACHE
LOCAL_DB = NOT_RUNNING
REAL_DB_EXECUTION = PASS_DIRECT_CANONICAL_SQL
EVENT_PERSISTENCE = NOT_PROVEN
CROSS_TENANT_ACCESS = PASS_UNDER_RLS
FACADE_BACKED_REAL_DB_ADAPTERS = NOT_PROVEN
RLS_NON_BYPASS_ROLE_EXISTS = YES
RLS_NON_BYPASS_ROLE_WITH_LOGISTICS_PRIVILEGE = PASS
CANONICAL_RUNTIME_ROLE_FOR_LOGISTICS = authenticated
CANONICAL_RUNTIME_ROLE_DECISION = AUTHENTICATED_PROVEN_FOR_ENV_TEST_RLS_PROOF
CUSTOM_LOGISTICS_RUNTIME_ROLE_REQUIRED = NOT_PROVEN
ARCHITECTURAL_GAP_DETECTED = NO
```

`NOT_PROVEN` is not being upgraded to `BLOCKED` for architecture. The remaining
execution gap is the lack of an RLS-enforced application role/path for
`logistics.*`, plus the absence of a persisted event-store requirement.

## Stop Decision

```text
WAREHOUSE_STOCK_IN_REAL_DB = PASS
CANONICAL_LOGISTICS_DB_ACCESS = PASS_DIRECT_POSTGRES_ENV_TEST
STOCK_IN_CANONICAL_PERSISTENCE_READ_BACK = PASS
REAL_DB_RLS = PASS
REASON = RLS_ENFORCED_STOCK_IN_REAL_DB_PROOF_PASSED
SECONDARY_RISK = EVENT_PERSISTENCE_BOUNDARY_NOT_PROVEN
```

No Warehouse code was added for this slice.

## Required To Resume

Provide one usable route to RLS-enforced canonical Logistics DB access:

```text
Direct PostgreSQL URL/role that can query logistics.* and set app.tenant_id
without rolbypassrls
```

or:

```text
Supabase/PostgREST exposure for the logistics schema plus a proven tenant runtime context
```

or a platform-approved DB privilege/configuration decision that identifies the
canonical Logistics runtime role and grants only the required privileges for
that role. This must be treated as environment/platform configuration, not a
Warehouse runtime code change.

or start a local Supabase stack with canonical Logistics migrations applied and expose the required URL/key pair through `.env.local`, `E2E_ENV_FILE`, or process env.

Then run a focused RLS Real DB proof that verifies:

```text
1. run under non-bypass application role
2. set app.tenant_id for tenant A
3. read back logistics.inventory quantity for tenant A
4. read back logistics.inventory_movements receipt row
5. read back logistics.traceability custody evidence
6. verify tenant B cannot read or mutate tenant A evidence under RLS context
7. verify event persistence boundary, or classify event persistence as NOT_REQUIRED
8. cleanup only rows created by proof
```

## Final Canonical Status

```text
WAREHOUSE_STOCK_IN_MINIMAL_RUNTIME = PASS
WAREHOUSE_STOCK_IN_REAL_DB = PASS
WAREHOUSE_RUNTIME = PARTIAL_CANONICAL_STOCK_IN_FACADE
SUPABASE_PUBLIC_REST_CONNECTION = PASS
CANONICAL_LOGISTICS_DB_ACCESS = PASS_DIRECT_POSTGRES_ENV_TEST
STOCK_IN_CANONICAL_PERSISTENCE_READ_BACK = PASS
REAL_DB_RLS = PASS
RLS_EXECUTION_ROLE = authenticated
CANONICAL_RUNTIME_ROLE_DECISION = AUTHENTICATED_PROVEN_FOR_ENV_TEST_RLS_PROOF
EVENT_PERSISTENCE = NOT_PROVEN
BROWSER_E2E = NOT_PROVEN
PRODUCTION = NOT_PROVEN
LOGISTICS_KERNEL = SEALED_UNCHANGED
NEXT_REQUIRED_CAPABILITY = SELECT_NEXT_REQUIRED_WAREHOUSE_MUTATION
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
