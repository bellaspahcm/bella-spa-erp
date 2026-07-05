/**
 * Debug: Check Leave Requests Table
 * GET /api/debug/check-leave-requests
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const secretKey = process.env.SUPABASE_SECRET_KEY!;

    const supabase = createClient(supabaseUrl, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Query all leave requests
    const { data: allRequests, error: allError } = await supabase
      .from('leave_requests')
      .select('id, employee_id, days, status, tenant_id')
      .limit(10);

    // Query specific Gate1 requests
    const { data: gate1Requests, error: gate1Error } = await supabase
      .from('leave_requests')
      .select('id, employee_id, days, status, tenant_id')
      .in('id', ['req-gate1-success', 'req-gate1-reject']);

    return NextResponse.json({
      supabaseUrl,
      hasSecretKey: !!secretKey,
      secretKeyPreview: `${secretKey.substring(0, 10)}...${secretKey.substring(secretKey.length - 10)}`,
      allRequests: {
        count: allRequests?.length || 0,
        data: allRequests,
        error: allError?.message
      },
      gate1Requests: {
        count: gate1Requests?.length || 0,
        data: gate1Requests,
        error: gate1Error?.message
      }
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
