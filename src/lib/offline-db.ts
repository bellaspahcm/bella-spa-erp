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

// Cache data structures for read operations
export interface CachedSessions {
  userId: string;
  activeSessions: unknown[];
  upcomingSessions: unknown[];
  timestamp: number;
  expiresAt: number; // TTL: 5 minutes
}

export interface CachedEarnings {
  userId: string;
  month: string;
  data: { total: number; sessions: number };
  timestamp: number;
  expiresAt: number; // TTL: 10 minutes
}

export interface CachedAttendance {
  userId: string;
  date: string; // YYYY-MM-DD
  data: unknown;
  timestamp: number;
  expiresAt: number; // TTL: 1 minute (fresh data important)
}

export interface CachedNotifications {
  userId: string;
  data: unknown[];
  timestamp: number;
  expiresAt: number; // TTL: 3 minutes
}

class BellaSpaOfflineDB extends Dexie {
  offlineQueue!: Table<OfflineAction, string>;
  cachedSessions!: Table<CachedSessions, string>;
  cachedEarnings!: Table<CachedEarnings, string>;
  cachedAttendance!: Table<CachedAttendance, string>;
  cachedNotifications!: Table<CachedNotifications, string>;

  constructor() {
    super('BellaSpaOfflineDB');
    
    // Version 1: Original offline queue
    this.version(1).stores({
      offlineQueue: 'id, actionType, status, localTimestamp'
    });
    
    // Version 2: Add read data caching
    this.version(2).stores({
      offlineQueue: 'id, actionType, status, localTimestamp',
      cachedSessions: 'userId, timestamp',
      cachedEarnings: '[userId+month], timestamp',
      cachedAttendance: '[userId+date], timestamp',
      cachedNotifications: 'userId, timestamp',
    });
  }
}

// Ensure database is only initialized on client-side to prevent SSR compilation errors in Next.js
export const offlineDB = typeof window !== 'undefined' ? new BellaSpaOfflineDB() : null;

// ─────────────────────────────────────────────────────────────────────────────
// Cache Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_TTL = {
  SESSIONS: 5 * 60 * 1000,      // 5 minutes
  EARNINGS: 10 * 60 * 1000,     // 10 minutes
  ATTENDANCE: 1 * 60 * 1000,    // 1 minute (needs fresh data)
  NOTIFICATIONS: 3 * 60 * 1000, // 3 minutes
};

/**
 * Get cached sessions for user
 * Returns null if cache miss or expired
 */
export async function getCachedSessions(userId: string): Promise<{ active: unknown[]; upcoming: unknown[] } | null> {
  if (!offlineDB) return null;
  
  try {
    const cached = await offlineDB.cachedSessions.get(userId);
    if (!cached) return null;
    
    const now = Date.now();
    if (now > cached.expiresAt) {
      // Expired - delete and return null
      await offlineDB.cachedSessions.delete(userId);
      return null;
    }
    
    return {
      active: cached.activeSessions,
      upcoming: cached.upcomingSessions,
    };
  } catch (error) {
    console.error('[Cache] Failed to get cached sessions:', error);
    return null;
  }
}

/**
 * Cache sessions for user
 */
export async function setCachedSessions(
  userId: string,
  activeSessions: unknown[],
  upcomingSessions: unknown[]
): Promise<void> {
  if (!offlineDB) return;
  
  try {
    const now = Date.now();
    await offlineDB.cachedSessions.put({
      userId,
      activeSessions,
      upcomingSessions,
      timestamp: now,
      expiresAt: now + CACHE_TTL.SESSIONS,
    });
  } catch (error) {
    console.error('[Cache] Failed to cache sessions:', error);
  }
}

/**
 * Get cached earnings for user and month
 */
export async function getCachedEarnings(
  userId: string,
  month: string
): Promise<{ total: number; sessions: number } | null> {
  if (!offlineDB) return null;
  
  try {
    const cached = await offlineDB.cachedEarnings
      .where('[userId+month]')
      .equals([userId, month])
      .first();
    
    if (!cached) return null;
    
    const now = Date.now();
    if (now > cached.expiresAt) {
      await offlineDB.cachedEarnings
        .where('[userId+month]')
        .equals([userId, month])
        .delete();
      return null;
    }
    
    return cached.data;
  } catch (error) {
    console.error('[Cache] Failed to get cached earnings:', error);
    return null;
  }
}

/**
 * Cache earnings for user and month
 */
export async function setCachedEarnings(
  userId: string,
  month: string,
  data: { total: number; sessions: number }
): Promise<void> {
  if (!offlineDB) return;
  
  try {
    const now = Date.now();
    await offlineDB.cachedEarnings.put({
      userId,
      month,
      data,
      timestamp: now,
      expiresAt: now + CACHE_TTL.EARNINGS,
    });
  } catch (error) {
    console.error('[Cache] Failed to cache earnings:', error);
  }
}

/**
 * Get cached attendance for user and date
 */
export async function getCachedAttendance(
  userId: string,
  date: string
): Promise<unknown | null> {
  if (!offlineDB) return null;
  
  try {
    const cached = await offlineDB.cachedAttendance
      .where('[userId+date]')
      .equals([userId, date])
      .first();
    
    if (!cached) return null;
    
    const now = Date.now();
    if (now > cached.expiresAt) {
      await offlineDB.cachedAttendance
        .where('[userId+date]')
        .equals([userId, date])
        .delete();
      return null;
    }
    
    return cached.data;
  } catch (error) {
    console.error('[Cache] Failed to get cached attendance:', error);
    return null;
  }
}

/**
 * Cache attendance for user and date
 */
export async function setCachedAttendance(
  userId: string,
  date: string,
  data: unknown
): Promise<void> {
  if (!offlineDB) return;
  
  try {
    const now = Date.now();
    await offlineDB.cachedAttendance.put({
      userId,
      date,
      data,
      timestamp: now,
      expiresAt: now + CACHE_TTL.ATTENDANCE,
    });
  } catch (error) {
    console.error('[Cache] Failed to cache attendance:', error);
  }
}

/**
 * Clear cached attendance for user and date (force fresh fetch)
 */
export async function clearAttendanceCache(
  userId: string,
  date: string
): Promise<void> {
  if (!offlineDB) return;
  
  try {
    await offlineDB.cachedAttendance
      .where('[userId+date]')
      .equals([userId, date])
      .delete();
    console.log(`[Cache] Cleared attendance cache for user ${userId} on ${date}`);
  } catch (error) {
    console.error('[Cache] Failed to clear attendance cache:', error);
  }
}

/**
 * Get cached notifications for user
 */
export async function getCachedNotifications(userId: string): Promise<unknown[] | null> {
  if (!offlineDB) return null;
  
  try {
    const cached = await offlineDB.cachedNotifications.get(userId);
    if (!cached) return null;
    
    const now = Date.now();
    if (now > cached.expiresAt) {
      await offlineDB.cachedNotifications.delete(userId);
      return null;
    }
    
    return cached.data;
  } catch (error) {
    console.error('[Cache] Failed to get cached notifications:', error);
    return null;
  }
}

/**
 * Cache notifications for user
 */
export async function setCachedNotifications(
  userId: string,
  data: unknown[]
): Promise<void> {
  if (!offlineDB) return;
  
  try {
    const now = Date.now();
    await offlineDB.cachedNotifications.put({
      userId,
      data,
      timestamp: now,
      expiresAt: now + CACHE_TTL.NOTIFICATIONS,
    });
  } catch (error) {
    console.error('[Cache] Failed to cache notifications:', error);
  }
}

/**
 * Clear all cached data for user (e.g., on logout)
 */
export async function clearUserCache(userId: string): Promise<void> {
  if (!offlineDB) return;
  
  try {
    await Promise.all([
      offlineDB.cachedSessions.delete(userId),
      offlineDB.cachedEarnings.where('userId').equals(userId).delete(),
      offlineDB.cachedAttendance.where('userId').equals(userId).delete(),
      offlineDB.cachedNotifications.delete(userId),
    ]);
  } catch (error) {
    console.error('[Cache] Failed to clear user cache:', error);
  }
}
