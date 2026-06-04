export type Numberish = string | number | null | undefined;

export type FinancialReconciliationTab = 'debt' | 'orphan' | 'mismatch' | 'history' | 'clearing';

export type PaymentMethod = 'bank_transfer' | 'cash';

export type ProfileRow = {
  tenant_id: string | null;
  role: string | null;
};

export type DebtAlert = {
  booking_id: string;
  customer_id?: string | null;
  customer_name?: string | null;
  package_name?: string | null;
  full_price?: Numberish;
  total_paid?: Numberish;
  debt?: Numberish;
};

export type OrphanedRevenue = {
  revenue_id: string;
  revenue_type?: string | null;
  received_date?: string | null;
  notes?: string | null;
  amount?: Numberish;
};

export type MismatchAlert = DebtAlert & {
  mismatch?: Numberish;
};

export type CollectionHistory = {
  revenue_id: string;
  amount: Numberish;
  received_date: string | null;
  notes: string | null;
  payment_method: string | null;
  booking_id: string | null;
  customer_name: string;
};

export type FinancialAnomaliesData = {
  debt_alerts: DebtAlert[];
  orphaned_revenue: OrphanedRevenue[];
  mismatch_alerts: MismatchAlert[];
  collection_history: CollectionHistory[];
};

export type FinancialAnomaliesRpcData = Partial<Omit<FinancialAnomaliesData, 'collection_history'>>;

export type RevenueHistoryRow = {
  id: string;
  amount: Numberish;
  received_date: string | null;
  notes: string | null;
  payment_method: string | null;
  booking_id: string | null;
  bookings?: {
    customers?: {
      name_mother?: string | null;
      name_baby?: string | null;
    } | null;
  } | null;
};

export type LegacyProfilesClient = {
  from(table: 'profiles'): {
    select(columns: string): {
      eq(column: string, value: string): {
        single(): Promise<{ data: ProfileRow | null; error: unknown }>;
      };
    };
  };
};
