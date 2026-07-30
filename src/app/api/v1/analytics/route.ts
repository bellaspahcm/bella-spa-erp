/**
 * Analytics API - v1
 * 
 * Public API for partners (such as Bella EOS) to fetch CEO dashboard and analytics data.
 * Protected by API Key middleware and sandbox routing.
 * 
 * @module api/v1/analytics
 */

import { NextResponse } from 'next/server';
import { withSandbox } from '@/lib/middleware/sandbox.middleware';
import { getExecutiveIntelligence } from '@/services/intelligence/executive';
import { periodToDateRange } from '@/services/intelligence/shared/helpers';
import type { TimePeriod } from '@/services/intelligence/shared/types';
import { success } from '@/lib/api/response';

export const GET = withSandbox(
  async (req, { partner, sandbox }) => {
    // 1. Validate Scope
    const hasScope = partner.allowed_scopes.includes('analytics:read') || partner.allowed_scopes.includes('*');
    if (!hasScope) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Your API key does not have the required scope: analytics:read',
          },
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const period = (searchParams.get('period') || 'month') as TimePeriod;
    const dateRange = periodToDateRange(period);
    const tenantId = partner.tenant_id;

    // 2. Fetch Executive Intelligence Metrics
    const executiveService = getExecutiveIntelligence();

    try {
      const [revenue, efficiency, customer, financial, growth] = await Promise.all([
        executiveService.getMonthlyRevenueSummary(tenantId, dateRange),
        executiveService.getOperationalEfficiency(tenantId, dateRange),
        executiveService.getCustomerMetrics(tenantId, dateRange),
        executiveService.getFinancialHealth(tenantId, dateRange),
        executiveService.getGrowthIndicators(tenantId, dateRange),
      ]);

      // 3. Return aggregated data safely mapped to partner context
      return success(req, {
        period,
        environment: sandbox.environment,
        timestamp: new Date().toISOString(),
        analytics_data: {
          revenue: revenue.data,
          efficiency: efficiency.data,
          customer: customer.data,
          financial: financial.data,
          growth: growth.data,
        },
      });
    } catch (err: unknown) {
      console.error('[API Gateway] Analytics generation error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SERVER_002',
            message: 'Failed to retrieve analytics data from intelligence layer',
            details: errorMessage,
          },
        },
        { status: 500 }
      );
    }
  }
);
