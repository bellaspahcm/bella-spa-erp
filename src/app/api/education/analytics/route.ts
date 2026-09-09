import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PreschoolAnalyticsRepository } from '@/products/bella-education/analytics/repositories/preschool-analytics.repository';
import { PreschoolAnalyticsService } from '@/products/bella-education/analytics/services/preschool-analytics.service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || '00000000-0000-0000-0000-000000000001';
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    if (!supabaseKey) {
      return NextResponse.json({ error: 'Supabase key not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const repo = new PreschoolAnalyticsRepository(supabase);
    const service = new PreschoolAnalyticsService(repo);

    const dashboard = await service.getExecutiveDashboard(tenantId, date);

    return NextResponse.json({ success: true, dashboard });
  } catch (error: any) {
    console.error('Preschool Analytics API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
