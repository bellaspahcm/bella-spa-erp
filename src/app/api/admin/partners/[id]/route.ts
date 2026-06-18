/**
 * Admin API: Partner Detail
 * 
 * Endpoints for managing individual API partner
 * 
 * @endpoint GET /api/admin/partners/[id] - Get partner details
 * @endpoint PATCH /api/admin/partners/[id] - Update partner
 * @endpoint DELETE /api/admin/partners/[id] - Delete partner
 * 
 * @module api/admin/partners/[id]
 * @since 2026-06-17
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import {
  getPartnerById,
  updatePartner,
  deletePartner,
} from '@/services/api-gateway/partner.service';
import { UpdateAPIPartnerInput } from '@/types/api-gateway';

/**
 * Check if user has admin role
 */
async function checkAdminRole(req: NextRequest): Promise<{
  user: any;
  tenant_id?: string;
  is_super_admin: boolean;
  error?: NextResponse;
}> {
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
 * GET /api/admin/partners/[id]
 * 
 * Get partner details by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: partner_id } = await params;
  const { user, tenant_id, is_super_admin, error } = await checkAdminRole(req);
  if (error) return error;
  
  try {
    // Fetch partner
    const partner = await getPartnerById(
      partner_id,
      is_super_admin ? undefined : tenant_id // Tenant filter for non-super-admin
    );
    
    if (!partner) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VAL_001',
            message: 'Partner not found',
          },
        },
        { status: 404 }
      );
    }
    
    // Security: Regular admin can only see their own tenant's partners
    if (!is_super_admin && partner.tenant_id !== tenant_id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'AUTH_004',
            message: 'Cannot access partner from other tenant',
          },
        },
        { status: 403 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: partner,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[GET /api/admin/partners/[id]] Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_002',
          message: 'Failed to fetch partner',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/partners/[id]
 * 
 * Update partner
 * 
 * Request body: UpdateAPIPartnerInput (all fields optional)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: partner_id } = await params;
  const { user, tenant_id, is_super_admin, error } = await checkAdminRole(req);
  if (error) return error;
  
  try {
    const body: UpdateAPIPartnerInput = await req.json();
    
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
          error: { code: 'AUTH_004', message: 'Cannot update partner from other tenant' },
        },
        { status: 403 }
      );
    }
    
    // Update partner
    const updated = await updatePartner(partner_id, body, user.id);
    
    return NextResponse.json({
      success: true,
      data: updated,
      meta: {
        timestamp: new Date().toISOString(),
        updated_by: user.id,
      },
    });
  } catch (error) {
    console.error('[PATCH /api/admin/partners/[id]] Error:', error);
    
    if ((error as any).code) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: (error as any).code,
            message: (error as any).message,
            details: (error as any).details,
          },
        },
        { status: (error as any).status_code || 500 }
      );
    }
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_002',
          message: 'Failed to update partner',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/partners/[id]
 * 
 * Delete partner (soft delete - sets is_active = false)
 */
export async function DELETE(
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
          error: { code: 'AUTH_004', message: 'Cannot delete partner from other tenant' },
        },
        { status: 403 }
      );
    }
    
    // Delete partner (soft delete)
    await deletePartner(partner_id);
    
    return NextResponse.json({
      success: true,
      message: 'Partner deleted successfully',
      meta: {
        timestamp: new Date().toISOString(),
        deleted_by: user.id,
      },
    });
  } catch (error) {
    console.error('[DELETE /api/admin/partners/[id]] Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_002',
          message: 'Failed to delete partner',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}
