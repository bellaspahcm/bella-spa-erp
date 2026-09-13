import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { ClassService } from '@/products/bella-english-center/services/class.service';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = user.user_metadata?.tenant_id;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 400 });
    }

    const body = await request.json();
    const { teacherId } = body;

    if (!teacherId) {
      return NextResponse.json({ error: 'Missing required field: teacherId' }, { status: 400 });
    }

    const service = new ClassService(supabase);
    const classItem = await service.assignTeacher(tenantId, params.id, teacherId);

    return NextResponse.json(classItem, { status: 200 });
  } catch (error: unknown) {
    console.error('POST /api/english-center/classes/:id/assign-teacher error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
