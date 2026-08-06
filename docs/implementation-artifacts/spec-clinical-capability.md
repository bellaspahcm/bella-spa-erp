# Capability Specification (RFC): Clinical & EMR Capability

> **Capability Name:** `clinical`  
> **Package Version:** `1.0.0`  
> **Schema Version:** `1.0`  
> **Domain:** `healthcare`  
> **Status:** `production`  

---

## 1. Purpose & Scope

Capability `clinical` cung cấp các tính năng quản lý lâm sàng y tế cốt lõi bao gồm: Tiếp nhận bệnh nhân, Sinh hiệu (Vitals), Hồ sơ bệnh án EMR, Lượt khám (`Encounter` Aggregate Root), Diễn tiến bệnh, và Khám lâm sàng.

---

## 2. Dependencies & Package Contract

```json
{
  "schemaVersion": "1.0",
  "capabilityVersion": "1.0.0",
  "apiVersion": "v1",
  "migrationVersion": "1",
  "capability": "clinical",
  "status": "production",
  "requires": ["patient", "practitioner", "facility", "terminology"],
  "optional": ["clinical_orders", "laboratory", "imaging", "billing"],
  "permissions": [
    "clinical.encounter.create",
    "clinical.encounter.read",
    "clinical.encounter.update",
    "clinical.vitals.record"
  ],
  "apiContracts": [
    "POST /api/v1/healthcare/encounters",
    "GET /api/v1/healthcare/encounters/:id",
    "POST /api/v1/healthcare/encounters/:id/vitals"
  ],
  "events": [
    "EncounterStarted.v1",
    "EncounterCompleted.v1"
  ]
}
```

---

## 3. Domain Model (Entities, Aggregates & Value Objects)

- **Aggregate Root:** `Encounter`
- **Entities:** `EncounterVital`, `ClinicalNote`, `DiagnosisItem`
- **Value Objects:** `BPValue` (Systolic/Diastolic), `BMICalculator`, `ICD10Code`

---

## 4. Commands & Queries

- `StartEncounterCommand({ patientId, practitionerId, facilityId, reason })`
- `RecordVitalsCommand({ encounterId, bp, heartRate, temp, weight, height })`
- `CompleteEncounterCommand({ encounterId, summary })`
- `GetEncounterDetailsQuery({ encounterId })`

---

## 5. Domain Events Emitted

- `EncounterStarted.v1`: `{ encounterId, patientId, practitionerId, timestamp }`
- `EncounterCompleted.v1`: `{ encounterId, patientId, summary, timestamp }`

---

## 6. Security & Permission Matrix

| Role | Read Encounter | Create Encounter | Record Vitals | Complete Encounter |
| :--- | :---: | :---: | :---: | :---: |
| `Doctor` | ✅ | ✅ | ✅ | ✅ |
| `Nurse` | ✅ | ❌ | ✅ | ❌ |
| `Receptionist` | ✅ | ❌ | ❌ | ❌ |
