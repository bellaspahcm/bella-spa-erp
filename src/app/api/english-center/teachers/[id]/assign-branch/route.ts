import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { TeacherService } from '@/products/bella-english-center/services/teacher.service';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = user.user_metadata?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: 'Tenant not found' }, { status: 400 });
    const body = await request.json();
    const { branchId, isPrimary } = body;
    if (!branchId) return NextResponse.json({ error: 'Missing required field: branchId' }, { status: 400 });
    const service = new TeacherService(supabase);
    const assignment = await service.assignBranch(tenantId, params.id, branchId, isPrimary || false);
    return NextResponse.json(assignment, { status: 201 });
  } catch (error: unknown) {
    console.error('POST /api/english-center/teachers/:id/assign-branch error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
