/**
 * API Route: Channel Performance
 * 
 * GET /api/intelligence/marketing/channel-performance
 * 
 * Query params:
 * - tenantId: string (required) - UUID of the tenant
 * - period: 'day' | 'week' | 'month' | 'quarter' | 'year' (optional, default: 'month')
 * - startDate: string YYYY-MM-DD (optional, for custom range)
 * - endDate: string YYYY-MM-DD (optional, for custom range)
 * - platforms: string (optional) - Comma-separated platform names (facebook,google,tiktok,zalo)
 * 
 * Returns: IntelligenceResponse<ChannelPerformance[]>
 * 
 * Example:
 * GET /api/intelligence/marketing/channel-performance?tenantId=abc-123&period=month&platforms=facebook,google
 */

import { NextRequest, NextResponse } from 'next/server';
import { getChannelPerformance } from '@/services/intelligence/marketing/queries';
import { periodToDateRange, isValidTenantId, formatDate } from '@/services/intelligence/shared/helpers';
import type { TimePeriod } from '@/services/intelligence/shared/types';
import type { DateRange, Platform } from '@/services/intelligence/marketing/types';

export async function GET(request: NextRequest) {
  try {
    // Parse query params
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const period = searchParams.get('period') as TimePeriod | null;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const platformsParam = searchParams.get('platforms');

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

    // Build date range
    let dateRange: DateRange;
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
    } else {
      const periodValue = (period || 'month') as TimePeriod;
      
      // Validate period enum
      const validPeriods: TimePeriod[] = ['day', 'week', 'month', 'quarter', 'year'];
      if (!validPeriods.includes(periodValue)) {
        return NextResponse.json(
          { error: `Invalid period. Must be one of: ${validPeriods.join(', ')}` },
          { status: 400 }
        );
      }

      const range = periodToDateRange(periodValue);
      dateRange = {
        start: formatDate(range.startDate),
        end: formatDate(range.endDate),
      };
    }

    // Parse and validate platforms filter
    let platforms: Platform[] | undefined;
    if (platformsParam) {
      const validPlatforms: Platform[] = ['facebook', 'google', 'tiktok', 'zalo'];
      const requestedPlatforms = platformsParam.split(',').map(p => p.trim().toLowerCase());
      
      // Check if all requested platforms are valid
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

    // Call query function
    const startTime = Date.now();
    const data = await getChannelPerformance({
      tenantId,
      dateRange,
      platforms,
    });

    // Return response in IntelligenceResponse format
    return NextResponse.json(
      {
        data,
        metadata: {
          generatedAt: new Date().toISOString(),
          cacheHit: false, // TODO: Implement cache layer
          queryTimeMs: Date.now() - startTime,
          dataSourcesUsed: ['mv_channel_performance'],
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] Channel Performance error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { error: 'Failed to get channel performance', details: errorMessage },
      { status: 500 }
    );
  }
}
