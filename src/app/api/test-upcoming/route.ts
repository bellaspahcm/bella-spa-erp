import { NextResponse } from 'next/server';
import { getKTVUpcomingSessions } from '@/services/ktv-actions';

export async function GET() {
  try {
    const sessions = await getKTVUpcomingSessions();
    return NextResponse.json({ success: true, count: sessions.length, sessions });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}
