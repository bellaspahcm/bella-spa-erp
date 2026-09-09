/**
 * Education OS — Teacher Classroom Assignment Aggregate Root
 * 
 * Represents the assignment of a teacher to a course/classroom with role,
 * academic year, effective dates, and lifecycle status.
 * 
 * Canonical Persistence Owner: teacher_assignments table
 * (NO courses.metadata shadow model).
 * 
 * @module platform/education/domain/teacher-assignment.entity
 */

export type TeacherRole = 'lead_teacher' | 'co_teacher' | 'assistant' | 'substitute';
export type TeacherAssignmentStatus = 'active' | 'completed' | 'terminated';

export interface CreateTeacherAssignmentProps {
  id?: string;
  tenantId: string;
  courseId: string;
  teacherPartyId: string;
  role: TeacherRole;
  academicYear: string;
  effectiveStartDate?: Date;
  effectiveEndDate?: Date | null;
  status?: TeacherAssignmentStatus;
}

export class TeacherClassroomAssignment {
  private readonly _id: string;
  private readonly _tenantId: string;
  private readonly _courseId: string;
  private readonly _teacherPartyId: string;
  private readonly _role: TeacherRole;
  private readonly _academicYear: string;
  private readonly _effectiveStartDate: Date;
  private _effectiveEndDate: Date | null;
  private _status: TeacherAssignmentStatus;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: CreateTeacherAssignmentProps & { createdAt?: Date; updatedAt?: Date }) {
    if (!props.tenantId) throw new Error('TeacherClassroomAssignment requires tenantId');
    if (!props.courseId) throw new Error('TeacherClassroomAssignment requires courseId');
    if (!props.teacherPartyId) throw new Error('TeacherClassroomAssignment requires teacherPartyId');
    if (!props.academicYear) throw new Error('TeacherClassroomAssignment requires academicYear');
    if (!props.role) throw new Error('TeacherClassroomAssignment requires role');

    if (props.effectiveEndDate && props.effectiveStartDate && props.effectiveEndDate < props.effectiveStartDate) {
      throw new Error('effectiveEndDate cannot be prior to effectiveStartDate');
    }

    this._id = props.id || crypto.randomUUID();
    this._tenantId = props.tenantId;
    this._courseId = props.courseId;
    this._teacherPartyId = props.teacherPartyId;
    this._role = props.role;
    this._academicYear = props.academicYear.trim();
    this._effectiveStartDate = props.effectiveStartDate || new Date();
    this._effectiveEndDate = props.effectiveEndDate || null;
    this._status = props.status || 'active';
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
  }

  public static create(props: CreateTeacherAssignmentProps): TeacherClassroomAssignment {
    return new TeacherClassroomAssignment(props);
  }

  public static reconstitute(props: CreateTeacherAssignmentProps & { createdAt: Date; updatedAt: Date }): TeacherClassroomAssignment {
    return new TeacherClassroomAssignment(props);
  }

  public terminate(endDate: Date = new Date()): void {
    if (this._status === 'terminated') {
      throw new Error('Assignment is already terminated');
    }
    this._status = 'terminated';
    this._effectiveEndDate = endDate;
    this._updatedAt = new Date();
  }

  public complete(endDate: Date = new Date()): void {
    if (this._status === 'completed') {
      throw new Error('Assignment is already completed');
    }
    this._status = 'completed';
    this._effectiveEndDate = endDate;
    this._updatedAt = new Date();
  }

  // Getters
  public get id(): string { return this._id; }
  public get tenantId(): string { return this._tenantId; }
  public get courseId(): string { return this._courseId; }
  public get teacherPartyId(): string { return this._teacherPartyId; }
  public get role(): TeacherRole { return this._role; }
  public get academicYear(): string { return this._academicYear; }
  public get effectiveStartDate(): Date { return this._effectiveStartDate; }
  public get effectiveEndDate(): Date | null { return this._effectiveEndDate; }
  public get status(): TeacherAssignmentStatus { return this._status; }
  public get createdAt(): Date { return this._createdAt; }
  public get updatedAt(): Date { return this._updatedAt; }
}
