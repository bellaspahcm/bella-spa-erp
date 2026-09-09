export interface IBulkCareException {
  studentId: string;
  errorCode: string;
  errorMessage: string;
  requiresAction: boolean;
}

export interface IBulkCareResult {
  requested: number;
  committed: number;
  blocked: number;
  successfulStudentIds: string[];
  exceptions: IBulkCareException[];
}

export interface IRecordBulkArrivalCommand {
  tenantId: string;
  classId: string;
  date: string; // YYYY-MM-DD
  arrivals: Array<{
    studentId: string;
    status: "PRESENT" | "ABSENT" | "LATE";
    arrivalTime?: Date;
    condition?: string;
  }>;
}

export interface IRecordBulkMealCommand {
  tenantId: string;
  classId: string;
  date: string;
  mealItemId: string;
  mealType: "BREAKFAST" | "LUNCH" | "AFTERNOON_SNACK";
  students: Array<{
    studentId: string;
    portion: "ALL" | "HALF" | "FEW" | "NONE";
    notes?: string;
  }>;
}

export interface IRecordBulkHygieneCommand {
  tenantId: string;
  classId: string;
  date: string;
  hygieneEntries: Array<{
    studentId: string;
    type: "DIAPER" | "TOILET" | "BOWEL_MOVEMENT";
    time?: Date;
    notes?: string;
  }>;
}

export interface IRecordBulkNapCommand {
  tenantId: string;
  classId: string;
  date: string;
  napEntries: Array<{
    studentId: string;
    sleepTime?: Date;
    wakeTime?: Date;
    quality: "DEEP" | "RESTLESS" | "REFUSED";
    notes?: string;
  }>;
}

export interface IParentDigest {
  digestId: string;
  tenantId: string;
  sessionId: string;
  studentId: string;
  date: string;
  status: "DRAFT" | "GENERATED" | "PUBLISHED";
  payload: Record<string, any>;
  publishedAt?: Date | null;
}

export interface IDailyCareContract {
  recordBulkArrival(command: IRecordBulkArrivalCommand): Promise<IBulkCareResult>;
  recordBulkMeals(command: IRecordBulkMealCommand): Promise<IBulkCareResult>;
  recordBulkHygiene(command: IRecordBulkHygieneCommand): Promise<IBulkCareResult>;
  recordBulkNap(command: IRecordBulkNapCommand): Promise<IBulkCareResult>;
  generateParentDigest(tenantId: string, classId: string, studentId: string, date: string): Promise<IParentDigest>;
  publishParentDigest(tenantId: string, digestId: string): Promise<IParentDigest>;
}
