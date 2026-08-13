# BELLA AI CODING — MANDATORY ARCHITECTURAL CONTROL

Before modifying any Healthcare or Education code or implementing any Product Vertical, you MUST read and strictly comply with:

👉 **Healthcare OS Constitution:** `docs/architecture/HEALTHCARE_VERTICAL_CODING_CONSTITUTION.md`
👉 **Education OS Constitution:** `docs/architecture/EDUCATION_VERTICAL_CODING_CONSTITUTION.md`

---

## 🔴 HARD KERNEL FREEZE LOCK (NON-NEGOTIABLE)

**Healthcare OS Kernel H1–H12 is FROZEN.**

You MUST NOT:
1. Create "H13" or any new core Healthcare Kernel engine in `src/platform/healthcare/engines/`.
2. Modify existing H1–H12 Kernel files, entities, or bounded-context responsibilities.
3. Access `hc_*` Kernel database tables directly from Product Verticals.
4. Duplicate Kernel entities (`Patient`, `Doctor`, `Encounter`).
5. Bypass Public Contracts (`Product → Contract → Kernel`).
6. Bypass H8 CDS, H9 Temporal, H10 Governance, or H11 Audit capabilities.
7. Violate Tenant Isolation (Gate 0 / P0).
8. Violate Event-After-Persistence (`DB COMMIT → DOMAIN EVENT`).
9. Introduce `any` types in any file.

---

## 📋 MANDATORY PRE-CODING ANALYSIS

Before writing or modifying ANY code, you MUST generate an `ARCHITECTURE_GATE_RESULT.md` containing:

1. **Product Manifest** (Capabilities & Scope)
2. **Ownership Map** ("WHO OWNS THIS DATA?")
3. **Contract Dependency Map** (`Product → Contract → Kernel`)
4. **Additive Migration Plan** (`CREATE` new product tables / indexes only)
5. **11 Automated Verification Gates Plan**

### 🔴 ARCHITECTURAL GAP PROTOCOL
If the requested feature appears to require a new Kernel capability or modification to H1–H12:
- **STATUS:** `BLOCKED`
- **ACTION:** Output `ARCHITECTURAL GAP DETECTED`. Do NOT write code. Report the gap for Human Architect Review.

---

## 🛡️ MACHINE ARCHITECTURE GUARD ENFORCEMENT

Before submitting code, you MUST verify:
```bash
npm run healthcare:verify
```
Which runs `scripts/healthcare/architecture-guard.ts` and the 52/52 Kernel Regression Test Suites.
