// BLOCK: same nullability pattern repeated 5 times (threshold: 3)
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

interface PatientData {
  id: string;
  phone: string;    // ❌ pattern 1: nullable → non-null without validation
  email: string;    // ❌ pattern 2: nullable → non-null without validation
  address: string;  // ❌ pattern 3: nullable → non-null without validation
  city: string;     // ❌ pattern 4: nullable → non-null without validation
  zipcode: string;  // ❌ pattern 5: nullable → non-null without validation
}

export function mapPatient(row: PatientRow): PatientData {
  return {
    id: row.id,
    phone: row.phone!,     // ! operator without null check
    email: row.email!,     // ! operator without null check
    address: row.address!, // ! operator without null check
    city: row.city!,       // ! operator without null check
    zipcode: row.zipcode!, // ! operator without null check
  };
}
