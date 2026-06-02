import { startSession, completeKTVSession } from '@/services/ktv-actions';
import { ktvCheckIn, ktvCheckOut } from '@/services/attendance-actions';
import { offlineDB, type OfflineAction } from '@/lib/offline-db';

function getErrorMessage(error: unknown, fallback = 'Offline sync failed') {
  if (error instanceof Error) return error.message.trim() ? error.message : fallback;
  if (typeof error === 'string') return error.trim() ? error : fallback;
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return String(error) || fallback;
}

export async function syncOfflineAction(action: OfflineAction) {
  if (!offlineDB) return;

  try {
    // Mark action as currently syncing
    await offlineDB.offlineQueue.update(action.id, { status: 'syncing' });

    if (action.actionType === 'CHECKIN') {
      const { sessionId } = action.payload;
      await startSession(sessionId);
    } else if (action.actionType === 'CHECKOUT') {
      const { sessionId, notes, ktvCheckoutNote } = action.payload;
      await completeKTVSession(sessionId, notes, ktvCheckoutNote);
    } else if (action.actionType === 'KTV_SHIFT_CHECKIN') {
      const res = await ktvCheckIn();
      if (!res.success) {
        throw new Error(res.error || 'Shift check-in failed');
      }
    } else if (action.actionType === 'KTV_SHIFT_CHECKOUT') {
      const res = await ktvCheckOut();
      if (!res.success) {
        throw new Error(res.error || 'Shift check-out failed');
      }
    }

    // Successfully completed! Delete from IndexedDB queue
    await offlineDB.offlineQueue.delete(action.id);
  } catch (error: unknown) {
    console.error(`[SyncService] Failed to sync offline action ${action.id}:`, error);
    
    // Set status to failed and increment retry count
    await offlineDB.offlineQueue.update(action.id, {
      status: 'failed',
      retryCount: (action.retryCount || 0) + 1,
      errorMessage: getErrorMessage(error)
    });
  }
}
