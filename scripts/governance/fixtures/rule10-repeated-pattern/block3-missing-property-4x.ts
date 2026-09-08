// BLOCK: accessing missing property pattern repeated 4 times
// Expected verdict: BLOCK (exit 2)

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

interface DataAggregation {
  patient_specialty: string;    // ❌ pattern 1: accessing non-existent field
  appointment_room: string;     // ❌ pattern 2: accessing non-existent field
  patient_insurance: string;    // ❌ pattern 3: accessing non-existent field
  appointment_provider: string; // ❌ pattern 4: accessing non-existent field
}

export function aggregateData(
  patient: PatientRow,
  appointment: AppointmentRow
): DataAggregation {
  return {
    patient_specialty: (patient as any).specialty,
    appointment_room: (appointment as any).room_number,
    patient_insurance: (patient as any).insurance_provider,
    appointment_provider: (appointment as any).provider_name,
  };
}
