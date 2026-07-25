/**
 * Metrics API Endpoint
 * Phase 8: Optimization & Production Readiness
 * 
 * Exports Prometheus-compatible metrics
 * GET /api/metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { metricsRegistry } from '@/services/intelligence/shared/metrics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    // Export metrics in Prometheus format
    const metricsText = metricsRegistry.exportMetrics();
    
    return new NextResponse(metricsText, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; version=0.0.4',
      },
    });
  } catch (error: unknown) {
    console.error('Metrics export error:', error);
    return new NextResponse('Error exporting metrics', {
      status: 500,
    });
  }
}
