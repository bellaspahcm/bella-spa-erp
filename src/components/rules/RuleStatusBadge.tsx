/**
 * Rule Status Badge Component
 * 
 * Color-coded status badges for rules:
 * - draft: gray
 * - active: green
 * - disabled: yellow
 * - pending_approval: blue
 * - approved: green
 * - rejected: red
 * - archived: gray
 */

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface RuleStatusBadgeProps {
  status: string;
  className?: string;
}

const STATUS_CONFIG = {
  draft: {
    label: 'Draft',
    variant: 'secondary' as const,
    className: 'bg-gray-100 text-gray-700 hover:bg-gray-100',
  },
  active: {
    label: 'Active',
    variant: 'default' as const,
    className: 'bg-green-100 text-green-700 hover:bg-green-100',
  },
  disabled: {
    label: 'Disabled',
    variant: 'secondary' as const,
    className: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100',
  },
  pending_approval: {
    label: 'Pending',
    variant: 'secondary' as const,
    className: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
  },
  approved: {
    label: 'Approved',
    variant: 'default' as const,
    className: 'bg-green-100 text-green-700 hover:bg-green-100',
  },
  rejected: {
    label: 'Rejected',
    variant: 'destructive' as const,
    className: 'bg-red-100 text-red-700 hover:bg-red-100',
  },
  archived: {
    label: 'Archived',
    variant: 'secondary' as const,
    className: 'bg-gray-100 text-gray-700 hover:bg-gray-100',
  },
} as const;

export function RuleStatusBadge({ status, className }: RuleStatusBadgeProps) {
  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || {
    label: status,
    variant: 'secondary' as const,
    className: '',
  };

  return (
    <Badge
      variant={config.variant}
      className={cn(config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
