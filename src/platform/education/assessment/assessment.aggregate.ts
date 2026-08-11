/**
 * Assessment Aggregate
 * Education Platform - Assessment Capability
 * 
 * Business Rules:
 * 1. Assessment code must be unique within tenant
 * 2. Passing score cannot exceed max score
 * 3. Weight must be 0-100
 * 4. Can only grade published assessments
 * 5. Cannot modify published assessment scores
 */

import type {
  Assessment,
  AssessmentResult,
  AssessmentStatus,
  AssessmentType,
  CreateAssessmentDTO,
  CreateAssessmentResultDTO,
  GradeAssessmentResultDTO,
  UpdateAssessmentDTO,
} from './assessment.types';

export class AssessmentAggregate {
  private constructor(private data: Assessment) {}

  // ============================================================================
  // Factory Methods
  // ============================================================================

  static create(dto: CreateAssessmentDTO): AssessmentAggregate {
    // Validation
    if (!dto.assessmentCode?.trim()) {
      throw new Error('Assessment code is required');
    }
    if (!dto.title?.trim()) {
      throw new Error('Assessment title is required');
    }
    if (dto.maxScore <= 0) {
      throw new Error('Max score must be greater than 0');
    }
    if (dto.passingScore < 0 || dto.passingScore > dto.maxScore) {
      throw new Error('Passing score must be between 0 and max score');
    }
    if (dto.weight < 0 || dto.weight > 100) {
      throw new Error('Weight must be between 0 and 100');
    }

    const now = new Date();
    const assessment: Assessment = {
      assessmentId: crypto.randomUUID(),
      tenantId: dto.tenantId,
      courseId: dto.courseId,
      assessmentCode: dto.assessmentCode.trim(),
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      type: dto.type,
      maxScore: dto.maxScore,
      passingScore: dto.passingScore,
      weight: dto.weight,
      dueDate: dto.dueDate || null,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      createdBy: dto.createdBy,
    };

    return new AssessmentAggregate(assessment);
  }

  static fromPersistence(data: Assessment): AssessmentAggregate {
    return new AssessmentAggregate(data);
  }

  // ============================================================================
  // Getters
  // ============================================================================

  get assessmentId(): string {
    return this.data.assessmentId;
  }

  get tenantId(): string {
    return this.data.tenantId;
  }

  get courseId(): string {
    return this.data.courseId;
  }

  get assessmentCode(): string {
    return this.data.assessmentCode;
  }

  get title(): string {
    return this.data.title;
  }

  get status(): AssessmentStatus {
    return this.data.status;
  }

  get type(): AssessmentType {
    return this.data.type;
  }

  get maxScore(): number {
    return this.data.maxScore;
  }

  get passingScore(): number {
    return this.data.passingScore;
  }

  get weight(): number {
    return this.data.weight;
  }

  toDTO(): Assessment {
    return { ...this.data };
  }

  // ============================================================================
  // Business Logic - Assessment Status Transitions
  // ============================================================================

  publish(): void {
    if (this.data.status !== 'draft') {
      throw new Error('Can only publish draft assessments');
    }

    this.data.status = 'published';
    this.data.updatedAt = new Date();
  }

  archive(): void {
    if (this.data.status === 'draft') {
      throw new Error('Cannot archive draft assessment - delete it instead');
    }

    this.data.status = 'archived';
    this.data.updatedAt = new Date();
  }

  // ============================================================================
  // Business Logic - Assessment Updates
  // ============================================================================

  update(dto: UpdateAssessmentDTO): void {
    if (this.data.status === 'published' || this.data.status === 'graded') {
      throw new Error('Cannot modify published or graded assessments');
    }

    if (dto.title !== undefined) {
      if (!dto.title.trim()) {
        throw new Error('Title cannot be empty');
      }
      this.data.title = dto.title.trim();
    }

    if (dto.description !== undefined) {
      this.data.description = dto.description?.trim() || null;
    }

    if (dto.type !== undefined) {
      this.data.type = dto.type;
    }

    if (dto.maxScore !== undefined) {
      if (dto.maxScore <= 0) {
        throw new Error('Max score must be greater than 0');
      }
      this.data.maxScore = dto.maxScore;
      
      // Ensure passing score is still valid
      if (this.data.passingScore > dto.maxScore) {
        this.data.passingScore = dto.maxScore;
      }
    }

    if (dto.passingScore !== undefined) {
      if (dto.passingScore < 0 || dto.passingScore > this.data.maxScore) {
        throw new Error('Passing score must be between 0 and max score');
      }
      this.data.passingScore = dto.passingScore;
    }

    if (dto.weight !== undefined) {
      if (dto.weight < 0 || dto.weight > 100) {
        throw new Error('Weight must be between 0 and 100');
      }
      this.data.weight = dto.weight;
    }

    if (dto.dueDate !== undefined) {
      this.data.dueDate = dto.dueDate;
    }

    this.data.updatedAt = new Date();
  }

  // ============================================================================
  // Business Logic - Validation
  // ============================================================================

  canBeGraded(): boolean {
    return this.data.status === 'published' || this.data.status === 'graded';
  }

  isOverdue(): boolean {
    if (!this.data.dueDate) return false;
    return new Date() > this.data.dueDate;
  }
}

// ============================================================================
// Assessment Result Aggregate
// ============================================================================

export class AssessmentResultAggregate {
  private constructor(private data: AssessmentResult) {}

  static create(dto: CreateAssessmentResultDTO): AssessmentResultAggregate {
    const now = new Date();
    const result: AssessmentResult = {
      resultId: crypto.randomUUID(),
      tenantId: dto.tenantId,
      assessmentId: dto.assessmentId,
      studentId: dto.studentId,
      score: null,
      grade: null,
      submittedAt: null,
      gradedAt: null,
      feedback: null,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    return new AssessmentResultAggregate(result);
  }

  static fromPersistence(data: AssessmentResult): AssessmentResultAggregate {
    return new AssessmentResultAggregate(data);
  }

  get resultId(): string {
    return this.data.resultId;
  }

  get studentId(): string {
    return this.data.studentId;
  }

  get assessmentId(): string {
    return this.data.assessmentId;
  }

  get score(): number | null {
    return this.data.score;
  }

  get status(): 'pending' | 'submitted' | 'graded' {
    return this.data.status;
  }

  toDTO(): AssessmentResult {
    return { ...this.data };
  }

  submit(): void {
    if (this.data.status !== 'pending') {
      throw new Error('Can only submit pending results');
    }

    this.data.status = 'submitted';
    this.data.submittedAt = new Date();
    this.data.updatedAt = new Date();
  }

  grade(dto: GradeAssessmentResultDTO, maxScore: number): void {
    if (this.data.status === 'pending') {
      throw new Error('Cannot grade pending result - student must submit first');
    }

    if (dto.score < 0 || dto.score > maxScore) {
      throw new Error(`Score must be between 0 and ${maxScore}`);
    }

    this.data.score = dto.score;
    this.data.grade = dto.grade;
    this.data.feedback = dto.feedback || null;
    this.data.status = 'graded';
    this.data.gradedAt = new Date();
    this.data.updatedAt = new Date();
  }

  isPassing(passingScore: number): boolean {
    if (this.data.score === null) return false;
    return this.data.score >= passingScore;
  }
}
