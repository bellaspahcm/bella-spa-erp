import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import {
  TimetableConflictError,
  TimetableService,
} from '@/products/bella-english-center/services/timetable.service';
import {
  ScheduleClassSessionInput,
  TimetableListFilters,
} from '@/products/bella-english-center/types/timetable.types';

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
    const input: ScheduleClassSessionInput = {
      branchId: body.branchId,
      classId: body.classId,
      teacherId: body.teacherId,
      roomId: body.roomId,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      topic: body.topic,
      metadata: body.metadata,
    };

    const service = new TimetableService(supabase);
    const session = await service.scheduleSession(tenantId, input);

    return NextResponse.json(session, { status: 201 });
  } catch (error: unknown) {
    console.error('POST /api/english-center/timetable error:', error);
    if (error instanceof TimetableConflictError) {
      return NextResponse.json({ error: error.message, conflicts: error.conflicts }, { status: 409 });
    }
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
    const filters: TimetableListFilters = {
      branchId: searchParams.get('branchId') || undefined,
      classId: searchParams.get('classId') || undefined,
      teacherId: searchParams.get('teacherId') || undefined,
      roomId: searchParams.get('roomId') || undefined,
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
      status: (searchParams.get('status') as TimetableListFilters['status'] | null) || undefined,
      limit: parseInt(searchParams.get('limit') || '100', 10),
      offset: parseInt(searchParams.get('offset') || '0', 10),
    };

    const service = new TimetableService(supabase);
    const result = await service.listSessions(tenantId, filters);

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    console.error('GET /api/english-center/timetable error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
