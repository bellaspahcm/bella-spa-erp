import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/services/user-actions';
import { createClient } from '@/lib/supabase-server';

/**
 * Micro-benchmark Endpoint C: Next.js + Auth check + 1 Simple DB query
 * GET /api/test/auth-perf/auth-query
 */
export async function GET() {
  const t_handler_start = performance.now();

  try {
    const t_auth_start = performance.now();
    const currentUser = await getCurrentUser();
    const t_auth_ms = performance.now() - t_auth_start;

    if (!currentUser) {
      const t_handler_ms = performance.now() - t_handler_start;
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

    const t_client_start = performance.now();
    const db = createClient();
    const t_client_ms = performance.now() - t_client_start;

    const t_query_start = performance.now();
    const { data: tenant, error } = await db
      .from('tenants')
      .select('id, name')
      .eq('id', currentUser.tenant_id)
      .single();
    const t_query_ms = performance.now() - t_query_start;

    const t_handler_ms = performance.now() - t_handler_start;

    if (error) {
      return NextResponse.json(
        {
          status: 'error',
          error: error.message,
          _timing: {
            next_handler_ms: parseFloat(t_handler_ms.toFixed(1)),
            auth_ms: parseFloat(t_auth_ms.toFixed(1)),
            db_client_init_ms: parseFloat(t_client_ms.toFixed(1)),
            db_query_ms: parseFloat(t_query_ms.toFixed(1)),
          },
        },
        {
          status: 500,
          headers: {
            'Server-Timing': `next_handler;dur=${t_handler_ms.toFixed(1)}, auth;dur=${t_auth_ms.toFixed(1)}, db_client_init;dur=${t_client_ms.toFixed(1)}, db_query;dur=${t_query_ms.toFixed(1)}`,
          },
        }
      );
    }

    const t_serial_start = performance.now();
    const body = {
      status: 'ok',
      userId: currentUser.id,
      tenant,
      _timing: {
        next_handler_ms: parseFloat(t_handler_ms.toFixed(1)),
        auth_ms: parseFloat(t_auth_ms.toFixed(1)),
        db_client_init_ms: parseFloat(t_client_ms.toFixed(1)),
        db_query_ms: parseFloat(t_query_ms.toFixed(1)),
      },
    };
    const t_serial_ms = performance.now() - t_serial_start;

    const serverTiming = [
      `next_handler;dur=${t_handler_ms.toFixed(1)}`,
      `auth;dur=${t_auth_ms.toFixed(1)}`,
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
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
