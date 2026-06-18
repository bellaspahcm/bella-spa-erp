/**
 * Admin API: Partner Request Logs
 * 
 * @endpoint GET /api/admin/partners/[id]/logs - Get request logs
 * 
 * @module api/admin/partners/[id]/logs
 * @since 2026-06-17
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getPartnerById } from '@/services/api-gateway/partner.service';

async function checkAdminRole(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return {
      user: null,
      is_super_admin: false,
      error: NextResponse.json(
        { success: false, error: { code: 'AUTH_001', message: 'Authentication required' } },
        { status: 401 }
      ),
    };
  }
  
  const { data: profile } = await supabase
    .from('users')
    .select('role, tenant_id')
    .eq('id', user.id)
    .single();
  
  if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
    return {
      user: null,
      is_super_admin: false,
      error: NextResponse.json(
        { success: false, error: { code: 'AUTH_003', message: 'Admin access required' } },
        { status: 403 }
      ),
    };
  }
  
  return {
    user,
    tenant_id: profile.tenant_id || undefined,
    is_super_admin: profile.role === 'super_admin',
  };
}

/**
 * GET /api/admin/partners/[id]/logs
 * 
 * Get request logs for partner
 * 
 * Query params:
 * - method: Filter by HTTP method (GET, POST, etc.)
 * - status_code: Filter by status code (200, 400, 500, etc.)
 * - is_error: Filter by error status (true/false)
 * - start_date: Filter by start date (ISO 8601)
 * - end_date: Filter by end date (ISO 8601)
 * - limit: Page size (default: 50, max: 100)
 * - offset: Pagination offset (default: 0)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: partner_id } = await params;
  const { user, tenant_id, is_super_admin, error } = await checkAdminRole(req);
  if (error) return error;
  
  try {
    // Check partner access
    const existing = await getPartnerById(
      partner_id,
      is_super_admin ? undefined : tenant_id
    );
    
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'VAL_001', message: 'Partner not found' } },
        { status: 404 }
      );
    }
    
    if (!is_super_admin && existing.tenant_id !== tenant_id) {
      return NextResponse.json(
        { success: false, error: { code: 'AUTH_004', message: 'Cannot access partner from other tenant' } },
        { status: 403 }
      );
    }
    
    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    
    const supabase = createClient();
    
    // Build query
    let query = supabase
      .from('api_request_logs')
      .select('*', { count: 'exact' })
      .eq('partner_id', partner_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    // Apply filters
    if (searchParams.has('method')) {
      query = query.eq('method', searchParams.get('method')!.toUpperCase());
    }
    
    if (searchParams.has('status_code')) {
      query = query.eq('status_code', parseInt(searchParams.get('status_code')!));
    }
    
    if (searchParams.has('is_error')) {
      query = query.eq('is_error', searchParams.get('is_error') === 'true');
    }
    
    if (searchParams.has('start_date')) {
      query = query.gte('created_at', searchParams.get('start_date')!);
    }
    
    if (searchParams.has('end_date')) {
      query = query.lte('created_at', searchParams.get('end_date')!);
    }
    
    const { data: logs, count, error: dbError } = await query;
    
    if (dbError) {
      throw dbError;
    }
    
    return NextResponse.json({
      success: true,
      data: logs,
      pagination: {
        total: count || 0,
        limit,
        offset,
        has_more: (count || 0) > offset + limit,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[GET /api/admin/partners/[id]/logs] Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_002',
          message: 'Failed to fetch request logs',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}
