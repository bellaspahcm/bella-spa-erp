import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { ClassService } from '@/products/bella-english-center/services/class.service';
import { CreateClassInput } from '@/products/bella-english-center/types/class.types';

export async function POST(request: NextRequest) {
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
    const input: CreateClassInput = {
      branchId: body.branchId,
      courseId: body.courseId,
      code: body.code,
      name: body.name,
      capacity: body.capacity,
      teacherId: body.teacherId,
      startDate: body.startDate,
      endDate: body.endDate,
      scheduleDays: body.scheduleDays,
      scheduleTime: body.scheduleTime,
      metadata: body.metadata,
    };

    if (!input.branchId || !input.courseId || !input.code || !input.name) {
      return NextResponse.json({ error: 'Missing required fields: branchId, courseId, code, name' }, { status: 400 });
    }

    const service = new ClassService(supabase);
    const classItem = await service.createClass(tenantId, input);

    return NextResponse.json(classItem, { status: 201 });
  } catch (error: unknown) {
    console.error('POST /api/english-center/classes error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId') || undefined;
    const courseId = searchParams.get('courseId') || undefined;
    const status = searchParams.get('status') as 'planned' | 'active' | 'completed' | 'cancelled' | undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const service = new ClassService(supabase);
    const result = await service.listClasses(tenantId, { branchId, courseId, status, limit, offset });

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    console.error('GET /api/english-center/classes error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
