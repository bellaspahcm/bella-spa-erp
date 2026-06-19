/**
 * Admin API: Partner Scope Management
 * 
 * @endpoint POST /api/admin/partners/[id]/scopes - Add scopes
 * @endpoint DELETE /api/admin/partners/[id]/scopes - Remove scopes
 * @endpoint PUT /api/admin/partners/[id]/scopes - Apply scope preset
 * 
 * @module api/admin/partners/[id]/scopes
 * @since 2026-06-17
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import {
  getPartnerById,
  addScopes,
  removeScopes,
  applySecurePreset,
} from '@/services/api-gateway/partner.service';
import { APIScope, SCOPE_PRESETS } from '@/types/api-gateway';

interface ServiceError {
  code?: string;
  message?: string;
  details?: unknown;
  status_code?: number;
}

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
 * POST /api/admin/partners/[id]/scopes
 * 
 * Add scopes to partner
 * 
 * Request body:
 * - scopes: APIScope[] (required)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: partner_id } = await params;
  const { user, tenant_id, is_super_admin, error } = await checkAdminRole(req);
  if (error) return error;
  
  try {
    const body = await req.json();
    
    // Validate scopes
    if (!body.scopes || !Array.isArray(body.scopes) || body.scopes.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VAL_002',
            message: 'Missing or invalid field: scopes (must be non-empty array)',
          },
        },
        { status: 400 }
      );
    }
    
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
        { success: false, error: { code: 'AUTH_004', message: 'Cannot modify partner from other tenant' } },
        { status: 403 }
      );
    }
    
    // Add scopes
    const updated = await addScopes(partner_id, body.scopes);
    
    return NextResponse.json({
      success: true,
      data: updated,
      meta: {
        timestamp: new Date().toISOString(),
        updated_by: user.id,
        scopes_added: body.scopes,
      },
    });
  } catch (error) {
    console.error('[POST /api/admin/partners/[id]/scopes] Error:', error);
    
    const serviceError = error as ServiceError;
    if (serviceError.code) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: serviceError.code,
            message: serviceError.message,
            details: serviceError.details,
          },
        },
        { status: serviceError.status_code || 500 }
      );
    }
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_002',
          message: 'Failed to add scopes',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/partners/[id]/scopes
 * 
 * Remove scopes from partner
 * 
 * Request body:
 * - scopes: APIScope[] (required)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: partner_id } = await params;
  const { user, tenant_id, is_super_admin, error } = await checkAdminRole(req);
  if (error) return error;
  
  try {
    const body = await req.json();
    
    // Validate scopes
    if (!body.scopes || !Array.isArray(body.scopes) || body.scopes.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VAL_002',
            message: 'Missing or invalid field: scopes (must be non-empty array)',
          },
        },
        { status: 400 }
      );
    }
    
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
        { success: false, error: { code: 'AUTH_004', message: 'Cannot modify partner from other tenant' } },
        { status: 403 }
      );
    }
    
    // Remove scopes
    const updated = await removeScopes(partner_id, body.scopes);
    
    return NextResponse.json({
      success: true,
      data: updated,
      meta: {
        timestamp: new Date().toISOString(),
        updated_by: user.id,
        scopes_removed: body.scopes,
      },
    });
  } catch (error) {
    console.error('[DELETE /api/admin/partners/[id]/scopes] Error:', error);
    
    const serviceError = error as ServiceError;
    if (serviceError.code) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: serviceError.code,
            message: serviceError.message,
            details: serviceError.details,
          },
        },
        { status: serviceError.status_code || 500 }
      );
    }
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_002',
          message: 'Failed to remove scopes',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/partners/[id]/scopes
 * 
 * Apply scope preset to partner
 * 
 * Request body:
 * - preset: keyof typeof SCOPE_PRESETS (required)
 *   Options: 'basic', 'pos_integration', 'payment_gateway', 'hr_platform', 
 *            'invoice_provider', 'admin'
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: partner_id } = await params;
  const { user, tenant_id, is_super_admin, error } = await checkAdminRole(req);
  if (error) return error;
  
  try {
    const body = await req.json();
    
    // Validate preset
    if (!body.preset) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VAL_002',
            message: 'Missing required field: preset',
            details: {
              available_presets: Object.keys(SCOPE_PRESETS),
            },
          },
        },
        { status: 400 }
      );
    }
    
    if (!SCOPE_PRESETS[body.preset as keyof typeof SCOPE_PRESETS]) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VAL_001',
            message: `Invalid preset: ${body.preset}`,
            details: {
              available_presets: Object.keys(SCOPE_PRESETS),
            },
          },
        },
        { status: 400 }
      );
    }
    
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
        { success: false, error: { code: 'AUTH_004', message: 'Cannot modify partner from other tenant' } },
        { status: 403 }
      );
    }
    
    // Apply preset
    const updated = await applySecurePreset(partner_id, body.preset);
    
    return NextResponse.json({
      success: true,
      data: updated,
      meta: {
        timestamp: new Date().toISOString(),
        updated_by: user.id,
        preset_applied: body.preset,
        scopes_set: SCOPE_PRESETS[body.preset as keyof typeof SCOPE_PRESETS],
      },
    });
  } catch (error) {
    console.error('[PUT /api/admin/partners/[id]/scopes] Error:', error);
    
    const serviceError = error as ServiceError;
    if (serviceError.code) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: serviceError.code,
            message: serviceError.message,
            details: serviceError.details,
          },
        },
        { status: serviceError.status_code || 500 }
      );
    }
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_002',
          message: 'Failed to apply scope preset',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}
