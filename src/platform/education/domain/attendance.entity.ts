/**
 * Education OS — Attendance Aggregate Root
 * 
 * Represents an attendance record for an enrollment.
 * Canonical schema: edu_attendance (migration 20260813000020)
 * 
 * @module platform/education/domain/attendance.entity
 */

import crypto from 'crypto';

export type AttendanceStatus = 'present' | 'absent' | 'excused';

export interface CreateAttendanceProps {
  id?: string;
  tenantId: string;
  enrollmentId: string;
  status: AttendanceStatus;
  rollCallTime?: Date;
}

export class Attendance {
  private readonly _id: string;
  private readonly _tenantId: string;
  private readonly _enrollmentId: string;
  private _status: AttendanceStatus;
  private readonly _rollCallTime: Date;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: CreateAttendanceProps & { createdAt?: Date; updatedAt?: Date }) {
    if (!props.tenantId) throw new Error('Attendance requires tenantId');
    if (!props.enrollmentId) throw new Error('Attendance requires enrollmentId');
    
    const validStatuses: AttendanceStatus[] = ['present', 'absent', 'excused'];
    if (!validStatuses.includes(props.status)) {
      throw new Error('Invalid attendance status');
    }

    this._id = props.id || crypto.randomUUID();
    this._tenantId = props.tenantId;
    this._enrollmentId = props.enrollmentId;
    this._status = props.status;
    this._rollCallTime = props.rollCallTime || new Date();
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
  }

  public static create(props: CreateAttendanceProps): Attendance {
    return new Attendance(props);
  }

  public static reconstitute(props: CreateAttendanceProps & { createdAt: Date; updatedAt: Date }): Attendance {
    return new Attendance(props);
  }

  public updateStatus(status: AttendanceStatus): void {
    const validStatuses: AttendanceStatus[] = ['present', 'absent', 'excused'];
    if (!validStatuses.includes(status)) {
      throw new Error('Invalid attendance status');
    }
    this._status = status;
    this._updatedAt = new Date();
  }

  // Getters
  public get id(): string { return this._id; }
  public get tenantId(): string { return this._tenantId; }
  public get enrollmentId(): string { return this._enrollmentId; }
  public get status(): AttendanceStatus { return this._status; }
  public get rollCallTime(): Date { return this._rollCallTime; }
  public get createdAt(): Date { return this._createdAt; }
  public get updatedAt(): Date { return this._updatedAt; }
}
