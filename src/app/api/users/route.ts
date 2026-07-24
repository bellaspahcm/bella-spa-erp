import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '@/services/user-actions';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenant_id');
    const role = searchParams.get('role'); // e.g., 'ktv'
    const limit = parseInt(searchParams.get('limit') || '100');

    // 1. Authentication Check
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Validate tenantId
    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenant_id is required' },
        { status: 400 }
      );
    }

    // Tenant boundary check: standard users cannot query other tenants
    const isSuperAdmin = currentUser.role === 'super_admin' || currentUser.role === 'hq_super_admin';
    if (tenantId !== currentUser.tenant_id && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Tenant mismatch' },
        { status: 403 }
      );
    }

    const supabase = createClient();

    let query = supabase
      .from('users')
      .select('id, full_name, role, email')
      .eq('tenant_id', tenantId)
      .limit(limit);

    if (role) {
      query = query.eq('role', role);
    }

    const { data, error } = await query.order('full_name');

    if (error) {
      console.error('[API /api/users] Error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Transform data to match UI expectations
    const users = (data || []).map((user: any) => ({
      id: user.id,
      name: user.full_name, // UI expects "name"
      role: user.role,
      email: user.email,
    }));

    return NextResponse.json({ users });
  } catch (error) {
    console.error('[API /api/users] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
