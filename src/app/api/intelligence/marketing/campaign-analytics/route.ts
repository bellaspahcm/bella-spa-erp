/**
 * API Route: Campaign Analytics
 * 
 * GET /api/intelligence/marketing/campaign-analytics
 * 
 * Query params:
 * - campaignId: string (required) - UUID of the marketing campaign
 * - period: 'day' | 'week' | 'month' | 'quarter' | 'year' (optional, default: 'month')
 * - startDate: string YYYY-MM-DD (optional, for custom range)
 * - endDate: string YYYY-MM-DD (optional, for custom range)
 * - tenantId: string (optional, for tenant isolation check)
 * 
 * Returns: IntelligenceResponse<CampaignAnalytics>
 * 
 * Example:
 * GET /api/intelligence/marketing/campaign-analytics?campaignId=abc-123&period=month
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCampaignAnalytics } from '@/services/intelligence/marketing/queries';
import { periodToDateRange, isValidTenantId, formatDate } from '@/services/intelligence/shared/helpers';
import type { TimePeriod } from '@/services/intelligence/shared/types';
import type { DateRange } from '@/services/intelligence/marketing/types';

export async function GET(request: NextRequest) {
  try {
    // Parse query params
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get('campaignId');
    const period = searchParams.get('period') as TimePeriod | null;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const tenantId = searchParams.get('tenantId');

    // Validate required params
    if (!campaignId) {
      return NextResponse.json(
        { error: 'Missing required parameter: campaignId' },
        { status: 400 }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(campaignId)) {
      return NextResponse.json(
        { error: 'Invalid campaignId format (must be UUID)' },
        { status: 400 }
      );
    }

    // Validate tenantId if provided
    if (tenantId && !isValidTenantId(tenantId)) {
      return NextResponse.json(
        { error: 'Invalid tenantId format (must be UUID v4)' },
        { status: 400 }
      );
    }

    // Build date range
    let dateRange: DateRange | undefined;
    if (startDate && endDate) {
      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        return NextResponse.json(
          { error: 'Invalid date format. Use YYYY-MM-DD' },
          { status: 400 }
        );
      }

      dateRange = { start: startDate, end: endDate };
    } else if (period) {
      // Validate period enum
      const validPeriods: TimePeriod[] = ['day', 'week', 'month', 'quarter', 'year'];
      if (!validPeriods.includes(period)) {
        return NextResponse.json(
          { error: `Invalid period. Must be one of: ${validPeriods.join(', ')}` },
          { status: 400 }
        );
      }

      const range = periodToDateRange(period);
      dateRange = {
        start: formatDate(range.startDate),
        end: formatDate(range.endDate),
      };
    }

    // Call query function (not using service layer directly to avoid circular dependencies)
    const startTime = Date.now();
    const data = await getCampaignAnalytics({
      campaignId,
      dateRange,
      tenantId: tenantId || undefined,
    });

    // Return response in IntelligenceResponse format
    return NextResponse.json(
      {
        data,
        metadata: {
          generatedAt: new Date().toISOString(),
          cacheHit: false, // TODO: Implement cache layer
          queryTimeMs: Date.now() - startTime,
          dataSourcesUsed: ['mv_campaign_performance', 'external_ads_data'],
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] Campaign Analytics error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Handle specific errors
    if (errorMessage.includes('Campaign not found')) {
      return NextResponse.json(
        { error: 'Campaign not found', details: errorMessage },
        { status: 404 }
      );
    }

    if (errorMessage.includes('Tenant mismatch')) {
      return NextResponse.json(
        { error: 'Access denied', details: 'Campaign does not belong to specified tenant' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to get campaign analytics', details: errorMessage },
      { status: 500 }
    );
  }
}
