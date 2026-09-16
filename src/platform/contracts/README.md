# Platform Contracts

Cross-vertical generic capability contracts.

## Purpose

This directory contains contracts for **platform-level capabilities** that are used by multiple verticals (Healthcare, Beauty, Auto, Education, Real Estate, etc.) without introducing cross-vertical dependencies.

## Classification: Platform vs Vertical

### Platform Contract (belongs here)

A contract is a **platform contract** if:

1. ✅ **Semantically generic:** No vertical-specific domain concepts (no clinical, beauty-specific, auto-specific semantics)
2. ✅ **Cross-vertical consumers:** Used by multiple verticals (Healthcare + Beauty + Education)
3. ✅ **Business rules external:** Contract defines capability interface, consumers implement business rules
4. ✅ **Applicable broadly:** Can be reused by any vertical with similar capability needs

**Examples:**
- `IWaitlistEngine` — Time-based queue management (used by Healthcare, Beauty, Auto, Education)
- `IInboxReceiver` — Generic inbox/message handling

---

### Vertical Contract (belongs in vertical directory)

A contract is a **vertical contract** if:

1. ✅ **Vertical-specific semantics:** Contains domain concepts unique to that vertical (clinical protocols, beauty techniques, automotive systems)
2. ✅ **Single vertical consumers:** Only used within that vertical
3. ✅ **Business rules embedded:** Contract enforces vertical-specific invariants
4. ✅ **Not generalizable:** Cannot be reused by other verticals without semantic mismatch

**Examples:**
- `IEncounterEngine` (Healthcare) — Clinical encounter management
- `IPharmacyEngine` (Healthcare) — Medication dispensing
- `IOREngine` (Healthcare) — Operating room management

**Vertical contract locations:**
- `src/platform/healthcare/contracts/` — Healthcare vertical
- `src/platform/logistics/` — Logistics vertical
- `src/platform/education/contracts/` — Education vertical
- `src/platform/real-estate/contracts/` — Real Estate vertical

---

## Structure

```
src/platform/contracts/
├─ README.md (this file)
├─ index.ts (root export)
└─ v1/
   ├─ index.ts (version export)
   ├─ InboxReceiver.ts
   └─ waitlist-engine.contract.ts
```

**Versioning:** Contracts are versioned (`v1`, `v2`, etc.) to support breaking changes without affecting existing consumers.

---

## Usage

### Importing Platform Contracts

```typescript
// Import from platform contracts (cross-vertical)
import { IWaitlistEngine } from '@/platform/contracts';

// ❌ DO NOT import from vertical contracts if you are in a different vertical
// import { IWaitlistEngine } from '@/platform/healthcare/contracts'; // WRONG: Creates vertical coupling
```

---

### Adding New Platform Contract

**Before adding:**

1. **Validate classification:** Does the contract meet all 4 platform contract criteria?
2. **Check consumers:** Will it be used by multiple verticals?
3. **Check semantics:** Is it truly generic, or does it contain vertical-specific concepts?
4. **Check alternatives:** Could it be a vertical contract or a shared utility instead?

**If YES to all above:**

1. Create contract file: `src/platform/contracts/v1/{contract-name}.contract.ts`
2. Export from: `src/platform/contracts/v1/index.ts`
3. Document in: `src/platform/contracts/README.md`
4. Create ADR if architectural change
5. Run Architecture Guard: `npm run arch:guard`
6. Commit with: `feat(platform): add {ContractName} platform contract`

---

## Related Documentation

- **ADR-006:** Temporal Platform Layer for Cross-Vertical Capabilities
- **Architecture Guard:** `npm run arch:guard` (validates platform layer compliance)
- **Healthcare Constitution:** `docs/architecture/HEALTHCARE_VERTICAL_CODING_CONSTITUTION.md`
- **Git Workflow:** `docs/architecture/GIT_WORKFLOW_CONSTITUTION.md`

---

## Current Contracts

### v1

| Contract | Purpose | Consumers | Status |
|----------|---------|-----------|--------|
| `IInboxReceiver` | Generic inbox/message handling | Multiple verticals | Active |
| `IWaitlistEngine` | Time-based queue management | Healthcare, Beauty, Auto (future), Education (future) | Active |

---

## Questions?

**Is this contract platform or vertical?**
- Run through 4 classification criteria above
- If unclear, default to vertical (safer, can promote to platform later)
- Consult architecture team if unsure

**Can I move a vertical contract to platform?**
- Yes, but requires ADR and validation
- Check for vertical-specific semantics
- Ensure no vertical coupling introduced
- Example: IWaitlistEngine moved from Healthcare to Platform (ADR-006)

**Can I move a platform contract to vertical?**
- Rarely needed (platform → vertical is usually wrong direction)
- Only if contract becomes vertical-specific over time
- Requires ADR and consumer migration plan

---

**Last Updated:** 2026-09-15  
**Authority:** Platform Architecture Team
