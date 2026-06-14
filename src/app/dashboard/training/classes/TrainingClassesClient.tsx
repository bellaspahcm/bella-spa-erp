'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { CalendarDays, CheckCircle2, MapPin, Pencil, Plus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { PremiumSelect } from '@/components/ui/PremiumSelect';

import {
  createTrainingClass,
  updateTrainingClass,
} from '@/services/training-actions';
import type {
  TrainingClassAdminOverview,
  TrainingClassInput,
  TrainingClassStatus,
  TrainingClassType,
  TrainingClassWithDetails,
} from '@/types/training';

type ClassFormState = {
  id?: string;
  courseId: string;
  trainerId: string;
  title: string;
  classType: TrainingClassType;
  startsAt: string;
  endsAt: string;
  locationNote: string;
  capacity: string;
  status: TrainingClassStatus;
};

const blankForm: ClassFormState = {
  courseId: '',
  trainerId: '',
  title: '',
  classType: 'practice',
  startsAt: '',
  endsAt: '',
  locationNote: '',
  capacity: '12',
  status: 'scheduled',
};

const classTypeLabel: Record<TrainingClassType, string> = {
  theory: 'Lý thuyết',
  practice: 'Thực hành',
  exam: 'Kiểm tra',
  orientation: 'Định hướng',
};

const classStatusLabel: Record<TrainingClassStatus, string> = {
  scheduled: 'Đã lên lịch',
  completed: 'Đã hoàn tất',
  cancelled: 'Đã hủy',
};

function toDateTimeLocal(value: string | null) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const offsetMs = parsed.getTimezoneOffset() * 60_000;
  return new Date(parsed.getTime() - offsetMs).toISOString().slice(0, 16);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function toClassInput(form: ClassFormState): TrainingClassInput {
  return {
    courseId: form.courseId,
    trainerId: form.trainerId || null,
    title: form.title,
    classType: form.classType,
    startsAt: form.startsAt,
    endsAt: form.endsAt || null,
    locationNote: form.locationNote,
    capacity: form.capacity,
    status: form.status,
  };
}

export function TrainingClassesClient({ initialData }: { initialData: TrainingClassAdminOverview }) {
  const activeCourses = initialData.courses.filter((course) => course.status !== 'archived');
  const [form, setForm] = useState<ClassFormState>({
    ...blankForm,
    courseId: activeCourses[0]?.id || '',
  });
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const action = form.id
        ? updateTrainingClass(form.id, toClassInput(form))
        : createTrainingClass(toClassInput(form));
      const result = await action;
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(form.id ? 'Đã cập nhật lịch lớp' : 'Đã tạo lịch lớp');
      window.location.reload();
    });
  };

  const editClass = (trainingClass: TrainingClassWithDetails) => {
    setForm({
      id: trainingClass.id,
      courseId: trainingClass.course_id,
      trainerId: trainingClass.trainer_id || '',
      title: trainingClass.title,
      classType: trainingClass.class_type,
      startsAt: toDateTimeLocal(trainingClass.starts_at),
      endsAt: toDateTimeLocal(trainingClass.ends_at),
      locationNote: trainingClass.location_note || '',
      capacity: String(trainingClass.capacity || 12),
      status: trainingClass.status,
    });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <aside>
        <form onSubmit={handleSubmit} className="rounded-[var(--brand-card-radius)] border border-border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-950">{form.id ? 'Sửa lịch lớp' : 'Tạo lịch lớp'}</h2>
            {form.id && (
              <button
                type="button"
                onClick={() => setForm({ ...blankForm, courseId: activeCourses[0]?.id || '' })}
                className="text-xs font-bold text-slate-500 hover:text-primary"
              >
                Hủy sửa
              </button>
            )}
          </div>

          <div className="space-y-3">
            <PremiumSelect
              value={form.courseId}
              options={[
                { value: '', label: 'Chọn khóa học' },
                ...activeCourses.map((course) => ({ value: course.id, label: course.title }))
              ]}
              onChange={(val) => setForm({ ...form, courseId: val })}
              disabled={Boolean(form.id)}
              placeholder="Chọn khóa học"
            />

            <input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="Tên buổi học"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
            />

            <div className="grid grid-cols-2 gap-3">
              <PremiumSelect
                value={form.classType}
                options={Object.entries(classTypeLabel).map(([value, label]) => ({ value, label }))}
                onChange={(val) => setForm({ ...form, classType: val as TrainingClassType })}
                placeholder="Loại lớp"
              />
              <PremiumSelect
                value={form.status}
                options={Object.entries(classStatusLabel).map(([value, label]) => ({ value, label }))}
                onChange={(val) => setForm({ ...form, status: val as TrainingClassStatus })}
                placeholder="Trạng thái"
              />
            </div>

            <PremiumSelect
              value={form.trainerId}
              options={[
                { value: '', label: 'Chưa phân công giảng viên' },
                ...initialData.trainers.map((trainer) => ({
                  value: trainer.id,
                  label: `${trainer.full_name} - ${trainer.role}`
                }))
              ]}
              onChange={(val) => setForm({ ...form, trainerId: val })}
              placeholder="Chưa phân công giảng viên"
            />

            <div className="grid grid-cols-2 gap-3">
              <input
                value={form.startsAt}
                onChange={(event) => setForm({ ...form, startsAt: event.target.value })}
                type="datetime-local"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
              />
              <input
                value={form.endsAt}
                onChange={(event) => setForm({ ...form, endsAt: event.target.value })}
                type="datetime-local"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
              />
            </div>


            <div className="grid grid-cols-[1fr_110px] gap-3">
              <input
                value={form.locationNote}
                onChange={(event) => setForm({ ...form, locationNote: event.target.value })}
                placeholder="Địa điểm / phòng học"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
              />
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sức chứa</span>
                <input
                  value={form.capacity}
                  onChange={(event) => setForm({ ...form, capacity: event.target.value })}
                  inputMode="numeric"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
                />
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending || !form.courseId || !form.title || !form.startsAt}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[var(--brand-button-radius)] bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-primary disabled:opacity-60"
          >
            {form.id ? <CheckCircle2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {form.id ? 'Lưu lịch lớp' : 'Tạo lịch lớp'}
          </button>
        </form>
      </aside>

      <section className="min-w-0 rounded-[var(--brand-card-radius)] border border-border bg-white p-5 shadow-sm">
        <div className="mb-5">
          <h2 className="text-xl font-black text-slate-950">Danh sách lịch lớp</h2>
          <p className="text-sm font-semibold text-slate-500">
            {initialData.classes.length} buổi học trong chi nhánh hiện tại
          </p>
        </div>

        {activeCourses.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <CalendarDays className="mb-4 h-10 w-10 text-slate-400" />
            <h3 className="text-lg font-black text-slate-950">Chưa có khóa học để xếp lịch</h3>
            <p className="mt-2 max-w-md text-sm font-semibold text-slate-500">
              Tạo khóa học trước, sau đó quay lại để xếp lịch lý thuyết, thực hành hoặc kiểm tra.
            </p>
          </div>
        ) : initialData.classes.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <CalendarDays className="mb-4 h-10 w-10 text-slate-400" />
            <h3 className="text-lg font-black text-slate-950">Chưa có lịch lớp</h3>
            <p className="mt-2 max-w-md text-sm font-semibold text-slate-500">
              Dùng form bên trái để tạo buổi học đầu tiên cho khóa đào tạo.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {initialData.classes.map((trainingClass) => (
              <article key={trainingClass.id} className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-black text-slate-950">{trainingClass.title}</h3>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black text-slate-500">
                      {classTypeLabel[trainingClass.class_type]}
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700">
                      {classStatusLabel[trainingClass.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {trainingClass.course?.title || 'Khóa học đã ẩn'} · {formatDateTime(trainingClass.starts_at)}
                    {trainingClass.ends_at ? ` - ${formatDateTime(trainingClass.ends_at)}` : ''}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs font-bold text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {trainingClass.trainer?.full_name || 'Chưa phân công'}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {trainingClass.location_note || 'Chưa có địa điểm'}
                    </span>
                    <span>Sức chứa {trainingClass.capacity}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => editClass(trainingClass)}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:text-primary"
                  aria-label="Sửa lịch lớp"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
