# BELLA ENGINEERING RULES - OS & PRODUCT DEVELOPMENT v2

> Follow Bella Engineering Execution Contract: Evidence -> Truth -> Source of Truth -> Canonical Contract -> Ownership -> Boundary -> Change Authority -> Minimal Implementation -> Verification -> Evidence. Never change a lower-layer contract merely to satisfy a higher-layer consumer, redesigned UI, TypeScript, or CI.

This is the authoritative engineering constitution for Bella OS and Product development. It applies to AI-assisted and human implementation work across Platform, OS, Product, Integration, Shared UI, CI, tests, and technical-debt cleanup.

This document is not a list of optional preferences. It is the default execution contract. If a local vertical constitution, freeze policy, ADR, or human architect decision is stricter, the stricter rule wins.

AI must first determine what is true, which source has authority to prove it, which canonical contract represents it, who owns it, and whether the requested task authorizes changing it.

The Truth, Contract, and Change Authority rules below apply to all Bella OS, Products, features, refactors, UI redesigns, and technical-debt fixes.

## 0. Truth -> Canonical -> Consumer

Before modifying code, distinguish these three concepts.

### Truth

Truth is the authoritative fact about the system for the question being answered.

Examples:

```text
Database structure     -> migration / verified DB schema
Generated DB shape     -> generated database types
Product identity       -> Product Registry
Architecture permission -> Architecture Constitution / ownership rules
Domain behavior        -> verified domain contract / producer
```

Truth is not automatically whatever existing code currently says.

### Source of Truth

Source of Truth is the authoritative source used to prove the Truth for the specific question being answered.

The AI coding agent must identify the correct Source of Truth before treating an existing behavior, field, status, schema, API, UI element, or test fixture as canonical.

### Canonical Contract

Canonical Contract is the official representation or access pattern Bella currently accepts for that Truth.

Canonical means:

```text
New code should follow this contract.
```

Existing or frequently used code is not automatically canonical.

### Consumer

Consumer is the code currently consuming the canonical contract.

Required reasoning:

```text
Truth
  ↓
Source of Truth
  ↓
Canonical Contract
  ↓
Ownership
  ↓
Boundary
  ↓
Consumer
```

If Consumer != Canonical, fix the stale Consumer.

If Truth is unclear, investigate before coding.

If Truth is known but Canonical Contract is unclear, defer and resolve ownership or architecture first.

If Canonical Contract does not exist, never invent one merely to satisfy TypeScript, UI, or CI.

If changing Canonical Contract is genuinely required, treat it as an explicit contract or architecture change, not as a local bug fix.

### Mandatory Pre-Coding Check

Before changing a field, type, schema, relation, query, API, RPC, DTO, domain model, status, action, or workflow:

1. What is the Truth?
2. What is the Source of Truth?
3. What is the Canonical Contract?
4. Who owns that contract?
5. Is this layer allowed to consume it?
6. Is the current Consumer stale?
7. Does a verified implementation already exist?
8. What change authority did the user request grant?
9. What is the minimum sufficient change?

Only then modify code.

The complete Bella reasoning model is:

```text
TRUTH
  ↓
SOURCE OF TRUTH
  ↓
CANONICAL CONTRACT
  ↓
OWNERSHIP
  ↓
BOUNDARY
  ↓
CHANGE AUTHORITY
  ↓
CONSUMER
  ↓
IMPLEMENTATION
  ↓
VERIFICATION
```

Correct Truth plus correct canonical data plus wrong ownership is still wrong implementation.

## Core Incident Lesson

Most recent Bella failures were not caused by lack of code. They were caused by code written before proving ownership, contract, runtime semantics, execution environment, or closure evidence.

The permanent response is:

```text
LỖI
 ↓
Có phải PR gây ra?
 ↓
Truth là gì?
 ↓
Source of Truth là gì?
 ↓
Canonical contract là gì?
 ↓
Owner là ai?
 ↓
Layer này có quyền dùng contract đó?
 ↓
Semantics có thực sự tương đương?
 ↓
Minimal fix là gì?
 ↓
Verify
 ↓
STOP
```

## Bella OS & Product Development Process v1.0

Use this single process for every new Bella OS and Product. It exists to prevent technical debt before code starts while preserving Bella's rule against unnecessary bureaucracy.

### OS vs Product

```text
BELLA PLATFORM
│
├── PLATFORM CORE
│
├── INDUSTRY OS
│     ├── Healthcare OS
│     ├── Education OS
│     ├── Logistics OS
│     ├── Beauty OS
│     └── ...
│
└── PRODUCTS
      ├── Bella Hospital
      ├── Bella Preschool
      ├── Bella Haircut Shop
      ├── Bella Nail Shop
      ├── Bella English Center
      └── ...
```

OS owns reusable industry capability and domain semantics. Product packages capabilities into concrete software for users.

```text
Beauty OS
   │
   ├── Scheduling
   ├── Service
   ├── Staff
   └── Resource
          │
          ▼
Bella Haircut Shop
Bella Nail Shop
Bella Beauty Spa
```

OS must not be designed around one Product's UI. Product must not copy a domain engine that belongs to an OS.

### Standard Process

```text
0. Problem
      ↓
1. Truth
      ↓
2. Ownership
      ↓
3. Capability Map
      ↓
4. Reuse Analysis
      ↓
5. Contract
      ↓
6. Boundary & Data
      ↓
7. Minimal Implementation Plan
      ↓
8. Coding
      ↓
9. Verification
      ↓
10. Closure
```

Do not expand this into extra governance phases unless repeated evidence proves the current process is insufficient.

### Operational Readiness SOP

When a product moves from implementation correctness toward real customer operation, use `docs/governance/OPERATIONAL_READINESS_SOP.md`.

Operational readiness work is read-only first and must audit real business workflows rather than source folders, modules, or cleanup opportunities. The SOP defines operational statuses, workflow evidence chains, the `NOT_PROVEN` vs `BLOCKED` distinction, and the rule that operational audit must stop at the decision boundary before any implementation.

### Mandatory Entry Gate for New OS/Product Work

Before coding any new OS, new Product, Product vertical, or Product UI redesign, the AI coding agent must produce or update `ARCHITECTURE_GATE_RESULT.md` for the current work scope.

The gate must cover:

```text
Problem / non-goals
Truth and Source of Truth
Ownership
Capability Map
Reuse Analysis
Canonical Contracts
Boundary & Data Flow
Change Intent & Change Authority
UI -> Contract Reconciliation when UI is involved
Minimal Implementation Plan
Verification Plan
```

The gate result must be one of:

```text
PASS
BLOCKED
DEFER
```

`PASS` means the work may proceed with a minimal implementation plan.

`BLOCKED` means ownership, contract, boundary, freeze, tenant/security, or architecture permission is unresolved. Do not write product/runtime code.

`DEFER` means the requested capability or UI element is valid to consider later, but there is not enough evidence to implement it safely in the current scope.

For UI redesign work, the gate must explicitly list every data-bound or action-bound UI element that introduces a field, KPI, status, action, filter, or workflow. Each one must conclude as `MATCH`, `STALE UI`, `MAPPING BUG`, `CAPABILITY GAP`, or `CONTRACT CHANGE REQUIRED`.

The gate must also state which layers the request authorizes changing. Requested scope is the default change boundary.

This is a lightweight entry gate, not a new framework. It should be short, specific, and evidence-backed.

### 0. Define the Problem

Do not code yet. Answer:

```text
Đang xây cái gì?
Cho ai?
Giải quyết vấn đề gì?
Workflow thực tế là gì?
Phạm vi phiên bản đầu tiên?
Cái gì KHÔNG làm?
```

Start from the business workflow, not from tables.

### 1. Find the Truth

Identify the real domain facts before designing:

```text
Nghiệp vụ thực tế vận hành thế nào?
Entity thực sự là gì?
Lifecycle thực sự là gì?
Quan hệ nào thực sự tồn tại?
```

Acceptable sources of Truth include business operation, verified system behavior, database schema, migrations, existing domain engines, Product Registry, Architecture Constitution, and verified documentation. Existing code is not automatically Truth.

### 2. Determine Ownership

Every capability must be classified:

```text
PLATFORM
OS
PRODUCT
INTEGRATION
SHARED UI
```

If ownership is unclear, stop before coding.

### 3. Build Capability Map

Map capabilities before designing data:

```text
Capability          Owner       Existing?

Customer            Platform    YES
Booking             Beauty OS   YES
Service             Beauty OS   YES
Staff               Platform    YES
Commission          ?           investigate
Product presentation Product    NEW
```

This prevents a Product from recreating existing Platform or OS capability.

### 4. Reuse Before Create

For each capability:

```text
Có implementation verified?
        │
    ┌───┴────┐
   YES       NO
    │         │
 REUSE    Có thể EXTEND?
              │
          ┌───┴───┐
         YES      NO
          │        │
       EXTEND    LOCAL
```

The order is:

```text
REUSE -> EXTEND -> LOCAL -> ABSTRACT
```

Evidence of reuse creates abstraction. Abstraction must not be created to predict reuse.

### 5. Define Canonical Contract

For each contract, identify:

```text
Entity
ID
Fields
Enum
Nullable
Relation
Lifecycle
Owner
Consumer
```

Use the Rule 0 model:

```text
TRUTH
  ↓
SOURCE OF TRUTH
  ↓
CANONICAL CONTRACT
  ↓
OWNER
  ↓
CONSUMER
```

Do not let consumers invent fields such as `journey.current_stage` when the canonical relationship is `current_stage_id -> JourneyStage.id -> JourneyStage.code`.

### 6. Define Boundaries & Data Flow

Use the standard flow:

```text
DATABASE
   ↓
Repository / Mapper
   ↓
DOMAIN
   ↓
SERVICE / USE CASE
   ↓
API / DTO
   ↓
UI
```

Product code must consume OS or Platform through the allowed service/contract boundary, not direct internal table access.

Also verify:

```text
Tenant
AuthN
AuthZ
RLS
PII
Audit
```

### Change Authority

The requested change determines which layer the AI coding agent is authorized to modify.

Examples:

```text
UI redesign          -> Presentation layer
Mapping bug          -> Mapping / Repository boundary
Business-rule change -> Domain / Service
API contract change  -> API + affected consumers
Schema change        -> Database contract + affected layers
```

Do not expand the change into other layers because doing so is easier.

Example:

```text
"Redesign Bella Haircut Shop dashboard"
```

does not authorize:

```text
redesign database
change domain model
create new API
create new RPC
invent statuses
change business workflow
```

If implementation appears to require crossing the requested boundary:

```text
Requested Change
       ↓
Lower-layer change required?
       ↓
      YES
       ↓
Evidence proves requirement?
   ┌───────┴───────┐
  NO              YES
   ↓                ↓
 STOP         Report Contract /
              Capability Gap
                    ↓
          Explicit change required
```

Do not silently expand scope.

### 7. Minimum Implementation Plan

Plan only what the first proven workflow needs:

```text
Workflow nào cần chạy?
Capability nào cần cho workflow đó?
Contract nào cần?
File nào cần thay đổi?
Test nào chứng minh nó?
```

Do not include future architecture such as AI recommendation, generic workflow engines, advanced analytics, or dynamic rules frameworks unless the current workflow proves they are required.

### 8. Coding

Before each meaningful change, check:

```text
1. Truth là gì?
2. Source of Truth ở đâu?
3. Canonical Contract là gì?
4. Owner là ai?
5. Layer này có quyền dùng không?
6. Có implementation reuse được không?
7. Requested task có authorize đổi layer này không?
8. Minimal change là gì?
```

During coding, never invent schema, field, RPC, API, enum, or type; never use casts or suppressions to hide contract mismatch; never fake fallbacks, swallow errors, edit generated types for consumers, cross ownership boundaries, or weaken tests.

If evidence is insufficient, defer instead of guessing.

### 9. Verify Continuously

Do not wait until the end of a Product to test:

```text
Small implementation
      ↓
Targeted test
      ↓
Targeted lint/typecheck
      ↓
PASS
      ↓
Next implementation
```

Increase verification scope by checkpoint:

```text
Feature -> Domain -> Phase -> Product
```

### 10. Closure

Before saying `DONE`, `CLOSED`, `VERIFIED`, or `RC READY`, check the Definition of Done in this document.

If code is written but evidence is incomplete, report `IMPLEMENTED` or `UNVERIFIED`, not `VERIFIED`.

### Additional OS Process

New OS work must start with domain modeling:

```text
Business Reality
       ↓
Domain Vocabulary
       ↓
Entities
       ↓
Relationships
       ↓
Lifecycle
       ↓
Invariants
       ↓
Capabilities
       ↓
Contracts
       ↓
Implementation
```

An OS owns reusable domain semantics. It must not include Product-specific presentation, navigation, hero imagery, or terminology such as a single Product's dashboard label when those belong to Product Identity.

### Additional Product Process

New Product work starts with:

```text
Target Customer
      ↓
Business Workflow
      ↓
Required Capabilities
      ↓
Map capabilities -> Platform/OS
      ↓
Product-specific gaps
      ↓
Product Identity
      ↓
UX
```

Products must declare:

```text
productKey
requiredModules
navigationProfile
serviceProfile
themePreset
terminology
```

Module means what Bella can do. Product means what the user sees.

### UI to Contract Reconciliation

When a Product UI is redesigned, verify data-bound and action-bound elements against canonical contracts before coding or before accepting the redesign as correct.

Redesign may change:

```text
layout
spacing
typography
visual hierarchy
component presentation
responsive behavior
theme
UX organization
```

Redesign does not authorize:

```text
changing domain model
inventing fields
inventing KPIs
inventing statuses
inventing APIs
inventing DB columns
changing business workflow
changing action semantics
```

For every new or changed UI element that displays data or triggers behavior, trace:

```text
UI element
     ↓
Field / KPI / Action / State?
     ↓
Canonical capability exists?
   ┌──────┴──────┐
  YES            NO
   ↓              ↓
Map contract     GAP
   ↓              ↓
Implement UI    STOP
               do not invent
```

Use a focused reconciliation table:

```text
UI element | UI expectation | Canonical contract | Backend reality | Conclusion
```

Allowed conclusions:

```text
MATCH
STALE UI
MAPPING BUG
CAPABILITY GAP
CONTRACT CHANGE REQUIRED
```

`MATCH` means the existing canonical capability fully supports the UI.

`STALE UI` means the UI is using an old or incorrect contract; fix the UI consumer.

`MAPPING BUG` means the capability exists, but mapping, DTO, or presentation adaptation is missing; add the minimum correct mapping at the correct boundary.

`CAPABILITY GAP` means the required business capability does not exist; stop and report it separately.

`CONTRACT CHANGE REQUIRED` means the existing canonical contract is proven insufficient or incorrect for a real business requirement; handle it as an explicit contract change with ownership, affected consumers, and regression verification.

Check only data, actions, states, and workflows. Do not expand a contract reconciliation into a visual audit of color, icon, font, or spacing.

### Missing Capability Process

If Product A needs capability X, do not automatically move X to Platform or OS.

```text
Product A needs X
      ↓
OS already has X?
 ┌────┴────┐
YES        NO
 │          │
REUSE   Product-local?
             │
          YES
             ↓
           LOCAL
```

Only after Product B and Product C also need X, and their semantics are proven equivalent, consider extraction.

### Failure Process

When a failure appears, do not fix immediately:

```text
FAILURE
   ↓
Reproduce
   ↓
Find Truth
   ↓
Find Source of Truth
   ↓
Find Canonical Contract
   ↓
Check Ownership
   ↓
Classify Root Cause
```

Classify as:

```text
CODE BUG
STALE CONSUMER
CONTRACT DRIFT
SCHEMA DRIFT
FIXTURE DRIFT
ENVIRONMENT
ARCHITECTURE
PRE-EXISTING
CASCADE
```

Then apply one root cause, one minimal fix, targeted verification, stop.

### CI Failure Process

When CI is red:

```text
CI FAIL
   ↓
Find first/root failure
   ↓
Separate cascade failures
   ↓
Compare origin/main if necessary
   ↓
Classify
   ↓
Minimal fix
   ↓
Targeted rerun
   ↓
Full required gates
```

Do not fix every red check independently when an aggregate or cascade failure comes from a single root job.

### Eleven Immutable Principles

```text
BELLA ENGINEERING CONSTITUTION

1. TRUTH BEFORE ASSUMPTION.
   Không đoán hệ thống hoạt động thế nào.

2. OWNERSHIP BEFORE CODE.
   Biết capability thuộc đâu trước khi implement.

3. REUSE BEFORE CREATE.
   Không tạo thứ đã tồn tại.

4. CANONICAL CONTRACT BEFORE CONSUMER.
   Consumer phải theo contract, không ngược lại.

5. BOUNDARIES MUST BE RESPECTED.
   Đúng dữ liệu nhưng sai layer vẫn là sai.

6. CHANGE AUTHORITY BEFORE IMPLEMENTATION.
   Requested scope quyết định layer được phép thay đổi.

7. NEVER INVENT A CONTRACT.
   Không invent field/type/schema/RPC/API.

8. NEVER HIDE A FAILURE.
   Không cast/suppress/weaken test để xanh CI.

9. MINIMUM SUFFICIENT IMPLEMENTATION.
   Chỉ xây cái hiện tại có evidence cần.

10. ZERO NEW TECHNICAL DEBT.
   Code mới phải sạch từ đầu.

11. EVIDENCE BEFORE CLOSURE.
    Không evidence -> không VERIFIED/CLOSED.
```

### Standard AI Coding Prompt

Use this prompt at the start of new OS/Product work:

```text
Follow Bella Engineering Constitution and OS/Product Development Process.

Before coding: establish Business Truth -> Source of Truth -> Ownership -> Existing Capabilities -> Canonical Contracts -> Boundaries -> Change Authority -> Minimal Scope.

During coding: reuse before create; never invent schema/type/API/RPC; never bypass ownership; never use suppression/casts to hide contract mismatch; implement only proven requirements.

When uncertain: investigate or DEFER - never guess.

Before closure: verify TypeScript, ESLint, Architecture, relevant tests, tenant/security boundaries and regression evidence. Code written is not equivalent to DONE.
```

The entire process compresses to:

```text
BUSINESS TRUTH
      ↓
OWNERSHIP
      ↓
CAPABILITY
      ↓
REUSE
      ↓
CANONICAL CONTRACT
      ↓
BOUNDARY
      ↓
CHANGE AUTHORITY
      ↓
MINIMAL IMPLEMENTATION
      ↓
VERIFY
      ↓
EVIDENCE
      ↓
CLOSE
```

## 1. Ownership Before Code

Before creating or modifying a capability, identify the owner:

```text
Platform?
OS?
Product?
Integration?
Shared UI?
```

If ownership is unclear, do not code yet.

Correct data in the wrong layer is still wrong implementation. For example, a Product layer direct query to an internal OS table can be architecturally invalid even when the table contains the right data.

## 2. Reuse Before Create

The mandatory order is:

```text
REUSE
 ↓
EXTEND
 ↓
LOCAL IMPLEMENTATION
 ↓
ABSTRACT
```

Do not create a Factory, Manager, Provider, Registry, Adapter, Generic Engine, or framework because it may be useful later. Add abstraction only after repeated evidence proves it removes real complexity inside the correct ownership boundary.

## 3. Canonical Contract Before Consumer

Before a consumer uses any field, type, API, or behavior, verify:

```text
Consumer expectation
        ↓
Generated type
        ↓
Schema / Migration
        ↓
Producer
        ↓
Domain semantics
```

Do not infer the canonical contract from stale consumer code. If a consumer expects `customer.referred_by` but the canonical contract is `customer.referrer_id`, fix the stale consumer. Do not add a fake field to make the compiler green.

## 4. Never Invent Schema, Field, RPC, API, or Type

If code references a table, field, RPC, API, or type that canonical evidence does not prove, defer it.

Examples:

```text
auto_sales
auto_quotations
some_missing_rpc()
ContractDefinition
```

A TypeScript error may be architecture debt or schema debt, not type debt. Do not repair it by inventing contracts.

## 5. Preserve Boundary Semantics

The standard flow is:

```text
Database
   ↓
Repository / Mapper
   ↓
Domain
   ↓
Service
   ↓
API / DTO
   ↓
UI
```

Each layer has its own contract. Do not assume that because the database is `snake_case`, the Domain must also be `snake_case`. Mapper changes must preserve runtime semantics, not merely reduce diagnostics.

## 6. Foreign Key Is Relationship, Not Business Meaning

A foreign key identifies a relationship. It does not automatically carry the business meaning of the referenced entity.

Example:

```text
current_stage_id
      │ FK
      ▼
auto_journey_stages.id
      ↓
code = "delivered"
```

When business logic needs a referenced entity's attribute, resolve the relation and use the canonical business field. Do not infer business state directly from the FK.

## 7. Read Contract Is Not Write Contract

Proof that a read path maps correctly does not prove write-path equivalence.

Example:

```text
quantity_on_hand -> stock_level
item_code        -> sku
```

This read evidence does not prove the semantics of:

```text
reserve()
release()
deduct()
quantity_reserved
inventory_transactions
```

Write paths must be proven separately, especially for Inventory, Finance, Booking, Reservation, Payment, Capacity, and Workflow transitions.

## 8. Product Identity Owns Presentation

Modules define what the system can do. Products define what users see.

New products must declare:

```text
productKey
navigationProfile
serviceProfile
themePreset
requiredModules
```

Do not use `moduleKey` as Product Identity. Do not let one Product inherit another Product's presentation by fallback. Unknown Product means neutral, not another Product.

## 9. Shared UI Uses Semantic Tokens

Theme resolution order is:

```text
Explicit Tenant Theme
        ↓
Product Default Theme
        ↓
Platform Neutral Default
```

Shared UI must not hardcode a Product-specific color or style as a universal default.

## 10. Nullability Is Business Information

Before changing or masking nullability, determine:

```text
NULL means what?
undefined means what?
No record means what?
Is fallback behavior valid for the business?
```

Do not fix TypeScript with `value!`, `value as string`, or `value ?? ''` unless the semantics are proven.

## 11. Cast Is Not a Contract Fix

Do not hide mismatch with:

```ts
as any
as unknown as X
@ts-ignore
@ts-expect-error
```

The correct flow is:

```text
Type error
   ↓
Read producer
   ↓
Read canonical contract
   ↓
Determine mismatch
   ↓
Map / Narrow / Fix stale consumer
```

For literal unions, use the canonical allowlist or type guard when needed.

## 12. Generated Types Are Evidence, Not a Repair Surface

Generated database types are used to verify:

```text
table
field
nullable
enum
relation
RPC
```

Do not hand-edit generated types to satisfy a consumer. If generated types and migrations disagree, investigate the source of truth.

## 13. Architecture Ownership Beats Diagnostic Count

Correct architecture is more important than a lower TypeScript diagnostic count.

Do not violate Core Freeze, OS boundary, Product Constitution, Platform ownership, or frozen integration contracts to reduce diagnostics.

## 14. Data Correctness Does Not Override Ownership

Before a query, answer both:

```text
1. Is this canonical data?
2. Does this layer have the right to access it?
```

Only `YES + YES` permits implementation.

## 15. Change Intent Defines Change Authority

The requested change determines which layer the AI coding agent is authorized to modify.

Requested scope is the default change boundary. Do not expand the task into other layers because doing so is easier or because a higher-layer consumer expects data, status, behavior, or UI affordances that lower layers have not proven.

Examples:

```text
UI redesign          -> Presentation layer
Mapping bug          -> Mapping / Repository boundary
Business-rule change -> Domain / Service
API contract change  -> API + affected consumers
Schema change        -> Database contract + affected layers
```

For a presentation request such as `Redesign Bella Haircut Shop dashboard`, the default authority is presentation. It does not authorize database redesign, domain model changes, new APIs/RPCs, invented statuses, or workflow changes.

If implementation requires crossing the requested boundary, stop and report the required lower-layer change as a `CAPABILITY GAP`, `CONTRACT_CHANGE_REQUIRED`, or explicit architecture decision. Do not silently expand scope.

## 16. Tests Must Follow Production Contract

When production code is corrected to the canonical contract, fixtures and mocks must follow that contract.

Do not revert production to an obsolete contract merely because old tests fail.

## 17. Test Doubles Must Model the Boundary They Replace

Database mocks that cover multiple tables must be table-aware. Do not let `.from('anything')` return the same fixture for every table.

The standard is minimum faithful mock, not a full fake database.

## 18. Integration Tests Must Declare Execution Requirements

If a test needs real Supabase, PostgreSQL, migrations, network, or credentials, its execution contract must declare that requirement.

Do not run an integration test in a non-DB Jest job and then treat `mock.supabase.co` or `ENOTFOUND` as a product failure. Reuse canonical credential-gating patterns when they exist.

## 19. Never Weaken Tests to Make CI Green

Do not:

```text
delete assertions
skip because the test is failing
increase global timeout
mock away behavior being tested
exclude the test from selector
catch or swallow errors
```

Skip or gate only when the execution environment is proven not to satisfy the test contract, and the test still runs in the correct environment.

## 20. Attribute Failures Before Fixing

A red CI result is not automatically a PR regression. Classify first:

```text
PR_REGRESSION
PRE_EXISTING
ENVIRONMENT
FIXTURE_STATE
CONTRACT_DRIFT
SCHEMA_DRIFT
BASELINE_DRIFT
CASCADE
```

Each class has a different fix path.

## 21. Compare With Main Before Blaming the PR

When a CI failure is unclear, compare PR behavior with `origin/main` under the same selector, environment, command, and fixture.

If main also fails, do not call the failure a PR regression.

## 22. Fix Root Failure, Not Cascade Failure

Do not investigate aggregate failures as independent root causes.

Examples:

```text
Affected Tests failed
       ↓
All Required Gates failed
```

Fix the root failure. The cascade should clear after the root clears.

## 23. Cancel Expensive CI After Proven Blocking Failure

If a blocking failure is already proven while expensive jobs continue, it can be appropriate to cancel heavy jobs such as full typecheck, baseline comparison, or heavy integration runs.

This is an operational optimization only. It must never be used to hide unverified gates before merge.

## 24. Zero New Technical Debt From Day One

New OS/Product work must start with:

```text
TypeScript diagnostics = 0
ESLint errors          = 0
Architecture violation = 0
```

Do not create a temporary baseline to handle later. Historical debt in existing Bella areas is being cleaned up; new work must not create the next generation of historical debt.

## 25. BAD_NEW Is Immediate Authority During Cleanup

During historical cleanup:

```text
BAD_NEW > 0 -> FAIL
BAD_NEW = 0 -> checkpoint may be valid
```

Raw diagnostic count is useful only when no new bad diagnostics are introduced. The final target remains absolute diagnostics = 0.

## 26. Fresh Full Verification Is Final Authority

Targeted checks save time, but important closure requires fresh evidence:

```text
targeted test
      ↓
targeted lint
      ↓
diff-check
      ↓
full typecheck
      ↓
relevant architecture/test gates
```

Do not use stale cache or old artifacts as closure evidence.

## 27. Easy + Proven + Local First

During cleanup, fix only when the issue is:

```text
EASY
+
PROVEN
+
LOCAL
```

Defer when a diagnostic pulls into recursive types, `TS2589`, query-builder redesign, schema invention, RPC creation, generic/conditional type design, unclear business semantics, or architecture ownership decisions.

## 28. One Root Cause, One Minimal Fix, Verify, Stop

Do not opportunistically:

```text
refactor a file
rename code
clean imports across a domain
redesign an interface
add abstraction
fix unrelated warnings
```

A cluster is closed when the cluster's root cause is resolved. The entire file does not need to be zero if residual diagnostics belong to other root causes.

## 29. Deferred Is a Valid Engineering Decision

`DEFER` means there is not enough evidence to safely fix the issue in the current scope.

Examples:

```text
ContractDefinition -> Platform architecture decision
quantity_reserved  -> Inventory behavior decision
journey.status     -> lifecycle semantics unclear
TS2589             -> query/type-system complexity
```

Deferred debt belongs in an appropriate workstream, not forced through TypeScript cleanup.

## 30. Multi-Tenant Isolation Is a Hard Invariant

Every OS/Product must define:

```text
tenant_id
authorization
RLS
service-role path
cross-tenant prevention
```

No feature is done if tenant isolation is unresolved.

## 31. Security Is Part of the Contract

Every input boundary must consider:

```text
validation
authentication
authorization
tenant scope
PII
injection
audit
```

Security is not a final hardening phase; it is part of the implementation contract.

## 32. UI Is Not the Domain Engine

UI should collect input, present state, and invoke use cases.

UI must not own business invariants, financial calculations, inventory transitions, workflow state machines, or authorization decisions. Those belong to the correct domain/service layer.

## 33. UI Must Not Invent Domain Capabilities

Redesigning presentation does not authorize changing business contracts.

Every field, KPI, status, action, filter, and workflow shown in UI must trace to a verified canonical capability or contract.

If a UI design requires a capability that does not exist, mark it as `CAPABILITY GAP` or `NEW CAPABILITY / GAP`. Do not invent backend schema, fields, APIs, RPCs, DTOs, statuses, or business semantics to make the UI work.

The required reverse trace is:

```text
UX/UI DESIGN
     ↓
UI element
     ↓
Field / KPI / Action / State?
     ↓
API / DTO
     ↓
Service
     ↓
Domain
     ↓
Repository
     ↓
DB
```

Both directions must meet at the canonical contract:

```text
           CANONICAL CONTRACT
                 │
       ┌─────────┴─────────┐
       ↓                   ↓
DB -> Domain -> Service    UI
       ↑                   ↑
       └────── MATCH ──────┘
```

If they do not meet, the UI is promising users something the system has not proven it can do.

## 34. Evidence Before Closure

Do not report:

```text
DONE
VERIFIED
CLOSED
READY
```

merely because code was written.

Closure requires appropriate evidence:

```text
contract verified
targeted tests PASS
TypeScript PASS
lint PASS
architecture PASS
security/tenant verification when relevant
regression check PASS
```

If evidence is missing, report the status as open, partial, deferred, blocked, hotspot, or unverified.

## Definition of Done for New OS/Product Work

```text
BELLA OS / PRODUCT - DEFINITION OF DONE

□ Ownership rõ
□ Reuse đã được kiểm tra
□ Canonical contract được xác minh
□ Không invent schema/type/API/RPC
□ DB -> Repository -> Domain -> Service -> API -> UI boundary đúng
□ FK/relation được resolve đúng semantics
□ Read/write contracts được chứng minh riêng khi cần
□ Product Identity rõ
□ UI data/action/state/workflow trace được tới canonical contract
□ Tenant isolation đúng
□ AuthN/AuthZ đúng
□ Null semantics rõ
□ Không any/suppression workaround
□ Không sửa generated type để chiều consumer
□ Không vi phạm Core/Frozen/Architecture boundary
□ Test fixture/mock theo production contract
□ Integration test chạy đúng environment
□ TypeScript = 0 đối với code mới
□ ESLint errors = 0
□ Architecture gates = PASS
□ Relevant tests = PASS
□ Security gates liên quan = PASS
□ Không regression ngoài scope
□ Có evidence trước khi CLOSED
```

## Default Stop Conditions

Stop implementation and report status when any of these is true:

```text
Owner is unclear
Canonical contract is missing or contradictory
Current layer does not have access rights
Requested change does not authorize modifying the required layer
Read/write semantics are not proven
Fix requires frozen/core/kernel modification
Fix requires inventing schema, RPC, API, field, or type
UI requires an unverified status, action, KPI, or workflow
New business semantics would need to be invented
Execution environment cannot satisfy the test contract
Verification evidence is stale or unavailable
```

When stopped for these reasons, use `DEFER`, `BLOCKED`, `HOTSPOT`, or `UNVERIFIED`; do not claim PASS.
