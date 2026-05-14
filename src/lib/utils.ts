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

export function ensure2026(dateStr: any): any {
  if (!dateStr) return dateStr;
  
  if (dateStr instanceof Date) {
    const year = dateStr.getFullYear();
    if (year === 2024 || year === 2025) {
      const newDate = new Date(dateStr);
      newDate.setFullYear(2026);
      return newDate;
    }
    return dateStr;
  }

  if (typeof dateStr !== 'string') return dateStr;
  
  // Replace 2024 or 2025 with 2026 to ensure consistent demo timeline
  return dateStr.replace(/202[45]/g, '2026');
}

import { MOCK_SERVICES } from '@/constants/mock-data';

export function resolvePackageName(booking: any): string {
  if (booking?.package_name) return booking.package_name;
  
  const price = Number(booking?.full_price);
  const matchedService = MOCK_SERVICES.find(s => {
    const sPrice = parseInt(s.price.replace(/[^\d]/g, ''));
    return sPrice === price;
  });

  return matchedService?.name || 'Dịch vụ lẻ';
}
