# Bella Host Platform

**Architecture Layer:** HOST PLATFORM (Foundation)  
**Version:** 1.0.0  
**Status:** Active Development (Phase 0)  
**Constitution Compliance:** Laws 7, 8, 9

---

## Overview

Host Platform is the **foundation layer** providing cross-industry shared services. It sits at the bottom of the Platform-of-Platforms architecture:

```
┌─────────────────────────────────────────┐
│      Product Packs (Hospital, Spa)     │  ← Product Layer
├─────────────────────────────────────────┤
│  Industry Platforms (Healthcare, Beauty)│  ← Industry Layer
├─────────────────────────────────────────┤
│       HOST PLATFORM (Foundation)        │  ← This Layer
├─────────────────────────────────────────┤
│    Infrastructure (Supabase, Cloud)    │  ← Infrastructure Layer
└─────────────────────────────────────────┘
```

---

## Core Services

### Contract Registry
**Purpose:** Manage API contracts, event schemas, and versioning  
**Location:** `src/platform/host/contract-registry/`  
**Constitution:** Law 8 (Registry-First & ADR)

**Key Features:**
- Contract registration and discovery
- Contract versioning and backward compatibility
- Contract validation at runtime
- API endpoint schema validation

### Capability Registry
**Purpose:** Manage platform capabilities and dependencies  
**Location:** `src/platform/host/capability-registry/`  
**Constitution:** Law 7 (Capability-First Enforcement)

**Key Features:**
- Capability catalog and registration
- Runtime capability enforcement
- Dependency validation (Product Pack → Required Capabilities)
- Capability versioning

### Feature Flag Platform
**Purpose:** Progressive rollout, dark launch, canary deployments  
**Location:** `src/platform/host/feature-flags/`  
**Constitution:** Law 9 (Zero Regression Guarantee)

**Key Features:**
- Feature toggle per tenant/user
- Rollout strategies (instant, canary, progressive, dark)
- A/B testing support
- Rollback on failure

### Event Bus
**Purpose:** Publish-subscribe event infrastructure  
**Location:** `src/platform/host/event-bus/`  
**Constitution:** Law 5 (Event-First Architecture)

**Key Features:**
- Domain event publishing
- Event subscription and handlers
- Event catalog and schemas
- Event replay and audit trail

---

## Shared Services

### IAM (Identity & Access Management)
**Purpose:** Authentication, authorization, role management  
**Location:** `src/platform/host/iam/`

### Notification Hub
**Purpose:** Multi-channel notifications (email, SMS, push, in-app)  
**Location:** `src/platform/host/notification/`

### Workflow Engine
**Purpose:** Business process orchestration  
**Location:** `src/platform/host/workflow/`

### Policy Engine
**Purpose:** Business rules and policy enforcement  
**Location:** `src/platform/host/policy/`

### AI Runtime
**Purpose:** AI model execution, prompt management  
**Location:** `src/platform/host/ai-runtime/`

### Metadata Engine
**Purpose:** Dynamic schema and metadata management  
**Location:** `src/platform/host/metadata/`

### Integration Hub
**Purpose:** External API integrations (Twilio, SendGrid, etc.)  
**Location:** `src/platform/host/integration/`

---

## Directory Structure

```
src/platform/host/
├── contract-registry/
│   ├── contract-registry.service.ts
│   ├── contract-registry.types.ts
│   └── index.ts
├── capability-registry/
│   ├── capability-registry.service.ts
│   ├── capability-registry.types.ts
│   └── index.ts
├── feature-flags/
│   ├── feature-flag.service.ts
│   ├── feature-flag.types.ts
│   └── index.ts
├── event-bus/
│   ├── event-bus.service.ts
│   ├── event-catalog.ts
│   └── index.ts
├── iam/
│   ├── iam.service.ts
│   └── index.ts
├── notification/
│   ├── notification.service.ts
│   └── index.ts
├── workflow/
│   ├── workflow-runtime.service.ts
│   └── index.ts
├── policy/
│   ├── policy-engine.service.ts
│   └── index.ts
├── ai-runtime/
│   ├── ai-runtime.service.ts
│   └── index.ts
├── metadata/
│   ├── metadata-engine.service.ts
│   └── index.ts
├── integration/
│   ├── integration-hub.service.ts
│   └── index.ts
├── index.ts
└── README.md
```

---

## Organization Plan (Phase 0)

### Existing Platform Services to Organize

Currently, 33+ platform engines exist in `src/platform/` root. They need to be organized under `host/` or `healthcare/`:

**Move to `src/platform/host/`:**
- `notification-hub/` → `host/notification/`
- `policy-engine/` → `host/policy/`
- `metadata-engine/` → `host/metadata/`
- `ai-orchestrator/` → `host/ai-runtime/`
- `integration-hub/` → `host/integration/`
- `iam-matrix/` → `host/iam/`
- `events/` → `host/event-bus/`
- `contract/`, `contracts/` → `host/contract-registry/`
- `capability-platform/` → `host/capability-registry/`
- `registry/` → `host/capability-registry/` (merge)
- `runtime/` → `host/capability-registry/` (merge)

**Keep in `src/platform/` (cross-cutting utilities):**
- `activity-stream/`
- `asset/`
- `compatibility/`
- `composition/`
- `config-center/`
- `context/`
- `document-engine/`
- `journey/`
- `knowledge/`
- `kpi-engine/`
- `lead-engine/`
- `messaging/`
- `party/`
- `projection-engine/`
- `resource-engine/`
- `scheduler-registry/`
- `sdk/`
- `search-engine/`
- `specification/`
- `state-machine/`
- `template-engine/`
- `timeline/`

---

## Constitution Compliance

| Law | Description | Status | Implementation |
|-----|-------------|--------|----------------|
| **Law 7** | Capability-First Enforcement | ✅ | Capability Registry enforces dependencies |
| **Law 8** | Registry-First & ADR | ✅ | Contract Registry manages all contracts |
| **Law 9** | Zero Regression Guarantee | ✅ | Feature Flags enable safe rollout |

---

## Phase 0 Implementation Plan

### Week 1: Core Services
- ✅ Create `host/` directory structure
- ✅ Create `contract-registry/` placeholder
- ✅ Create `capability-registry/` placeholder
- ✅ Create `feature-flags/` placeholder
- ✅ Create `event-bus/` placeholder

### Week 2: Service Implementation
- Implement `ContractRegistryService` (Task #2)
- Implement `FeatureFlagService` (Task #3)
- Move existing `capability-platform/` → `host/capability-registry/`
- Move existing `events/` → `host/event-bus/`

### Week 3-4: Organization Refactor
- Move 11 services from `platform/` root → `host/`
- Update all imports across codebase
- Update documentation

---

## References

- [Healthcare Platform README](../healthcare/README.md)
- [Bella Hospital Enterprise Architecture](../../../docs/architecture/BELLA_HOSPITAL_ENTERPRISE_ARCHITECTURE.md)
- [Platform-of-Platforms Constitution](../../../docs/architecture/BELLA_ENTERPRISE_PLATFORM_INTEGRATION.md)
- [Phase 0 Roadmap](../../../docs/architecture/PHASE_0_PLATFORM_REFACTOR_ROADMAP.md)

---

**Last Updated:** 2026-08-07  
**Phase:** Phase 0 (Platform Refactor)  
**Status:** Active Development  
**Next Milestone:** Implement Contract Registry & Feature Flags (Week 1-2)
