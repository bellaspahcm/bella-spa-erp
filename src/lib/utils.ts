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

export function formatNumberWithSeparator(value: number | string) {
  const str = typeof value === 'number' ? value.toString() : value;
  const digits = str.replace(/\D/g, '');
  if (!digits) return '';
  return new Intl.NumberFormat('vi-VN').format(parseInt(digits));
}

export function ensure2026(dateStr: any): string {
  if (!dateStr || typeof dateStr !== 'string') return dateStr;
  // Replace 2024 or 2025 with 2026 to ensure consistent demo timeline
  return dateStr.replace(/202[45]/g, '2026');
}

