import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { TeacherService } from '@/products/bella-english-center/services/teacher.service';
import { UpdateTeacherInput } from '@/products/bella-english-center/types/teacher.types';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = user.user_metadata?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: 'Tenant not found' }, { status: 400 });
    const service = new TeacherService(supabase);
    const teacher = await service.getTeacher(tenantId, params.id);
    if (!teacher) return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });
    return NextResponse.json(teacher, { status: 200 });
  } catch (error: unknown) {
    console.error('GET /api/english-center/teachers/:id error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = user.user_metadata?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: 'Tenant not found' }, { status: 400 });
    const body = await request.json();
    const input: UpdateTeacherInput = { employeeCode: body.employeeCode, certifications: body.certifications, specializations: body.specializations, languages: body.languages, status: body.status, metadata: body.metadata };
    const service = new TeacherService(supabase);
    const teacher = await service.updateTeacher(tenantId, params.id, input);
    return NextResponse.json(teacher, { status: 200 });
  } catch (error: unknown) {
    console.error('PATCH /api/english-center/teachers/:id error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
