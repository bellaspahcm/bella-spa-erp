import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase-server';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { getCurrentUser } from '@/services/user-actions';
import { DailyCareService } from '@/products/bella-education/care-wellbeing/daily-care/daily-care.service';
import { PreschoolParentDailyExperienceService } from '@/products/bella-education/services/preschool-parent-daily-experience.service';
import type { Database } from '@/types/database.types';

type EducationDigestClient = SupabaseClient<Database>;

interface ParentContext {
  readonly tenantId: string;
  readonly userId: string;
  readonly phone: string | null;
}

function createAdminOperationClient(): EducationDigestClient | null {
  if (process.env.NODE_ENV === 'test') return null;

  const adminUrl = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();
  if (!adminUrl || !adminKey) return null;

  return createSupabaseClient<Database>(adminUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function resolveParentContext(client: EducationDigestClient): Promise<ParentContext | null> {
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

  return {
    tenantId: currentUser.tenant_id,
    userId: currentUser.id,
    phone: data?.phone ?? null,
  };
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const studentPartyId = searchParams.get('studentPartyId')?.trim() ?? '';

    if (!studentPartyId) {
      return NextResponse.json({ success: false, error: 'studentPartyId is required' }, { status: 400 });
    }

    const supabase = createAdminOperationClient() ?? await createClient();
    const context = await resolveParentContext(supabase);
    if (!context) {
      return NextResponse.json({ success: false, error: 'Authenticated parent is required' }, { status: 401 });
    }

    await new PreschoolParentDailyExperienceService(supabase).assertGuardianCanViewStudent({
      user: context,
      studentPartyId,
      schoolDay: new Date().toISOString().slice(0, 10),
    });

    const { data: digest, error } = await supabase
      .from('edu_daily_parent_digests')
      .select('*')
      .eq('tenant_id', context.tenantId)
      .eq('student_party_id', studentPartyId)
      .order('date', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      return NextResponse.json({ success: true, digestStatus: 'NONE' });
    }
    if (!digest) {
      return NextResponse.json({ success: true, digestStatus: 'NONE' });
    }

    return NextResponse.json({
      success: true,
      digestStatus: digest.status,
      digestId: digest.id,
      publishedAt: digest.published_at,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    const status = message === 'PARENT_DAILY_STUDENT_ACCESS_DENIED' ? 403 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createAdminOperationClient() ?? await createClient();
    const context = await resolveParentContext(supabase);
    if (!context) {
      return NextResponse.json({ success: false, error: 'Authenticated parent is required' }, { status: 401 });
    }

    const dailyCareService = new DailyCareService(supabase);

    const body = await request.json();
    const action = asString(body?.action);
    const classId = asString(body?.classId);
    const studentPartyId = asString(body?.studentPartyId);
    const date = asString(body?.date);
    const digestId = asString(body?.digestId);

    if (action === 'generate') {
      if (!classId || !studentPartyId || !date) {
        return NextResponse.json({ error: 'Missing classId, studentPartyId, or date' }, { status: 400 });
      }
      await new PreschoolParentDailyExperienceService(supabase).assertGuardianCanViewStudent({
        user: context,
        studentPartyId,
        schoolDay: date,
      });
      const digest = await dailyCareService.generateParentDigest(context.tenantId, classId, studentPartyId, date);
      return NextResponse.json({ success: true, digest });
    }

    if (action === 'publish') {
      if (!digestId) {
        return NextResponse.json({ error: 'Missing digestId' }, { status: 400 });
      }
      const { data: existingDigest, error: digestLookupError } = await supabase
        .from('edu_daily_parent_digests')
        .select('student_party_id, date')
        .eq('id', digestId)
        .eq('tenant_id', context.tenantId)
        .maybeSingle();

      if (digestLookupError) {
        throw new Error(`DIGEST_LOOKUP_FAILED: ${digestLookupError.message}`);
      }
      if (!existingDigest?.student_party_id || !existingDigest.date) {
        return NextResponse.json({ error: 'Digest not found' }, { status: 404 });
      }

      await new PreschoolParentDailyExperienceService(supabase).assertGuardianCanViewStudent({
        user: context,
        studentPartyId: existingDigest.student_party_id,
        schoolDay: existingDigest.date,
      });
      const digest = await dailyCareService.publishParentDigest(context.tenantId, digestId);
      return NextResponse.json({ success: true, digest });
    }

    return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
  } catch (error) {
    console.error('Parent Digest API Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    const status = message === 'PARENT_DAILY_STUDENT_ACCESS_DENIED' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
