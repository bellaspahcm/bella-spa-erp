# Dental Root Cause Classification

**Date:** 2026-09-08  
**Baseline:** 66 diagnostics (clean, no violations)

## Classification by Root Cause

### Cluster 1: Schema/Property Mismatch (15 errors)

**Pattern:** Code references fields that don't exist in DB types

| Line | Error | Field | Table | Root Cause |
|------|-------|-------|-------|------------|
| 673 | Property 'id' does not exist | `currentEnc.id` | Result type | Query returns partial shape |
| 722-724, 728 | Properties don't exist on `{}` | name_mother, gender_baby, dob_baby, phone | customers | custMap.get() returns `{} \| undefined` |
| 996-999 | subjective_notes, objective_notes, assessment_notes, plan_notes | - | hc_encounters | Fields don't exist in schema |
| 1712 | patient_name | - | hc_lab_results | Field doesn't exist |
| 1980-1982 | series_count, image_count, storage_size | - | hc_imaging_results | Fields don't exist |
| 2974-2978 | chief_complaint, subjective, objective, assessment, plan | - | NonNullable<ResultOne> | Wrong query result shape |
| 3545, 3548 | display_name | party_parties | hc_prescriptions | Ambiguous FK relationship |

**Remediation:** Fix query contracts, narrow types, add proper joins

---

### Cluster 2: Insert/Update Payload Mismatch (9 errors)

**Pattern:** Payload has excess properties or missing required fields

| Line | Error | Issue | Table |
|------|-------|-------|-------|
| 338 | Missing encounter_type, period_start | Required fields | hc_encounters |
| 586 | Record<string, unknown> not assignable | Update payload type | hc_encounters |
| 1089 | 'name' does not exist | Wrong field | journey_journeys |
| 1213 | Missing encounter_type, period_start | Required fields | hc_encounters |
| 1248 | patient_party_id excess property | Not in schema | hc_patient_queues |
| 1442 | Missing encounter_type, period_start | Required fields | hc_encounters |
| 1896, 3334, 3379 | 'status' excess property | Not in insert | hc_clinical_orders |
| 100 (pharmacy) | 'patient_id' excess property | Not in schema | hc_clinical_orders |

**Remediation:** Fix payload structure to match DB Insert types, add required fields

---

### Cluster 3: Nullability Mismatch (17 errors)

**Pattern:** `string | null | undefined` → `string` type conflict

| Lines | Pattern | Context |
|-------|---------|---------|
| 1273, 1324, 1779, 1804, 2195, 2220 | `string \| undefined` → `string` | testMeta/modalMeta properties |
| 1281, 1293, 1332 | `string \| null` → `string` | Lab/imaging sample_type, tube_color |
| 1789, 1823, 1841, 1947, 2205, 2239 | `string \| undefined/null` → `string` | Party IDs, modality fields |
| 3090 (2x) | baseSalary, commission possibly null | Arithmetic operation |
| 3098-3102 | `number \| null` → `number`, `string \| null` → `string` | Payroll fields |

**Remediation:** Add null guards, use optional chaining, provide defaults OR fix ViewModel to accept null

---

### Cluster 4: ViewModel/Mapper Type Mismatch (5 errors)

**Pattern:** Mapped data shape doesn't match interface

| Line | Error | Issue |
|------|-------|-------|
| 401 | Encounter type conversion | Missing patient_id, customer_id, practitioner_id, facility_id |
| 929 | EncounterViewModel[] | startedAt: `string \| null` vs `string \| undefined` |
| 2148 | ImagingOrderViewModel[] | status: `string` vs literal union `'pending' \| 'reported' \| 'captured'` |
| 2652 | MedicationOrderDetails | Missing 'description' property |
| 2824 | HealthcareInvoiceViewModel[] | status: `string` vs `'paid' \| 'unpaid'` |

**Remediation:** Fix ViewModel interfaces to match data reality OR add proper mapping/narrowing

---

### Cluster 5: Other Issues (20 errors)

**Pattern:** Miscellaneous type errors

| Line | Error | Issue |
|------|-------|-------|
| 971 | status comparison | `'in_progress' \| ...` vs `'completed'` no overlap |
| 2784, 2920 | .catch() doesn't exist | Postgrest API misuse |
| 2943-2947 | .from('encounters') | Wrong table name (should be 'hc_encounters') |
| 3527 | Json array indexing | `[0]` on Json union type |
| 33 (pharmacy) | Json → string[] | Type cast needed |
| 164 (pharmacy) | string → never | Update payload type |

**Remediation:** Individual fixes per issue

---

## Remediation Priority

```text
Priority 1: Cluster 2 (Payload Mismatch)     — 9 errors, blocking inserts
Priority 2: Cluster 1 (Schema Mismatch)      — 15 errors, data contract issues
Priority 3: Cluster 3 (Nullability)          — 17 errors, systematic pattern
Priority 4: Cluster 4 (ViewModel)            — 5 errors, interface fixes
Priority 5: Cluster 5 (Other)                — 20 errors, individual

Total: 66 diagnostics
```

## Remediation Principles

**✅ Allowed:**
- Proper null guards: `field || null`, `field ?? 'default'`
- Type narrowing: `if (!field) throw Error`
- ViewModel interface fixes to match reality
- Query contract corrections
- Mapper functions with explicit logic

**❌ Forbidden:**
- `as any` / `as unknown as Type`
- `@ts-ignore` / `@ts-expect-error` without justification
- Non-null assertion `!` to silence compiler
- Fake defaults that lose business meaning
- Schema field inventions

## Next Steps

1. **Fix Cluster 2** — Add missing required fields, remove excess properties
2. **Fix Cluster 1** — Correct query contracts and property access
3. **Fix Cluster 3** — Systematic nullability guards
4. **Fix Cluster 4** — ViewModel interface alignment
5. **Fix Cluster 5** — Individual targeted fixes
6. **Verify:** 0 diagnostics, 0 new violations
