# BELLA ARCHITECTURE CONSTITUTION
**Version:** 0.1 (Draft)  
**Date:** August 20, 2026  
**Status:** Work in Progress — Week 1  
**Purpose:** Platform laws that prevent fragmentation and enable reusability

---

## PREAMBLE

**This document defines the architectural principles that govern Bella Platform.**

**Goal:** Enable Bella to build multiple Industry OS (Healthcare, Finance, Education, Real Estate, Automotive, etc.) from a single Platform Core WITHOUT:
- Copying code
- Forking architecture
- Fragmenting Core
- Breaking governance

**Success Metric:**
```
Time to build new Industry OS: < 3 months (from 12+)
Code reuse: > 80% (from ~20%)
Architecture consistency: 100%
```

---

## ARTICLE I — CORE BOUNDARY

### Section 1: Definition of Platform Core

**Platform Core** is the set of capabilities that:
1. Are needed by ALL Industry OS
2. Have NO domain-specific business logic
3. Can be reused without modification
4. Are stable and production-grade

**Platform Core includes:**
- **Foundation:** Tenant, Organization, Identity, Access, RBAC, Permission
- **Master Data:** Party, Person, Organization, Relationship, Reference Data
- **Process Orchestration:** Workflow Engine, State Machine, Rules Engine, Event Bus
- **Platform Services:** Notification, Document, File, Search, Audit, Configuration
- **Integration:** API Gateway, Connector, Integration Layer
- **Financial Core:** Chart of Accounts, Journal, Transaction (F1-F5 — shared across all OS)
- **AI Infrastructure:** AI Employee Identity, Tool Permissions, Context, Memory, Skills, SOP, DNA Pack
- **Governance:** BDGF (Authorization, Mutation Control, Audit, Recovery)

**Platform Core does NOT include:**
- Healthcare-specific logic (Patient, Doctor, Encounter, Diagnosis)
- Education-specific logic (Student, Course, Enrollment, Grading)
- Real Estate-specific logic (Property, Lease, Tenant)
- Any domain business rules

### Section 2: Core Modification Rules

**Platform Core can ONLY be modified when:**

✅ **Allowed:**
1. Bug fix that affects ALL OS
2. Performance optimization that benefits ALL OS
3. Security enhancement that protects ALL OS
4. New capability requested by 2+ Industry OS
5. Refactoring to improve reusability (no behavior change)

❌ **NOT Allowed:**
1. Adding domain-specific logic to Core
2. Modifying Core to fix a single Industry OS issue
3. Adding capability needed by only ONE OS
4. Breaking changes without migration path
5. Bypassing governance (BDGF) for "convenience"

**Approval Required:** Platform Architect + 2 Domain Architects

---

## ARTICLE II — KERNEL BOUNDARY

### Section 1: Definition of Domain Kernel

**Domain Kernel** is the set of capabilities that:
1. Are specific to ONE industry
2. Contain domain business logic
3. Cannot be generalized across industries
4. Extend Platform Core with domain semantics

**Domain Kernel examples:**
- **Healthcare Kernel (H1-H12):** Patient, Doctor, Encounter, Diagnosis, Treatment, Clinical Decision Support, HIPAA Compliance
- **Finance Kernel (F6+):** Loan, Investment, Risk Management, Regulatory Reporting (beyond core accounting)
- **Education Kernel (E1-En):** Student, Course, Enrollment, Grading, Curriculum, Accreditation
- **Real Estate Kernel:** Property, Lease, Tenant, Maintenance, Occupancy
- **Automotive Kernel:** Vehicle, Parts, Service, Warranty

### Section 2: Kernel Rules

**Domain Kernel MUST:**
1. Use Platform Core capabilities (not duplicate them)
2. Communicate with Core via defined contracts (APIs, Events)
3. NOT modify Platform Core directly
4. NOT access Core database tables directly (use APIs/Services)
5. Implement domain-specific business rules ONLY

**Domain Kernel can:**
1. Define domain entities
2. Implement domain workflows
3. Define domain events
4. Implement domain-specific UI
5. Integrate with domain-specific external systems

**Domain Kernel CANNOT:**
1. Modify Platform Core components
2. Bypass BDGF governance
3. Access other Kernel's data directly
4. Duplicate Core capabilities

---

## ARTICLE III — COMMUNICATION CONTRACTS

### Section 1: Core ↔ Kernel Communication

**Kernel accesses Core via:**
1. **Platform APIs:** RESTful APIs or GraphQL
2. **Platform Events:** Subscribe to Core events (tenant.created, user.updated, etc.)
3. **Platform Services:** Call Core services (notification, document, workflow)

**Core accesses Kernel via:**
1. **Kernel Events:** Core subscribes to domain events (patient.admitted, transaction.posted)
2. **Kernel APIs:** Core calls Kernel APIs ONLY for cross-domain queries
3. **Webhook/Callback:** For async processes

**NEVER:**
- Direct database access across boundaries
- Direct function calls across boundaries
- Shared state across boundaries

### Section 2: Kernel ↔ Kernel Communication

**Healthcare Kernel ↔ Finance Kernel:**
- Via Platform Core (preferred)
- Via Domain Events
- Via APIs with explicit contracts

**NEVER:**
- Direct database access between Kernels
- Shared domain entities between Kernels

---

## ARTICLE IV — BDGF GOVERNANCE BOUNDARIES

### Section 1: What BDGF Protects

**BDGF (Bella Deployment Governance Framework) protects:**
1. **Schema mutations:** CREATE/ALTER/DROP TABLE
2. **Critical data mutations:** INSERT/UPDATE/DELETE on protected tables
3. **Configuration changes:** Production environment configuration
4. **Permission changes:** RBAC/ACL modifications
5. **System-level changes:** Infrastructure, deployment, secrets

**BDGF enforcement:**
```
Request → Approval → Authorization → Gate Token → Execution → Detection → Audit → Recovery → Verification
```

### Section 2: BDGF Boundaries

**MUST go through BDGF:**
- Production schema migrations
- Production data migrations
- System configuration changes
- Permission/role changes

**Does NOT require BDGF:**
- Read-only queries
- Application-level data CRUD (normal operations)
- UI changes (no backend impact)
- Static asset updates

**Emergency Override:**
- Break-glass procedure documented
- Requires Architect approval
- Post-incident review MANDATORY

---

## ARTICLE V — AI EMPLOYEE BOUNDARIES

### Section 1: AI Employee Authorization

**AI Employees are HIGH-RISK executors.**

**AI Employee MUST:**
1. Have unique identity
2. Have assigned role (same as human roles)
3. Have explicit permissions
4. Have decision boundary limits
5. Have execution boundary limits
6. Go through BDGF for mutations

**AI Employee CANNOT:**
1. Bypass BDGF governance
2. Execute unauthorized mutations
3. Access data outside permission scope
4. Modify Platform Core
5. Escalate own privileges

### Section 2: AI Employee Execution Flow

```
AI Employee → Generate Plan
     ↓
Human Approval (or Auto-Approval with limits)
     ↓
Gate Token Issued (via BDGF)
     ↓
AI Employee → Execute with Token
     ↓
BDGF → Detect + Audit + Recover (if failure)
     ↓
Evidence recorded for learning
```

---

## ARTICLE VI — INDUSTRY OS FACTORY RULES

### Section 1: Building New Industry OS

**When creating new Industry OS:**

**MUST:**
1. Start with Platform Core (frozen)
2. Build ONLY Domain Kernel (industry-specific logic)
3. Use Core APIs/Services (not duplicate)
4. Follow communication contracts
5. Document Core dependencies

**Target Metrics:**
- Time to build: < 3 months
- Code reuse: > 80%
- Architecture compliance: 100%
- Core modifications: 0 (for business logic)

### Section 2: When to Add Core Capability

**Platform Core can add new capability when:**
1. Requested by 2+ Industry OS
2. Generalizable across domains
3. No domain-specific logic
4. Benefits all existing OS
5. Approved by Architecture Review Board

**Process:**
1. Submit RFC (Request for Core Capability)
2. Prove need from 2+ OS
3. Design review (generalization check)
4. Impact analysis (existing OS)
5. Approval by Platform Architect + Domain Architects
6. Implementation with migration path
7. Regression testing (all OS)

---

## ARTICLE VII — ARCHITECTURAL DEBT MANAGEMENT

### Section 1: Identifying Violations

**Architectural violations:**
1. Domain logic in Platform Core
2. Core capabilities duplicated in Kernel
3. Direct database access across boundaries
4. Bypassing BDGF governance
5. Kernel-to-Kernel direct coupling
6. Missing communication contracts

### Section 2: Remediation Process

**Priority Levels:**
- **P0 (Critical):** Blocks platform reusability, fix immediately
- **P1 (High):** Significant tech debt, fix within 1 sprint
- **P2 (Medium):** Moderate debt, fix within 1 quarter
- **P3 (Low):** Minor debt, fix when convenient

**Remediation Plan:**
1. Identify violation
2. Assess impact
3. Design refactoring
4. Create migration path
5. Implement with tests
6. Verify no regressions
7. Document lesson learned

---

## ARTICLE VIII — DECISION ESCALATION

### Section 1: Architecture Decision Log (ADR)

**All significant architectural decisions MUST be recorded in ADR.**

**ADR Template:**
```markdown
# ADR-XXX: [Title]
**Date:** YYYY-MM-DD
**Status:** Proposed | Accepted | Deprecated | Superseded
**Context:** What is the issue?
**Decision:** What decision was made?
**Consequences:** What are the implications?
**Alternatives Considered:** What other options were evaluated?
```

### Section 2: Escalation Path

**Architecture decisions:**
- **Minor:** Stream owner decides (document in ADR)
- **Moderate:** Stream owner + Platform Architect review
- **Major:** Architecture Review Board (Platform Architect + Domain Architects)
- **Critical:** Executive approval (affects business strategy)

**Architecture Review Board:**
- Meets weekly
- Reviews RFCs (Request for Core Capability)
- Reviews ADRs (Architecture Decision Records)
- Approves Core modifications
- Resolves boundary disputes

---

## ARTICLE IX — EOS × EIP INTEGRATION BOUNDARIES

### Section 1: EIP (Enterprise Intelligence Platform)

**EIP Responsibilities:**
- **Understand:** Collect data, build context
- **Advise:** Generate insights, recommendations
- **Learn:** Improve from execution outcomes

**EIP does NOT:**
- Execute mutations directly
- Bypass BDGF governance
- Modify production data
- Make autonomous decisions without approval

### Section 2: EOS (Enterprise Operating System)

**EOS Responsibilities:**
- **Plan:** Generate execution plans
- **Execute:** Orchestrate execution (via BDGF)
- **Verify:** Confirm execution results

**EOS does NOT:**
- Execute without authorization
- Bypass BDGF governance
- Directly manipulate EIP data

### Section 3: EOS × EIP Integration Points

**EIP → EOS:**
```
EIP analyzes data → Generates insights → Sends recommendations to EOS
```

**EOS → EIP:**
```
EOS executes → Generates evidence → Sends outcomes to EIP
```

**BDGF Enforcement:**
```
EOS requests mutation → BDGF validates → Issues token → EOS executes → Evidence to EIP
```

---

## ARTICLE X — ENFORCEMENT

### Section 1: Automated Enforcement

**CI/CD Pipeline MUST:**
1. Run 119+ BDGF regression tests
2. Verify architecture compliance (linting, static analysis)
3. Check for Core boundary violations
4. Verify communication contracts
5. Block deployment on violation

### Section 2: Manual Review

**Code Review MUST check:**
1. No domain logic in Core
2. No Core duplication in Kernel
3. No direct database access across boundaries
4. BDGF enforcement for mutations
5. Communication via contracts only

**Architecture Review (weekly):**
- Review ADRs
- Review RFCs
- Approve Core modifications
- Resolve disputes

---

## ARTICLE XI — AMENDMENT PROCESS

**This Constitution can be amended when:**
1. Platform evolution requires new rules
2. Rules proven ineffective
3. Business requirements change significantly

**Amendment Process:**
1. Propose amendment (RFC)
2. Discuss in Architecture Review Board
3. Approval requires consensus (Platform Architect + 2 Domain Architects)
4. Document in ADR
5. Communicate to all teams
6. Update this Constitution

---

## APPENDIX A — ARCHITECTURE DECISION RECORDS

*To be populated during Week 1-4*

**ADR-001:** Core vs Kernel Boundary Definition  
**ADR-002:** BDGF Enforcement Scope  
**ADR-003:** AI Employee Authorization Model  
**ADR-004:** EOS × EIP Integration Architecture  
**ADR-005:** Financial Core Shared Infrastructure  

---

## APPENDIX B — GLOSSARY

**Platform Core:** Reusable capabilities shared by ALL Industry OS  
**Domain Kernel:** Industry-specific business logic  
**Industry OS:** Complete operating system for one industry (Core + Kernel)  
**BDGF:** Bella Deployment Governance Framework  
**EIP:** Enterprise Intelligence Platform (Understand & Advise)  
**EOS:** Enterprise Operating System (Plan & Execute)  
**ADR:** Architecture Decision Record  
**RFC:** Request for Core Capability  

---

## RATIFICATION

**This Constitution becomes effective when:**
- ✅ Platform Architect approval
- ✅ Healthcare Domain Architect approval
- ✅ Finance Domain Architect approval
- ✅ Published to all teams
- ✅ Enforced in CI/CD pipeline

**Target Date:** November 20, 2026 (Checkpoint 1)

---

**Version History:**
- 0.1 (2026-08-20): Initial draft (Week 1)
- 0.2 (TBD): After Stream B inventory complete
- 1.0 (TBD): After Checkpoint 1 approval

---

**Prepared By:** Bella Architecture Team  
**Status:** DRAFT — Week 1 of Architecture Proof Week  
**Next:** Populate with inventory findings from Stream B

---
