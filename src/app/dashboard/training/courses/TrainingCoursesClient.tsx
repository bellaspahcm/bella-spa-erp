'use client';

import { useMemo, useState, useTransition, type FormEvent } from 'react';
import {
  Archive,
  BookOpen,
  CheckCircle2,
  FileText,
  Layers3,
  Pencil,
  Plus,
  Trash2,
  Video,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  archiveTrainingCourse,
  archiveTrainingLesson,
  createCourseModule,
  createTrainingCourse,
  createTrainingLesson,
  deleteCourseModule,
  updateCourseModule,
  updateTrainingCourse,
  updateTrainingLesson,
} from '@/services/training-actions';
import type {
  TrainingContentType,
  TrainingCourseInput,
  TrainingCourseStatus,
  TrainingCourseWithContent,
  TrainingLessonInput,
  TrainingLessonStatus,
} from '@/types/training';

type CourseFormState = {
  id?: string;
  title: string;
  description: string;
  specialty: string;
  tuitionAmount: string;
  theoryDurationMinutes: string;
  status: TrainingCourseStatus;
};

type ModuleFormState = {
  id?: string;
  courseId: string;
  title: string;
  description: string;
  sequenceOrder: string;
};

type LessonFormState = {
  id?: string;
  moduleId: string;
  title: string;
  contentType: TrainingContentType;
  contentUrl: string;
  body: string;
  sequenceOrder: string;
  requiredViewSeconds: string;
  requiredViewPercentage: string;
  status: TrainingLessonStatus;
};

const blankCourseForm: CourseFormState = {
  title: '',
  description: '',
  specialty: '',
  tuitionAmount: '0',
  theoryDurationMinutes: '0',
  status: 'draft',
};

const blankModuleForm: ModuleFormState = {
  courseId: '',
  title: '',
  description: '',
  sequenceOrder: '1',
};

const blankLessonForm: LessonFormState = {
  moduleId: '',
  title: '',
  contentType: 'document',
  contentUrl: '',
  body: '',
  sequenceOrder: '1',
  requiredViewSeconds: '0',
  requiredViewPercentage: '90',
  status: 'draft',
};

const courseStatusLabel: Record<TrainingCourseStatus, string> = {
  draft: 'Bản nháp',
  active: 'Đang mở',
  archived: 'Đã lưu trữ',
};

const lessonStatusLabel: Record<TrainingLessonStatus, string> = {
  draft: 'Nháp',
  published: 'Đã xuất bản',
  archived: 'Đã lưu trữ',
};

const contentTypeLabel: Record<TrainingContentType, string> = {
  document: 'Tài liệu',
  video: 'Video',
  pdf: 'PDF',
  quiz: 'Quiz',
  live_class: 'Lớp trực tiếp',
};

function money(value: number | string) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? parsed.toLocaleString('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })
    : '0 đ';
}

function toCourseInput(form: CourseFormState): TrainingCourseInput {
  return {
    title: form.title,
    description: form.description,
    specialty: form.specialty,
    tuitionAmount: form.tuitionAmount,
    theoryDurationMinutes: form.theoryDurationMinutes,
    status: form.status,
  };
}

function toLessonInput(form: LessonFormState): TrainingLessonInput {
  return {
    moduleId: form.moduleId,
    title: form.title,
    contentType: form.contentType,
    contentUrl: form.contentUrl,
    body: form.body,
    sequenceOrder: form.sequenceOrder,
    requiredViewSeconds: form.requiredViewSeconds,
    requiredViewPercentage: form.requiredViewPercentage,
    status: form.status,
  };
}

export function TrainingCoursesClient({ initialCourses }: { initialCourses: TrainingCourseWithContent[] }) {
  const [courses, setCourses] = useState(initialCourses);
  const [courseForm, setCourseForm] = useState<CourseFormState>(blankCourseForm);
  const [moduleForm, setModuleForm] = useState<ModuleFormState>({
    ...blankModuleForm,
    courseId: initialCourses[0]?.id || '',
  });
  const [lessonForm, setLessonForm] = useState<LessonFormState>(blankLessonForm);
  const [selectedCourseId, setSelectedCourseId] = useState(initialCourses[0]?.id || '');
  const [isPending, startTransition] = useTransition();

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) || courses[0] || null,
    [courses, selectedCourseId],
  );

  const activeCourses = courses.filter((course) => course.status !== 'archived');
  const moduleOptions = courses.flatMap((course) => (
    course.modules.map((courseModule) => ({
      id: courseModule.id,
      label: `${course.title} / ${courseModule.sequence_order}. ${courseModule.title}`,
    }))
  ));

  const refreshFromResult = (nextCourse?: TrainingCourseWithContent | null) => {
    if (nextCourse) {
      setCourses((current) => {
        const existing = current.find((course) => course.id === nextCourse.id);
        if (!existing) return [nextCourse, ...current];
        return current.map((course) => (course.id === nextCourse.id ? nextCourse : course));
      });
      setSelectedCourseId(nextCourse.id);
    } else {
      window.location.reload();
    }
  };

  const handleCourseSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const action = courseForm.id
        ? updateTrainingCourse(courseForm.id, toCourseInput(courseForm))
        : createTrainingCourse(toCourseInput(courseForm));
      const result = await action;
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(courseForm.id ? 'Đã cập nhật khóa học' : 'Đã tạo khóa học');
      setCourseForm(blankCourseForm);
      refreshFromResult(null);
    });
  };

  const handleArchiveCourse = (courseId: string) => {
    startTransition(async () => {
      const result = await archiveTrainingCourse(courseId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success('Đã lưu trữ khóa học');
      refreshFromResult(null);
    });
  };

  const handleModuleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const action = moduleForm.id
        ? updateCourseModule(moduleForm.id, moduleForm)
        : createCourseModule(moduleForm);
      const result = await action;
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(moduleForm.id ? 'Đã cập nhật chương học' : 'Đã thêm chương học');
      setModuleForm({ ...blankModuleForm, courseId: moduleForm.courseId, sequenceOrder: String(Number(moduleForm.sequenceOrder || 0) + 1) });
      refreshFromResult(null);
    });
  };

  const handleDeleteModule = (moduleId: string) => {
    startTransition(async () => {
      const result = await deleteCourseModule(moduleId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success('Đã xóa chương học');
      refreshFromResult(null);
    });
  };

  const handleLessonSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const action = lessonForm.id
        ? updateTrainingLesson(lessonForm.id, toLessonInput(lessonForm))
        : createTrainingLesson(toLessonInput(lessonForm));
      const result = await action;
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(lessonForm.id ? 'Đã cập nhật bài học' : 'Đã thêm bài học');
      setLessonForm({ ...blankLessonForm, moduleId: lessonForm.moduleId, sequenceOrder: String(Number(lessonForm.sequenceOrder || 0) + 1) });
      refreshFromResult(null);
    });
  };

  const handleArchiveLesson = (lessonId: string) => {
    startTransition(async () => {
      const result = await archiveTrainingLesson(lessonId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success('Đã lưu trữ bài học');
      refreshFromResult(null);
    });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <aside className="space-y-5">
        <form onSubmit={handleCourseSubmit} className="rounded-[var(--brand-card-radius)] border border-border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-950">{courseForm.id ? 'Sửa khóa học' : 'Tạo khóa học'}</h2>
            {courseForm.id && (
              <button
                type="button"
                onClick={() => setCourseForm(blankCourseForm)}
                className="text-xs font-bold text-slate-500 hover:text-primary"
              >
                Hủy sửa
              </button>
            )}
          </div>
          <div className="space-y-3">
            <input
              value={courseForm.title}
              onChange={(event) => setCourseForm({ ...courseForm, title: event.target.value })}
              placeholder="Tên khóa học"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
            />
            <textarea
              value={courseForm.description}
              onChange={(event) => setCourseForm({ ...courseForm, description: event.target.value })}
              placeholder="Mô tả ngắn"
              rows={3}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                value={courseForm.specialty}
                onChange={(event) => setCourseForm({ ...courseForm, specialty: event.target.value })}
                placeholder="Chuyên môn"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
              />
              <select
                value={courseForm.status}
                onChange={(event) => setCourseForm({ ...courseForm, status: event.target.value as TrainingCourseStatus })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
              >
                {Object.entries(courseStatusLabel).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                value={courseForm.tuitionAmount}
                onChange={(event) => setCourseForm({ ...courseForm, tuitionAmount: event.target.value })}
                placeholder="Học phí"
                inputMode="numeric"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
              />
              <input
                value={courseForm.theoryDurationMinutes}
                onChange={(event) => setCourseForm({ ...courseForm, theoryDurationMinutes: event.target.value })}
                placeholder="Phút lý thuyết"
                inputMode="numeric"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[var(--brand-button-radius)] bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-primary disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {courseForm.id ? 'Lưu khóa học' : 'Tạo khóa học'}
          </button>
        </form>

        <form onSubmit={handleModuleSubmit} className="rounded-[var(--brand-card-radius)] border border-border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-950">{moduleForm.id ? 'Sửa chương' : 'Thêm chương'}</h2>
            {moduleForm.id && (
              <button
                type="button"
                onClick={() => setModuleForm({ ...blankModuleForm, courseId: selectedCourse?.id || '' })}
                className="text-xs font-bold text-slate-500 hover:text-primary"
              >
                Hủy sửa
              </button>
            )}
          </div>
          <div className="space-y-3">
            <select
              value={moduleForm.courseId}
              onChange={(event) => setModuleForm({ ...moduleForm, courseId: event.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
            >
              <option value="">Chọn khóa học</option>
              {activeCourses.map((course) => (
                <option key={course.id} value={course.id}>{course.title}</option>
              ))}
            </select>
            <input
              value={moduleForm.title}
              onChange={(event) => setModuleForm({ ...moduleForm, title: event.target.value })}
              placeholder="Tên chương"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
            />
            <input
              value={moduleForm.sequenceOrder}
              onChange={(event) => setModuleForm({ ...moduleForm, sequenceOrder: event.target.value })}
              placeholder="Thứ tự"
              inputMode="numeric"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
            />
            <textarea
              value={moduleForm.description}
              onChange={(event) => setModuleForm({ ...moduleForm, description: event.target.value })}
              placeholder="Mô tả chương"
              rows={2}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[var(--brand-button-radius)] border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-900 transition hover:border-primary hover:text-primary disabled:opacity-60"
          >
            <Layers3 className="h-4 w-4" />
            {moduleForm.id ? 'Lưu chương học' : 'Thêm chương học'}
          </button>
        </form>

        <form onSubmit={handleLessonSubmit} className="rounded-[var(--brand-card-radius)] border border-border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-950">{lessonForm.id ? 'Sửa bài học' : 'Thêm bài học'}</h2>
            {lessonForm.id && (
              <button
                type="button"
                onClick={() => setLessonForm({ ...blankLessonForm, moduleId: lessonForm.moduleId })}
                className="text-xs font-bold text-slate-500 hover:text-primary"
              >
                Hủy sửa
              </button>
            )}
          </div>
          <div className="space-y-3">
            <select
              value={lessonForm.moduleId}
              onChange={(event) => setLessonForm({ ...lessonForm, moduleId: event.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
            >
              <option value="">Chọn chương học</option>
              {moduleOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
            <input
              value={lessonForm.title}
              onChange={(event) => setLessonForm({ ...lessonForm, title: event.target.value })}
              placeholder="Tên bài học"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                value={lessonForm.contentType}
                onChange={(event) => setLessonForm({ ...lessonForm, contentType: event.target.value as TrainingContentType })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
              >
                {Object.entries(contentTypeLabel).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <select
                value={lessonForm.status}
                onChange={(event) => setLessonForm({ ...lessonForm, status: event.target.value as TrainingLessonStatus })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
              >
                {Object.entries(lessonStatusLabel).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <input
              value={lessonForm.contentUrl}
              onChange={(event) => setLessonForm({ ...lessonForm, contentUrl: event.target.value })}
              placeholder="Link video/PDF/tài liệu"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
            />
            <div className="grid grid-cols-3 gap-3">
              <input
                value={lessonForm.sequenceOrder}
                onChange={(event) => setLessonForm({ ...lessonForm, sequenceOrder: event.target.value })}
                placeholder="Thứ tự"
                inputMode="numeric"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
              />
              <input
                value={lessonForm.requiredViewSeconds}
                onChange={(event) => setLessonForm({ ...lessonForm, requiredViewSeconds: event.target.value })}
                placeholder="Giây học"
                inputMode="numeric"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
              />
              <input
                value={lessonForm.requiredViewPercentage}
                onChange={(event) => setLessonForm({ ...lessonForm, requiredViewPercentage: event.target.value })}
                placeholder="% xem"
                inputMode="numeric"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
              />
            </div>
            <textarea
              value={lessonForm.body}
              onChange={(event) => setLessonForm({ ...lessonForm, body: event.target.value })}
              placeholder="Nội dung/ghi chú bài học"
              rows={3}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[var(--brand-button-radius)] border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-black text-emerald-800 transition hover:border-emerald-400 disabled:opacity-60"
          >
            <FileText className="h-4 w-4" />
            {lessonForm.id ? 'Lưu bài học' : 'Thêm bài học'}
          </button>
        </form>
      </aside>

      <section className="min-w-0 rounded-[var(--brand-card-radius)] border border-border bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-950">Danh sách giáo trình</h2>
            <p className="text-sm font-semibold text-slate-500">{courses.length} khóa học trong chi nhánh hiện tại</p>
          </div>
        </div>

        {courses.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <BookOpen className="mb-4 h-10 w-10 text-slate-400" />
            <h3 className="text-lg font-black text-slate-950">Chưa có khóa học</h3>
            <p className="mt-2 max-w-md text-sm font-semibold text-slate-500">
              Tạo khóa học đầu tiên, sau đó thêm chương và bài học theo thứ tự học viên cần hoàn thành.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {courses.map((course) => (
              <article
                key={course.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCourseId(course.id);
                      setModuleForm((current) => ({ ...current, courseId: course.id }));
                    }}
                    className="text-left"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-black text-slate-950">{course.title}</h3>
                      <span className="rounded-full bg-white px-2 py-1 text-xs font-black text-slate-500">
                        {courseStatusLabel[course.status]}
                      </span>
                      {selectedCourse?.id === course.id && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Đang chọn
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      {course.specialty || 'Chưa phân nhóm chuyên môn'} · {money(course.tuition_amount)} · {course.theory_duration_minutes} phút lý thuyết
                    </p>
                    {course.description && (
                      <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{course.description}</p>
                    )}
                  </button>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => setCourseForm({
                        id: course.id,
                        title: course.title,
                        description: course.description || '',
                        specialty: course.specialty || '',
                        tuitionAmount: String(course.tuition_amount || 0),
                        theoryDurationMinutes: String(course.theory_duration_minutes || 0),
                        status: course.status,
                      })}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:text-primary"
                      aria-label="Sửa khóa học"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleArchiveCourse(course.id)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:text-red-600"
                      aria-label="Lưu trữ khóa học"
                    >
                      <Archive className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {course.modules.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-sm font-bold text-slate-500">
                      Chưa có chương học.
                    </div>
                  ) : (
                    course.modules.map((courseModule) => (
                      <div key={courseModule.id} className="rounded-lg border border-slate-200 bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h4 className="font-black text-slate-950">
                              {courseModule.sequence_order}. {courseModule.title}
                            </h4>
                            {courseModule.description && (
                              <p className="mt-1 text-sm font-medium text-slate-500">{courseModule.description}</p>
                            )}
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCourseId(course.id);
                                setModuleForm({
                                  id: courseModule.id,
                                  courseId: course.id,
                                  title: courseModule.title,
                                  description: courseModule.description || '',
                                  sequenceOrder: String(courseModule.sequence_order),
                                });
                              }}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-primary"
                              aria-label="Sửa chương học"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteModule(courseModule.id)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-red-600"
                              aria-label="Xóa chương học"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-2">
                          {courseModule.lessons.length === 0 ? (
                            <p className="text-sm font-semibold text-slate-400">Chưa có bài học trong chương này.</p>
                          ) : (
                            courseModule.lessons.map((lesson) => (
                              <div
                                key={lesson.id}
                                className="flex flex-col gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm md:flex-row md:items-center md:justify-between"
                              >
                                <div className="flex items-start gap-2">
                                  {lesson.content_type === 'video' ? (
                                    <Video className="mt-0.5 h-4 w-4 text-primary" />
                                  ) : (
                                    <FileText className="mt-0.5 h-4 w-4 text-slate-500" />
                                  )}
                                  <div>
                                    <p className="font-black text-slate-800">
                                      {lesson.sequence_order}. {lesson.title}
                                    </p>
                                    <p className="font-semibold text-slate-500">
                                      {contentTypeLabel[lesson.content_type]} · {lessonStatusLabel[lesson.status]} · {lesson.required_view_seconds}s · {lesson.required_view_percentage}%
                                    </p>
                                  </div>
                                </div>
                                <div className="flex shrink-0 gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setLessonForm({
                                        id: lesson.id,
                                        moduleId: courseModule.id,
                                        title: lesson.title,
                                        contentType: lesson.content_type,
                                        contentUrl: lesson.content_url || '',
                                        body: lesson.body || '',
                                        sequenceOrder: String(lesson.sequence_order),
                                        requiredViewSeconds: String(lesson.required_view_seconds),
                                        requiredViewPercentage: String(lesson.required_view_percentage),
                                        status: lesson.status,
                                      });
                                    }}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600 hover:text-primary"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                    Sửa
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleArchiveLesson(lesson.id)}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600 hover:text-red-600"
                                  >
                                    <Archive className="h-3.5 w-3.5" />
                                    Lưu trữ
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
