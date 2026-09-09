import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { TeacherAssignmentContractImpl } from '@/platform/education/contracts/teacher-assignment.contract.impl';
import { TeacherRole } from '@/platform/education/domain/teacher-assignment.entity';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: courseId } = await params;
    const supabase = await createClient();
    const body = await request.json();

    const tenantId = body.tenantId || '00000000-0000-0000-0000-000000000001';
    const teacherPartyId = body.teacherPartyId;
    const role: TeacherRole = body.role || 'lead_teacher';
    const academicYear = body.academicYear || '2025-2026';

    if (!teacherPartyId) {
      return NextResponse.json({ success: false, error: 'teacherPartyId is required' }, { status: 400 });
    }

    const teacherContract = new TeacherAssignmentContractImpl(supabase);

    // 1. Assign Teacher via Public Contract
    try {
      const assignment = await teacherContract.assignTeacher({
        tenantId,
        courseId,
        teacherPartyId,
        role,
        academicYear,
      });

      return NextResponse.json({
        success: true,
        message: `Phân công ${role === 'lead_teacher' ? 'GV Chủ nhiệm' : 'GV Phó'} thành công`,
        assignment,
      });
    } catch (assignErr) {
      const msg = assignErr instanceof Error ? assignErr.message : 'Teacher assignment failed';
      if (msg.includes('TEACHER_ASSIGNMENT_CONFLICT')) {
        return NextResponse.json({
          success: false,
          error: 'Xung đột: Lớp học đã có Giáo viên chủ nhiệm hoạt động trong niên học này. Vui lòng chấm dứt phân công cũ trước.',
        }, { status: 409 });
      }
      return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: courseId } = await params;
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const tenantId = searchParams.get('tenantId') || '00000000-0000-0000-0000-000000000001';
    const assignmentId = searchParams.get('assignmentId');

    if (!assignmentId) {
      return NextResponse.json({ success: false, error: 'assignmentId is required' }, { status: 400 });
    }

    const teacherContract = new TeacherAssignmentContractImpl(supabase);
    const terminated = await teacherContract.terminateAssignment({
      tenantId,
      assignmentId,
    });

    return NextResponse.json({
      success: true,
      message: 'Đã chấm dứt phân công giáo viên thành công',
      terminated,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
