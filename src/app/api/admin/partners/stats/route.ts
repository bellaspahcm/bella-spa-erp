/**
 * Admin API: Tenant Partner Statistics
 * 
 * @endpoint GET /api/admin/partners/stats - Get tenant-wide statistics
 * 
 * @module api/admin/partners/stats
 * @since 2026-06-17
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getTenantPartnerStats } from '@/services/api-gateway/partner.service';

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
 * GET /api/admin/partners/stats
 * 
 * Get aggregated partner statistics for current tenant
 * 
 * Query params:
 * - tenant_id: Tenant ID (super_admin only)
 */
export async function GET(req: NextRequest) {
  const { user, tenant_id, is_super_admin, error } = await checkAdminRole(req);
  if (error) return error;
  
  try {
    const { searchParams } = new URL(req.url);
    
    // Determine which tenant to query
    let target_tenant_id = tenant_id;
    
    const requested_tenant_id = searchParams.get('tenant_id');
    if (requested_tenant_id) {
      if (is_super_admin) {
        target_tenant_id = requested_tenant_id;
      } else {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'AUTH_004',
              message: 'Cannot query other tenant statistics. Super admin access required.',
            },
          },
          { status: 403 }
        );
      }
    }
    
    if (!target_tenant_id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VAL_002',
            message: 'tenant_id is required',
          },
        },
        { status: 400 }
      );
    }
    
    // Get statistics
    const stats = await getTenantPartnerStats(target_tenant_id);
    
    return NextResponse.json({
      success: true,
      data: {
        tenant_id: target_tenant_id,
        ...stats,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[GET /api/admin/partners/stats] Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_002',
          message: 'Failed to fetch partner statistics',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}
