# Beauty Spa Chain Expansion Deferred Plan

> Status: Deferred until Bella Spa and the first Beauty Spa tenant are stable, accurate, and regression-guarded.
> Created: 2026-06-11
> Purpose: Preserve the commercial expansion plan for Beauty Spa chains without starting implementation too early.

## Intent

This plan captures the future model where one Beauty Spa customer can buy a package that includes:

- one main spa entity
- multiple child spa branches
- one brand identity shared across that customer's network
- separate branch operations and data
- consolidated management for the main spa owner

This is not part of the current stabilization scope. The immediate priority remains keeping Bella Spa and the current Beauty Spa tenant accurate, isolated, and reliable.

## Current System Capability

The current system can already support Beauty Spa tenants as independent businesses:

- HQ can create a Beauty Spa tenant.
- The tenant can have its own admin account.
- The tenant can use Beauty Spa module copy, service categories, and branding.
- Tenant data is scoped by tenant and must not leak into Bella Spa.
- Bella Spa and Beauty Spa use shared ERP foundations, but their business data must stay separate.

This is sufficient for independent single-location Beauty Spa operation.

## Deferred Gap

The current system should not yet be sold as a full chain-management package without additional work. The missing chain-level pieces are:

- explicit parent-child relationship between main spa and branches
- branch quota in subscription packages
- permissions for a main-spa admin to manage only their own child branches
- branch selector and group-scoped reporting
- safe cross-branch workflows limited to that customer group
- tests proving Bella Spa and other Beauty Spa tenants are not visible inside the group

## Non-Negotiable Isolation Rules

When this plan is implemented later:

- Bella Spa must never see Beauty Spa business data.
- One Beauty Spa customer must never see another Beauty Spa customer's data.
- A main-spa admin must not receive HQ/global privileges.
- Child-branch admins should only see their own branch unless explicitly granted group access.
- Email identity alone is not a data boundary; tenant and access scope must define the boundary.
- Module key must still be granted only by HQ.

## Future Commercial Model

### Package Example

Package: Beauty Chain Starter

- 1 main spa
- up to 3 child branches
- shared brand identity
- branch-level admins
- owner/admin view across the chain
- consolidated dashboard and reports
- branch-level booking, customer, staff, inventory, and revenue operations

### Setup Flow

1. HQ creates the main Beauty Spa tenant.
2. HQ configures package limits, brand identity, billing, and module key.
3. HQ creates child branches and links them to the main spa.
4. HQ creates or invites branch admins.
5. The main spa owner receives group-level access, scoped only to their own chain.
6. Child admins receive branch-level access only.

## Minimal Implementation Scope Later

Do only the minimum needed for safe chain operation:

1. Tenant hierarchy
   - Persist a parent-child relationship for Beauty Spa branches.
   - Allow HQ to choose a parent spa when creating a child branch.

2. Branch quota
   - Add a subscription quota for number of branches.
   - Block creation when the package limit is reached.

3. Group-scoped access
   - Add a small access model for main-spa admins.
   - Main-spa admins can view/manage only child tenants under their parent spa.
   - Do not reuse HQ role for this.

4. Branch selector
   - Add UI scope: all branches, main branch, or one child branch.
   - Default child admins to their own branch.

5. Group reports
   - Revenue, booking, customer, salary, inventory, and finance summaries must accept an explicit scoped tenant list.
   - No report should accidentally query every tenant.

6. Tests
   - Prove Bella Spa data is not visible to Beauty Spa chain users.
   - Prove Beauty Spa A cannot see Beauty Spa B.
   - Prove branch admin cannot see sibling branches.
   - Prove main-spa admin sees only its own branches.
   - Prove package branch limit is enforced.

## What Not To Do

- Do not give a customer main-spa admin the HQ role.
- Do not use the same email account across unrelated tenants without an explicit membership/switching model.
- Do not make a generic multi-industry chain engine before the Beauty Spa flow is stable.
- Do not move Bella Spa operational data into a shared group scope.
- Do not add cross-branch accounting or inventory flows until tenant/group scoping is locked by tests.

## Readiness Gate Before Starting

This plan should only move from deferred to active when all of these are true:

- Bella Spa production workflows are stable.
- Beauty Spa first tenant no longer shows Bella/Babycare copy leakage.
- Beauty Spa light/dark UI has acceptable contrast and no first-paint theme flash.
- Tenant isolation source guards pass.
- Finance, booking, session, salary, payment, and customer flows have focused regression coverage.
- Demo Beauty data can be created and removed safely.
- There is no open production bug related to cross-tenant visibility.

## Future Implementation Artifact

When work starts, create a focused spec under `docs/implementation-artifacts/`, for example:

`docs/implementation-artifacts/spec-add-beauty-spa-chain-tenant-hierarchy.md`

The spec must include:

- exact tables/columns touched
- access rules
- HQ setup flow
- user roles
- UI scope selector
- query guards
- test plan
- rollback plan

## Deferred Handoff

This document is intentionally a plan only. It should help future development without pushing the current project into premature expansion.

Current priority:

1. stabilize Bella Spa
2. stabilize the first Beauty Spa tenant
3. remove cross-module UI/data leakage
4. lock critical business rules with tests
5. only then build chain expansion
