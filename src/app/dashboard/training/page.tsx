import Link from 'next/link';
import {
  BookOpenCheck,
  CalendarDays,
  GraduationCap,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';

const trainingStats = [
  { label: 'Khóa học', value: '0', note: 'Chờ tạo giáo trình đầu tiên' },
  { label: 'Học viên', value: '0', note: 'Chưa mở lớp chính thức' },
  { label: 'Buổi học', value: '0', note: 'Sẽ đồng bộ với lịch đào tạo' },
];

const rolloutSteps = [
  {
    icon: BookOpenCheck,
    title: 'Soạn khóa học',
    description: 'Tạo khóa, chương học, bài học và thời lượng xem tối thiểu cho từng giáo trình.',
  },
  {
    icon: GraduationCap,
    title: 'Ghi danh học viên',
    description: 'Liên kết tài khoản student, khóa học, học phí phải thu và trạng thái học vụ.',
  },
  {
    icon: CalendarDays,
    title: 'Lịch học tập trung',
    description: 'Lên lịch lý thuyết, thực hành, kiểm tra tay nghề và điểm danh từng buổi.',
  },
  {
    icon: WalletCards,
    title: 'Đối soát học phí',
    description: 'Theo dõi tiền đã nộp, công nợ học phí và chuẩn bị luồng phiếu thu riêng.',
  },
];

export default function TrainingDashboardPage() {
  return (
    <div className="min-h-screen bg-background/30 p-6 lg:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-[var(--brand-card-radius)] border border-border bg-white/80 p-6 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">
              <ShieldCheck className="h-4 w-4" />
              Phase 1 foundation
            </div>
            <h1 className="text-3xl font-black text-slate-950">Đào tạo học viên</h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-600">
              Quản lý khóa học, học viên, lịch học và học phí theo từng tenant. Phần này đang mở nền quản trị trước khi bật ghi danh và portal học tập chính thức.
            </p>
          </div>
          <Link
            href="/dashboard/training/courses"
            className="inline-flex items-center justify-center rounded-[var(--brand-button-radius)] border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-800 shadow-sm transition hover:border-primary hover:text-primary"
          >
            Mở giáo trình
          </Link>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {trainingStats.map((stat) => (
            <div key={stat.label} className="rounded-[var(--brand-card-radius)] border border-border bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{stat.label}</p>
              <p className="mt-3 text-3xl font-black text-slate-950">{stat.value}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">{stat.note}</p>
            </div>
          ))}
        </section>

        <section className="rounded-[var(--brand-card-radius)] border border-border bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-xl font-black text-slate-950">Luồng triển khai quản trị</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Các thao tác ghi dữ liệu sẽ đi qua server action tenant-scoped ở bước tiếp theo.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-4">
            {rolloutSteps.map((step) => {
              const Icon = step.icon;
              return (
                <article key={step.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-black text-slate-950">{step.title}</h3>
                  <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{step.description}</p>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
