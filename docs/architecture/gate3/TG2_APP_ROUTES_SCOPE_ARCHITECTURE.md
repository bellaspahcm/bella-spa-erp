# TG-2 App Routes Scope Architecture

**Generated:** 2026-09-07T23:18:51.411Z

**Source:** `docs/architecture/gate3/TG2_APP_ROUTES_OWNERSHIP_MAP_FROZEN.csv`

---

## Population

```text
KNOWN       409
AMBIGUOUS   1
UNKNOWN     35
TOTAL       445
```

Only the **409 KNOWN routes** are assigned to canonical scopes in this architecture.

---

## Owner Distribution

| Owner | Type | Routes |
|-------|------|--------|
| Intelligence | Platform | 46 |
| Admin | Platform | 41 |
| Platform Core | Platform | 28 |
| Healthcare Shared | Platform | 24 |
| AutoMove | Product | 22 |
| Partner Management | Platform | 22 |
| Platform Finance Core | Platform | 22 |
| Dashboard General | Platform | 22 |
| Preschool | Product | 20 |
| Medical Clinic | Product | 20 |
| Hospital | Product | 19 |
| Workforce Management | Platform | 18 |
| Real Estate | Product | 17 |
| HR/Payroll | Platform | 13 |
| Customer Management | Platform | 12 |
| Waitlist | Platform | 10 |
| Dental | Product | 7 |
| Identity/Auth | Platform | 5 |
| Booking Engine | Platform | 5 |
| Decision Engine | Platform | 5 |
| Workflows | Platform | 5 |
| Training | Platform | 5 |
| Beauty/Spa | Product | 5 |
| Test/Debug | Platform | 4 |
| AI Copilot | Platform | 4 |
| Operations | Platform | 4 |
| Inventory | Platform | 2 |
| Finance Core | Platform | 1 |
| Marketing | Platform | 1 |

**Total:** 409 KNOWN routes

---

## Scope Taxonomy

**Product Scopes:** 7
**Platform Scopes:** 22
**Total Scopes:** 29

**Design Principle:** Owner-based decomposition. No mega `src/app/**` scope.

---

## Scope Definitions

### App Routes — Intelligence

**Scope ID:** `app-routes-intelligence`

**Owner:** Intelligence (Platform)

**Purpose:** Intelligence platform component routes

**Routes:** 46

**Include Patterns:**

```text
src/app/api/intelligence/**/*
```

---

### App Routes — Admin

**Scope ID:** `app-routes-admin`

**Owner:** Admin (Platform)

**Purpose:** Admin platform component routes

**Routes:** 41

**Include Patterns:**

```text
src/app/admin/**/*
src/app/api/admin/**/*
```

---

### App Routes — Platform Core

**Scope ID:** `app-routes-platform-core`

**Owner:** Platform Core (Platform)

**Purpose:** Platform Core platform component routes

**Routes:** 28

**Include Patterns:**

```text
src/app/api/**/*
src/app/api/cron/**/*
src/app/api/health/**/*
src/app/api/metrics/**/*
src/app/api/gate3/**/*
src/app/**/architecture/**/*
src/app/**/audit/**/*
src/app/**/analytics/**/*
src/app/layout.tsx
src/app/page.tsx
```

---

### App Routes — Healthcare Shared

**Scope ID:** `app-routes-healthcare-shared`

**Owner:** Healthcare Shared (Platform)

**Purpose:** Healthcare Shared platform component routes

**Routes:** 24

**Include Patterns:**

```text
src/app/**/accounting/**/*
src/app/**/finance/**/*
src/app/**/healthcare/**/*
```

---

### App Routes — AutoMove

**Scope ID:** `app-routes-automove`

**Owner:** AutoMove (Product)

**Purpose:** AutoMove product routes

**Routes:** 22

**Include Patterns:**

```text
src/app/**/automove/**/*
```

---

### App Routes — Partner Management

**Scope ID:** `app-routes-partner-management`

**Owner:** Partner Management (Platform)

**Purpose:** Partner Management platform component routes

**Routes:** 22

**Include Patterns:**

```text
src/app/api/partner/**/*
src/app/partner/**/*
```

---

### App Routes — Platform Finance Core

**Scope ID:** `app-routes-platform-finance-core`

**Owner:** Platform Finance Core (Platform)

**Purpose:** Platform Finance Core platform component routes

**Routes:** 22

**Include Patterns:**

```text
src/app/**/accounting/**/*
src/app/**/finance/**/*
```

---

### App Routes — Dashboard General

**Scope ID:** `app-routes-dashboard-general`

**Owner:** Dashboard General (Platform)

**Purpose:** Dashboard General platform component routes

**Routes:** 22

**Include Patterns:**

```text
src/app/dashboard/**/*
```

---

### App Routes — Preschool

**Scope ID:** `app-routes-preschool`

**Owner:** Preschool (Product)

**Purpose:** Preschool product routes

**Routes:** 20

**Include Patterns:**

```text
src/app/**/preschool/**/*
```

---

### App Routes — Medical Clinic

**Scope ID:** `app-routes-medical-clinic`

**Owner:** Medical Clinic (Product)

**Purpose:** Medical Clinic product routes

**Routes:** 20

**Include Patterns:**

```text
src/app/**/medical/**/*
```

---

### App Routes — Hospital

**Scope ID:** `app-routes-hospital`

**Owner:** Hospital (Product)

**Purpose:** Hospital product routes

**Routes:** 19

**Include Patterns:**

```text
src/app/**/hospital/**/*
```

---

### App Routes — Workforce Management

**Scope ID:** `app-routes-workforce-management`

**Owner:** Workforce Management (Platform)

**Purpose:** Workforce Management platform component routes

**Routes:** 18

**Include Patterns:**

```text
src/app/**/workforce/**/*
```

---

### App Routes — Real Estate

**Scope ID:** `app-routes-real-estate`

**Owner:** Real Estate (Product)

**Purpose:** Real Estate product routes

**Routes:** 17

**Include Patterns:**

```text
src/app/**/real-estate/**/*
```

---

### App Routes — HR/Payroll

**Scope ID:** `app-routes-hr-payroll`

**Owner:** HR/Payroll (Platform)

**Purpose:** HR/Payroll platform component routes

**Routes:** 13

**Include Patterns:**

```text
src/app/**/hr/**/*
src/app/**/payroll/**/*
src/app/dashboard/**/*
```

---

### App Routes — Customer Management

**Scope ID:** `app-routes-customer-management`

**Owner:** Customer Management (Platform)

**Purpose:** Customer Management platform component routes

**Routes:** 12

**Include Patterns:**

```text
src/app/**/customer*/**/*
src/app/**/crm/**/*
```

---

### App Routes — Waitlist

**Scope ID:** `app-routes-waitlist`

**Owner:** Waitlist (Platform)

**Purpose:** Waitlist platform component routes

**Routes:** 10

**Include Patterns:**

```text
src/app/**/waitlist/**/*
```

---

### App Routes — Dental

**Scope ID:** `app-routes-dental`

**Owner:** Dental (Product)

**Purpose:** Dental product routes

**Routes:** 7

**Include Patterns:**

```text
src/app/**/dental/**/*
```

---

### App Routes — Identity/Auth

**Scope ID:** `app-routes-identity-auth`

**Owner:** Identity/Auth (Platform)

**Purpose:** Identity/Auth platform component routes

**Routes:** 5

**Include Patterns:**

```text
src/app/(auth)/**/*
src/app/**/login*/**/*
src/app/**/signup*/**/*
```

---

### App Routes — Booking Engine

**Scope ID:** `app-routes-booking-engine`

**Owner:** Booking Engine (Platform)

**Purpose:** Booking Engine platform component routes

**Routes:** 5

**Include Patterns:**

```text
src/app/**/bookings/**/*
```

---

### App Routes — Decision Engine

**Scope ID:** `app-routes-decision-engine`

**Owner:** Decision Engine (Platform)

**Purpose:** Decision Engine platform component routes

**Routes:** 5

**Include Patterns:**

```text
src/app/**/decision-engine/**/*
```

---

### App Routes — Workflows

**Scope ID:** `app-routes-workflows`

**Owner:** Workflows (Platform)

**Purpose:** Workflows platform component routes

**Routes:** 5

**Include Patterns:**

```text
src/app/**/workflows/**/*
```

---

### App Routes — Training

**Scope ID:** `app-routes-training`

**Owner:** Training (Platform)

**Purpose:** Training platform component routes

**Routes:** 5

**Include Patterns:**

```text
src/app/**/training/**/*
```

---

### App Routes — Beauty/Spa

**Scope ID:** `app-routes-beauty-spa`

**Owner:** Beauty/Spa (Product)

**Purpose:** Beauty/Spa product routes

**Routes:** 5

**Include Patterns:**

```text
src/app/**/ktv/**/*
```

---

### App Routes — Test/Debug

**Scope ID:** `app-routes-test-debug`

**Owner:** Test/Debug (Platform)

**Purpose:** Test/Debug platform component routes

**Routes:** 4

**Include Patterns:**

```text
src/app/api/test/**/*
src/app/api/debug*/**/*
```

---

### App Routes — AI Copilot

**Scope ID:** `app-routes-ai-copilot`

**Owner:** AI Copilot (Platform)

**Purpose:** AI Copilot platform component routes

**Routes:** 4

**Include Patterns:**

```text
src/app/**/ai-copilot/**/*
src/app/**/ai-platform/**/*
```

---

### App Routes — Operations

**Scope ID:** `app-routes-operations`

**Owner:** Operations (Platform)

**Purpose:** Operations platform component routes

**Routes:** 4

**Include Patterns:**

```text
src/app/**/operations/**/*
```

---

### App Routes — Inventory

**Scope ID:** `app-routes-inventory`

**Owner:** Inventory (Platform)

**Purpose:** Inventory platform component routes

**Routes:** 2

**Include Patterns:**

```text
src/app/**/inventory/**/*
```

---

### App Routes — Finance Core

**Scope ID:** `app-routes-finance-core`

**Owner:** Finance Core (Platform)

**Purpose:** Finance Core platform component routes

**Routes:** 1

**Include Patterns:**

```text
src/app/**/accounting/**/*
src/app/**/finance/**/*
```

---

### App Routes — Marketing

**Scope ID:** `app-routes-marketing`

**Owner:** Marketing (Platform)

**Purpose:** Marketing platform component routes

**Routes:** 1

**Include Patterns:**

```text
src/app/**/marketing/**/*
```

---

## Ungoverned Population

**36 routes explicitly outside canonical scope coverage:**

- AMBIGUOUS: 1 (legitimately multi-owner)
- UNKNOWN: 35 (insufficient evidence)

These routes are documented but NOT included in scope patterns.

### AMBIGUOUS Routes

- `/dashboard/healthcare` — Ambiguous: Medical Clinic primary vs Healthcare Shared portal

### UNKNOWN Routes (sample)

- `/api/rule-management/rules/[ruleId]` — No product imports traced; could be Platform Decision Engine or cross-product
- `/api/rule-management/rules` — No product imports traced; could be Platform Decision Engine or cross-product
- `/api/rule-management/simulate` — No product imports traced; could be Platform Decision Engine or cross-product
- `/api/rule-management/simulations` — No product imports traced; could be Platform Decision Engine or cross-product
- `/api/rules/[ruleId]/rollback` — No product imports traced; could be Platform Decision Engine or cross-product
- `/api/rules/[ruleId]` — No product imports traced; could be Platform Decision Engine or cross-product
- `/api/rules/[ruleId]/test` — No product imports traced; could be Platform Decision Engine or cross-product
- `/api/rules/[ruleId]/versions` — No product imports traced; could be Platform Decision Engine or cross-product
- `/api/rules/approvals` — No product imports traced; could be Platform Decision Engine or cross-product
- `/api/rules` — No product imports traced; could be Platform Decision Engine or cross-product
- ... and 25 more

---

## TG-2 Registration

Scopes registered in TG-2 gate configuration.

**Registration Status:** ⏸️ PENDING (Phase D implementation)

---

## Evidence Boundary

STEP 5 success means:

> **Scope architecture is ready for TG-2 coverage measurement.**

It does NOT mean:

- ❌ App Routes typecheck PASS
- ❌ TG-2 COMPLETE
- ❌ Diagnostics resolved

---

## Readiness Statement

✅ **APP ROUTES SCOPE ARCHITECTURE COMPLETE**

- 409/409 KNOWN routes assigned to canonical scopes
- 29 owner-based scopes designed
- 36 ungoverned routes documented
- Ready for TG-2 coverage measurement

**Next:** TG-2 coverage measurement per scope → diagnostic remediation by owner
