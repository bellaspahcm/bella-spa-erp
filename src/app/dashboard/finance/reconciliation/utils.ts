import { formatCurrency } from '@bella/shared';;

import type { Numberish } from './types';

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' && message ? message : fallback;
  }
  return fallback;
}

export const formatNumberishCurrency = (value: Numberish) => formatCurrency(Number(value || 0));
