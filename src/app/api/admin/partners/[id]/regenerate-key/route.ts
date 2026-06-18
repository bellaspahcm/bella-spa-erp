/**
 * Admin API: Regenerate Partner API Key
 * 
 * **CRITICAL:** Old API key will be invalidated immediately
 * 
 * @endpoint POST /api/admin/partners/[id]/regenerate-key
 * 
 * @module api/admin/partners/[id]/regenerate-key
 * @since 2026-06-17
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import {
  getPartnerById,
  regenerateApiKey,
} from '@/services/api-gateway/partner.service';

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
 * POST /api/admin/partners/[id]/regenerate-key
 * 
 * Regenerate API key for partner
 * 
 * **WARNING:** This will immediately invalidate the old API key.
 * Partner will need to update their integration with the new key.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: partner_id } = await params;
  const { user, tenant_id, is_super_admin, error } = await checkAdminRole(req);
  if (error) return error;
  
  try {
    // Check if partner exists and user has access
    const existing = await getPartnerById(
      partner_id,
      is_super_admin ? undefined : tenant_id
    );
    
    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VAL_001', message: 'Partner not found' },
        },
        { status: 404 }
      );
    }
    
    if (!is_super_admin && existing.tenant_id !== tenant_id) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'AUTH_004', message: 'Cannot regenerate key for partner from other tenant' },
        },
        { status: 403 }
      );
    }
    
    // Regenerate API key
    const { partner, new_api_key } = await regenerateApiKey(partner_id, user.id);
    
    return NextResponse.json({
      success: true,
      data: {
        partner,
        new_api_key,
      },
      warning: 'Old API key has been invalidated. Partner must update their integration.',
      meta: {
        timestamp: new Date().toISOString(),
        regenerated_by: user.id,
      },
    });
  } catch (error) {
    console.error('[POST /api/admin/partners/[id]/regenerate-key] Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_002',
          message: 'Failed to regenerate API key',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}
