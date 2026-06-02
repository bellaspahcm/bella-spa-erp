import Dexie, { type Table } from 'dexie';

export type OfflineActionType =
  | 'CHECKIN'
  | 'CHECKOUT'
  | 'SUBMIT_NOTE'
  | 'SUBMIT_RATING'
  | 'KTV_SHIFT_CHECKIN'
  | 'KTV_SHIFT_CHECKOUT';

export type CheckinPayload = {
  sessionId: string;
  lat?: number;
  lon?: number;
};

export type CheckoutPayload = {
  sessionId: string;
  notes?: string;
  ktvCheckoutNote?: string;
  lat?: number;
  lon?: number;
};

export type SubmitNotePayload = {
  sessionId: string;
  notes: string;
};

export type SubmitRatingPayload = {
  sessionId: string;
  rating: number;
  comment?: string;
};

export type ShiftPayload = Record<string, never>;

export type OfflineActionPayload =
  | CheckinPayload
  | CheckoutPayload
  | SubmitNotePayload
  | SubmitRatingPayload
  | ShiftPayload;

export interface OfflineAction {
  id: string;             // Client-generated UUID v4
  actionType: OfflineActionType;
  payload: OfflineActionPayload;
  localTimestamp: number; // Vietnam GMT+7 timestamp when clicked offline
  retryCount: number;     // Number of attempts to sync
  status: 'pending' | 'syncing' | 'failed';
  errorMessage?: string;
}

class BellaSpaOfflineDB extends Dexie {
  offlineQueue!: Table<OfflineAction, string>;

  constructor() {
    super('BellaSpaOfflineDB');
    this.version(1).stores({
      offlineQueue: 'id, actionType, status, localTimestamp'
    });
  }
}

// Ensure database is only initialized on client-side to prevent SSR compilation errors in Next.js
export const offlineDB = typeof window !== 'undefined' ? new BellaSpaOfflineDB() : null;
