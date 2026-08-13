/**
 * Education OS — Course Aggregate Root
 * 
 * Represents an educational course or training program.
 * 
 * @module platform/education/domain/course.entity
 */

export type CourseStatus = 'draft' | 'active' | 'archived';

export interface CreateCourseProps {
  id?: string;
  tenantId: string;
  courseCode: string;
  title: string;
  status?: CourseStatus;
  maxStudents?: number | null;
  currentEnrollment?: number;
  prerequisiteCourseCodes?: string[];
}

export class Course {
  private readonly _id: string;
  private readonly _tenantId: string;
  private readonly _courseCode: string;
  private _title: string;
  private _status: CourseStatus;
  private _maxStudents: number | null;
  private _currentEnrollment: number;
  private _prerequisiteCourseCodes: string[];
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: CreateCourseProps & { createdAt?: Date; updatedAt?: Date }) {
    if (!props.tenantId) throw new Error('Course requires tenantId');
    if (!props.courseCode) throw new Error('Course requires courseCode');
    if (!props.title) throw new Error('Course requires title');

    this._id = props.id || crypto.randomUUID();
    this._tenantId = props.tenantId;
    this._courseCode = props.courseCode.trim().toUpperCase();
    this._title = props.title.trim();
    this._status = props.status || 'active';
    this._maxStudents = props.maxStudents !== undefined ? props.maxStudents : null;
    this._currentEnrollment = props.currentEnrollment || 0;
    this._prerequisiteCourseCodes = props.prerequisiteCourseCodes || [];
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
  }

  public static create(props: CreateCourseProps): Course {
    return new Course(props);
  }

  public static reconstitute(props: CreateCourseProps & { createdAt: Date; updatedAt: Date }): Course {
    return new Course(props);
  }

  public archive(): void {
    if (this._status === 'archived') {
      throw new Error('Course is already archived');
    }
    this._status = 'archived';
    this._updatedAt = new Date();
  }

  // Getters
  public get id(): string { return this._id; }
  public get tenantId(): string { return this._tenantId; }
  public get courseCode(): string { return this._courseCode; }
  public get title(): string { return this._title; }
  public get status(): CourseStatus { return this._status; }
  public get maxStudents(): number | null { return this._maxStudents; }
  public get currentEnrollment(): number { return this._currentEnrollment; }
  public get prerequisiteCourseCodes(): string[] { return this._prerequisiteCourseCodes; }
  public get createdAt(): Date { return this._createdAt; }
  public get updatedAt(): Date { return this._updatedAt; }
}
