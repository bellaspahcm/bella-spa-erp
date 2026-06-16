jest.mock('server-only', () => ({}), { virtual: true });

const mockGetAuthorizedTenantUser = jest.fn();
const mockCreateDevelopmentBypassClient = jest.fn();
const mockSafeRevalidatePath = jest.fn();
const mockCreateUser = jest.fn();

jest.mock('@/core/services/auth', () => ({
  getAuthorizedTenantUser: (options: unknown) => mockGetAuthorizedTenantUser(options),
}));

jest.mock('@/lib/supabase-dev-bypass-server', () => ({
  createDevelopmentBypassClient: () => mockCreateDevelopmentBypassClient(),
}));

jest.mock('@/lib/revalidate', () => ({
  safeRevalidatePath: (path: string) => mockSafeRevalidatePath(path),
}));

jest.mock('@/services/user-actions', () => ({
  createUser: (input: unknown) => mockCreateUser(input),
}));

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};
type QueryOperation = 'select' | 'insert' | 'update' | 'delete';
type QueryCall = {
  table: string;
  operation: QueryOperation;
  payload?: unknown;
  selectColumns?: string;
  filters: Array<{ type: 'eq' | 'in'; column: string; value: unknown }>;
  orders: Array<{ column: string; options?: unknown }>;
};

const queryCalls: QueryCall[] = [];
let scriptedResults: QueryResult[] = [];

class QueryBuilder implements PromiseLike<QueryResult> {
  private operation: QueryOperation = 'select';
  private payload?: unknown;
  private selectColumns?: string;
  private filters: QueryCall['filters'] = [];
  private orders: QueryCall['orders'] = [];

  constructor(private readonly table: string) {}

  select(columns?: string) {
    this.selectColumns = columns;
    return this;
  }

  insert(payload: unknown) {
    this.operation = 'insert';
    this.payload = payload;
    return this;
  }

  update(payload: unknown) {
    this.operation = 'update';
    this.payload = payload;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ type: 'eq', column, value });
    return this;
  }

  in(column: string, value: unknown) {
    this.filters.push({ type: 'in', column, value });
    return this;
  }

  order(column: string, options?: unknown) {
    this.orders.push({ column, options });
    return this;
  }

  single() {
    return this.resolve();
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.resolve().then(onfulfilled, onrejected);
  }

  private resolve() {
    queryCalls.push({
      table: this.table,
      operation: this.operation,
      payload: this.payload,
      selectColumns: this.selectColumns,
      filters: [...this.filters],
      orders: [...this.orders],
    });

    return Promise.resolve(scriptedResults.shift() ?? { data: null, error: null });
  }
}

const mockDb = {
  from: jest.fn((table: string) => new QueryBuilder(table)),
};

import {
  archiveTrainingCourse,
  createCourseModule,
  createTrainingClass,
  createTrainingEnrollment,
  createTrainingCourse,
  createTrainingStudentAccount,
  getTrainingAdminOverview,
  getTrainingClassAdminOverview,
  getTrainingEnrollmentAdminOverview,
  getTrainingStudentAccountOverview,
  getStudentTrainingPortalOverview,
  markStudentLessonComplete,
} from '@/services/training-actions';

function grantAdmin() {
  mockGetAuthorizedTenantUser.mockResolvedValue({
    ok: true,
    tenantId: 'tenant-1',
    user: { id: 'admin-1', tenant_id: 'tenant-1', role: 'admin' },
    error: null,
    reason: null,
  });
}

function grantStudent() {
  mockGetAuthorizedTenantUser.mockResolvedValue({
    ok: true,
    tenantId: 'tenant-1',
    user: { id: 'student-user-1', tenant_id: 'tenant-1', role: 'student' },
    error: null,
    reason: null,
  });
}

describe('training actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryCalls.length = 0;
    scriptedResults = [];
    grantAdmin();
    mockCreateDevelopmentBypassClient.mockResolvedValue(mockDb);
    mockCreateUser.mockResolvedValue({
      data: {
        id: 'student-user-new',
        tenant_id: 'tenant-1',
        full_name: 'Học Viên Mới',
        email: 'student-new@example.com',
        phone: null,
        role: 'student',
        status: 'active',
      },
      defaultPassword: 'Bella-temp-123',
    });
  });

  it('loads courses, modules, and lessons through tenant-scoped queries', async () => {
    scriptedResults = [
      {
        data: [{
          id: 'course-1',
          tenant_id: 'tenant-1',
          module_key: 'student_training',
          title: 'Massage nền tảng',
          description: null,
          specialty: 'Babycare',
          tuition_amount: 1000000,
          theory_duration_minutes: 120,
          status: 'active',
          created_by: 'admin-1',
          created_at: '2026-06-14T00:00:00.000Z',
          updated_at: '2026-06-14T00:00:00.000Z',
        }],
        error: null,
      },
      {
        data: [{
          id: 'module-1',
          course_id: 'course-1',
          title: 'Chương 1',
          description: null,
          sequence_order: 1,
          created_at: '2026-06-14T00:00:00.000Z',
          updated_at: '2026-06-14T00:00:00.000Z',
        }],
        error: null,
      },
      {
        data: [{
          id: 'lesson-1',
          module_id: 'module-1',
          title: 'Bài 1',
          content_type: 'document',
          content_url: null,
          body: null,
          sequence_order: 1,
          required_view_seconds: 60,
          required_view_percentage: 90,
          status: 'published',
          created_at: '2026-06-14T00:00:00.000Z',
          updated_at: '2026-06-14T00:00:00.000Z',
        }],
        error: null,
      },
    ];

    const result = await getTrainingAdminOverview();

    expect(result.success).toBe(true);
    expect(result.success ? result.data[0].modules[0].lessons[0].title : '').toBe('Bài 1');
    expect(queryCalls[0]).toMatchObject({
      table: 'courses',
      operation: 'select',
      filters: [{ type: 'eq', column: 'tenant_id', value: 'tenant-1' }],
    });
    expect(queryCalls[1]).toMatchObject({
      table: 'course_modules',
      filters: [{ type: 'in', column: 'course_id', value: ['course-1'] }],
    });
  });

  it('rejects invalid course input before database writes', async () => {
    const result = await createTrainingCourse({ title: '', tuitionAmount: '1000' });

    expect(result).toEqual({ success: false, error: 'Vui lòng nhập tên khóa học.' });
    expect(queryCalls).toHaveLength(0);
    expect(mockSafeRevalidatePath).not.toHaveBeenCalled();
  });

  it('returns explicit database errors when course insert fails', async () => {
    scriptedResults = [
      { data: null, error: { message: 'insert denied' } },
    ];

    const result = await createTrainingCourse({
      title: 'Massage nền tảng',
      tuitionAmount: '1200000',
      theoryDurationMinutes: '90',
      status: 'active',
    });

    expect(result).toEqual({ success: false, error: 'insert denied' });
    expect(queryCalls[0]).toMatchObject({
      table: 'courses',
      operation: 'insert',
      payload: [expect.objectContaining({
        tenant_id: 'tenant-1',
        module_key: 'student_training',
        title: 'Massage nền tảng',
        created_by: 'admin-1',
      })],
    });
  });

  it('verifies course tenant ownership before inserting a module', async () => {
    scriptedResults = [
      { data: null, error: { message: 'course outside tenant' } },
    ];

    const result = await createCourseModule({
      courseId: 'course-outside',
      title: 'Chương sai tenant',
      sequenceOrder: '1',
    });

    expect(result).toEqual({ success: false, error: 'course outside tenant' });
    expect(queryCalls).toHaveLength(1);
    expect(queryCalls[0]).toMatchObject({
      table: 'courses',
      operation: 'select',
      filters: [
        { type: 'eq', column: 'id', value: 'course-outside' },
        { type: 'eq', column: 'tenant_id', value: 'tenant-1' },
      ],
    });
  });

  it('archives courses with both id and tenant filters', async () => {
    scriptedResults = [
      {
        data: {
          id: 'course-1',
          tenant_id: 'tenant-1',
          module_key: 'student_training',
          title: 'Massage nền tảng',
          description: null,
          specialty: null,
          tuition_amount: 0,
          theory_duration_minutes: 0,
          status: 'active',
          created_by: 'admin-1',
          created_at: '2026-06-14T00:00:00.000Z',
          updated_at: '2026-06-14T00:00:00.000Z',
        },
        error: null,
      },
      { data: { id: 'course-1' }, error: null },
    ];

    const result = await archiveTrainingCourse('course-1');

    expect(result).toEqual({ success: true });
    expect(queryCalls[1]).toMatchObject({
      table: 'courses',
      operation: 'update',
      payload: expect.objectContaining({ status: 'archived' }),
      filters: [
        { type: 'eq', column: 'id', value: 'course-1' },
        { type: 'eq', column: 'tenant_id', value: 'tenant-1' },
      ],
    });
    expect(mockSafeRevalidatePath).toHaveBeenCalledWith('/dashboard/training/courses');
  });

  it('loads enrollment admin data through tenant-scoped queries', async () => {
    scriptedResults = [
      {
        data: [{
          id: 'course-1',
          tenant_id: 'tenant-1',
          module_key: 'student_training',
          title: 'Massage nền tảng',
          description: null,
          specialty: null,
          tuition_amount: 1200000,
          theory_duration_minutes: 90,
          status: 'active',
          created_by: 'admin-1',
          created_at: '2026-06-14T00:00:00.000Z',
          updated_at: '2026-06-14T00:00:00.000Z',
        }],
        error: null,
      },
      {
        data: [{
          id: 'student-user-1',
          tenant_id: 'tenant-1',
          full_name: 'Nguyễn Học Viên',
          email: 'student@example.com',
          phone: '0900000000',
          role: 'student',
          status: 'active',
        }],
        error: null,
      },
      {
        data: [{
          id: 'enrollment-1',
          tenant_id: 'tenant-1',
          user_id: 'student-user-1',
          course_id: 'course-1',
          enrollment_status: 'active',
          enrolled_at: '2026-06-14T00:00:00.000Z',
          tuition_total: 1200000,
          tuition_paid: 0,
          notes: null,
          created_at: '2026-06-14T00:00:00.000Z',
          updated_at: '2026-06-14T00:00:00.000Z',
        }],
        error: null,
      },
    ];

    const result = await getTrainingEnrollmentAdminOverview();

    expect(result.success).toBe(true);
    expect(result.success ? result.data.enrollments[0].user?.full_name : '').toBe('Nguyễn Học Viên');
    expect(queryCalls[0]).toMatchObject({
      table: 'courses',
      filters: [{ type: 'eq', column: 'tenant_id', value: 'tenant-1' }],
    });
    expect(queryCalls[1]).toMatchObject({
      table: 'users',
      filters: [
        { type: 'eq', column: 'tenant_id', value: 'tenant-1' },
        { type: 'eq', column: 'role', value: 'student' },
      ],
    });
    expect(queryCalls[2]).toMatchObject({
      table: 'students',
      filters: [{ type: 'eq', column: 'tenant_id', value: 'tenant-1' }],
    });
  });

  it('verifies course tenant ownership before creating an enrollment', async () => {
    scriptedResults = [
      { data: null, error: { message: 'course outside tenant' } },
    ];

    const result = await createTrainingEnrollment({
      userId: 'student-user-1',
      courseId: 'course-outside',
      tuitionTotal: '1200000',
      tuitionPaid: '0',
      enrollmentStatus: 'active',
    });

    expect(result).toEqual({ success: false, error: 'course outside tenant' });
    expect(queryCalls).toHaveLength(1);
    expect(queryCalls[0]).toMatchObject({
      table: 'courses',
      operation: 'select',
      filters: [
        { type: 'eq', column: 'id', value: 'course-outside' },
        { type: 'eq', column: 'tenant_id', value: 'tenant-1' },
      ],
    });
  });

  it('verifies selected user is a tenant student before creating an enrollment', async () => {
    scriptedResults = [
      {
        data: {
          id: 'course-1',
          tenant_id: 'tenant-1',
          module_key: 'student_training',
          title: 'Massage nền tảng',
          description: null,
          specialty: null,
          tuition_amount: 1200000,
          theory_duration_minutes: 90,
          status: 'active',
          created_by: 'admin-1',
          created_at: '2026-06-14T00:00:00.000Z',
          updated_at: '2026-06-14T00:00:00.000Z',
        },
        error: null,
      },
      { data: null, error: { message: 'student user outside tenant' } },
    ];

    const result = await createTrainingEnrollment({
      userId: 'staff-user-1',
      courseId: 'course-1',
      tuitionTotal: '1200000',
      tuitionPaid: '0',
      enrollmentStatus: 'active',
    });

    expect(result).toEqual({ success: false, error: 'student user outside tenant' });
    expect(queryCalls).toHaveLength(2);
    expect(queryCalls[1]).toMatchObject({
      table: 'users',
      operation: 'select',
      filters: [
        { type: 'eq', column: 'id', value: 'staff-user-1' },
        { type: 'eq', column: 'tenant_id', value: 'tenant-1' },
        { type: 'eq', column: 'role', value: 'student' },
      ],
    });
  });

  it('loads student portal data only for the current student user', async () => {
    grantStudent();
    scriptedResults = [
      {
        data: {
          id: 'student-user-1',
          tenant_id: 'tenant-1',
          full_name: 'Nguyễn Học Viên',
          email: 'student@example.com',
          phone: '0900000000',
          role: 'student',
          status: 'active',
        },
        error: null,
      },
      {
        data: [{
          id: 'enrollment-1',
          tenant_id: 'tenant-1',
          user_id: 'student-user-1',
          course_id: 'course-1',
          enrollment_status: 'active',
          enrolled_at: '2026-06-14T00:00:00.000Z',
          tuition_total: 1200000,
          tuition_paid: 200000,
          notes: null,
          created_at: '2026-06-14T00:00:00.000Z',
          updated_at: '2026-06-14T00:00:00.000Z',
        }],
        error: null,
      },
      {
        data: [{
          id: 'course-1',
          tenant_id: 'tenant-1',
          module_key: 'student_training',
          title: 'Massage nền tảng',
          description: 'Khóa cơ bản',
          specialty: null,
          tuition_amount: 1200000,
          theory_duration_minutes: 90,
          status: 'active',
          created_by: 'admin-1',
          created_at: '2026-06-14T00:00:00.000Z',
          updated_at: '2026-06-14T00:00:00.000Z',
        }],
        error: null,
      },
      {
        data: [{
          id: 'module-1',
          course_id: 'course-1',
          title: 'Chương 1',
          description: null,
          sequence_order: 1,
          created_at: '2026-06-14T00:00:00.000Z',
          updated_at: '2026-06-14T00:00:00.000Z',
        }],
        error: null,
      },
      {
        data: [{
          id: 'lesson-1',
          module_id: 'module-1',
          title: 'Bài nhập môn',
          content_type: 'document',
          content_url: null,
          body: null,
          sequence_order: 1,
          required_view_seconds: 60,
          required_view_percentage: 90,
          status: 'published',
          created_at: '2026-06-14T00:00:00.000Z',
          updated_at: '2026-06-14T00:00:00.000Z',
        }],
        error: null,
      },
    ];

    const result = await getStudentTrainingPortalOverview();

    expect(result.success).toBe(true);
    expect(result.success ? result.data.enrollments[0].course?.modules[0].lessons[0].title : '').toBe('Bài nhập môn');
    expect(mockGetAuthorizedTenantUser).toHaveBeenCalledWith({
      allowedRoles: ['student'],
      errorMessage: 'Không có quyền truy cập cổng học viên.',
    });
    expect(queryCalls[1]).toMatchObject({
      table: 'students',
      operation: 'select',
      filters: [
        { type: 'eq', column: 'tenant_id', value: 'tenant-1' },
        { type: 'eq', column: 'user_id', value: 'student-user-1' },
      ],
    });
  });

  it('marks a lesson complete only after verifying active enrollment ownership', async () => {
    grantStudent();
    scriptedResults = [
      {
        data: {
          id: 'student-user-1',
          tenant_id: 'tenant-1',
          full_name: 'Nguyễn Học Viên',
          email: 'student@example.com',
          phone: '0900000000',
          role: 'student',
          status: 'active',
        },
        error: null,
      },
      {
        data: {
          id: 'lesson-1',
          module_id: 'module-1',
          title: 'Bài nhập môn',
          content_type: 'document',
          content_url: null,
          body: null,
          sequence_order: 1,
          required_view_seconds: 60,
          required_view_percentage: 90,
          status: 'published',
          created_at: '2026-06-14T00:00:00.000Z',
          updated_at: '2026-06-14T00:00:00.000Z',
        },
        error: null,
      },
      {
        data: {
          id: 'module-1',
          course_id: 'course-1',
          title: 'Chương 1',
          description: null,
          sequence_order: 1,
          created_at: '2026-06-14T00:00:00.000Z',
          updated_at: '2026-06-14T00:00:00.000Z',
        },
        error: null,
      },
      {
        data: {
          id: 'course-1',
          tenant_id: 'tenant-1',
          module_key: 'student_training',
          title: 'Massage nền tảng',
          description: null,
          specialty: null,
          tuition_amount: 1200000,
          theory_duration_minutes: 90,
          status: 'active',
          created_by: 'admin-1',
          created_at: '2026-06-14T00:00:00.000Z',
          updated_at: '2026-06-14T00:00:00.000Z',
        },
        error: null,
      },
      {
        data: [{
          id: 'enrollment-1',
          tenant_id: 'tenant-1',
          user_id: 'student-user-1',
          course_id: 'course-1',
          enrollment_status: 'active',
          enrolled_at: '2026-06-14T00:00:00.000Z',
          tuition_total: 1200000,
          tuition_paid: 0,
          notes: null,
          created_at: '2026-06-14T00:00:00.000Z',
          updated_at: '2026-06-14T00:00:00.000Z',
        }],
        error: null,
      },
      { data: null, error: { message: 'No rows found' } },
      {
        data: {
          id: 'progress-1',
          tenant_id: 'tenant-1',
          student_id: 'enrollment-1',
          lesson_id: 'lesson-1',
          time_spent_seconds: 0,
          view_percentage: 100,
          is_completed: true,
          completed_at: '2026-06-14T00:00:00.000Z',
          last_accessed_at: '2026-06-14T00:00:00.000Z',
          created_at: '2026-06-14T00:00:00.000Z',
          updated_at: '2026-06-14T00:00:00.000Z',
        },
        error: null,
      },
    ];

    const result = await markStudentLessonComplete('lesson-1');

    expect(result.success).toBe(true);
    expect(queryCalls[4]).toMatchObject({
      table: 'students',
      operation: 'select',
      filters: [
        { type: 'eq', column: 'tenant_id', value: 'tenant-1' },
        { type: 'eq', column: 'user_id', value: 'student-user-1' },
        { type: 'eq', column: 'course_id', value: 'course-1' },
        { type: 'eq', column: 'enrollment_status', value: 'active' },
      ],
    });
    expect(queryCalls[6]).toMatchObject({
      table: 'student_lesson_progress',
      operation: 'insert',
      payload: [expect.objectContaining({
        tenant_id: 'tenant-1',
        student_id: 'enrollment-1',
        lesson_id: 'lesson-1',
        is_completed: true,
        view_percentage: 100,
      })],
    });
    expect(mockSafeRevalidatePath).toHaveBeenCalledWith('/student/dashboard');
  });

  it('does not write lesson progress when the lesson is outside active enrollment', async () => {
    grantStudent();
    scriptedResults = [
      {
        data: {
          id: 'student-user-1',
          tenant_id: 'tenant-1',
          full_name: 'Nguyễn Học Viên',
          email: 'student@example.com',
          phone: '0900000000',
          role: 'student',
          status: 'active',
        },
        error: null,
      },
      {
        data: {
          id: 'lesson-1',
          module_id: 'module-1',
          title: 'Bài nhập môn',
          content_type: 'document',
          content_url: null,
          body: null,
          sequence_order: 1,
          required_view_seconds: 60,
          required_view_percentage: 90,
          status: 'published',
          created_at: '2026-06-14T00:00:00.000Z',
          updated_at: '2026-06-14T00:00:00.000Z',
        },
        error: null,
      },
      {
        data: {
          id: 'module-1',
          course_id: 'course-outside-active-enrollment',
          title: 'Chương 1',
          description: null,
          sequence_order: 1,
          created_at: '2026-06-14T00:00:00.000Z',
          updated_at: '2026-06-14T00:00:00.000Z',
        },
        error: null,
      },
      {
        data: {
          id: 'course-outside-active-enrollment',
          tenant_id: 'tenant-1',
          module_key: 'student_training',
          title: 'Khóa khác',
          description: null,
          specialty: null,
          tuition_amount: 1200000,
          theory_duration_minutes: 90,
          status: 'active',
          created_by: 'admin-1',
          created_at: '2026-06-14T00:00:00.000Z',
          updated_at: '2026-06-14T00:00:00.000Z',
        },
        error: null,
      },
      { data: [], error: null },
    ];

    const result = await markStudentLessonComplete('lesson-1');

    expect(result).toEqual({
      success: false,
      error: 'Bài học không thuộc khóa học đang ghi danh của học viên hiện tại.',
    });
    expect(queryCalls).toHaveLength(5);
    expect(queryCalls.some((call) => call.table === 'student_lesson_progress' && call.operation === 'insert')).toBe(false);
    expect(mockSafeRevalidatePath).not.toHaveBeenCalledWith('/student/dashboard');
  });

  it('loads training class admin data through tenant-scoped queries', async () => {
    scriptedResults = [
      {
        data: [{
          id: 'course-1',
          tenant_id: 'tenant-1',
          module_key: 'student_training',
          title: 'Massage nền tảng',
          description: null,
          specialty: null,
          tuition_amount: 1200000,
          theory_duration_minutes: 90,
          status: 'active',
          created_by: 'admin-1',
          created_at: '2026-06-14T00:00:00.000Z',
          updated_at: '2026-06-14T00:00:00.000Z',
        }],
        error: null,
      },
      {
        data: [{
          id: 'trainer-1',
          tenant_id: 'tenant-1',
          full_name: 'Giảng viên A',
          email: 'trainer@example.com',
          phone: null,
          role: 'ktv_lead',
          status: 'active',
        }],
        error: null,
      },
      {
        data: [{
          id: 'class-1',
          tenant_id: 'tenant-1',
          course_id: 'course-1',
          trainer_id: 'trainer-1',
          title: 'Buổi thực hành 1',
          class_type: 'practice',
          starts_at: '2026-06-14T08:00:00.000Z',
          ends_at: null,
          location_note: 'Phòng 1',
          capacity: 12,
          status: 'scheduled',
          created_at: '2026-06-14T00:00:00.000Z',
          updated_at: '2026-06-14T00:00:00.000Z',
        }],
        error: null,
      },
    ];

    const result = await getTrainingClassAdminOverview();

    expect(result.success).toBe(true);
    expect(result.success ? result.data.classes[0].course?.title : '').toBe('Massage nền tảng');
    expect(queryCalls[0]).toMatchObject({
      table: 'courses',
      filters: [{ type: 'eq', column: 'tenant_id', value: 'tenant-1' }],
    });
    expect(queryCalls[1]).toMatchObject({
      table: 'users',
      filters: [
        { type: 'eq', column: 'tenant_id', value: 'tenant-1' },
        { type: 'in', column: 'role', value: ['admin', 'super_admin', 'admin_staff', 'hr', 'ktv_lead', 'ktv'] },
      ],
    });
    expect(queryCalls[2]).toMatchObject({
      table: 'training_classes',
      filters: [{ type: 'eq', column: 'tenant_id', value: 'tenant-1' }],
    });
  });

  it('verifies course tenant ownership before creating a training class', async () => {
    scriptedResults = [
      { data: null, error: { message: 'course outside tenant' } },
    ];

    const result = await createTrainingClass({
      courseId: 'course-outside',
      title: 'Buổi sai tenant',
      classType: 'practice',
      startsAt: '2026-06-14T08:00:00.000Z',
      capacity: '12',
      status: 'scheduled',
    });

    expect(result).toEqual({ success: false, error: 'course outside tenant' });
    expect(queryCalls).toHaveLength(1);
    expect(queryCalls[0]).toMatchObject({
      table: 'courses',
      operation: 'select',
      filters: [
        { type: 'eq', column: 'id', value: 'course-outside' },
        { type: 'eq', column: 'tenant_id', value: 'tenant-1' },
      ],
    });
  });

  it('loads student account admin data through tenant-scoped role queries', async () => {
    scriptedResults = [
      {
        data: [{
          id: 'student-user-1',
          tenant_id: 'tenant-1',
          full_name: 'Nguyễn Học Viên',
          email: 'student@example.com',
          phone: null,
          role: 'student',
          status: 'active',
        }],
        error: null,
      },
    ];

    const result = await getTrainingStudentAccountOverview();

    expect(result.success).toBe(true);
    expect(result.success ? result.data.studentUsers[0].role : '').toBe('student');
    expect(queryCalls[0]).toMatchObject({
      table: 'users',
      operation: 'select',
      filters: [
        { type: 'eq', column: 'tenant_id', value: 'tenant-1' },
        { type: 'eq', column: 'role', value: 'student' },
      ],
    });
  });

  it('creates student accounts through the central user action with forced student role', async () => {
    const result = await createTrainingStudentAccount({
      fullName: ' Học Viên Mới ',
      email: ' STUDENT-NEW@EXAMPLE.COM ',
    });

    expect(result.success).toBe(true);
    expect(mockCreateUser).toHaveBeenCalledWith({
      full_name: 'Học Viên Mới',
      email: 'student-new@example.com',
      role: 'student',
    });
    expect(mockSafeRevalidatePath).toHaveBeenCalledWith('/dashboard/training/students');
    expect(mockSafeRevalidatePath).toHaveBeenCalledWith('/dashboard/training/enrollments');
  });

  it('rejects invalid student account input before creating auth users', async () => {
    const result = await createTrainingStudentAccount({
      fullName: '',
      email: 'bad-email',
    });

    expect(result).toEqual({ success: false, error: 'Vui lòng nhập tên học viên.' });
    expect(mockCreateUser).not.toHaveBeenCalled();
  });
});
