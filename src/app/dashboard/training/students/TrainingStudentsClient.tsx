'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { CheckCircle2, Copy, Loader2, Mail, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { copyToClipboard } from '@/lib/utils';

import { createTrainingStudentAccount } from '@/services/training-actions';
import type { TrainingStudentAccountOverview } from '@/types/training';

type StudentFormState = {
  fullName: string;
  email: string;
};

const blankForm: StudentFormState = {
  fullName: '',
  email: '',
};

export function TrainingStudentsClient({ initialData }: { initialData: TrainingStudentAccountOverview }) {
  const [form, setForm] = useState<StudentFormState>(blankForm);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreatedPassword(null);
    startTransition(async () => {
      const result = await createTrainingStudentAccount({
        fullName: form.fullName,
        email: form.email,
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      setCreatedPassword(result.data.defaultPassword);
      setForm(blankForm);
      toast.success('Đã tạo tài khoản học viên');
    });
  };

  const copyPassword = async () => {
    if (!createdPassword) return;
    const success = await copyToClipboard(createdPassword);
    if (success) {
      toast.success('Đã copy mật khẩu tạm');
    } else {
      toast.error('Không thể tự động sao chép mật khẩu');
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <aside className="space-y-5">
        <form onSubmit={handleSubmit} className="rounded-[var(--brand-card-radius)] border border-border bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-black text-slate-950">Tạo học viên</h2>
          <div className="space-y-3">
            <input
              value={form.fullName}
              onChange={(event) => setForm({ ...form, fullName: event.target.value })}
              placeholder="Họ tên học viên"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
            />
            <input
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="Email đăng nhập"
              type="email"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
            />
          </div>
          <button
            type="submit"
            disabled={isPending || !form.fullName || !form.email}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[var(--brand-button-radius)] bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-primary disabled:opacity-60"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang tạo...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Tạo tài khoản student
              </>
            )}
          </button>
        </form>

        {createdPassword && (
          <section className="rounded-[var(--brand-card-radius)] border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-black text-emerald-800">
              <CheckCircle2 className="h-4 w-4" />
              Tài khoản đã tạo
            </div>
            <p className="text-xs font-bold text-emerald-700">
              Mật khẩu tạm chỉ hiện ở bước này. Gửi cho học viên và yêu cầu đổi mật khẩu sau khi đăng nhập.
            </p>
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-white p-3">
              <code className="min-w-0 flex-1 truncate text-sm font-black text-slate-950">{createdPassword}</code>
              <button
                type="button"
                onClick={copyPassword}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:text-primary"
                aria-label="Copy mật khẩu tạm"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </section>
        )}
      </aside>

      <section className="min-w-0 rounded-[var(--brand-card-radius)] border border-border bg-white p-5 shadow-sm">
        <div className="mb-5">
          <h2 className="text-xl font-black text-slate-950">Danh sách học viên</h2>
          <p className="text-sm font-semibold text-slate-500">
            {initialData.studentUsers.length} tài khoản student trong chi nhánh hiện tại
          </p>
        </div>

        {initialData.studentUsers.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <UserPlus className="mb-4 h-10 w-10 text-slate-400" />
            <h3 className="text-lg font-black text-slate-950">Chưa có tài khoản học viên</h3>
            <p className="mt-2 max-w-md text-sm font-semibold text-slate-500">
              Tạo học viên đầu tiên, sau đó chuyển sang màn ghi danh để gắn học viên với khóa học.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {initialData.studentUsers.map((student) => (
              <article key={student.id} className="flex flex-col gap-2 py-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="font-black text-slate-950">{student.full_name}</h3>
                  <p className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-slate-500">
                    <Mail className="h-4 w-4" />
                    {student.email}
                  </p>
                </div>
                <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                  {student.status || 'active'}
                </span>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
