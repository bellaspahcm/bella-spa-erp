import { getLocalDateString } from '@bella/shared';
import {
  CourseDailyAttendanceRosterItem,
  EducationAttendanceDTO,
  EducationAttendanceStatus,
  EducationDailyAttendanceStateDTO,
  GetCourseDailyAttendanceInput,
  IEducationAttendanceContract,
  RecordAttendanceInput,
  SetDailyAttendanceInput,
} from './attendance.contract';
import { createClient } from '@/lib/supabase-server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

const ROSTER_ENROLLMENT_STATUSES = ['active', 'pending'] as const;
type EducationAttendanceClient = SupabaseClient<Database>;

function assertAttendanceStatus(status: string): EducationAttendanceStatus {
  switch (status) {
    case 'present':
    case 'absent':
    case 'excused':
      return status;
    default:
      throw new Error(`INVALID_ATTENDANCE_STATUS: ${status}`);
  }
}

function resolveSchoolDay(rollCallTime: string): string {
  const date = new Date(rollCallTime);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`INVALID_ROLL_CALL_TIME: ${rollCallTime}`);
  }

  return getLocalDateString(date);
}

export class AttendanceContractImpl implements IEducationAttendanceContract {
  public constructor(private readonly client?: EducationAttendanceClient) {}

  private getClient(): EducationAttendanceClient {
    return this.client ?? createClient();
  }

  public async recordAttendance(input: RecordAttendanceInput): Promise<EducationAttendanceDTO> {
    const supabase = this.getClient();

    const { data: enrollment, error: enrollmentError } = await supabase
      .from('edu_enrollments')
      .select('id, tenant_id')
      .eq('id', input.enrollmentId)
      .eq('tenant_id', input.tenantId)
      .maybeSingle();

    if (enrollmentError) {
      throw new Error(`Failed to resolve enrollment ${input.enrollmentId}: ${enrollmentError.message}`);
    }

    if (!enrollment) {
      throw new Error(`Enrollment ${input.enrollmentId} not found`);
    }

    const rollCallTime = input.rollCallTime ?? new Date().toISOString();

    const { data: attendance, error: attendanceError } = await supabase
      .from('edu_attendance')
      .insert({
        tenant_id: input.tenantId,
        enrollment_id: enrollment.id,
        status: input.status,
        roll_call_time: rollCallTime,
      })
      .select('id, tenant_id, enrollment_id, status, roll_call_time')
      .single();

    if (attendanceError || !attendance) {
      throw new Error(`Failed to record attendance: ${attendanceError?.message ?? 'Unknown error'}`);
    }

    return {
      id: attendance.id,
      tenantId: attendance.tenant_id,
      enrollmentId: attendance.enrollment_id,
      status: assertAttendanceStatus(attendance.status),
      rollCallTime: attendance.roll_call_time,
    };
  }

  public async getAttendanceHistory(tenantId: string, enrollmentId: string): Promise<readonly EducationAttendanceDTO[]> {
    const supabase = this.getClient();

    const { data, error } = await supabase
      .from('edu_attendance')
      .select('id, tenant_id, enrollment_id, status, roll_call_time')
      .eq('tenant_id', tenantId)
      .eq('enrollment_id', enrollmentId)
      .order('roll_call_time', { ascending: true });

    if (error) {
      throw new Error(`Failed to load attendance history: ${error.message}`);
    }

    return (data ?? []).map((attendance) => ({
      id: attendance.id,
      tenantId: attendance.tenant_id,
      enrollmentId: attendance.enrollment_id,
      status: assertAttendanceStatus(attendance.status),
      rollCallTime: attendance.roll_call_time,
    }));
  }

  public async setDailyAttendance(input: SetDailyAttendanceInput): Promise<EducationDailyAttendanceStateDTO> {
    const supabase = this.getClient();
    const rollCallTime = input.rollCallTime ?? new Date().toISOString();
    const schoolDay = resolveSchoolDay(rollCallTime);

    const { data, error } = await supabase.rpc('edu_set_daily_attendance', {
      p_tenant_id: input.tenantId,
      p_enrollment_id: input.enrollmentId,
      p_status: input.status,
      p_roll_call_time: rollCallTime,
      p_school_day: schoolDay,
    });

    if (error) {
      throw new Error(`Failed to set daily attendance: ${error.message}`);
    }

    const state = data?.[0];
    if (!state) {
      throw new Error('Failed to set daily attendance: no state returned');
    }

    return {
      id: state.id,
      tenantId: state.tenant_id,
      enrollmentId: state.enrollment_id,
      schoolDay: state.school_day,
      status: assertAttendanceStatus(state.status),
      eventId: state.event_id,
      rollCallTime: state.roll_call_time,
      createdAt: state.created_at,
      updatedAt: state.updated_at,
    };
  }

  public async getCourseDailyAttendance(
    input: GetCourseDailyAttendanceInput,
  ): Promise<readonly CourseDailyAttendanceRosterItem[]> {
    const supabase = this.getClient();

    const { data: enrollments, error: enrollmentError } = await supabase
      .from('edu_enrollments')
      .select('id, tenant_id, course_id, student_party_id, status')
      .eq('tenant_id', input.tenantId)
      .eq('course_id', input.courseId)
      .in('status', [...ROSTER_ENROLLMENT_STATUSES]);

    if (enrollmentError) {
      throw new Error(`Failed to load canonical attendance roster enrollments: ${enrollmentError.message}`);
    }

    const enrollmentRows = enrollments ?? [];
    if (enrollmentRows.length === 0) {
      return [];
    }

    const enrollmentIds = enrollmentRows.map((enrollment) => enrollment.id);
    const studentPartyIds = [...new Set(enrollmentRows.map((enrollment) => enrollment.student_party_id))];

    const [
      { data: students, error: studentError },
      { data: parties, error: partyError },
      { data: dailyStates, error: stateError },
    ] = await Promise.all([
      supabase
        .from('students')
        .select('student_id, party_id, student_code, academic_status')
        .eq('tenant_id', input.tenantId)
        .in('party_id', studentPartyIds),
      supabase
        .from('party_parties')
        .select('id, display_name, gender, dob')
        .eq('tenant_id', input.tenantId)
        .in('id', studentPartyIds),
      supabase
        .from('edu_attendance_daily_state')
        .select('id, tenant_id, enrollment_id, school_day, status, created_at, updated_at')
        .eq('tenant_id', input.tenantId)
        .eq('school_day', input.schoolDay)
        .in('enrollment_id', enrollmentIds),
    ]);

    if (studentError) {
      throw new Error(`Failed to load canonical attendance roster students: ${studentError.message}`);
    }
    if (partyError) {
      throw new Error(`Failed to load canonical attendance roster parties: ${partyError.message}`);
    }
    if (stateError) {
      throw new Error(`Failed to load daily attendance state: ${stateError.message}`);
    }

    const studentByPartyId = new Map<string, NonNullable<typeof students>[number]>();
    for (const student of students ?? []) {
      if (student.party_id) {
        studentByPartyId.set(student.party_id, student);
      }
    }
    const partyById = new Map((parties ?? []).map((party) => [party.id, party]));
    const stateByEnrollmentId = new Map((dailyStates ?? []).map((state) => [state.enrollment_id, state]));

    return enrollmentRows.map((enrollment) => {
      const student = studentByPartyId.get(enrollment.student_party_id);
      const party = partyById.get(enrollment.student_party_id);
      if (!student || !party?.display_name) {
        throw new Error(`Canonical attendance roster join failed for student party ${enrollment.student_party_id}`);
      }

      const state = stateByEnrollmentId.get(enrollment.id);

      return {
        enrollmentId: enrollment.id,
        studentId: student.student_id,
        studentPartyId: enrollment.student_party_id,
        studentCode: student.student_code,
        name: party.display_name,
        gender: party.gender,
        dob: party.dob,
        enrollmentStatus: enrollment.status,
        attendance: state
          ? {
              id: state.id,
              tenantId: state.tenant_id,
              enrollmentId: state.enrollment_id,
              schoolDay: state.school_day,
              status: assertAttendanceStatus(state.status),
              createdAt: state.created_at,
              updatedAt: state.updated_at,
            }
          : null,
      };
    });
  }
}
