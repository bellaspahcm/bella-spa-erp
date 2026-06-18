/**
 * API Route: /api/admin/partners/[id]
 * 
 * Handles:
 * - GET: Get partner by ID
 * - PUT: Update partner
 * - DELETE: Delete partner (soft delete)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import {
  getPartnerById,
  updatePartner,
  deletePartner,
} from '@/services/api-gateway/partner.service';
import { UpdateAPIPartnerInput, APIError } from '@/types/api-gateway';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/admin/partners/[id]
 * 
 * Get partner by ID
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
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

    // Fetch partner (with tenant security check)
    const partner = await getPartnerById(id, profile.tenant_id);

    if (!partner) {
      return NextResponse.json(
        { success: false, error: { message: 'Partner not found', code: 'VAL_001' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: partner,
    });
  } catch (error: any) {
    console.error('Error fetching partner:', error);

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
 * PUT /api/admin/partners/[id]
 * 
 * Update partner
 * 
 * Body: UpdateAPIPartnerInput
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
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

    // Verify partner belongs to user's tenant
    const existingPartner = await getPartnerById(id, profile.tenant_id);
    if (!existingPartner) {
      return NextResponse.json(
        { success: false, error: { message: 'Partner not found', code: 'VAL_001' } },
        { status: 404 }
      );
    }

    // Parse request body
    const body: UpdateAPIPartnerInput = await request.json();

    // Update partner
    const partner = await updatePartner(id, body, user.id);

    return NextResponse.json({
      success: true,
      data: partner,
    });
  } catch (error: any) {
    console.error('Error updating partner:', error);

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
 * DELETE /api/admin/partners/[id]
 * 
 * Delete partner (soft delete by setting is_active = false)
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
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

    // Verify partner belongs to user's tenant
    const existingPartner = await getPartnerById(id, profile.tenant_id);
    if (!existingPartner) {
      return NextResponse.json(
        { success: false, error: { message: 'Partner not found', code: 'VAL_001' } },
        { status: 404 }
      );
    }

    // Delete partner (soft delete)
    await deletePartner(id);

    return NextResponse.json({
      success: true,
      data: { message: 'Partner deleted successfully' },
    });
  } catch (error: any) {
    console.error('Error deleting partner:', error);

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
