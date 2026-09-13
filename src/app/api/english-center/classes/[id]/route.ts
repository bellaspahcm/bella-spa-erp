import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { ClassService } from '@/products/bella-english-center/services/class.service';
import { UpdateClassInput } from '@/products/bella-english-center/types/class.types';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
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

    const service = new ClassService(supabase);
    const classItem = await service.getClass(tenantId, params.id);

    if (!classItem) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }

    return NextResponse.json(classItem, { status: 200 });
  } catch (error: unknown) {
    console.error('GET /api/english-center/classes/:id error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
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
    const input: UpdateClassInput = {
      name: body.name,
      capacity: body.capacity,
      teacherId: body.teacherId,
      startDate: body.startDate,
      endDate: body.endDate,
      scheduleDays: body.scheduleDays,
      scheduleTime: body.scheduleTime,
      status: body.status,
      metadata: body.metadata,
    };

    const service = new ClassService(supabase);
    const classItem = await service.updateClass(tenantId, params.id, input);

    return NextResponse.json(classItem, { status: 200 });
  } catch (error: unknown) {
    console.error('PATCH /api/english-center/classes/:id error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
