'use client';

import { useEffect } from 'react';
import {
  BELLA_PAGE_REFRESH_EVENT,
  type BellaPageRefreshEvent,
} from '@/lib/page-refresh';

export function usePageRefresh(onRefresh: () => void | Promise<void>) {
  useEffect(() => {
    const listener = (event: Event) => {
      const refreshEvent = event as BellaPageRefreshEvent;
      if (!refreshEvent.detail) return;

      refreshEvent.detail.handled = true;
      refreshEvent.detail.done = Promise.resolve(onRefresh()).then(() => undefined);
    };

    window.addEventListener(BELLA_PAGE_REFRESH_EVENT, listener);
    return () => window.removeEventListener(BELLA_PAGE_REFRESH_EVENT, listener);
  }, [onRefresh]);
}
