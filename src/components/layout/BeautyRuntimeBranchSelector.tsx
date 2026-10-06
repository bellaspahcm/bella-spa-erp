'use client';

import { useEffect, useState, useTransition } from 'react';
import { GitFork } from 'lucide-react';
import { toast } from 'sonner';
import {
  getBeautyRuntimeBranchContext,
  selectBeautyRuntimeBranch,
  type BeautyRuntimeBranch,
} from '@/services/beauty-runtime-branch-actions';
import { cn } from '@/lib/utils';

const ACTIVE_BRANCH_STORAGE_KEY = 'bella.beauty.active_branch.v1';

type BeautyRuntimeBranchSelectorProps = {
  enabled: boolean;
};

function readStoredBranchId() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(ACTIVE_BRANCH_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredBranchId(branchId: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ACTIVE_BRANCH_STORAGE_KEY, branchId);
  } catch {
    // Browser storage is only the UI carrier; server actions revalidate access.
  }
}

export function BeautyRuntimeBranchSelector({ enabled }: BeautyRuntimeBranchSelectorProps) {
  const [branches, setBranches] = useState<BeautyRuntimeBranch[]>([]);
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
  const [requiresSelection, setRequiresSelection] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const storedBranchId = readStoredBranchId();

    startTransition(() => {
      void getBeautyRuntimeBranchContext(storedBranchId).then((result) => {
        if (cancelled) return;
        if (!result.success) {
          setBranches([]);
          setActiveBranchId(null);
          setRequiresSelection(false);
          return;
        }

        setBranches(result.data.branches);
        setActiveBranchId(result.data.activeBranchId);
        setRequiresSelection(result.data.requiresSelection);
        if (result.data.activeBranchId) {
          writeStoredBranchId(result.data.activeBranchId);
        }
      });
    });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  if (!enabled || branches.length === 0) return null;

  function handleChange(branchId: string) {
    if (!branchId) return;

    startTransition(() => {
      void selectBeautyRuntimeBranch(branchId).then((result) => {
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        setActiveBranchId(result.data.activeBranchId);
        setRequiresSelection(false);
        writeStoredBranchId(result.data.activeBranchId);
        window.dispatchEvent(new CustomEvent('beauty-runtime-branch-change', {
          detail: { branchId: result.data.activeBranchId },
        }));
      });
    });
  }

  return (
    <div className="px-3 pb-2">
      <label className="mb-1.5 flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.16em] text-primary/65 dark:text-[#A67D44]/70">
        <GitFork className="h-3 w-3" />
        Chi nhánh
      </label>
      <select
        value={activeBranchId ?? ''}
        onChange={(event) => handleChange(event.target.value)}
        disabled={isPending}
        className={cn(
          'h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-800 shadow-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 dark:border-slate-800 dark:bg-[#181a20] dark:text-slate-100',
          requiresSelection && 'border-amber-400 ring-2 ring-amber-200/70',
        )}
        aria-label="Chọn chi nhánh hoạt động"
      >
        <option value="" disabled>
          Chọn chi nhánh
        </option>
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </select>
    </div>
  );
}
