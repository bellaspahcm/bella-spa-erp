'use server';

import { createDevelopmentBypassClient } from '@/lib/supabase-dev-bypass-server';
import { safeRevalidatePath } from '@/lib/revalidate';
import { getAuthorizedTenantUser } from './auth-guards';
import { createUser } from '@/services/user-actions';
import type {
  TrainingContentType,
  TrainingClassAdminOverview,
  TrainingClassInput,
  TrainingClassInsert,
  TrainingClassRow,
  TrainingClassStatus,
  TrainingClassType,
  TrainingClassUpdate,
  TrainingClassWithDetails,
  TrainingEnrollmentAdminOverview,
  TrainingEnrollmentInput,
  TrainingEnrollmentStatus,
  TrainingCourseInput,
  TrainingCourseInsert,
  TrainingCourseModuleInput,
  TrainingCourseModuleInsert,
  TrainingCourseModuleRow,
  TrainingCourseModuleUpdate,
  TrainingCourseRow,
  TrainingCourseStatus,
  TrainingCourseUpdate,
  TrainingCourseWithContent,
  TrainingLessonInput,
  TrainingLessonInsert,
  TrainingLessonRow,
  TrainingLessonStatus,
  TrainingLessonUpdate,
  TrainingStudentEnrollmentInsert,
  TrainingStudentEnrollmentRow,
  TrainingStudentEnrollmentUpdate,
  TrainingStudentEnrollmentWithDetails,
  TrainingStudentLessonProgressInsert,
  TrainingStudentLessonProgressRow,
  TrainingStudentLessonProgressUpdate,
  TrainingStudentAccountInput,
  TrainingStudentAccountOverview,
  TrainingStudentPortalOverview,
  TrainingStudentUserRow,
} from '@/types/training';

type DbError = { message: string };
type QueryResult<T> = { data: T | null; error: DbError | null };
type QueryListResult<T> = { data: T[] | null; error: DbError | null };

type TrainingTableMap = {
  courses: {
    Row: TrainingCourseRow;
    Insert: TrainingCourseInsert;
    Update: TrainingCourseUpdate;
  };
  course_modules: {
    Row: TrainingCourseModuleRow;
    Insert: TrainingCourseModuleInsert;
    Update: TrainingCourseModuleUpdate;
  };
  lessons: {
    Row: TrainingLessonRow;
    Insert: TrainingLessonInsert;
    Update: TrainingLessonUpdate;
  };
  training_classes: {
    Row: TrainingClassRow;
    Insert: TrainingClassInsert;
    Update: TrainingClassUpdate;
  };
  students: {
    Row: TrainingStudentEnrollmentRow;
    Insert: TrainingStudentEnrollmentInsert;
    Update: TrainingStudentEnrollmentUpdate;
  };
  student_lesson_progress: {
    Row: TrainingStudentLessonProgressRow;
    Insert: TrainingStudentLessonProgressInsert;
    Update: TrainingStudentLessonProgressUpdate;
  };
  users: {
    Row: TrainingStudentUserRow;
    Insert: TrainingStudentUserRow;
    Update: Partial<TrainingStudentUserRow>;
  };
};

type OrderOptions = { ascending?: boolean };

type TrainingSelectBuilder<T> = PromiseLike<QueryListResult<T>> & {
  eq(column: string, value: unknown): TrainingSelectBuilder<T>;
  in(column: string, values: readonly unknown[]): TrainingSelectBuilder<T>;
  order(column: string, options?: OrderOptions): TrainingSelectBuilder<T>;
  single(): Promise<QueryResult<T>>;
};

type TrainingMutationBuilder<T> = {
  eq(column: string, value: unknown): TrainingMutationBuilder<T>;
  select(columns?: string): TrainingSelectBuilder<T>;
  single(): Promise<QueryResult<T>>;
};

type TrainingDeleteBuilder = PromiseLike<QueryResult<null>> & {
  eq(column: string, value: unknown): TrainingDeleteBuilder;
};

type TrainingTableClient<T extends keyof TrainingTableMap> = {
  select(columns?: string): TrainingSelectBuilder<TrainingTableMap[T]['Row']>;
  insert(payload: readonly TrainingTableMap[T]['Insert'][]): {
    select(columns?: string): TrainingSelectBuilder<TrainingTableMap[T]['Row']>;
  };
  update(payload: TrainingTableMap[T]['Update']): TrainingMutationBuilder<TrainingTableMap[T]['Row']>;
  delete(): TrainingDeleteBuilder;
};

type TrainingDataClient = {
  from<T extends keyof TrainingTableMap>(table: T): TrainingTableClient<T>;
};

type TrainingActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };
type TrainingDeleteResult =
  | { success: true }
  | { success: false; error: string };

const TRAINING_READ_ROLES = ['admin', 'super_admin', 'admin_staff', 'hr'] as const;
const TRAINING_MANAGE_ROLES = ['admin', 'super_admin'] as const;
const TRAINING_STUDENT_ROLES = ['student'] as const;
const TRAINING_AUTH_ERROR = 'Không có quyền quản lý đào tạo học viên.';
const TRAINING_STUDENT_AUTH_ERROR = 'Không có quyền truy cập cổng học viên.';
const COURSE_NOT_FOUND = 'Không tìm thấy khóa học đào tạo trong chi nhánh hiện tại.';
const MODULE_NOT_FOUND = 'Không tìm thấy chương học trong chi nhánh hiện tại.';
const LESSON_NOT_FOUND = 'Không tìm thấy bài học trong chi nhánh hiện tại.';
const STUDENT_USER_NOT_FOUND = 'Không tìm thấy tài khoản học viên trong chi nhánh hiện tại.';
const ENROLLMENT_NOT_FOUND = 'Không tìm thấy hồ sơ ghi danh trong chi nhánh hiện tại.';
const ACTIVE_ENROLLMENT_NOT_FOUND = 'Bài học không thuộc khóa học đang ghi danh của học viên hiện tại.';
const CLASS_NOT_FOUND = 'Không tìm thấy lịch lớp trong chi nhánh hiện tại.';

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function cleanNullableText(value: unknown, maxLength: number) {
  const text = cleanText(value, maxLength);
  return text || null;
}

function parseNonNegativeNumber(value: unknown, fallback: number) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(/[,\s]/g, ''));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : NaN;
}

function parsePositiveInteger(value: unknown, fallback: number) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(/[,\s]/g, ''));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : NaN;
}

function isCourseStatus(value: unknown): value is TrainingCourseStatus {
  return value === 'draft' || value === 'active' || value === 'archived';
}

function isLessonStatus(value: unknown): value is TrainingLessonStatus {
  return value === 'draft' || value === 'published' || value === 'archived';
}

function isEnrollmentStatus(value: unknown): value is TrainingEnrollmentStatus {
  return value === 'active' || value === 'paused' || value === 'graduated' || value === 'withdrawn';
}

function isClassType(value: unknown): value is TrainingClassType {
  return value === 'theory' || value === 'practice' || value === 'exam' || value === 'orientation';
}

function isClassStatus(value: unknown): value is TrainingClassStatus {
  return value === 'scheduled' || value === 'completed' || value === 'cancelled';
}

function isContentType(value: unknown): value is TrainingContentType {
  return value === 'document'
    || value === 'video'
    || value === 'pdf'
    || value === 'quiz'
    || value === 'live_class';
}

function parseIsoDate(value: unknown) {
  const text = cleanText(value, 80);
  if (!text) return '';
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function buildClassPayload(
  input: TrainingClassInput,
  tenantId: string,
): TrainingActionResult<TrainingClassInsert> {
  const courseId = cleanText(input.courseId, 80);
  const trainerId = cleanNullableText(input.trainerId, 80);
  const title = cleanText(input.title, 160);
  const startsAt = parseIsoDate(input.startsAt);
  const endsAt = input.endsAt ? parseIsoDate(input.endsAt) : null;
  const capacity = parsePositiveInteger(input.capacity, 12);

  if (!courseId) return { success: false, error: 'Vui lòng chọn khóa học cho lớp.' };
  if (!title) return { success: false, error: 'Vui lòng nhập tên buổi học.' };
  if (!startsAt) return { success: false, error: 'Thời gian bắt đầu không hợp lệ.' };
  if (input.endsAt && !endsAt) return { success: false, error: 'Thời gian kết thúc không hợp lệ.' };
  if (endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    return { success: false, error: 'Thời gian kết thúc phải sau thời gian bắt đầu.' };
  }
  if (Number.isNaN(capacity)) return { success: false, error: 'Sức chứa lớp không hợp lệ.' };

  return {
    success: true,
    data: {
      tenant_id: tenantId,
      course_id: courseId,
      trainer_id: trainerId,
      title,
      class_type: isClassType(input.classType) ? input.classType : 'practice',
      starts_at: startsAt,
      ends_at: endsAt,
      location_note: cleanNullableText(input.locationNote, 500),
      capacity,
      status: isClassStatus(input.status) ? input.status : 'scheduled',
    },
  };
}

function buildStudentAccountPayload(input: TrainingStudentAccountInput) {
  const fullName = cleanText(input.fullName, 160);
  const email = cleanText(input.email, 180).toLowerCase();
  const phone = cleanNullableText(input.phone, 40);

  if (!fullName) return { success: false as const, error: 'Vui lòng nhập tên học viên.' };
  if (!email || !email.includes('@')) return { success: false as const, error: 'Email học viên không hợp lệ.' };

  return {
    success: true as const,
    data: { fullName, email, phone },
  };
}

function buildEnrollmentPayload(
  input: TrainingEnrollmentInput,
  tenantId: string,
): TrainingActionResult<TrainingStudentEnrollmentInsert> {
  const userId = cleanText(input.userId, 80);
  const courseId = cleanText(input.courseId, 80);
  const tuitionTotal = parseNonNegativeNumber(input.tuitionTotal, 0);
  const tuitionPaid = parseNonNegativeNumber(input.tuitionPaid, 0);

  if (!userId) return { success: false, error: 'Vui lòng chọn học viên.' };
  if (!courseId) return { success: false, error: 'Vui lòng chọn khóa học.' };
  if (Number.isNaN(tuitionTotal)) return { success: false, error: 'Tổng học phí không hợp lệ.' };
  if (Number.isNaN(tuitionPaid)) return { success: false, error: 'Số tiền đã thu không hợp lệ.' };
  if (tuitionPaid > tuitionTotal) {
    return { success: false, error: 'Số tiền đã thu không được lớn hơn tổng học phí.' };
  }

  return {
    success: true,
    data: {
      tenant_id: tenantId,
      user_id: userId,
      course_id: courseId,
      enrollment_status: isEnrollmentStatus(input.enrollmentStatus) ? input.enrollmentStatus : 'active',
      tuition_total: tuitionTotal,
      tuition_paid: tuitionPaid,
      notes: cleanNullableText(input.notes, 2000),
    },
  };
}

function buildCoursePayload(
  input: TrainingCourseInput,
  context: { tenantId: string; userId?: string | null },
): TrainingActionResult<TrainingCourseInsert> {
  const title = cleanText(input.title, 160);
  if (!title) {
    return { success: false, error: 'Vui lòng nhập tên khóa học.' };
  }

  const tuitionAmount = parseNonNegativeNumber(input.tuitionAmount, 0);
  if (Number.isNaN(tuitionAmount)) {
    return { success: false, error: 'Học phí khóa học không hợp lệ.' };
  }

  const theoryDurationMinutes = parseNonNegativeNumber(input.theoryDurationMinutes, 0);
  if (Number.isNaN(theoryDurationMinutes) || !Number.isInteger(theoryDurationMinutes)) {
    return { success: false, error: 'Thời lượng lý thuyết phải là số phút hợp lệ.' };
  }

  const status = isCourseStatus(input.status) ? input.status : 'draft';

  return {
    success: true,
    data: {
      tenant_id: context.tenantId,
      module_key: 'student_training',
      title,
      description: cleanNullableText(input.description, 2000),
      specialty: cleanNullableText(input.specialty, 120),
      tuition_amount: tuitionAmount,
      theory_duration_minutes: theoryDurationMinutes,
      status,
      created_by: context.userId || null,
    },
  };
}

function buildModulePayload(input: TrainingCourseModuleInput): TrainingActionResult<TrainingCourseModuleInsert> {
  const courseId = cleanText(input.courseId, 80);
  const title = cleanText(input.title, 160);
  const sequenceOrder = parsePositiveInteger(input.sequenceOrder, 1);

  if (!courseId) return { success: false, error: 'Thiếu khóa học cần thêm chương.' };
  if (!title) return { success: false, error: 'Vui lòng nhập tên chương học.' };
  if (Number.isNaN(sequenceOrder)) return { success: false, error: 'Thứ tự chương học không hợp lệ.' };

  return {
    success: true,
    data: {
      course_id: courseId,
      title,
      description: cleanNullableText(input.description, 2000),
      sequence_order: sequenceOrder,
    },
  };
}

function buildLessonPayload(input: TrainingLessonInput): TrainingActionResult<TrainingLessonInsert> {
  const moduleId = cleanText(input.moduleId, 80);
  const title = cleanText(input.title, 160);
  const sequenceOrder = parsePositiveInteger(input.sequenceOrder, 1);
  const requiredViewSeconds = parseNonNegativeNumber(input.requiredViewSeconds, 0);
  const requiredViewPercentage = parseNonNegativeNumber(input.requiredViewPercentage, 90);

  if (!moduleId) return { success: false, error: 'Thiếu chương học cần thêm bài.' };
  if (!title) return { success: false, error: 'Vui lòng nhập tên bài học.' };
  if (Number.isNaN(sequenceOrder)) return { success: false, error: 'Thứ tự bài học không hợp lệ.' };
  if (Number.isNaN(requiredViewSeconds) || !Number.isInteger(requiredViewSeconds)) {
    return { success: false, error: 'Thời lượng xem bắt buộc phải là số giây hợp lệ.' };
  }
  if (Number.isNaN(requiredViewPercentage) || requiredViewPercentage > 100) {
    return { success: false, error: 'Phần trăm xem bắt buộc phải nằm trong khoảng 0-100.' };
  }

  return {
    success: true,
    data: {
      module_id: moduleId,
      title,
      content_type: isContentType(input.contentType) ? input.contentType : 'document',
      content_url: cleanNullableText(input.contentUrl, 500),
      body: cleanNullableText(input.body, 8000),
      sequence_order: sequenceOrder,
      required_view_seconds: requiredViewSeconds,
      required_view_percentage: requiredViewPercentage,
      status: isLessonStatus(input.status) ? input.status : 'draft',
    },
  };
}

async function getTrainingClient(): Promise<TrainingDataClient> {
  return (await createDevelopmentBypassClient()) as unknown as TrainingDataClient;
}

async function assertCourseBelongsToTenant(
  db: TrainingDataClient,
  courseId: string,
  tenantId: string,
): Promise<TrainingActionResult<TrainingCourseRow>> {
  const { data, error } = await db
    .from('courses')
    .select('*')
    .eq('id', courseId)
    .eq('tenant_id', tenantId)
    .single();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: COURSE_NOT_FOUND };
  return { success: true, data };
}

async function assertModuleBelongsToTenant(
  db: TrainingDataClient,
  moduleId: string,
  tenantId: string,
): Promise<TrainingActionResult<TrainingCourseModuleRow>> {
  const { data, error } = await db
    .from('course_modules')
    .select('*')
    .eq('id', moduleId)
    .single();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: MODULE_NOT_FOUND };

  const courseResult = await assertCourseBelongsToTenant(db, data.course_id, tenantId);
  if (!courseResult.success) return { success: false, error: courseResult.error };
  return { success: true, data };
}

async function assertLessonBelongsToTenant(
  db: TrainingDataClient,
  lessonId: string,
  tenantId: string,
): Promise<TrainingActionResult<TrainingLessonRow>> {
  const { data, error } = await db
    .from('lessons')
    .select('*')
    .eq('id', lessonId)
    .single();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: LESSON_NOT_FOUND };

  const moduleResult = await assertModuleBelongsToTenant(db, data.module_id, tenantId);
  if (!moduleResult.success) return { success: false, error: moduleResult.error };
  return { success: true, data };
}

async function assertStudentUserBelongsToTenant(
  db: TrainingDataClient,
  userId: string,
  tenantId: string,
): Promise<TrainingActionResult<TrainingStudentUserRow>> {
  const { data, error } = await db
    .from('users')
    .select('id, tenant_id, full_name, email, phone, role, status')
    .eq('id', userId)
    .eq('tenant_id', tenantId)
    .eq('role', 'student')
    .single();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: STUDENT_USER_NOT_FOUND };
  return { success: true, data };
}

async function assertEnrollmentBelongsToTenant(
  db: TrainingDataClient,
  enrollmentId: string,
  tenantId: string,
): Promise<TrainingActionResult<TrainingStudentEnrollmentRow>> {
  const { data, error } = await db
    .from('students')
    .select('*')
    .eq('id', enrollmentId)
    .eq('tenant_id', tenantId)
    .single();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: ENROLLMENT_NOT_FOUND };
  return { success: true, data };
}

async function assertTrainerBelongsToTenant(
  db: TrainingDataClient,
  trainerId: string | null | undefined,
  tenantId: string,
): Promise<TrainingActionResult<TrainingStudentUserRow | null>> {
  if (!trainerId) return { success: true, data: null };

  const { data, error } = await db
    .from('users')
    .select('id, tenant_id, full_name, email, phone, role, status')
    .eq('id', trainerId)
    .eq('tenant_id', tenantId)
    .single();

  if (error) return { success: false, error: error.message };
  if (!data || data.role === 'student') {
    return { success: false, error: 'Không tìm thấy giảng viên hợp lệ trong chi nhánh hiện tại.' };
  }
  return { success: true, data };
}

async function assertClassBelongsToTenant(
  db: TrainingDataClient,
  classId: string,
  tenantId: string,
): Promise<TrainingActionResult<TrainingClassRow>> {
  const { data, error } = await db
    .from('training_classes')
    .select('*')
    .eq('id', classId)
    .eq('tenant_id', tenantId)
    .single();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: CLASS_NOT_FOUND };
  return { success: true, data };
}

function buildCourseTree(input: {
  courses: TrainingCourseRow[];
  modules: TrainingCourseModuleRow[];
  lessons: TrainingLessonRow[];
}): TrainingCourseWithContent[] {
  const lessonsByModule = new Map<string, TrainingLessonRow[]>();
  for (const lesson of input.lessons) {
    const current = lessonsByModule.get(lesson.module_id) || [];
    current.push(lesson);
    lessonsByModule.set(lesson.module_id, current);
  }

  const modulesByCourse = new Map<string, TrainingCourseWithContent['modules']>();
  for (const courseModule of input.modules) {
    const current = modulesByCourse.get(courseModule.course_id) || [];
    current.push({
      ...courseModule,
      lessons: lessonsByModule.get(courseModule.id) || [],
    });
    modulesByCourse.set(courseModule.course_id, current);
  }

  return input.courses.map((course) => ({
    ...course,
    modules: modulesByCourse.get(course.id) || [],
  }));
}

function buildEnrollmentDetails(input: {
  enrollments: TrainingStudentEnrollmentRow[];
  courses: TrainingCourseRow[];
  studentUsers: TrainingStudentUserRow[];
}): TrainingStudentEnrollmentWithDetails[] {
  const coursesById = new Map(input.courses.map((course) => [course.id, course]));
  const usersById = new Map(input.studentUsers.map((user) => [user.id, user]));

  return input.enrollments.map((enrollment) => {
    const course = coursesById.get(enrollment.course_id);
    return {
      ...enrollment,
      user: usersById.get(enrollment.user_id) || null,
      course: course
        ? {
          id: course.id,
          title: course.title,
          status: course.status,
          tuition_amount: course.tuition_amount,
        }
        : null,
    };
  });
}

function buildClassDetails(input: {
  classes: TrainingClassRow[];
  courses: TrainingCourseRow[];
  trainers: TrainingStudentUserRow[];
}): TrainingClassWithDetails[] {
  const coursesById = new Map(input.courses.map((course) => [course.id, course]));
  const trainersById = new Map(input.trainers.map((trainer) => [trainer.id, trainer]));

  return input.classes.map((trainingClass) => {
    const course = coursesById.get(trainingClass.course_id);
    const trainer = trainingClass.trainer_id ? trainersById.get(trainingClass.trainer_id) : null;
    return {
      ...trainingClass,
      course: course ? { id: course.id, title: course.title, status: course.status } : null,
      trainer: trainer ? {
        id: trainer.id,
        full_name: trainer.full_name,
        email: trainer.email,
        role: trainer.role,
      } : null,
    };
  });
}

function attachProgressToCourseTree(input: {
  courses: TrainingCourseRow[];
  modules: TrainingCourseModuleRow[];
  lessons: TrainingLessonRow[];
  progresses: TrainingStudentLessonProgressRow[];
}) {
  const progressByLessonId = new Map(input.progresses.map((progress) => [progress.lesson_id, progress]));
  return buildCourseTree(input).map((course) => ({
    ...course,
    modules: course.modules.map((courseModule) => ({
      ...courseModule,
      lessons: courseModule.lessons.map((lesson) => ({
        ...lesson,
        progress: progressByLessonId.get(lesson.id) || null,
      })),
    })),
  }));
}

export async function getTrainingAdminOverview(): Promise<TrainingActionResult<TrainingCourseWithContent[]>> {
  const auth = await getAuthorizedTenantUser({
    allowedRoles: TRAINING_READ_ROLES,
    errorMessage: TRAINING_AUTH_ERROR,
  });
  if (!auth.ok) return { success: false, error: auth.error };

  const db = await getTrainingClient();
  const { data: courses, error: coursesError } = await db
    .from('courses')
    .select('*')
    .eq('tenant_id', auth.tenantId)
    .order('status', { ascending: true })
    .order('created_at', { ascending: false });

  if (coursesError) return { success: false, error: coursesError.message };
  const courseRows = courses || [];
  if (courseRows.length === 0) return { success: true, data: [] };

  const courseIds = courseRows.map((course) => course.id);
  const { data: modules, error: modulesError } = await db
    .from('course_modules')
    .select('*')
    .in('course_id', courseIds)
    .order('sequence_order', { ascending: true });

  if (modulesError) return { success: false, error: modulesError.message };
  const moduleRows = modules || [];
  const moduleIds = moduleRows.map((moduleRow) => moduleRow.id);
  const lessonResult: QueryListResult<TrainingLessonRow> = moduleIds.length === 0
    ? { data: [], error: null }
    : await db
      .from('lessons')
      .select('*')
      .in('module_id', moduleIds)
      .order('sequence_order', { ascending: true });

  if (lessonResult.error) return { success: false, error: lessonResult.error.message };
  return {
    success: true,
    data: buildCourseTree({ courses: courseRows, modules: moduleRows, lessons: lessonResult.data || [] }),
  };
}

export async function getTrainingEnrollmentAdminOverview(): Promise<TrainingActionResult<TrainingEnrollmentAdminOverview>> {
  const auth = await getAuthorizedTenantUser({
    allowedRoles: TRAINING_READ_ROLES,
    errorMessage: TRAINING_AUTH_ERROR,
  });
  if (!auth.ok) return { success: false, error: auth.error };

  const db = await getTrainingClient();
  const { data: courses, error: coursesError } = await db
    .from('courses')
    .select('*')
    .eq('tenant_id', auth.tenantId)
    .order('created_at', { ascending: false });

  if (coursesError) return { success: false, error: coursesError.message };

  const { data: studentUsers, error: usersError } = await db
    .from('users')
    .select('id, tenant_id, full_name, email, phone, role, status')
    .eq('tenant_id', auth.tenantId)
    .eq('role', 'student')
    .order('full_name', { ascending: true });

  if (usersError) return { success: false, error: usersError.message };

  const { data: enrollments, error: enrollmentsError } = await db
    .from('students')
    .select('*')
    .eq('tenant_id', auth.tenantId)
    .order('created_at', { ascending: false });

  if (enrollmentsError) return { success: false, error: enrollmentsError.message };

  const courseRows = courses || [];
  const studentUserRows = studentUsers || [];
  const enrollmentRows = enrollments || [];

  return {
    success: true,
    data: {
      courses: courseRows,
      studentUsers: studentUserRows,
      enrollments: buildEnrollmentDetails({
        courses: courseRows,
        studentUsers: studentUserRows,
        enrollments: enrollmentRows,
      }),
    },
  };
}

export async function getTrainingStudentAccountOverview(): Promise<TrainingActionResult<TrainingStudentAccountOverview>> {
  const auth = await getAuthorizedTenantUser({
    allowedRoles: TRAINING_READ_ROLES,
    errorMessage: TRAINING_AUTH_ERROR,
  });
  if (!auth.ok) return { success: false, error: auth.error };

  const db = await getTrainingClient();
  const { data, error } = await db
    .from('users')
    .select('id, tenant_id, full_name, email, phone, role, status')
    .eq('tenant_id', auth.tenantId)
    .eq('role', 'student')
    .order('created_at', { ascending: false });

  if (error) return { success: false, error: error.message };
  return {
    success: true,
    data: { studentUsers: data || [] },
  };
}

export async function createTrainingStudentAccount(
  input: TrainingStudentAccountInput,
): Promise<TrainingActionResult<{ user: TrainingStudentUserRow; defaultPassword: string }>> {
  const auth = await getAuthorizedTenantUser({
    allowedRoles: TRAINING_MANAGE_ROLES,
    errorMessage: TRAINING_AUTH_ERROR,
  });
  if (!auth.ok) return { success: false, error: auth.error };

  const payload = buildStudentAccountPayload(input);
  if (!payload.success) return payload;

  const result = await createUser({
    full_name: payload.data.fullName,
    email: payload.data.email,
    role: 'student',
  });

  if ('error' in result && result.error) {
    return { success: false, error: result.error };
  }
  if (!('data' in result) || !result.data || !('defaultPassword' in result) || !result.defaultPassword) {
    return { success: false, error: 'Không xác định được tài khoản học viên vừa tạo.' };
  }

  safeRevalidatePath('/dashboard/training/students');
  safeRevalidatePath('/dashboard/training/enrollments');
  return {
    success: true,
    data: {
      user: result.data as unknown as TrainingStudentUserRow,
      defaultPassword: result.defaultPassword,
    },
  };
}

export async function getTrainingClassAdminOverview(): Promise<TrainingActionResult<TrainingClassAdminOverview>> {
  const auth = await getAuthorizedTenantUser({
    allowedRoles: TRAINING_READ_ROLES,
    errorMessage: TRAINING_AUTH_ERROR,
  });
  if (!auth.ok) return { success: false, error: auth.error };

  const db = await getTrainingClient();
  const { data: courses, error: coursesError } = await db
    .from('courses')
    .select('*')
    .eq('tenant_id', auth.tenantId)
    .order('created_at', { ascending: false });

  if (coursesError) return { success: false, error: coursesError.message };

  const { data: trainers, error: trainersError } = await db
    .from('users')
    .select('id, tenant_id, full_name, email, phone, role, status')
    .eq('tenant_id', auth.tenantId)
    .in('role', ['admin', 'super_admin', 'admin_staff', 'hr', 'ktv_lead', 'ktv'])
    .order('full_name', { ascending: true });

  if (trainersError) return { success: false, error: trainersError.message };

  const { data: classes, error: classesError } = await db
    .from('training_classes')
    .select('*')
    .eq('tenant_id', auth.tenantId)
    .order('starts_at', { ascending: false });

  if (classesError) return { success: false, error: classesError.message };

  const courseRows = courses || [];
  const trainerRows = trainers || [];
  return {
    success: true,
    data: {
      courses: courseRows,
      trainers: trainerRows,
      classes: buildClassDetails({
        courses: courseRows,
        trainers: trainerRows,
        classes: classes || [],
      }),
    },
  };
}

export async function createTrainingClass(input: TrainingClassInput): Promise<TrainingActionResult<TrainingClassRow>> {
  const auth = await getAuthorizedTenantUser({
    allowedRoles: TRAINING_MANAGE_ROLES,
    errorMessage: TRAINING_AUTH_ERROR,
  });
  if (!auth.ok) return { success: false, error: auth.error };

  const payload = buildClassPayload(input, auth.tenantId);
  if (!payload.success) return payload;

  const db = await getTrainingClient();
  const courseResult = await assertCourseBelongsToTenant(db, payload.data.course_id, auth.tenantId);
  if (!courseResult.success) return { success: false, error: courseResult.error };
  const trainerResult = await assertTrainerBelongsToTenant(db, payload.data.trainer_id, auth.tenantId);
  if (!trainerResult.success) return { success: false, error: trainerResult.error };

  const { data, error } = await db
    .from('training_classes')
    .insert([payload.data])
    .select('*')
    .single();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: 'Không xác định được lịch lớp vừa tạo.' };

  safeRevalidatePath('/dashboard/training/classes');
  return { success: true, data };
}

export async function updateTrainingClass(
  classId: string,
  input: TrainingClassInput,
): Promise<TrainingActionResult<TrainingClassRow>> {
  const auth = await getAuthorizedTenantUser({
    allowedRoles: TRAINING_MANAGE_ROLES,
    errorMessage: TRAINING_AUTH_ERROR,
  });
  if (!auth.ok) return { success: false, error: auth.error };

  const db = await getTrainingClient();
  const existing = await assertClassBelongsToTenant(db, classId, auth.tenantId);
  if (!existing.success) return existing;

  if (input.courseId && input.courseId !== existing.data.course_id) {
    return { success: false, error: 'Không thể chuyển lịch lớp sang khóa học khác.' };
  }

  const payload = buildClassPayload({
    ...input,
    courseId: existing.data.course_id,
  }, auth.tenantId);
  if (!payload.success) return payload;

  const trainerResult = await assertTrainerBelongsToTenant(db, payload.data.trainer_id, auth.tenantId);
  if (!trainerResult.success) return { success: false, error: trainerResult.error };

  const dbPayload: TrainingClassUpdate = {
    trainer_id: payload.data.trainer_id,
    title: payload.data.title,
    class_type: payload.data.class_type,
    starts_at: payload.data.starts_at,
    ends_at: payload.data.ends_at,
    location_note: payload.data.location_note,
    capacity: payload.data.capacity,
    status: payload.data.status,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await db
    .from('training_classes')
    .update(dbPayload)
    .eq('id', classId)
    .eq('tenant_id', auth.tenantId)
    .select('*')
    .single();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: 'Không xác định được lịch lớp vừa cập nhật.' };

  safeRevalidatePath('/dashboard/training/classes');
  return { success: true, data };
}

export async function getStudentTrainingPortalOverview(): Promise<TrainingActionResult<TrainingStudentPortalOverview>> {
  const auth = await getAuthorizedTenantUser({
    allowedRoles: TRAINING_STUDENT_ROLES,
    errorMessage: TRAINING_STUDENT_AUTH_ERROR,
  });
  if (!auth.ok) return { success: false, error: auth.error };

  const db = await getTrainingClient();
  const studentUserResult = await assertStudentUserBelongsToTenant(db, auth.user.id, auth.tenantId);
  if (!studentUserResult.success) return { success: false, error: studentUserResult.error };

  const { data: enrollments, error: enrollmentsError } = await db
    .from('students')
    .select('*')
    .eq('tenant_id', auth.tenantId)
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false });

  if (enrollmentsError) return { success: false, error: enrollmentsError.message };
  const enrollmentRows = enrollments || [];
  if (enrollmentRows.length === 0) {
    return {
      success: true,
      data: {
        student: studentUserResult.data,
        enrollments: [],
      },
    };
  }

  const courseIds = Array.from(new Set(enrollmentRows.map((enrollment) => enrollment.course_id)));
  const { data: courses, error: coursesError } = await db
    .from('courses')
    .select('*')
    .eq('tenant_id', auth.tenantId)
    .in('id', courseIds)
    .order('created_at', { ascending: false });

  if (coursesError) return { success: false, error: coursesError.message };
  const courseRows = courses || [];
  const { data: modules, error: modulesError } = await db
    .from('course_modules')
    .select('*')
    .in('course_id', courseRows.map((course) => course.id))
    .order('sequence_order', { ascending: true });

  if (modulesError) return { success: false, error: modulesError.message };
  const moduleRows = modules || [];
  const moduleIds = moduleRows.map((moduleRow) => moduleRow.id);
  const lessonResult: QueryListResult<TrainingLessonRow> = moduleIds.length === 0
    ? { data: [], error: null }
    : await db
      .from('lessons')
      .select('*')
      .in('module_id', moduleIds)
      .order('sequence_order', { ascending: true });

  if (lessonResult.error) return { success: false, error: lessonResult.error.message };
  const lessonRows = lessonResult.data || [];
  const lessonIds = lessonRows.map((lesson) => lesson.id);
  const progressResult: QueryListResult<TrainingStudentLessonProgressRow> = lessonIds.length === 0
    ? { data: [], error: null }
    : await db
      .from('student_lesson_progress')
      .select('*')
      .in('student_id', enrollmentRows.map((enrollment) => enrollment.id))
      .in('lesson_id', lessonIds);

  if (progressResult.error) return { success: false, error: progressResult.error.message };

  const coursesById = new Map(
    attachProgressToCourseTree({
      courses: courseRows,
      modules: moduleRows,
      lessons: lessonRows,
      progresses: progressResult.data || [],
    }).map((course) => [course.id, course]),
  );

  return {
    success: true,
    data: {
      student: studentUserResult.data,
      enrollments: enrollmentRows.map((enrollment) => ({
        ...enrollment,
        course: coursesById.get(enrollment.course_id) || null,
      })),
    },
  };
}

export async function markStudentLessonComplete(lessonId: string): Promise<TrainingActionResult<TrainingStudentLessonProgressRow>> {
  const auth = await getAuthorizedTenantUser({
    allowedRoles: TRAINING_STUDENT_ROLES,
    errorMessage: TRAINING_STUDENT_AUTH_ERROR,
  });
  if (!auth.ok) return { success: false, error: auth.error };

  const cleanLessonId = cleanText(lessonId, 80);
  if (!cleanLessonId) return { success: false, error: 'Thiếu bài học cần hoàn thành.' };

  const db = await getTrainingClient();
  const studentUserResult = await assertStudentUserBelongsToTenant(db, auth.user.id, auth.tenantId);
  if (!studentUserResult.success) return { success: false, error: studentUserResult.error };

  const { data: lesson, error: lessonError } = await db
    .from('lessons')
    .select('*')
    .eq('id', cleanLessonId)
    .single();

  if (lessonError) return { success: false, error: lessonError.message };
  if (!lesson) return { success: false, error: LESSON_NOT_FOUND };

  const moduleResult = await assertModuleBelongsToTenant(db, lesson.module_id, auth.tenantId);
  if (!moduleResult.success) return { success: false, error: moduleResult.error };

  const { data: enrollments, error: enrollmentsError } = await db
    .from('students')
    .select('*')
    .eq('tenant_id', auth.tenantId)
    .eq('user_id', auth.user.id)
    .eq('course_id', moduleResult.data.course_id)
    .eq('enrollment_status', 'active');

  if (enrollmentsError) return { success: false, error: enrollmentsError.message };
  const enrollment = enrollments?.[0] || null;
  if (!enrollment) return { success: false, error: ACTIVE_ENROLLMENT_NOT_FOUND };

  const { data: existingProgress, error: existingError } = await db
    .from('student_lesson_progress')
    .select('*')
    .eq('student_id', enrollment.id)
    .eq('lesson_id', cleanLessonId)
    .single();

  if (existingError && !existingError.message.toLowerCase().includes('no rows')) {
    return { success: false, error: existingError.message };
  }

  const now = new Date().toISOString();
  if (existingProgress) {
    const updatePayload: TrainingStudentLessonProgressUpdate = {
      is_completed: true,
      view_percentage: 100,
      completed_at: existingProgress.completed_at || now,
      last_accessed_at: now,
      updated_at: now,
    };
    const { data, error } = await db
      .from('student_lesson_progress')
      .update(updatePayload)
      .eq('id', existingProgress.id)
      .eq('tenant_id', auth.tenantId)
      .select('*')
      .single();

    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: 'Không xác định được tiến độ bài học vừa cập nhật.' };
    safeRevalidatePath('/student/dashboard');
    return { success: true, data };
  }

  const insertPayload: TrainingStudentLessonProgressInsert = {
    tenant_id: auth.tenantId,
    student_id: enrollment.id,
    lesson_id: cleanLessonId,
    time_spent_seconds: 0,
    view_percentage: 100,
    is_completed: true,
    completed_at: now,
    last_accessed_at: now,
  };
  const { data, error } = await db
    .from('student_lesson_progress')
    .insert([insertPayload])
    .select('*')
    .single();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: 'Không xác định được tiến độ bài học vừa tạo.' };
  safeRevalidatePath('/student/dashboard');
  return { success: true, data };
}

export async function createTrainingCourse(input: TrainingCourseInput): Promise<TrainingActionResult<TrainingCourseRow>> {
  const auth = await getAuthorizedTenantUser({
    allowedRoles: TRAINING_MANAGE_ROLES,
    errorMessage: TRAINING_AUTH_ERROR,
  });
  if (!auth.ok) return { success: false, error: auth.error };

  const payload = buildCoursePayload(input, { tenantId: auth.tenantId, userId: auth.user.id });
  if (!payload.success) return payload;

  const db = await getTrainingClient();
  const { data, error } = await db
    .from('courses')
    .insert([payload.data])
    .select('*')
    .single();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: 'Không xác định được khóa học vừa tạo.' };

  safeRevalidatePath('/dashboard/training');
  safeRevalidatePath('/dashboard/training/courses');
  return { success: true, data };
}

export async function updateTrainingCourse(
  courseId: string,
  input: TrainingCourseInput,
): Promise<TrainingActionResult<TrainingCourseRow>> {
  const auth = await getAuthorizedTenantUser({
    allowedRoles: TRAINING_MANAGE_ROLES,
    errorMessage: TRAINING_AUTH_ERROR,
  });
  if (!auth.ok) return { success: false, error: auth.error };

  const db = await getTrainingClient();
  const existing = await assertCourseBelongsToTenant(db, courseId, auth.tenantId);
  if (!existing.success) return existing;

  const payload = buildCoursePayload(input, { tenantId: auth.tenantId, userId: auth.user.id });
  if (!payload.success) return payload;

  const dbPayload: TrainingCourseUpdate = {
    title: payload.data.title,
    description: payload.data.description,
    specialty: payload.data.specialty,
    tuition_amount: payload.data.tuition_amount,
    theory_duration_minutes: payload.data.theory_duration_minutes,
    status: payload.data.status,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await db
    .from('courses')
    .update(dbPayload)
    .eq('id', courseId)
    .eq('tenant_id', auth.tenantId)
    .select('*')
    .single();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: 'Không xác định được khóa học vừa cập nhật.' };

  safeRevalidatePath('/dashboard/training');
  safeRevalidatePath('/dashboard/training/courses');
  return { success: true, data };
}

export async function archiveTrainingCourse(courseId: string): Promise<TrainingDeleteResult> {
  const auth = await getAuthorizedTenantUser({
    allowedRoles: TRAINING_MANAGE_ROLES,
    errorMessage: TRAINING_AUTH_ERROR,
  });
  if (!auth.ok) return { success: false, error: auth.error };

  const db = await getTrainingClient();
  const existing = await assertCourseBelongsToTenant(db, courseId, auth.tenantId);
  if (!existing.success) return { success: false, error: existing.error };

  const { error } = await db
    .from('courses')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', courseId)
    .eq('tenant_id', auth.tenantId)
    .select('*')
    .single();

  if (error) return { success: false, error: error.message };

  safeRevalidatePath('/dashboard/training');
  safeRevalidatePath('/dashboard/training/courses');
  return { success: true };
}

export async function createTrainingEnrollment(
  input: TrainingEnrollmentInput,
): Promise<TrainingActionResult<TrainingStudentEnrollmentRow>> {
  const auth = await getAuthorizedTenantUser({
    allowedRoles: TRAINING_MANAGE_ROLES,
    errorMessage: TRAINING_AUTH_ERROR,
  });
  if (!auth.ok) return { success: false, error: auth.error };

  const payload = buildEnrollmentPayload(input, auth.tenantId);
  if (!payload.success) return payload;

  const db = await getTrainingClient();
  const courseResult = await assertCourseBelongsToTenant(db, payload.data.course_id, auth.tenantId);
  if (!courseResult.success) return { success: false, error: courseResult.error };

  const studentResult = await assertStudentUserBelongsToTenant(db, payload.data.user_id, auth.tenantId);
  if (!studentResult.success) return { success: false, error: studentResult.error };

  const { data, error } = await db
    .from('students')
    .insert([payload.data])
    .select('*')
    .single();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: 'Không xác định được hồ sơ ghi danh vừa tạo.' };

  safeRevalidatePath('/dashboard/training');
  safeRevalidatePath('/dashboard/training/enrollments');
  return { success: true, data };
}

export async function updateTrainingEnrollment(
  enrollmentId: string,
  input: TrainingEnrollmentInput,
): Promise<TrainingActionResult<TrainingStudentEnrollmentRow>> {
  const auth = await getAuthorizedTenantUser({
    allowedRoles: TRAINING_MANAGE_ROLES,
    errorMessage: TRAINING_AUTH_ERROR,
  });
  if (!auth.ok) return { success: false, error: auth.error };

  const db = await getTrainingClient();
  const existing = await assertEnrollmentBelongsToTenant(db, enrollmentId, auth.tenantId);
  if (!existing.success) return existing;

  if (input.userId && input.userId !== existing.data.user_id) {
    return { success: false, error: 'Không thể chuyển hồ sơ ghi danh sang học viên khác.' };
  }
  if (input.courseId && input.courseId !== existing.data.course_id) {
    return { success: false, error: 'Không thể chuyển hồ sơ ghi danh sang khóa học khác.' };
  }

  const payload = buildEnrollmentPayload({
    ...input,
    userId: existing.data.user_id,
    courseId: existing.data.course_id,
  }, auth.tenantId);
  if (!payload.success) return payload;

  const dbPayload: TrainingStudentEnrollmentUpdate = {
    enrollment_status: payload.data.enrollment_status,
    tuition_total: payload.data.tuition_total,
    tuition_paid: payload.data.tuition_paid,
    notes: payload.data.notes,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await db
    .from('students')
    .update(dbPayload)
    .eq('id', enrollmentId)
    .eq('tenant_id', auth.tenantId)
    .select('*')
    .single();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: 'Không xác định được hồ sơ ghi danh vừa cập nhật.' };

  safeRevalidatePath('/dashboard/training');
  safeRevalidatePath('/dashboard/training/enrollments');
  return { success: true, data };
}

export async function createCourseModule(
  input: TrainingCourseModuleInput,
): Promise<TrainingActionResult<TrainingCourseModuleRow>> {
  const auth = await getAuthorizedTenantUser({
    allowedRoles: TRAINING_MANAGE_ROLES,
    errorMessage: TRAINING_AUTH_ERROR,
  });
  if (!auth.ok) return { success: false, error: auth.error };

  const payload = buildModulePayload(input);
  if (!payload.success) return payload;

  const db = await getTrainingClient();
  const courseResult = await assertCourseBelongsToTenant(db, payload.data.course_id, auth.tenantId);
  if (!courseResult.success) return { success: false, error: courseResult.error };

  const { data, error } = await db
    .from('course_modules')
    .insert([payload.data])
    .select('*')
    .single();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: 'Không xác định được chương học vừa tạo.' };

  safeRevalidatePath('/dashboard/training/courses');
  return { success: true, data };
}

export async function updateCourseModule(
  moduleId: string,
  input: TrainingCourseModuleInput,
): Promise<TrainingActionResult<TrainingCourseModuleRow>> {
  const auth = await getAuthorizedTenantUser({
    allowedRoles: TRAINING_MANAGE_ROLES,
    errorMessage: TRAINING_AUTH_ERROR,
  });
  if (!auth.ok) return { success: false, error: auth.error };

  const payload = buildModulePayload(input);
  if (!payload.success) return payload;

  const db = await getTrainingClient();
  const existing = await assertModuleBelongsToTenant(db, moduleId, auth.tenantId);
  if (!existing.success) return existing;
  if (existing.data.course_id !== payload.data.course_id) {
    return { success: false, error: 'Không thể chuyển chương học sang khóa khác.' };
  }

  const dbPayload: TrainingCourseModuleUpdate = {
    title: payload.data.title,
    description: payload.data.description,
    sequence_order: payload.data.sequence_order,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await db
    .from('course_modules')
    .update(dbPayload)
    .eq('id', moduleId)
    .select('*')
    .single();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: 'Không xác định được chương học vừa cập nhật.' };

  safeRevalidatePath('/dashboard/training/courses');
  return { success: true, data };
}

export async function deleteCourseModule(moduleId: string): Promise<TrainingDeleteResult> {
  const auth = await getAuthorizedTenantUser({
    allowedRoles: TRAINING_MANAGE_ROLES,
    errorMessage: TRAINING_AUTH_ERROR,
  });
  if (!auth.ok) return { success: false, error: auth.error };

  const db = await getTrainingClient();
  const existing = await assertModuleBelongsToTenant(db, moduleId, auth.tenantId);
  if (!existing.success) return { success: false, error: existing.error };

  const { error } = await db
    .from('course_modules')
    .delete()
    .eq('id', moduleId);

  if (error) return { success: false, error: error.message };
  safeRevalidatePath('/dashboard/training/courses');
  return { success: true };
}

export async function createTrainingLesson(
  input: TrainingLessonInput,
): Promise<TrainingActionResult<TrainingLessonRow>> {
  const auth = await getAuthorizedTenantUser({
    allowedRoles: TRAINING_MANAGE_ROLES,
    errorMessage: TRAINING_AUTH_ERROR,
  });
  if (!auth.ok) return { success: false, error: auth.error };

  const payload = buildLessonPayload(input);
  if (!payload.success) return payload;

  const db = await getTrainingClient();
  const moduleResult = await assertModuleBelongsToTenant(db, payload.data.module_id, auth.tenantId);
  if (!moduleResult.success) return { success: false, error: moduleResult.error };

  const { data, error } = await db
    .from('lessons')
    .insert([payload.data])
    .select('*')
    .single();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: 'Không xác định được bài học vừa tạo.' };

  safeRevalidatePath('/dashboard/training/courses');
  return { success: true, data };
}

export async function updateTrainingLesson(
  lessonId: string,
  input: TrainingLessonInput,
): Promise<TrainingActionResult<TrainingLessonRow>> {
  const auth = await getAuthorizedTenantUser({
    allowedRoles: TRAINING_MANAGE_ROLES,
    errorMessage: TRAINING_AUTH_ERROR,
  });
  if (!auth.ok) return { success: false, error: auth.error };

  const payload = buildLessonPayload(input);
  if (!payload.success) return payload;

  const db = await getTrainingClient();
  const existing = await assertLessonBelongsToTenant(db, lessonId, auth.tenantId);
  if (!existing.success) return existing;
  if (existing.data.module_id !== payload.data.module_id) {
    return { success: false, error: 'Không thể chuyển bài học sang chương khác.' };
  }

  const dbPayload: TrainingLessonUpdate = {
    title: payload.data.title,
    content_type: payload.data.content_type,
    content_url: payload.data.content_url,
    body: payload.data.body,
    sequence_order: payload.data.sequence_order,
    required_view_seconds: payload.data.required_view_seconds,
    required_view_percentage: payload.data.required_view_percentage,
    status: payload.data.status,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await db
    .from('lessons')
    .update(dbPayload)
    .eq('id', lessonId)
    .select('*')
    .single();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: 'Không xác định được bài học vừa cập nhật.' };

  safeRevalidatePath('/dashboard/training/courses');
  return { success: true, data };
}

export async function archiveTrainingLesson(lessonId: string): Promise<TrainingDeleteResult> {
  const auth = await getAuthorizedTenantUser({
    allowedRoles: TRAINING_MANAGE_ROLES,
    errorMessage: TRAINING_AUTH_ERROR,
  });
  if (!auth.ok) return { success: false, error: auth.error };

  const db = await getTrainingClient();
  const existing = await assertLessonBelongsToTenant(db, lessonId, auth.tenantId);
  if (!existing.success) return { success: false, error: existing.error };

  const { error } = await db
    .from('lessons')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', lessonId)
    .select('*')
    .single();

  if (error) return { success: false, error: error.message };
  safeRevalidatePath('/dashboard/training/courses');
  return { success: true };
}
