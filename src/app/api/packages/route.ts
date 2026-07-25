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
      .select('id, name, price, duration, full_price, description, default_duration_minutes')
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
    const packages = (data || []).map((pkg) => {
      // Extract duration minutes from text if default_duration_minutes is missing/invalid
      let durationMinutes = pkg.default_duration_minutes;
      if (!durationMinutes && pkg.duration) {
        const match = pkg.duration.match(/\d+/);
        if (match) {
          durationMinutes = parseInt(match[0], 10);
        }
      }
      if (!durationMinutes) {
        durationMinutes = 90; // Fallback
      }

      // Use price (bigint) primarily, fallback to full_price (numeric)
      const packagePrice = pkg.price !== null && pkg.price !== undefined
        ? Number(pkg.price)
        : Number(pkg.full_price || 0);

      return {
        id: pkg.id,
        name: pkg.name,
        price: packagePrice,
        description: pkg.description,
        duration_minutes: durationMinutes,
      };
    });

    return NextResponse.json({ packages });
  } catch (error) {
    console.error('[API /api/packages] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
