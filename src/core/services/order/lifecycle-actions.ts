'use server';

import {
  generateShareToken as generateShareTokenAction,
  getBookingDetailsWithPayment as getBookingDetailsWithPaymentAction,
  recordRemainingPayment as recordRemainingPaymentAction,
} from './payment-actions';
import { createBooking as createBookingAction } from './create-booking-action';
import { reusePackage as reusePackageAction } from './reuse-package-action';
import { submitOnlineBooking as submitOnlineBookingAction } from './online-booking-action';
import {
  syncBookingProgress as syncBookingProgressAction,
  updateBooking as updateBookingAction,
} from './update-booking-action';
import type { OnlineBookingFormData } from './online-booking-types';
import {
  getBookings as getBookingsAction,
  getBookingsByCustomerId as getBookingsByCustomerIdAction,
  getDraftBooking as getDraftBookingAction,
  getPackages as getPackagesAction,
} from './query-actions';

export type { OnlineBookingFormData } from './online-booking-types';

export async function updateBooking(
  id: string,
  payload: Parameters<typeof updateBookingAction>[1],
  options?: Parameters<typeof updateBookingAction>[2]
) {
  return updateBookingAction(id, payload, options);
}

export async function syncBookingProgress(bookingId: string) {
  return syncBookingProgressAction(bookingId);
}

export async function submitOnlineBooking(formData: OnlineBookingFormData) {
  return submitOnlineBookingAction(formData);
}

export async function getPackages() {
  return getPackagesAction();
}

export async function getBookings() {
  return getBookingsAction();
}

export async function getBookingsByCustomerId(customerId: string) {
  return getBookingsByCustomerIdAction(customerId);
}

export async function getDraftBooking(customerId: string) {
  return getDraftBookingAction(customerId);
}

export async function reusePackage(bookingId: string) {
  return reusePackageAction(bookingId);
}

export async function createBooking(formData: Parameters<typeof createBookingAction>[0]) {
  return createBookingAction(formData);
}

export async function recordRemainingPayment(
  params: Parameters<typeof recordRemainingPaymentAction>[0]
) {
  return recordRemainingPaymentAction(params);
}

export async function generateShareToken(bookingId: string) {
  return generateShareTokenAction(bookingId);
}

export async function getBookingDetailsWithPayment(bookingId: string) {
  return getBookingDetailsWithPaymentAction(bookingId);
}
