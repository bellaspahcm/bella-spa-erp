# Policy Registry - Plugin Architecture Design

**Date**: June 22, 2026  
**Priority**: HIGHEST ⭐⭐⭐⭐⭐  
**Status**: Design Phase

---

## Executive Summary

**This is the most valuable feature after Universal Business Process Demo.**

Policy Registry proves that Bella EIP has true **Plugin Architecture**:
- Policies can be **discovered** without code changes
- Policies can be **registered** dynamically
- Policies can be **versioned** and **managed**
- Admin can **see** what policies are installed
- New industries can be added by **registering policies**, not rewriting code

---

## The "AHA Moment"

### Before Policy Registry
CTO sees: "You have 3 business processes (Payroll, Booking, Procurement)"
CTO thinks: "Ok, you built 3 modules. What if I need a 4th?"

### After Policy Registry
CTO sees:
```typescript
registry.register(new HospitalValidationPolicy())
registry.register(new RetailInventoryPolicy())
registry.register(new ManufacturingQCPolicy())
```

CTO thinks: **"This is a platform. I can add new domains without touching the engine."**

---

## Core Concept

A **Policy Registry** is a service that:

1. **Discovers** installed policies (from file system, database, or remote)
2. **Registers** policies dynamically (no hardcoding)
3. **Provides metadata** for each policy (name, version, domain, tags)
4. **Routes execution** to correct policy based on context
5. **Tracks dependencies** between policies

---

## Policy Metadata Schema

Every policy has metadata describing what it does:

```typescript
interface PolicyMetadata {
  // Identity
  id: string;                    // 'base-salary-v1'
  name: string;                  // 'Base Salary Policy'
  version: string;               // '1.2.0'
  
  // Classification
  domain: string;                // 'payroll', 'booking', 'procurement'
  category: string;              // 'reward', 'penalty', 'validation', 'approval'
  tags: string[];                // ['hr', 'finance', 'compensation']
  
  // Lifecycle
  status: 'active' | 'deprecated' | 'experimental';
  createdAt: string;
  updatedAt: string;
  owner: string;                 // 'bella-core', 'spa-team', 'partner-xyz'
  
  // Technical
  decisionType: string;          // 'base-salary-eligibility'
  inputSchema?: object;          // JSON Schema for validation
  outputSchema?: object;
  dependencies?: string[];       // ['policy-x', 'policy-y']
  
  // Documentation
  description: string;
  examples?: object[];
  changeLog?: string;
}
```

---

## Registry Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Policy Registry                        │
│                                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Policy Discovery                                   │ │
│  │  - Scan file system for policies                   │ │
│  │  - Read metadata from annotations                  │ │
│  │  - Validate policy contracts                       │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Policy Storage                                     │ │
│  │  - In-memory cache                                  │ │
│  │  - Persistent store (optional)                     │ │
│  │  - Version history                                  │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Policy Query                                       │ │
│  │  - List all policies                                │ │
│  │  - Filter by domain/category/tags                  │ │
│  │  - Get policy by ID                                 │ │
│  │  - Search policies                                  │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Policy Execution                                   │ │
│  │  - Route to correct policy                          │ │
│  │  - Handle versioning                                │ │
│  │  - Track execution metadata                         │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

---

## Usage Examples

### 1. List All Installed Policies

```typescript
const registry = PolicyRegistry.getInstance();
const policies = await registry.listPolicies();

// Output:
// [
//   { name: 'Base Salary Policy', domain: 'payroll', version: '1.2.0' },
//   { name: 'Compensation Policy', domain: 'payroll', version: '2.0.0' },
//   { name: 'Booking Eligibility', domain: 'booking', version: '1.0.0' },
//   { name: 'Procurement Validation', domain: 'procurement', version: '1.0.0' },
//   ...
// ]
```

### 2. Filter by Domain

```typescript
const payrollPolicies = await registry.listPolicies({ domain: 'payroll' });
const bookingPolicies = await registry.listPolicies({ domain: 'booking' });
```

### 3. Register New Policy

```typescript
// Add Hospital domain (NEW INDUSTRY!)
const hospitalPolicy = new HospitalValidationPolicy();
await registry.register(hospitalPolicy, {
  name: 'Hospital Validation Policy',
  domain: 'hospital',
  category: 'validation',
  tags: ['healthcare', 'compliance', 'hipaa'],
  owner: 'hospital-team',
});

// Done! No code changes to engine.
```

### 4. Get Policy Metadata

```typescript
const policy = await registry.getPolicy('base-salary-v1');

console.log(policy.metadata);
// {
//   name: 'Base Salary Policy',
//   version: '1.2.0',
//   domain: 'payroll',
//   category: 'reward',
//   status: 'active',
//   dependencies: [],
//   description: 'Calculates employee base salary...'
// }
```

### 5. Execute Policy via Registry

```typescript
const result = await registry.execute('base-salary-v1', context);
// Registry routes to correct policy, tracks execution
```

---

## Admin UI Mockup

```
┌──────────────────────────────────────────────────────────────┐
│  📋 Installed Policies                          [+ Add Policy] │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│  Filter: [All Domains ▼] [All Categories ▼] [Active ▼]       │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 💰 Base Salary Policy              v1.2.0   [Active]  │  │
│  │    Domain: Payroll | Category: Reward                  │  │
│  │    Used by: PayrollProcess                             │  │
│  │    Last updated: 2026-06-15                            │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 💵 Compensation Policy             v2.0.0   [Active]  │  │
│  │    Domain: Payroll | Category: Reward                  │  │
│  │    Used by: PayrollProcess                             │  │
│  │    Last updated: 2026-06-20                            │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ ✓ Booking Eligibility              v1.0.0   [Active]  │  │
│  │    Domain: Booking | Category: Eligibility             │  │
│  │    Used by: BookingProcess                             │  │
│  │    Last updated: 2026-06-22                            │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 📝 Procurement Validation          v1.0.0   [Active]  │  │
│  │    Domain: Procurement | Category: Validation          │  │
│  │    Used by: ProcurementProcess                         │  │
│  │    Last updated: 2026-06-22                            │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Core Registry (2 hours)
- [ ] `PolicyMetadata` interface
- [ ] `PolicyRegistry` class
- [ ] `register()` method
- [ ] `listPolicies()` method
- [ ] `getPolicy()` method
- [ ] In-memory storage
- [ ] Tests (10 tests)

### Phase 2: Policy Discovery (1 hour)
- [ ] Auto-discover policies from file system
- [ ] Extract metadata from policy classes
- [ ] Validate policy contracts
- [ ] Tests (5 tests)

### Phase 3: Query & Filter (1 hour)
- [ ] Filter by domain
- [ ] Filter by category
- [ ] Filter by tags
- [ ] Search by name
- [ ] Tests (8 tests)

### Phase 4: Admin UI (2 hours)
- [ ] List policies page
- [ ] Policy detail page
- [ ] Filter controls
- [ ] Add/remove policy (future)

---

## Success Criteria

### Technical
- [ ] All existing policies auto-registered
- [ ] Can list policies by domain
- [ ] Can filter policies by category/tags
- [ ] Can get policy metadata
- [ ] Registry tests passing (20+ tests)

### Strategic (CRITICAL!)
- [ ] **Demo**: Show admin UI with installed policies
- [ ] **Demo**: Register new policy WITHOUT code changes
- [ ] **Proof**: New policy executes successfully
- [ ] **Message**: "Adding new domain = register policies, not rebuild engine"

---

## Stakeholder Demo Script

### Setup (5 seconds)
"Let me show you something that makes Bella EIP a true platform."

### Demo Part 1: View Installed Policies (30 seconds)
[Open admin UI]

"Here you see all installed policies in the system:
- Payroll policies (Base Salary, Compensation)
- Booking policies (Eligibility, Recommendation, Approval)
- Procurement policies (Validation, Approval, Escalation)

These are discoverable. The system knows what it has."

### Demo Part 2: Register New Policy (1 minute)
[Show code]

```typescript
// Let's add Hospital domain (NEW INDUSTRY)
const policy = new HospitalValidationPolicy();
await registry.register(policy, {
  domain: 'hospital',
  category: 'validation',
  tags: ['healthcare', 'hipaa'],
});
```

[Refresh admin UI]

"The new policy is now available. No engine changes. No rebuild. Just registered."

### Demo Part 3: Execute New Policy (30 seconds)
[Show execution]

```typescript
const result = await hospitalProcess.execute(context);
// Works immediately!
```

"The Hospital process runs immediately. Same engine. New policy. Platform proven."

### Key Message (30 seconds)
"This is why enterprise customers choose Bella EIP.

When they expand from Spa to Hospital, or Retail to Manufacturing:
- ✅ They register new policies
- ✅ Engine stays unchanged
- ✅ Platform scales infinitely

Traditional ERP? They rebuild modules. 6-12 months. Millions of dollars.

Bella EIP? Register policies. 2 hours. Same engine."

---

## Next Steps After Registry

1. **Plugin Architecture** (registerPolicy, registerProcess, registerIndustry)
2. **Industry Adapters** (Spa, Retail, Hospital, Manufacturing)
3. **Workflow Engine** (Orchestrate multiple processes)
4. **AI Recommendation** (Suggest policy improvements)

---

## Confidence Level

**🟢 100% Confident - This is the RIGHT next step**

Why?
1. Registry is natural evolution after Universal Demo
2. Provides immediate admin value (visibility)
3. Proves plugin architecture capability
4. Required for multi-tenancy (different tenants, different policies)
5. Foundation for marketplace (3rd party policies)

---

**Key Takeaway**:

> "Policy Registry transforms Bella EIP from  
> **'Software with 3 processes'**  
> to  
> **'Platform that discovers, manages, and executes policies'**
> 
> That's the difference between a $10M company and a $100M company."

