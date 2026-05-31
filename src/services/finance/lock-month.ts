'use server';

import { lockMonth as lockMonthAction } from './lock-month-action';
import { unlockMonth as unlockMonthAction } from './unlock-month-action';

export async function lockMonth(month: string) {
  return lockMonthAction(month);
}

export async function unlockMonth(month: string) {
  return unlockMonthAction(month);
}
