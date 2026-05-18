import { startSession, completeKTVSession } from '@/services/ktv-actions';
import { ktvCheckIn, ktvCheckOut } from '@/services/attendance-actions';
import { offlineDB, type OfflineAction } from '@/lib/offline-db';

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
  } catch (error: any) {
    console.error(`[SyncService] Failed to sync offline action ${action.id}:`, error);
    
    // Set status to failed and increment retry count
    await offlineDB.offlineQueue.update(action.id, {
      status: 'failed',
      retryCount: (action.retryCount || 0) + 1,
      errorMessage: error?.message || String(error)
    });
  }
}
