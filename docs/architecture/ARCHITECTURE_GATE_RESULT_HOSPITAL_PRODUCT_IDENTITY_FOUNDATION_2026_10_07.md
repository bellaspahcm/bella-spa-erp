# ARCHITECTURE GATE RESULT — Hospital Product Identity + Foundation Ownership

Date: 2026-10-07

Status: **PASS_FOR_PRODUCT_IDENTITY_ONLY**

Parent baseline: `docs/architecture/ARCHITECTURE_GATE_RESULT_HOSPITAL_FOUNDATION_CHAIN_2026_10_07.md`

## Scope

This gate narrows the previous Hospital Foundation baseline to one implementation-safe slice:

```text
Product Identity
  -> ProductRegistry
  -> product key
  -> default route
  -> navigation profile
  -> resolver tests
```

This gate does **not** authorize Hospital UI, DB, Healthcare Kernel, direct `hc_*` access, Real DB proof, Browser E2E, or Finance chain implementation.

## Product Manifest

```text
productKey: bella_hospital
displayName: Bella Hospital
subtitle: Hospital Management
requiredModules: healthcare
serviceProfile: hospital
defaultRoute: /dashboard/hospital
navigationProfile: hospital
```

Result: **PASS_FOR_PRODUCT_IDENTITY_ONLY**

Rationale:

- Product identity belongs to Platform Product Registry.
- The existing Product Registry already supports identity-only registration without runtime DB wiring.
- `requiredModules: healthcare` records Healthcare OS dependency without implying Finance chain readiness.
- Finance remains deferred until service-charge/invoice/payment/AR/ledger mapping is proven.

## Foundation Ownership Map

| Capability / Data | Owner | Hospital Role | Current Decision |
| --- | --- | --- | --- |
| Product key / product definition | Platform Product Registry | Consume | PASS |
| Tenant product resolution | Platform Product Resolver | Consume | PASS for mocked resolver path |
| Default route / navigation profile | Product Identity | Declare | PASS |
| Facility / Department | Healthcare Encounter/Bed context or Platform org context TBD | Consume only | BLOCKED_FOR_CONTRACT_TRACE |
| Staff / Doctor | Platform identity / Healthcare provider context TBD | Consume only | BLOCKED_FOR_CONTRACT_TRACE |
| Patient / Profile | Healthcare Kernel / patient identity capability TBD | Consume only | BLOCKED_FOR_CONTRACT_TRACE |
| Encounter | Healthcare Encounter public contract | Consume | PARTIAL |
| Admission | Healthcare Admission public contract | Consume | PARTIAL |
| Bed / Ward | Healthcare Bed public contract | Consume | PARTIAL |
| RBAC / permissions | Platform auth/RBAC + Healthcare contract auth requirements | Consume | BLOCKED_FOR_RUNTIME_PROOF |
| Billing / AR / Ledger | Finance OS | Consume later | DEFER |

## Contract Dependency Map

Allowed now:

```text
Tenant.product_key
  -> ProductRegistry.get('bella_hospital')
  -> ProductDefinition
```

Deferred:

```text
Hospital Foundation workflow
  -> Patient/Profile contract
  -> Facility/Department contract
  -> Staff/Doctor/provider contract
  -> Real DB tenant/RLS test
  -> Browser E2E
  -> Finance mapping
```

## Change Authority

Authorized by this gate:

- Add `bella_hospital` ProductDefinition to ProductRegistry.
- Add ProductRegistry/ProductResolver tests for Hospital identity.
- Record Foundation ownership decisions and unresolved contract traces.

Not authorized:

- Healthcare Kernel H1-H12 changes.
- New Healthcare public contracts.
- New DB migrations.
- Runtime route/page/action changes.
- Finance chain implementation.
- Migration of legacy direct `hc_*` paths.

## Verification Plan

Required for this slice:

```text
npx jest src/platform/registry/__tests__/product-registry.test.ts src/platform/registry/__tests__/product-resolver.test.ts --runInBand
git diff --check
```

Not claimed by this slice:

```text
npm run healthcare:verify
Real DB PASS
Browser E2E PASS
Finance chain PASS
Full Hospital vertical chain PROVEN
```

## Decision

**PASS_FOR_PRODUCT_IDENTITY_ONLY**

The next implementation-safe action is product identity registration and resolver proof only. Foundation ownership remains mapped but not fully sealed until patient/profile, provider/staff, facility/department, RBAC, and runtime DB boundaries are traced to canonical contracts.
