/**
 * Type definitions for Finance P&L Summary Component
 * Separated to avoid export/import issues with TypeScript strict mode
 */

export interface PnLData {
  month_year: string;
  total_revenue: number;
  total_operating_expenses: number;
  total_ktv_salaries: number;
  net_profit: number;
  total_bookings: number;
  total_sessions_completed: number;
  is_locked: boolean;
}

export interface ServicePerformance {
  package_name: string;
  total_bookings: number;
  total_revenue: number;
  total_ktv_cost: number;
  net_service_profit: number;
  profit_margin_percent: number;
}
