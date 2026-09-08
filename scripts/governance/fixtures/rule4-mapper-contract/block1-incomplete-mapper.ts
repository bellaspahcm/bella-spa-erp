/**
 * BLOCK1: Incomplete mapper (TS2741)
 * 
 * Expected: Rule 4 BLOCK
 * Reason: Mapper missing required property 'status' for AppointmentInsert
 */

type AppointmentInsert = {
  patient_id: string;
  service_id: string;
  appointment_date: string;
  status: 'scheduled' | 'completed' | 'cancelled'; // Required
  created_by: string;
};

function mapToAppointmentInsert(raw: {
  patientId: string;
  serviceId: string;
  date: string;
  createdBy: string;
}): AppointmentInsert {
  // ❌ TS2741: Property 'status' is missing
  return {
    patient_id: raw.patientId,
    service_id: raw.serviceId,
    appointment_date: raw.date,
    created_by: raw.createdBy,
    // status missing — incomplete mapper contract
  };
}

export {};
