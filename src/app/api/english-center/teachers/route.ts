import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { TeacherService } from '@/products/bella-english-center/services/teacher.service';
import { CreateTeacherInput } from '@/products/bella-english-center/types/teacher.types';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = user.user_metadata?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: 'Tenant not found' }, { status: 400 });
    const body = await request.json();
    const input: CreateTeacherInput = { partyId: body.partyId, employeeCode: body.employeeCode, certifications: body.certifications, specializations: body.specializations, languages: body.languages, metadata: body.metadata };
    if (!input.partyId) return NextResponse.json({ error: 'Missing required field: partyId' }, { status: 400 });
    const service = new TeacherService(supabase);
    const teacher = await service.createTeacher(tenantId, input);
    return NextResponse.json(teacher, { status: 201 });
  } catch (error: unknown) {
    console.error('POST /api/english-center/teachers error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = user.user_metadata?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: 'Tenant not found' }, { status: 400 });
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const service = new TeacherService(supabase);
    const result = await service.listTeachers(tenantId, { status, limit, offset });
    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    console.error('GET /api/english-center/teachers error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
