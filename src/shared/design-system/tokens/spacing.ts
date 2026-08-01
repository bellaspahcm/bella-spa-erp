/**
 * @fileoverview Design System — Spacing & Radius Tokens
 *
 * Consistent spacing scale and border radius system.
 * Maps to Tailwind spacing / rounded utilities.
 *
 * @module shared/design-system/tokens/spacing
 */

// ─────────────────────────────────────────────────────────────────────────────
// Spacing Scale (Tailwind class names)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Semantic spacing aliases → Tailwind gap/p/m class suffixes.
 *
 * Usage: `gap-${spacing.sm}` → `gap-2`
 */
export const spacing = {
  /** 2px — hairline gap */
  hairline: '0.5',
  /** 4px — micro */
  micro:    '1',
  /** 8px — tight */
  xs:       '2',
  /** 12px — small */
  sm:       '3',
  /** 16px — base */
  base:     '4',
  /** 20px — comfortable */
  md:       '5',
  /** 24px — relaxed */
  lg:       '6',
  /** 32px — spacious */
  xl:       '8',
  /** 40px — section */
  '2xl':    '10',
  /** 48px — page */
  '3xl':    '12',
  /** 64px — hero */
  '4xl':    '16',
} as const;

export type SpacingToken = keyof typeof spacing;

// ─────────────────────────────────────────────────────────────────────────────
// Border Radius
// ─────────────────────────────────────────────────────────────────────────────

export const radius = {
  /** None */
  none: 'rounded-none',
  /** 2px */
  xs:   'rounded',
  /** 4px — small chips */
  sm:   'rounded-sm',
  /** 6px — inputs, buttons */
  md:   'rounded-md',
  /** 8px — cards */
  base: 'rounded-lg',
  /** 12px — modals, panels */
  lg:   'rounded-xl',
  /** 16px — large cards */
  xl:   'rounded-2xl',
  /** 24px — floating panels */
  '2xl':'rounded-3xl',
  /** Full circle / pill */
  full: 'rounded-full',
} as const;

export type RadiusToken = keyof typeof radius;

// ─────────────────────────────────────────────────────────────────────────────
// Shadow Scale
// ─────────────────────────────────────────────────────────────────────────────

export const shadow = {
  /** No shadow — flat elements */
  none:   'shadow-none',
  /** Subtle elevation — table rows */
  xs:     'shadow-sm',
  /** Card default */
  sm:     'shadow',
  /** Hover cards */
  md:     'shadow-md',
  /** Floating panels */
  lg:     'shadow-lg',
  /** Modals, drawers */
  xl:     'shadow-xl',
  /** Hero elements */
  '2xl':  'shadow-2xl',
  /** Custom pink-tinted card shadow */
  pink:   '[box-shadow:0_4px_24px_-4px_rgba(157,23,77,0.08)]',
  /** Luxury dark shadow */
  luxury: '[box-shadow:0_20px_40px_-10px_rgba(15,23,42,0.15)]',
} as const;

export type ShadowToken = keyof typeof shadow;

// ─────────────────────────────────────────────────────────────────────────────
// Z-index Scale
// ─────────────────────────────────────────────────────────────────────────────

export const zIndex = {
  base:    0,
  raised:  10,
  dropdown:20,
  sticky:  30,
  overlay: 40,
  modal:   50,
  toast:   60,
  tooltip: 70,
  top:     9999,
} as const;

export type ZIndexToken = keyof typeof zIndex;
