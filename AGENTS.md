# Bella Development Principles

**Purpose:** Decision framework for AI agents and developers building Bella Platform of Platforms.

**Last updated:** 2026-08-25

---

## 1. Kernel-First, Not Kernel-Perfect

Bella follows:

> Build the industry → capture reusable DNA → reuse it immediately → build the next industry faster.

When implementing any new capability, classify it BEFORE building:

1. **Platform Core** — cross-industry capability (Tenant, Auth, RLS, Audit)
2. **Industry Kernel** — reusable industry capability (Finance, Healthcare, Spa patterns)
3. **Product-specific** — capability unique to one product

**Do NOT** build a capability in the Product layer first and plan to extract it into a Kernel later when its reusable nature is already apparent.

---

## 2. Kernel Is an Asset, Not a Goal

A Kernel exists to make future Industry OS development faster.

**Do NOT create:**
- Kernel registries
- Kernel marketplaces
- Kernel compilers
- Kernel factories
- Learning engines
- Universal industry abstractions

unless real development pain from multiple industries demonstrates that they are necessary.

---

## 3. Freeze Good-Enough Kernels

A Kernel does not need to be perfect before the next Industry OS starts.

Once a Kernel has:
- Correct business behavior
- Stable reusable boundaries
- Sufficient tests/evidence
- No known critical correctness issue

treat it as a **reusable baseline**.

Extend it only when a real subsequent Industry requires additional capability.

---

## 4. Reuse Before Rebuild

For every new Industry OS:

```
Requirement
    ↓
Can Platform Core provide it?
    ↓
Can an existing Kernel provide it?
    ↓
Can an existing Kernel be extended?
    ↓
Only then build new Industry-specific capability.
```

**Never duplicate** an existing capability without first explaining why reuse is inappropriate.

---

## 5. Every Industry Must Teach Bella Something

After building an Industry OS, identify only the reusable patterns that have demonstrated value.

```
Industry N
    ↓
Reusable pattern discovered
    ↓
Capture in Kernel
    ↓
Industry N+1 reuses it
```

Do not create abstractions merely because they might be reusable.

---

## 6. Optimize for Time-to-Industry

The primary architectural learning metric is:

> Is the next Industry OS faster to build than the previous one?

If development is becoming slower, investigate which boundary or Kernel is failing to provide sufficient reuse.

**Do NOT** respond to slower development by automatically adding frameworks, governance, abstraction, or process.

---

## 7. Minimal Complexity

Prefer:

> The simplest design that protects correctness, security, compliance, and reuse.

Add complexity only when it provides a demonstrated benefit.

**Non-negotiable:**
- Correctness
- Security
- Compliance

**Negotiable:**
- Architecture ceremony
- Framework perfection
- Additional abstraction layers

---

## 8. Before Starting Significant Work

Ask:

> "Does this make the next Industry OS faster, safer, or more correct?"

**If YES → Build it.**

**If NO → Question whether it is necessary.**

Do not build infrastructure merely to support a future architecture that has not yet demonstrated a real need.

---

## 9. The 4-Question Filter

Before implementing ANY new capability:

### Q1: Is it mandatory for correctness/security/compliance?
- **YES → Build it** (non-negotiable)

### Q2: Will this capability be reused in other industries?
- **YES → Consider Kernel**
- **NO → Keep in Product**

### Q3: If Kernel, will it actually make the next Industry faster?
- **NO → Keep in Product** (don't force abstraction)

### Q4: Does this make the next Industry OS faster?
- **NO → Default: don't build** (unless mandatory from Q1)

---

## 10. Architecture Guard Compliance

Bella enforces architectural boundaries through automated Architecture Guard:

- **Healthcare Kernel (H1-H12):** FROZEN
- **Education Kernel:** FROZEN (Constitution compliance required)
- **Logistics E7 Kernel:** SEALED

**Before modifying frozen/sealed code:**
1. Read applicable Constitution (Healthcare/Education)
2. Verify modification does not violate Kernel boundaries
3. If modification required, create Architecture Change Request (ACR)

**Reference:** See `AGENTS.md` workspace rules for detailed Kernel freeze policies.

---

## Current Kernel Baselines

See `docs/architecture/KERNELS.md` for detailed baseline versions and status.

| Kernel | Status | Purpose |
|--------|--------|---------|
| **Spa Kernel** | 🔒 Baseline | Service/appointment/membership/commission patterns |
| **Finance Kernel** | 🔒 Baseline | Ledger/cash/TT133/accounting invariants |
| **Healthcare Kernel** | 🔒 Baseline | Patient/clinical/workflow patterns |

**Baseline = reusable, not necessarily complete.**

Kernels evolve only when a real Industry OS requires additional reusable capability.

---

## Example: Building Industry #4

**WRONG approach:**
```
1. Start building Product features
2. Build more features
3. Product complete
4. "Oh, this could be a Kernel"
5. Extract/refactor
```

**CORRECT approach:**
```
1. Analyze Industry #4 requirements
2. For each capability:
   - Can Platform Core provide it? → Use Platform
   - Can existing Kernel provide it? → Use Kernel
   - Can existing Kernel be extended? → Extend Kernel
   - Is it reusable across industries? → New Kernel
   - Is it Industry #4-specific? → Product
3. Build in correct layer immediately
4. Measure: Was Industry #4 faster than previous?
5. Capture new reusable patterns → Update Kernels
```

---

## What This Is NOT

This is **NOT:**
- ❌ A new governance system
- ❌ An approval process
- ❌ A ceremony framework
- ❌ A phase in development lifecycle

This **IS:**
- ✅ A decision filter when classifying capabilities
- ✅ A reminder to reuse before rebuilding
- ✅ A principle: simplicity over ceremony

---

**Strategy:** Build → Learn → Reuse → Build Faster

**Success metric:** Each Industry OS faster than the previous one

**Core belief:** Bella becomes a Platform not by perfecting Kernels first, but by proving Kernels accelerate real Industry OS development.
