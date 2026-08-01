/**
 * @fileoverview Design System — FSM State Visual Mapping
 *
 * Maps domain FSM states → design system status color tokens.
 * Used by StatusBadge, timeline dots, table row highlights, etc.
 *
 * Covers:
 * - Inventory Item States (RE)
 * - Document Lifecycle States
 * - Lead / Opportunity States
 * - Payment States
 *
 * @module shared/design-system/state-colors
 */

import type { StatusColorKey } from './tokens/colors';

export interface StateVisual {
  /** Status color group from statusColors */
  color: StatusColorKey;
  /** Human-readable Vietnamese label */
  label: string;
  /** Lucide icon name */
  icon?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Inventory Item FSM States
// ─────────────────────────────────────────────────────────────────────────────

export const inventoryStateVisuals: Record<string, StateVisual> = {
  OFF_MARKET:      { color: 'neutral',  label: 'Chưa mở bán',    icon: 'MinusCircle' },
  AVAILABLE:       { color: 'success',  label: 'Còn hàng',        icon: 'CheckCircle2' },
  HELD:            { color: 'warning',  label: 'Đang giữ chỗ',    icon: 'Clock' },
  BOOKED:          { color: 'primary',  label: 'Đã đặt cọc',      icon: 'BookmarkCheck' },
  RESERVED:        { color: 'info',     label: 'Đã bảo lưu',      icon: 'Pin' },
  DEPOSITED:       { color: 'teal',     label: 'Đã đặt cọc',      icon: 'Wallet' },
  CONTRACT_SIGNED: { color: 'purple',   label: 'Đã ký HĐ',        icon: 'FileSignature' },
  LOCKED:          { color: 'warning',  label: 'Đang khóa',       icon: 'Lock' },
  BLOCKED:         { color: 'danger',   label: 'Bị phong tỏa',    icon: 'Ban' },
  TRANSFERRED:     { color: 'teal',     label: 'Đã sang nhượng',  icon: 'ArrowRightLeft' },
  HANDED_OVER:     { color: 'success',  label: 'Đã bàn giao',     icon: 'KeyRound' },
  CANCELLED:       { color: 'danger',   label: 'Đã hủy',          icon: 'XCircle' },
  RETURNED:        { color: 'neutral',  label: 'Đã hoàn trả',     icon: 'Undo2' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Document Lifecycle States
// ─────────────────────────────────────────────────────────────────────────────

export const documentStateVisuals: Record<string, StateVisual> = {
  draft:     { color: 'neutral',  label: 'Nháp',         icon: 'FilePen' },
  review:    { color: 'warning',  label: 'Đang xem xét', icon: 'Eye' },
  approved:  { color: 'teal',     label: 'Đã duyệt',     icon: 'BadgeCheck' },
  signed:    { color: 'success',  label: 'Đã ký',        icon: 'PenLine' },
  rejected:  { color: 'danger',   label: 'Bị từ chối',   icon: 'XCircle' },
  cancelled: { color: 'neutral',  label: 'Đã hủy',       icon: 'Ban' },
  expired:   { color: 'warning',  label: 'Hết hạn',      icon: 'CalendarX' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Lead / Opportunity States
// ─────────────────────────────────────────────────────────────────────────────

export const leadStateVisuals: Record<string, StateVisual> = {
  NEW:              { color: 'info',    label: 'Lead mới',       icon: 'Zap' },
  ASSIGNED:         { color: 'primary', label: 'Đã phân công',   icon: 'UserCheck' },
  IN_CONTACT:       { color: 'teal',    label: 'Đang liên hệ',   icon: 'Phone' },
  SITE_VISIT_SCHED: { color: 'warning', label: 'Đặt lịch xem',   icon: 'CalendarCheck' },
  SITE_VISITED:     { color: 'purple',  label: 'Đã xem nhà',     icon: 'Home' },
  NEGOTIATION:      { color: 'warning', label: 'Đang đàm phán',  icon: 'MessageSquare' },
  WON:              { color: 'success', label: 'Chốt deal',       icon: 'Trophy' },
  LOST:             { color: 'danger',  label: 'Thua',            icon: 'XCircle' },
  NURTURE:          { color: 'neutral', label: 'Nuôi dưỡng',     icon: 'Heart' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Payment / Installment States
// ─────────────────────────────────────────────────────────────────────────────

export const paymentStateVisuals: Record<string, StateVisual> = {
  PENDING:    { color: 'warning', label: 'Chờ thanh toán', icon: 'Clock' },
  PAID:       { color: 'success', label: 'Đã thanh toán',  icon: 'CheckCircle2' },
  OVERDUE:    { color: 'danger',  label: 'Quá hạn',        icon: 'AlertCircle' },
  PARTIAL:    { color: 'info',    label: 'Thanh toán 1 phần', icon: 'Minus' },
  WAIVED:     { color: 'neutral', label: 'Miễn giảm',      icon: 'Eraser' },
  REFUNDED:   { color: 'teal',    label: 'Đã hoàn tiền',   icon: 'Undo2' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Signature States
// ─────────────────────────────────────────────────────────────────────────────

export const signatureStateVisuals: Record<string, StateVisual> = {
  pending:  { color: 'warning', label: 'Chờ ký',     icon: 'Clock' },
  signed:   { color: 'success', label: 'Đã ký',      icon: 'PenLine' },
  rejected: { color: 'danger',  label: 'Từ chối ký', icon: 'XCircle' },
  expired:  { color: 'neutral', label: 'Hết hạn',    icon: 'CalendarX' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Generic lookup helper
// ─────────────────────────────────────────────────────────────────────────────

export type StateVisualMap = Record<string, StateVisual>;

export function getStateVisual(
  map: StateVisualMap,
  state: string
): StateVisual {
  return map[state] ?? { color: 'neutral', label: state, icon: 'Circle' };
}
