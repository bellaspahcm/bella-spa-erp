'use client';

import { getBookings } from '@/core/services/order';
import { getBookingResources } from '@/services/booking-resource-actions';
import { getUsers } from '@/services/user-actions';

type BookingsResult = Awaited<ReturnType<typeof getBookings>>;
type UsersResult = Awaited<ReturnType<typeof getUsers>>;
type BookingResourcesResult = Awaited<ReturnType<typeof getBookingResources>>;

function createClientCache<T>(loader: () => Promise<T>, ttlMs = 60000) {
  let loaded = false;
  let cache: T | null = null;
  let promise: Promise<T> | null = null;
  let requestVersion = 0;
  let cachedAt = 0;

  return function getCached(options: { force?: boolean } = {}) {
    const now = Date.now();
    const isFresh = loaded && (now - cachedAt) < ttlMs;

    if (!options.force && isFresh) {
      return Promise.resolve(cache as T);
    }

    if (!options.force && promise) {
      return promise;
    }

    const currentVersion = requestVersion + 1;
    requestVersion = currentVersion;
    promise = loader()
      .then((result) => {
        if (currentVersion === requestVersion) {
          cache = result;
          loaded = true;
          cachedAt = Date.now();
        }
        return result;
      })
      .finally(() => {
        if (currentVersion === requestVersion) {
          promise = null;
        }
      });

    return promise;
  };
}

export const getCachedBookingsForPage = createClientCache<BookingsResult>(() => getBookings(), 30000); // 30 seconds TTL for bookings
export const getCachedBookingPageUsers = createClientCache<UsersResult>(() => getUsers(), 300000); // 5 minutes TTL for users
export const getCachedBookingPageResources = createClientCache<BookingResourcesResult>(() => getBookingResources(), 300000); // 5 minutes TTL for rooms

