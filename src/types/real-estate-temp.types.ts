/**
 * Real Estate Partner Portal - Temporary TypeScript Types
 * 
 * IMPORTANT: This is a temporary type definition file.
 * After applying the migration to Supabase, regenerate proper types with:
 * 
 *   npx supabase gen types typescript --project-ref YOUR_PROJECT_REF > src/types/database.types.ts
 * 
 * Then replace these imports with the generated types.
 */

// =====================================================
// ENUM TYPES
// =====================================================

export type ReProductType = 
  | 'apartment'
  | 'townhouse'
  | 'shophouse'
  | 'villa'
  | 'land_plot'
  | 'office';

export type ReProductStatus = 
  | 'available'
  | 'booked'
  | 'deposited'
  | 'contracted'
  | 'paid'
  | 'handed_over'
  | 'cancelled';

export type ReReservationStatus = 
  | 'active'
  | 'released'
  | 'expired'
  | 'converted';

export type ReCommissionStatus = 
  | 'pending'
  | 'approved'
  | 'paid'
  | 'cancelled';

export type ReDocumentType = 
  | 'brochure'
  | 'price_list'
  | 'legal_docs'
  | 'bank_policy'
  | 'faq'
  | 'training'
  | 'contract_template'
  | 'other';

export type ReTransactionType = 
  | 'booking'
  | 'deposit'
  | 'contract'
  | 'payment_milestone'
  | 'adjustment';

// =====================================================
// TABLE ROW TYPES (Select)
// =====================================================

export interface RealEstateProjectRow {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  location: string | null;
  developer: string | null;
  total_units: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface RealEstateProductRow {
  id: string;
  tenant_id: string;
  project_id: string;
  product_code: string;
  product_type: ReProductType;
  block: string | null;
  floor: string | null;
  area: number;
  unit_price: number;
  status: ReProductStatus;
  owner_name: string | null;
  owner_contact: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface ReReservationRow {
  id: string;
  tenant_id: string;
  product_id: string;
  user_id: string;
  customer_id: string | null;
  status: ReReservationStatus;
  expires_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface ReCommissionLedgerRow {
  id: string;
  tenant_id: string;
  user_id: string;
  product_id: string | null;
  reservation_id: string | null;
  transaction_type: ReTransactionType;
  base_amount: number;
  commission_rate: number | null;
  commission_amount: number;
  status: ReCommissionStatus;
  earned_date: string;
  approved_date: string | null;
  paid_date: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface ReDocumentRow {
  id: string;
  tenant_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  document_type: ReDocumentType;
  file_url: string;
  file_name: string;
  file_size_bytes: number | null;
  version: string;
  is_latest: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface RePartnerLeadRow {
  id: string;
  tenant_id: string;
  user_id: string;
  name: string;
  phone: string;
  email: string | null;
  budget: string | null;
  status: string;
  protected_until: string;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

// =====================================================
// TABLE INSERT TYPES
// =====================================================

export type RealEstateProjectInsert = Omit<RealEstateProjectRow, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type RealEstateProductInsert = Omit<RealEstateProductRow, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type ReReservationInsert = Omit<ReReservationRow, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type ReCommissionLedgerInsert = Omit<ReCommissionLedgerRow, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type ReDocumentInsert = Omit<ReDocumentRow, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type RePartnerLeadInsert = Omit<RePartnerLeadRow, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

// =====================================================
// TABLE UPDATE TYPES
// =====================================================

export type RealEstateProjectUpdate = Partial<RealEstateProjectInsert>;
export type RealEstateProductUpdate = Partial<RealEstateProductInsert>;
export type ReReservationUpdate = Partial<ReReservationInsert>;
export type ReCommissionLedgerUpdate = Partial<ReCommissionLedgerInsert>;
export type ReDocumentUpdate = Partial<ReDocumentInsert>;
export type RePartnerLeadUpdate = Partial<RePartnerLeadInsert>;

// =====================================================
// RPC TYPES
// =====================================================

export interface ReserveProductParams {
  p_tenant_id: string;
  p_product_id: string;
  p_user_id: string;
  p_customer_id: string | null;
  p_duration_minutes: number;
}

export interface ReserveProductResponse {
  success: boolean;
  error?: string;
  reservation_id?: string;
  expires_at?: string;
}

// =====================================================
// HELPER TYPES FOR JOINS
// =====================================================

export interface RealEstateProductWithProject extends RealEstateProductRow {
  real_estate_projects?: Pick<RealEstateProjectRow, 'name'>;
}

export interface ReReservationWithRelations extends ReReservationRow {
  real_estate_products?: RealEstateProductWithProject;
  customers?: {
    name_mother?: string;
  };
}

export interface ReCommissionWithProduct extends ReCommissionLedgerRow {
  real_estate_products?: RealEstateProductWithProject;
}

export interface ReDocumentWithProject extends ReDocumentRow {
  real_estate_projects?: Pick<RealEstateProjectRow, 'name'>;
}
