import { NextResponse } from 'next/server';
import { getKTVUpcomingSessions } from '@/services/ktv-actions';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Lỗi hệ thống.';
}

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
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
