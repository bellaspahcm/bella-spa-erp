/**
 * API Route: Top Performing Ads
 * 
 * GET /api/intelligence/marketing/top-performing-ads
 * 
 * Query params:
 * - tenantId: string (required) - UUID of the tenant
 * - metric: 'roi' | 'roas' | 'ctr' | 'conversions' | 'revenue' (required) - Ranking metric
 * - period: 'day' | 'week' | 'month' | 'quarter' | 'year' (optional, default: 'month')
 * - startDate: string YYYY-MM-DD (optional, for custom range)
 * - endDate: string YYYY-MM-DD (optional, for custom range)
 * - platforms: string (optional) - Comma-separated platform names
 * - limit: number (optional, default: 10) - Number of top ads to return
 * 
 * Returns: IntelligenceResponse<TopPerformingAdsResult>
 * 
 * Example:
 * GET /api/intelligence/marketing/top-performing-ads?tenantId=abc-123&metric=roi&limit=10
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTopPerformingAds } from '@/services/intelligence/marketing/queries';
import { periodToDateRange, isValidTenantId, formatDate } from '@/services/intelligence/shared/helpers';
import type { TimePeriod } from '@/services/intelligence/shared/types';
import type { DateRange, Platform, PerformanceMetric } from '@/services/intelligence/marketing/types';

export async function GET(request: NextRequest) {
  try {
    // Parse query params
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const metric = searchParams.get('metric') as PerformanceMetric | null;
    const period = searchParams.get('period') as TimePeriod | null;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const platformsParam = searchParams.get('platforms');
    const limitParam = searchParams.get('limit');

    // Validate required params
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Missing required parameter: tenantId' },
        { status: 400 }
      );
    }

    if (!isValidTenantId(tenantId)) {
      return NextResponse.json(
        { error: 'Invalid tenantId format (must be UUID v4)' },
        { status: 400 }
      );
    }

    if (!metric) {
      return NextResponse.json(
        { error: 'Missing required parameter: metric' },
        { status: 400 }
      );
    }

    // Validate metric
    const validMetrics: PerformanceMetric[] = ['roi', 'roas', 'ctr', 'conversions', 'revenue'];
    if (!validMetrics.includes(metric)) {
      return NextResponse.json(
        { error: `Invalid metric. Must be one of: ${validMetrics.join(', ')}` },
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
    // If neither startDate/endDate nor period provided, use default (last 30 days) in query function

    // Parse and validate platforms filter
    let platforms: Platform[] | undefined;
    if (platformsParam) {
      const validPlatforms: Platform[] = ['facebook', 'google', 'tiktok', 'zalo'];
      const requestedPlatforms = platformsParam.split(',').map(p => p.trim().toLowerCase());
      
      const invalidPlatforms = requestedPlatforms.filter(p => !validPlatforms.includes(p as Platform));
      if (invalidPlatforms.length > 0) {
        return NextResponse.json(
          { 
            error: `Invalid platform(s): ${invalidPlatforms.join(', ')}. Must be one of: ${validPlatforms.join(', ')}` 
          },
          { status: 400 }
        );
      }

      platforms = requestedPlatforms as Platform[];
    }

    // Parse and validate limit
    let limit = 10; // default
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
        return NextResponse.json(
          { error: 'Invalid limit. Must be between 1 and 100' },
          { status: 400 }
        );
      }
      limit = parsedLimit;
    }

    // Call query function
    const startTime = Date.now();
    const data = await getTopPerformingAds({
      tenantId,
      metric,
      dateRange,
      platforms,
      limit,
    });

    // Return response in IntelligenceResponse format
    return NextResponse.json(
      {
        data,
        metadata: {
          generatedAt: new Date().toISOString(),
          cacheHit: false, // TODO: Implement cache layer
          queryTimeMs: Date.now() - startTime,
          dataSourcesUsed: ['external_ads_data', 'marketing_campaigns'],
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] Top Performing Ads error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { error: 'Failed to get top performing ads', details: errorMessage },
      { status: 500 }
    );
  }
}
