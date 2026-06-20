import { checkReplicaHealth } from '@/lib/database/read-replica';
import { NextResponse } from 'next/server';

/**
 * Database Read Replica Health Check
 * 
 * Monitors replication lag between primary and replica databases.
 * Used by monitoring systems and ops dashboards.
 * 
 * GET /api/health/replica
 * 
 * Response:
 * {
 *   "healthy": true,
 *   "lag_ms": 120,
 *   "timestamp": "2026-06-18T00:00:00Z"
 * }
 */
export async function GET() {
  try {
    const health = await checkReplicaHealth();
    
    const response = {
      ...health,
      timestamp: new Date().toISOString(),
      environment: process.env.DEPLOYMENT_ENV || 'development',
    };
    
    // Return 503 Service Unavailable if unhealthy
    if (!health.healthy) {
      return NextResponse.json(response, { 
        status: 503,
        headers: {
          'Cache-Control': 'no-store, must-revalidate',
          'X-Health-Status': 'unhealthy',
        },
      });
    }
    
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
        'X-Health-Status': 'healthy',
      },
    });
  } catch (error) {
    console.error('[Health Check] Replica health check failed: %s', error instanceof Error ? error.message : String(error));
    
    return NextResponse.json(
      {
        healthy: false,
        lag_ms: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
