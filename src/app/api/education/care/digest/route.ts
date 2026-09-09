import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DailyCareService } from '@/products/bella-education/care-wellbeing/daily-care/daily-care.service';

export async function GET(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    if (!supabaseKey) {
      return NextResponse.json({ error: 'Supabase key not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || '00000000-0000-0000-0000-000000000001';
    const studentId = searchParams.get('studentId') || '00000000-0000-0000-0000-000000000101';

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: digest } = await supabase
      .from('edu_daily_parent_digests')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('student_id', studentId)
      .single();

    if (!digest) {
      return NextResponse.json({ success: true, digestStatus: 'DRAFT' });
    }

    return NextResponse.json({
      success: true,
      digestStatus: digest.status,
      digestId: digest.id,
      publishedAt: digest.published_at,
    });
  } catch (error: any) {
    return NextResponse.json({ success: true, digestStatus: 'DRAFT' });
  }
}

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    if (!supabaseKey) {
      return NextResponse.json({ error: 'Supabase key not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const dailyCareService = new DailyCareService(supabase);

    const body = await request.json();
    const { action, tenantId, classId, studentId, date, digestId } = body;

    if (action === 'generate') {
      if (!tenantId || !classId || !studentId || !date) {
        return NextResponse.json({ error: 'Missing tenantId, classId, studentId, or date' }, { status: 400 });
      }
      const digest = await dailyCareService.generateParentDigest(tenantId, classId, studentId, date);
      return NextResponse.json({ success: true, digest });
    }

    if (action === 'publish') {
      if (!tenantId || !digestId) {
        return NextResponse.json({ error: 'Missing tenantId or digestId' }, { status: 400 });
      }
      const digest = await dailyCareService.publishParentDigest(tenantId, digestId);
      return NextResponse.json({ success: true, digest });
    }

    return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error('Parent Digest API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
