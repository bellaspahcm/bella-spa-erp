import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import { ProgramService } from '../services/program.service';
import { CourseService } from '../services/course.service';
import { ClassService } from '../services/class.service';
import { CreateProgramInput } from '../types/program.types';
import { CreateCourseInput } from '../types/course.types';
import { CreateClassInput } from '../types/class.types';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const describeIfSupabase = supabaseUrl && supabaseKey ? describe : describe.skip;

describeIfSupabase('E3 — Program/Course/Class Services', () => {
  let programService: ProgramService;
  let courseService: CourseService;
  let classService: ClassService;
  let testTenantId: string;
  let testBranchId: string;
  let createdProgramIds: string[] = [];
  let createdCourseIds: string[] = [];
  let createdClassIds: string[] = [];

  beforeEach(async () => {
    const supabase = createClient(supabaseUrl, supabaseKey);
    programService = new ProgramService(supabase);
    courseService = new CourseService(supabase);
    classService = new ClassService(supabase);

    const { data: branch } = await supabase
      .from('org_units')
      .select('id, tenant_id')
      .eq('is_active', true)
      .limit(1)
      .single();
    testBranchId = branch?.id || '';
    testTenantId = branch?.tenant_id || '';
  });

  afterEach(async () => {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    if (createdClassIds.length > 0) {
      await supabase.from('english_center_classes').delete().in('id', createdClassIds);
    }
    if (createdCourseIds.length > 0) {
      await supabase.from('english_center_courses').delete().in('id', createdCourseIds);
    }
    if (createdProgramIds.length > 0) {
      await supabase.from('english_center_programs').delete().in('id', createdProgramIds);
    }

    createdProgramIds = [];
    createdCourseIds = [];
    createdClassIds = [];
  });

  describe('Program Service', () => {
    it('should create program', async () => {
      const input: CreateProgramInput = {
        name: 'IELTS Preparation',
        code: `PROG-${Date.now()}`,
        description: 'Comprehensive IELTS preparation program',
        durationMonths: 6,
      };

      const program = await programService.createProgram(testTenantId, input);
      createdProgramIds.push(program.id);

      expect(program).toBeDefined();
      expect(program.name).toBe(input.name);
      expect(program.code).toBe(input.code);
      expect(program.tenantId).toBe(testTenantId);
      expect(program.status).toBe('active');
    });

    it('should list programs', async () => {
      const input: CreateProgramInput = {
        name: 'Test Program',
        code: `PROG-${Date.now()}`,
        description: 'Test',
        durationMonths: 3,
      };

      const created = await programService.createProgram(testTenantId, input);
      createdProgramIds.push(created.id);

      const result = await programService.listPrograms(testTenantId, { status: 'active' });

      expect(result.programs.length).toBeGreaterThan(0);
      const found = result.programs.find(p => p.id === created.id);
      expect(found).toBeDefined();
    });

    it('should enforce tenant isolation for programs', async () => {
      const input: CreateProgramInput = {
        name: 'Isolated Program',
        code: `PROG-${Date.now()}`,
        description: 'Test isolation',
      };

      const created = await programService.createProgram(testTenantId, input);
      createdProgramIds.push(created.id);

      const fakeTenantId = '00000000-0000-0000-0000-000000000000';
      const retrieved = await programService.getProgram(fakeTenantId, created.id);

      expect(retrieved).toBeNull();
    });
  });

  describe('Course Service', () => {
    let testProgramId: string;

    beforeEach(async () => {
      const programInput: CreateProgramInput = {
        name: 'Test Program for Courses',
        code: `PROG-${Date.now()}`,
        description: 'Test',
      };
      const program = await programService.createProgram(testTenantId, programInput);
      testProgramId = program.id;
      createdProgramIds.push(program.id);
    });

    it('should create course linked to program', async () => {
      const input: CreateCourseInput = {
        programId: testProgramId,
        name: 'Beginner Level',
        code: `COURSE-${Date.now()}`,
        description: 'Beginner English course',
        durationWeeks: 12,
      };

      const course = await courseService.createCourse(testTenantId, input);
      createdCourseIds.push(course.id);

      expect(course).toBeDefined();
      expect(course.programId).toBe(testProgramId);
      expect(course.name).toBe(input.name);
      expect(course.tenantId).toBe(testTenantId);
    });

    it('should list courses by program', async () => {
      const input: CreateCourseInput = {
        programId: testProgramId,
        name: 'Test Course',
        code: `COURSE-${Date.now()}`,
        description: 'Test',
      };

      const created = await courseService.createCourse(testTenantId, input);
      createdCourseIds.push(created.id);

      const result = await courseService.listCourses(testTenantId, { programId: testProgramId });

      expect(result.courses.length).toBeGreaterThan(0);
      const found = result.courses.find(c => c.id === created.id);
      expect(found).toBeDefined();
    });

    it('should enforce tenant isolation for courses', async () => {
      const input: CreateCourseInput = {
        programId: testProgramId,
        name: 'Isolated Course',
        code: `COURSE-${Date.now()}`,
        description: 'Test',
      };

      const created = await courseService.createCourse(testTenantId, input);
      createdCourseIds.push(created.id);

      const fakeTenantId = '00000000-0000-0000-0000-000000000000';
      const retrieved = await courseService.getCourse(fakeTenantId, created.id);

      expect(retrieved).toBeNull();
    });
  });

  describe('Class Service', () => {
    let testCourseId: string;

    beforeEach(async () => {
      const programInput: CreateProgramInput = {
        name: 'Test Program for Classes',
        code: `PROG-${Date.now()}`,
        description: 'Test',
      };
      const program = await programService.createProgram(testTenantId, programInput);
      createdProgramIds.push(program.id);

      const courseInput: CreateCourseInput = {
        programId: program.id,
        name: 'Test Course for Classes',
        code: `COURSE-${Date.now()}`,
        description: 'Test',
      };
      const course = await courseService.createCourse(testTenantId, courseInput);
      testCourseId = course.id;
      createdCourseIds.push(course.id);
    });

    it('should create class linked to course and branch', async () => {
      const input: CreateClassInput = {
        courseId: testCourseId,
        branchId: testBranchId,
        name: 'Beginner A1',
        code: `CLASS-${Date.now()}`,
        startDate: new Date().toISOString(),
        maxStudents: 15,
      };

      const classEntity = await classService.createClass(testTenantId, input);
      createdClassIds.push(classEntity.id);

      expect(classEntity).toBeDefined();
      expect(classEntity.courseId).toBe(testCourseId);
      expect(classEntity.branchId).toBe(testBranchId);
      expect(classEntity.name).toBe(input.name);
      expect(classEntity.tenantId).toBe(testTenantId);
    });

    it('should list classes by branch', async () => {
      const input: CreateClassInput = {
        courseId: testCourseId,
        branchId: testBranchId,
        name: 'Test Class',
        code: `CLASS-${Date.now()}`,
        startDate: new Date().toISOString(),
      };

      const created = await classService.createClass(testTenantId, input);
      createdClassIds.push(created.id);

      const result = await classService.listClasses(testTenantId, { branchId: testBranchId });

      expect(result.classes.length).toBeGreaterThan(0);
      const found = result.classes.find(c => c.id === created.id);
      expect(found).toBeDefined();
    });

    it('should enforce tenant isolation for classes', async () => {
      const input: CreateClassInput = {
        courseId: testCourseId,
        branchId: testBranchId,
        name: 'Isolated Class',
        code: `CLASS-${Date.now()}`,
        startDate: new Date().toISOString(),
      };

      const created = await classService.createClass(testTenantId, input);
      createdClassIds.push(created.id);

      const fakeTenantId = '00000000-0000-0000-0000-000000000000';
      const retrieved = await classService.getClass(fakeTenantId, created.id);

      expect(retrieved).toBeNull();
    });

    it('should enforce branch scope for classes', async () => {
      const input: CreateClassInput = {
        courseId: testCourseId,
        branchId: testBranchId,
        name: 'Branch Scoped Class',
        code: `CLASS-${Date.now()}`,
        startDate: new Date().toISOString(),
      };

      const created = await classService.createClass(testTenantId, input);
      createdClassIds.push(created.id);

      const result = await classService.listClasses(testTenantId, { branchId: testBranchId });
      const found = result.classes.find(c => c.id === created.id);

      expect(found).toBeDefined();
      expect(found?.branchId).toBe(testBranchId);
    });
  });
});
