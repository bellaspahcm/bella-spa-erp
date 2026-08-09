/**
 * Rule Provider Badge Component
 *
 * Provider-specific badges with icons:
 * - booking: 📅
 * - discount: 💰
 * - payroll: 💵
 * - commission: 💸
 * - inventory: 📦
 */

import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Tag,
  Wallet,
  TrendingUp,
  Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useModuleVocabulary } from '@/hooks/useModuleVocabulary';

interface RuleProviderBadgeProps {
  provider: string;
  className?: string;
}

const PROVIDER_CONFIG = {
  booking: {
    label: 'Đặt lịch',
    icon: Calendar,
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  discount: {
    label: 'Chiết khấu',
    icon: Tag,
    className: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  payroll: {
    label: 'Tính lương',
    icon: Wallet,
    className: 'bg-green-50 text-green-700 border-green-200',
  },
  commission: {
    label: 'Hoa hồng',
    icon: TrendingUp,
    className: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  inventory: {
    label: 'Kho hàng',
    icon: Package,
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
} as const;

export function RuleProviderBadge({ provider, className }: RuleProviderBadgeProps) {
  const vocab = useModuleVocabulary();
  const isRealEstate = vocab.booking.singular.includes('giữ chỗ') || vocab.worker.short === 'CVTV';
  const isCleaning = vocab.worker.short === 'NVS';
  const isHealthcare = vocab.worker.short === 'Bác sĩ';

  let dynamicLabel: string = provider;
  if (provider === 'booking') {
    dynamicLabel = isRealEstate ? 'Giữ chỗ' : isCleaning ? 'Phiếu công việc' : isHealthcare ? 'Hẹn khám & Giường' : 'Đặt lịch';
  } else if (provider === 'discount') {
    dynamicLabel = isHealthcare ? 'Khấu trừ / BHYT' : 'Chiết khấu';
  } else if (provider === 'payroll') {
    dynamicLabel = isHealthcare ? 'Lương & Trực' : 'Tính lương';
  } else if (provider === 'commission') {
    dynamicLabel = isHealthcare ? 'Thù lao lâm sàng' : 'Hoa hồng';
  } else if (provider === 'inventory') {
    dynamicLabel = isRealEstate ? 'Giỏ hàng' : isHealthcare ? 'Kho dược & Vật tư' : 'Kho hàng';
  }

  const config = PROVIDER_CONFIG[provider as keyof typeof PROVIDER_CONFIG] || {
    label: provider,
    icon: Package,
    className: 'bg-gray-50 text-gray-700 border-gray-200',
  };

  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn('flex items-center gap-1.5 w-fit font-bold', config.className, className)}
    >
      <Icon className="h-3 w-3" />
      <span>{dynamicLabel}</span>
    </Badge>
  );
}
