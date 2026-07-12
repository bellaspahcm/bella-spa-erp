import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenant_id');
    const limit = parseInt(searchParams.get('limit') || '100');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenant_id is required' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    const { data, error } = await supabase
      .from('packages')
      .select('id, name, full_price, description, default_duration_minutes')
      .eq('tenant_id', tenantId)
      .limit(limit)
      .order('name');

    if (error) {
      console.error('[API /api/packages] Error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Transform data to match UI expectations
    const packages = (data || []).map((pkg: any) => ({
      id: pkg.id,
      name: pkg.name,
      price: pkg.full_price, // UI expects "price"
      description: pkg.description,
      duration_minutes: pkg.default_duration_minutes, // UI expects "duration_minutes"
    }));

    return NextResponse.json({ packages });
  } catch (error) {
    console.error('[API /api/packages] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
