/**
 * BLOCK2: Missing required property (TS2741)
 * 
 * Expected: Rule 2 BLOCK
 * Reason: AppointmentInsert missing required field at schema boundary
 */

type AppointmentInsert = {
  patient_id: string;
  service_id: string;
  appointment_date: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  created_by: string;
};

// ❌ TS2741: Missing required property 'created_by'
const appointment: AppointmentInsert = {
  patient_id: "P123",
  service_id: "S456",
  appointment_date: "2024-09-10T10:00:00Z",
  status: "scheduled",
  // created_by missing
};

export {};
