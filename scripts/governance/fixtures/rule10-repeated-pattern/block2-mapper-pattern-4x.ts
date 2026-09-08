// BLOCK: incomplete mapper pattern repeated 4 times
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
type ProductRow = Database['public']['Tables']['products']['Row'];
type InventoryRow = Database['public']['Tables']['inventory_movements']['Row'];

// ❌ pattern 1: incomplete mapper (missing fields)
export function mapPatient(row: PatientRow) {
  return {
    id: row.id,
    name: row.first_name,
    // missing: last_name, date_of_birth, etc.
  };
}

// ❌ pattern 2: incomplete mapper
export function mapAppointment(row: AppointmentRow) {
  return {
    id: row.id,
    patient: row.patient_id,
    // missing: scheduled_at, status, etc.
  };
}

// ❌ pattern 3: incomplete mapper
export function mapProduct(row: ProductRow) {
  return {
    id: row.id,
    name: row.name,
    // missing: sku, price, stock_quantity
  };
}

// ❌ pattern 4: incomplete mapper
export function mapInventory(row: InventoryRow) {
  return {
    id: row.id,
    product: row.product_id,
    // missing: quantity, movement_type, created_at
  };
}
