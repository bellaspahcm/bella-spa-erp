/**
 * @fileoverview Design System — Color Tokens
 *
 * Single source of truth for all color semantic tokens.
 * Maps to CSS custom properties in globals.css and Tailwind theme.
 *
 * Usage:
 *   import { colors } from '@/shared/design-system/tokens/colors';
 *   // or via barrel: import { colors } from '@/shared/design-system';
 *
 * @module shared/design-system/tokens/colors
 */

// ─────────────────────────────────────────────────────────────────────────────
// Semantic Color Tokens (CSS variable references)
// ─────────────────────────────────────────────────────────────────────────────

export const colors = {
  // ── Brand / Primary ───────────────────────────────────────────────────────
  primary:          'var(--color-primary, #E91E63)',
  primaryHover:     'var(--color-primary-hover, #C2185B)',
  primaryForeground:'var(--color-primary-foreground)',

  // ── Surface ───────────────────────────────────────────────────────────────
  background:       'var(--color-background)',
  foreground:       'var(--color-foreground)',
  card:             'var(--color-card)',
  cardForeground:   'var(--color-card-foreground)',
  popover:          'var(--color-popover)',
  popoverForeground:'var(--color-popover-foreground)',

  // ── Supporting ────────────────────────────────────────────────────────────
  secondary:        'var(--color-secondary)',
  secondaryForeground: 'var(--color-secondary-foreground)',
  muted:            'var(--color-muted)',
  mutedForeground:  'var(--color-muted-foreground)',
  accent:           'var(--color-accent)',
  accentForeground: 'var(--color-accent-foreground)',
  destructive:      'var(--color-destructive)',

  // ── Borders / Inputs ──────────────────────────────────────────────────────
  border:           'var(--color-border)',
  input:            'var(--color-input)',
  ring:             'var(--color-ring)',

  // ── Sidebar ───────────────────────────────────────────────────────────────
  sidebar:          'var(--color-sidebar)',
  sidebarForeground:'var(--color-sidebar-foreground)',

  // ── Charts ────────────────────────────────────────────────────────────────
  chart: {
    1: 'var(--color-chart-1)',
    2: 'var(--color-chart-2)',
    3: 'var(--color-chart-3)',
    4: 'var(--color-chart-4)',
    5: 'var(--color-chart-5)',
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Status / State Colors (hardcoded — same in light & dark)
// Used for badges, FSM state indicators, alert chips
// ─────────────────────────────────────────────────────────────────────────────

export const statusColors = {
  success: {
    bg:   'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-400',
    dot:  'bg-emerald-500',
    border:'border-emerald-200 dark:border-emerald-800',
  },
  warning: {
    bg:   'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-400',
    dot:  'bg-amber-500',
    border:'border-amber-200 dark:border-amber-800',
  },
  danger: {
    bg:   'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-400',
    dot:  'bg-rose-500',
    border:'border-rose-200 dark:border-rose-800',
  },
  info: {
    bg:   'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-400',
    dot:  'bg-blue-500',
    border:'border-blue-200 dark:border-blue-800',
  },
  neutral: {
    bg:   'bg-slate-50 dark:bg-slate-800/50',
    text: 'text-slate-600 dark:text-slate-400',
    dot:  'bg-slate-400',
    border:'border-slate-200 dark:border-slate-700',
  },
  primary: {
    bg:   'bg-pink-50 dark:bg-pink-950/40',
    text: 'text-pink-700 dark:text-pink-400',
    dot:  'bg-pink-500',
    border:'border-pink-200 dark:border-pink-800',
  },
  purple: {
    bg:   'bg-purple-50 dark:bg-purple-950/40',
    text: 'text-purple-700 dark:text-purple-400',
    dot:  'bg-purple-500',
    border:'border-purple-200 dark:border-purple-800',
  },
  teal: {
    bg:   'bg-teal-50 dark:bg-teal-950/40',
    text: 'text-teal-700 dark:text-teal-400',
    dot:  'bg-teal-500',
    border:'border-teal-200 dark:border-teal-800',
  },
} as const;

export type StatusColorKey = keyof typeof statusColors;
