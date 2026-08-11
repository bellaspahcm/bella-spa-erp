/**
 * Assessment Service
 * Education Platform - Assessment Capability
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { AssessmentRepository } from './assessment.repository';
import { AssessmentAggregate, AssessmentResultAggregate } from './assessment.aggregate';
import type {
  Assessment,
  AssessmentResult,
  CreateAssessmentDTO,
  CreateAssessmentResultDTO,
  UpdateAssessmentDTO,
  GradeAssessmentResultDTO,
  AssessmentFilters,
  AssessmentResultFilters,
} from './assessment.types';

export class AssessmentService {
  private repository: AssessmentRepository;

  constructor(supabase: SupabaseClient<Database>) {
    this.repository = new AssessmentRepository(supabase);
  }

  // ============================================================================
  // Assessment Operations
  // ============================================================================

  async createAssessment(dto: CreateAssessmentDTO): Promise<Assessment> {
    // Check for duplicate assessment code
    const existing = await this.repository.findByCode(dto.assessmentCode, dto.tenantId);
    if (existing) {
      throw new Error(`Assessment code ${dto.assessmentCode} already exists in this tenant`);
    }

    const aggregate = AssessmentAggregate.create(dto);
    return await this.repository.create(aggregate.toDTO());
  }

  async getAssessment(assessmentId: string, tenantId: string): Promise<Assessment | null> {
    return await this.repository.findById(assessmentId, tenantId);
  }

  async getAssessmentsByCoruse(courseId: string, tenantId: string): Promise<Assessment[]> {
    return await this.repository.findByCourse(courseId, tenantId);
  }

  async getAssessments(filters: AssessmentFilters): Promise<Assessment[]> {
    return await this.repository.findAll(filters);
  }

  async updateAssessment(
    assessmentId: string,
    tenantId: string,
    dto: UpdateAssessmentDTO
  ): Promise<Assessment> {
    const assessment = await this.repository.findById(assessmentId, tenantId);
    if (!assessment) {
      throw new Error('Assessment not found');
    }

    const aggregate = AssessmentAggregate.fromPersistence(assessment);
    aggregate.update(dto);

    return await this.repository.update(assessmentId, tenantId, aggregate.toDTO());
  }

  async publishAssessment(assessmentId: string, tenantId: string): Promise<Assessment> {
    const assessment = await this.repository.findById(assessmentId, tenantId);
    if (!assessment) {
      throw new Error('Assessment not found');
    }

    const aggregate = AssessmentAggregate.fromPersistence(assessment);
    aggregate.publish();

    return await this.repository.update(assessmentId, tenantId, aggregate.toDTO());
  }

  async archiveAssessment(assessmentId: string, tenantId: string): Promise<Assessment> {
    const assessment = await this.repository.findById(assessmentId, tenantId);
    if (!assessment) {
      throw new Error('Assessment not found');
    }

    const aggregate = AssessmentAggregate.fromPersistence(assessment);
    aggregate.archive();

    return await this.repository.update(assessmentId, tenantId, aggregate.toDTO());
  }

  async deleteAssessment(assessmentId: string, tenantId: string): Promise<void> {
    const assessment = await this.repository.findById(assessmentId, tenantId);
    if (!assessment) {
      throw new Error('Assessment not found');
    }

    if (assessment.status !== 'draft') {
      throw new Error('Can only delete draft assessments');
    }

    await this.repository.delete(assessmentId, tenantId);
  }

  // ============================================================================
  // Assessment Result Operations
  // ============================================================================

  async createAssessmentResult(dto: CreateAssessmentResultDTO): Promise<AssessmentResult> {
    // Verify assessment exists and is published
    const assessment = await this.repository.findById(dto.assessmentId, dto.tenantId);
    if (!assessment) {
      throw new Error('Assessment not found');
    }

    const assessmentAggregate = AssessmentAggregate.fromPersistence(assessment);
    if (!assessmentAggregate.canBeGraded()) {
      throw new Error('Assessment must be published before creating results');
    }

    const aggregate = AssessmentResultAggregate.create(dto);
    return await this.repository.createResult(aggregate.toDTO());
  }

  async getAssessmentResult(resultId: string, tenantId: string): Promise<AssessmentResult | null> {
    return await this.repository.findResultById(resultId, tenantId);
  }

  async getResultsByStudent(studentId: string, tenantId: string): Promise<AssessmentResult[]> {
    return await this.repository.findResultsByStudent(studentId, tenantId);
  }

  async getResultsByAssessment(assessmentId: string, tenantId: string): Promise<AssessmentResult[]> {
    return await this.repository.findResultsByAssessment(assessmentId, tenantId);
  }

  async getResults(filters: AssessmentResultFilters): Promise<AssessmentResult[]> {
    return await this.repository.findResults(filters);
  }

  async submitAssessmentResult(resultId: string, tenantId: string): Promise<AssessmentResult> {
    const result = await this.repository.findResultById(resultId, tenantId);
    if (!result) {
      throw new Error('Assessment result not found');
    }

    const aggregate = AssessmentResultAggregate.fromPersistence(result);
    aggregate.submit();

    return await this.repository.updateResult(resultId, tenantId, aggregate.toDTO());
  }

  async gradeAssessmentResult(
    resultId: string,
    tenantId: string,
    dto: GradeAssessmentResultDTO
  ): Promise<AssessmentResult> {
    const result = await this.repository.findResultById(resultId, tenantId);
    if (!result) {
      throw new Error('Assessment result not found');
    }

    // Get assessment to validate score against max score
    const assessment = await this.repository.findById(result.assessmentId, tenantId);
    if (!assessment) {
      throw new Error('Assessment not found');
    }

    const aggregate = AssessmentResultAggregate.fromPersistence(result);
    aggregate.grade(dto, assessment.maxScore);

    return await this.repository.updateResult(resultId, tenantId, aggregate.toDTO());
  }

  // ============================================================================
  // Analytics
  // ============================================================================

  async getAssessmentStatistics(assessmentId: string, tenantId: string): Promise<{
    totalStudents: number;
    submitted: number;
    graded: number;
    averageScore: number | null;
    passingRate: number | null;
  }> {
    const results = await this.repository.findResultsByAssessment(assessmentId, tenantId);
    const assessment = await this.repository.findById(assessmentId, tenantId);
    
    if (!assessment) {
      throw new Error('Assessment not found');
    }

    const submitted = results.filter(r => r.status === 'submitted' || r.status === 'graded').length;
    const graded = results.filter(r => r.status === 'graded').length;
    
    const gradedResults = results.filter(r => r.status === 'graded' && r.score !== null);
    const averageScore = gradedResults.length > 0
      ? gradedResults.reduce((sum, r) => sum + (r.score || 0), 0) / gradedResults.length
      : null;

    const passedCount = gradedResults.filter(r => (r.score || 0) >= assessment.passingScore).length;
    const passingRate = gradedResults.length > 0
      ? (passedCount / gradedResults.length) * 100
      : null;

    return {
      totalStudents: results.length,
      submitted,
      graded,
      averageScore,
      passingRate,
    };
  }
}
