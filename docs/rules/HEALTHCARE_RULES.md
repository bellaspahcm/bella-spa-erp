# Healthcare Domain Coding Rules

**Applicability:** All Healthcare verticals (Hospital, Clinic, Dental, etc.)  
**Constitution Ref:** `docs/architecture/HEALTHCARE_VERTICAL_CODING_CONSTITUTION.md`

---

## 1. Frozen Kernel Invariant (Law 1)

*   **Rule:** The core Healthcare Kernel engines (H1-H12) are **FROZEN**.
*   ❌ **FORBIDDEN:** Creating new core engine folders (e.g. `H13-some-engine`) or directly modifying existing core engine classes.
*   ✅ **MANDATORY:** Add vertical-specific capabilities in the Product Vertical Layer (`src/products/` or `src/platform/healthcare/verticals/`) using public contracts.

---

## 2. Encounter Aggregate Root (Law 12)

*   **Rule:** Every clinical action must be anchored to an Encounter.
*   ❌ **FORBIDDEN:** Recording vitals, administering meds, or performing procedures without a valid `encounter_id`.
*   ✅ **MANDATORY:** Ensure database tables have an `encounter_id` column and establish a foreign key pointing to `hc_encounters`.

---

## 3. No Duplication of Core Entities (Law 5)

*   **Rule:** Avoid duplicate models for generic clinical concepts.
*   ❌ **FORBIDDEN:** Creating tables like `dental_patients`, `clinic_doctors`, `hospital_vitals`.
*   ✅ **MANDATORY:** Reference the standard kernel entities (`hc_master_patient_index`, `hc_nursing_vital_signs`) and extend via metadata, composition, or custom fields.

---

## 4. 11 Verification Gates (Law 10)

Every new healthcare feature must pass the 11 automated verification gates.

1.  **Architecture Compliance** — verifies boundaries, no `any`.
2.  **Contract Boundary** — no direct internal table queries.
3.  **Tenant Isolation (P0)** — data is isolated between Tenant A and B.
4.  **RLS & Auth** — row-level security is active.
5.  **Database Migration Safety** — changes are purely additive.
6.  **Event-After-Persistence** — commit completes before publishing events.
7.  **Clinical Safety Routing** — CDS/rules go through H8/H10.
8.  **Temporal Provenance** — bitemporal timeline checks (H9).
9.  **Rule Governance** — checks rules checksum (H10).
10. **Audit & Evidence** — creates H11 evidence packets.
11. **Full Kernel Regression** — all test suites pass.
