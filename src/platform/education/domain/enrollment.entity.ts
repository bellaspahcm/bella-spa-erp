/**
 * Education OS — Enrollment Aggregate Root
 * 
 * Enrolls a Person (with Student role) into a Course.
 * 
 * @module platform/education/domain/enrollment.entity
 */

export type EnrollmentStatus = 'pending' | 'active' | 'completed' | 'cancelled';

export interface CreateEnrollmentProps {
  id?: string;
  tenantId: string;
  studentPartyId: string;
  courseId: string;
  status?: EnrollmentStatus;
  enrolledAt?: Date;
}

export class Enrollment {
  private readonly _id: string;
  private readonly _tenantId: string;
  private readonly _studentPartyId: string;
  private readonly _courseId: string;
  private _status: EnrollmentStatus;
  private readonly _enrolledAt: Date;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: CreateEnrollmentProps & { createdAt?: Date; updatedAt?: Date }) {
    if (!props.tenantId) throw new Error('Enrollment requires tenantId');
    if (!props.studentPartyId) throw new Error('Enrollment requires studentPartyId');
    if (!props.courseId) throw new Error('Enrollment requires courseId');

    this._id = props.id || crypto.randomUUID();
    this._tenantId = props.tenantId;
    this._studentPartyId = props.studentPartyId;
    this._courseId = props.courseId;
    this._status = props.status || 'pending';
    this._enrolledAt = props.enrolledAt || new Date();
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
  }

  public static create(props: CreateEnrollmentProps): Enrollment {
    return new Enrollment(props);
  }

  public static reconstitute(props: CreateEnrollmentProps & { createdAt: Date; updatedAt: Date }): Enrollment {
    return new Enrollment(props);
  }

  public activate(): void {
    if (this._status === 'cancelled' || this._status === 'completed') {
      throw new Error(`Cannot activate enrollment in state ${this._status}`);
    }
    this._status = 'active';
    this._updatedAt = new Date();
  }

  public complete(): void {
    if (this._status !== 'active') {
      throw new Error('Only active enrollments can be completed');
    }
    this._status = 'completed';
    this._updatedAt = new Date();
  }

  public cancel(): void {
    if (this._status === 'completed') {
      throw new Error('Completed enrollments cannot be cancelled');
    }
    this._status = 'cancelled';
    this._updatedAt = new Date();
  }

  // Getters
  public get id(): string { return this._id; }
  public get tenantId(): string { return this._tenantId; }
  public get studentPartyId(): string { return this._studentPartyId; }
  public get courseId(): string { return this._courseId; }
  public get status(): EnrollmentStatus { return this._status; }
  public get enrolledAt(): Date { return this._enrolledAt; }
  public get createdAt(): Date { return this._createdAt; }
  public get updatedAt(): Date { return this._updatedAt; }
}
