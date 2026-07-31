# Bella EIP Capability Platform Architecture Specification (10/10 Architecture)

> **Document Type**: Technical Platform Specification  
> **Target Audience**: Core System Architects, Senior Engineers, Industry Module Developers  
> **Status**: APPROVED & CODIFIED  
> **Target Lifespan**: 15–20 Years

---

## Executive Summary

Bella EIP Capability Platform is an enterprise-grade, contract-driven platform designed for multi-tenant, multi-industry scalability. Under this architecture, vertical business domains (**Real Estate Lead, Customer Support Ticket, Complaint, Approval, Contract, Insurance Claim, Loan Application, Recruitment Candidate**) exist strictly as **Resource Providers** consuming generic capabilities rather than implementing standalone engines.

---

## 1. Architectural Decisions & 3-Tier Classification

### Level 1: Architectural Constitution (Immutable Rules)
- **Backward Compatibility Contract (Zero Regression Guarantee)**: Production tenants (`beauty_spa`, `babycare`) are **IMMUTABLE & FROZEN**. Default behavior is always OFF. Schemas are purely additive (`CREATE TABLE IF NOT EXISTS`).
- **ResourceRef Identity Tuple**: Universal identification using `{ tenantId, resourceType, resourceId }`.
- **Universal ExecutionContext**: Injected context with `tenant`, `actor`, `security`, `runtime`, `featureFlags`, and `services` (`logger`, `now`, `generateId`).
- **Interface Segregation Contracts (ISP)**: Segregated contracts (`AssignableResource`, `WorkflowResource`, `AuditableResource`).
- **Strongly-Typed Provider Maps**: `Map<KnownCapabilityKey, CapabilityProviderFactory>`.
- **Domain vs Integration Events**: `DomainEventV1` (`resource.assigned.v1`) separated from `IntegrationEventV1` (`crm.customer.created.v1`).

### Level 2: Phase Commitments (Roadmap)
- **Phase 1: Capability Foundation**: Generic Resource Engines (`Assignment`, `SLA`, `Workflow`, `Rotation`, `Audit`, `Rule`), Resource Registry, ISP Interfaces.
- **Phase 2: Capability Runtime**: Pub/Sub Event Bus, Notification & Escalation Capabilities, Generic Supabase DB Schema (`resource_snapshots`, `resource_assignments`, `resource_sla_logs`, `resource_rotations`, `resource_audit_logs`), CQRS-Lite Read Model Projections.
- **Phase 3: Capability Intelligence**: Workflow DSL, Rule DSL, AI Decision Capability, Enterprise Copilot.

### Level 3: Future Extensions (Unbound)
- Distributed Event Sourcing, Capability Marketplace, Multi-Region Deployment.

---

## 2. 5-Layered Architecture Diagram

```
Layer 0: Shared Contracts
  ├── ResourceRef
  ├── UniversalExecutionContext
  ├── ISP Contracts (AssignableResource, WorkflowResource, AuditableResource)
  └── Versioned Event Contracts (DomainEventV1, IntegrationEventV1)
         │
         ▼
Layer 1: Capability Foundation
  ├── AssignmentCapability
  ├── WorkflowCapability
  ├── SLACapability
  ├── RotationCapability
  ├── AuditCapability
  └── RuleEvaluationCapability
         │
         ▼
Layer 2: Resource Foundation
  ├── ResourceRegistry
  ├── ResourceDefinition
  ├── TypedCapabilityProviderMap
  └── ResourceSnapshot (CQRS-Lite Read Model)
         │
         ▼
Layer 3: Capability Runtime
  ├── ResourceDBService (Supabase Persistence)
  ├── NotificationCapability (In-App, Zalo OA)
  └── EscalationCapability (Manager Escalations)
         │
         ▼
Layer 4: Capability Intelligence
  ├── Workflow DSL Engine
  ├── Rule DSL Engine
  └── AI Decision Engine
```

---

## 3. Generic Database Schema Reference

Defined in Supabase migration: `20260731020000_create_generic_resource_capabilities_schema.sql`

| Table Name | Description | Key Indexes |
| --- | --- | --- |
| `resource_snapshots` | CQRS-Lite read model storing active status, owner, stage, SLA, and version bindings | `(tenant_id, resource_type, resource_id)`, `(tenant_id, owner_id)` |
| `resource_assignments` | Historical and active assignment records | `(tenant_id, resource_type, resource_id)`, `(tenant_id, assigned_to)` |
| `resource_sla_logs` | SLA tracking stage logs and deadline timestamps | `(tenant_id, resource_type, resource_id, status)`, `(deadline_time)` |
| `resource_rotations` | Audit log of automated and manual resource rotations | `(tenant_id, resource_type, resource_id)` |
| `resource_audit_logs` | Chronological event timeline log | `(tenant_id, resource_type, resource_id, created_at DESC)` |

---

## 4. Verification & Quality Gates

To ensure zero regression, every pull request modifying or adding capabilities must satisfy:

1. **Static Analysis**: `npm run lint` must complete with **0 errors**.
2. **Critical Test Suite**: `npm run test:critical` must pass **100% (17/17 test suites, 181/181 passing tests)**.
3. **Tenant Freeze**: `beauty_spa` and `babycare` production suites must experience 0 behavioral drift.
