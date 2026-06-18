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
  amount: number | null | undefined,
  options?: {
    compact?: boolean;
    showSymbol?: boolean;
  }
): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return options?.showSymbol !== false ? '0 ₫' : '0';
  }

  const { compact = false, showSymbol = true } = options || {};

  if (compact) {
    // Compact format for large numbers
    if (Math.abs(amount) >= 1_000_000_000) {
      const formatted = (amount / 1_000_000_000).toFixed(1);
      return showSymbol ? `${formatted} Tỷ` : formatted + ' Tỷ';
    }
    if (Math.abs(amount) >= 1_000_000) {
      const formatted = (amount / 1_000_000).toFixed(1);
      return showSymbol ? `${formatted} Tr` : formatted + ' Tr';
    }
    if (Math.abs(amount) >= 1_000) {
      const formatted = (amount / 1_000).toFixed(0);
      return showSymbol ? `${formatted}K` : formatted + 'K';
    }
  }

  // Full format with thousand separators
  const formatted = new Intl.NumberFormat('vi-VN').format(Math.round(amount));
  return showSymbol ? `${formatted} ₫` : formatted;
}

/**
 * Parse money input string to number
 * Handles Vietnamese number format (1.000.000 or 1,000,000)
 * 
 * @param input - Input string
 * @returns Parsed number
 * 
 * @example
 * parseMoneyInput("1.500.000") // 1500000
 * parseMoneyInput("1,500,000") // 1500000
 * parseMoneyInput("1500000") // 1500000
 */
export function parseMoneyInput(input: string): number {
  if (!input) return 0;
  
  // Remove all non-digit characters except minus sign
  const cleaned = input.replace(/[^\d-]/g, '');
  const parsed = parseInt(cleaned, 10);
  
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Get local date string in Vietnamese format
 * @param date - Date to format
 * @returns Formatted date string (dd/MM/yyyy)
 * 
 * @example
 * getLocalDateString(new Date('2024-06-18')) // "18/06/2024"
 */
export function getLocalDateString(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(d.getTime())) {
    return '';
  }
  
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
 */
export function formatMoneyInput(value: string | number): string {
  if (value === '' || value === null || value === undefined) return '';
  
  const numValue = typeof value === 'string' ? parseMoneyInput(value) : value;
  return formatNumberWithSeparator(numValue);
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
export function formatNumberWithSeparator(value: number): string {
  if (value === null || value === undefined || isNaN(value)) return '0';
  return new Intl.NumberFormat('vi-VN').format(Math.round(value));
}

/**
 * Parse integer input string to number
 * Removes all non-digit characters
 * 
 * @param input - Input string
 * @returns Parsed integer
 * 
 * @example
 * parseIntegerInput("123abc") // 123
 * parseIntegerInput("-456") // -456
 */
export function parseIntegerInput(input: string): number {
  if (!input) return 0;
  const cleaned = input.replace(/[^\d-]/g, '');
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Parse decimal input string to number
 * Handles both comma and dot as decimal separators
 * 
 * @param input - Input string
 * @returns Parsed decimal number
 * 
 * @example
 * parseDecimalInput("12,5") // 12.5
 * parseDecimalInput("12.5") // 12.5
 */
export function parseDecimalInput(input: string): number {
  if (!input) return 0;
  
  // Replace comma with dot for parsing
  const normalized = input.replace(',', '.');
  // Remove all non-digit, non-dot, non-minus characters
  const cleaned = normalized.replace(/[^\d.-]/g, '');
  const parsed = parseFloat(cleaned);
  
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Parse percent input string to number
 * Removes percent sign and converts to decimal
 * 
 * @param input - Input string (e.g., "15%" or "15")
 * @returns Parsed number (e.g., 15, not 0.15)
 * 
 * @example
 * parsePercentInput("15%") // 15
 * parsePercentInput("15") // 15
 */
export function parsePercentInput(input: string): number {
  if (!input) return 0;
  
  // Remove percent sign and parse as decimal
  const cleaned = input.replace('%', '').trim();
  return parseDecimalInput(cleaned);
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
 * @param pkg - Package object with name property or string
 * @returns Package name string
 * 
 * @example
 * resolvePackageName({ name: "Massage 90 phút" }) // "Massage 90 phút"
 * resolvePackageName("Massage 90 phút") // "Massage 90 phút"
 */
export function resolvePackageName(pkg: { name: string } | string | null | undefined): string {
  if (!pkg) return '';
  if (typeof pkg === 'string') return pkg;
  return pkg.name || '';
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
export function sanitizeTime(time: string | null | undefined): string {
  if (!time) return '00:00';
  
  // Extract HH:MM from various formats
  const match = time.match(/^(\d{1,2}):(\d{2})/);
  
  if (!match) return '00:00';
  
  const hours = String(parseInt(match[1], 10)).padStart(2, '0');
  const minutes = match[2];
  
  return `${hours}:${minutes}`;
}
