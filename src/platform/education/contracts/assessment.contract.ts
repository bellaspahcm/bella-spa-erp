/**
 * Education OS — Assessment public contract interface
 */
export interface EducationAssessmentDTO {
  readonly id: string;
  readonly tenantId: string;
  readonly enrollmentId: string;
  readonly scoreType: 'quiz' | 'midterm' | 'final' | 'homework';
  readonly grade: number; // e.g. 0.0 to 10.0 or 0 to 100
  readonly weight: number; // weight of this score in total grade
  readonly occurredAt: string;
}

export interface RecordScoreInput {
  readonly tenantId: string;
  readonly enrollmentId: string;
  readonly scoreType: 'quiz' | 'midterm' | 'final' | 'homework';
  readonly grade: number;
  readonly weight: number;
  readonly occurredAt?: string;
}

export interface IEducationAssessmentContract {
  recordScore(input: RecordScoreInput): Promise<EducationAssessmentDTO>;
  getScores(tenantId: string, enrollmentId: string): Promise<readonly EducationAssessmentDTO[]>;
  calculateGpa(tenantId: string, enrollmentId: string): Promise<number>;
}
