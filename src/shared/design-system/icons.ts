/**
 * @fileoverview Design System — Icon Mappings
 *
 * Centralized semantic icon registry for the Real Estate ERP.
 * Maps business concepts → Lucide icon names.
 *
 * Usage:
 *   import { icons } from '@/shared/design-system';
 *   import { [icons.property] } from 'lucide-react';
 *
 * All names are exact Lucide icon identifiers.
 *
 * @module shared/design-system/icons
 */

// ─────────────────────────────────────────────────────────────────────────────
// Real Estate / Property
// ─────────────────────────────────────────────────────────────────────────────

export const propertyIcons = {
  property:     'Building2',
  apartment:    'BuildingIcon',
  project:      'Layers',
  zone:         'Grid3x3',
  block:        'LayoutGrid',
  floor:        'Layers2',
  unit:         'Home',
  area:         'Ruler',
  handover:     'KeyRound',
  transfer:     'ArrowRightLeft',
  blueprint:    'FileJson',
  map:          'Map',
  coordinates:  'MapPin',
  direction:    'Compass',
  view:         'Eye',
  penthouse:    'Crown',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Sales / Transaction
// ─────────────────────────────────────────────────────────────────────────────

export const salesIcons = {
  booking:      'BookmarkCheck',
  deposit:      'Wallet',
  contract:     'FileSignature',
  payment:      'CreditCard',
  installment:  'CalendarDays',
  invoice:      'Receipt',
  revenue:      'TrendingUp',
  discount:     'Tag',
  promotion:    'Percent',
  priceList:    'ListOrdered',
  commission:   'CircleDollarSign',
  refund:       'Undo2',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// CRM / Customer
// ─────────────────────────────────────────────────────────────────────────────

export const crmIcons = {
  customer:     'User',
  customers:    'Users',
  lead:         'Zap',
  opportunity:  'Target',
  pipeline:     'GitMerge',
  siteVisit:    'CalendarCheck',
  coOwner:      'UserPlus',
  family:       'Heart',
  investProfile:'BarChart3',
  contact:      'Phone',
  email:        'Mail',
  note:         'StickyNote',
  tag:          'Tag',
  source:       'Globe',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Finance / Accounting
// ─────────────────────────────────────────────────────────────────────────────

export const financeIcons = {
  accounting:   'BookOpen',
  cashFlow:     'Waves',
  budget:       'PiggyBank',
  expense:      'ArrowDownLeft',
  income:       'ArrowUpRight',
  balance:      'Scale',
  bank:         'Landmark',
  vat:          'Percent',
  ledger:       'Scroll',
  report:       'FileBarChart',
  pnl:          'BarChart2',
  accrual:      'Clock',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Status / State (generic)
// ─────────────────────────────────────────────────────────────────────────────

export const statusIcons = {
  active:       'CheckCircle2',
  inactive:     'MinusCircle',
  pending:      'Clock',
  processing:   'Loader2',
  approved:     'BadgeCheck',
  rejected:     'XCircle',
  cancelled:    'Ban',
  expired:      'CalendarX',
  draft:        'FilePen',
  review:       'Eye',
  signed:       'PenLine',
  locked:       'Lock',
  unlocked:     'LockOpen',
  success:      'CheckCircle2',
  warning:      'AlertTriangle',
  error:        'AlertCircle',
  info:         'Info',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Platform / System
// ─────────────────────────────────────────────────────────────────────────────

export const platformIcons = {
  settings:     'Settings',
  config:       'SlidersHorizontal',
  permissions:  'Shield',
  audit:        'ScrollText',
  webhook:      'Webhook',
  notification: 'Bell',
  search:       'Search',
  filter:       'Filter',
  sort:         'ArrowUpDown',
  refresh:      'RefreshCw',
  loading:      'Loader2',
  download:     'Download',
  upload:       'Upload',
  export:       'FileDown',
  import:       'FileUp',
  print:        'Printer',
  share:        'Share2',
  link:         'Link2',
  copy:         'Copy',
  edit:         'Pencil',
  delete:       'Trash2',
  archive:      'Archive',
  restore:      'ArchiveRestore',
  add:          'Plus',
  addCircle:    'PlusCircle',
  remove:       'Minus',
  close:        'X',
  back:         'ChevronLeft',
  forward:      'ChevronRight',
  expand:       'ChevronDown',
  collapse:     'ChevronUp',
  menu:         'Menu',
  more:         'MoreHorizontal',
  moreVert:     'MoreVertical',
  drag:         'GripVertical',
  fullscreen:   'Maximize2',
  exitFullscreen:'Minimize2',
  darkMode:     'Moon',
  lightMode:    'Sun',
  calendar:     'Calendar',
  clock:        'Clock',
  date:         'CalendarDays',
  time:         'Timer',
  chart:        'BarChart3',
  analytics:    'LineChart',
  ai:           'Sparkles',
  robot:        'Bot',
  key:          'Key',
  user:         'User',
  users:        'Users',
  role:         'Shield',
  logout:       'LogOut',
  home:         'Home',
  dashboard:    'LayoutDashboard',
  document:     'FileText',
  documents:    'Files',
  attachment:   'Paperclip',
  image:        'Image',
  signature:    'PenLine',
  stamp:        'Stamp',
  dlq:          'AlertOctagon',
  integration:  'Plug',
  database:     'Database',
  api:          'Code2',
  activity:     'Activity',
  timeline:     'History',
  kpi:          'Gauge',
  ranking:      'Trophy',
  map:          'Map',
  location:     'MapPin',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Master Icon Map (merged, for runtime lookup)
// ─────────────────────────────────────────────────────────────────────────────

export const icons = {
  ...propertyIcons,
  ...salesIcons,
  ...crmIcons,
  ...financeIcons,
  ...statusIcons,
  ...platformIcons,
} as const;

export type IconName = (typeof icons)[keyof typeof icons];
export type IconKey  = keyof typeof icons;
