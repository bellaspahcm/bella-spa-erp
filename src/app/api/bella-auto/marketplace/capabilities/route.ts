/**
 * GET /api/bella-auto/marketplace/capabilities - List all public capabilities
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPrimaryClient } from '@/lib/database/read-replica';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const supabase = getPrimaryClient();
    const { searchParams } = new URL(request.url);
    
    const category = searchParams.get('category');
    const provider = searchParams.get('provider');

    let query = supabase
      .from('auto_capabilities')
      .select('*')
      .eq('is_public', true)
      .order('install_count', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    if (provider) {
      query = query.eq('provider', provider);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch capabilities', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ capabilities: data });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
