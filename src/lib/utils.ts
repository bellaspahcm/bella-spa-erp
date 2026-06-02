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






export interface BookingForPackageName {
  packages?: { name?: string | null } | { name?: string | null }[] | null;
  package_name?: string | null;
}

export function resolvePackageName(booking: BookingForPackageName | null | undefined): string {
  if (!booking) return 'Dịch vụ lẻ';
  const pkg = booking.packages;
  if (pkg) {
    if (Array.isArray(pkg)) {
      if (pkg[0]?.name) return pkg[0].name;
    } else if (pkg.name) {
      return pkg.name;
    }
  }
  if (booking.package_name) return booking.package_name;
  return 'Dịch vụ lẻ';
}

export function getLocalDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

export function getMonthStart(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

export function sanitizeTime(raw: unknown): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) {
    const [h, m] = s.split(':');
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
  }
  const match = s.match(/(\d{1,2}):(\d{2})/);
  if (match) return `${match[1].padStart(2, '0')}:${match[2]}`;
  if (/^\d{1,2}$/.test(s)) return `${s.padStart(2, '0')}:00`;
  return null;
}
