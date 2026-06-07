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

export function parseMoneyInput(value: number | string | null | undefined) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  }

  const digits = value.replace(/\D/g, '');
  if (!digits) return 0;

  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function formatMoneyInput(value: number | string | null | undefined) {
  const amount = parseMoneyInput(value);
  return amount > 0 ? formatNumberWithSeparator(amount) : '';
}

type NumericInputOptions = {
  min?: number;
  max?: number;
  fallback?: number;
};

function clampNumericInput(value: number, options: NumericInputOptions = {}) {
  const min = options.min ?? 0;
  const fallback = options.fallback ?? min;
  const normalized = Number.isFinite(value) ? value : fallback;
  const max = options.max;
  const lowerBounded = Math.max(min, normalized);
  return max === undefined ? lowerBounded : Math.min(max, lowerBounded);
}

export function parsePercentInput(value: number | string | null | undefined, options: NumericInputOptions = {}) {
  const fallback = options.fallback ?? 0;
  if (value === null || value === undefined || value === '') {
    return clampNumericInput(fallback, { min: 0, max: 100, ...options });
  }

  const numeric = typeof value === 'number' ? value : Number(value);
  return clampNumericInput(numeric, { min: 0, max: 100, fallback, ...options });
}

export function parseIntegerInput(value: number | string | null | undefined, options: NumericInputOptions = {}) {
  const fallback = options.fallback ?? options.min ?? 0;
  if (value === null || value === undefined || value === '') {
    return clampNumericInput(Math.trunc(fallback), options);
  }

  const numeric = typeof value === 'number' ? value : Number(value);
  const integer = Number.isFinite(numeric) ? Math.trunc(numeric) : Math.trunc(fallback);
  return clampNumericInput(integer, options);
}

export function formatNumberWithSeparator(value: number | string) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    return new Intl.NumberFormat('vi-VN').format(Math.round(value));
  }

  const str = value;
  const trimmed = str.trim();
  const decimalMatch = trimmed.match(/^(-?\d+)\.(\d+)$/);
  if (decimalMatch && (decimalMatch[2].length !== 3 || decimalMatch[1].replace('-', '').length > 3)) {
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return new Intl.NumberFormat('vi-VN').format(Math.round(numeric));
    }
  }

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
