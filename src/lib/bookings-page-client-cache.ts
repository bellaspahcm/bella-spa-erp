'use client';

import { getBookings } from '@/modules/booking/actions/lifecycle-actions';
import { getBookingResources } from '@/services/booking-resource-actions';
import { getUsers } from '@/services/user-actions';

type BookingsResult = Awaited<ReturnType<typeof getBookings>>;
type UsersResult = Awaited<ReturnType<typeof getUsers>>;
type BookingResourcesResult = Awaited<ReturnType<typeof getBookingResources>>;

function createClientCache<T>(loader: () => Promise<T>) {
  let loaded = false;
  let cache: T | null = null;
  let promise: Promise<T> | null = null;
  let requestVersion = 0;

  return function getCached(options: { force?: boolean } = {}) {
    if (!options.force && loaded) {
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

export const getCachedBookingsForPage = createClientCache<BookingsResult>(() => getBookings());
export const getCachedBookingPageUsers = createClientCache<UsersResult>(() => getUsers());
export const getCachedBookingPageResources = createClientCache<BookingResourcesResult>(() => getBookingResources());
