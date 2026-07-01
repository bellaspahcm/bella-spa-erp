/**
 * Type definitions for Materialized Views
 * 
 * These types mirror the structure of materialized views created in Supabase.
 * They extend the auto-generated Database types to support MV queries.
 */

/**
 * mv_ktv_performance_summary row type
 */
export interface MvKtvPerformanceSummary {
  ktv_id: string;
  tenant_id: string;
  ktv_name: string;
  ktv_email: string;
  ktv_phone: string | null;
  month: string;
  
  // Session metrics
  total_sessions_completed: number;
  total_sessions_cancelled: number;
  total_sessions_no_show: number;
  total_sessions_all: number;
  completion_rate_pct: number;
  
  // Rating metrics
  avg_rating: number;
  high_ratings_count: number;
  low_ratings_count: number;
  total_ratings_count: number;
  
  // Revenue metrics
  total_revenue: number;
  avg_revenue_per_session: number;
  
  // Commission metrics
  total_service_commission: number;
  total_session_bonus: number;
  
  // Attendance metrics
  days_present: number;
  days_absent: number;
  days_late: number;
  total_attendance_days: number;
  attendance_rate_pct: number;
  
  // Metadata
  last_session_date: string | null;
  unique_customers_served: number;
  computed_at: string;
}

/**
 * mv_inventory_status row type
 */
export interface MvInventoryStatus {
  product_id: string;
  tenant_id: string;
  product_name: string;
  category: string;
  sku: string | null;
  unit_of_measure: string | null;
  
  // Stock info
  current_stock: number;
  reorder_point: number;
  reorder_quantity: number;
  max_stock_level: number;
  stock_status: 'out_of_stock' | 'low_stock' | 'medium_stock' | 'high_stock';
  stock_value: number;
  
  // Usage metrics
  usage_last_30_days: number;
  avg_daily_usage: number;
  days_until_stockout: number | null;
  
  // Supplier info
  supplier_id: string | null;
  supplier_name: string | null;
  supplier_contact: string | null;
  supplier_phone: string | null;
  supplier_email: string | null;
  supplier_lead_time_days: number;
  
  // Reorder recommendation
  reorder_recommendation: 'urgent' | 'recommended' | 'suggested' | 'not_needed';
  suggested_reorder_date: string | null;
  
  // Metadata
  last_restock_date: string | null;
  last_restock_quantity: number | null;
  last_usage_date: string | null;
  inventory_updated_at: string;
  computed_at: string;
}

/**
 * mv_session_analytics row type
 */
export interface MvSessionAnalytics {
  tenant_id: string;
  date: string;
  
  // Session counts
  total_sessions: number;
  completed_sessions: number;
  cancelled_sessions: number;
  no_show_sessions: number;
  scheduled_sessions: number;
  in_progress_sessions: number;
  
  // Rates
  completion_rate_pct: number;
  cancellation_rate_pct: number;
  no_show_rate_pct: number;
  
  // Package distribution
  basic_package_sessions: number;
  premium_package_sessions: number;
  vip_package_sessions: number;
  
  // Peak hours
  morning_sessions: number;
  afternoon_sessions: number;
  evening_sessions: number;
  peak_hour: number;
  
  // Satisfaction
  avg_satisfaction_rating: number;
  high_satisfaction_count: number;
  medium_satisfaction_count: number;
  low_satisfaction_count: number;
  total_ratings: number;
  
  // Duration
  avg_duration_minutes: number;
  max_duration_minutes: number | null;
  min_duration_minutes: number | null;
  
  // Revenue
  total_revenue: number;
  avg_revenue_per_session: number;
  
  // Metrics
  unique_customers: number;
  unique_ktvs: number;
  successful_quality_sessions: number;
  quality_success_rate_pct: number;
  
  // Metadata
  computed_at: string;
}
