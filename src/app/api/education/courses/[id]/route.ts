import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { TeacherAssignmentContractImpl } from '@/platform/education/contracts/teacher-assignment.contract.impl';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: courseId } = await params;
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || '00000000-0000-0000-0000-000000000001';

    const supabase = await createClient();

    // 1. Fetch Course details
    const { data: course, error: courseErr } = await supabase
      .from('courses')
      .select('*')
      .eq('course_id', courseId)
      .eq('tenant_id', tenantId)
      .single();

    if (courseErr || !course) {
      return NextResponse.json({ success: false, error: 'Lớp học không tồn tại' }, { status: 404 });
    }

    // 2. Fetch Assigned Teachers via Public Contract
    const teacherContract = new TeacherAssignmentContractImpl(supabase);
    const teacherAssignments = await teacherContract.getCourseTeachers(tenantId, courseId);

    const teacherList = [];
    if (teacherAssignments.length > 0) {
      const partyIds = teacherAssignments.map(t => t.teacherPartyId);
      const { data: parties } = await supabase
        .from('party_parties')
        .select('id, display_name')
        .in('id', partyIds);

      const partyMap = new Map((parties || []).map(p => [p.id, p.display_name]));

      for (const t of teacherAssignments) {
        teacherList.push({
          assignmentId: t.assignmentId,
          teacherPartyId: t.teacherPartyId,
          name: partyMap.get(t.teacherPartyId) || 'Giáo viên',
          role: t.role,
          roleDisplay: t.role === 'lead_teacher' ? 'Chủ nhiệm' : 'Phó bản / Trợ giảng',
          academicYear: t.academicYear,
          status: t.status,
        });
      }
    }

    // 3. Fetch Enrolled Students
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('enrollment_id, student_id, status, enrollment_date, students(student_code, person_id, academic_status, persons(first_name, last_name, gender, date_of_birth))')
      .eq('course_id', courseId)
      .eq('tenant_id', tenantId)
      .in('status', ['active', 'pending']);

    interface StudentJoinRow {
      student_code: string;
      person_id: string;
      academic_status: string;
      persons: {
        first_name: string;
        last_name: string;
        gender: string;
        date_of_birth: string;
      } | null;
    }

    interface EnrollmentJoinRow {
      enrollment_id: string;
      student_id: string;
      status: string;
      enrollment_date: string;
      students: StudentJoinRow | null;
    }

    const studentRoster = ((enrollments || []) as unknown as EnrollmentJoinRow[]).map(e => {
      const s = e.students;
      const p = s?.persons;
      const name = p ? `${p.last_name} ${p.first_name}`.trim() : 'Học sinh';
      return {
        enrollmentId: e.enrollment_id,
        studentId: e.student_id,
        studentCode: s?.student_code || 'STU-000',
        name,
        gender: p?.gender || 'N/A',
        status: e.status === 'active' ? 'Có mặt' : 'Chưa điểm danh',
        temp: '36.5°C',
      };
    });

    const room = (course.metadata as Record<string, string> | null)?.room || 'Phòng 101 • Tầng 1';

    return NextResponse.json({
      success: true,
      classroom: {
        id: course.course_id,
        code: course.course_code,
        name: course.course_name,
        grade: course.description || 'Khối Mầm (3 tuổi)',
        room,
        maxStudents: course.duration_weeks || 25,
        currentStudents: studentRoster.length,
        teachers: teacherList,
        teacherSummary: teacherList.map(t => `${t.name} (${t.roleDisplay})`).join(' & ') || 'Chưa phân công GVN',
        roster: studentRoster,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
