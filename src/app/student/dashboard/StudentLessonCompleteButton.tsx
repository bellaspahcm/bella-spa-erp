'use client';

import { useTransition } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { markStudentLessonComplete } from '@/services/training-actions';

export function StudentLessonCompleteButton({
  lessonId,
  isCompleted,
}: {
  lessonId: string;
  isCompleted: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isCompleted || isPending}
      onClick={() => {
        startTransition(async () => {
          const result = await markStudentLessonComplete(lessonId);
          if (!result.success) {
            toast.error(result.error);
            return;
          }
          toast.success('Đã hoàn thành bài học');
          window.location.reload();
        });
      }}
      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700 disabled:border-emerald-100 disabled:bg-emerald-50 disabled:text-emerald-700"
    >
      {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
      {isCompleted ? 'Đã xong' : 'Hoàn thành'}
    </button>
  );
}
