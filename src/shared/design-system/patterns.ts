/**
 * @fileoverview Design System — UI Patterns
 *
 * Pre-composed Tailwind class strings for recurring layout / component patterns.
 * These are the "Lego bricks" that components are built from.
 *
 * Rules:
 * - All class strings must be statically analyzable by Tailwind (no dynamic concatenation)
 * - Prefer semantic names over visual names
 * - Each pattern is a record of variant → class string
 *
 * @module shared/design-system/patterns
 */

// ─────────────────────────────────────────────────────────────────────────────
// Card Patterns
// ─────────────────────────────────────────────────────────────────────────────

export const cardPatterns = {
  /** Standard data card (white/dark surface) */
  base:     'bg-card text-card-foreground rounded-xl border border-border shadow-sm',
  /** Flat card — no shadow, subtle border */
  flat:     'bg-card text-card-foreground rounded-xl border border-border',
  /** Elevated — hover shadow */
  elevated: 'bg-card text-card-foreground rounded-xl border border-border shadow-md hover:shadow-lg transition-shadow duration-200',
  /** Premium dark card */
  dark:     'luxury-card-dark rounded-xl',
  /** Pink/brand accent card */
  brand:    'luxury-card-pink rounded-xl',
  /** Glass effect */
  glass:    'glass rounded-xl',
  /** Pink glass */
  glassPink:'glass-pink rounded-xl',
  /** KPI metric card */
  metric:   'bg-card rounded-xl border border-border p-4 shadow-sm hover:shadow-md transition-all duration-200',
  /** Compact inline card */
  compact:  'bg-card rounded-lg border border-border shadow-sm',
} as const;

export type CardPattern = keyof typeof cardPatterns;

// ─────────────────────────────────────────────────────────────────────────────
// Badge / Status Chip Patterns
// ─────────────────────────────────────────────────────────────────────────────

export const badgePatterns = {
  /** Standard rounded badge */
  base:     'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
  /** Square badge (for count pills) */
  pill:     'inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded text-xs font-bold',
  /** Dot indicator + text */
  dotText:  'inline-flex items-center gap-1.5 text-xs font-medium',
  /** Large status badge */
  large:    'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium',
  /** Outline badge */
  outline:  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
} as const;

export type BadgePattern = keyof typeof badgePatterns;

// ─────────────────────────────────────────────────────────────────────────────
// Table Patterns
// ─────────────────────────────────────────────────────────────────────────────

export const tablePatterns = {
  /** Outer wrapper with horizontal scroll */
  wrapper:    'w-full overflow-x-auto',
  /** Standard data table */
  table:      'bella-data-table w-full text-sm',
  /** Table header row */
  thead:      'border-b border-border',
  /** Header cell */
  th:         'h-10 px-4 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap',
  /** Header cell — right aligned (numbers) */
  thRight:    'h-10 px-4 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap',
  /** Body row */
  tr:         'border-b border-border hover:bg-muted/30 transition-colors duration-100',
  /** Body cell */
  td:         'h-12 px-4 text-sm whitespace-nowrap',
  /** Body cell — right aligned */
  tdRight:    'h-12 px-4 text-sm text-right whitespace-nowrap tabular-nums',
  /** Body cell — muted secondary text */
  tdMuted:    'h-12 px-4 text-sm text-muted-foreground whitespace-nowrap',
  /** Action cell */
  tdActions:  'h-12 px-4 text-right whitespace-nowrap',
  /** Footer row */
  tfoot:      'bg-muted/20 font-semibold border-t-2 border-border',
} as const;

export type TablePattern = keyof typeof tablePatterns;

// ─────────────────────────────────────────────────────────────────────────────
// Timeline / Activity Log Patterns
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Activity timeline pattern — vertical connector line with dot anchors.
 *
 * Markup structure:
 * ```
 * <ul class={timeline.list}>
 *   <li class={timeline.item}>
 *     <div class={timeline.connector} />
 *     <div class={timeline.dot} />         ← or timeline.dotPrimary, timeline.dotSuccess
 *     <div class={timeline.content}>
 *       <p class={timeline.heading}>…</p>
 *       <p class={timeline.meta}>…</p>
 *     </div>
 *   </li>
 * </ul>
 * ```
 */
export const timelinePatterns = {
  /** Outer list */
  list:        'relative space-y-0',
  /** Each timeline item */
  item:        'relative flex gap-4 pb-6 last:pb-0',
  /** Vertical connector line (left edge) */
  connector:   'absolute left-3.5 top-8 bottom-0 w-px bg-border last:hidden',
  /** Dot — neutral default */
  dot:         'relative flex-none w-7 h-7 rounded-full bg-muted border-2 border-border flex items-center justify-center mt-0.5',
  /** Dot — primary action */
  dotPrimary:  'relative flex-none w-7 h-7 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center mt-0.5',
  /** Dot — success / completed */
  dotSuccess:  'relative flex-none w-7 h-7 rounded-full bg-emerald-50 border-2 border-emerald-500 flex items-center justify-center mt-0.5',
  /** Dot — warning */
  dotWarning:  'relative flex-none w-7 h-7 rounded-full bg-amber-50 border-2 border-amber-500 flex items-center justify-center mt-0.5',
  /** Dot — danger */
  dotDanger:   'relative flex-none w-7 h-7 rounded-full bg-rose-50 border-2 border-rose-500 flex items-center justify-center mt-0.5',
  /** Content area (right of dot) */
  content:     'flex-1 min-w-0 pt-0.5',
  /** Primary text of the activity entry */
  heading:     'text-sm font-medium leading-snug',
  /** Actor name / bold part */
  actor:       'font-semibold text-foreground',
  /** Object link / clickable resource */
  objectLink:  'font-medium text-primary hover:underline cursor-pointer',
  /** Timestamp + metadata line */
  meta:        'text-xs text-muted-foreground mt-0.5 flex items-center gap-2',
  /** Category chip inside meta */
  category:    'inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-muted',
  /** Additional detail block (expanded view) */
  detail:      'mt-2 p-3 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground',
} as const;

export type TimelinePattern = keyof typeof timelinePatterns;

// ─────────────────────────────────────────────────────────────────────────────
// Grid / Layout Patterns
// ─────────────────────────────────────────────────────────────────────────────

export const layoutPatterns = {
  /** Standard page container */
  page:         'flex flex-col gap-6 p-6',
  /** Page with sidebar */
  pageSidebar:  'flex gap-6 p-6',
  /** Section wrapper */
  section:      'flex flex-col gap-4',
  /** Standard 2-col grid */
  grid2:        'grid grid-cols-1 md:grid-cols-2 gap-4',
  /** Standard 3-col grid */
  grid3:        'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4',
  /** 4-col KPI grid */
  grid4:        'grid grid-cols-2 lg:grid-cols-4 gap-4',
  /** Auto-fill grid (min 240px per card) */
  gridAuto:     'grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4',
  /** Toolbar: horizontal filter row */
  toolbar:      'bella-toolbar flex flex-wrap items-center gap-2',
  /** Stack with dividers */
  stack:        'flex flex-col divide-y divide-border',
  /** Horizontal pair */
  pair:         'flex items-center justify-between gap-4',
  /** Centered content */
  center:       'flex items-center justify-center',
  /** Empty state */
  empty:        'flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground',
} as const;

export type LayoutPattern = keyof typeof layoutPatterns;

// ─────────────────────────────────────────────────────────────────────────────
// Form Field Patterns
// ─────────────────────────────────────────────────────────────────────────────

export const formPatterns = {
  /** Single field wrapper */
  field:      'flex flex-col gap-1.5',
  /** Label */
  label:      'text-sm font-medium text-foreground',
  /** Required asterisk */
  required:   'text-destructive ml-0.5',
  /** Helper/error text */
  hint:       'text-xs text-muted-foreground',
  /** Error message */
  error:      'text-xs text-destructive',
  /** Input */
  input:      'h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
  /** Textarea */
  textarea:   'min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
  /** Form row (horizontal fields) */
  row:        'grid grid-cols-1 sm:grid-cols-2 gap-4',
  /** Form row 3-column */
  row3:       'grid grid-cols-1 sm:grid-cols-3 gap-4',
  /** Full width row */
  rowFull:    'grid grid-cols-1 gap-4',
  /** Form section header */
  sectionHeader: 'text-sm font-semibold text-foreground border-b border-border pb-2 mb-4',
  /** Submit button row */
  actions:    'flex items-center justify-end gap-3 pt-4 border-t border-border',
} as const;

export type FormPattern = keyof typeof formPatterns;
