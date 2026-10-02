# Platform API Gateway Architecture Gate Result

Date: 2026-10-03
Worktree: platform-api-gateway
Branch: codex/platform-api-gateway
Scope: Audit existing API Gateway capability before any Beauty V2 integration or platform extraction.

## 1. Bella OS/Product Development Process Gate

Result for this audit scope: PASS

Result for runtime implementation or Beauty V2 routing change: DEFER

Reason: the repository already contains an API Gateway capability, but current evidence proves only the existing external partner API surface and supporting middleware. It does not yet prove a generalized product route-registration contract suitable for Beauty V2 or future verticals.

## 2. Problem / Non-Goals

Problem: determine whether existing Legacy BabyCare / Beauty Spa API Gateway evidence should be lifted into a shared Platform API Gateway capability instead of creating a Beauty V2-specific gateway.

Non-goals:
- No Beauty V2 business logic changes.
- No Healthcare H1-H12 Kernel changes.
- No Education Kernel changes.
- No Logistics frozen artifact changes.
- No new gateway runtime, route registry, database table, or API contract in this audit step.

## 3. Product Manifest

Product / capability under audit: Platform API Gateway.

Candidate platform capability:
- Authenticate external API requests.
- Resolve tenant context from trusted credentials, not client-provided tenant_id.
- Authorize by API scopes.
- Route versioned APIs.
- Enforce rate limits.
- Preserve sandbox / production separation.
- Log API request audit evidence and operational metrics.

Beauty V2 intended consumption, not implementation in this step:

```text
Client -> Bella API Gateway -> Beauty V2 API -> Beauty Service -> DB
Beauty V2 -> Finance Contract/Outbox -> Finance OS
```

## 4. Ownership Map

| Data / Capability | Owner | Evidence | Current conclusion |
| --- | --- | --- | --- |
| API Gateway capability | Platform / Integration & Connectivity | `docs/02-capabilities/CAPABILITY_MAP.md` lists API Gateway as Live / All | Platform-owned capability exists at map level |
| Edge gateway topology | Platform Infrastructure | `docs/04-services/TECHNICAL_ARCHITECTURE.md` places Cloudflare WAF -> External API Gateway (Kong) -> Next.js App Instances | Infrastructure gateway is documented |
| Partner identity / API keys | Platform API Gateway | `src/types/api-gateway.ts`, `src/services/api-gateway/partner.service.ts`, `supabase/migrations/20260617000000_api_gateway_partner_management.sql` | Existing external partner API identity model |
| API request audit logs | Platform API Gateway | `api_request_logs`, `log_api_request` RPC, `src/lib/middleware/api-key.middleware.ts` | Existing request audit path |
| Tenant context | Platform Core | `docs/architecture/tenant-context.md`, `src/core/middleware/tenantContext.ts` | Session/API tenant context exists, but has two distinct paths |
| Beauty / BabyCare business APIs | Product / Beauty OS / legacy Spa | Current `/api/v1/*` routes query spa-era tables such as `orders`, `customers`, `session_logs`, `revenue`, `expenses` | Existing gateway endpoints are not proven to be Beauty V2 route contracts |

## 5. Contract Dependency Map

Current proven external partner API path:

```text
Partner Client
  -> /api/v1/*
  -> withSandbox()
  -> withAPIKey()
  -> validate_api_partner RPC
  -> PartnerContext { partner_id, tenant_id, allowed_scopes, is_sandbox }
  -> route handler
  -> Supabase service-role client, public/sandbox schema
  -> response wrapper + log_api_request RPC
```

Current documented general platform path:

```text
Client Request
  -> Authentication Middleware
  -> Tenant Context Middleware
  -> API Route Handler
  -> Core Services
  -> Database query with tenant filter / RLS
```

Gap for Beauty V2:

```text
Bella API Gateway
  -> route registration / API contract
  -> Beauty V2 API
  -> Beauty service contract
```

The route registration / API contract layer is not yet proven as a reusable platform contract for product verticals.

## 6. Change Authority

Authorized in this scope:
- Create isolated worktree and branch.
- Audit existing gateway evidence.
- Produce architecture gate / audit document.

Not authorized in this scope:
- Runtime gateway implementation.
- Product routing changes.
- Database migrations.
- Beauty V2 business logic changes.
- Legacy BabyCare / Beauty Spa refactor.
- Healthcare, Education, Logistics kernel or frozen artifact changes.

## 7. UI -> Contract Reconciliation

No Product UI redesign or data/action-bound UI change is requested in this step.

Status: NOT_APPLICABLE.

## 8. Additive Migration Plan

No migration is authorized for the audit step.

If later implementation is approved, any migration must be additive only and must first prove whether existing `api_partners`, `api_request_logs`, `api_rate_limit_counters`, and sandbox schema already satisfy the platform contract.

## 9. Existing Evidence Inventory

Proven existing artifacts:
- Capability map marks API Gateway live for all industries.
- Technical architecture documents Cloudflare WAF and External API Gateway (Kong).
- API Gateway types define partner, scopes, rate-limit tiers, request logs, and standardized responses.
- API key middleware validates API keys through `validate_api_partner`, resolves tenant from partner, blocks tenant injection, supports IP whitelist, and logs requests.
- Scope middleware enforces resource/action scopes with wildcard support.
- Rate-limit middleware exists with Redis-backed distributed limits and degraded mode.
- Sandbox middleware routes `pk_test_` / sandbox partners to sandbox schema and adds environment headers.
- `/api/v1/overview`, `/api/v1/orders`, and `/api/v1/analytics` are current partner API examples.
- Migrations create `api_partners`, `api_request_logs`, `api_rate_limit_counters`, `generate_api_key`, `validate_api_partner`, sandbox support, and `log_api_request`.

Observed constraints / gaps:
- `withSandbox()` currently authenticates and logs, but does not invoke `rateLimitMiddleware`; rate limiting exists separately and is not proven universal for current `/api/v1/*` routes.
- `/api/v1/analytics` performs an inline scope check instead of using `requireScope`, which suggests inconsistent enforcement.
- `/api/v1/orders` and `/api/v1/overview` rely on direct table queries and spa-era table names, not a product route contract registry.
- Middleware contains local typed adapters/casts around API Gateway tables/RPCs due to generated type drift notes; this is not a new-code pattern to extend blindly.
- External Kong/WAF is documented, but repository evidence does not prove current deployed Kong route configuration.
- Beauty V2 API contract / route registration is not found in this audit pass.

## 10. 11 Automated Verification Gates Plan

For audit only:
1. Architecture compliance: read governance constitution and scope locks.
2. Contract boundary discovery: inspect docs, middleware, routes, migrations.
3. Tenant isolation review: verify tenant is resolved from partner context, not client input.
4. RLS / authorization review: inspect gateway migration policies and scope middleware.
5. Migration safety review: no migration in this step.
6. Event-after-persistence review: not applicable to audit; future write routes must prove it.
7. Policy/rule routing review: not applicable to gateway audit unless a route invokes domain rules.
8. Temporal provenance review: not applicable to this platform gateway audit.
9. Rule governance review: not applicable to this audit.
10. Audit evidence review: inspect `api_request_logs` and `log_api_request`.
11. Regression plan: future implementation must run focused API gateway tests plus relevant product/vertical gates.

## 11. Decision

Checkpoint seal:

```text
Platform API Gateway Audit = PASS
Reusable Vertical Gateway Contract = NOT_PROVEN
Platform Extraction = DEFER
Beauty V2 Gateway Integration = NOT_REQUIRED
API Gateway Branch = SEALED
```

Audit decision: PASS.

Runtime/platform extraction decision: DEFER.

Architecture conclusion:

```text
ARCHITECTURAL GAP DETECTED: reusable Platform API Gateway route-registration contract for Product Verticals is not proven yet.
```

This is not evidence for creating a Beauty V2-specific gateway. The correct next step is to standardize the existing Platform API Gateway contract and prove how products register routes/contracts into it.

Beauty V2 current path remains:

```text
Client
  -> Existing API / Service boundary
  -> Beauty V2
  -> DB
```

Do not force Beauty V2 into an unproven gateway abstraction. Future work should begin only when a real requirement appears, such as Beauty V2 needing to expose APIs to an external partner.

Isolation note:

```text
API Gateway audit = SEALED
Production Cron Smoke / accounting_ledger = separate triage
```

The `accounting_ledger` production critical path must not reopen API Gateway or Beauty V2. If that issue is not proven to belong to Beauty V2, keep all Beauty V2 checkpoints sealed and triage `accounting_ledger` in its own scope.

Beauty V2 checkpoint status:

```text
Product scope = SEALED
Payroll/Commission = SEALED
Inventory = SEALED
Finance = SEALED
API Gateway = SEALED / DEFER extraction
Production-wide = accounting_ledger critical remains separate
```

Recommended next scope:

```text
platform-api-gateway-contract-discovery
```

Minimum next questions:
- Is Kong actually deployed/configured, or is Next.js middleware the current effective gateway?
- Which `/api/v1/*` endpoints are production partner APIs versus legacy examples?
- What is the canonical route registration contract?
- Should gateway scopes remain generic (`order:read`) or become product/capability scoped?
- How should session-based product APIs and partner API-key APIs share tenant context without mixing trust models?
- Where should Beauty V2 register its routes without owning gateway infrastructure?
