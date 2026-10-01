# Architecture Gate Result - Broader Any Batch C1

Ngay 2026-09-30

## Ket luan

STATUS: PASS

Scope:

- `src/components/intelligence/customer/CustomerActivityChart.tsx`
- `src/components/intelligence/customer/LtvByCohortChart.tsx`
- `src/components/intelligence/customer/LtvDistributionChart.tsx`

## Product Manifest

Shared/customer intelligence UI charts.

Capability:

- Render chart tooltip content for customer analytics.

## Ownership Map

Owner: Shared UI / Intelligence presentation component.

Data owner remains upstream intelligence service/query contract. This batch does not change query shape, API, DB, or service behavior.

## Contract Dependency Map

```text
Customer intelligence query output
  -> local chartData mapping
  -> Recharts tooltip payload
  -> tooltip presentation
```

Canonical contract for this batch:

- Local chart data shape in each component.
- Recharts tooltip runtime convention: `active`, `payload`.

## Change Authority

Allowed:

- Replace tooltip `any` props with local typed props.
- Add local type aliases/interfaces.

Not allowed:

- Change chart data semantics.
- Change query/service contracts.
- Change generated DB types.
- Change domain behavior.
- Touch Logistics, Finance/Core, Real Estate residual, Healthcare, Education, or `next.config.ts`.

## UI -> Contract Reconciliation

| UI element | UI expectation | Canonical contract | Conclusion |
|---|---|---|---|
| Customer activity tooltip | Display local `level`, `customers`, `avgScore` | Local `chartData` item | MATCH |
| LTV cohort tooltip | Display local `cohort`, `ltv`, `size` | Local `chartData` item | MATCH |
| LTV distribution tooltip | Display local `range`, `count` | Local `chartData` item | MATCH |

## Additive Migration Plan

None.

## Verification Plan

1. Target explicit-any scan on three component files.
2. Targeted ESLint on three component files.
3. `npm run check:any-types` snapshot to confirm delta.
4. `git diff --check`.
