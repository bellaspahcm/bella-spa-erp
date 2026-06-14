import Link from 'next/link';
import { ArrowLeft, UserPlus } from 'lucide-react';

import { getTrainingStudentAccountOverview } from '@/services/training-actions';
import { TrainingStudentsClient } from './TrainingStudentsClient';

export default async function TrainingStudentsPage() {
  const result = await getTrainingStudentAccountOverview();

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
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-slate-950">Tài khoản học viên</h1>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Tạo tài khoản role student trong chi nhánh hiện tại trước khi ghi danh khóa học.
                </p>
              </div>
            </div>
          </div>
          <Link
            href="/dashboard/training/enrollments"
            className="inline-flex items-center justify-center rounded-[var(--brand-button-radius)] border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-800 shadow-sm transition hover:border-primary hover:text-primary"
          >
            Ghi danh học viên
          </Link>
        </header>

        {!result.success ? (
          <section className="rounded-[var(--brand-card-radius)] border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
            {result.error}
          </section>
        ) : (
          <TrainingStudentsClient initialData={result.data} />
        )}
      </div>
    </div>
  );
}
