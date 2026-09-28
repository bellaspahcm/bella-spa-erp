import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizePreschoolGuardianPhone } from './preschool-guardian-authorization.service';
import type { PreschoolHandoverDTO } from './preschool-safe-pickup-handover.service';
import { PreschoolSafePickupHandoverService } from './preschool-safe-pickup-handover.service';

const GUARDIAN_PHONE_IDENTIFIER_TYPE = 'preschool_guardian_phone';
const GUARDIAN_RELATIONSHIP_TYPE = 'guardian_of';
const ACTIVE_ENROLLMENT_STATUSES = ['active', 'pending'] as const;

type BellaEducationClient = SupabaseClient;

interface ParentUserContext {
  readonly tenantId: string;
  readonly userId: string;
  readonly phone: string | null;
}

interface GuardianIdentifierRow {
  readonly party_id: string;
}

interface PartyRelationshipRow {
  readonly target_party_id: string;
  readonly active_from: string | null;
  readonly active_to: string | null;
}

interface StudentPartyRow {
  readonly id: string;
  readonly display_name: string | null;
  readonly gender: string | null;
  readonly dob: string | null;
}

interface StudentRow {
  readonly party_id: string | null;
  readonly student_code: string | null;
}

interface EnrollmentRow {
  readonly id: string;
  readonly course_id: string;
  readonly student_party_id: string;
  readonly status: string;
}

interface CourseRow {
  readonly id: string;
  readonly title: string | null;
}

interface AttendanceRow {
  readonly enrollment_id: string;
  readonly school_day: string;
  readonly status: string;
  readonly updated_at: string;
}

interface CareSessionRow {
  readonly id: string;
  readonly class_id: string;
}

interface CareRecordRow {
  readonly session_id: string;
  readonly student_party_id: string | null;
  readonly arrival_status: string | null;
  readonly arrival_time: string | null;
  readonly morning_condition: string | null;
  readonly meal_records: unknown;
  readonly hygiene_records: unknown;
  readonly nap_records: unknown;
  readonly health_checks: unknown;
  readonly updated_at: string;
}

export interface ParentDailyAttendanceDTO {
  readonly status: string | null;
  readonly updatedAt: string | null;
}

export interface ParentDailyCareDTO {
  readonly arrivalStatus: string | null;
  readonly arrivalTime: string | null;
  readonly morningCondition: string | null;
  readonly mealRecords: readonly unknown[];
  readonly hygieneRecords: readonly unknown[];
  readonly napRecords: Record<string, unknown>;
  readonly healthChecks: Record<string, unknown>;
  readonly updatedAt: string | null;
}

export interface ParentDailyHandoverDTO {
  readonly handedOver: boolean;
  readonly handoverEventId: string | null;
  readonly guardianPartyId: string | null;
  readonly pickupAuthorizationId: string | null;
  readonly handedOverAt: string | null;
  readonly handedOverBy: string | null;
}

export interface ParentDailyChildDTO {
  readonly studentPartyId: string;
  readonly studentCode: string | null;
  readonly childName: string;
  readonly courseId: string | null;
  readonly courseTitle: string | null;
  readonly enrollmentId: string | null;
  readonly attendance: ParentDailyAttendanceDTO;
  readonly care: ParentDailyCareDTO | null;
  readonly handover: ParentDailyHandoverDTO;
}

export interface ParentDailyExperienceDTO {
  readonly tenantId: string;
  readonly guardianPartyId: string;
  readonly schoolDay: string;
  readonly children: readonly ParentDailyChildDTO[];
}

function asArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function isRelationshipActive(row: PartyRelationshipRow, schoolDay: string): boolean {
  const startsBeforeOrOnDay = !row.active_from || row.active_from <= schoolDay;
  const endsAfterOrOnDay = !row.active_to || row.active_to >= schoolDay;
  return startsBeforeOrOnDay && endsAfterOrOnDay;
}

export class PreschoolParentDailyExperienceService {
  constructor(private readonly supabase: BellaEducationClient) {}

  async getDailyExperience(input: {
    readonly user: ParentUserContext;
    readonly schoolDay: string;
    readonly requestedStudentPartyId?: string;
  }): Promise<ParentDailyExperienceDTO> {
    const guardianPartyId = await this.resolveGuardianPartyFromUser(input.user);
    const allowedStudentPartyIds = await this.getGuardianStudentPartyIds(
      input.user.tenantId,
      guardianPartyId,
      input.schoolDay,
    );

    if (input.requestedStudentPartyId && !allowedStudentPartyIds.includes(input.requestedStudentPartyId)) {
      throw new Error('PARENT_DAILY_STUDENT_ACCESS_DENIED');
    }

    const selectedStudentPartyIds = input.requestedStudentPartyId
      ? [input.requestedStudentPartyId]
      : allowedStudentPartyIds;

    const children = await this.loadChildrenDailyTruth({
      tenantId: input.user.tenantId,
      schoolDay: input.schoolDay,
      studentPartyIds: selectedStudentPartyIds,
    });

    return {
      tenantId: input.user.tenantId,
      guardianPartyId,
      schoolDay: input.schoolDay,
      children,
    };
  }

  async assertGuardianCanViewStudent(input: {
    readonly user: ParentUserContext;
    readonly studentPartyId: string;
    readonly schoolDay: string;
  }): Promise<string> {
    const guardianPartyId = await this.resolveGuardianPartyFromUser(input.user);
    const allowedStudentPartyIds = await this.getGuardianStudentPartyIds(
      input.user.tenantId,
      guardianPartyId,
      input.schoolDay,
    );

    if (!allowedStudentPartyIds.includes(input.studentPartyId)) {
      throw new Error('PARENT_DAILY_STUDENT_ACCESS_DENIED');
    }

    return guardianPartyId;
  }

  private async resolveGuardianPartyFromUser(user: ParentUserContext): Promise<string> {
    if (!user.phone) {
      throw new Error('PARENT_GUARDIAN_PHONE_REQUIRED');
    }

    const normalizedPhone = normalizePreschoolGuardianPhone(user.phone);
    const { data, error } = await this.supabase
      .from('party_identifiers')
      .select('party_id')
      .eq('tenant_id', user.tenantId)
      .eq('identifier_type', GUARDIAN_PHONE_IDENTIFIER_TYPE)
      .eq('identifier_value', normalizedPhone)
      .maybeSingle();

    if (error) {
      throw new Error(`PARENT_GUARDIAN_PARTY_LOOKUP_FAILED: ${error.message}`);
    }
    if (!data) {
      throw new Error('PARENT_GUARDIAN_PARTY_NOT_FOUND');
    }

    return (data as GuardianIdentifierRow).party_id;
  }

  private async getGuardianStudentPartyIds(
    tenantId: string,
    guardianPartyId: string,
    schoolDay: string,
  ): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('party_relationships')
      .select('target_party_id, active_from, active_to')
      .eq('tenant_id', tenantId)
      .eq('source_party_id', guardianPartyId)
      .eq('relationship_type', GUARDIAN_RELATIONSHIP_TYPE);

    if (error) {
      throw new Error(`PARENT_GUARDIAN_RELATIONSHIP_LOOKUP_FAILED: ${error.message}`);
    }

    return ((data ?? []) as PartyRelationshipRow[])
      .filter((row) => isRelationshipActive(row, schoolDay))
      .map((row) => row.target_party_id);
  }

  private async loadChildrenDailyTruth(input: {
    readonly tenantId: string;
    readonly schoolDay: string;
    readonly studentPartyIds: readonly string[];
  }): Promise<ParentDailyChildDTO[]> {
    if (input.studentPartyIds.length === 0) return [];

    const [
      { data: parties, error: partyError },
      { data: students, error: studentError },
      { data: enrollments, error: enrollmentError },
    ] = await Promise.all([
      this.supabase
        .from('party_parties')
        .select('id, display_name, gender, dob')
        .eq('tenant_id', input.tenantId)
        .in('id', input.studentPartyIds),
      this.supabase
        .from('students')
        .select('party_id, student_code')
        .eq('tenant_id', input.tenantId)
        .in('party_id', input.studentPartyIds),
      this.supabase
        .from('edu_enrollments')
        .select('id, course_id, student_party_id, status')
        .eq('tenant_id', input.tenantId)
        .in('student_party_id', input.studentPartyIds)
        .in('status', [...ACTIVE_ENROLLMENT_STATUSES]),
    ]);

    if (partyError) throw new Error(`PARENT_DAILY_PARTY_LOOKUP_FAILED: ${partyError.message}`);
    if (studentError) throw new Error(`PARENT_DAILY_STUDENT_LOOKUP_FAILED: ${studentError.message}`);
    if (enrollmentError) throw new Error(`PARENT_DAILY_ENROLLMENT_LOOKUP_FAILED: ${enrollmentError.message}`);

    const enrollmentRows = (enrollments ?? []) as EnrollmentRow[];
    const enrollmentByStudentPartyId = new Map<string, EnrollmentRow>();
    for (const enrollment of enrollmentRows) {
      if (!enrollmentByStudentPartyId.has(enrollment.student_party_id)) {
        enrollmentByStudentPartyId.set(enrollment.student_party_id, enrollment);
      }
    }

    const courseIds = [...new Set(enrollmentRows.map((row) => row.course_id))];
    const enrollmentIds = enrollmentRows.map((row) => row.id);

    const [
      coursesById,
      attendanceByEnrollmentId,
      careByStudentPartyId,
      handoversByStudentPartyId,
    ] = await Promise.all([
      this.loadCourses(input.tenantId, courseIds),
      this.loadAttendance(input.tenantId, input.schoolDay, enrollmentIds),
      this.loadCareRecords(input.tenantId, input.schoolDay, enrollmentRows),
      new PreschoolSafePickupHandoverService(this.supabase).getLatestHandovers(
        input.tenantId,
        input.studentPartyIds,
      ),
    ]);

    const partiesById = new Map(((parties ?? []) as StudentPartyRow[]).map((party) => [party.id, party]));
    const studentsByPartyId = new Map(
      ((students ?? []) as StudentRow[])
        .filter((student) => student.party_id)
        .map((student) => [student.party_id as string, student]),
    );

    return input.studentPartyIds.map((studentPartyId) => {
      const party = partiesById.get(studentPartyId);
      const enrollment = enrollmentByStudentPartyId.get(studentPartyId) ?? null;
      const attendance = enrollment ? attendanceByEnrollmentId.get(enrollment.id) ?? null : null;
      const handover = handoversByStudentPartyId.get(studentPartyId) ?? null;

      if (!party?.display_name) {
        throw new Error(`PARENT_DAILY_STUDENT_PARTY_NOT_FOUND: ${studentPartyId}`);
      }

      return {
        studentPartyId,
        studentCode: studentsByPartyId.get(studentPartyId)?.student_code ?? null,
        childName: party.display_name,
        courseId: enrollment?.course_id ?? null,
        courseTitle: enrollment ? coursesById.get(enrollment.course_id)?.title ?? null : null,
        enrollmentId: enrollment?.id ?? null,
        attendance: {
          status: attendance?.status ?? null,
          updatedAt: attendance?.updated_at ?? null,
        },
        care: careByStudentPartyId.get(studentPartyId) ?? null,
        handover: this.mapHandover(handover),
      };
    });
  }

  private async loadCourses(tenantId: string, courseIds: readonly string[]): Promise<Map<string, CourseRow>> {
    if (courseIds.length === 0) return new Map();

    const { data, error } = await this.supabase
      .from('edu_courses')
      .select('id, title')
      .eq('tenant_id', tenantId)
      .in('id', courseIds);

    if (error) {
      throw new Error(`PARENT_DAILY_COURSE_LOOKUP_FAILED: ${error.message}`);
    }

    return new Map(((data ?? []) as CourseRow[]).map((course) => [course.id, course]));
  }

  private async loadAttendance(
    tenantId: string,
    schoolDay: string,
    enrollmentIds: readonly string[],
  ): Promise<Map<string, AttendanceRow>> {
    if (enrollmentIds.length === 0) return new Map();

    const { data, error } = await this.supabase
      .from('edu_attendance_daily_state')
      .select('enrollment_id, school_day, status, updated_at')
      .eq('tenant_id', tenantId)
      .eq('school_day', schoolDay)
      .in('enrollment_id', enrollmentIds);

    if (error) {
      throw new Error(`PARENT_DAILY_ATTENDANCE_LOOKUP_FAILED: ${error.message}`);
    }

    return new Map(((data ?? []) as AttendanceRow[]).map((attendance) => [attendance.enrollment_id, attendance]));
  }

  private async loadCareRecords(
    tenantId: string,
    schoolDay: string,
    enrollments: readonly EnrollmentRow[],
  ): Promise<Map<string, ParentDailyCareDTO>> {
    if (enrollments.length === 0) return new Map();

    const courseIds = [...new Set(enrollments.map((row) => row.course_id))];
    const studentPartyIds = [...new Set(enrollments.map((row) => row.student_party_id))];
    const { data: sessions, error: sessionError } = await this.supabase
      .from('edu_daily_care_sessions')
      .select('id, class_id')
      .eq('tenant_id', tenantId)
      .eq('date', schoolDay)
      .in('class_id', courseIds);

    if (sessionError) {
      throw new Error(`PARENT_DAILY_CARE_SESSION_LOOKUP_FAILED: ${sessionError.message}`);
    }

    const sessionRows = (sessions ?? []) as CareSessionRow[];
    if (sessionRows.length === 0) return new Map();

    const { data: records, error: recordError } = await this.supabase
      .from('edu_daily_care_records')
      .select('session_id, student_party_id, arrival_status, arrival_time, morning_condition, meal_records, hygiene_records, nap_records, health_checks, updated_at')
      .eq('tenant_id', tenantId)
      .in('session_id', sessionRows.map((session) => session.id))
      .in('student_party_id', studentPartyIds);

    if (recordError) {
      throw new Error(`PARENT_DAILY_CARE_RECORD_LOOKUP_FAILED: ${recordError.message}`);
    }

    const careByStudentPartyId = new Map<string, ParentDailyCareDTO>();
    for (const record of (records ?? []) as CareRecordRow[]) {
      if (!record.student_party_id) continue;

      careByStudentPartyId.set(record.student_party_id, {
        arrivalStatus: record.arrival_status,
        arrivalTime: record.arrival_time,
        morningCondition: record.morning_condition,
        mealRecords: asArray(record.meal_records),
        hygieneRecords: asArray(record.hygiene_records),
        napRecords: asObject(record.nap_records),
        healthChecks: asObject(record.health_checks),
        updatedAt: record.updated_at,
      });
    }

    return careByStudentPartyId;
  }

  private mapHandover(handover: PreschoolHandoverDTO | null): ParentDailyHandoverDTO {
    if (!handover) {
      return {
        handedOver: false,
        handoverEventId: null,
        guardianPartyId: null,
        pickupAuthorizationId: null,
        handedOverAt: null,
        handedOverBy: null,
      };
    }

    return {
      handedOver: true,
      handoverEventId: handover.id,
      guardianPartyId: handover.guardianPartyId,
      pickupAuthorizationId: handover.pickupAuthorizationId,
      handedOverAt: handover.handedOverAt,
      handedOverBy: handover.handedOverBy,
    };
  }
}
