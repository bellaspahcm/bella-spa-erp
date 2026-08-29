# Bella Platform of Platforms Architecture

**Scope:** Global Platform Architecture  
**Reference Document:** `AGENTS.md` (Development Principles)

---

## 1. Platform of Platforms Concept

Bella is structured as a **Platform of Platforms** to accelerate multi-industry development. Rather than building isolated vertical apps, Bella extracts reusable capabilities into the **Platform Core** or **Industry Kernels** so the next industry can be constructed faster.

---

## 2. Layering Architecture

Bella consists of three strict layers:

```
┌────────────────────────────────────────────────────────┐
│ 1. Platform Core (Shared by all industries)            │
│ Tenant, Auth, RLS, Audit, Outbox, Idempotency          │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 2. Industry Kernels (Domain specific, reusable)        │
│ Spa Kernel, Finance Kernel, Healthcare Kernel          │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 3. Vertical Products (Non-reusable end-user apps)      │
│ Inpatient Hospital, Dental Clinic, Beauty Spa, etc.     │
└────────────────────────────────────────────────────────┘
```

---

## 3. Decision Pipeline: The 4-Question Filter

Before implementing any new capability, run it through this filter:

1.  **Is it mandatory for correctness/security/compliance?**
    *   *YES:* Build it (non-negotiable).
2.  **Will this capability be reused in other industries?**
    *   *YES:* Consider placing it in the **Kernel**.
    *   *NO:* Keep it in the **Product** layer.
3.  **If Kernel, will it actually make the next industry faster?**
    *   *NO:* Keep it in the **Product** layer (avoid premature abstraction).
4.  **Does this make the next Industry OS faster?**
    *   *NO:* Default: don't build it.

---

## 4. Architectural Control

*   **Platform Core & Industry Kernels:** Frozen/sealed baselines. Changes require an **Architecture Change Request (ACR)**.
*   **Automated Guarding:** Enforced via `npm run arch:guard` and `npm run healthcare:guard` before code is integrated.
