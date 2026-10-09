# BELLA HOSPITALITY - TENANT CONFIGURATION / BUSINESS PROFILES

DATE = 2026-10-09
BRANCH = feature/hospitality-tenant-profiles
BASELINE = origin/main @ 52681d367d6be779bb09418cc8681a02ff32a523
GATE = PASS
SCOPE = MINIMAL_ADDITIVE_TENANT_CONFIGURATION

## Bella OS / Product Development Process Gate

Problem: `bella_hospitality` needs Bella-governed tenant configuration so an authorized provisioning operator can select a supported accommodation business profile at tenant creation.

Non-goals:
- No new Hospitality OS.
- No four separate products or ProductRegistry keys.
- No F&B, Travel/Tourism, OTA/channel management, lease management, or shared Resource Kernel.
- No reopening sealed Hospitality phases 0-7.
- No Go-Live or production-readiness claim.

Truth / Source of Truth:
- Product identity source: `src/platform/registry/product-registry.ts`.
- Runtime product resolution source: `src/platform/registry/product-resolver.ts`.
- Current provisioning contract: `src/services/onboarding-actions.ts` using `registerNewTenant` -> `onboard_tenant` RPC -> post-onboarding `tenants` update.
- Tenant persistence schema evidence: generated `Database['public']['Tables']['tenants']` includes `product_key`, `enabled_modules`, and `metadata`.
- Existing HQ provisioning UI: `src/app/hq/components/HqBranchRegistrationModal.tsx`.
- Existing Hospitality sealed baseline: `src/products/bella-hospitality/**` and architecture gates under `docs/architecture/ARCHITECTURE_GATE_RESULT_HOSPITALITY_PHASE*.md`.

Canonical Contract:
- `tenant.product_key = 'bella_hospitality'` remains the single Hospitality product identity.
- Profile selection is product configuration, not product identity.
- Supported profile definitions are Bella-owned static contract data.
- Tenant-specific selection/customization is stored in `tenants.metadata.hospitality` through the existing onboarding post-update path.

Ownership:
- ProductRegistry identity: Platform Registry.
- Tenant creation / post-onboarding setup: Platform onboarding service.
- Hospitality profile semantics: Bella Hospitality product contract.
- Tenant row ownership and isolation: Platform tenant boundary.
- HQ registration modal: UI consumer of the Platform onboarding contract.

Boundary:
- Product -> Platform onboarding contract -> tenants row.
- UI -> `registerNewTenant` only; UI does not own validation or persistence.
- No direct write to Hospitality phase tables for profile setup.
- No direct access to Healthcare, Education, Logistics, or frozen kernels.

Change Authority:
- Authorized: add Hospitality profile contract, extend existing onboarding allowlist and validation, add minimal HQ profile selection UI, add focused tests.
- Not authorized: lower-layer kernel changes, new product identities, global provisioning redesign, unrelated UI routes, sealed phase rewrites.

## Product Manifest

Product: `bella_hospitality`

Profiles:
- `hotel`
- `homestay`
- `serviced_apartment`
- `short_stay_rental`

Supported first-version customization:
- `frontDeskMode`
- `housekeepingCadence`
- `maintenancePriority`

All customization values must be allowlisted by the selected profile.

## Ownership Map

Tenant identity: `tenants.product_key`, Platform-owned.

Tenant configuration: `tenants.metadata.hospitality`, Platform tenant row with Hospitality-owned payload semantics.

Accommodation business flows: existing Hospitality product services and repositories.

Room sellability coordination: existing Housekeeping authority remains unchanged.

## Contract Dependency Map

Provisioning operator selection
-> HQ registration modal
-> `registerNewTenant` input
-> `onboard_tenant` base RPC
-> post-onboarding `tenants` update
-> `tenant.product_key = 'bella_hospitality'`
-> `tenants.metadata.hospitality.profileId/configuration`
-> Hospitality product services continue using existing product tables and public service contracts.

## UI -> Contract Reconciliation

| UI element | Contract status | Decision |
| --- | --- | --- |
| Product option `Bella Hospitality` | MATCH | Existing ProductRegistry key; not a new product fork. |
| Profile selector | MATCH | Uses static Hospitality profile contract. |
| Customizable settings | MATCH | UI sends only allowlisted option keys; server remains authoritative. |
| Unsupported profile/settings | SERVER_REJECTS | UI must not be proof by itself. |

## Additive Migration Plan

No migration is required for the first pass because `tenants.metadata` already exists as JSONB and is present in generated database types. No existing column/table is altered.

## 11 Automated Verification Gates Plan

1. Architecture gate file exists and states `GATE = PASS`.
2. Product identity remains `bella_hospitality`; no new Hospitality ProductRegistry keys.
3. All four profile IDs resolve.
4. Unknown profile IDs are rejected.
5. Unsupported settings are rejected.
6. Incompatible profile/settings combinations are rejected.
7. Onboarding persists `product_key = 'bella_hospitality'`.
8. Onboarding persists profile configuration in `tenants.metadata.hospitality`.
9. Existing onboarding behavior remains compatible when no Hospitality profile is provided.
10. Hospitality phase architecture tests remain green.
11. Real DB/RLS and browser E2E are reported only if executed; otherwise `NOT_PROVEN`.

## Gate Result

PASS for minimal additive implementation.

Reason: existing ProductRegistry, HQ registration modal, and onboarding post-update contract provide a safe extension point. The change does not require kernel modification, new product identities, new schema, sealed phase rewrites, or cross-industry coupling.
