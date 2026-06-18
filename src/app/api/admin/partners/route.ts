/**
 * Admin API: Partners Management
 * 
 * Endpoints for managing API partners (admin only)
 * 
 * Security:
 * - Requires admin or super_admin role
 * - All operations are tenant-scoped unless super_admin
 * 
 * @endpoint GET /api/admin/partners - List partners
 * @endpoint POST /api/admin/partners - Create partner
 * 
 * @module api/admin/partners
 * @since 2026-06-17
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import {
  listPartners,
  createPartner,
  ListPartnersParams,
} from '@/services/api-gateway/partner.service';
import { CreateAPIPartnerInput } from '@/types/api-gateway';

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
  
  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return {
      user: null,
      is_super_admin: false,
      error: NextResponse.json(
        {
          success: false,
          error: {
            code: 'AUTH_001',
            message: 'Authentication required',
          },
        },
        { status: 401 }
      ),
    };
  }
  
  // Get user profile with role
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('role, tenant_id')
    .eq('id', user.id)
    .single();
  
  if (profileError || !profile) {
    return {
      user: null,
      is_super_admin: false,
      error: NextResponse.json(
        {
          success: false,
          error: {
            code: 'AUTH_002',
            message: 'User profile not found',
          },
        },
        { status: 403 }
      ),
    };
  }
  
  // Check if admin or super_admin
  const is_super_admin = profile.role === 'super_admin';
  const is_admin = profile.role === 'admin' || is_super_admin;
  
  if (!is_admin) {
    return {
      user: null,
      is_super_admin: false,
      error: NextResponse.json(
        {
          success: false,
          error: {
            code: 'AUTH_003',
            message: 'Admin access required',
            details: { your_role: profile.role, required_role: 'admin or super_admin' },
          },
        },
        { status: 403 }
      ),
    };
  }
  
  return {
    user,
    tenant_id: profile.tenant_id,
    is_super_admin,
  };
}

/**
 * GET /api/admin/partners
 * 
 * List API partners
 * 
 * Query params:
 * - tenant_id: Filter by tenant (super_admin only)
 * - partner_type: Filter by type (pos, payment, invoice, etc.)
 * - is_active: Filter by active status (true/false)
 * - is_sandbox: Filter by sandbox mode (true/false)
 * - limit: Page size (default: 50, max: 100)
 * - offset: Pagination offset (default: 0)
 */
export async function GET(req: NextRequest) {
  // Check admin role
  const { user, tenant_id, is_super_admin, error } = await checkAdminRole(req);
  if (error) return error;
  
  try {
    const { searchParams } = new URL(req.url);
    
    // Parse query parameters
    const params: ListPartnersParams = {
      limit: Math.min(parseInt(searchParams.get('limit') || '50'), 100),
      offset: parseInt(searchParams.get('offset') || '0'),
    };
    
    // Tenant filter (super_admin can query all tenants)
    const requestedTenantId = searchParams.get('tenant_id');
    if (requestedTenantId) {
      if (is_super_admin) {
        params.tenant_id = requestedTenantId;
      } else {
        // Regular admin can only see their own tenant
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'AUTH_004',
              message: 'Cannot query other tenant. Super admin access required.',
            },
          },
          { status: 403 }
        );
      }
    } else {
      // Default: filter by current user's tenant (unless super_admin)
      if (!is_super_admin && tenant_id) {
        params.tenant_id = tenant_id;
      }
    }
    
    // Other filters
    if (searchParams.has('partner_type')) {
      params.partner_type = searchParams.get('partner_type') as any;
    }
    
    if (searchParams.has('is_active')) {
      params.is_active = searchParams.get('is_active') === 'true';
    }
    
    if (searchParams.has('is_sandbox')) {
      params.is_sandbox = searchParams.get('is_sandbox') === 'true';
    }
    
    // Fetch partners
    const { partners, total } = await listPartners(params);
    
    return NextResponse.json({
      success: true,
      data: partners,
      pagination: {
        total,
        limit: params.limit,
        offset: params.offset,
        has_more: total > (params.offset || 0) + (params.limit || 50),
      },
      meta: {
        timestamp: new Date().toISOString(),
        user_id: user.id,
        is_super_admin,
      },
    });
  } catch (error) {
    console.error('[GET /api/admin/partners] Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_002',
          message: 'Failed to fetch partners',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/partners
 * 
 * Create a new API partner
 * 
 * Request body:
 * - partner_name: string (required)
 * - partner_type: PartnerType (required)
 * - tenant_id: string (required for super_admin, auto-filled for admin)
 * - contact_email: string (optional)
 * - contact_phone: string (optional)
 * - allowed_scopes: APIScope[] (required)
 * - rate_limit_per_minute: number (optional, default: 100)
 * - rate_limit_per_day: number (optional, default: 5000)
 * - is_sandbox: boolean (optional, default: false)
 * - webhook_url: string (optional)
 * - metadata: object (optional)
 */
export async function POST(req: NextRequest) {
  // Check admin role
  const { user, tenant_id, is_super_admin, error } = await checkAdminRole(req);
  if (error) return error;
  
  try {
    const body: CreateAPIPartnerInput = await req.json();
    
    // Validate required fields
    if (!body.partner_name) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VAL_002',
            message: 'Missing required field: partner_name',
          },
        },
        { status: 400 }
      );
    }
    
    if (!body.partner_type) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VAL_002',
            message: 'Missing required field: partner_type',
          },
        },
        { status: 400 }
      );
    }
    
    if (!body.allowed_scopes || body.allowed_scopes.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VAL_002',
            message: 'Missing required field: allowed_scopes (must have at least one scope)',
          },
        },
        { status: 400 }
      );
    }
    
    // Tenant ID handling
    let partnerTenantId = body.tenant_id;
    
    if (!partnerTenantId) {
      if (is_super_admin) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VAL_002',
              message: 'tenant_id is required for super_admin',
            },
          },
          { status: 400 }
        );
      } else {
        // Regular admin: use their own tenant
        partnerTenantId = tenant_id!;
      }
    } else {
      // Validate tenant_id if provided
      if (!is_super_admin && partnerTenantId !== tenant_id) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'AUTH_004',
              message: 'Cannot create partner for other tenant. Super admin access required.',
            },
          },
          { status: 403 }
        );
      }
    }
    
    // Create partner
    const partner = await createPartner(
      {
        ...body,
        tenant_id: partnerTenantId,
      },
      user.id
    );
    
    return NextResponse.json(
      {
        success: true,
        data: partner,
        meta: {
          timestamp: new Date().toISOString(),
          created_by: user.id,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/admin/partners] Error:', error);
    
    // Handle API errors
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
          message: 'Failed to create partner',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}
