/**
 * Spa Dashboard Widgets
 * 
 * Dashboard components specific to the spa module.
 * These components wrap or extend core dashboard widgets with spa-specific logic.
 * 
 * @module spa/components/dashboard
 */

'use client';

// Re-export existing dashboard components for now
// These act as facades while we establish the module boundary
export { KtvPerformanceTable } from '@/components/features/dashboard/KtvPerformanceTable';
export { RevenueChart } from '@/components/features/dashboard/RevenueChart';
export { StatsGrid } from '@/components/features/dashboard/StatsGrid';

// TODO: Create spa-specific dashboard widgets:
// - SpaBookingsTodayWidget
// - SpaRevenueChartWidget  
// - KtvLeaderboardWidget
// - SessionCompletionWidget
// - PackageUsageWidget
