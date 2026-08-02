# Bella AI Platform - Capability Map

**Version:** 1.0  
**Last Updated:** 2026-08-02  
**Owner:** Chief Architect, Platform Team

---

## Purpose

This document defines **ALL business capabilities** that Bella AI Platform provides. These capabilities are **reusable building blocks** that industries compose into complete solutions.

**Critical Rule:** Before building any industry feature, check if a platform capability already exists.

---

## Capability Hierarchy

```
Bella AI Platform
│
├── Identity & Access (IAM)
├── Customer Relationship (CRM)
├── Sales & Commerce
├── Finance & Accounting
├── Human Resources (HR)
├── Operations
├── Knowledge & AI
├── Platform Services
└── Integration & Connectivity
```

---

## 1. Identity & Access Management (IAM)

**Purpose:** Unified identity system for all personas across all industries.

### Capabilities

| Capability | Description | Status | Industries Using |
|------------|-------------|--------|------------------|
| **Registration** | Self-service or admin-initiated identity creation | 🚧 In Dev | Real Estate (Partner) |
| **Authentication** | Email/password, phone OTP, SSO, API keys | ✅ Live | All |
| **Authorization** | Role-based permissions, resource-level access | ✅ Live | All |
| **Provisioning** | Automated tenant + user + role creation | 🚧 In Dev | Real Estate |
| **Organization Management** | Hierarchies, branches, departments, teams | 📋 Planned | All (2027) |
| **Identity Verification** | Email, phone, document verification | 🚧 In Dev | Real Estate |
| **Multi-Factor Auth (MFA)** | TOTP, SMS OTP, biometric | 📋 Planned | Enterprise (2027) |
| **Session Management** | JWT tokens, device tracking, logout | ✅ Live | All |
| **Credential Management** | Password reset, API key rotation | ✅ Live | All |
| **Audit Logging** | All auth events tracked | ✅ Live | All |

### Supported Identity Types
- **Human:** Partner, Employee, Customer, Supplier, Vendor, Consultant, Freelancer
- **Organization:** Agency, Company, Branch, Franchise
- **System:** AI Employee, Service Account, API Client, Integration

---

## 2. Customer Relationship Management (CRM)

**Purpose:** Manage relationships with customers, leads, and prospects.

### Capabilities

| Capability | Description | Status | Industries Using |
|------------|-------------|--------|------------------|
| **Lead Management** | Capture, qualify, assign, nurture leads | 🚧 In Dev | Real Estate |
| **Lead Rotation** | Round-robin, weighted, rule-based assignment | 🚧 In Dev | Real Estate |
| **Lead Scoring** | AI-powered lead quality prediction | 📋 Planned | Real Estate, Healthcare |
| **Contact Management** | Store contact details, communication history | ✅ Live | All |
| **Customer Segmentation** | Tag, categorize, filter customers | ✅ Live | Spa, Baby Care |
| **Communication Tracking** | Emails, calls, meetings logged | 📋 Planned | Real Estate (2027) |
| **Pipeline Management** | Visual pipeline, stage tracking | 📋 Planned | Real Estate (2027) |
| **Opportunity Management** | Deal tracking, win/loss analysis | 📋 Planned | Real Estate (2027) |

---

## 3. Sales & Commerce

**Purpose:** Sell products, services, and packages.

### Capabilities

| Capability | Description | Status | Industries Using |
|------------|-------------|--------|------------------|
| **Inventory Management** | Product catalog, stock tracking, variants | ✅ Live | Spa, Baby Care, Real Estate |
| **Package Management** | Bundle products/services, pricing tiers | ✅ Live | Spa, Baby Care |
| **Pricing Engine** | Tiered pricing, discounts, promotions | ✅ Live | Spa, Baby Care |
| **Reservation System** | Hold inventory, deposit, expiration | 🚧 In Dev | Real Estate |
| **Booking Management** | Schedule appointments, sessions | ✅ Live | Spa, Baby Care |
| **Session Tracking** | Track service delivery, completion | ✅ Live | Spa, Baby Care |
| **E-Commerce** | Online storefront, cart, checkout | 📋 Planned | Retail (2027) |
| **POS (Point of Sale)** | In-person sales, receipt printing | 📋 Planned | Retail (2027) |
| **Order Management** | Track orders, fulfillment, shipping | 📋 Planned | Retail (2027) |

---

## 4. Finance & Accounting

**Purpose:** Manage money in, money out, and financial reporting.

### Capabilities

| Capability | Description | Status | Industries Using |
|------------|-------------|--------|------------------|
| **Chart of Accounts** | Double-entry bookkeeping structure | ✅ Live | All |
| **Revenue Recognition** | Track income, deposits, confirmed revenue | ✅ Live | All |
| **Expense Management** | Submit, approve, pay expenses | ✅ Live | All |
| **Invoice Management** | Generate, send, track invoices | ✅ Live | All |
| **Payment Processing** | Record payments, reconciliation | ✅ Live | All |
| **Commission Calculation** | Tiered, performance-based commission | ✅ Live | Spa, Baby Care, Real Estate |
| **Payroll** | Salary calculation, deductions, bonuses | ✅ Live | Spa, Baby Care |
| **Financial Reports** | P&L, Balance Sheet, Cash Flow | ✅ Live | All |
| **Budgeting** | Set budgets, track actuals | 📋 Planned | Enterprise (2027) |
| **Tax Management** | VAT, income tax, withholding | 📋 Planned | All (2027) |

---

## 5. Human Resources (HR)

**Purpose:** Manage employees, attendance, performance, and payroll.

### Capabilities

| Capability | Description | Status | Industries Using |
|------------|-------------|--------|------------------|
| **Employee Management** | Store employee records, contracts | ✅ Live | Spa, Baby Care |
| **Attendance Tracking** | Check-in/out, GPS, timesheet | ✅ Live | Spa, Baby Care |
| **Leave Management** | Request, approve, track annual/sick leave | ✅ Live | Spa, Baby Care |
| **Payroll Processing** | Calculate salary, deductions, bonuses | ✅ Live | Spa, Baby Care |
| **Performance Management** | KPIs, ratings, reviews | ✅ Live | Spa, Baby Care |
| **Recruitment** | Job postings, applicant tracking | 📋 Planned | All (2027) |
| **Training & Development** | Course catalog, completion tracking | 📋 Planned | Education (2027) |
| **Org Chart** | Visualize reporting structure | 📋 Planned | Enterprise (2027) |

---

## 6. Operations

**Purpose:** Day-to-day operational workflows.

### Capabilities

| Capability | Description | Status | Industries Using |
|------------|-------------|--------|------------------|
| **Workflow Engine** | Define multi-step approval processes | ✅ Live | All |
| **Policy Engine** | Business rules configuration | ✅ Live | All |
| **Task Management** | Assign, track, complete tasks | 📋 Planned | All (2027) |
| **Project Management** | Milestones, timelines, resources | 📋 Planned | Professional Services (2027) |
| **Asset Management** | Track equipment, vehicles, facilities | 📋 Planned | Logistics, Manufacturing (2027) |
| **Quality Control** | Inspections, defect tracking | 📋 Planned | Manufacturing (2027) |
| **Supply Chain** | Procurement, supplier management | 📋 Planned | Retail, Manufacturing (2027) |

---

## 7. Knowledge & AI

**Purpose:** Capture knowledge, enable AI-powered decision-making.

### Capabilities

| Capability | Description | Status | Industries Using |
|------------|-------------|--------|------------------|
| **AI Review Engine** | Fraud detection, risk scoring, validation | ✅ Live | All |
| **AI Recommendation** | Suggest actions, optimizations | ✅ Live | Spa (KTV assignment) |
| **AI Reconciliation** | Detect discrepancies in financial data | ✅ Live | Spa, Baby Care |
| **AI Employees** | Autonomous task execution (accountant, recruiter) | 📋 Planned | All (2027) |
| **Knowledge Base** | Store docs, FAQs, procedures | 📋 Planned | All (2027) |
| **Search** | Full-text search across all entities | 📋 Planned | All (2027) |
| **Chatbot** | Answer customer/employee questions | 📋 Planned | All (2027) |
| **Predictive Analytics** | Revenue forecast, churn prediction | 📋 Planned | All (2027) |

---

## 8. Platform Services

**Purpose:** Cross-cutting infrastructure capabilities.

### Capabilities

| Capability | Description | Status | Industries Using |
|------------|-------------|--------|------------------|
| **Event Bus** | Publish/subscribe inter-module communication | 🚧 In Dev | All |
| **Notification Engine** | Email, SMS, push, in-app notifications | ✅ Live | All |
| **Document Management** | File upload, storage, versioning, access control | ✅ Live | All |
| **Audit & Compliance** | Immutable event log, data retention | ✅ Live | All |
| **Reporting Engine** | Custom report builder, export | ✅ Live | All |
| **Dashboard Builder** | Drag-and-drop KPI dashboards | 📋 Planned | All (2027) |
| **Localization** | Multi-language, multi-currency, timezone | 📋 Planned | SEA Expansion (2027) |
| **Multi-Tenancy** | Data isolation, RLS enforcement | ✅ Live | All |
| **Feature Flags** | Toggle features on/off per tenant | ✅ Live | All |

---

## 9. Integration & Connectivity

**Purpose:** Connect to external systems and third-party apps.

### Capabilities

| Capability | Description | Status | Industries Using |
|------------|-------------|--------|------------------|
| **Webhook** | Send events to external systems | 📋 Planned | All (2027) |
| **API Gateway** | Expose platform APIs for integrations | ✅ Live | All |
| **Integration Marketplace** | Pre-built connectors (Zapier, Slack, etc.) | 📋 Planned | All (2027) |
| **Import/Export** | Bulk data import (CSV, Excel) | ✅ Live | All |
| **Data Sync** | Two-way sync with external CRMs | 📋 Planned | Enterprise (2027) |

---

## Industry Capability Matrix

Which industries use which capabilities?

| Capability | Beauty Spa | Baby Care | Real Estate | Healthcare | Retail | Education |
|------------|------------|-----------|-------------|------------|--------|-----------|
| **Identity** | ✅ | ✅ | ✅ | 📋 | 📋 | 📋 |
| **CRM - Lead** | ❌ | ❌ | ✅ | 📋 | 📋 | 📋 |
| **CRM - Customer** | ✅ | ✅ | ✅ | 📋 | 📋 | 📋 |
| **Booking** | ✅ | ✅ | ❌ | 📋 | ❌ | ❌ |
| **Inventory** | ✅ | ✅ | ✅ | 📋 | 📋 | ❌ |
| **Package** | ✅ | ✅ | ✅ | 📋 | 📋 | 📋 |
| **Commission** | ✅ | ✅ | ✅ | ❌ | 📋 | ❌ |
| **Payroll** | ✅ | ✅ | ❌ | 📋 | 📋 | 📋 |
| **Finance** | ✅ | ✅ | ✅ | 📋 | 📋 | 📋 |
| **Workflow** | ✅ | ✅ | ✅ | 📋 | 📋 | 📋 |
| **AI Review** | ✅ | ✅ | ✅ | 📋 | 📋 | 📋 |
| **Event Bus** | ✅ | ✅ | 🚧 | 📋 | 📋 | 📋 |
| **Notification** | ✅ | ✅ | ✅ | 📋 | 📋 | 📋 |
| **Document** | ✅ | ✅ | ✅ | 📋 | 📋 | 📋 |

**Legend:**
- ✅ Live in production
- 🚧 In development
- 📋 Planned
- ❌ Not needed

---

## Capability Lifecycle

### 1. Embryonic (Industry-Specific Feature)
**Example:** Partner Lead Rotation (built for Real Estate only)

**Characteristics:**
- Tightly coupled to industry
- Hardcoded business rules
- No abstraction layer

---

### 2. Emerging (Pattern Identified)
**Example:** We realize Hospital also needs lead rotation (patient referrals), Retail needs it (supplier leads)

**Characteristics:**
- 2+ industries need same capability
- Extract common logic into shared service
- Create abstraction layer

---

### 3. Established (Platform Capability)
**Example:** `LeadRotationEngine` (platform service)

**Characteristics:**
- Documented API
- Industry-agnostic configuration
- Multiple industries using

---

### 4. Mature (Stable Platform Service)
**Example:** `IdentityPlatform`, `WorkflowEngine`, `NotificationEngine`

**Characteristics:**
- 5+ industries using
- Battle-tested in production
- Clear SLA (uptime, latency)
- Comprehensive documentation

---

## Capability Development Principles

### Principle 1: Start Industry-Specific
**"Don't build platform capabilities upfront. Extract them when 2+ industries need it."**

❌ BAD: Build generic `LeadRotationEngine` before any industry uses it  
✅ GOOD: Build Real Estate Lead Rotation, then extract when Healthcare needs it

---

### Principle 2: Configuration Over Code
**"Capability behavior should be configurable, not hardcoded."**

❌ BAD:
```typescript
if (industry === 'real_estate') {
  rotationStrategy = 'round_robin';
} else if (industry === 'healthcare') {
  rotationStrategy = 'skill_based';
}
```

✅ GOOD:
```typescript
const strategy = await policyEngine.getPolicy('lead_rotation', tenantId);
```

---

### Principle 3: Event-Driven Integration
**"Capabilities communicate through events, not direct calls."**

❌ BAD:
```typescript
await leadRotation.assign(leadId, partnerId);
await notification.send(partnerId, 'New lead assigned');
await audit.log('lead_assigned', leadId);
```

✅ GOOD:
```typescript
await leadRotation.assign(leadId, partnerId);
await eventBus.publish('LeadAssigned', { leadId, partnerId });
// Notification and Audit subscribe to the event
```

---

### Principle 4: Measure Reusability
**"Track how many industries use each capability."**

**KPI:** Reusability Score = (# industries using) / (total industries)

**Example:**
- Identity Platform: 4/4 industries = 100% (excellent)
- Lead Rotation: 2/4 industries = 50% (emerging)
- Beauty Spa Booking: 1/4 industries = 25% (industry-specific)

---

## Capability Ownership

| Capability | Owning Team | SLA | Status |
|------------|-------------|-----|--------|
| Identity | Platform | 99.95% uptime | ✅ Production |
| Workflow Engine | Platform | 99.9% uptime | ✅ Production |
| Event Bus | Platform | 99.9% uptime | 🚧 In Dev |
| Notification | Platform | 99% uptime | ✅ Production |
| CRM - Lead | Real Estate Team | 99.5% uptime | 🚧 In Dev |
| Booking | Spa Team | 99.5% uptime | ✅ Production |
| Payroll | HR Team | 99.9% uptime | ✅ Production |

---

## Usage Guidelines for Engineers

### Before Building a Feature

1. **Check Capability Map** - Does a platform capability already exist?
2. **If Yes** - Use existing capability, configure for your industry
3. **If No** - Is this needed by 2+ industries?
   - **If Yes** - Build as platform capability
   - **If No** - Build as industry-specific feature

### When to Extract to Platform

- **Trigger:** 2nd industry needs the same capability
- **Process:**
  1. Refactor industry-specific code to be generic
  2. Move to platform services directory
  3. Document API and configuration options
  4. Add tests for multi-industry scenarios
  5. Update Capability Map

---

## Related Documents

- [Platform Capabilities (Detailed)](./PLATFORM_CAPABILITIES.md)
- [Domain Model](../03-domain/DOMAIN_MODEL.md)
- [Service Architecture](../04-services/)
- [ADR-001: Identity Platform](../05-adr/ADR-001-identity-platform.md)

---

**"Every industry feature is a potential platform capability. Extract strategically."**
