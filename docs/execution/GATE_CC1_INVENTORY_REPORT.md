# Gate CC-1 Report — Capability Inventory, Classification & Dependency Graph

**Status:** 🟢 COMPLETED (Inventory & Abstraction Phase)  
**Constraint Enforced:** **NO RUNTIME CODE MOVED OR MODIFIED DURING GATE CC-1.**

---

## 1. Capability Inventory & Classification Table

Every engine, service, and infrastructure capability currently in `src/platform/host/`, `src/platform/healthcare/`, and shared libraries has been analyzed and classified into one of four strict categories:

| Capability / Module | Current Location | Target Category | Classification Rationale |
| :--- | :--- | :--- | :--- |
| **Event Bus & Messaging** | `src/platform/host/event-bus` | `PLATFORM-WIDE` $\rightarrow$ **Common Core** | Domain-agnostic pub/sub messaging, event envelope, correlation/causation metadata propagation. |
| **Contract Registry** | `src/platform/host/contract-registry` | `PLATFORM-WIDE` $\rightarrow$ **Common Core** | Domain-agnostic subsystem registration, contract binding, and runtime DI resolution. |
| **Capability Registry** | `src/platform/host/capability-registry` | `PLATFORM-WIDE` $\rightarrow$ **Common Core** | Feature discovery and capability metadata lookup across industry verticals. |
| **Tenant Context & RLS** | `src/platform/host/policy`, `src/lib/` | `PLATFORM-WIDE` $\rightarrow$ **Common Core** | Multi-tenant context extraction, RLS session headers, and tenant query scoping primitives. |
| **Base Repository & Error Mapper** | `src/platform/healthcare/shared-kernel` | `PLATFORM-WIDE` $\rightarrow$ **Common Core** | Lightweight primitives: Postgres error translation (`23505`, `23503`), version-check optimistic lock helpers (`affectedRows == 0`), tenant isolation filters. |
| **Generalized Idempotency Handler** | Ad-hoc in Order/Pharmacy services | `PLATFORM-WIDE` $\rightarrow$ **Common Core** | Operation key structure `{ tenantId, operation, businessKey }` protecting against duplicate replays. |
| **Audit & Provenance Context** | Ad-hoc in domain entities | `PLATFORM-WIDE` $\rightarrow$ **Common Core** | Standardized audit trailing (createdBy, createdAt, updatedBy, updatedAt, tenantId). |
| **Person Aggregate Root** | `src/platform/host/person`, `src/platform/party` | `HOST KERNEL` $\rightarrow$ **Platform Host** | Root identity entity. Roles (`Patient`, `Student`, `Practitioner`, `Customer`) attach to `Person`. |
| **Rule Engine** | `src/platform/host/rule-engine` | `HOST SERVICE` $\rightarrow$ **Platform Host** | Configurable execution rules engine used by platform host services. |
| **Temporal Engine** | `src/platform/host/temporal-engine` | `HOST SERVICE` $\rightarrow$ **Platform Host** | Time-series and temporal validity query management. |
| **Rollback Engine** | `src/platform/host/rollback-engine` | `HOST SERVICE` $\rightarrow$ **Platform Host** | Transactional saga state rollback orchestrator. |
| **Feature Flags** | `src/platform/host/feature-flags` | `HOST SERVICE` $\rightarrow$ **Platform Host** | Dynamic feature toggles. |
| **Encounter Engine** | `src/platform/healthcare/engines/encounter-engine` | `HEALTHCARE` $\rightarrow$ **Healthcare OS** | Clinical encounters (Ambulatory, Inpatient, Emergency, Virtual). |
| **Clinical Order Engine** | `src/platform/healthcare/engines/order-engine` | `HEALTHCARE` $\rightarrow$ **Healthcare OS** | Medication, Lab, Imaging, Procedure orders state machine & validation. |
| **Pharmacy Engine** | `src/platform/healthcare/engines/pharmacy-engine` | `HEALTHCARE` $\rightarrow$ **Healthcare OS** | Prescriptions, Dispensing, and Medication Administration Records (MAR). |
| **CDS Engine** | `src/platform/healthcare/engines/cds-engine` | `HEALTHCARE` $\rightarrow$ **Healthcare OS** | Clinical Decision Support (Drug-Drug Interaction, Allergy Checks). |
| **Student / Course / Enrollment** | To be created in `src/platform/education` | `EDUCATION` $\rightarrow$ **Education OS** | Lightweight Education vertical proof-of-concept demonstrating Meta-Platform reusability. |

---

## 2. Strict 1-Way Dependency Graph

To prevent tight coupling or domain pollution, dependencies strictly flow downstream from `Common Core`:

```text
                       Common Core (src/platform/core)
                       ┌─────────────────────────────┐
                       │ - EventBusPort              │
                       │ - PlatformContractRegistry  │
                       │ - TenantContextPrimitive    │
                       │ - BaseSupabaseRepository    │
                       │ - IdempotencyKey            │
                       │ - ExceptionMapper           │
                       └──────────────┬──────────────┘
                                      │ (1-way dependency only)
        ┌─────────────────────────────┼─────────────────────────────┐
        ▼                             ▼                             ▼
   Healthcare OS                 Host Engine                   Education OS
(src/platform/healthcare)     (src/platform/host)          (src/platform/education)
  - Encounter                   - Person Root Entity          - Student (Role on Person)
  - Clinical Order              - Rule Engine                 - Course
  - Pharmacy                    - Temporal Engine             - Enrollment
  - CDS Engine                  - Rollback Engine
```

### Architectural Verification Rules
1. `Common Core` **MUST NOT** import any file from `src/platform/healthcare/`, `src/platform/host/`, or `src/platform/education/`.
2. `Healthcare OS` **MUST NOT** import any file from `src/platform/education/`.
3. `Education OS` **MUST NOT** import any file from `src/platform/healthcare/`.
4. Domain aggregates (`Encounter`, `ClinicalOrder`, `Prescription`, `MAR`, `Student`, `Course`, `Enrollment`) remain strictly inside their respective industry modules.

---

## 3. Common Core Abstraction Contracts

### A. `EventBusPort`
```typescript
export interface DomainEventEnvelope<T = unknown> {
  eventId: string;
  eventType: string;
  aggregateId: string;
  tenantId: string;
  timestamp: string;
  correlationId: string;
  causationId?: string;
  payload: T;
}

export interface EventBusPort {
  publish<T>(event: DomainEventEnvelope<T>): Promise<void>;
  subscribe<T>(eventType: string, handler: (event: DomainEventEnvelope<T>) => Promise<void>): () => void;
}
```

### B. `PlatformContractRegistry`
```typescript
export interface PlatformContractRegistry {
  registerContract<T>(contractId: string, implementation: T): void;
  getContract<T>(contractId: string): T;
  hasContract(contractId: string): boolean;
  clear(): void;
}
```

### C. `BaseSupabaseRepository` (Lightweight Persistence Primitive)
Contains **zero business logic**. Responsibilities are strictly limited to:
- Tenant Scoping Filter: `.eq('tenant_id', tenantId)`
- Version Concurrency Helper: Executes `UPDATE ... WHERE version = expectedVersion`. If `affectedRows === 0`, throws `OptimisticLockError`.
- DB Error Normalization: Maps Postgres error `23505` $\rightarrow$ `UniqueConstraintViolationError` and `23503` $\rightarrow$ `ForeignKeyViolationError`.

### D. Generalized `IdempotencyKey`
```typescript
export interface IdempotencyKey {
  tenantId: string;
  operation: string;     // e.g., 'CREATE_ORDER', 'APPROVE_PRESCRIPTION', 'ENROLL_STUDENT'
  businessKey: string;   // e.g., requestId, clinicalOrderId, enrollmentRequestId
}
```

---

## 🏁 Gate CC-1 Summary & Readiness

- Inventory completed across 16 Host subdirectories and Healthcare engines.
- **Zero runtime files modified or moved.**
- Dependency graph validated with strict 1-way rules.
- Abstraction contracts specified and ready for Gate CC-2 execution upon user review.
