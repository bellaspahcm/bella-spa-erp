import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

/**
 * GET /api/admin/partner-applications
 * 
 * List all partner applications (admin only)
 * 
 * Query params:
 * - status?: string (filter by status)
 * - search?: string (search by name/email/company)
 * - limit?: number (pagination)
 * - offset?: number (pagination)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);

    // 1. Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Verify admin role
    const { data: userRoles, error: roleError } = await supabase
      .from('user_roles')
      .select('role_name')
      .eq('user_id', user.id)
      .in('role_name', ['admin', 'super_admin']);

    console.log('[GET /api/admin/partner-applications] User:', user.email);
    console.log('[GET /api/admin/partner-applications] User roles:', userRoles);

    if (roleError || !userRoles || userRoles.length === 0) {
      console.error('[GET /api/admin/partner-applications] Role check failed:', roleError);
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin role required' },
        { status: 403 }
      );
    }

    // 3. Build query
    let query = supabase
      .from('partner_applications')
      .select('*', { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    // Filter by status
    const status = searchParams.get('status');
    if (status && status !== 'all') {
      query = query.eq('status', status as any);
    }

    // Search by name/email/company
    const search = searchParams.get('search');
    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,company_name.ilike.%${search}%`);
    }

    // Pagination
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    query = query.range(offset, offset + limit - 1);

    // Execute query
    const { data: applications, error, count } = await query;

    if (error) {
      console.error('[GET /api/admin/partner-applications] Error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      applications: applications || [],
      total: count || 0,
      limit,
      offset,
    });

  } catch (error) {
    console.error('[GET /api/admin/partner-applications] Exception:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
