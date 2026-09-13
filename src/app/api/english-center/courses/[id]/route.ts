import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { CourseService } from '@/products/bella-english-center/services/course.service';
import { UpdateCourseInput } from '@/products/bella-english-center/types/course.types';

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

    const service = new CourseService(supabase);
    const course = await service.getCourse(tenantId, params.id);

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    return NextResponse.json(course, { status: 200 });
  } catch (error: unknown) {
    console.error('GET /api/english-center/courses/:id error:', error);
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
    const input: UpdateCourseInput = {
      name: body.name,
      level: body.level,
      durationHours: body.durationHours,
      description: body.description,
      status: body.status,
      metadata: body.metadata,
    };

    const service = new CourseService(supabase);
    const course = await service.updateCourse(tenantId, params.id, input);

    return NextResponse.json(course, { status: 200 });
  } catch (error: unknown) {
    console.error('PATCH /api/english-center/courses/:id error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
