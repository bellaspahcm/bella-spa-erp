/**
 * Assessment Repository
 * Education Platform - Assessment Capability
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type {
  Assessment,
  AssessmentResult,
  AssessmentFilters,
  AssessmentResultFilters,
  AssessmentsTableInsert,
  AssessmentsTableUpdate,
  AssessmentsTableRow,
} from './assessment.types';

type AssessmentResultsTableRow = Database['public']['Tables']['assessment_results']['Row'];
type AssessmentResultsTableInsert = Database['public']['Tables']['assessment_results']['Insert'];
type AssessmentResultsTableUpdate = Database['public']['Tables']['assessment_results']['Update'];

export class AssessmentRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  // ============================================================================
  // Assessment CRUD
  // ============================================================================

  async create(assessment: Assessment): Promise<Assessment> {
    const payload: AssessmentsTableInsert = {
      assessment_id: assessment.assessmentId,
      tenant_id: assessment.tenantId,
      course_id: assessment.courseId,
      assessment_code: assessment.assessmentCode,
      title: assessment.title,
      description: assessment.description,
      type: assessment.type,
      max_score: assessment.maxScore,
      passing_score: assessment.passingScore,
      weight: assessment.weight,
      due_date: assessment.dueDate?.toISOString(),
      status: assessment.status,
      created_at: assessment.createdAt.toISOString(),
      updated_at: assessment.updatedAt.toISOString(),
      created_by: assessment.createdBy,
    };

    const { data, error } = await this.supabase
      .from('assessments')
      .insert(payload)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error(`Assessment code ${assessment.assessmentCode} already exists in this tenant`);
      }
      throw new Error(`Failed to create assessment: ${error.message}`);
    }

    return this.mapRowToDomain(data as AssessmentsTableRow);
  }

  async findById(assessmentId: string, tenantId: string): Promise<Assessment | null> {
    const { data, error } = await this.supabase
      .from('assessments')
      .select('*')
      .eq('assessment_id', assessmentId)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to find assessment: ${error.message}`);
    }

    return this.mapRowToDomain(data as AssessmentsTableRow);
  }

  async findByCode(assessmentCode: string, tenantId: string): Promise<Assessment | null> {
    const { data, error } = await this.supabase
      .from('assessments')
      .select('*')
      .eq('assessment_code', assessmentCode)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to find assessment: ${error.message}`);
    }

    return this.mapRowToDomain(data as AssessmentsTableRow);
  }

  async findByCourse(courseId: string, tenantId: string): Promise<Assessment[]> {
    const { data, error } = await this.supabase
      .from('assessments')
      .select('*')
      .eq('course_id', courseId)
      .eq('tenant_id', tenantId)
      .order('due_date', { ascending: true });

    if (error) {
      throw new Error(`Failed to find assessments: ${error.message}`);
    }

    return (data as AssessmentsTableRow[]).map(row => this.mapRowToDomain(row));
  }

  async findAll(filters: AssessmentFilters): Promise<Assessment[]> {
    let query = this.supabase
      .from('assessments')
      .select('*')
      .eq('tenant_id', filters.tenantId);

    if (filters.courseId) {
      query = query.eq('course_id', filters.courseId);
    }
    if (filters.type) {
      query = query.eq('type', filters.type);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to find assessments: ${error.message}`);
    }

    return (data as AssessmentsTableRow[]).map(row => this.mapRowToDomain(row));
  }

  async update(assessmentId: string, tenantId: string, updates: Partial<Assessment>): Promise<Assessment> {
    const payload: AssessmentsTableUpdate = {};

    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.type !== undefined) payload.type = updates.type;
    if (updates.maxScore !== undefined) payload.max_score = updates.maxScore;
    if (updates.passingScore !== undefined) payload.passing_score = updates.passingScore;
    if (updates.weight !== undefined) payload.weight = updates.weight;
    if (updates.dueDate !== undefined) {
      payload.due_date = updates.dueDate?.toISOString() || null;
    }
    if (updates.status !== undefined) payload.status = updates.status;
    
    payload.updated_at = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('assessments')
      .update(payload)
      .eq('assessment_id', assessmentId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update assessment: ${error.message}`);
    }

    return this.mapRowToDomain(data as AssessmentsTableRow);
  }

  async delete(assessmentId: string, tenantId: string): Promise<void> {
    const { error } = await this.supabase
      .from('assessments')
      .delete()
      .eq('assessment_id', assessmentId)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(`Failed to delete assessment: ${error.message}`);
    }
  }

  // ============================================================================
  // Assessment Results CRUD
  // ============================================================================

  async createResult(result: AssessmentResult): Promise<AssessmentResult> {
    const payload: AssessmentResultsTableInsert = {
      result_id: result.resultId,
      tenant_id: result.tenantId,
      assessment_id: result.assessmentId,
      student_id: result.studentId,
      score: result.score,
      grade: result.grade,
      submitted_at: result.submittedAt?.toISOString(),
      graded_at: result.gradedAt?.toISOString(),
      feedback: result.feedback,
      status: result.status,
      created_at: result.createdAt.toISOString(),
      updated_at: result.updatedAt.toISOString(),
    };

    const { data, error } = await this.supabase
      .from('assessment_results')
      .insert(payload)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error('Student already has a result for this assessment');
      }
      throw new Error(`Failed to create assessment result: ${error.message}`);
    }

    return this.mapResultRowToDomain(data as AssessmentResultsTableRow);
  }

  async findResultById(resultId: string, tenantId: string): Promise<AssessmentResult | null> {
    const { data, error } = await this.supabase
      .from('assessment_results')
      .select('*')
      .eq('result_id', resultId)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to find assessment result: ${error.message}`);
    }

    return this.mapResultRowToDomain(data as AssessmentResultsTableRow);
  }

  async findResultsByStudent(studentId: string, tenantId: string): Promise<AssessmentResult[]> {
    const { data, error } = await this.supabase
      .from('assessment_results')
      .select('*')
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to find assessment results: ${error.message}`);
    }

    return (data as AssessmentResultsTableRow[]).map(row => this.mapResultRowToDomain(row));
  }

  async findResultsByAssessment(assessmentId: string, tenantId: string): Promise<AssessmentResult[]> {
    const { data, error } = await this.supabase
      .from('assessment_results')
      .select('*')
      .eq('assessment_id', assessmentId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to find assessment results: ${error.message}`);
    }

    return (data as AssessmentResultsTableRow[]).map(row => this.mapResultRowToDomain(row));
  }

  async findResults(filters: AssessmentResultFilters): Promise<AssessmentResult[]> {
    let query = this.supabase
      .from('assessment_results')
      .select('*')
      .eq('tenant_id', filters.tenantId);

    if (filters.assessmentId) {
      query = query.eq('assessment_id', filters.assessmentId);
    }
    if (filters.studentId) {
      query = query.eq('student_id', filters.studentId);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to find assessment results: ${error.message}`);
    }

    return (data as AssessmentResultsTableRow[]).map(row => this.mapResultRowToDomain(row));
  }

  async updateResult(resultId: string, tenantId: string, updates: Partial<AssessmentResult>): Promise<AssessmentResult> {
    const payload: AssessmentResultsTableUpdate = {};

    if (updates.score !== undefined) payload.score = updates.score;
    if (updates.grade !== undefined) payload.grade = updates.grade;
    if (updates.feedback !== undefined) payload.feedback = updates.feedback;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.submittedAt !== undefined) {
      payload.submitted_at = updates.submittedAt?.toISOString() || null;
    }
    if (updates.gradedAt !== undefined) {
      payload.graded_at = updates.gradedAt?.toISOString() || null;
    }
    
    payload.updated_at = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('assessment_results')
      .update(payload)
      .eq('result_id', resultId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update assessment result: ${error.message}`);
    }

    return this.mapResultRowToDomain(data as AssessmentResultsTableRow);
  }

  // ============================================================================
  // Mappers
  // ============================================================================

  private mapRowToDomain(row: AssessmentsTableRow): Assessment {
    return {
      assessmentId: row.assessment_id,
      tenantId: row.tenant_id,
      courseId: row.course_id,
      assessmentCode: row.assessment_code,
      title: row.title,
      description: row.description,
      type: row.type as Assessment['type'],
      maxScore: row.max_score,
      passingScore: row.passing_score,
      weight: row.weight,
      dueDate: row.due_date ? new Date(row.due_date) : null,
      status: row.status as Assessment['status'],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      createdBy: row.created_by,
    };
  }

  private mapResultRowToDomain(row: AssessmentResultsTableRow): AssessmentResult {
    return {
      resultId: row.result_id,
      tenantId: row.tenant_id,
      assessmentId: row.assessment_id,
      studentId: row.student_id,
      score: row.score,
      grade: row.grade,
      submittedAt: row.submitted_at ? new Date(row.submitted_at) : null,
      gradedAt: row.graded_at ? new Date(row.graded_at) : null,
      feedback: row.feedback,
      status: row.status as AssessmentResult['status'],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
