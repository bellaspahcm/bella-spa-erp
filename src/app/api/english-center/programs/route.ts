import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { ProgramService } from '@/products/bella-english-center/services/program.service';
import { CreateProgramInput } from '@/products/bella-english-center/types/program.types';

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
    const input: CreateProgramInput = {
      code: body.code,
      name: body.name,
      description: body.description,
      branchId: body.branchId,
      metadata: body.metadata,
    };

    if (!input.code || !input.name) {
      return NextResponse.json({ error: 'Missing required fields: code, name' }, { status: 400 });
    }

    const service = new ProgramService(supabase);
    const program = await service.createProgram(tenantId, input);

    return NextResponse.json(program, { status: 201 });
  } catch (error: unknown) {
    console.error('POST /api/english-center/programs error:', error);
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
    const status = searchParams.get('status') as 'active' | 'inactive' | undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const service = new ProgramService(supabase);
    const result = await service.listPrograms(tenantId, { status, limit, offset });

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    console.error('GET /api/english-center/programs error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
