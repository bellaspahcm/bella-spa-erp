# REAL ESTATE MODULE - ARCHITECTURE DIAGRAM

## System Context Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                         BELLA ERP PLATFORM                              │
│                                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐ │
│  │   Baby Care │  │  Beauty Spa │  │ Industrial  │  │ Real Estate  │ │
│  │   Module    │  │   Module    │  │  Cleaning   │  │   Module     │ │
│  │             │  │             │  │   Module    │  │  (THIS)      │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └──────────────┘ │
│                                                              │           │
│  ┌──────────────────────────────────────────────────────────┼────────┐ │
│  │            CORE PLATFORM SERVICES                         │        │ │
│  │  - Module Registry     - Lead Engine                     │        │ │
│  │  - Tenant Context      - Activity Stream                 │        │ │
│  │  - IAM Matrix          - State Machine                   │        │ │
│  └──────────────────────────────────────────────────────────┼────────┘ │
│                                                              │           │
│  ┌──────────────────────────────────────────────────────────▼────────┐ │
│  │                    SUPABASE (PostgreSQL + RLS)                     │ │
│  │  - real_estate_projects    - real_estate_products                 │ │
│  │  - re_reservations          - Accounting Outbox                   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```


## Real Estate Module - Internal Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                   REAL ESTATE MODULE LAYERS                               │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ╔═══════════════════════════════════════════════════════════════════╗  │
│  ║         PRESENTATION LAYER (Next.js App Router)                    ║  │
│  ╠═══════════════════════════════════════════════════════════════════╣  │
│  ║                                                                     ║  │
│  ║  /dashboard/real-estate/*                                          ║  │
│  ║                                                                     ║  │
│  ║  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐ ║  │
│  ║  │ Dashboard  │  │   Leads    │  │ Apartments │  │  Contracts │ ║  │
│  ║  │   page     │  │   page     │  │   page     │  │    page    │ ║  │
│  ║  └────────────┘  └────────────┘  └────────────┘  └────────────┘ ║  │
│  ║                                                                     ║  │
│  ║  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐ ║  │
│  ║  │ Customers  │  │  Support   │  │ Documents  │  │ Analytics  │ ║  │
│  ║  │   page     │  │   page     │  │   page     │  │    page    │ ║  │
│  ║  └────────────┘  └────────────┘  └────────────┘  └────────────┘ ║  │
│  ║                                                                     ║  │
│  ║  UI Components:                                                    ║  │
│  ║  • ProjectHeader        • InventoryMatrixGrid                     ║  │
│  ║  • CEODashboardCharts   • LeadSLABadge                            ║  │
│  ║  • LeadTimelineDrawer   • PremiumProjectSelector                  ║  │
│  ║                                                                     ║  │
│  ╚═══════════════════════════════════════════════════════════════════╝  │
│                                 ↓ ↑                                       │
│  ╔═══════════════════════════════════════════════════════════════════╗  │
│  ║         APPLICATION LAYER (Server Actions)                         ║  │
│  ╠═══════════════════════════════════════════════════════════════════╣  │
│  ║                                                                     ║  │
│  ║  actions/                                                          ║  │
│  ║  ├─ projectActions.ts     ← CRUD projects                         ║  │
│  ║  ├─ productActions.ts     ← CRUD apartments/units                 ║  │
│  ║  └─ leadAssignmentActions ← Lead distribution engine              ║  │
│  ║                                                                     ║  │
│  ║  Responsibilities:                                                 ║  │
│  ║  • Input validation                                                ║  │
│  ║  • DTO transformation                                              ║  │
│  ║  • Use case orchestration                                          ║  │
│  ║  • Revalidate Next.js cache                                        ║  │
│  ║                                                                     ║  │
│  ╚═══════════════════════════════════════════════════════════════════╝  │
│                                 ↓ ↑                                       │
│  ╔═══════════════════════════════════════════════════════════════════╗  │
│  ║            DOMAIN LAYER (Business Logic)                           ║  │
│  ║                12 BOUNDED CONTEXTS                                 ║  │
│  ╠═══════════════════════════════════════════════════════════════════╣  │
│  ║                                                                     ║  │

│  ║  ┌──────────────────────────────────────────────────────────────┐ ║  │
│  ║  │ SALES CONTEXT                                                 │ ║  │
│  ║  │ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │ ║  │
│  ║  │ │   Booking    │  │   Deposit    │  │   Contract   │       │ ║  │
│  ║  │ │  Aggregate   │  │  Aggregate   │  │  Aggregate   │       │ ║  │
│  ║  │ └──────────────┘  └──────────────┘  └──────────────┘       │ ║  │
│  ║  │ • FSM: DRAFT→PENDING→CONFIRMED                              │ ║  │
│  ║  │ • Payment schedule generation                                │ ║  │
│  ║  │ • Commission calculation                                     │ ║  │
│  ║  └──────────────────────────────────────────────────────────────┘ ║  │
│  ║                                                                     ║  │
│  ║  ┌──────────────────────────────────────────────────────────────┐ ║  │
│  ║  │ CRM CONTEXT                                                   │ ║  │
│  ║  │ • Investor profiles                                           │ ║  │
│  ║  │ • Lead assignment engine                                      │ ║  │
│  ║  │ • SLA governance (Accept: 30min, Call: 2hrs, Qualify: 24hrs) │ ║  │
│  ║  │ • Auto-rotation on breach                                     │ ║  │
│  ║  └──────────────────────────────────────────────────────────────┘ ║  │
│  ║                                                                     ║  │
│  ║  ┌──────────────────────────────────────────────────────────────┐ ║  │
│  ║  │ RESERVATION CONTEXT                                           │ ║  │
│  ║  │ • Pessimistic locking (15min timeout)                         │ ║  │
│  ║  │ • Prevents double booking                                     │ ║  │
│  ║  │ • RPC: reserve_product()                                      │ ║  │
│  ║  └──────────────────────────────────────────────────────────────┘ ║  │
│  ║                                                                     ║  │
│  ║  ┌──────────────────────────────────────────────────────────────┐ ║  │
│  ║  │ FINANCE CONTEXT                                               │ ║  │
│  ║  │ • Payment schedules                                           │ ║  │
│  ║  │ • Installment tracking                                        │ ║  │
│  ║  │ • Accounting outbox (double-entry bookkeeping)                │ ║  │
│  ║  └──────────────────────────────────────────────────────────────┘ ║  │
│  ║                                                                     ║  │
│  ║  ┌──────────────────────────────────────────────────────────────┐ ║  │
│  ║  │ PRICING CONTEXT                                               │ ║  │
│  ║  │ • Dynamic pricing engine                                      │ ║  │
│  ║  │ • Floor/view premiums                                         │ ║  │
│  ║  │ • Early bird discounts                                        │ ║  │
│  ║  └──────────────────────────────────────────────────────────────┘ ║  │
│  ║                                                                     ║  │
│  ║  ┌──────────────────────────────────────────────────────────────┐ ║  │
│  ║  │ INVENTORY CONTEXT                                             │ ║  │
│  ║  │ • Apartment catalog                                           │ ║  │
│  ║  │ • Availability matrix                                         │ ║  │
│  ║  │ • Unit specifications                                         │ ║  │
│  ║  └──────────────────────────────────────────────────────────────┘ ║  │
│  ║                                                                     ║  │
│  ║  ┌──────────────────────────────────────────────────────────────┐ ║  │
│  ║  │ SUPPORT CONTEXT                                               │ ║  │
│  ║  │ • Complaint ticket FSM                                        │ ║  │
│  ║  │ • SLA tracking                                                │ ║  │
│  ║  │ • Activity stream integration                                 │ ║  │
│  ║  └──────────────────────────────────────────────────────────────┘ ║  │
│  ║                                                                     ║  │
│  ║  + Marketing, Contract, Asset, Product Catalog contexts          ║  │
│  ║                                                                     ║  │
│  ╚═══════════════════════════════════════════════════════════════════╝  │
│                                 ↓ ↑                                       │
│  ╔═══════════════════════════════════════════════════════════════════╗  │
│  ║         SHARED KERNEL (Platform Patterns)                          ║  │
│  ╠═══════════════════════════════════════════════════════════════════╣  │
│  ║                                                                     ║  │
│  ║  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐ ║  │
│  ║  │   State    │  │   Domain   │  │   Policy   │  │Specification│ ║  │
│  ║  │  Machine   │  │ Event Bus  │  │   Engine   │  │   Pattern  │ ║  │
│  ║  └────────────┘  └────────────┘  └────────────┘  └────────────┘ ║  │
│  ║                                                                     ║  │
│  ║  • FSM: Type-safe state transitions                                ║  │
│  ║  • Events: Decoupled communication                                 ║  │
│  ║  • Policies: Dynamic business rules                                ║  │
│  ║  • Specs: Reusable validation logic                                ║  │
│  ║                                                                     ║  │
│  ╚═══════════════════════════════════════════════════════════════════╝  │
│                                 ↓ ↑                                       │
│  ╔═══════════════════════════════════════════════════════════════════╗  │
│  ║         INFRASTRUCTURE LAYER (Supabase + Platform)                 ║  │
│  ╠═══════════════════════════════════════════════════════════════════╣  │
│  ║                                                                     ║  │
│  ║  ┌────────────────────────────────────────────────────────────┐  ║  │
│  ║  │  SUPABASE (PostgreSQL + RLS)                                │  ║  │
│  ║  │  ┌──────────────────┐  ┌──────────────────┐               │  ║  │
│  ║  │  │ real_estate_     │  │ real_estate_     │               │  ║  │
│  ║  │  │   projects       │  │   products       │               │  ║  │
│  ║  │  └──────────────────┘  └──────────────────┘               │  ║  │
│  ║  │  ┌──────────────────┐  ┌──────────────────┐               │  ║  │
│  ║  │  │ re_reservations  │  │ accounting_      │               │  ║  │
│  ║  │  │                  │  │   outbox         │               │  ║  │
│  ║  │  └──────────────────┘  └──────────────────┘               │  ║  │
│  ║  │                                                             │  ║  │
│  ║  │  RPC Functions:                                            │  ║  │
│  ║  │  • reserve_product(tenant_id, product_id, duration)        │  ║  │
│  ║  └────────────────────────────────────────────────────────────┘  ║  │
│  ║                                                                     ║  │
│  ║  ┌────────────────────────────────────────────────────────────┐  ║  │
│  ║  │  PLATFORM SERVICES                                          │  ║  │
│  ║  │  • Activity Stream (in-memory event log)                    │  ║  │
│  ║  │  • Lead Engine (SLA timers, rotation)                       │  ║  │
│  ║  │  • Module Registry (self-registration)                      │  ║  │
│  ║  │  • IAM Matrix (permission checks)                           │  ║  │
│  ║  └────────────────────────────────────────────────────────────┘  ║  │
│  ║                                                                     ║  │
│  ╚═══════════════════════════════════════════════════════════════════╝  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```


## Booking Flow Sequence Diagram

```
┌─────┐         ┌──────┐         ┌────────┐         ┌─────────┐         ┌──────┐
│User │         │ UI   │         │Actions │         │ Domain  │         │  DB  │
└──┬──┘         └──┬───┘         └───┬────┘         └────┬────┘         └──┬───┘
   │                │                 │                   │                  │
   │ Click "Book"   │                 │                   │                  │
   │───────────────>│                 │                   │                  │
   │                │ reserveProduct()│                   │                  │
   │                │────────────────>│                   │                  │
   │                │                 │ RPC: reserve_     │                  │
   │                │                 │    product()      │                  │
   │                │                 │───────────────────────────────────>│
   │                │                 │                   │                  │
   │                │                 │ Lock acquired    │                  │
   │                │                 │<───────────────────────────────────│
   │                │ Reservation ID  │                   │                  │
   │                │<────────────────│                   │                  │
   │ Show countdown │                 │                   │                  │
   │<───────────────│                 │                   │                  │
   │                │                 │                   │                  │
   │                │  [15min timer running...]           │                  │
   │                │                 │                   │                  │
   │ Confirm Booking│                 │                   │                  │
   │───────────────>│                 │                   │                  │
   │                │ createBooking() │                   │                  │
   │                │────────────────>│                   │                  │
   │                │                 │ new Booking       │                  │
   │                │                 │  Aggregate()      │                  │
   │                │                 │──────────────────>│                  │
   │                │                 │                   │                  │
   │                │                 │     state: DRAFT  │                  │
   │                │                 │<──────────────────│                  │
   │                │                 │                   │                  │
   │                │                 │ transition(SUBMIT)│                  │
   │                │                 │──────────────────>│                  │
   │                │                 │                   │                  │
   │                │                 │ state: PENDING    │                  │
   │                │                 │<──────────────────│                  │
   │                │                 │                   │                  │
   │                │                 │ save to DB        │                  │
   │                │                 │───────────────────────────────────>│
   │                │                 │                   │                  │
   │                │                 │ emit event:       │                  │
   │                │                 │ booking.created   │                  │
   │                │                 │──────────────────>│                  │
   │                │                 │                   │ Activity Stream  │
   │                │                 │                   │─────────────────>│
   │                │ Success         │                   │                  │
   │                │<────────────────│                   │                  │
   │ Show success   │                 │                   │                  │
   │<───────────────│                 │                   │                  │
   │                │                 │                   │                  │
```


## Lead Assignment Flow

```
┌──────┐         ┌─────────┐         ┌───────────┐         ┌─────────┐
│Lead  │         │ Lead    │         │   SLA     │         │Activity │
│Entry │         │ Engine  │         │   Timer   │         │ Stream  │
└──┬───┘         └────┬────┘         └─────┬─────┘         └────┬────┘
   │                  │                     │                     │
   │ New lead arrives │                     │                     │
   │─────────────────>│                     │                     │
   │                  │                     │                     │
   │                  │ Select agent        │                     │
   │                  │ (rotation algo)     │                     │
   │                  │                     │                     │
   │                  │ Assign lead         │                     │
   │                  │                     │                     │
   │                  │ Start SLA timer     │                     │
   │                  │────────────────────>│                     │
   │                  │                     │                     │
   │                  │ Log: lead.assigned  │                     │
   │                  │─────────────────────────────────────────>│
   │                  │                     │                     │
   │                  │        [30min countdown for ACCEPT]       │
   │                  │                     │                     │
   │                  │<───── Breach! ──────│                     │
   │                  │                     │                     │
   │                  │ Auto-rotate to      │                     │
   │                  │ next agent          │                     │
   │                  │                     │                     │
   │                  │ Start new timer     │                     │
   │                  │────────────────────>│                     │
   │                  │                     │                     │
   │                  │ Log: sla.breached   │                     │
   │                  │─────────────────────────────────────────>│
   │                  │                     │                     │
```


## Data Flow Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                          DATA FLOWS                                     │
├────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────┐      Read         ┌─────────────────┐                     │
│  │   UI   │ ────────────────> │  Server Actions │                     │
│  └────────┘      Write         └─────────────────┘                     │
│      ↑              ↓                   ↑                               │
│      │              │                   │                               │
│      │              ↓                   ↓                               │
│      │       ┌──────────────────────────────────┐                      │
│      │       │      Domain Aggregates           │                      │
│      │       │  • BookingAggregate              │                      │
│      │       │  • DepositAggregate              │                      │
│      │       │  • ContractAggregate             │                      │
│      │       └──────────────────────────────────┘                      │
│      │                       │                                          │
│      │                       │ emit events                              │
│      │                       ↓                                          │
│      │       ┌──────────────────────────────────┐                      │
│      │       │      Domain Event Bus            │                      │
│      │       │  • booking.created               │                      │
│      │       │  • deposit.paid                  │                      │
│      │       │  • contract.signed               │                      │
│      │       └──────────────────────────────────┘                      │
│      │                       │                                          │
│      │                       │ subscribers                              │
│      │                       ↓                                          │
│      │       ┌─────────────────────┬─────────────────────┐            │
│      │       │                     │                     │            │
│      │       ↓                     ↓                     ↓            │
│      │  ┌─────────┐         ┌───────────┐        ┌──────────┐       │
│      │  │Activity │         │Accounting │        │  Lead    │       │
│      │  │ Stream  │         │  Outbox   │        │  Engine  │       │
│      │  └─────────┘         └───────────┘        └──────────┘       │
│      │       │                     │                     │            │
│      │       │ audit log           │ double-entry        │ rotation   │
│      │       ↓                     ↓                     ↓            │
│      │  ┌──────────────────────────────────────────────────┐         │
│      │  │              SUPABASE DATABASE                    │         │
│      │  │  • real_estate_projects                          │         │
│      │  │  • real_estate_products                          │         │
│      │  │  • re_reservations                               │         │
│      │  │  • accounting_journal                            │         │
│      │  │  • activity_log                                  │         │
│      │  └──────────────────────────────────────────────────┘         │
│      │                       │                                          │
│      └───────────────────────┘ read for display                        │
│                                                                          │
└────────────────────────────────────────────────────────────────────────┘
```

