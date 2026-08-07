# Volume 7: Architecture Repository & Living Architecture

This document defines the **Architecture Repository & Living Architecture** (Volume 7) of the Bella EIP platform. It establishes the file hierarchy conventions, automated fitness scorecard, platform maturity framework, and localized Country Pack standards.

---

## 📂 1. Enterprise Architecture Repository Structure

Bella EIP maps its architectural documents directly to the TOGAF Architecture Repository (AR) layout.

```
docs/
├── 00-vision/               # TOGAF Phase A: Architecture Vision & Strategic Drivers
├── 01-architecture/         # TOGAF Phase B/C/D: Reference Architecture Constitution Laws
├── 02-capabilities/         # Business Capability Maps & BRM Catalogs
├── 03-domain/               # Bounded Context Maps, DDD Aggregates & Ubiquitous Language
├── 04-services/             # Technology Reference Models & Technical Deployment Topologies
├── 05-adr/                  # Architectural Decision Records (ADR, BDR, SDR, TDR, AIDR)
├── 06-industries/           # Industry Specific Specifications (Healthcare, Beauty, AI Graph)
└── 07-implementation/       # Living Architecture, Health Scorecards, Maturity & Country Packs
```

---

## 📊 2. Platform Health Scorecard

The platform's architectural compliance is evaluated continuously. Every quarterly assessment updates the `arch_maturity_scores` table, measuring six critical dimensions:

| Dimension | Target Score | Metric / Acceptance Criteria | Check Frequency |
|---|---|---|---|
| **Architecture** | $\ge 9.5 / 10$ | 100% compliance with 11 Constitution Laws (Zero regression, RLS) | Every PR (Gate 1) |
| **Security** | $\ge 9.0 / 10$ | 0 High/Critical vulnerability in SAST/Trivy scans, Active RLS | Daily build (Gate 2) |
| **Performance** | $\ge 8.5 / 10$ | API response time $< 200\text{ms}$ (average under simulated load) | Monthly release (Gate 3) |
| **Quality** | $\ge 9.0 / 10$ | 100% passing rate in all 180+ critical system integration tests | Every commit (Gate 6) |
| **Observability**| $\ge 8.0 / 10$ | All domain events logged, active autopilot cron notifications | Weekly scan |
| **AI Governance**| $\ge 8.5 / 10$ | 100% AI recommendations log prompt cost ledger, audit trails | Weekly scan |

---

## 📈 3. 5-Level Platform Maturity Model

The Bella EIP advances through 5 distinct maturity phases to ensure secure, stable, and managed growth.

```
[Level 1: Monolith] ──> [Level 2: Modular Monolith] ──> [Level 3: Platform Layer] ──> [Level 4: Enterprise] ──> [Level 5: Ecosystem]
```

1. **Level 1: Monolith (Legacy)**: Single database, tight coupling between UI and business rules, no multi-tenant isolation standards.
2. **Level 2: Modular Monolith (Current)**: Explicit boundary separation between core engines and industry packs. Zero regression policy enforced on `beauty_spa` and `babycare`.
3. **Level 3: Platform Capability Layer (Target 2026)**: Introduction of unified runtimes (Workflow, Policy, Event bus). Modules are opt-in capabilities registered in `platform_industry_packs`.
4. **Level 4: Enterprise Scale (Target 2027)**: Complete multi-tenant isolation validation, multi-datacenter deployment configurations, and automated FinOps token calculation.
5. **Level 5: Ecosystem Platform (Long-Term)**: Open API marketplace enabling third-party developers to register custom Industry Packs and Country Packs.

---

## 🌍 4. Country Pack Localization Framework

To expand across international markets, the platform separates business logic from country-specific regulations using the **Country Pack Registry**.

```
Platform Core ──> [Vietnam Country Pack] ──> BHYT XML 130 + Circular 133 Ledger Accounting
              ──> [Singapore Country Pack] ──> PDPA Compliance + GST 9% Invoicing
              ──> [Malaysia Country Pack]  ──> SST Tax + Localized Healthcare Claims
              ──> [Japan Country Pack]     ──> Shakai Hoken Claims + Localized Payment Gateways
```

Every localized capability must register its country codes in `platform_industry_packs.country_packs` to ensure that country-specific APIs and workflows do not leak to other geographical scopes.
