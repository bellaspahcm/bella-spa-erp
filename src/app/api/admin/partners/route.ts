/**
 * API Route: /api/admin/partners
 * 
 * Handles:
 * - GET: List partners with filtering and pagination
 * - POST: Create new partner
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import {
  createPartner,
  listPartners,
  type ListPartnersParams,
} from '@/services/api-gateway/partner.service';
import {
  CreateAPIPartnerInput,
  APIError,
  PartnerType,
} from '@/types/api-gateway';

/**
 * GET /api/admin/partners
 * 
 * List partners with filtering and pagination
 * 
 * Query params:
 * - tenant_id (optional, defaults to user's tenant)
 * - partner_type (optional)
 * - is_active (optional)
 * - is_sandbox (optional)
 * - limit (default: 20)
 * - offset (default: 0)
 * - search (optional, searches partner_name)
 */
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
    const params: ListPartnersParams = {
      tenant_id: profile.tenant_id,
      partner_type: searchParams.get('type') as PartnerType | undefined,
      is_active:
        searchParams.get('is_active') === 'true'
          ? true
          : searchParams.get('is_active') === 'false'
          ? false
          : undefined,
      is_sandbox:
        searchParams.get('is_sandbox') === 'true'
          ? true
          : searchParams.get('is_sandbox') === 'false'
          ? false
          : undefined,
      limit: parseInt(searchParams.get('limit') || '20'),
      offset: parseInt(searchParams.get('offset') || '0'),
    };

    const search = searchParams.get('search');

    // Fetch partners
    const { partners, total } = await listPartners(params);

    // Apply search filter if provided (case-insensitive)
    let filteredPartners = partners;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredPartners = partners.filter((p) =>
        p.partner_name.toLowerCase().includes(searchLower)
      );
    }

    return NextResponse.json({
      success: true,
      data: filteredPartners,
      pagination: {
        total: search ? filteredPartners.length : total,
        limit: params.limit,
        offset: params.offset,
        has_more: params.offset + params.limit < (search ? filteredPartners.length : total),
      },
    });
  } catch (error: any) {
    console.error('Error listing partners:', error);

    if (error instanceof APIError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: error.message,
            code: error.code,
            details: error.details,
          },
        },
        { status: error.statusCode }
      );
    }

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

/**
 * POST /api/admin/partners
 * 
 * Create a new API partner
 * 
 * Body: CreateAPIPartnerInput
 */
export async function POST(request: NextRequest) {
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

    // Parse request body
    const body: CreateAPIPartnerInput = await request.json();

    // Validate required fields
    if (!body.partner_name || !body.partner_type || !body.allowed_scopes) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Missing required fields: partner_name, partner_type, allowed_scopes',
            code: 'VAL_002',
          },
        },
        { status: 400 }
      );
    }

    // Override tenant_id with user's tenant for security
    body.tenant_id = profile.tenant_id;

    // Create partner
    const partner = await createPartner(body, user.id);

    return NextResponse.json(
      {
        success: true,
        data: partner,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating partner:', error);

    if (error instanceof APIError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: error.message,
            code: error.code,
            details: error.details,
          },
        },
        { status: error.statusCode }
      );
    }

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
