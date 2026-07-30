import { NextResponse } from 'next/server';
import { getPrimaryClient } from '@/lib/database/read-replica';

/**
 * Application Health Check
 * 
 * Used by:
 * - Load balancers
 * - Monitoring systems (UptimeRobot, Pingdom)
 * - Internal dashboards
 * 
 * GET /api/health
 * 
 * Returns:
 * - 200 OK if healthy
 * - 503 Service Unavailable if unhealthy
 */
export async function GET() {
  try {
    const checks = await Promise.all([
      checkDatabase(),
      checkSupabase(),
    ]);

    const [database, supabase] = checks;

    if (!database.healthy || !supabase.healthy) {
      return NextResponse.json(
        {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          checks: {
            database: database.healthy ? 'ok' : 'failed',
            supabase: supabase.healthy ? 'ok' : 'failed',
          },
          errors: [
            ...(database.error ? [`Database: ${database.error}`] : []),
            ...(supabase.error ? [`Supabase: ${supabase.error}`] : []),
          ],
        },
        { 
          status: 503,
          headers: {
            'Cache-Control': 'no-store, must-revalidate',
          },
        }
      );
    }

    return NextResponse.json(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.DEPLOYMENT_ENV || 'development',
        checks: {
          database: 'ok',
          supabase: 'ok',
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store, must-revalidate',
        },
      }
    );
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

async function checkDatabase(): Promise<{ healthy: boolean; error?: string }> {
  try {
    const db = getPrimaryClient();
    const { error } = await db.from('tenants').select('id').limit(1);

    if (error) throw error;

    return { healthy: true };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Database connection failed',
    };
  }
}

async function checkSupabase(): Promise<{ healthy: boolean; error?: string }> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/tenants?select=id&limit=1`,
      {
        method: 'HEAD',
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Supabase returned ${response.status}`);
    }

    return { healthy: true };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Supabase connection failed',
    };
  }
}
