import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase-server';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { getCurrentUser } from '@/services/user-actions';
import { PreschoolParentDailyExperienceService } from '@/products/bella-education/services/preschool-parent-daily-experience.service';
import type { Database } from '@/types/database.types';

type EducationParentDailyClient = SupabaseClient<Database>;

interface ParentContext {
  readonly tenantId: string;
  readonly userId: string;
  readonly phone: string | null;
}

function createAdminOperationClient(): EducationParentDailyClient | null {
  if (process.env.NODE_ENV === 'test') return null;

  const adminUrl = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();
  if (!adminUrl || !adminKey) return null;

  return createSupabaseClient<Database>(adminUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isSchoolDay(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function todayHoChiMinh(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

async function resolveParentContext(client: EducationParentDailyClient): Promise<ParentContext | null> {
  const currentUser = await getCurrentUser();
  if (!currentUser?.id || !currentUser.tenant_id) {
    return null;
  }

  const { data, error } = await client
    .from('users')
    .select('id, tenant_id, phone')
    .eq('id', currentUser.id)
    .eq('tenant_id', currentUser.tenant_id)
    .maybeSingle();

  if (error) {
    throw new Error(`PARENT_CONTEXT_LOOKUP_FAILED: ${error.message}`);
  }

  if (!data?.id || !data.tenant_id) {
    return {
      tenantId: currentUser.tenant_id,
      userId: currentUser.id,
      phone: null,
    };
  }

  return {
    tenantId: data.tenant_id,
    userId: data.id,
    phone: data.phone ?? null,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedDate = searchParams.get('date');
    const schoolDay = requestedDate ? requestedDate.trim() : todayHoChiMinh();
    const requestedStudentPartyId = searchParams.get('studentPartyId')?.trim() || undefined;

    if (!isSchoolDay(schoolDay)) {
      return NextResponse.json({ success: false, error: 'date must be YYYY-MM-DD' }, { status: 400 });
    }

    const operationClient = createAdminOperationClient() ?? await createClient();
    const context = await resolveParentContext(operationClient);
    if (!context) {
      return NextResponse.json({ success: false, error: 'Authenticated parent is required' }, { status: 401 });
    }

    const dailyExperience = await new PreschoolParentDailyExperienceService(operationClient).getDailyExperience({
      user: context,
      schoolDay,
      requestedStudentPartyId,
    });

    return NextResponse.json({ success: true, dailyExperience });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message === 'PARENT_DAILY_STUDENT_ACCESS_DENIED' ? 403 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
