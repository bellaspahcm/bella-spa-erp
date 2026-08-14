import { NextResponse } from 'next/server';
import { getPrimaryClient } from '@/lib/database/read-replica';

/**
 * Application Health Check
 *
 * Used by:
 * - Load balancers / Monitoring systems / Internal dashboards
 *
 * GET /api/health
 *
 * Returns:
 * - 200 OK if healthy
 * - 503 Service Unavailable if unhealthy
 *
 * Server-Timing instrumentation (Bước 2.5 — K6-2 → K6-3 transition):
 * Breaks down TTFB into segments so we can see inside the 129ms black-box:
 *   next_handler    → time from function entry to first await
 *   db_client_init  → time to obtain Supabase client singleton
 *   db_query        → time for Supabase JS → PostgREST → PostgreSQL → RLS → response
 *   serialization   → time to build and serialize the JSON response
 *
 * Visible in:
 *   - Browser DevTools → Network → Timing
 *   - k6: response.headers["Server-Timing"]
 *   - curl -I https://.../api/health | grep Server-Timing
 */
export async function GET() {
  // ── Segment: next_handler ─────────────────────────────────────────────────
  const t_handler_start = performance.now();

  try {
    // ── Segment: db_client_init ───────────────────────────────────────────
    const t_client_start = performance.now();
    const db = getPrimaryClient();
    const t_client_ms = performance.now() - t_client_start;

    // ── Segment: db_query ─────────────────────────────────────────────────
    const t_query_start = performance.now();
    const { error } = await db.from('tenants').select('id').limit(1);
    const t_query_ms = performance.now() - t_query_start;

    const t_handler_ms = performance.now() - t_handler_start;

    if (error) {
      const serverTiming = [
        `next_handler;dur=${t_handler_ms.toFixed(1)}`,
        `db_client_init;dur=${t_client_ms.toFixed(1)}`,
        `db_query;dur=${t_query_ms.toFixed(1)}`,
      ].join(', ');

      return NextResponse.json(
        {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          checks: { database: 'failed' },
          errors: [`Database: ${error.message}`],
          _timing: {
            next_handler_ms: parseFloat(t_handler_ms.toFixed(1)),
            db_client_init_ms: parseFloat(t_client_ms.toFixed(1)),
            db_query_ms: parseFloat(t_query_ms.toFixed(1)),
          },
        },
        {
          status: 503,
          headers: {
            'Cache-Control': 'no-store, must-revalidate',
            'Server-Timing': serverTiming,
          },
        }
      );
    }

    // ── Segment: serialization ────────────────────────────────────────────
    const t_serial_start = performance.now();
    const body = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.DEPLOYMENT_ENV || 'development',
      checks: { database: 'ok' },
      // Timing breakdown exposed in response body for K6 / curl inspection
      _timing: {
        next_handler_ms: parseFloat(t_handler_ms.toFixed(1)),
        db_client_init_ms: parseFloat(t_client_ms.toFixed(1)),
        db_query_ms: parseFloat(t_query_ms.toFixed(1)),
      },
    };
    const t_serial_ms = performance.now() - t_serial_start;

    const serverTiming = [
      `next_handler;dur=${t_handler_ms.toFixed(1)}`,
      `db_client_init;dur=${t_client_ms.toFixed(1)}`,
      `db_query;dur=${t_query_ms.toFixed(1)}`,
      `serialization;dur=${t_serial_ms.toFixed(1)}`,
    ].join(', ');

    return NextResponse.json(body, {
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
        'Server-Timing': serverTiming,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
