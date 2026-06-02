'use client';

import { useState, useEffect } from 'react';
import { offlineDB, type OfflineAction } from '@/lib/offline-db';
import { syncOfflineAction } from '@/services/sync-actions';
import { toast } from 'sonner';

type OfflineQueuedResult = {
  success: true;
  offline: true;
};

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof window !== 'undefined' ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState<number>(0);

  // Sync all actions currently in queue in sequence (FIFO)
  const triggerSync = async () => {
    if (!offlineDB) return;
    const pendingActions = await offlineDB.offlineQueue
      .where('status')
      .anyOf(['pending', 'failed'])
      .sortBy('localTimestamp');

    if (pendingActions.length === 0) return;

    toast.info(`Đang đồng bộ hóa ${pendingActions.length} hành động ngoại tuyến...`);

    for (const action of pendingActions) {
      await syncOfflineAction(action);
    }

    // Recalculate pending count
    const remaining = await offlineDB.offlineQueue.count();
    setPendingCount(remaining);

    if (remaining === 0) {
      toast.success('Đồng bộ dữ liệu ngoại tuyến thành công 100%!');
    } else {
      toast.error(`Đồng bộ còn sót lại ${remaining} bản ghi gặp lỗi.`);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Kết nối mạng đã được khôi phục!');
      triggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('Mất kết nối mạng! Hệ thống chuyển sang chế độ lưu trữ ngoại tuyến.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check and trigger sync if online
    const checkQueue = async () => {
      if (offlineDB) {
        const count = await offlineDB.offlineQueue.count();
        setPendingCount(count);
        if (navigator.onLine && count > 0) {
          triggerSync();
        }
      }
    };
    checkQueue();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const executeAction = async <TResult>(
    actionType: OfflineAction['actionType'],
    payload: OfflineAction['payload'],
    serverAction: () => Promise<TResult>
  ): Promise<TResult | OfflineQueuedResult> => {
    if (typeof window !== 'undefined' && !navigator.onLine) {
      // Offline mode: save to Dexie database queue
      if (!offlineDB) {
        throw new Error('Database ngoại tuyến không khả dụng.');
      }

      const id = crypto.randomUUID(); // Client-generated UUID to ensure uniqueness
      const offlineAction: OfflineAction = {
        id,
        actionType: actionType as OfflineAction['actionType'],
        payload,
        localTimestamp: Date.now(),
        retryCount: 0,
        status: 'pending'
      };

      await offlineDB.offlineQueue.add(offlineAction);
      
      const count = await offlineDB.offlineQueue.count();
      setPendingCount(count);

      toast.warning(
        `Đã lưu tạm yêu cầu ngoại tuyến thành công! Hệ thống sẽ tự động đồng bộ khi có mạng.`,
        { duration: 6000 }
      );
      
      return { success: true, offline: true };
    }

    // Online mode: run normally
    return await serverAction();
  };

  const refreshQueue = async () => {
    if (offlineDB) {
      const count = await offlineDB.offlineQueue.count();
      setPendingCount(count);
    }
  };

  return {
    isOnline,
    pendingCount,
    executeAction,
    triggerSync,
    refreshQueue
  };
}
