'use client';

import { useMemo, useState, useTransition, type FormEvent } from 'react';
import { CheckCircle2, GraduationCap, Pencil, Plus, WalletCards } from 'lucide-react';
import { toast } from 'sonner';

import {
  createTrainingEnrollment,
  updateTrainingEnrollment,
} from '@/services/training-actions';
import type {
  TrainingEnrollmentAdminOverview,
  TrainingEnrollmentInput,
  TrainingEnrollmentStatus,
  TrainingStudentEnrollmentWithDetails,
} from '@/types/training';

type EnrollmentFormState = {
  id?: string;
  userId: string;
  courseId: string;
  enrollmentStatus: TrainingEnrollmentStatus;
  tuitionTotal: string;
  tuitionPaid: string;
  notes: string;
};

const blankForm: EnrollmentFormState = {
  userId: '',
  courseId: '',
  enrollmentStatus: 'active',
  tuitionTotal: '0',
  tuitionPaid: '0',
  notes: '',
};

const enrollmentStatusLabel: Record<TrainingEnrollmentStatus, string> = {
  active: 'Đang học',
  paused: 'Tạm dừng',
  graduated: 'Tốt nghiệp',
  withdrawn: 'Nghỉ học',
};

function money(value: number | string) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? parsed.toLocaleString('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })
    : '0 đ';
}

function toEnrollmentInput(form: EnrollmentFormState): TrainingEnrollmentInput {
  return {
    userId: form.userId,
    courseId: form.courseId,
    enrollmentStatus: form.enrollmentStatus,
    tuitionTotal: form.tuitionTotal,
    tuitionPaid: form.tuitionPaid,
    notes: form.notes,
  };
}

function getOutstanding(enrollment: TrainingStudentEnrollmentWithDetails) {
  return Math.max(0, Number(enrollment.tuition_total || 0) - Number(enrollment.tuition_paid || 0));
}

export function TrainingEnrollmentsClient({ initialData }: { initialData: TrainingEnrollmentAdminOverview }) {
  const [form, setForm] = useState<EnrollmentFormState>({
    ...blankForm,
    courseId: initialData.courses.find((course) => course.status !== 'archived')?.id || '',
    userId: initialData.studentUsers[0]?.id || '',
  });
  const [isPending, startTransition] = useTransition();

  const activeCourses = useMemo(
    () => initialData.courses.filter((course) => course.status !== 'archived'),
    [initialData.courses],
  );

  const existingEnrollmentKeys = useMemo(
    () => new Set(initialData.enrollments.map((enrollment) => `${enrollment.user_id}:${enrollment.course_id}`)),
    [initialData.enrollments],
  );

  const handleCourseChange = (courseId: string) => {
    const course = activeCourses.find((item) => item.id === courseId);
    setForm((current) => ({
      ...current,
      courseId,
      tuitionTotal: current.id ? current.tuitionTotal : String(course?.tuition_amount || 0),
    }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      if (!form.id && existingEnrollmentKeys.has(`${form.userId}:${form.courseId}`)) {
        toast.error('Học viên đã được ghi danh vào khóa này.');
        return;
      }

      const action = form.id
        ? updateTrainingEnrollment(form.id, toEnrollmentInput(form))
        : createTrainingEnrollment(toEnrollmentInput(form));
      const result = await action;
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(form.id ? 'Đã cập nhật ghi danh' : 'Đã ghi danh học viên');
      window.location.reload();
    });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <aside>
        <form onSubmit={handleSubmit} className="rounded-[var(--brand-card-radius)] border border-border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-950">{form.id ? 'Sửa ghi danh' : 'Ghi danh mới'}</h2>
            {form.id && (
              <button
                type="button"
                onClick={() => setForm({
                  ...blankForm,
                  courseId: activeCourses[0]?.id || '',
                  userId: initialData.studentUsers[0]?.id || '',
                })}
                className="text-xs font-bold text-slate-500 hover:text-primary"
              >
                Hủy sửa
              </button>
            )}
          </div>

          <div className="space-y-3">
            <select
              value={form.userId}
              onChange={(event) => setForm({ ...form, userId: event.target.value })}
              disabled={Boolean(form.id)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-primary disabled:bg-slate-50 disabled:text-slate-500"
            >
              <option value="">Chọn học viên</option>
              {initialData.studentUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name} - {user.email}
                </option>
              ))}
            </select>

            <select
              value={form.courseId}
              onChange={(event) => handleCourseChange(event.target.value)}
              disabled={Boolean(form.id)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-primary disabled:bg-slate-50 disabled:text-slate-500"
            >
              <option value="">Chọn khóa học</option>
              {activeCourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title} - {money(course.tuition_amount)}
                </option>
              ))}
            </select>

            <select
              value={form.enrollmentStatus}
              onChange={(event) => setForm({ ...form, enrollmentStatus: event.target.value as TrainingEnrollmentStatus })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
            >
              {Object.entries(enrollmentStatusLabel).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-3">
              <input
                value={form.tuitionTotal}
                onChange={(event) => setForm({ ...form, tuitionTotal: event.target.value })}
                placeholder="Tổng học phí"
                inputMode="numeric"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
              />
              <input
                value={form.tuitionPaid}
                onChange={(event) => setForm({ ...form, tuitionPaid: event.target.value })}
                placeholder="Đã thu"
                inputMode="numeric"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
              />
            </div>

            <textarea
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              placeholder="Ghi chú học vụ"
              rows={3}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
            />
          </div>

          <button
            type="submit"
            disabled={isPending || !form.userId || !form.courseId}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[var(--brand-button-radius)] bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-primary disabled:opacity-60"
          >
            {form.id ? <CheckCircle2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {form.id ? 'Lưu ghi danh' : 'Ghi danh học viên'}
          </button>
        </form>
      </aside>

      <section className="min-w-0 rounded-[var(--brand-card-radius)] border border-border bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-950">Danh sách ghi danh</h2>
            <p className="text-sm font-semibold text-slate-500">
              {initialData.enrollments.length} hồ sơ học viên trong chi nhánh hiện tại
            </p>
          </div>
        </div>

        {initialData.studentUsers.length === 0 || activeCourses.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <GraduationCap className="mb-4 h-10 w-10 text-slate-400" />
            <h3 className="text-lg font-black text-slate-950">Chưa đủ dữ liệu ghi danh</h3>
            <p className="mt-2 max-w-md text-sm font-semibold text-slate-500">
              Cần có ít nhất một tài khoản role student và một khóa học chưa lưu trữ trước khi ghi danh.
            </p>
          </div>
        ) : initialData.enrollments.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <WalletCards className="mb-4 h-10 w-10 text-slate-400" />
            <h3 className="text-lg font-black text-slate-950">Chưa có học viên ghi danh</h3>
            <p className="mt-2 max-w-md text-sm font-semibold text-slate-500">
              Chọn học viên và khóa học ở form bên trái để tạo hồ sơ học vụ đầu tiên.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {initialData.enrollments.map((enrollment) => (
              <article key={enrollment.id} className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-black text-slate-950">{enrollment.user?.full_name || 'Học viên đã ẩn'}</h3>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black text-slate-500">
                      {enrollmentStatusLabel[enrollment.enrollment_status]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {enrollment.user?.email || 'Chưa có email'} · {enrollment.course?.title || 'Khóa học đã ẩn'}
                  </p>
                  {enrollment.notes && (
                    <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{enrollment.notes}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="text-right text-sm">
                    <p className="font-black text-slate-950">{money(enrollment.tuition_total)}</p>
                    <p className="font-semibold text-slate-500">
                      Đã thu {money(enrollment.tuition_paid)} · Còn {money(getOutstanding(enrollment))}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm({
                      id: enrollment.id,
                      userId: enrollment.user_id,
                      courseId: enrollment.course_id,
                      enrollmentStatus: enrollment.enrollment_status,
                      tuitionTotal: String(enrollment.tuition_total || 0),
                      tuitionPaid: String(enrollment.tuition_paid || 0),
                      notes: enrollment.notes || '',
                    })}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:text-primary"
                    aria-label="Sửa ghi danh"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
