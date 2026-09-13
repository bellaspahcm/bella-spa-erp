import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { ProgramService } from '@/products/bella-english-center/services/program.service';
import { UpdateProgramInput } from '@/products/bella-english-center/types/program.types';

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

    const service = new ProgramService(supabase);
    const program = await service.getProgram(tenantId, params.id);

    if (!program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    return NextResponse.json(program, { status: 200 });
  } catch (error: unknown) {
    console.error('GET /api/english-center/programs/:id error:', error);
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
    const input: UpdateProgramInput = {
      name: body.name,
      description: body.description,
      status: body.status,
      metadata: body.metadata,
    };

    const service = new ProgramService(supabase);
    const program = await service.updateProgram(tenantId, params.id, input);

    return NextResponse.json(program, { status: 200 });
  } catch (error: unknown) {
    console.error('PATCH /api/english-center/programs/:id error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
