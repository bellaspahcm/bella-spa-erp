# Bella AI Platform - Roadmap (2024-2027)

**Version:** 1.0  
**Last Updated:** 2026-08-02  
**Owner:** CEO, Chief Product Officer, Chief Architect

---

## Overview

This roadmap outlines Bella AI Platform's evolution from **Bella Spa ERP** (single-industry application) to **Bella AI Platform** (multi-industry platform) over 3 years.

**Guiding Principle:** *"Ship industry features fast. Extract platform capabilities strategically."*

---

## Timeline at a Glance

```
2024: Foundation (Baby Care + Beauty Spa)
2025: Productization (Package management, Real Estate prep)
2026: Platform Extraction (Identity, Event Bus, Real Estate launch)
2027: Multi-Industry Scale (10 industries, AI-first)
```

---

## 2024: Foundation Year ✅ COMPLETED

### Q1 2024: Bella Spa MVP
**Goal:** Launch first production tenant (Beauty Spa)

**Delivered:**
- ✅ Spa booking management
- ✅ Customer membership packages
- ✅ KTV (staff) session tracking
- ✅ Commission calculation
- ✅ Basic payroll
- ✅ Treatment services catalog

**Outcome:**
- 1 spa tenant live
- 50+ bookings/week
- VND 10M monthly revenue

---

### Q2 2024: Baby Care Expansion
**Goal:** Prove multi-vertical capability

**Delivered:**
- ✅ Package sales (Mẹ & Bé)
- ✅ Session scheduling (home visits)
- ✅ Customer management
- ✅ KTV assignment
- ✅ Commission system (package-based multipliers)

**Outcome:**
- 2 verticals live (Spa + Baby Care)
- 10 tenants total
- Realized: Same core needs (booking, staff, commission)

**Key Learning:** *"Different industries, same platform capabilities underneath."*

---

### Q3-Q4 2024: Stabilization
**Goal:** Production-ready, scalable

**Delivered:**
- ✅ Multi-tenant architecture (RLS)
- ✅ Payroll automation
- ✅ Attendance tracking
- ✅ KPI leaderboards
- ✅ Finance module (revenue, expenses, P&L)
- ✅ Mobile app (KTV self-service)

**Outcome:**
- 50 tenants live
- 500+ end users
- VND 50M MRR

---

## 2025: Productization Year ✅ COMPLETED

### Q1 2025: Package & Workflow Engine
**Goal:** Make platform configurable

**Delivered:**
- ✅ Dynamic package configuration (session multipliers, pricing tiers)
- ✅ Workflow engine (approval routing)
- ✅ Policy-based validation rules
- ✅ Role-based permissions (granular)

**Outcome:**
- Customers can configure packages without code changes
- 80% of configuration changes don't need deployments

---

### Q2 2025: Financial Maturity
**Goal:** Enterprise-grade accounting

**Delivered:**
- ✅ Chart of accounts
- ✅ Double-entry bookkeeping
- ✅ Expense approval workflow
- ✅ Salary reconciliation (AI vs Manual)
- ✅ Financial reports (P&L, Balance Sheet, Cash Flow)

**Outcome:**
- Passed first external audit
- Accountants trust the system

---

### Q3 2025: Real Estate Discovery
**Goal:** Validate next industry

**Delivered:**
- ✅ Market research (100+ broker interviews)
- ✅ Partner Portal prototype
- ✅ Lead rotation mockup
- ✅ Inventory management design
- ✅ Commission structure (tiered, performance-based)

**Outcome:**
- Confirmed Real Estate as high-value next vertical
- Partner Portal spec approved

---

### Q4 2025: AI Integration (Phase 1)
**Goal:** Add intelligence to existing workflows

**Delivered:**
- ✅ AI salary reconciliation (detect discrepancies)
- ✅ Fraud detection (duplicate bookings, fake customers)
- ✅ Recommendation engine (optimal KTV assignment)

**Outcome:**
- 30% time saved in salary audits
- 95%+ accuracy in fraud detection

---

## 2026: Platform Year 🚀 CURRENT

### Q1 2026: Identity Platform (ADR-001)
**Goal:** Unify user management across verticals

**Status:** In Progress (40% complete)

**Deliverables:**
- [ ] `identities` table (replaces separate user tables)
- [ ] Credential management (email, phone, SSO)
- [ ] Role & permission engine
- [ ] Migration from legacy `spa_staff`, `baby_care_employees`

**Target:** March 2026

---

### Q2 2026: Real Estate Launch
**Goal:** Third vertical live in production

**Status:** In Progress (Partner Portal: 90% complete)

**Deliverables:**
- [x] Partner Portal (11 pages)
- [x] Database schema (6 tables)
- [ ] Partner Registration System (Hybrid Approval Model)
- [ ] Lead rotation engine
- [ ] Inventory management
- [ ] Commission calculation

**Milestones:**
- **Aug 2026:** Partner Registration System (current sprint)
- **Sep 2026:** Lead rotation + Inventory
- **Oct 2026:** Beta launch (10 partners)
- **Nov 2026:** Production launch (100+ partners)

**Target:** November 2026

---

### Q3 2026: Event Bus & Decoupling
**Goal:** Enable independent module deployment

**Status:** Planned

**Deliverables:**
- [ ] Event Bus infrastructure (PostgreSQL LISTEN/NOTIFY + Outbox)
- [ ] Domain event catalog (30+ events)
- [ ] Refactor modules to publish events
- [ ] Audit, Notification, Analytics as subscribers

**Target:** September 2026

---

### Q4 2026: Healthcare Pilot
**Goal:** Fourth vertical (validate platform approach)

**Status:** Discovery

**Deliverables:**
- [ ] Clinic management (appointment, EMR basics)
- [ ] Patient records (HIPAA-like compliance)
- [ ] Billing integration (insurance, out-of-pocket)
- [ ] Prescription management

**Target:** December 2026 (pilot with 3 clinics)

---

## 2027: Scale Year 🌍

### Q1 2027: AI Employees (Phase 2)
**Goal:** Autonomous task execution

**Planned Features:**
- [ ] AI Accountant (auto-categorize expenses, detect errors)
- [ ] AI Recruiter (screen resumes, schedule interviews)
- [ ] AI Customer Support (answer FAQs, escalate complex cases)

**Target:** March 2027

---

### Q2 2027: Vertical Expansion (3 new industries)
**Goal:** 7 industries live

**Planned:**
1. **Education** - Student management, curriculum, tuition
2. **Retail** - POS, inventory, e-commerce
3. **Logistics** - Fleet, route optimization, delivery

**Target:** June 2027

---

### Q3 2027: Marketplace & Integrations
**Goal:** Third-party ecosystem

**Planned:**
- [ ] Integration marketplace (Zapier-like)
- [ ] Industry templates (pre-configured workflows)
- [ ] Partner ecosystem (consultants, agencies)

**Target:** September 2027

---

### Q4 2027: Global Expansion Prep
**Goal:** Southeast Asia readiness

**Planned:**
- [ ] Multi-language (English, Thai, Indonesian)
- [ ] Multi-currency
- [ ] Regional compliance (GDPR, PDPA)
- [ ] Edge deployment (Singapore, Bangkok)

**Target:** December 2027

---

## Platform Capabilities Extraction Schedule

### 2026 Extractions
1. **Identity Platform** (Q1) - Unified user management
2. **Event Bus** (Q3) - Inter-module communication
3. **Workflow Engine** (Q2) - Approval routing
4. **Policy Engine** (Q3) - Business rules configuration
5. **Document Platform** (Q4) - File storage & management

### 2027 Extractions
6. **AI Decision Support** (Q1) - ML model serving layer
7. **Analytics Platform** (Q2) - Cross-industry BI
8. **Integration Hub** (Q3) - Third-party connectors
9. **Notification Engine** (Q1) - Email, SMS, push, in-app
10. **Audit & Compliance** (Q4) - Event sourcing, retention

---

## Success Metrics by Year

### 2024 Actuals ✅
- **Industries:** 2 (Spa, Baby Care)
- **Tenants:** 50
- **End Users:** 500
- **MRR:** VND 50M
- **Uptime:** 99.5%

### 2025 Actuals ✅
- **Industries:** 2 (stable)
- **Tenants:** 200
- **End Users:** 2,000
- **MRR:** VND 200M
- **Uptime:** 99.7%

### 2026 Targets 🎯
- **Industries:** 4 (Spa, Baby Care, Real Estate, Healthcare pilot)
- **Tenants:** 1,000
- **End Users:** 10,000
- **MRR:** VND 1B
- **ARR:** VND 12B
- **Uptime:** 99.9%

### 2027 Targets 🎯
- **Industries:** 10 (all verticals)
- **Tenants:** 10,000
- **End Users:** 100,000
- **MRR:** VND 4B
- **ARR:** VND 50B
- **Uptime:** 99.95%

---

## Investment Requirements

### 2026 Budget
- **Engineering:** VND 3B (15 engineers)
- **Product:** VND 500M (3 PMs)
- **Infrastructure:** VND 200M (AWS, Supabase, monitoring)
- **Sales & Marketing:** VND 1B
- **Total:** VND 4.7B

### 2027 Budget
- **Engineering:** VND 10B (50 engineers)
- **Product:** VND 2B (10 PMs)
- **Infrastructure:** VND 1B
- **Sales & Marketing:** VND 5B
- **Total:** VND 18B

---

## Key Risks & Mitigations

### Risk 1: Platform Complexity Slows Feature Delivery
**Mitigation:** Ship industry features first, extract platform patterns incrementally (not big-bang refactor).

### Risk 2: Real Estate Doesn't Gain Traction
**Mitigation:** Pilot with 10 partners, iterate based on feedback before full launch.

### Risk 3: Multi-Tenant Data Breach
**Mitigation:** RLS enforced at database level, quarterly security audits, bug bounty program.

### Risk 4: AI Hype Without Value
**Mitigation:** Every AI feature must have measurable KPI (time saved, accuracy improved, errors prevented).

### Risk 5: Talent Shortage
**Mitigation:** Comprehensive documentation (this roadmap + ADRs), AI-assisted coding, remote hiring.

---

## Decision Points (Quarterly Reviews)

### Q3 2026 Review: Healthcare Go/No-Go
**Decision Criteria:**
- Real Estate MRR > VND 500M
- Platform capabilities proven reusable
- Healthcare pilot has 3+ committed clinics

**If No:** Focus on scaling Real Estate to 1,000 partners instead.

---

### Q4 2026 Review: 2027 Verticals Selection
**Decision Criteria:**
- Which 3 industries have highest demand?
- Which industries reuse most existing capabilities?
- Which industries have best unit economics?

**Options:** Education, Retail, Logistics, Hospitality, Manufacturing, Professional Services

---

### Q2 2027 Review: International Expansion
**Decision Criteria:**
- Vietnam market > 5,000 tenants
- Platform stable (99.95% uptime for 6 months)
- Funding secured for expansion

**If Yes:** Launch Thailand Q4 2027.  
**If No:** Deepen Vietnam penetration (more industries, enterprise tier).

---

## Communication Cadence

### Monthly (All-Hands)
- Progress vs roadmap
- Key wins & learnings
- Upcoming milestones

### Quarterly (Leadership Retreat)
- Strategy review
- Roadmap adjustments
- Go/no-go decisions

### Annually (Board Review)
- Year-end results
- Next year priorities
- Funding requirements

---

## Appendix: Roadmap Principles

1. **Customer First** - Roadmap driven by customer needs, not technology trends
2. **Platform Incrementally** - Extract platform patterns from industry features, not upfront
3. **Ship Fast, Learn Faster** - MVP → Beta → Production in 3 months max
4. **Measure Everything** - Every feature has success metrics
5. **Kill Ruthlessly** - If a feature doesn't work after 2 quarters, kill it
6. **20% Time for Platform** - Engineers spend 80% on features, 20% on platform refactoring

---

**Related Documents:**
- [Vision](./VISION.md)
- [Architecture Constitution](../01-architecture/ARCHITECTURE_CONSTITUTION.md)
- [Implementation Plans](../07-implementation/)

---

**"Ship features. Extract platform. Scale to 10 industries by 2027."**
