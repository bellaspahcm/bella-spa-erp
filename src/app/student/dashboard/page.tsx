import Link from 'next/link';
import { BookOpenCheck, CalendarDays, LockKeyhole, WalletCards } from 'lucide-react';

const studentCards = [
  {
    icon: BookOpenCheck,
    title: 'Bài học',
    description: 'Portal học tập sẽ mở bài theo trình tự sau khi giáo trình được kích hoạt.',
  },
  {
    icon: CalendarDays,
    title: 'Lịch học',
    description: 'Lịch lý thuyết và thực hành tập trung sẽ hiển thị theo hồ sơ ghi danh.',
  },
  {
    icon: WalletCards,
    title: 'Học phí',
    description: 'Học viên chỉ xem được bảng kê học phí của chính mình.',
  },
];

export default function StudentDashboardPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        <section className="rounded-2xl bg-slate-950 p-6 text-white shadow-lg">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-emerald-200">
            <LockKeyhole className="h-4 w-4" />
            Student portal
          </div>
          <h1 className="text-3xl font-black">Cổng học viên</h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">
            Đây là không gian học tập riêng cho học viên. Tài khoản học viên không truy cập dashboard vận hành, khách hàng, tài chính, kho hay bảng lương của spa.
          </p>
        </section>

        <section className="grid gap-4">
          {studentCards.map((card) => {
            const Icon = card.icon;
            return (
              <article key={card.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-950">{card.title}</h2>
                    <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{card.description}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

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
