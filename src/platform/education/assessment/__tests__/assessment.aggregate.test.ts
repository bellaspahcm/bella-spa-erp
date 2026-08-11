/**
 * Assessment Aggregate Unit Tests
 */

import { AssessmentAggregate, AssessmentResultAggregate } from '../assessment.aggregate';
import type { CreateAssessmentDTO, CreateAssessmentResultDTO } from '../assessment.types';

describe('AssessmentAggregate', () => {
  const validDTO: CreateAssessmentDTO = {
    tenantId: 'tenant-1',
    courseId: 'course-1',
    assessmentCode: 'EXAM-001',
    title: 'Midterm Exam',
    description: 'Mathematics midterm exam',
    type: 'exam',
    maxScore: 100,
    passingScore: 60,
    weight: 40,
    dueDate: new Date('2026-12-31'),
    createdBy: 'teacher-1',
  };

  describe('create', () => {
    it('should create valid assessment', () => {
      const aggregate = AssessmentAggregate.create(validDTO);
      
      expect(aggregate.assessmentId).toBeDefined();
      expect(aggregate.tenantId).toBe('tenant-1');
      expect(aggregate.assessmentCode).toBe('EXAM-001');
      expect(aggregate.title).toBe('Midterm Exam');
      expect(aggregate.status).toBe('draft');
      expect(aggregate.maxScore).toBe(100);
      expect(aggregate.passingScore).toBe(60);
      expect(aggregate.weight).toBe(40);
    });

    it('should reject empty assessment code', () => {
      expect(() => {
        AssessmentAggregate.create({ ...validDTO, assessmentCode: '' });
      }).toThrow('Assessment code is required');
    });

    it('should reject empty title', () => {
      expect(() => {
        AssessmentAggregate.create({ ...validDTO, title: '' });
      }).toThrow('Assessment title is required');
    });

    it('should reject invalid max score', () => {
      expect(() => {
        AssessmentAggregate.create({ ...validDTO, maxScore: 0 });
      }).toThrow('Max score must be greater than 0');
    });

    it('should reject passing score > max score', () => {
      expect(() => {
        AssessmentAggregate.create({ ...validDTO, passingScore: 150 });
      }).toThrow('Passing score must be between 0 and max score');
    });

    it('should reject negative passing score', () => {
      expect(() => {
        AssessmentAggregate.create({ ...validDTO, passingScore: -10 });
      }).toThrow('Passing score must be between 0 and max score');
    });

    it('should reject weight > 100', () => {
      expect(() => {
        AssessmentAggregate.create({ ...validDTO, weight: 150 });
      }).toThrow('Weight must be between 0 and 100');
    });

    it('should reject negative weight', () => {
      expect(() => {
        AssessmentAggregate.create({ ...validDTO, weight: -10 });
      }).toThrow('Weight must be between 0 and 100');
    });
  });

  describe('publish', () => {
    it('should publish draft assessment', () => {
      const aggregate = AssessmentAggregate.create(validDTO);
      
      aggregate.publish();
      
      expect(aggregate.status).toBe('published');
    });

    it('should reject publishing non-draft assessment', () => {
      const aggregate = AssessmentAggregate.create(validDTO);
      aggregate.publish();
      
      expect(() => {
        aggregate.publish();
      }).toThrow('Can only publish draft assessments');
    });
  });

  describe('archive', () => {
    it('should archive published assessment', () => {
      const aggregate = AssessmentAggregate.create(validDTO);
      aggregate.publish();
      
      aggregate.archive();
      
      expect(aggregate.status).toBe('archived');
    });

    it('should reject archiving draft assessment', () => {
      const aggregate = AssessmentAggregate.create(validDTO);
      
      expect(() => {
        aggregate.archive();
      }).toThrow('Cannot archive draft assessment');
    });
  });

  describe('update', () => {
    it('should update draft assessment title', () => {
      const aggregate = AssessmentAggregate.create(validDTO);
      
      aggregate.update({ title: 'Final Exam' });
      
      expect(aggregate.title).toBe('Final Exam');
    });

    it('should update max score and adjust passing score', () => {
      const aggregate = AssessmentAggregate.create(validDTO);
      
      aggregate.update({ maxScore: 50 });
      
      expect(aggregate.maxScore).toBe(50);
      expect(aggregate.passingScore).toBe(50); // Adjusted from 60
    });

    it('should reject updating published assessment', () => {
      const aggregate = AssessmentAggregate.create(validDTO);
      aggregate.publish();
      
      expect(() => {
        aggregate.update({ title: 'New Title' });
      }).toThrow('Cannot modify published or graded assessments');
    });

    it('should reject empty title', () => {
      const aggregate = AssessmentAggregate.create(validDTO);
      
      expect(() => {
        aggregate.update({ title: '' });
      }).toThrow('Title cannot be empty');
    });

    it('should reject invalid passing score', () => {
      const aggregate = AssessmentAggregate.create(validDTO);
      
      expect(() => {
        aggregate.update({ passingScore: 150 });
      }).toThrow('Passing score must be between 0 and max score');
    });
  });

  describe('canBeGraded', () => {
    it('should return true for published assessment', () => {
      const aggregate = AssessmentAggregate.create(validDTO);
      aggregate.publish();
      
      expect(aggregate.canBeGraded()).toBe(true);
    });

    it('should return false for draft assessment', () => {
      const aggregate = AssessmentAggregate.create(validDTO);
      
      expect(aggregate.canBeGraded()).toBe(false);
    });
  });

  describe('isOverdue', () => {
    it('should return true for past due date', () => {
      const aggregate = AssessmentAggregate.create({
        ...validDTO,
        dueDate: new Date('2020-01-01'),
      });
      
      expect(aggregate.isOverdue()).toBe(true);
    });

    it('should return false for future due date', () => {
      const aggregate = AssessmentAggregate.create({
        ...validDTO,
        dueDate: new Date('2030-01-01'),
      });
      
      expect(aggregate.isOverdue()).toBe(false);
    });

    it('should return false for no due date', () => {
      const aggregate = AssessmentAggregate.create({
        ...validDTO,
        dueDate: undefined,
      });
      
      expect(aggregate.isOverdue()).toBe(false);
    });
  });
});

describe('AssessmentResultAggregate', () => {
  const validDTO: CreateAssessmentResultDTO = {
    tenantId: 'tenant-1',
    assessmentId: 'assessment-1',
    studentId: 'student-1',
    createdBy: 'system',
  };

  describe('create', () => {
    it('should create valid assessment result', () => {
      const aggregate = AssessmentResultAggregate.create(validDTO);
      
      expect(aggregate.resultId).toBeDefined();
      expect(aggregate.assessmentId).toBe('assessment-1');
      expect(aggregate.studentId).toBe('student-1');
      expect(aggregate.status).toBe('pending');
      expect(aggregate.score).toBeNull();
    });
  });

  describe('submit', () => {
    it('should submit pending result', () => {
      const aggregate = AssessmentResultAggregate.create(validDTO);
      
      aggregate.submit();
      
      expect(aggregate.status).toBe('submitted');
    });

    it('should reject submitting non-pending result', () => {
      const aggregate = AssessmentResultAggregate.create(validDTO);
      aggregate.submit();
      
      expect(() => {
        aggregate.submit();
      }).toThrow('Can only submit pending results');
    });
  });

  describe('grade', () => {
    it('should grade submitted result', () => {
      const aggregate = AssessmentResultAggregate.create(validDTO);
      aggregate.submit();
      
      aggregate.grade({
        score: 85,
        grade: 'B',
        feedback: 'Good work',
        gradedBy: 'teacher-1',
      }, 100);
      
      expect(aggregate.status).toBe('graded');
      expect(aggregate.score).toBe(85);
    });

    it('should reject grading pending result', () => {
      const aggregate = AssessmentResultAggregate.create(validDTO);
      
      expect(() => {
        aggregate.grade({
          score: 85,
          grade: 'B',
          gradedBy: 'teacher-1',
        }, 100);
      }).toThrow('Cannot grade pending result');
    });

    it('should reject score > max score', () => {
      const aggregate = AssessmentResultAggregate.create(validDTO);
      aggregate.submit();
      
      expect(() => {
        aggregate.grade({
          score: 150,
          grade: 'A',
          gradedBy: 'teacher-1',
        }, 100);
      }).toThrow('Score must be between 0 and 100');
    });

    it('should reject negative score', () => {
      const aggregate = AssessmentResultAggregate.create(validDTO);
      aggregate.submit();
      
      expect(() => {
        aggregate.grade({
          score: -10,
          grade: 'F',
          gradedBy: 'teacher-1',
        }, 100);
      }).toThrow('Score must be between 0 and 100');
    });
  });

  describe('isPassing', () => {
    it('should return true if score >= passing score', () => {
      const aggregate = AssessmentResultAggregate.create(validDTO);
      aggregate.submit();
      aggregate.grade({
        score: 70,
        grade: 'C',
        gradedBy: 'teacher-1',
      }, 100);
      
      expect(aggregate.isPassing(60)).toBe(true);
    });

    it('should return false if score < passing score', () => {
      const aggregate = AssessmentResultAggregate.create(validDTO);
      aggregate.submit();
      aggregate.grade({
        score: 50,
        grade: 'F',
        gradedBy: 'teacher-1',
      }, 100);
      
      expect(aggregate.isPassing(60)).toBe(false);
    });

    it('should return false if not graded', () => {
      const aggregate = AssessmentResultAggregate.create(validDTO);
      
      expect(aggregate.isPassing(60)).toBe(false);
    });
  });
});
