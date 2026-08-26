# Bella Hospital H1 — Verification Evidence

**Type:** Execution Evidence  
**Run Command:** `npx vitest run tests/integration/runtime/h1-hospital-live-clinical-core.integration.test.ts`  
**Date:** 2026-08-26  

---

## 1. Automated Integration Test Execution Log

```
 RUN  v4.1.10 D:/Antigravity/Projects/BELLA SPA ERP

 ✓ tests/integration/runtime/h1-hospital-live-clinical-core.integration.test.ts > H1.8 — H1.1 Admissions: WRITE + READ + UPDATE > reads sentinel hc_inpatient_admissions — WRITE confirmed in beforeAll 117ms
 ✓ tests/integration/runtime/h1-hospital-live-clinical-core.integration.test.ts > H1.8 — H1.1 Admissions: WRITE + READ + UPDATE > reads hc_inpatient_admissions list by tenant — at least 1 row 108ms
 ✓ tests/integration/runtime/h1-hospital-live-clinical-core.integration.test.ts > H1.8 — H1.1 Admissions: WRITE + READ + UPDATE > updates admission status to "discharged" and reads back — mutation persistence 290ms
 ✓ tests/integration/runtime/h1-hospital-live-clinical-core.integration.test.ts > H1.8 — H1.2 Beds: READ + UPDATE + READ-BACK > reads hc_beds for TenantA — at least one bed exists 95ms
 ✓ tests/integration/runtime/h1-hospital-live-clinical-core.integration.test.ts > H1.8 — H1.2 Beds: READ + UPDATE + READ-BACK > reads hc_wards for TenantA — at least one ward exists 102ms
 ✓ tests/integration/runtime/h1-hospital-live-clinical-core.integration.test.ts > H1.8 — H1.2 Beds: READ + UPDATE + READ-BACK > updates bed status to "cleaning" and reads back — mutation + persistence 394ms
 ✓ tests/integration/runtime/h1-hospital-live-clinical-core.integration.test.ts > H1.8 — H1.3 Vitals: WRITE + READ-BACK > writes hc_nursing_vital_signs — sentinel vital record 112ms
 ✓ tests/integration/runtime/h1-hospital-live-clinical-core.integration.test.ts > H1.8 — H1.3 Vitals: WRITE + READ-BACK > reads back hc_nursing_vital_signs by inpatient_admission_id — persistence confirmed 108ms
 ✓ tests/integration/runtime/h1-hospital-live-clinical-core.integration.test.ts > H1.8 — H1.4 MAR: WRITE + READ-BACK + UPDATE > writes hc_medication_administration_records — sentinel MAR record 121ms
 ✓ tests/integration/runtime/h1-hospital-live-clinical-core.integration.test.ts > H1.8 — H1.4 MAR: WRITE + READ-BACK + UPDATE > reads back hc_medication_administration_records by inpatient_admission_id — persistence confirmed 105ms
 ✓ tests/integration/runtime/h1-hospital-live-clinical-core.integration.test.ts > H1.8 — H1.4 MAR: WRITE + READ-BACK + UPDATE > updates MAR to "administered" and reads back — mutation + status persistence 195ms

 Test Files  1 passed (1)
      Tests  11 passed (11)
   Duration  4.06s
```

---

## 2. Pinned Database Identifiers (TenantA)

The integration test queries real database records with these identifiers:

*   **Tenant ID:** `c1e19d70-36ab-4a5f-a36c-92f7e7f6e05d` (Bella General Hospital)
*   **Real Patient Party ID:** `ef4d0838-5309-4f23-82c3-80d1ee687a13` (`party_parties` table)
*   **Real Patient MPI ID:** `b420e1f9-a4be-4145-86cd-cc48364e596b` (`hc_master_patient_index` table)
*   **Real Bed ID:** `ab0d634c-c94c-4c0e-b9c1-8df0fcbaec55` (`hc_beds` table)
*   **Real Ward ID:** `d5fbf272-0f03-4667-a52e-95ce927ac3c6` (`hc_wards` table)

---

## 3. Database Foreign Key Relationships Checked

The following chains were validated to prevent constraint violations:

```
party_parties ──FK──► hc_encounters.patient_party_id
hc_encounters ──FK──► hc_inpatient_admissions.encounter_id
hc_beds       ──FK──► hc_inpatient_admissions.bed_id
hc_wards      ──FK──► hc_inpatient_admissions.ward_id
hc_inpatient_admissions ──FK──► hc_nursing_vital_signs.inpatient_admission_id
hc_inpatient_admissions ──FK──► hc_medication_administration_records.inpatient_admission_id
```
