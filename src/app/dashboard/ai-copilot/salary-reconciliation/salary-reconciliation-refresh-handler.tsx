'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { usePageRefresh } from '@/hooks/usePageRefresh';

export function SalaryReconciliationRefreshHandler() {
  const router = useRouter();

  usePageRefresh(useCallback(() => {
    router.refresh();
  }, [router]));

  return null;
}
