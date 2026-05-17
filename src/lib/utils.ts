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
  if (value === null || value === undefined) return '';
  const str = typeof value === 'number' ? value.toString() : value;
  const isNegative = str.startsWith('-');
  const digits = str.replace(/\D/g, '');
  if (!digits) return '';
  const formatted = new Intl.NumberFormat('vi-VN').format(parseInt(digits));
  return isNegative ? `-${formatted}` : formatted;
}






export function resolvePackageName(booking: any): string {
  // 1. Priority: Dynamic name from joined packages table
  if (booking?.packages?.name) return booking.packages.name;
  
  // 2. Secondary: Hardcoded name in booking record (legacy)
  if (booking?.package_name) return booking.package_name;
  
  return 'Dịch vụ lẻ';
}
