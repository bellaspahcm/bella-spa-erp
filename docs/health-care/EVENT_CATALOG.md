# Domain Event Catalog — Bella Healthcare Platform

Danh mục sự kiện miền (Event Catalog) chuẩn hóa cấu trúc dữ liệu truyền nhận giữa các Bounded Contexts và làm nguồn dữ liệu đầu vào cho AI Model Training & Telemetry.

---

## 📋 Standardized Event Schema Contract

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "DomainEventEnvelope",
  "type": "OBJECT",
  "properties": {
    "metadata": {
      "type": "OBJECT",
      "properties": {
        "eventId": { "type": "STRING", "format": "uuid" },
        "aggregateId": { "type": "STRING" },
        "aggregateType": { "type": "STRING", "enum": ["Encounter", "Patient", "Chair", "Prescription", "CarePath"] },
        "eventName": { "type": "STRING" },
        "tenantId": { "type": "STRING" },
        "userId": { "type": "STRING" },
        "causationId": { "type": "STRING", "format": "uuid" },
        "correlationId": { "type": "STRING", "format": "uuid" },
        "schemaVersion": { "type": "STRING" },
        "occurredAt": { "type": "STRING", "format": "date-time" }
      },
      "required": ["eventId", "aggregateId", "aggregateType", "eventName", "tenantId", "correlationId", "schemaVersion", "occurredAt"]
    },
    "payload": { "type": "OBJECT" }
  },
  "required": ["metadata", "payload"]
}
```

---

## ⚡ Active Domain Events List

### 1. `Scheduling.Appointment.Created.v1`
- **Context**: Scheduling Context
- **Payload Contract**:
  ```typescript
  interface AppointmentCreatedPayload {
    appointmentId: string;
    patientId: string;
    doctorId: string;
    scheduledAt: string;
    chiefComplaint: string;
  }
  ```

### 2. `Encounter.Patient.Arrived.v1`
- **Context**: Encounter Context
- **Payload Contract**:
  ```typescript
  interface EncounterArrivedPayload {
    encounterId: string;
    patientId: string;
    queueNumber: number;
    arrivedAt: string;
  }
  ```

### 3. `Clinical.Tooth.Updated.v1`
- **Context**: Clinical Context
- **Payload Contract**:
  ```typescript
  interface ToothUpdatedPayload {
    patientId: string;
    toothNumber: string;
    status: 'healthy' | 'decayed' | 'crowned' | 'implanted' | 'missing';
    notes?: string;
  }
  ```

### 4. `Pharmacy.Prescription.Created.v1`
- **Context**: Pharmacy Context
- **Payload Contract**:
  ```typescript
  interface PrescriptionCreatedPayload {
    encounterId: string;
    prescriptionId: string;
    drugs: Array<{
      code: string; // Mã ATC thuốc
      name: string;
      dosage: string;
    }>;
  }
  ```
