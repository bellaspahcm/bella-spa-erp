import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Auth check
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get tenant
    const { data: profile } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile?.tenant_id) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const variantId = searchParams.get('variantId');
    const colorExterior = searchParams.get('colorExterior');

    if (!variantId) {
      return NextResponse.json({ error: 'Variant ID required' }, { status: 400 });
    }

    // Build query
    let query = supabase
      .from('auto_vehicles')
      .select('id, vin, color_exterior, status')
      .eq('tenant_id', profile.tenant_id)
      .eq('variant_id', variantId)
      .eq('status', 'available');

    // Filter by color if provided
    if (colorExterior) {
      query = query.eq('color_exterior', colorExterior);
    }

    const { data: vehicles, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Available vehicles fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch available vehicles' }, { status: 500 });
    }

    return NextResponse.json({ vehicles: vehicles || [] });
  } catch (error) {
    console.error('Available vehicles fetch exception:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
