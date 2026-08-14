import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/services/user-actions';

/**
 * Micro-benchmark Endpoint B: Next.js + Auth check only (No Business DB queries)
 * GET /api/test/auth-perf/auth-only
 */
export async function GET() {
  const t_handler_start = performance.now();

  try {
    const t_auth_start = performance.now();
    const currentUser = await getCurrentUser();
    const t_auth_ms = performance.now() - t_auth_start;

    const t_handler_ms = performance.now() - t_handler_start;

    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        {
          status: 401,
          headers: {
            'Server-Timing': `next_handler;dur=${t_handler_ms.toFixed(1)}, auth;dur=${t_auth_ms.toFixed(1)}`,
          },
        }
      );
    }

    const t_serial_start = performance.now();
    const body = {
      status: 'ok',
      userId: currentUser.id,
      tenantId: currentUser.tenant_id,
      _timing: {
        next_handler_ms: parseFloat(t_handler_ms.toFixed(1)),
        auth_ms: parseFloat(t_auth_ms.toFixed(1)),
      },
    };
    const t_serial_ms = performance.now() - t_serial_start;

    const serverTiming = [
      `next_handler;dur=${t_handler_ms.toFixed(1)}`,
      `auth;dur=${t_auth_ms.toFixed(1)}`,
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
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
