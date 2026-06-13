import Link from 'next/link';
import { ArrowLeft, BookOpenCheck } from 'lucide-react';

import { getTrainingAdminOverview } from '@/services/training-actions';
import { TrainingCoursesClient } from './TrainingCoursesClient';

export default async function TrainingCoursesPage() {
  const result = await getTrainingAdminOverview();

  return (
    <div className="min-h-screen bg-background/30 p-6 lg:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <Link
              href="/dashboard/training"
              className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              Đào tạo học viên
            </Link>
            <div className="flex items-center gap-3">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-white">
                <BookOpenCheck className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-slate-950">Khóa học & giáo trình</h1>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Tạo khóa học, chia chương và cấu hình bài học tuần tự cho học viên.
                </p>
              </div>
            </div>
          </div>
        </header>

        {!result.success ? (
          <section className="rounded-[var(--brand-card-radius)] border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
            {result.error}
          </section>
        ) : (
          <TrainingCoursesClient initialCourses={result.data} />
        )}
      </div>
    </div>
  );
}
