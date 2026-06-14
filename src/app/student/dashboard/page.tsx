import Link from 'next/link';
import {
  BookOpenCheck,
  FileText,
  LockKeyhole,
  WalletCards,
  Video,
} from 'lucide-react';

import { getStudentTrainingPortalOverview } from '@/services/training-actions';
import type { TrainingEnrollmentStatus } from '@/types/training';
import { StudentLessonCompleteButton } from './StudentLessonCompleteButton';
import { StudentChangePasswordForm } from './StudentChangePasswordForm';

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

export default async function StudentDashboardPage() {
  const result = await getStudentTrainingPortalOverview();

  if (!result.success) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
          {result.error}
        </div>
      </main>
    );
  }

  const totalLessons = result.data.enrollments.reduce((total, enrollment) => (
    total + (enrollment.course?.modules.reduce((moduleTotal, courseModule) => (
      moduleTotal + courseModule.lessons.length
    ), 0) || 0)
  ), 0);
  const completedLessons = result.data.enrollments.reduce((total, enrollment) => (
    total + (enrollment.course?.modules.reduce((moduleTotal, courseModule) => (
      moduleTotal + courseModule.lessons.filter((lesson) => lesson.progress?.is_completed).length
    ), 0) || 0)
  ), 0);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <section className="rounded-2xl bg-slate-950 p-6 text-white shadow-lg">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-emerald-200">
            <LockKeyhole className="h-4 w-4" />
            Student portal
          </div>
          <h1 className="text-3xl font-black" style={{ color: '#ffffff' }}>Chào {result.data.student.full_name}</h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
            Đây là không gian học tập riêng của bạn. Nội dung bên dưới chỉ lấy từ hồ sơ ghi danh gắn với tài khoản học viên hiện tại.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Khóa đang có</p>
            <p className="mt-3 text-3xl font-black text-slate-950">{result.data.enrollments.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Bài học</p>
            <p className="mt-3 text-3xl font-black text-slate-950">{completedLessons}/{totalLessons}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Tài khoản</p>
              <p className="mt-3 truncate text-base font-black text-slate-950">{result.data.student.email}</p>
            </div>
            <StudentChangePasswordForm />
          </div>
        </section>


        {result.data.enrollments.length === 0 ? (
          <section className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
            <BookOpenCheck className="mb-4 h-10 w-10 text-slate-400" />
            <h2 className="text-lg font-black text-slate-950">Chưa có khóa học được ghi danh</h2>
            <p className="mt-2 max-w-md text-sm font-semibold leading-6 text-slate-500">
              Khi quản trị viên ghi danh bạn vào khóa học, giáo trình sẽ xuất hiện tại đây.
            </p>
          </section>
        ) : (
          <section className="space-y-5">
            {result.data.enrollments.map((enrollment) => {
              const outstanding = Math.max(0, Number(enrollment.tuition_total || 0) - Number(enrollment.tuition_paid || 0));
              const courseLessonCount = enrollment.course?.modules.reduce((total, courseModule) => (
                total + courseModule.lessons.length
              ), 0) || 0;
              const courseCompletedCount = enrollment.course?.modules.reduce((total, courseModule) => (
                total + courseModule.lessons.filter((lesson) => lesson.progress?.is_completed).length
              ), 0) || 0;
              const courseProgress = courseLessonCount > 0
                ? Math.round((courseCompletedCount / courseLessonCount) * 100)
                : 0;
              return (
                <article key={enrollment.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-black text-slate-950">
                          {enrollment.course?.title || 'Khóa học đang cập nhật'}
                        </h2>
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700">
                          {enrollmentStatusLabel[enrollment.enrollment_status]}
                        </span>
                      </div>
                      {enrollment.course?.description && (
                        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
                          {enrollment.course.description}
                        </p>
                      )}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                      <div className="mb-2 flex items-center gap-2 font-black text-slate-950">
                        <WalletCards className="h-4 w-4" />
                        Học phí
                      </div>
                      <p className="font-semibold text-slate-600">Tổng: {money(enrollment.tuition_total)}</p>
                      <p className="font-semibold text-slate-600">Đã thu: {money(enrollment.tuition_paid)}</p>
                      <p className="font-black text-primary">Còn: {money(outstanding)}</p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm font-black text-slate-950">
                      <span>Tiến độ khóa học</span>
                      <span>{courseCompletedCount}/{courseLessonCount} bài · {courseProgress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${courseProgress}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    {enrollment.course?.modules.length ? (
                      enrollment.course.modules.map((courseModule) => (
                        <div key={courseModule.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <h3 className="font-black text-slate-950">
                            {courseModule.sequence_order}. {courseModule.title}
                          </h3>
                          {courseModule.description && (
                            <p className="mt-1 text-sm font-semibold text-slate-500">{courseModule.description}</p>
                          )}
                          <div className="mt-3 grid gap-2">
                            {courseModule.lessons.length === 0 ? (
                              <p className="text-sm font-semibold text-slate-400">Chương này chưa có bài học.</p>
                            ) : (
                              courseModule.lessons.map((lesson) => (
                                <div key={lesson.id} className="flex flex-col gap-3 rounded-lg bg-white px-3 py-2 text-sm sm:flex-row sm:items-start">
                                  <div className="mt-0.5 text-slate-500">
                                    {lesson.content_type === 'video' ? <Video className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-black text-slate-800">
                                      {lesson.sequence_order}. {lesson.title}
                                    </p>
                                    <p className="font-semibold text-slate-500">
                                      Yêu cầu xem {lesson.required_view_seconds}s · {lesson.required_view_percentage}%
                                    </p>
                                  </div>
                                  <StudentLessonCompleteButton
                                    lessonId={lesson.id}
                                    isCompleted={Boolean(lesson.progress?.is_completed)}
                                  />
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-500">
                        Giáo trình của khóa này đang được cập nhật.
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}

        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 shadow-sm"
        >
          Quay lại đăng nhập
        </Link>
      </div>
    </main>
  );
}
