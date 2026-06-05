import { NextRequest, NextResponse } from 'next/server';
import { getKTVUpcomingSessions } from '@/services/ktv-actions';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Lỗi hệ thống.';
}

function isLocalHostname(hostname: string) {
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '::1'
    || hostname === '[::1]';
}

function readAuthToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization')?.trim();
  if (authHeader) {
    return authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : authHeader;
  }

  return request.nextUrl.searchParams.get('secret')?.trim() ?? '';
}

function isAuthorizedDiagnosticRequest(request: NextRequest) {
  const diagnosticSecret = process.env.TEST_UPCOMING_SECRET || process.env.CRON_SECRET;
  if (diagnosticSecret) {
    return readAuthToken(request) === diagnosticSecret;
  }

  return isLocalHostname(request.nextUrl.hostname);
}

function isProductionRuntime() {
  return process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
}

export async function GET(request: NextRequest) {
  if (isProductionRuntime()) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  if (!isAuthorizedDiagnosticRequest(request)) {
    return NextResponse.json(
      { success: false, error: 'Diagnostic endpoint is restricted.' },
      { status: 403 }
    );
  }

  try {
    const sessions = await getKTVUpcomingSessions();
    return NextResponse.json({ success: true, count: sessions.length, sessions });
  } catch (error: unknown) {
    console.error('[test-upcoming]', error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
