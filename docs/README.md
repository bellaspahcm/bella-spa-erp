# Bella AI Platform - Documentation

**Last Updated:** 2026-08-02  
**Documentation Version:** 1.0

---

## Purpose

This documentation establishes the **architectural foundation** for Bella AI Platform - a multi-industry, AI-native business platform designed to serve Vietnamese SMEs across 10+ industries by 2027.

**Target Audience:**
- Engineers (backend, frontend, ML, DevOps)
- Product Managers
- AI Coding Agents (Claude, Codex, OpenHands)
- Technical Leadership
- New Team Members

---

## Documentation Structure (7 Levels)

### Level 0: Vision (Why We Exist)
```
docs/00-vision/
├── VISION.md           - Platform mission, competitive advantage, 10-20 year vision
└── ROADMAP.md          - 2024-2027 timeline, industry expansion plan
```

**When to Read:** Before starting any project, to understand Bella's north star.

---

### Level 1: Constitution (Architectural Law)
```
docs/01-architecture/
├── ARCHITECTURE_CONSTITUTION.md  - 7 invariants, design principles, governance
└── PLATFORM_PRINCIPLES.md        - (Planned) Core values, trade-offs, decision framework
```

**When to Read:** Before making any architectural decision. These rules are **immutable**.

**7 Architectural Invariants:**
1. Zero Regression Policy (new features don't break existing tenants)
2. Event Sourcing for Critical Operations
3. Single Source of Truth
4. API Contract Stability
5. Multi-Tenancy Isolation
6. AI Explainability
7. Idempotency

---

### Level 2: Capabilities (Business Building Blocks)
```
docs/02-capabilities/
├── CAPABILITY_MAP.md           - 9 capability domains, 50+ reusable capabilities
└── PLATFORM_CAPABILITIES.md    - (Planned) Detailed capability specs
```

**When to Read:** Before building any industry feature. Check if a platform capability already exists.

**9 Capability Domains:**
1. Identity & Access Management (IAM)
2. Customer Relationship Management (CRM)
3. Sales & Commerce
4. Finance & Accounting
5. Human Resources (HR)
6. Operations
7. Knowledge & AI
8. Platform Services
9. Integration & Connectivity

**Key Principle:** *"Every industry feature is a potential platform capability. Extract strategically."*

---

### Level 3: Domain (Entity Definitions)
```
docs/03-domain/
├── DOMAIN_MODEL.md              - (Planned) 9 aggregate roots, relationships
├── BOUNDED_CONTEXTS.md          - (Planned) Context boundaries, integration patterns
└── UBIQUITOUS_LANGUAGE.md       - (Planned) Terminology dictionary
```

**When to Read:** Before designing database schema or domain logic.

**9 Aggregate Roots:**
1. Identity
2. Organization
3. Tenant
4. Registration
5. Workflow
6. Package
7. Policy
8. Document
9. Notification

---

### Level 4: Platform Services (Implementation)
```
docs/04-services/
├── IDENTITY_SERVICE.md          - (Planned) Authentication, authorization, provisioning
├── WORKFLOW_SERVICE.md          - (Planned) Approval routing, state machines
├── NOTIFICATION_SERVICE.md      - (Planned) Email, SMS, push, in-app
├── DOCUMENT_SERVICE.md          - (Planned) File storage, versioning, access control
└── AI_SERVICE.md                - (Planned) ML model serving, review engine
```

**When to Read:** Before implementing or integrating with a platform service.

---

### Level 5: ADRs (Architecture Decision Records)
```
docs/05-adr/
├── ADR-001-identity-platform.md           - Unified identity system
├── ADR-004-event-driven-architecture.md   - Event Bus, pub/sub, guaranteed delivery
├── ADR-005-provisioning-architecture.md   - Pipeline-based provisioning
├── ADR-010-domain-model.md                - DDD, aggregate roots, ubiquitous language
└── ADR-015-ai-native-review.md            - AI decision support layer
```

**When to Read:** Before implementing features related to these domains.

**ADR Status:**
- ✅ APPROVED: Immutable, must be followed
- 🚧 PROPOSED: Under review
- ⏸️ SUPERSEDED: Replaced by newer ADR

---

### Level 6: Industries (Industry-Specific Docs)
```
docs/06-industries/
├── REAL_ESTATE.md               - (Planned) Partner portal, lead rotation, inventory
├── BEAUTY_SPA.md                - (Planned) Booking, membership, KTV management
├── BABY_CARE.md                 - (Planned) Packages, sessions, home visits
├── HEALTHCARE.md                - (Planned) Clinic, EMR, appointment, billing
└── ...
```

**When to Read:** Before building features for a specific industry.

---

### Level 7: Implementation (Execution Plans)
```
docs/07-implementation/
├── partner-registration-plan.md - Week-by-week plan for Partner Registration System
├── employee-onboarding-plan.md  - (Planned)
└── ...
```

**When to Read:** When executing a specific sprint or feature.

**Also see:**
- `docs/portal/` - Feature specs (Partner Portal, CRM, etc.)

---

## Quick Start for Engineers

### New to Bella AI Platform?
1. **Read Vision** (30 min) - Understand why Bella exists
2. **Read Constitution** (1 hour) - Learn architectural rules
3. **Read Capability Map** (30 min) - Understand platform capabilities
4. **Read relevant ADRs** (1-2 hours) - Deep dive into your domain

**Total Onboarding Time:** ~3-4 hours

---

### Starting a New Feature?
1. **Check Capability Map** - Does a platform capability exist?
2. **If Yes:** Use existing capability, configure for your industry
3. **If No:** Is this needed by 2+ industries?
   - **If Yes:** Build as platform capability (follow ADRs)
   - **If No:** Build as industry-specific feature

---

### Making an Architectural Decision?
1. **Check Constitution** - Does this violate any invariant?
2. **Check ADRs** - Has this been decided before?
3. **If new decision needed:** Write ADR, submit to ARB (Architecture Review Board)

**ADR Template:** `docs/05-adr/ADR-TEMPLATE.md` (to be created)

---

## AI Agent Guidelines

### For Claude, Codex, OpenHands, etc.

**Read in this order:**
1. **VISION.md** - Understand goals
2. **ARCHITECTURE_CONSTITUTION.md** - Learn rules
3. **CAPABILITY_MAP.md** - Understand platform
4. **Relevant ADRs** - Deep dive into domain
5. **Implementation Plan** - Execution details

**Rules:**
- ✅ Always check if a platform capability exists before building new code
- ✅ Follow naming conventions from Domain Model
- ✅ Publish domain events for state changes
- ✅ Use Policy Engine for business rules (not hardcoded if/else)
- ❌ Never violate the 7 Architectural Invariants
- ❌ Never create duplicate capabilities across industries

---

## Documentation Governance

### Who Owns What?

| Document Type | Owner | Approval Required |
|---------------|-------|-------------------|
| Vision | CEO, Chief Architect | Board of Directors |
| Constitution | Chief Architect | CTO, VP Engineering |
| Capability Map | Chief Architect | Platform Team Lead |
| ADRs | Proposing Engineer | Architecture Review Board (ARB) |
| Implementation Plans | Feature Lead | Product Owner, Tech Lead |

---

### Update Frequency

| Document Type | Update Frequency | Trigger |
|---------------|------------------|---------|
| Vision | Annually | Strategic planning |
| Roadmap | Quarterly | Roadmap review |
| Constitution | Rarely (< 1/year) | Major architectural shift |
| Capability Map | Monthly | New capabilities added |
| ADRs | As needed | New architectural decision |
| Implementation Plans | Weekly | Sprint planning |

---

### Version Control

- **All documentation is versioned in Git**
- **Breaking changes require version bump**
- **Old versions archived in `docs/archive/`**

**Document Version Format:** `MAJOR.MINOR.PATCH`
- **MAJOR:** Breaking changes (e.g., Constitution rewrite)
- **MINOR:** New content (e.g., new ADR added)
- **PATCH:** Fixes, clarifications

---

## Related Resources

### External Links
- [Bella AI Platform Website](https://bella-erp.com)
- [Bella API Documentation](https://api.bella-erp.com/docs)
- [Bella Developer Portal](https://developers.bella-erp.com)

### Internal Links
- [Codebase README](../README.md)
- [Contributing Guidelines](../CONTRIBUTING.md)
- [Code Style Guide](../CODE_STYLE.md)

---

## FAQ

### Q: Do I need to read all documentation before writing code?
**A:** No. Read Vision + Constitution + Capability Map (2 hours), then read ADRs relevant to your feature.

### Q: What if I disagree with an ADR?
**A:** Propose a new ADR to supersede it. Include rationale, alternatives considered, and trade-offs.

### Q: Can I skip documentation for small features?
**A:** No. All features must follow Constitution and check Capability Map. Small features often grow larger.

### Q: What if a platform capability is missing?
**A:** Build the feature first (industry-specific), extract to platform when 2nd industry needs it.

### Q: How do I know if AI will review my feature?
**A:** Read ADR-015 (AI Native Review). If your feature involves approval, validation, or fraud detection, AI will be involved.

---

## Status Dashboard

### Documentation Completion

| Level | Document | Status | Completion |
|-------|----------|--------|------------|
| 0 | VISION.md | ✅ Complete | 100% |
| 0 | ROADMAP.md | ✅ Complete | 100% |
| 1 | ARCHITECTURE_CONSTITUTION.md | ✅ Complete | 100% |
| 1 | PLATFORM_PRINCIPLES.md | 📋 Planned | 0% |
| 2 | CAPABILITY_MAP.md | ✅ Complete | 100% |
| 2 | PLATFORM_CAPABILITIES.md | 📋 Planned | 0% |
| 3 | DOMAIN_MODEL.md | 📋 Planned | 0% |
| 3 | BOUNDED_CONTEXTS.md | 📋 Planned | 0% |
| 3 | UBIQUITOUS_LANGUAGE.md | 📋 Planned | 0% |
| 4 | Platform Services | 📋 Planned | 0% |
| 5 | ADR-001 | ✅ Complete | 100% |
| 5 | ADR-004 | ✅ Complete | 100% |
| 5 | ADR-005 | ✅ Complete | 100% |
| 5 | ADR-010 | ✅ Complete | 100% |
| 5 | ADR-015 | ✅ Complete | 100% |
| 6 | Industry Docs | 📋 Planned | 0% |
| 7 | Implementation Plans | ✅ Partial | 20% |

**Overall Progress:** 45% (9/20 foundation documents complete)

---

## Next Steps

### Immediate (Week 1-2)
- [ ] Create PLATFORM_PRINCIPLES.md
- [ ] Create ADR-TEMPLATE.md
- [ ] Extract DOMAIN_MODEL.md from ADR-010
- [ ] Create BOUNDED_CONTEXTS.md
- [ ] Create UBIQUITOUS_LANGUAGE.md

### Short-Term (Month 1)
- [ ] Document all 5 Platform Services
- [ ] Create industry docs for Real Estate, Beauty Spa, Baby Care
- [ ] Create implementation plans for upcoming features
- [ ] Setup automated documentation linting (Vale, MarkdownLint)

### Long-Term (Quarter 1)
- [ ] Create interactive architecture diagrams (C4 Model)
- [ ] Build documentation search (Algolia DocSearch)
- [ ] Create video walkthroughs (Loom)
- [ ] Translate to English (for international expansion)

---

## Contact

**Questions about documentation?**
- Slack: #platform-architecture
- Email: architecture@bella-erp.com
- Office Hours: Wednesdays 2-3 PM (Chief Architect)

---

**"Documentation is not overhead. Documentation is the product."**
