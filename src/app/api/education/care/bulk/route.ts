import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase-server';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { getCurrentUser } from '@/services/user-actions';
import { DailyCareService } from '@/products/bella-education/care-wellbeing/daily-care/daily-care.service';
import type { DailyCareAction } from '@/products/bella-education/care-wellbeing/daily-care/daily-care.contract';
import type { Database } from '@/types/database.types';

type EducationCareClient = SupabaseClient<Database>;

interface CareRequestBody {
  readonly action?: unknown;
  readonly courseId?: unknown;
  readonly date?: unknown;
  readonly data?: unknown;
}

type CarePayload = {
  readonly arrivals?: Array<{
    readonly studentPartyId?: unknown;
    readonly status?: unknown;
    readonly condition?: unknown;
  }>;
  readonly mealItemId?: unknown;
  readonly mealType?: unknown;
  readonly students?: Array<{
    readonly studentPartyId?: unknown;
    readonly portion?: unknown;
    readonly notes?: unknown;
  }>;
  readonly hygieneEntries?: Array<{
    readonly studentPartyId?: unknown;
    readonly type?: unknown;
    readonly notes?: unknown;
  }>;
  readonly napEntries?: Array<{
    readonly studentPartyId?: unknown;
    readonly quality?: unknown;
    readonly notes?: unknown;
  }>;
};

function getDevMockEmail(request: Request): string {
  if (process.env.NODE_ENV !== 'development') return '';
  return request.headers.get('x-mock-user-email')?.trim() ?? '';
}

function createAdminOperationClient(): EducationCareClient | null {
  if (process.env.NODE_ENV === 'test') return null;

  const adminUrl = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();
  if (!adminUrl || !adminKey) return null;

  return createSupabaseClient<Database>(adminUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function createDevMockClient(mockEmail: string): EducationCareClient | null {
  if (!mockEmail) return null;
  return createAdminOperationClient();
}

async function resolveTenantId(request: Request): Promise<string | null> {
  const mockEmail = getDevMockEmail(request);

  if (mockEmail) {
    const supabase = createClient();
    const { data: user, error } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('email', mockEmail)
      .maybeSingle();

    if (error) {
      throw new Error(`CARE_AUTH_CONTEXT_FAILED: ${error.message}`);
    }
    if (user?.tenant_id) return user.tenant_id;
  }

  const currentUser = await getCurrentUser();
  return currentUser?.tenant_id ?? null;
}

function isSchoolDay(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isCareAction(value: unknown): value is DailyCareAction {
  return value === 'arrival' || value === 'meal' || value === 'hygiene' || value === 'nap';
}

function asPayload(value: unknown): CarePayload {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as CarePayload : {};
}

function isArrivalStatus(value: unknown): value is 'PRESENT' | 'ABSENT' | 'LATE' {
  return value === 'PRESENT' || value === 'ABSENT' || value === 'LATE';
}

function isMealPortion(value: unknown): value is 'ALL' | 'HALF' | 'FEW' | 'NONE' {
  return value === 'ALL' || value === 'HALF' || value === 'FEW' || value === 'NONE';
}

function isMealType(value: unknown): value is 'BREAKFAST' | 'LUNCH' | 'AFTERNOON_SNACK' {
  return value === 'BREAKFAST' || value === 'LUNCH' || value === 'AFTERNOON_SNACK';
}

function isHygieneType(value: unknown): value is 'DIAPER' | 'TOILET' | 'BOWEL_MOVEMENT' {
  return value === 'DIAPER' || value === 'TOILET' || value === 'BOWEL_MOVEMENT';
}

function isNapQuality(value: unknown): value is 'DEEP' | 'RESTLESS' | 'REFUSED' {
  return value === 'DEEP' || value === 'RESTLESS' || value === 'REFUSED';
}

function getCareClient(request: Request): EducationCareClient {
  return createDevMockClient(getDevMockEmail(request)) ?? createAdminOperationClient() ?? createClient();
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId')?.trim() ?? '';
    const date = searchParams.get('date');
    const tenantId = await resolveTenantId(request);

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Authenticated tenant is required' }, { status: 401 });
    }
    if (!courseId) {
      return NextResponse.json({ success: false, error: 'courseId is required' }, { status: 400 });
    }
    if (!isSchoolDay(date)) {
      return NextResponse.json({ success: false, error: 'date must be YYYY-MM-DD' }, { status: 400 });
    }

    const service = new DailyCareService(getCareClient(request));
    const roster = await service.getDailyCareRoster(tenantId, courseId, date);

    return NextResponse.json({ success: true, roster });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const tenantId = await resolveTenantId(request);
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Authenticated tenant is required' }, { status: 401 });
    }

    const body = (await request.json()) as CareRequestBody;
    const action = body.action;
    const courseId = asString(body.courseId);
    const date = body.date;
    const payload = asPayload(body.data);

    if (!isCareAction(action)) {
      return NextResponse.json({ success: false, error: 'action must be arrival, meal, hygiene, or nap' }, { status: 400 });
    }
    if (!courseId) {
      return NextResponse.json({ success: false, error: 'courseId is required' }, { status: 400 });
    }
    if (!isSchoolDay(date)) {
      return NextResponse.json({ success: false, error: 'date must be YYYY-MM-DD' }, { status: 400 });
    }

    const service = new DailyCareService(getCareClient(request));

    if (action === 'arrival') {
      const arrivals = (payload.arrivals ?? []).map((entry) => ({
        studentPartyId: asString(entry.studentPartyId),
        status: isArrivalStatus(entry.status) ? entry.status : 'PRESENT',
        condition: asString(entry.condition) || 'GOOD',
      })).filter((entry) => entry.studentPartyId);

      const result = await service.recordBulkArrival({ tenantId, courseId, date, arrivals });
      return NextResponse.json({ success: result.blocked === 0, result });
    }

    if (action === 'meal') {
      const mealType = isMealType(payload.mealType) ? payload.mealType : 'LUNCH';
      const students = (payload.students ?? []).map((entry) => ({
        studentPartyId: asString(entry.studentPartyId),
        portion: isMealPortion(entry.portion) ? entry.portion : 'ALL',
        notes: asString(entry.notes) || undefined,
      })).filter((entry) => entry.studentPartyId);

      const result = await service.recordBulkMeals({
        tenantId,
        courseId,
        date,
        mealItemId: asString(payload.mealItemId) || undefined,
        mealType,
        students,
      });
      return NextResponse.json({ success: result.blocked === 0, result });
    }

    if (action === 'hygiene') {
      const hygieneEntries = (payload.hygieneEntries ?? []).map((entry) => ({
        studentPartyId: asString(entry.studentPartyId),
        type: isHygieneType(entry.type) ? entry.type : 'TOILET',
        notes: asString(entry.notes) || undefined,
      })).filter((entry) => entry.studentPartyId);

      const result = await service.recordBulkHygiene({ tenantId, courseId, date, hygieneEntries });
      return NextResponse.json({ success: result.blocked === 0, result });
    }

    const napEntries = (payload.napEntries ?? []).map((entry) => ({
      studentPartyId: asString(entry.studentPartyId),
      quality: isNapQuality(entry.quality) ? entry.quality : 'DEEP',
      notes: asString(entry.notes) || undefined,
    })).filter((entry) => entry.studentPartyId);

    const result = await service.recordBulkNap({ tenantId, courseId, date, napEntries });
    return NextResponse.json({ success: result.blocked === 0, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
