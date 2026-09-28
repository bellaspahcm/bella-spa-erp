import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PreschoolParentDailyExperienceService,
} from '../services/preschool-parent-daily-experience.service';

interface FakeDb {
  party_identifiers: Array<Record<string, unknown>>;
  party_relationships: Array<Record<string, unknown>>;
  party_parties: Array<Record<string, unknown>>;
  students: Array<Record<string, unknown>>;
  edu_enrollments: Array<Record<string, unknown>>;
  edu_courses: Array<Record<string, unknown>>;
  edu_attendance_daily_state: Array<Record<string, unknown>>;
  edu_daily_care_sessions: Array<Record<string, unknown>>;
  edu_daily_care_records: Array<Record<string, unknown>>;
  edu_preschool_pickup_handover_events: Array<Record<string, unknown>>;
  edu_preschool_pickup_authorizations: Array<Record<string, unknown>>;
}

type FakeTable = keyof FakeDb;

class FakeQueryBuilder {
  private readonly eqFilters = new Map<string, unknown>();
  private readonly inFilters = new Map<string, readonly unknown[]>();
  private orderColumn: string | null = null;
  private orderAscending = true;
  private maxRows: number | null = null;

  constructor(
    private readonly db: FakeDb,
    private readonly table: FakeTable,
  ) {}

  select(): FakeQueryBuilder {
    return this;
  }

  eq(column: string, value: unknown): FakeQueryBuilder {
    this.eqFilters.set(column, value);
    return this;
  }

  in(column: string, values: readonly unknown[]): FakeQueryBuilder {
    this.inFilters.set(column, values);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): FakeQueryBuilder {
    this.orderColumn = column;
    this.orderAscending = options?.ascending ?? true;
    return this;
  }

  limit(count: number): FakeQueryBuilder {
    this.maxRows = count;
    return this;
  }

  async maybeSingle() {
    return { data: this.matchRows()[0] ?? null, error: null };
  }

  async single() {
    const row = this.matchRows()[0];
    return row
      ? { data: row, error: null }
      : { data: null, error: { message: 'No rows found' } };
  }

  then<TResult1 = { data: Array<Record<string, unknown>>; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: Array<Record<string, unknown>>; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve({ data: this.matchRows(), error: null }).then(onfulfilled, onrejected);
  }

  private matchRows(): Array<Record<string, unknown>> {
    let rows = this.db[this.table].filter((row) => {
      for (const [column, value] of this.eqFilters) {
        if (row[column] !== value) return false;
      }
      for (const [column, values] of this.inFilters) {
        if (!values.includes(row[column])) return false;
      }
      return true;
    });

    if (this.orderColumn) {
      const column = this.orderColumn;
      const direction = this.orderAscending ? 1 : -1;
      rows = [...rows].sort((left, right) => {
        const leftValue = String(left[column] ?? '');
        const rightValue = String(right[column] ?? '');
        return leftValue.localeCompare(rightValue) * direction;
      });
    }

    return this.maxRows === null ? rows : rows.slice(0, this.maxRows);
  }
}

class FakeSupabase {
  readonly db: FakeDb = {
    party_identifiers: [],
    party_relationships: [],
    party_parties: [],
    students: [],
    edu_enrollments: [],
    edu_courses: [],
    edu_attendance_daily_state: [],
    edu_daily_care_sessions: [],
    edu_daily_care_records: [],
    edu_preschool_pickup_handover_events: [],
    edu_preschool_pickup_authorizations: [],
  };

  from(table: FakeTable): FakeQueryBuilder {
    return new FakeQueryBuilder(this.db, table);
  }
}

function createService(fake: FakeSupabase) {
  return new PreschoolParentDailyExperienceService(fake as unknown as SupabaseClient);
}

function seedCanonicalDailyTruth(fake: FakeSupabase) {
  fake.db.party_identifiers.push({
    tenant_id: 'tenant-a',
    party_id: 'guardian-party-a',
    identifier_type: 'preschool_guardian_phone',
    identifier_value: '0900111222',
  });
  fake.db.party_relationships.push({
    tenant_id: 'tenant-a',
    source_party_id: 'guardian-party-a',
    target_party_id: 'student-party-a',
    relationship_type: 'guardian_of',
    active_to: null,
  });
  fake.db.party_parties.push({
    id: 'student-party-a',
    tenant_id: 'tenant-a',
    display_name: 'Parent Daily Child',
    gender: 'female',
    dob: '2022-01-01',
  });
  fake.db.students.push({
    tenant_id: 'tenant-a',
    party_id: 'student-party-a',
    student_code: 'EDU-2026-001',
  });
  fake.db.edu_enrollments.push({
    id: 'enrollment-a',
    tenant_id: 'tenant-a',
    course_id: 'course-a',
    student_party_id: 'student-party-a',
    status: 'active',
  });
  fake.db.edu_courses.push({
    id: 'course-a',
    tenant_id: 'tenant-a',
    title: 'Preschool Parent Class',
  });
  fake.db.edu_attendance_daily_state.push({
    tenant_id: 'tenant-a',
    enrollment_id: 'enrollment-a',
    school_day: '2026-09-27',
    status: 'present',
    updated_at: '2026-09-27T01:00:00.000Z',
  });
  fake.db.edu_daily_care_sessions.push({
    id: 'care-session-a',
    tenant_id: 'tenant-a',
    class_id: 'course-a',
    date: '2026-09-27',
  });
  fake.db.edu_daily_care_records.push({
    tenant_id: 'tenant-a',
    session_id: 'care-session-a',
    student_party_id: 'student-party-a',
    arrival_status: 'PRESENT',
    arrival_time: '2026-09-27T01:10:00.000Z',
    morning_condition: 'GOOD',
    meal_records: [{ mealType: 'LUNCH', portion: 'ALL' }],
    hygiene_records: [{ type: 'TOILET' }],
    nap_records: { quality: 'DEEP' },
    health_checks: {},
    updated_at: '2026-09-27T03:00:00.000Z',
  });
  fake.db.edu_preschool_pickup_handover_events.push({
    id: 'handover-a',
    tenant_id: 'tenant-a',
    student_party_id: 'student-party-a',
    guardian_party_id: 'guardian-party-a',
    pickup_authorization_id: 'pickup-auth-a',
    handed_over_at: '2026-09-27T10:00:00.000Z',
    handed_over_by: 'operator-a',
    created_at: '2026-09-27T10:00:00.000Z',
  });
}

const relatedParent = {
  tenantId: 'tenant-a',
  userId: 'parent-user-a',
  phone: '0900 111 222',
};

describe('PreschoolParentDailyExperienceService', () => {
  it('returns persisted attendance, care, and handover for a related Guardian Party', async () => {
    const fake = new FakeSupabase();
    seedCanonicalDailyTruth(fake);
    const service = createService(fake);

    const result = await service.getDailyExperience({
      user: relatedParent,
      schoolDay: '2026-09-27',
      requestedStudentPartyId: 'student-party-a',
    });

    expect(result.guardianPartyId).toBe('guardian-party-a');
    expect(result.children).toHaveLength(1);
    expect(result.children[0]).toEqual(expect.objectContaining({
      studentPartyId: 'student-party-a',
      childName: 'Parent Daily Child',
      courseTitle: 'Preschool Parent Class',
    }));
    expect(result.children[0].attendance.status).toBe('present');
    expect(result.children[0].care?.arrivalStatus).toBe('PRESENT');
    expect(result.children[0].care?.mealRecords).toHaveLength(1);
    expect(result.children[0].care?.hygieneRecords).toHaveLength(1);
    expect(result.children[0].care?.napRecords).toEqual({ quality: 'DEEP' });
    expect(result.children[0].handover).toEqual(expect.objectContaining({
      handedOver: true,
      handoverEventId: 'handover-a',
      pickupAuthorizationId: 'pickup-auth-a',
    }));
  });

  it('denies unrelated student lookup even inside the same tenant', async () => {
    const fake = new FakeSupabase();
    seedCanonicalDailyTruth(fake);
    fake.db.party_parties.push({
      id: 'student-party-b',
      tenant_id: 'tenant-a',
      display_name: 'Unrelated Child',
    });
    const service = createService(fake);

    await expect(service.getDailyExperience({
      user: relatedParent,
      schoolDay: '2026-09-27',
      requestedStudentPartyId: 'student-party-b',
    })).rejects.toThrow('PARENT_DAILY_STUDENT_ACCESS_DENIED');
  });

  it('denies cross-tenant student lookup', async () => {
    const fake = new FakeSupabase();
    seedCanonicalDailyTruth(fake);
    fake.db.party_parties.push({
      id: 'student-party-x',
      tenant_id: 'tenant-b',
      display_name: 'Other Tenant Child',
    });
    const service = createService(fake);

    await expect(service.getDailyExperience({
      user: relatedParent,
      schoolDay: '2026-09-27',
      requestedStudentPartyId: 'student-party-x',
    })).rejects.toThrow('PARENT_DAILY_STUDENT_ACCESS_DENIED');
  });

  it('does not treat pickup authorization alone as parent data access', async () => {
    const fake = new FakeSupabase();
    seedCanonicalDailyTruth(fake);
    fake.db.party_relationships.length = 0;
    fake.db.edu_preschool_pickup_authorizations.push({
      id: 'pickup-auth-a',
      tenant_id: 'tenant-a',
      student_party_id: 'student-party-a',
      guardian_party_id: 'guardian-party-a',
      status: 'authorized',
    });
    const service = createService(fake);

    await expect(service.getDailyExperience({
      user: relatedParent,
      schoolDay: '2026-09-27',
      requestedStudentPartyId: 'student-party-a',
    })).rejects.toThrow('PARENT_DAILY_STUDENT_ACCESS_DENIED');
  });
});
