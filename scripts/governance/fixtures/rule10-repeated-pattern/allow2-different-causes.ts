// ALLOW: multiple diagnostics but different root causes
// Expected verdict: ALLOW (exit 0)

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

interface MixedData {
  patientId: string;        // diagnostic 1: camelCase (schema drift)
  appointmentTime: string;  // diagnostic 2: camelCase (schema drift)
  doctorName: string;       // diagnostic 3: non-existent field (missing property)
  roomInfo: string;         // diagnostic 4: nullable → non-null (nullability)
}

export function mixedMapper(
  patient: PatientRow,
  appointment: AppointmentRow
): MixedData {
  // ✅ ALLOW: 4 diagnostics but each has different root cause
  return {
    patientId: patient.id,
    appointmentTime: appointment.scheduled_at,
    doctorName: (appointment as any).doctor,
    roomInfo: appointment.notes!,
  };
}
