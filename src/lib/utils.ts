import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format number as Vietnamese currency (VND)
 * @param amount - Amount to format
 * @param options - Formatting options
 * @returns Formatted currency string
 * 
 * @example
 * formatCurrency(1500000) // "1.500.000 ₫"
 * formatCurrency(1500000, { compact: true }) // "1,5 Tr"
 * formatCurrency(1500000, { showSymbol: false }) // "1.500.000"
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  options?: {
    compact?: boolean;
    showSymbol?: boolean;
  }
): string {
  const value = typeof amount === 'string' ? Number(amount) : amount;
  if (value === null || value === undefined || !Number.isFinite(value)) return '0';

  const { compact = false, showSymbol = false } = options || {};

  if (compact) {
    // Compact format for large numbers
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

export function parseCurrency(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Parse money input string to number
 * Handles Vietnamese number format (1.000.000 or 1,000,000)
 * 
 * @param input - Input string or number
 * @returns Parsed number
 * 
 * @example
 * parseMoneyInput("1.500.000") // 1500000
 * parseMoneyInput("1,500,000") // 1500000
 * parseMoneyInput("1500000") // 1500000
 * parseMoneyInput(1500000) // 1500000
 */
export function parseMoneyInput(input: string | number | null | undefined): number {
  if (input === null || input === undefined) return 0;
  if (typeof input === 'number') {
    return Number.isFinite(input) ? Math.max(0, Math.round(input)) : 0;
  }

  const digits = parseCurrency(input);
  if (!digits) return 0;
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

/**
 * Get local date string in YYYY-MM-DD format for input[type="date"]
 * @param date - Date to format (optional, defaults to today)
 * @returns Formatted date string (yyyy-MM-dd)
 * 
 * @example
 * getLocalDateString() // "2024-06-18" (today)
 * getLocalDateString(new Date('2024-06-18')) // "2024-06-18"
 */
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

/**
 * Format date to Vietnamese format dd-mm-yyyy
 */
export function formatViDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  
  if (typeof date === 'string') {
    const cleanStr = date.split('T')[0].trim();
    const match = cleanStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }
  }

  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';
  
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}


/**
 * Format money input with Vietnamese thousand separators
 * Used for displaying formatted input values
 * 
 * @param value - Value to format
 * @returns Formatted string with dots as thousand separators
 * 
 * @example
 * formatMoneyInput(1500000) // "1.500.000"
 * formatMoneyInput("1500000") // "1.500.000"
 * formatMoneyInput(null) // ""
 */
export function formatMoneyInput(value: string | number | null | undefined): string {
  const amount = parseMoneyInput(value);
  return amount > 0 ? formatNumberWithSeparator(amount) : '';
}

/**
 * Format number with thousand separators (Vietnamese style with dots)
 * 
 * @param value - Number to format
 * @returns Formatted string
 * 
 * @example
 * formatNumberWithSeparator(1500000) // "1.500.000"
 */
export function formatNumberWithSeparator(
  value: number | string | null | undefined
): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    return new Intl.NumberFormat('vi-VN').format(Math.round(value));
  }

  const trimmed = value.trim();
  const decimalMatch = trimmed.match(/^(-?\d+)\.(\d+)$/);
  if (
    decimalMatch &&
    (decimalMatch[2].length !== 3 || decimalMatch[1].replace('-', '').length > 3)
  ) {
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return new Intl.NumberFormat('vi-VN').format(Math.round(numeric));
    }
  }

  const isNegative = trimmed.startsWith('-');
  const digits = parseCurrency(trimmed);
  if (!digits) return '';
  const formatted = new Intl.NumberFormat('vi-VN').format(Number.parseInt(digits, 10));
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Parse integer input string to number
 * Removes all non-digit characters
 * 
 * @param input - Input string, number, or null/undefined
 * @param options - Parsing options (min, max, fallback)
 * @returns Parsed integer
 * 
 * @example
 * parseIntegerInput("123abc") // 123
 * parseIntegerInput("-456") // -456
 * parseIntegerInput(123) // 123
 * parseIntegerInput(undefined, { fallback: 1 }) // 1
 * parseIntegerInput("150", { max: 100, min: 0 }) // 100
 */
type NumericInputOptions = {
  min?: number;
  max?: number;
  fallback?: number;
};

function clampNumericInput(value: number, options: NumericInputOptions = {}): number {
  const min = options.min ?? 0;
  const fallback = options.fallback ?? min;
  const normalized = Number.isFinite(value) ? value : fallback;
  const lowerBounded = Math.max(min, normalized);
  return options.max === undefined ? lowerBounded : Math.min(options.max, lowerBounded);
}

export function parseIntegerInput(
  input: string | number | null | undefined,
  options: NumericInputOptions = {}
): number {
  const fallback = options.fallback ?? options.min ?? 0;
  if (input === null || input === undefined || input === '') {
    return clampNumericInput(Math.trunc(fallback), options);
  }

  const numeric = typeof input === 'number' ? input : Number(input);
  const integer = Number.isFinite(numeric) ? Math.trunc(numeric) : Math.trunc(fallback);
  return clampNumericInput(integer, options);
}

/**
 * Parse decimal input string to number
 * Handles both comma and dot as decimal separators
 * 
 * @param input - Input string, number, or null
 * @param options - Parsing options (min, max, fallback)
 * @returns Parsed decimal number
 * 
 * @example
 * parseDecimalInput("12,5") // 12.5
 * parseDecimalInput("12.5") // 12.5
 * parseDecimalInput(12.5) // 12.5
 * parseDecimalInput(null, { fallback: 1 }) // 1
 * parseDecimalInput("150", { max: 100 }) // 100
 */
export function parseDecimalInput(
  input: string | number | null | undefined,
  options: NumericInputOptions = {}
): number {
  const fallback = options.fallback ?? options.min ?? 0;
  if (input === null || input === undefined || input === '') {
    return clampNumericInput(fallback, options);
  }

  const numeric = typeof input === 'number' ? input : Number(input.replace(',', '.'));
  return clampNumericInput(numeric, { fallback, ...options });
}

/**
 * Parse percent input string to number
 * Removes percent sign and converts to decimal
 * 
 * @param input - Input string, number, or null/undefined (e.g., "15%" or "15")
 * @param options - Parsing options (min, max, fallback)
 * @returns Parsed number (e.g., 15, not 0.15)
 * 
 * @example
 * parsePercentInput("15%") // 15
 * parsePercentInput("15") // 15
 * parsePercentInput(15) // 15
 * parsePercentInput(null, { fallback: 10 }) // 10
 * parsePercentInput("150", { max: 100, fallback: 10 }) // 10
 */
export function parsePercentInput(
  input: string | number | null | undefined,
  options: NumericInputOptions = {}
): number {
  const percentOptions = { min: 0, max: 100, ...options };
  const fallback = options.fallback ?? 0;
  if (input === null || input === undefined || input === '') {
    return clampNumericInput(fallback, percentOptions);
  }

  const numeric = typeof input === 'number'
    ? input
    : Number(input.replace('%', '').trim().replace(',', '.'));
  return clampNumericInput(numeric, { fallback, ...percentOptions });
}

/**
 * Get the start of the month for a given date
 * Returns ISO string in format YYYY-MM-01
 * 
 * @param date - Date (optional, defaults to current date)
 * @returns ISO date string for the first day of the month
 * 
 * @example
 * getMonthStart(new Date('2024-06-15')) // "2024-06-01"
 * getMonthStart() // "2024-06-01" (for current month)
 */
export function getMonthStart(date?: Date | string): string {
  const d = date ? (typeof date === 'string' ? new Date(date) : date) : new Date();
  
  if (isNaN(d.getTime())) {
    return new Date().toISOString().slice(0, 7) + '-01';
  }
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  
  return `${year}-${month}-01`;
}

/**
 * Resolve package name from object or string
 * Helper for handling package naming in various contexts
 * 
 * @param pkg - Package object with name or package_name property, or string, or any object
 * @returns Package name string
 * 
 * @example
 * resolvePackageName({ name: "Massage 90 phút" }) // "Massage 90 phút"
 * resolvePackageName({ package_name: "Massage 90 phút" }) // "Massage 90 phút"
 * resolvePackageName("Massage 90 phút") // "Massage 90 phút"
 */
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

/**
 * Sanitize time string to HH:MM format
 * Removes seconds and ensures valid time format
 * 
 * @param time - Time string (e.g., "14:30:00" or "14:30")
 * @returns Sanitized time in HH:MM format
 * 
 * @example
 * sanitizeTime("14:30:00") // "14:30"
 * sanitizeTime("14:30") // "14:30"
 * sanitizeTime("invalid") // "00:00"
 */
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

/**
 * Copy text to clipboard using the best available method, including falling back
 * to standard document.execCommand if navigator.clipboard is not supported or fails (e.g. on mobile/Safari or HTTP).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Try navigator.clipboard.writeText first (needs secure context)
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err: unknown) {
      console.warn('navigator.clipboard.writeText failed, trying fallback:', err);
    }
  }

  // Fallback for older browsers, iOS/Safari async context, or non-secure contexts (HTTP)
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Prevent scrolling and zoom issues on mobile browsers
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    // Support iOS/Safari selection
    textArea.setSelectionRange(0, 99999);
    
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    
    if (successful) {
      return true;
    }
  } catch (err: unknown) {
    console.error('Fallback copy method failed:', err);
  }
  
  return false;
}

