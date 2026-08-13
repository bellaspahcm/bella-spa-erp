import { IEducationAssessmentContract, RecordScoreInput, EducationAssessmentDTO } from './assessment.contract';
import { AssessmentService } from '../assessment/assessment.service';
import { EnrollmentService } from '../enrollment/enrollment.service';
import { createClient } from '@/lib/supabase-server';

export class AssessmentContractImpl implements IEducationAssessmentContract {
  public async recordScore(input: RecordScoreInput): Promise<EducationAssessmentDTO> {
    // 1. Resolve enrollment details
    const enrollment = await EnrollmentService.getEnrollmentById(input.enrollmentId, input.tenantId);
    if (!enrollment) {
      throw new Error(`Enrollment ${input.enrollmentId} not found`);
    }

    const supabase = await createClient();
    const service = new AssessmentService(supabase);

    // 2. Find or create assessment definition for the course
    const assessments = await service.getAssessmentsByCoruse(enrollment.courseId, input.tenantId);
    let assessment = assessments.find(a => a.type === input.scoreType);
    if (!assessment) {
      assessment = await service.createAssessment({
        tenantId: input.tenantId,
        courseId: enrollment.courseId,
        assessmentCode: `ASM-${enrollment.courseId.slice(0, 8)}-${input.scoreType.toUpperCase()}`,
        title: `${input.scoreType.toUpperCase()} for course`,
        type: input.scoreType,
        maxScore: 100,
        passingScore: 50,
        weight: input.weight,
        createdBy: '00000000-0000-0000-0000-000000000001',
      });
      // publish it so it can be graded
      await service.publishAssessment(assessment.assessmentId, input.tenantId);
    }

    // 3. Record result
    let result = await service.createAssessmentResult({
      tenantId: input.tenantId,
      assessmentId: assessment.assessmentId,
      studentId: enrollment.studentId,
    });

    // submit result
    await service.submitAssessmentResult(result.resultId, input.tenantId);

    // grade it
    result = await service.gradeAssessmentResult(result.resultId, input.tenantId, {
      score: input.grade,
      feedback: 'Graded by contract implementation',
      gradedBy: '00000000-0000-0000-0000-000000000001',
    });

    return {
      id: result.resultId,
      tenantId: result.tenantId,
      enrollmentId: input.enrollmentId,
      scoreType: input.scoreType,
      grade: result.score ?? 0,
      weight: assessment.weight,
      occurredAt: result.createdAt.toISOString(),
    };
  }

  public async getScores(tenantId: string, enrollmentId: string): Promise<readonly EducationAssessmentDTO[]> {
    const enrollment = await EnrollmentService.getEnrollmentById(enrollmentId, tenantId);
    if (!enrollment) {
      return [];
    }

    const supabase = await createClient();
    const service = new AssessmentService(supabase);

    const results = await service.getResultsByStudent(enrollment.studentId, tenantId);
    const scores: EducationAssessmentDTO[] = [];

    for (const res of results) {
      const asm = await service.getAssessment(res.assessmentId, tenantId);
      if (asm && asm.courseId === enrollment.courseId) {
        scores.push({
          id: res.resultId,
          tenantId: res.tenantId,
          enrollmentId: enrollmentId,
          scoreType: asm.type as 'quiz' | 'midterm' | 'final' | 'homework',
          grade: res.score ?? 0,
          weight: asm.weight,
          occurredAt: res.createdAt.toISOString(),
        });
      }
    }

    return scores;
  }

  public async calculateGpa(tenantId: string, enrollmentId: string): Promise<number> {
    const enrollment = await EnrollmentService.getEnrollmentById(enrollmentId, tenantId);
    if (!enrollment) {
      throw new Error(`Enrollment ${enrollmentId} not found`);
    }

    const supabase = await createClient();
    const service = new AssessmentService(supabase);

    const results = await service.getResultsByStudent(enrollment.studentId, tenantId);
    let totalWeight = 0;
    let weightedScoreSum = 0;

    for (const res of results) {
      const asm = await service.getAssessment(res.assessmentId, tenantId);
      if (asm && asm.courseId === enrollment.courseId && res.score !== null) {
        weightedScoreSum += res.score * asm.weight;
        totalWeight += asm.weight;
      }
    }

    if (totalWeight === 0) return 0;
    const finalGrade = weightedScoreSum / totalWeight;
    // GPA on 4.0 scale (grade is 0 to 100)
    return parseFloat(((finalGrade / 100) * 4.0).toFixed(2));
  }
}
