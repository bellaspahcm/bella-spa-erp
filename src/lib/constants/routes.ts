/**
 * Centralized Route Constants
 * 
 * CRITICAL: Always use these constants instead of hardcoding paths.
 * When moving files, update these constants and search for any remaining hardcoded references.
 */

// ============================================================================
// DASHBOARD ROUTES
// ============================================================================

export const ROUTES = {
  // Auth
  LOGIN: '/login',
  LOGOUT: '/logout',
  
  // Main Dashboard
  DASHBOARD: '/dashboard',
  
  // Intelligence & AI
  AI_COPILOT: '/dashboard/ai-copilot',
  FORECAST: '/dashboard/forecast',
  RECOMMENDATIONS: '/dashboard/recommendations',
  SALARY_RECONCILIATION: '/dashboard/ai-copilot/salary-reconciliation',
  
  // Customer & Services
  CUSTOMERS: '/dashboard/customers',
  BOOKINGS: '/dashboard/bookings',
  BOOKINGS_POS: '/dashboard/bookings?surface=pos',
  SESSIONS: '/dashboard/sessions',
  CHAT: '/dashboard/chat',
  CRM: '/dashboard/crm',
  MARKETING: '/dashboard/marketing',
  SERVICES: '/dashboard/services',
  TRAINING: '/dashboard/training',
  
  // Finance & Reconciliation
  FINANCE: '/dashboard/finance',
  FINANCE_PNL: '/dashboard/finance/pnl',
  FINANCE_CASH_FLOW: '/dashboard/finance/cash-flow',
  FINANCE_BUDGET: '/dashboard/finance/budget',
  FINANCE_RECONCILIATION: '/dashboard/finance/reconciliation',
  SALARY: '/dashboard/salary',
  ACCOUNTING: '/dashboard/accounting',
  INVENTORY: '/dashboard/inventory',
  PRODUCT_SALES: '/dashboard/product-sales',
  
  // System
  ADMIN_PARTNERS: '/dashboard/admin/partners',
  SYSTEM_MONITOR: '/dashboard/system-monitor',
  AUDIT: '/dashboard/audit',
  GUIDES: '/dashboard/guides',
  SETTINGS: '/dashboard/settings',
  
  // KTV Portal
  KTV_DASHBOARD: '/ktv/dashboard',
  KTV_EARNINGS: '/ktv/earnings',
  
  // Customer Portal
  CUSTOMER_PORTAL: '/dashboard/customer',
  CUSTOMER_HISTORY: '/dashboard/customer/history',
  CUSTOMER_NOTIFICATIONS: '/dashboard/customer/notifications',
  CUSTOMER_PROFILE: '/dashboard/customer/profile',
} as const;

// ============================================================================
// API ROUTES
// ============================================================================

export const API_ROUTES = {
  // Intelligence - Forecast
  FORECAST_REVENUE: '/api/intelligence/forecast/revenue',
  FORECAST_CHURN: '/api/intelligence/forecast/churn',
  FORECAST_DEMAND: '/api/intelligence/forecast/demand',
  FORECAST_ALL: '/api/intelligence/forecast/all',
  FORECAST_ACCURACY: '/api/intelligence/forecast/accuracy',
  
  // Intelligence - Recommendations
  RECOMMENDATION_SERVICE: '/api/intelligence/recommendation/service',
  RECOMMENDATION_PACKAGE: '/api/intelligence/recommendation/package',
  RECOMMENDATION_UPSELL: '/api/intelligence/recommendation/upsell',
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build a route with query parameters
 * @example buildRoute(ROUTES.BOOKINGS, { surface: 'pos' }) // '/dashboard/bookings?surface=pos'
 */
export function buildRoute(path: string, params?: Record<string, string | number | boolean>): string {
  if (!params || Object.keys(params).length === 0) {
    return path;
  }
  
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    searchParams.set(key, String(value));
  });
  
  return `${path}?${searchParams.toString()}`;
}

/**
 * Build an API route with query parameters
 * @example buildApiRoute(API_ROUTES.FORECAST_REVENUE, { tenant_id: '123', months: 12 })
 */
export function buildApiRoute(path: string, params: Record<string, string | number | boolean>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    searchParams.set(key, String(value));
  });
  
  return `${path}?${searchParams.toString()}`;
}

/**
 * Check if current path matches a route
 * @example isCurrentRoute('/dashboard/forecast', ROUTES.FORECAST) // true
 */
export function isCurrentRoute(pathname: string, route: string): boolean {
  // Remove trailing slashes for comparison
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  const normalizedRoute = route.replace(/\/+$/, '') || '/';
  
  return normalizedPath === normalizedRoute || normalizedPath.startsWith(`${normalizedRoute}/`);
}
