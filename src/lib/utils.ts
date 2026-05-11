import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string) {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(value)) return '0';
  return new Intl.NumberFormat('vi-VN').format(value);
}

export function parseCurrency(value: string) {
  return value.replace(/\D/g, '');
}

export function formatNumberWithSeparator(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return new Intl.NumberFormat('vi-VN').format(parseInt(digits));
}
