/**
 * Education OS — Assessment Aggregate Root
 * 
 * Represents a scored assessment for an enrollment (quiz, midterm, final, homework).
 * Canonical schema: edu_assessments (migration 20260813000020)
 * 
 * @module platform/education/domain/assessment.entity
 */

import crypto from 'crypto';

export type AssessmentScoreType = 'quiz' | 'midterm' | 'final' | 'homework';

export interface CreateAssessmentProps {
  id?: string;
  tenantId: string;
  enrollmentId: string;
  scoreType: AssessmentScoreType;
  grade: number;
  weight: number;
  occurredAt?: Date;
}

export class Assessment {
  private readonly _id: string;
  private readonly _tenantId: string;
  private readonly _enrollmentId: string;
  private readonly _scoreType: AssessmentScoreType;
  private readonly _grade: number;
  private readonly _weight: number;
  private readonly _occurredAt: Date;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: CreateAssessmentProps & { createdAt?: Date; updatedAt?: Date }) {
    if (!props.tenantId) throw new Error('Assessment requires tenantId');
    if (!props.enrollmentId) throw new Error('Assessment requires enrollmentId');
    
    const validScoreTypes: AssessmentScoreType[] = ['quiz', 'midterm', 'final', 'homework'];
    if (!validScoreTypes.includes(props.scoreType)) {
      throw new Error('Invalid score type');
    }

    if (props.grade < 0 || props.grade > 100) {
      throw new Error('Grade must be between 0 and 100');
    }

    if (props.weight < 0 || props.weight > 1) {
      throw new Error('Weight must be between 0 and 1');
    }

    this._id = props.id || crypto.randomUUID();
    this._tenantId = props.tenantId;
    this._enrollmentId = props.enrollmentId;
    this._scoreType = props.scoreType;
    this._grade = props.grade;
    this._weight = props.weight;
    this._occurredAt = props.occurredAt || new Date();
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
  }

  public static create(props: CreateAssessmentProps): Assessment {
    return new Assessment(props);
  }

  public static reconstitute(props: CreateAssessmentProps & { createdAt: Date; updatedAt: Date }): Assessment {
    return new Assessment(props);
  }

  // Getters
  public get id(): string { return this._id; }
  public get tenantId(): string { return this._tenantId; }
  public get enrollmentId(): string { return this._enrollmentId; }
  public get scoreType(): AssessmentScoreType { return this._scoreType; }
  public get grade(): number { return this._grade; }
  public get weight(): number { return this._weight; }
  public get occurredAt(): Date { return this._occurredAt; }
  public get createdAt(): Date { return this._createdAt; }
  public get updatedAt(): Date { return this._updatedAt; }
}
