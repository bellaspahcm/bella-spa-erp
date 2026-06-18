/**
 * Admin API: Partner Usage Statistics
 * 
 * @endpoint GET /api/admin/partners/[id]/usage - Get usage statistics
 * 
 * @module api/admin/partners/[id]/usage
 * @since 2026-06-17
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import {
  getPartnerById,
  getPartnerUsageStats,
} from '@/services/api-gateway/partner.service';

async function checkAdminRole(req: NextRequest) {
  const supabase = createClient();
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
    tenant_id: profile.tenant_id,
    is_super_admin: profile.role === 'super_admin',
  };
}

/**
 * GET /api/admin/partners/[id]/usage
 * 
 * Get usage statistics for partner (last 30 days)
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
    
    // Get usage stats
    const stats = await getPartnerUsageStats(partner_id);
    
    if (!stats) {
      // No usage data yet
      return NextResponse.json({
        success: true,
        data: {
          partner_id,
          total_requests: 0,
          successful_requests: 0,
          failed_requests: 0,
          avg_response_time_ms: 0,
          last_request_at: null,
          period_start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          period_end: new Date().toISOString(),
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }
    
    return NextResponse.json({
      success: true,
      data: stats,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[GET /api/admin/partners/[id]/usage] Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_002',
          message: 'Failed to fetch usage statistics',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}
