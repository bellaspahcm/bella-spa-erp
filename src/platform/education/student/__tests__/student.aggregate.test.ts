/**
 * Student Aggregate Unit Tests
 */

import { StudentAggregate } from '../student.aggregate';
import { CreateStudentRequest } from '../../shared-kernel/types';

describe('StudentAggregate', () => {
  const validRequest: CreateStudentRequest = {
    tenantId: 'tenant-123',
    personId: 'person-456',
    studentCode: 'EDU-2024-001',
    academicStatus: 'enrolled',
    enrollmentType: 'full_time',
    programId: 'program-789',
    enrollmentDate: '2024-09-01',
    expectedGraduationDate: '2028-06-30',
    currentLevel: 'Year 1',
    emergencyContactName: 'Jane Doe',
    emergencyContactPhone: '+84901234567',
    emergencyContactRelationship: 'Mother',
    createdBy: 'admin-001',
  };

  describe('create', () => {
    it('should create student with valid data', () => {
      const aggregate = StudentAggregate.create(validRequest);
      const student = aggregate.getStudent();

      expect(student.tenantId).toBe('tenant-123');
      expect(student.personId).toBe('person-456');
      expect(student.studentCode).toBe('EDU-2024-001');
      expect(student.academicStatus).toBe('enrolled');
      expect(student.enrollmentType).toBe('full_time');
      expect(student.programId).toBe('program-789');
      expect(student.enrollmentDate).toBe('2024-09-01');
      expect(student.expectedGraduationDate).toBe('2028-06-30');
      expect(student.currentLevel).toBe('Year 1');
      expect(student.studentId).toBeTruthy();
      expect(student.createdAt).toBeTruthy();
      expect(student.updatedAt).toBeTruthy();
    });

    it('should uppercase student code', () => {
      const aggregate = StudentAggregate.create({
        ...validRequest,
        studentCode: 'edu-2024-001',
      });
      expect(aggregate.getStudentCode()).toBe('EDU-2024-001');
    });

    it('should throw error if tenant ID missing', () => {
      expect(() =>
        StudentAggregate.create({ ...validRequest, tenantId: '' })
      ).toThrow('Tenant ID is required');
    });

    it('should throw error if person ID missing', () => {
      expect(() =>
        StudentAggregate.create({ ...validRequest, personId: '' })
      ).toThrow('Person ID is required');
    });

    it('should throw error if student code missing', () => {
      expect(() =>
        StudentAggregate.create({ ...validRequest, studentCode: '' })
      ).toThrow('Student code is required');
    });

    it('should throw error if program ID missing', () => {
      expect(() =>
        StudentAggregate.create({ ...validRequest, programId: '' })
      ).toThrow('Program ID is required');
    });

    it('should throw error if invalid enrollment date', () => {
      expect(() =>
        StudentAggregate.create({ ...validRequest, enrollmentDate: 'invalid-date' })
      ).toThrow('Invalid enrollment date format');
    });

    it('should throw error if invalid expected graduation date', () => {
      expect(() =>
        StudentAggregate.create({
          ...validRequest,
          expectedGraduationDate: 'invalid-date',
        })
      ).toThrow('Invalid expected graduation date format');
    });

    it('should throw error if graduation date before enrollment', () => {
      expect(() =>
        StudentAggregate.create({
          ...validRequest,
          enrollmentDate: '2024-09-01',
          expectedGraduationDate: '2024-08-31',
        })
      ).toThrow('Expected graduation date must be after enrollment date');
    });

    it('should throw error if invalid student code format', () => {
      expect(() =>
        StudentAggregate.create({ ...validRequest, studentCode: 'INVALID' })
      ).toThrow('Invalid student code format');
    });
  });

  describe('update', () => {
    it('should update student with valid data', () => {
      const aggregate = StudentAggregate.create(validRequest);
      const student = aggregate.getStudent();

      const updatedAggregate = aggregate.update({
        studentId: student.studentId,
        tenantId: student.tenantId,
        academicStatus: 'on_leave',
        currentLevel: 'Year 2',
        gpa: 3.5,
        totalCredits: 30,
      });

      const updatedStudent = updatedAggregate.getStudent();
      expect(updatedStudent.academicStatus).toBe('on_leave');
      expect(updatedStudent.currentLevel).toBe('Year 2');
      expect(updatedStudent.gpa).toBe(3.5);
      expect(updatedStudent.totalCredits).toBe(30);
    });

    it('should throw error if tenant mismatch', () => {
      const aggregate = StudentAggregate.create(validRequest);
      const student = aggregate.getStudent();

      expect(() =>
        aggregate.update({
          studentId: student.studentId,
          tenantId: 'different-tenant',
        })
      ).toThrow('Cannot change student tenant');
    });

    it('should throw error if student ID mismatch', () => {
      const aggregate = StudentAggregate.create(validRequest);
      const student = aggregate.getStudent();

      expect(() =>
        aggregate.update({
          studentId: 'different-id',
          tenantId: student.tenantId,
        })
      ).toThrow('Student ID mismatch');
    });

    it('should throw error if invalid GPA', () => {
      const aggregate = StudentAggregate.create(validRequest);
      const student = aggregate.getStudent();

      expect(() =>
        aggregate.update({
          studentId: student.studentId,
          tenantId: student.tenantId,
          gpa: 5.0,
        })
      ).toThrow('GPA must be between 0 and 4.0');
    });

    it('should throw error if negative credits', () => {
      const aggregate = StudentAggregate.create(validRequest);
      const student = aggregate.getStudent();

      expect(() =>
        aggregate.update({
          studentId: student.studentId,
          tenantId: student.tenantId,
          totalCredits: -10,
        })
      ).toThrow('Total credits cannot be negative');
    });
  });

  describe('markGraduated', () => {
    it('should mark student as graduated', () => {
      const aggregate = StudentAggregate.create(validRequest);
      const graduatedAggregate = aggregate.markGraduated('2028-06-30');
      const student = graduatedAggregate.getStudent();

      expect(student.academicStatus).toBe('graduated');
      expect(student.actualGraduationDate).toBe('2028-06-30');
      expect(graduatedAggregate.isGraduated()).toBe(true);
    });

    it('should throw error if invalid graduation date', () => {
      const aggregate = StudentAggregate.create(validRequest);
      expect(() => aggregate.markGraduated('invalid-date')).toThrow(
        'Invalid graduation date format'
      );
    });

    it('should throw error if graduation before enrollment', () => {
      const aggregate = StudentAggregate.create(validRequest);
      expect(() => aggregate.markGraduated('2024-08-31')).toThrow(
        'Graduation date cannot be before enrollment date'
      );
    });

    it('should throw error if already graduated', () => {
      const aggregate = StudentAggregate.create(validRequest);
      const graduatedAggregate = aggregate.markGraduated('2028-06-30');
      expect(() => graduatedAggregate.markGraduated('2028-07-01')).toThrow(
        'Student is already graduated'
      );
    });
  });

  describe('putOnLeave', () => {
    it('should put student on leave', () => {
      const aggregate = StudentAggregate.create(validRequest);
      const onLeaveAggregate = aggregate.putOnLeave();
      const student = onLeaveAggregate.getStudent();

      expect(student.academicStatus).toBe('on_leave');
      expect(onLeaveAggregate.isOnLeave()).toBe(true);
    });

    it('should throw error if already on leave', () => {
      const aggregate = StudentAggregate.create(validRequest);
      const onLeaveAggregate = aggregate.putOnLeave();
      expect(() => onLeaveAggregate.putOnLeave()).toThrow(
        'Student is already on leave'
      );
    });

    it('should throw error if already graduated', () => {
      const aggregate = StudentAggregate.create(validRequest);
      const graduatedAggregate = aggregate.markGraduated('2028-06-30');
      expect(() => graduatedAggregate.putOnLeave()).toThrow(
        'Cannot put graduated student on leave'
      );
    });
  });

  describe('reinstateFromLeave', () => {
    it('should reinstate student from leave', () => {
      const aggregate = StudentAggregate.create(validRequest);
      const onLeaveAggregate = aggregate.putOnLeave();
      const reinstatedAggregate = onLeaveAggregate.reinstateFromLeave();
      const student = reinstatedAggregate.getStudent();

      expect(student.academicStatus).toBe('enrolled');
      expect(reinstatedAggregate.isEnrolled()).toBe(true);
    });

    it('should throw error if not on leave', () => {
      const aggregate = StudentAggregate.create(validRequest);
      expect(() => aggregate.reinstateFromLeave()).toThrow(
        'Student is not on leave'
      );
    });
  });

  describe('updateAcademicProgress', () => {
    it('should update GPA and credits', () => {
      const aggregate = StudentAggregate.create(validRequest);
      const updatedAggregate = aggregate.updateAcademicProgress(3.8, 45);
      const student = updatedAggregate.getStudent();

      expect(student.gpa).toBe(3.8);
      expect(student.totalCredits).toBe(45);
      expect(updatedAggregate.getGPA()).toBe(3.8);
      expect(updatedAggregate.getTotalCredits()).toBe(45);
    });

    it('should throw error if invalid GPA', () => {
      const aggregate = StudentAggregate.create(validRequest);
      expect(() => aggregate.updateAcademicProgress(5.0, 30)).toThrow(
        'GPA must be between 0 and 4.0'
      );
    });

    it('should throw error if negative credits', () => {
      const aggregate = StudentAggregate.create(validRequest);
      expect(() => aggregate.updateAcademicProgress(3.0, -10)).toThrow(
        'Total credits cannot be negative'
      );
    });
  });

  describe('query methods', () => {
    it('should return student code', () => {
      const aggregate = StudentAggregate.create(validRequest);
      expect(aggregate.getStudentCode()).toBe('EDU-2024-001');
    });

    it('should return academic status', () => {
      const aggregate = StudentAggregate.create(validRequest);
      expect(aggregate.getAcademicStatus()).toBe('enrolled');
    });

    it('should check if enrolled', () => {
      const aggregate = StudentAggregate.create(validRequest);
      expect(aggregate.isEnrolled()).toBe(true);
      expect(aggregate.isGraduated()).toBe(false);
      expect(aggregate.isOnLeave()).toBe(false);
    });
  });
});
