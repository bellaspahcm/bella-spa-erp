import { NextResponse } from 'next/server';
import { getKTVUpcomingSessions } from '@/services/ktv-actions';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  try {
    const sessions = await getKTVUpcomingSessions();
    return NextResponse.json({ success: true, count: sessions.length, sessions });
  } catch (error: any) {
    console.error('[test-upcoming]', error);
    return NextResponse.json({ success: false, error: 'Lỗi hệ thống.' });
  }
}
