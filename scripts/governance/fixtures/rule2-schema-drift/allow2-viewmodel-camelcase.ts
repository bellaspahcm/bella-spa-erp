/**
 * ALLOW2: ViewModel with camelCase (not schema boundary)
 * 
 * Expected: Rule 2 ALLOW
 * Reason: AppointmentViewModel is NOT a DB schema type, camelCase is fine
 */

// This is a ViewModel for UI, NOT a database schema type
type AppointmentViewModel = {
  patientName: string;
  serviceName: string;
  appointmentTime: string;
  status: string;
};

// ✓ Valid: ViewModel can use camelCase, not bound to DB schema
const viewModel: AppointmentViewModel = {
  patientName: "John Doe",
  serviceName: "Massage",
  appointmentTime: "10:00 AM",
  status: "Scheduled",
};

export {};
