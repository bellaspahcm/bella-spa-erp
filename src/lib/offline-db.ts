import Dexie, { type Table } from 'dexie';

export interface OfflineAction {
  id: string;            // Client-generated UUID v4
  actionType: 'CHECKIN' | 'CHECKOUT' | 'SUBMIT_NOTE' | 'SUBMIT_RATING' | 'KTV_SHIFT_CHECKIN' | 'KTV_SHIFT_CHECKOUT';
  payload: any;          // Operational parameters
  localTimestamp: number;// Vietnam GMT+7 timestamp when clicked offline
  retryCount: number;    // Number of attempts to sync
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
