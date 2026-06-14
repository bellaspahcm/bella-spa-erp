export type TrainingCourseStatus = 'draft' | 'active' | 'archived';
export type TrainingLessonStatus = 'draft' | 'published' | 'archived';
export type TrainingContentType = 'document' | 'video' | 'pdf' | 'quiz' | 'live_class';
export type TrainingEnrollmentStatus = 'active' | 'paused' | 'graduated' | 'withdrawn';

export type TrainingCourseRow = {
  id: string;
  tenant_id: string;
  module_key: 'student_training';
  title: string;
  description: string | null;
  specialty: string | null;
  tuition_amount: number | string;
  theory_duration_minutes: number;
  status: TrainingCourseStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type TrainingCourseInsert = {
  tenant_id: string;
  module_key: 'student_training';
  title: string;
  description?: string | null;
  specialty?: string | null;
  tuition_amount: number;
  theory_duration_minutes: number;
  status: TrainingCourseStatus;
  created_by?: string | null;
};

export type TrainingCourseUpdate = Partial<Omit<TrainingCourseInsert, 'tenant_id' | 'module_key' | 'created_by'>> & {
  updated_at: string;
};

export type TrainingCourseModuleRow = {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  sequence_order: number;
  created_at: string;
  updated_at: string;
};

export type TrainingCourseModuleInsert = {
  course_id: string;
  title: string;
  description?: string | null;
  sequence_order: number;
};

export type TrainingCourseModuleUpdate = Partial<TrainingCourseModuleInsert> & {
  updated_at: string;
};

export type TrainingLessonRow = {
  id: string;
  module_id: string;
  title: string;
  content_type: TrainingContentType;
  content_url: string | null;
  body: string | null;
  sequence_order: number;
  required_view_seconds: number;
  required_view_percentage: number | string;
  status: TrainingLessonStatus;
  created_at: string;
  updated_at: string;
};

export type TrainingLessonInsert = {
  module_id: string;
  title: string;
  content_type: TrainingContentType;
  content_url?: string | null;
  body?: string | null;
  sequence_order: number;
  required_view_seconds: number;
  required_view_percentage: number;
  status: TrainingLessonStatus;
};

export type TrainingLessonUpdate = Partial<TrainingLessonInsert> & {
  updated_at: string;
};

export type TrainingCourseWithContent = TrainingCourseRow & {
  modules: Array<TrainingCourseModuleRow & {
    lessons: TrainingLessonRow[];
  }>;
};

export type TrainingStudentUserRow = {
  id: string;
  tenant_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  status: string | null;
};

export type TrainingStudentEnrollmentRow = {
  id: string;
  tenant_id: string;
  user_id: string;
  course_id: string;
  enrollment_status: TrainingEnrollmentStatus;
  enrolled_at: string;
  tuition_total: number | string;
  tuition_paid: number | string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type TrainingStudentEnrollmentInsert = {
  tenant_id: string;
  user_id: string;
  course_id: string;
  enrollment_status: TrainingEnrollmentStatus;
  enrolled_at?: string;
  tuition_total: number;
  tuition_paid: number;
  notes?: string | null;
};

export type TrainingStudentEnrollmentUpdate = Partial<Omit<TrainingStudentEnrollmentInsert, 'tenant_id' | 'user_id' | 'course_id'>> & {
  updated_at: string;
};

export type TrainingStudentEnrollmentWithDetails = TrainingStudentEnrollmentRow & {
  user: TrainingStudentUserRow | null;
  course: Pick<TrainingCourseRow, 'id' | 'title' | 'status' | 'tuition_amount'> | null;
};

export type TrainingEnrollmentAdminOverview = {
  courses: TrainingCourseRow[];
  studentUsers: TrainingStudentUserRow[];
  enrollments: TrainingStudentEnrollmentWithDetails[];
};

export type TrainingCourseInput = {
  title: string;
  description?: string | null;
  specialty?: string | null;
  tuitionAmount?: number | string | null;
  theoryDurationMinutes?: number | string | null;
  status?: TrainingCourseStatus | null;
};

export type TrainingCourseModuleInput = {
  courseId: string;
  title: string;
  description?: string | null;
  sequenceOrder?: number | string | null;
};

export type TrainingLessonInput = {
  moduleId: string;
  title: string;
  contentType?: TrainingContentType | null;
  contentUrl?: string | null;
  body?: string | null;
  sequenceOrder?: number | string | null;
  requiredViewSeconds?: number | string | null;
  requiredViewPercentage?: number | string | null;
  status?: TrainingLessonStatus | null;
};

export type TrainingEnrollmentInput = {
  userId: string;
  courseId: string;
  enrollmentStatus?: TrainingEnrollmentStatus | null;
  tuitionTotal?: number | string | null;
  tuitionPaid?: number | string | null;
  notes?: string | null;
};
