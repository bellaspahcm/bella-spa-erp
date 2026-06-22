/**
 * Format utilities - platform neutral
 * Di chuyển từ src/lib/utils.ts (bỏ cn() vì phụ thuộc Tailwind)
 */

export function formatCurrency(
  amount: number | string | null | undefined,
  options?: { compact?: boolean; showSymbol?: boolean }
): string {
  const value = typeof amount === 'string' ? Number(amount) : amount;
  if (value === null || value === undefined || !Number.isFinite(value)) return '0';

  const { compact = false, showSymbol = false } = options || {};

  if (compact) {
    if (Math.abs(value) >= 1_000_000_000) {
      return `${(value / 1_000_000_000).toFixed(1)} Tỷ`;
    }
    if (Math.abs(value) >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)} Tr`;
    }
    if (Math.abs(value) >= 1_000) {
      return `${(value / 1_000).toFixed(0)}K`;
    }
  }

  const formatted = new Intl.NumberFormat('vi-VN').format(Math.round(value));
  return showSymbol ? `${formatted} ₫` : formatted;
}

export function parseMoneyInput(input: string | number | null | undefined): number {
  if (input === null || input === undefined) return 0;
  if (typeof input === 'number') {
    return Number.isFinite(input) ? Math.max(0, Math.round(input)) : 0;
  }

  const digits = String(input).replace(/\D/g, '');
  if (!digits) return 0;
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function getLocalDateString(date?: Date | string): string {
  const d = date ? (typeof date === 'string' ? new Date(date) : date) : new Date();
  if (Number.isNaN(d.getTime())) return '';

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function formatMoneyInput(value: string | number | null | undefined): string {
  const amount = parseMoneyInput(value);
  return amount > 0 ? new Intl.NumberFormat('vi-VN').format(amount) : '';
}

export interface BookingForPackageName {
  packages?: { name?: string | null } | { name?: string | null }[] | null;
  package_name?: string | null;
  name?: string | null;
}

export function resolvePackageName(
  pkg: BookingForPackageName | string | null | undefined
): string {
  if (!pkg) return 'Dịch vụ lẻ';
  if (typeof pkg === 'string') return pkg || 'Dịch vụ lẻ';

  if (Array.isArray(pkg.packages)) {
    if (pkg.packages[0]?.name) return pkg.packages[0].name;
  } else if (pkg.packages?.name) {
    return pkg.packages.name;
  }

  return pkg.package_name || pkg.name || 'Dịch vụ lẻ';
}

export function sanitizeTime(raw: unknown): string | null {
  if (!raw) return null;
  const value = String(raw).trim();

  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(value)) {
    const [hours, minutes] = value.split(':');
    return `${hours.padStart(2, '0')}:${minutes}`;
  }

  const embeddedTime = value.match(/(\d{1,2}):(\d{2})/);
  if (embeddedTime) {
    return `${embeddedTime[1].padStart(2, '0')}:${embeddedTime[2]}`;
  }

  if (/^\d{1,2}$/.test(value)) return `${value.padStart(2, '0')}:00`;
  return null;
}
