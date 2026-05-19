import { NextRequest, NextResponse } from 'next/server';
import { triggerBatchReminders } from '@/services/crm-actions';

// Force dynamic execution so headers and query params are read in real-time
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Authorization check
    const secret = process.env.CRON_SECRET || 'bella_spa_cron_secret_2026';
    
    // Check in query parameter: ?secret=...
    const { searchParams } = new URL(request.url);
    const querySecret = searchParams.get('secret');
    
    // Check in headers: Authorization: Bearer ...
    const authHeader = request.headers.get('Authorization');
    const bearerSecret = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;

    if (querySecret !== secret && bearerSecret !== secret) {
      console.warn('Unauthorized cron trigger attempt.');
      return NextResponse.json(
        { error: 'Unauthorized. Invalid or missing secret token.' },
        { status: 401 }
      );
    }

    // 2. Trigger the scan
    console.log('Cron triggered: scanning today\'s appointments for Zalo reminders...');
    const result = await triggerBatchReminders();

    if ('error' in result && result.error) {
      return NextResponse.json(
        { 
          success: false, 
          error: result.error,
          message: 'Lỗi khi chạy quét và tự động gửi tin nhắn.'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result
    });

  } catch (error: any) {
    console.error('Exception in Zalo reminders cron handler:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Lỗi hệ thống trong cron job.' 
      },
      { status: 500 }
    );
  }
}
