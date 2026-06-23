/**
 * Shared Utilities for Mobile App
 * 
 * This file contains inline copies of utilities from @bella/shared package
 * to avoid workspace dependency issues during EAS Build.
 * 
 * NOTE: Keep these in sync with @bella/shared when making changes.
 */

// ── Type Definitions ──────────────────────────────────────────────────

export type UserRole =
  | 'admin'
  | 'manager'
  | 'receptionist'
  | 'ktv'
  | 'technician'
  | 'accountant'
  | 'warehouse'
  | 'marketing';

export interface CurrentUser {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  tenant_id: string | null;
  phone: string | null;
  avatar_url: string | null;
}

export interface AuthState {
  status: 'loading' | 'loading-profile' | 'authenticated' | 'unauthenticated';
  user: CurrentUser | null;
  tenant_id: string | null;
}

export type TenantModuleKey =
  | 'bella_spa'
  | 'beauty_salon'
  | 'massage_spa'
  | 'nail_salon'
  | 'fitness_center'
  | 'hotel_spa';

// ── Role Utilities ────────────────────────────────────────────────────

export function isAdminRole(role: UserRole): boolean {
  return role === 'admin';
}

export function isTechnicianRole(role: UserRole): boolean {
  return role === 'ktv' || role === 'technician';
}

export function isManagerOrAbove(role: UserRole): boolean {
  return role === 'admin' || role === 'manager';
}

export function isReceptionistRole(role: UserRole): boolean {
  return role === 'receptionist';
}

export function isAccountantRole(role: UserRole): boolean {
  return role === 'accountant';
}

export function isWarehouseRole(role: UserRole): boolean {
  return role === 'warehouse';
}

export function isMarketingRole(role: UserRole): boolean {
  return role === 'marketing';
}

// ── Formatting Utilities ──────────────────────────────────────────────

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value);
}

export function formatPercent(value: number, decimals: number = 0): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('vi-VN').format(d);
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d);
}

// ── Validation Utilities ──────────────────────────────────────────────

export function validateEmail(email: string): { ok: boolean; error?: string } {
  if (!email) {
    return { ok: false, error: 'Email không được để trống' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { ok: false, error: 'Email không hợp lệ' };
  }
  return { ok: true };
}

export function validatePassword(password: string): { ok: boolean; error?: string } {
  if (!password) {
    return { ok: false, error: 'Mật khẩu không được để trống' };
  }
  if (password.length < 6) {
    return { ok: false, error: 'Mật khẩu phải có ít nhất 6 ký tự' };
  }
  return { ok: true };
}

export function validatePhone(phone: string): { ok: boolean; error?: string } {
  if (!phone) {
    return { ok: false, error: 'Số điện thoại không được để trống' };
  }
  const phoneRegex = /^[0-9]{10,11}$/;
  if (!phoneRegex.test(phone)) {
    return { ok: false, error: 'Số điện thoại không hợp lệ (10-11 chữ số)' };
  }
  return { ok: true };
}

// ── Tenant Module Utilities ───────────────────────────────────────────

export function getDefaultTenantModuleKey(): TenantModuleKey {
  return 'bella_spa';
}

export function getTenantModuleName(key: TenantModuleKey): string {
  const names: Record<TenantModuleKey, string> = {
    bella_spa: 'Bella Spa',
    beauty_salon: 'Beauty Salon',
    massage_spa: 'Massage Spa',
    nail_salon: 'Nail Salon',
    fitness_center: 'Fitness Center',
    hotel_spa: 'Hotel Spa',
  };
  return names[key] || 'Unknown';
}

// ── String Utilities ───────────────────────────────────────────────────

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ── Array Utilities ────────────────────────────────────────────────────

export function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

export function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const groupKey = String(item[key]);
    if (!acc[groupKey]) {
      acc[groupKey] = [];
    }
    acc[groupKey].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

// ── Date Utilities ─────────────────────────────────────────────────────

export function isToday(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
}

export function isSameDay(date1: Date | string, date2: Date | string): boolean {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
  return (
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear()
  );
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function subtractDays(date: Date, days: number): Date {
  return addDays(date, -days);
}

export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}
