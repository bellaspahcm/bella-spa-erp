// BLOCK: declared count doesn't match actual diagnostic count
// Expected verdict: BLOCK (exit 2)
// Declare 2 diagnostics but file has 5

// Mock database types for testing
type Database = {
  public: {
    Tables: {
      patients: {
        Row: {
          id: string;
          first_name: string;
          last_name: string;
          date_of_birth: string;
          phone: string | null;
          email: string | null;
          address: string | null;
          city: string | null;
          zipcode: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['patients']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['patients']['Insert']>;
      };
      appointments: {
        Row: {
          id: string;
          patient_id: string;
          scheduled_at: string;
          status: string;
          notes: string | null;
          duration_minutes: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['appointments']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['appointments']['Insert']>;
      };
      products: {
        Row: {
          id: string;
          name: string;
          sku: string;
          price: number;
          stock_quantity: number;
          description: string | null;
          category_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['products']['Insert']>;
      };
      inventory_movements: {
        Row: {
          id: string;
          product_id: string;
          quantity: number;
          movement_type: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['inventory_movements']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['inventory_movements']['Insert']>;
      };
    };
  };
};

type PatientRow = Database['public']['Tables']['patients']['Row'];
type AppointmentRow = Database['public']['Tables']['appointments']['Row'];

interface TestDTO {
  patientId: string;      // diagnostic 1
  firstName: string;      // diagnostic 2
  appointmentId: string;  // diagnostic 3
  scheduledTime: string;  // diagnostic 4
  doctorName: string;     // diagnostic 5
}

export function mapData(patient: PatientRow, appointment: AppointmentRow): TestDTO {
  return {
    patientId: patient.id,
    firstName: patient.first_name,
    appointmentId: appointment.id,
    scheduledTime: appointment.scheduled_at,
    doctorName: (appointment as any).doctor,
  };
}
