jest.mock('server-only', () => ({}), { virtual: true });

const mockGetAuthorizedTenantUser = jest.fn();
const mockCreateDevelopmentBypassClient = jest.fn();
const mockSafeRevalidatePath = jest.fn();

jest.mock('@/services/auth-guards', () => ({
  getAuthorizedTenantUser: (options: unknown) => mockGetAuthorizedTenantUser(options),
}));

jest.mock('@/lib/supabase-dev-bypass-server', () => ({
  createDevelopmentBypassClient: () => mockCreateDevelopmentBypassClient(),
}));

jest.mock('@/lib/revalidate', () => ({
  safeRevalidatePath: (path: string) => mockSafeRevalidatePath(path),
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
  createTrainingCourse,
  getTrainingAdminOverview,
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

describe('training actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryCalls.length = 0;
    scriptedResults = [];
    grantAdmin();
    mockCreateDevelopmentBypassClient.mockResolvedValue(mockDb);
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
});
