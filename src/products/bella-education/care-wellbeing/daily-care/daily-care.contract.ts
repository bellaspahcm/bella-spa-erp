export type DailyCareAction = 'arrival' | 'meal' | 'hygiene' | 'nap';

export interface IBulkCareException {
  studentPartyId: string;
  errorCode: string;
  errorMessage: string;
  requiresAction: boolean;
}

export interface IBulkCareResult {
  requested: number;
  committed: number;
  blocked: number;
  successfulStudentPartyIds: string[];
  exceptions: IBulkCareException[];
}

export interface IRecordBulkArrivalCommand {
  tenantId: string;
  courseId: string;
  date: string;
  arrivals: Array<{
    studentPartyId: string;
    status: 'PRESENT' | 'ABSENT' | 'LATE';
    arrivalTime?: Date;
    condition?: string;
  }>;
}

export interface IRecordBulkMealCommand {
  tenantId: string;
  courseId: string;
  date: string;
  mealItemId?: string;
  mealType: 'BREAKFAST' | 'LUNCH' | 'AFTERNOON_SNACK';
  students: Array<{
    studentPartyId: string;
    portion: 'ALL' | 'HALF' | 'FEW' | 'NONE';
    notes?: string;
  }>;
}

export interface IRecordBulkHygieneCommand {
  tenantId: string;
  courseId: string;
  date: string;
  hygieneEntries: Array<{
    studentPartyId: string;
    type: 'DIAPER' | 'TOILET' | 'BOWEL_MOVEMENT';
    time?: Date;
    notes?: string;
  }>;
}

export interface IRecordBulkNapCommand {
  tenantId: string;
  courseId: string;
  date: string;
  napEntries: Array<{
    studentPartyId: string;
    sleepTime?: Date;
    wakeTime?: Date;
    quality: 'DEEP' | 'RESTLESS' | 'REFUSED';
    notes?: string;
  }>;
}

export interface DailyCareRecordDTO {
  id: string;
  tenantId: string;
  sessionId: string;
  studentPartyId: string;
  arrivalStatus: 'PRESENT' | 'ABSENT' | 'LATE' | null;
  arrivalTime: string | null;
  morningCondition: string | null;
  mealRecords: unknown[];
  hygieneRecords: unknown[];
  napRecords: Record<string, unknown>;
  healthChecks: Record<string, unknown>;
  updatedAt: string;
}

export interface DailyCareRosterItem {
  enrollmentId: string;
  studentPartyId: string;
  studentCode: string | null;
  name: string;
  gender: string | null;
  dob: string | null;
  care: DailyCareRecordDTO | null;
}

export interface IParentDigest {
  digestId: string;
  tenantId: string;
  sessionId: string;
  studentPartyId: string;
  date: string;
  status: 'DRAFT' | 'GENERATED' | 'PUBLISHED';
  payload: Record<string, unknown>;
  publishedAt?: Date | null;
}

export interface IDailyCareContract {
  getDailyCareRoster(tenantId: string, courseId: string, date: string): Promise<readonly DailyCareRosterItem[]>;
  recordBulkArrival(command: IRecordBulkArrivalCommand): Promise<IBulkCareResult>;
  recordBulkMeals(command: IRecordBulkMealCommand): Promise<IBulkCareResult>;
  recordBulkHygiene(command: IRecordBulkHygieneCommand): Promise<IBulkCareResult>;
  recordBulkNap(command: IRecordBulkNapCommand): Promise<IBulkCareResult>;
  generateParentDigest(tenantId: string, classId: string, studentPartyId: string, date: string): Promise<IParentDigest>;
  publishParentDigest(tenantId: string, digestId: string): Promise<IParentDigest>;
}
