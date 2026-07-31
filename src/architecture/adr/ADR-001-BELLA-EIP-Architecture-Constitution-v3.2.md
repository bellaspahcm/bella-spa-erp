# ADR-001: BELLA EIP Enterprise Architecture Constitution v3.2

* Status: Approved & Ratified
* Date: 2026-07-31
* Deciders: Enterprise Architecture Team & BELLA ERP Technical Lead

## Context and Problem Statement
BELLA EIP is evolving from a single-industry Beauty Spa & BabyCare application into a Multi-Vertical Enterprise Industry Platform supporting diverse sectors (Beauty Spa, Real Estate, Academy, Retail, Logistics). We must establish strict architectural boundaries to prevent cross-module pollution, guarantee production stability for existing verticals, and enable seamless multi-tenant scalability.

## Decision Drivers
1. **Production Safety First**: `beauty_spa` and `babycare` are under **Architectural Freeze** (zero structural refactoring), while remaining 100% open for business updates and bug fixes.
2. **Platform Never Knows Business**: Platform Core contains ZERO business rules, ZERO business entities, and ZERO industry-specific `if/else` conditionals.
3. **DDD Bounded Context Ownership**: Business domains, customers, CRMs, inventory, and workflows belong strictly to Vertical Modules (`src/modules/<vertical>/contexts/`).
4. **Pragmatic Evolution**: Build minimal, high-value components first (Event Bus, Minimal Runtime), avoiding early over-engineering.

## Constitutional Principles

### Principle 1 — Production Safety & Business Continuity
Existing production verticals are locked against architectural restructuring, but remain open for feature fixes, UI improvements, and reporting updates.

### Principle 12 — Platform Owns Capabilities, Verticals Own Business
Platform owns `Auth`, `RBAC`, `Inbox Platform`, `Assignment Engine`, `Workflow Engine`, `Event Bus`, `Observability`, `Audit`, `Layout Engine & Widget Host`. Verticals own `Customer`, `CRM`, `Lead`, `Product`, `Inventory`, `Contract`, `Booking`, `Invoice`, `Commission`, `Policies`.

### Principle 13 — Platform Never Knows Business
Platform Core only provides capabilities. Platform contains zero business rules, zero entities, and zero industry-specific data.

### Principle 14 — Strict Dependency Direction
- `Platform` ONLY depends on `Kernel` and `Infrastructure`.
- `Platform` NEVER imports or depends on any `Module`.
- `Module` communicates with `Platform` exclusively through Versioned **Platform Contracts** (`platform/contracts/v1/`).
- `Plugin` NEVER imports any `Module` directly.

### Principle 15 — Minimal Runtime Resolution
Runtime resolves `Tenant ➔ Manifest ➔ Theme ➔ Navigation ➔ Enabled Modules` in a minimal, pragmatic pipeline.

### Principle 16 — Stable Contracts, Evolving Implementations
Platform guarantees Contract stability (`v1/`, `v2/`). Modules and Plugins evolve internal implementations freely without breaking Platform contracts.

## Architecture Fitness Functions (CI Automation)
- `Circular Dependencies = 0`
- `Cross-Module Direct Imports = 0`
- `Platform -> Module Dependencies = 0`
- `Plugin -> Module Dependencies = 0`
- `Public API Backward Compatibility = Active`
