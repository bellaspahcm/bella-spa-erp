/**
 * API Route: /api/admin/partners/logs
 * 
 * GET: Lấy danh sách request logs của đối tác
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized', code: 'AUTH_001' } },
        { status: 401 }
      );
    }

    // Get user's tenant
    const { data: profile } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile?.tenant_id) {
      return NextResponse.json(
        { success: false, error: { message: 'Tenant not found', code: 'TENANT_001' } },
        { status: 404 }
      );
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const partnerId = searchParams.get('partner_id');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const method = searchParams.get('method');
    const isError = searchParams.get('is_error');

    if (!partnerId) {
      return NextResponse.json(
        { success: false, error: { message: 'Partner ID is required', code: 'VAL_002' } },
        { status: 400 }
      );
    }

    // Build query
    let query = (supabase as any)
      .from('api_request_logs')
      .select('*', { count: 'exact' })
      .eq('partner_id', partnerId)
      .eq('tenant_id', profile.tenant_id);

    if (method) {
      query = query.eq('method', method);
    }

    if (isError === 'true') {
      query = query.eq('is_error', true);
    } else if (isError === 'false') {
      query = query.eq('is_error', false);
    }

    // Pagination & order
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: logs, count, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: logs || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        has_more: (count || 0) > offset + limit,
      },
    });
  } catch (error: any) {
    console.error('Error fetching logs:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: 'Internal server error',
          code: 'SERVER_001',
        },
      },
      { status: 500 }
    );
  }
}
