/**
 * Education OS — Integration Tests
 * 
 * Verifies Education OS engine running on real Supabase database and Common Core primitives.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { MemoryEventBusAdapter, DomainEventEnvelope } from '../../core/events';
import { Course } from '../domain/course.entity';
import { EducationEngineService } from '../education-engine.service';
import { SupabaseEducationRepository } from '../repositories/supabase-education.repository';

describe('Education OS — Integration Tests (Common Core Reuse Proof)', () => {
  let supabase: SupabaseClient<Record<string, unknown>>;
  let eventBus: MemoryEventBusAdapter;
  let repository: SupabaseEducationRepository;
  let service: EducationEngineService;

  const TENANT_EDU_A = '88888888-8888-8888-8888-88888888881a';
  const TENANT_EDU_B = '88888888-8888-8888-8888-88888888881b';
  const STUDENT_PERSON_A = '99999999-9999-9999-9999-99999999991a';
  const STUDENT_PERSON_B = '99999999-9999-9999-9999-99999999991b';
  const NON_PERSON_PARTY = '99999999-9999-9999-9999-99999999991c';

  beforeAll(async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables for integration tests');
    }

    supabase = createClient(supabaseUrl, supabaseServiceKey);
    eventBus = new MemoryEventBusAdapter();
    repository = new SupabaseEducationRepository(supabase);
    service = new EducationEngineService(repository, eventBus);

    // Clean up stale test records
    await supabase.from('edu_enrollments').delete().in('tenant_id', [TENANT_EDU_A, TENANT_EDU_B]);
    await supabase.from('edu_courses').delete().in('tenant_id', [TENANT_EDU_A, TENANT_EDU_B]);
    await supabase.from('party_parties').delete().in('tenant_id', [TENANT_EDU_A, TENANT_EDU_B]);
    await supabase.from('tenants').delete().in('id', [TENANT_EDU_A, TENANT_EDU_B]);

    // Seed tenants
    await supabase.from('tenants').upsert([
      { id: TENANT_EDU_A, name: 'Education Tenant A', status: 'active' },
      { id: TENANT_EDU_B, name: 'Education Tenant B', status: 'active' },
    ]);

    // Seed parties (Person student vs organization party)
    await supabase.from('party_parties').upsert([
      { id: STUDENT_PERSON_A, tenant_id: TENANT_EDU_A, party_type: 'person', display_name: 'Student Person A' },
      { id: STUDENT_PERSON_B, tenant_id: TENANT_EDU_B, party_type: 'person', display_name: 'Student Person B' },
      { id: NON_PERSON_PARTY, tenant_id: TENANT_EDU_A, party_type: 'organization', display_name: 'Org Party' },
    ]);
  });

  afterAll(async () => {
    await supabase.from('edu_enrollments').delete().in('tenant_id', [TENANT_EDU_A, TENANT_EDU_B]);
    await supabase.from('edu_courses').delete().in('tenant_id', [TENANT_EDU_A, TENANT_EDU_B]);
    await supabase.from('party_parties').delete().in('tenant_id', [TENANT_EDU_A, TENANT_EDU_B]);
    await supabase.from('tenants').delete().in('id', [TENANT_EDU_A, TENANT_EDU_B]);
  });

  beforeEach(() => {
    eventBus.clear();
  });

  describe('Student Role & Party Validation Invariants', () => {
    it('should reject enrollment if student party does not exist', async () => {
      const course = Course.create({ tenantId: TENANT_EDU_A, courseCode: 'MATH-101', title: 'Calculus I' });
      await repository.saveCourse(course);

      await expect(
        service.enrollStudent({
          tenantId: TENANT_EDU_A,
          studentPartyId: '00000000-0000-0000-0000-000000000000',
          courseId: course.id,
          requestId: 'req-001',
        })
      ).rejects.toThrow('Student validation failed');
    });

    it('should reject enrollment if party is an organization (not a person)', async () => {
      const course = Course.create({ tenantId: TENANT_EDU_A, courseCode: 'MATH-102', title: 'Calculus II' });
      await repository.saveCourse(course);

      await expect(
        service.enrollStudent({
          tenantId: TENANT_EDU_A,
          studentPartyId: NON_PERSON_PARTY,
          courseId: course.id,
          requestId: 'req-002',
        })
      ).rejects.toThrow("Party type must be 'person'");
    });

    it('should reject enrollment if student belongs to a different tenant', async () => {
      const course = Course.create({ tenantId: TENANT_EDU_A, courseCode: 'MATH-103', title: 'Calculus III' });
      await repository.saveCourse(course);

      // STUDENT_PERSON_B belongs to TENANT_EDU_B, trying to enroll in TENANT_EDU_A
      await expect(
        service.enrollStudent({
          tenantId: TENANT_EDU_A,
          studentPartyId: STUDENT_PERSON_B,
          courseId: course.id,
          requestId: 'req-003',
        })
      ).rejects.toThrow('Party belongs to tenant');
    });
  });

  describe('Enrollment Workflow & Event-After-Persistence', () => {
    it('should enroll student, persist to database, and publish edu.enrollment.created.v1 event', async () => {
      const course = Course.create({ tenantId: TENANT_EDU_A, courseCode: 'ENG-101', title: 'Academic Writing' });
      await repository.saveCourse(course);

      const eventsReceived: Array<DomainEventEnvelope<unknown>> = [];
      eventBus.subscribe('edu.enrollment.created.v1', async (evt) => {
        eventsReceived.push(evt);
      });

      const result = await service.enrollStudent({
        tenantId: TENANT_EDU_A,
        studentPartyId: STUDENT_PERSON_A,
        courseId: course.id,
        requestId: 'req-100',
      });

      expect(result.success).toBe(true);
      expect(result.isDuplicate).toBe(false);
      expect(result.eventPublished).toBe(true);
      expect(result.enrollment).toBeDefined();

      // Verify DB persistence
      const saved = await repository.findEnrollmentById(result.enrollment!.id, TENANT_EDU_A);
      expect(saved).not.toBeNull();
      expect(saved!.studentPartyId).toBe(STUDENT_PERSON_A);
      expect(saved!.courseId).toBe(course.id);

      // Verify Event Published AFTER DB Success
      expect(eventsReceived).toHaveLength(1);
      expect(eventsReceived[0].eventType).toBe('edu.enrollment.created.v1');
      expect((eventsReceived[0].payload as Record<string, unknown>).studentPartyId).toBe(STUDENT_PERSON_A);
    });

    it('should enforce idempotency on duplicate requests without creating second record or emitting second event', async () => {
      const course = Course.create({ tenantId: TENANT_EDU_A, courseCode: 'PHY-101', title: 'Physics I' });
      await repository.saveCourse(course);

      const eventsReceived: Array<DomainEventEnvelope<unknown>> = [];
      eventBus.subscribe('edu.enrollment.created.v1', async (evt) => {
        eventsReceived.push(evt);
      });

      // Request 1
      const res1 = await service.enrollStudent({
        tenantId: TENANT_EDU_A,
        studentPartyId: STUDENT_PERSON_A,
        courseId: course.id,
        requestId: 'req-idempotent-1',
      });

      expect(res1.isDuplicate).toBe(false);
      expect(eventsReceived).toHaveLength(1);

      // Request 2 (Duplicate replay)
      const res2 = await service.enrollStudent({
        tenantId: TENANT_EDU_A,
        studentPartyId: STUDENT_PERSON_A,
        courseId: course.id,
        requestId: 'req-idempotent-1',
      });

      expect(res2.isDuplicate).toBe(true);
      expect(res2.eventPublished).toBe(false);
      expect(res2.enrollment!.id).toBe(res1.enrollment!.id);
      expect(eventsReceived).toHaveLength(1); // No second event emitted
    });
  });

  describe('Multi-Tenant RLS & Isolation', () => {
    it('should isolate Education records between tenants', async () => {
      const courseA = Course.create({ tenantId: TENANT_EDU_A, courseCode: 'BIO-101', title: 'Biology A' });
      const courseB = Course.create({ tenantId: TENANT_EDU_B, courseCode: 'BIO-101', title: 'Biology B' });

      await repository.saveCourse(courseA);
      await repository.saveCourse(courseB);

      const foundInA = await repository.findCourseById(courseB.id, TENANT_EDU_A);
      expect(foundInA).toBeNull();

      const foundInB = await repository.findCourseById(courseB.id, TENANT_EDU_B);
      expect(foundInB).not.toBeNull();
      expect(foundInB!.title).toBe('Biology B');
    });
  });
});
