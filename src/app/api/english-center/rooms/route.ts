import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { TimetableService } from '@/products/bella-english-center/services/timetable.service';
import { CreateRoomInput } from '@/products/bella-english-center/types/timetable.types';

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
    const input: CreateRoomInput = {
      branchId: body.branchId,
      code: body.code,
      name: body.name,
      capacity: body.capacity,
      metadata: body.metadata,
    };

    const service = new TimetableService(supabase);
    const room = await service.createRoom(tenantId, input);

    return NextResponse.json(room, { status: 201 });
  } catch (error: unknown) {
    console.error('POST /api/english-center/rooms error:', error);
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
    const service = new TimetableService(supabase);
    const result = await service.listRooms(tenantId, {
      branchId: searchParams.get('branchId') || undefined,
      status: (searchParams.get('status') as 'active' | 'inactive' | null) || undefined,
      limit: parseInt(searchParams.get('limit') || '50', 10),
      offset: parseInt(searchParams.get('offset') || '0', 10),
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    console.error('GET /api/english-center/rooms error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
