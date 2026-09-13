import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { TeacherService } from '@/products/bella-english-center/services/teacher.service';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = user.user_metadata?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: 'Tenant not found' }, { status: 400 });
    const service = new TeacherService(supabase);
    const branches = await service.listTeacherBranches(tenantId, params.id);
    return NextResponse.json({ branches }, { status: 200 });
  } catch (error: unknown) {
    console.error('GET /api/english-center/teachers/:id/branches error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
