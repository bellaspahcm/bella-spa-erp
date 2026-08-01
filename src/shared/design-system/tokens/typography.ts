/**
 * @fileoverview Design System — Typography Tokens
 *
 * Font families, scale, weights, and leading (line-height) tokens.
 * Maps to globals.css @theme inline scale.
 *
 * @module shared/design-system/tokens/typography
 */

// ─────────────────────────────────────────────────────────────────────────────
// Font Families
// ─────────────────────────────────────────────────────────────────────────────

export const fontFamily = {
  sans:        'var(--font-sans)',
  heading:     'var(--font-heading, var(--font-serif, Georgia, serif))',
  serif:       'var(--font-serif, Georgia, serif)',
  handwriting: 'var(--font-handwriting, cursive)',
  mono:        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Font Size Scale (px — from globals.css @theme)
// ─────────────────────────────────────────────────────────────────────────────

export const fontSize = {
  xs:   '12px',
  sm:   '13px',
  base: '14px',
  lg:   '16px',
  xl:   '18px',
  '2xl': '20px',
  '3xl': '22px',
  '4xl': '24px',
} as const;

export type FontSizeToken = keyof typeof fontSize;

// ─────────────────────────────────────────────────────────────────────────────
// Font Weights
// ─────────────────────────────────────────────────────────────────────────────

export const fontWeight = {
  normal:   '400',
  medium:   '500',
  semibold: '600',
  bold:     '700',
  extrabold:'800',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Line Height
// ─────────────────────────────────────────────────────────────────────────────

export const lineHeight = {
  tight:   '1.2',
  snug:    '1.35',
  normal:  '1.5',
  relaxed: '1.625',
  loose:   '2',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Tailwind class helpers (pre-composed)
// ─────────────────────────────────────────────────────────────────────────────

/** Heading styles by level */
export const textStyles = {
  /** Page title — e.g. Dashboard header */
  h1:      'text-2xl font-bold leading-tight tracking-tight',
  /** Section header */
  h2:      'text-xl font-semibold leading-tight',
  /** Card header / group label */
  h3:      'text-lg font-semibold',
  /** Sub-label / table column header */
  h4:      'text-base font-semibold',
  /** Body copy */
  body:    'text-base font-normal leading-normal',
  /** Secondary/helper text */
  small:   'text-sm text-muted-foreground',
  /** Caption / metadata */
  caption: 'text-xs text-muted-foreground',
  /** Monospace values — numbers, IDs, code */
  mono:    'font-mono text-sm tabular-nums',
  /** Amount display (large currency) */
  amount:  'text-xl font-bold tabular-nums tracking-tight',
  /** Badge / chip text */
  badge:   'text-xs font-medium',
} as const;

export type TextStyleToken = keyof typeof textStyles;
