import { startSession, completeKTVSession } from '@/services/ktv-actions';
import { ktvCheckIn, ktvCheckOut } from '@/services/attendance-actions';
import {
  offlineDB,
  type CheckinPayload,
  type CheckoutPayload,
  type OfflineAction,
  type OfflineActionPayload
} from '@/lib/offline-db';

function getErrorMessage(error: unknown, fallback = 'Offline sync failed') {
  if (error instanceof Error) return error.message.trim() ? error.message : fallback;
  if (typeof error === 'string') return error.trim() ? error : fallback;
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return String(error) || fallback;
}

function hasSessionId(payload: OfflineActionPayload): payload is OfflineActionPayload & { sessionId: string } {
  return 'sessionId' in payload && typeof payload.sessionId === 'string' && payload.sessionId.length > 0;
}

function requireSessionPayload(payload: OfflineActionPayload, actionType: OfflineAction['actionType']): CheckinPayload {
  if (!hasSessionId(payload)) {
    throw new Error(`Invalid offline ${actionType} payload: missing sessionId`);
  }
  return payload;
}

function requireCheckoutPayload(payload: OfflineActionPayload): CheckoutPayload {
  const sessionPayload = requireSessionPayload(payload, 'CHECKOUT');
  return sessionPayload;
}

export async function syncOfflineAction(action: OfflineAction) {
  if (!offlineDB) return;

  try {
    // Mark action as currently syncing
    await offlineDB.offlineQueue.update(action.id, { status: 'syncing' });

    if (action.actionType === 'CHECKIN') {
      const { sessionId, lat, lon } = requireSessionPayload(action.payload, action.actionType);
      await startSession(sessionId, lat, lon);
    } else if (action.actionType === 'CHECKOUT') {
      const { sessionId, notes, ktvCheckoutNote, lat, lon } = requireCheckoutPayload(action.payload);
      await completeKTVSession(sessionId, notes, ktvCheckoutNote, lat, lon);
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
