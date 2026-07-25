/**
 * API Route: Sync External Ads (Cron Job)
 * 
 * GET /api/cron/sync-external-ads
 * 
 * Triggered by:
 * 1. Vercel Cron (scheduled daily at 3:00 AM Vietnam time)
 * 2. Manual trigger by admin (with Bearer token authentication)
 * 
 * Authentication:
 * - Requires Authorization header with CRON_SECRET
 * - Format: Authorization: Bearer <CRON_SECRET>
 * 
 * Returns: JobResult with sync details for all tenants
 * 
 * Example:
 * curl -H "Authorization: Bearer your-secret" https://your-domain.com/api/cron/sync-external-ads
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncExternalAdsJob } from '@/cron/sync-external-ads';

export async function GET(request: NextRequest) {
  try {
    // Step 1: Verify authentication
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Check if CRON_SECRET is configured
    if (!cronSecret) {
      console.error('[API] CRON_SECRET not configured in environment variables');
      return NextResponse.json(
        { 
          error: 'Cron job not configured',
          details: 'CRON_SECRET environment variable is missing'
        },
        { status: 500 }
      );
    }

    // Check if Authorization header is provided
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized', details: 'Missing Authorization header' },
        { status: 401 }
      );
    }

    // Verify Bearer token format
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (token !== cronSecret) {
      return NextResponse.json(
        { error: 'Unauthorized', details: 'Invalid CRON_SECRET' },
        { status: 401 }
      );
    }

    // Step 2: Execute sync job
    console.log('[API] Executing sync-external-ads cron job...');
    const result = await syncExternalAdsJob();

    // Step 3: Return result
    const statusCode = result.success ? 200 : 500;
    
    return NextResponse.json(
      {
        success: result.success,
        message: result.success 
          ? 'Sync job completed successfully'
          : 'Sync job completed with errors',
        data: {
          startTime: result.startTime,
          endTime: result.endTime,
          duration: result.duration,
          summary: {
            tenantsProcessed: result.tenantsProcessed,
            tenantsSucceeded: result.tenantsSucceeded,
            tenantsFailed: result.tenantsFailed,
            totalRecordsSynced: result.totalRecordsSynced,
          },
          results: result.results,
          errors: result.errors,
        },
      },
      { status: statusCode }
    );

  } catch (error) {
    console.error('[API] Cron sync-external-ads error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        error: 'Sync job failed', 
        details: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint for manual trigger with optional platform filter
 * 
 * Body:
 * {
 *   "tenantId": "optional-tenant-id",
 *   "platforms": ["facebook", "google"] // optional
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Step 1: Verify authentication (same as GET)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return NextResponse.json(
        { error: 'Cron job not configured' },
        { status: 500 }
      );
    }

    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized', details: 'Missing Authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (token !== cronSecret) {
      return NextResponse.json(
        { error: 'Unauthorized', details: 'Invalid CRON_SECRET' },
        { status: 401 }
      );
    }

    // Step 2: Parse request body (optional filters)
    let body: { tenantId?: string; platforms?: string[] } = {};
    try {
      const text = await request.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch (_parseError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Step 3: Execute sync job
    // NOTE: Current implementation ignores filters (for simplicity)
    // Full implementation would pass filters to syncExternalAdsJob()
    console.log('[API] Manual sync triggered with filters:', body);
    const result = await syncExternalAdsJob();

    // Step 4: Return result
    const statusCode = result.success ? 200 : 500;
    
    return NextResponse.json(
      {
        success: result.success,
        message: result.success 
          ? 'Manual sync completed successfully'
          : 'Manual sync completed with errors',
        data: {
          startTime: result.startTime,
          endTime: result.endTime,
          duration: result.duration,
          summary: {
            tenantsProcessed: result.tenantsProcessed,
            tenantsSucceeded: result.tenantsSucceeded,
            tenantsFailed: result.tenantsFailed,
            totalRecordsSynced: result.totalRecordsSynced,
          },
          results: result.results,
          errors: result.errors,
        },
      },
      { status: statusCode }
    );

  } catch (error) {
    console.error('[API] Manual sync error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        error: 'Manual sync failed', 
        details: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
