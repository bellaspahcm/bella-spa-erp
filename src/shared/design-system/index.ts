/**
 * @fileoverview Shared Design System — Barrel Export
 *
 * Single import point for all design system primitives.
 *
 * @example
 * import {
 *   colors, statusColors,
 *   textStyles, fontFamily,
 *   spacing, radius, shadow,
 *   cardPatterns, badgePatterns, tablePatterns,
 *   timelinePatterns, layoutPatterns, formPatterns,
 *   icons, propertyIcons, salesIcons, crmIcons,
 *   inventoryStateVisuals, documentStateVisuals,
 *   getStateVisual,
 * } from '@/shared/design-system';
 *
 * @module shared/design-system
 */

// ─── Tokens ──────────────────────────────────────────────────────────────────
export { colors, statusColors }           from './tokens/colors';
export type { StatusColorKey }            from './tokens/colors';

export {
  fontFamily, fontSize, fontWeight,
  lineHeight, textStyles,
}                                         from './tokens/typography';
export type { FontSizeToken, TextStyleToken } from './tokens/typography';

export {
  spacing, radius, shadow, zIndex,
}                                         from './tokens/spacing';
export type {
  SpacingToken, RadiusToken,
  ShadowToken, ZIndexToken,
}                                         from './tokens/spacing';

// ─── Patterns ─────────────────────────────────────────────────────────────────
export {
  cardPatterns, badgePatterns, tablePatterns,
  timelinePatterns, layoutPatterns, formPatterns,
}                                         from './patterns';
export type {
  CardPattern, BadgePattern, TablePattern,
  TimelinePattern, LayoutPattern, FormPattern,
}                                         from './patterns';

// ─── Icons ────────────────────────────────────────────────────────────────────
export {
  icons,
  propertyIcons, salesIcons, crmIcons,
  financeIcons, statusIcons, platformIcons,
}                                         from './icons';
export type { IconName, IconKey }         from './icons';

// ─── State Visuals (FSM → Design Tokens) ─────────────────────────────────────
export {
  inventoryStateVisuals,
  documentStateVisuals,
  leadStateVisuals,
  paymentStateVisuals,
  signatureStateVisuals,
  getStateVisual,
}                                         from './state-colors';
export type { StateVisual, StateVisualMap } from './state-colors';
