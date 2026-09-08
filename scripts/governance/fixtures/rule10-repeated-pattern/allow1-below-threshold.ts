// ALLOW: pattern repeated only 3 times (at threshold, not over)
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

interface PatientContact {
  id: string;
  phone: string;
  email: string;
  address: string;
}

export function mapContact(row: PatientRow): PatientContact {
  // ✅ ALLOW: 3 nullable fields (exactly at threshold, not blocking)
  return {
    id: row.id,
    phone: row.phone || 'N/A',
    email: row.email || 'N/A',
    address: row.address || 'N/A',
  };
}
