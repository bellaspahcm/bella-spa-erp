import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { getLocalDateString } from '@bella/shared';
import { createClient } from '@/lib/supabase-server';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { TeacherAssignmentContractImpl } from '@/platform/education/contracts/teacher-assignment.contract.impl';
import { getCurrentUser } from '@/services/user-actions';
import type { Database } from '@/types/database.types';

type EducationCoursesClient = SupabaseClient<Database>;
const ROSTER_ENROLLMENT_STATUSES = ['active', 'pending'] as const;

export interface ClassroomOverviewItem {
  id: string;
  code: string;
  name: string;
  grade: string;
  gradeKey: 'mam' | 'choi' | 'la' | 'nursery';
  room: string;
  teacher: string;
  teacherPartyId?: string;
  students: number;
  maxStudents: number;
  academicYear: string;
  focus: string;
  status: 'active' | 'inactive' | 'archived';
  todayStatus: {
    present: number;
    excused: number;
    unmarked: number;
    healthAlerts: number;
  };
}

function getDevMockEmail(request: Request): string {
  if (process.env.NODE_ENV !== 'development') return '';
  return request.headers.get('x-mock-user-email')?.trim() ?? '';
}

function createDevMockClient(mockEmail: string): EducationCoursesClient | null {
  if (!mockEmail) return null;
  const adminUrl = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();
  if (!adminUrl || !adminKey) return null;

  return createSupabaseClient<Database>(adminUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getTenantIdForCourses(
  supabase: EducationCoursesClient,
  request: Request,
): Promise<string> {
  const { searchParams } = new URL(request.url);
  const explicitTenantId = searchParams.get('tenantId');
  if (explicitTenantId) return explicitTenantId;

  const mockEmail = getDevMockEmail(request);
  if (mockEmail) {
    const { data: mockUser } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('email', mockEmail)
      .maybeSingle();
    if (mockUser?.tenant_id) return mockUser.tenant_id;
  }

  const currentUser = await getCurrentUser();
  return currentUser?.tenant_id || '00000000-0000-0000-0000-000000000001';
}

export async function GET(request: Request) {
  try {
    const supabase = createDevMockClient(getDevMockEmail(request)) ?? await createClient();
    const tenantId = await getTenantIdForCourses(supabase, request);

    // 1. Fetch courses from DB
    const { data: dbCourses, error: courseErr } = await supabase
      .from('courses')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (courseErr) {
      return NextResponse.json({ success: false, error: courseErr.message }, { status: 500 });
    }

    const teacherContract = new TeacherAssignmentContractImpl(supabase);

    // 2. Map courses to ClassroomOverviewItem
    const classrooms: ClassroomOverviewItem[] = [];

    for (const course of dbCourses || []) {
      // Fetch active teacher assignments for course
      const teacherAssignments = await teacherContract.getCourseTeachers(tenantId, course.course_id);
      
      let teacherNames = 'Chưa phân công GVN';
      let leadTeacherPartyId: string | undefined = undefined;

      if (teacherAssignments.length > 0) {
        // Fetch teacher party display names
        const partyIds = teacherAssignments.map(t => t.teacherPartyId);
        const { data: parties } = await supabase
          .from('party_parties')
          .select('id, display_name')
          .in('id', partyIds);

        const partyMap = new Map((parties || []).map(p => [p.id, p.display_name]));

        const lead = teacherAssignments.find(t => t.role === 'lead_teacher');
        if (lead) {
          leadTeacherPartyId = lead.teacherPartyId;
        }

        teacherNames = teacherAssignments
          .map(t => `${partyMap.get(t.teacherPartyId) || 'Giáo viên'} (${t.role === 'lead_teacher' ? 'Chủ nhiệm' : 'Phó bản'})`)
          .join(' & ');
      }

      // Count canonical active enrollments for capacity.
      const { count: studentCount } = await supabase
        .from('edu_enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('course_id', course.course_id)
        .eq('tenant_id', tenantId)
        .in('status', [...ROSTER_ENROLLMENT_STATUSES]);

      // Grade key mapping from course_code or course_name
      let gradeKey: 'mam' | 'choi' | 'la' | 'nursery' = 'mam';
      const codeUpper = (course.course_code || '').toUpperCase();
      if (codeUpper.includes('CHOI') || course.course_name.includes('Chồi')) gradeKey = 'choi';
      else if (codeUpper.includes('LA') || course.course_name.includes('Lá')) gradeKey = 'la';
      else if (codeUpper.includes('NURSERY') || course.course_name.includes('Nhi')) gradeKey = 'nursery';

      const currentStudents = studentCount || 0;
      const maxCap = course.duration_weeks || 25; // using duration_weeks or fallback 25 for max capacity
      const today = getLocalDateString(new Date());
      const { data: enrollmentRows } = await supabase
        .from('edu_enrollments')
        .select('id')
        .eq('course_id', course.course_id)
        .eq('tenant_id', tenantId)
        .in('status', [...ROSTER_ENROLLMENT_STATUSES]);

      const enrollmentIds = (enrollmentRows || []).map((enrollment) => enrollment.id);
      const { data: todayStates } = enrollmentIds.length > 0
        ? await supabase
          .from('edu_attendance_daily_state')
          .select('status')
          .eq('tenant_id', tenantId)
          .eq('school_day', today)
          .in('enrollment_id', enrollmentIds)
        : { data: [] };

      const presentCount = (todayStates || []).filter((state) => state.status === 'present').length;
      const excusedCount = (todayStates || []).filter((state) => state.status === 'excused').length;
      const markedCount = todayStates?.length || 0;

      classrooms.push({
        id: course.course_id,
        code: course.course_code,
        name: course.course_name,
        grade: course.description || 'Khối Mầm (3 tuổi)',
        gradeKey,
        room: (course.metadata as Record<string, string> | null)?.room || 'Phòng 101 • Tầng 1',
        teacher: teacherNames,
        teacherPartyId: leadTeacherPartyId,
        students: currentStudents,
        maxStudents: maxCap,
        academicYear: '2025-2026',
        focus: 'Phát triển Kỹ năng & Vận động',
        status: course.status === 'active' ? 'active' : 'inactive',
        todayStatus: {
          present: presentCount,
          excused: excusedCount,
          unmarked: Math.max(0, currentStudents - markedCount),
          healthAlerts: 0,
        },
      });
    }

    return NextResponse.json({ success: true, classrooms });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const tenantId = body.tenantId || '00000000-0000-0000-0000-000000000001';
    const courseCode = body.courseCode;
    const courseName = body.courseName;
    const maxStudents = Number(body.maxStudents) || 25;
    const room = body.room || 'Phòng 101';
    const teacherPartyId = body.teacherPartyId;
    const academicYear = body.academicYear || '2025-2026';
    const description = body.description || 'Khối Mầm (3 tuổi)';

    if (!courseCode || !courseName) {
      return NextResponse.json({ success: false, error: 'courseCode and courseName are required' }, { status: 400 });
    }

    // 1. Check duplicate course_code per tenant
    const { data: existingCourse } = await supabase
      .from('courses')
      .select('course_id')
      .eq('tenant_id', tenantId)
      .eq('course_code', courseCode.trim().toUpperCase())
      .maybeSingle();

    if (existingCourse) {
      return NextResponse.json({
        success: false,
        error: `Mã lớp '${courseCode}' đã tồn tại trong trường`,
      }, { status: 409 });
    }

    // 2. Insert into courses table
    const { data: newCourse, error: createErr } = await supabase
      .from('courses')
      .insert({
        tenant_id: tenantId,
        course_code: courseCode.trim().toUpperCase(),
        course_name: courseName.trim(),
        description,
        credits: 3,
        duration_weeks: maxStudents,
        status: 'active',
        metadata: { room },
      })
      .select('*')
      .single();

    if (createErr || !newCourse) {
      return NextResponse.json({ success: false, error: createErr?.message || 'Failed to create course' }, { status: 500 });
    }

    // 3. Insert into edu_courses kernel table for capacity RPC
    await supabase.from('edu_courses').insert({
      id: newCourse.course_id,
      tenant_id: tenantId,
      course_code: newCourse.course_code,
      title: newCourse.course_name,
      status: 'active',
      max_students: maxStudents,
      current_enrollment: 0,
    });

    // 4. Assign Lead Teacher if provided
    let assignedTeacherMessage = '';
    if (teacherPartyId) {
      const teacherContract = new TeacherAssignmentContractImpl(supabase);
      try {
        await teacherContract.assignTeacher({
          tenantId,
          courseId: newCourse.course_id,
          teacherPartyId,
          role: 'lead_teacher',
          academicYear,
        });
        assignedTeacherMessage = 'và phân công GVN Chủ nhiệm thành công';
      } catch (assignErr) {
        const msg = assignErr instanceof Error ? assignErr.message : 'Teacher assignment failed';
        if (msg.includes('TEACHER_ASSIGNMENT_CONFLICT')) {
          return NextResponse.json({
            success: false,
            error: 'Xung đột: Giáo viên chủ nhiệm đã có lớp trong niên học này',
          }, { status: 409 });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Mở lớp thành công ${assignedTeacherMessage}`,
      course: newCourse,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
