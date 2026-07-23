/**
 * Dialog để tùy chỉnh Rate Limit cho Partner
 * 
 * Features:
 * - Chọn tier (Basic, Standard, Premium, Enterprise, Custom)
 * - Custom limits nếu chọn tier Custom
 * - Preview tác động của thay đổi
 * - Warning nếu giảm limits
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Settings,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Info,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import type { APIPartner } from '@/types/api-gateway';

interface RateLimitCustomizationDialogProps {
  partner: APIPartner;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type RateLimitTier = 'free' | 'basic' | 'standard' | 'premium' | 'enterprise' | 'custom';

interface TierConfig {
  name: string;
  description: string;
  price: string;
  limits: {
    per_minute: number;
    per_day: number;
    burst: number;
  };
  features: string[];
}

const TIER_CONFIGS: Record<RateLimitTier, TierConfig> = {
  free: {
    name: 'Free',
    description: 'Cho testing và development',
    price: 'Miễn phí',
    limits: {
      per_minute: 10,
      per_day: 1000,
      burst: 20,
    },
    features: [
      'Sandbox mode only',
      'Email support',
      'Basic analytics',
    ],
  },
  basic: {
    name: 'Basic',
    description: 'Phù hợp cho dự án nhỏ',
    price: '500.000 ₫/tháng',
    limits: {
      per_minute: 100,
      per_day: 10000,
      burst: 200,
    },
    features: [
      'Production access',
      'Email + chat support',
      'Standard analytics',
      'Webhook support',
    ],
  },
  standard: {
    name: 'Standard',
    description: 'Cho doanh nghiệp vừa',
    price: '2.000.000 ₫/tháng',
    limits: {
      per_minute: 500,
      per_day: 100000,
      burst: 1000,
    },
    features: [
      'Priority support',
      'Advanced analytics',
      'Webhook retry',
      'SLA 99.5%',
    ],
  },
  premium: {
    name: 'Premium',
    description: 'Cho doanh nghiệp lớn',
    price: '5.000.000 ₫/tháng',
    limits: {
      per_minute: 2000,
      per_day: 500000,
      burst: 5000,
    },
    features: [
      'Dedicated support',
      'Real-time analytics',
      'Advanced webhooks',
      'SLA 99.9%',
      'Custom integration',
    ],
  },
  enterprise: {
    name: 'Enterprise',
    description: 'Giải pháp tùy chỉnh',
    price: 'Liên hệ',
    limits: {
      per_minute: 10000,
      per_day: 5000000,
      burst: 20000,
    },
    features: [
      'White-glove support',
      'Custom SLA',
      'Dedicated infrastructure',
      'Advanced security',
      'API versioning',
    ],
  },
  custom: {
    name: 'Custom',
    description: 'Tùy chỉnh theo nhu cầu',
    price: 'Tùy chỉnh',
    limits: {
      per_minute: 100,
      per_day: 10000,
      burst: 200,
    },
    features: [
      'Flexible limits',
      'Pay as you go',
    ],
  },
};

export function RateLimitCustomizationDialog({
  partner,
  open,
  onOpenChange,
}: RateLimitCustomizationDialogProps) {
  const router = useRouter();

  // State
  const [selectedTier, setSelectedTier] = useState<RateLimitTier>(
    (partner.rate_limit_tier === 'pro' ? 'premium' : 
     partner.rate_limit_tier === 'unlimited' ? 'enterprise' : 
     partner.rate_limit_tier || 'basic') as RateLimitTier
  );
  const [customLimits, setCustomLimits] = useState({
    per_minute: partner.rate_limit_per_minute || 100,
    per_day: partner.rate_limit_per_day || 10000,
    burst: partner.rate_limit_burst || 200,
  });
  const [loading, setLoading] = useState(false);

  // Reset when partner changes
  useEffect(() => {
    const mappedTier = (
      partner.rate_limit_tier === 'pro' ? 'premium' : 
      partner.rate_limit_tier === 'unlimited' ? 'enterprise' : 
      partner.rate_limit_tier || 'basic'
    ) as RateLimitTier;
    setSelectedTier(mappedTier);
    setCustomLimits({
      per_minute: partner.rate_limit_per_minute || 100,
      per_day: partner.rate_limit_per_day || 10000,
      burst: partner.rate_limit_burst || 200,
    });
  }, [partner]);

  // Get current config
  const mappedCurrentTier = (
    partner.rate_limit_tier === 'pro' ? 'premium' : 
    partner.rate_limit_tier === 'unlimited' ? 'enterprise' : 
    partner.rate_limit_tier || 'basic'
  ) as RateLimitTier;
  const currentConfig = TIER_CONFIGS[mappedCurrentTier];
  const selectedConfig = TIER_CONFIGS[selectedTier];

  // Calculate changes
  const changes = {
    per_minute:
      selectedTier === 'custom'
        ? customLimits.per_minute - partner.rate_limit_per_minute
        : selectedConfig.limits.per_minute - partner.rate_limit_per_minute,
    per_day:
      selectedTier === 'custom'
        ? customLimits.per_day - partner.rate_limit_per_day
        : selectedConfig.limits.per_day - partner.rate_limit_per_day,
    burst:
      selectedTier === 'custom'
        ? customLimits.burst - partner.rate_limit_burst
        : selectedConfig.limits.burst - partner.rate_limit_burst,
  };

  const hasChanges =
    selectedTier !== mappedCurrentTier ||
    (selectedTier === 'custom' &&
      (customLimits.per_minute !== partner.rate_limit_per_minute ||
        customLimits.per_day !== partner.rate_limit_per_day ||
        customLimits.burst !== partner.rate_limit_burst));

  const isDowngrade =
    changes.per_minute < 0 || changes.per_day < 0 || changes.burst < 0;

  // Handle save
  const handleSave = async () => {
    setLoading(true);
    try {
      const newLimits =
        selectedTier === 'custom'
          ? customLimits
          : selectedConfig.limits;

      const dbTierMap: Record<RateLimitTier, string> = {
        free: 'free',
        basic: 'basic',
        standard: 'pro',
        premium: 'pro',
        enterprise: 'unlimited',
        custom: 'unlimited',
      };

      const dbTier = dbTierMap[selectedTier] || 'basic';

      const response = await fetch(`/api/admin/partners/${partner.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rate_limit_tier: dbTier,
          rate_limit_per_minute: newLimits.per_minute,
          rate_limit_per_day: newLimits.per_day,
          rate_limit_burst: newLimits.burst,
        }),
      });

      if (!response.ok) {
        throw new Error('Không thể cập nhật rate limit');
      }

      toast.success('Đã cập nhật rate limit thành công');
      onOpenChange(false);
      router.refresh();
    } catch (_error) {
      toast.error('Không thể cập nhật rate limit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Tùy Chỉnh Rate Limit
          </DialogTitle>
          <DialogDescription>
            Điều chỉnh giới hạn API requests cho {partner.partner_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Tier */}
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm font-medium mb-2">Tier Hiện Tại</p>
            <div className="flex items-center justify-between">
              <div>
                <Badge variant="outline" className="text-base">
                  {currentConfig.name}
                </Badge>
                <p className="text-sm text-muted-foreground mt-1">
                  {partner.rate_limit_per_minute.toLocaleString('vi-VN')} req/min •{' '}
                  {partner.rate_limit_per_day.toLocaleString('vi-VN')} req/day
                </p>
              </div>
              <p className="text-sm font-medium">{currentConfig.price}</p>
            </div>
          </div>

          {/* Tier Selection */}
          <div className="space-y-3">
            <Label>Chọn Tier</Label>
            <Select
              value={selectedTier}
              onValueChange={(value: string | null) =>
                value && setSelectedTier(value as RateLimitTier)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TIER_CONFIGS) as RateLimitTier[]).map((tier) => (
                  <SelectItem key={tier} value={tier}>
                    {TIER_CONFIGS[tier].name} - {TIER_CONFIGS[tier].price}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Selected Tier Details */}
          <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-lg">{selectedConfig.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedConfig.description}
                </p>
              </div>
              <Badge variant="outline" className="text-base">
                {selectedConfig.price}
              </Badge>
            </div>

            <Separator />

            {/* Limits */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Giới Hạn</p>
              {selectedTier === 'custom' ? (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="custom_per_minute">Requests / Phút</Label>
                    <Input
                      id="custom_per_minute"
                      type="number"
                      min="1"
                      value={customLimits.per_minute}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setCustomLimits({
                          ...customLimits,
                          per_minute: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="custom_per_day">Requests / Ngày</Label>
                    <Input
                      id="custom_per_day"
                      type="number"
                      min="1"
                      value={customLimits.per_day}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setCustomLimits({
                          ...customLimits,
                          per_day: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="custom_burst">Burst Limit</Label>
                    <Input
                      id="custom_burst"
                      type="number"
                      min="1"
                      value={customLimits.burst}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setCustomLimits({
                          ...customLimits,
                          burst: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Số requests tối đa trong một lần burst
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Per Minute</p>
                    <p className="text-xl font-bold">
                      {selectedConfig.limits.per_minute.toLocaleString('vi-VN')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Per Day</p>
                    <p className="text-xl font-bold">
                      {selectedConfig.limits.per_day.toLocaleString('vi-VN')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Burst</p>
                    <p className="text-xl font-bold">
                      {selectedConfig.limits.burst.toLocaleString('vi-VN')}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Features */}
            <div>
              <p className="text-sm font-medium mb-2">Tính Năng</p>
              <ul className="space-y-1">
                {selectedConfig.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-600" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Preview Changes */}
          {hasChanges && (
            <div
              className={`border rounded-lg p-4 ${
                isDowngrade
                  ? 'bg-red-50 border-red-200'
                  : 'bg-blue-50 border-blue-200'
              }`}
            >
              <div className="flex items-start gap-3">
                {isDowngrade ? (
                  <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                ) : (
                  <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-medium text-sm mb-2">
                    {isDowngrade ? 'Cảnh Báo: Giảm Giới Hạn' : 'Preview Thay Đổi'}
                  </p>
                  <div className="space-y-1 text-sm">
                    {changes.per_minute !== 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Per Minute:</span>
                        <span className="font-mono">
                          {partner.rate_limit_per_minute.toLocaleString('vi-VN')}
                        </span>
                        <span>→</span>
                        <span className="font-mono font-medium">
                          {(selectedTier === 'custom'
                            ? customLimits.per_minute
                            : selectedConfig.limits.per_minute
                          ).toLocaleString('vi-VN')}
                        </span>
                        {changes.per_minute > 0 ? (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                    )}

                    {changes.per_day !== 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Per Day:</span>
                        <span className="font-mono">
                          {partner.rate_limit_per_day.toLocaleString('vi-VN')}
                        </span>
                        <span>→</span>
                        <span className="font-mono font-medium">
                          {(selectedTier === 'custom'
                            ? customLimits.per_day
                            : selectedConfig.limits.per_day
                          ).toLocaleString('vi-VN')}
                        </span>
                        {changes.per_day > 0 ? (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                    )}

                    {changes.burst !== 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Burst:</span>
                        <span className="font-mono">
                          {partner.rate_limit_burst.toLocaleString('vi-VN')}
                        </span>
                        <span>→</span>
                        <span className="font-mono font-medium">
                          {(selectedTier === 'custom'
                            ? customLimits.burst
                            : selectedConfig.limits.burst
                          ).toLocaleString('vi-VN')}
                        </span>
                        {changes.burst > 0 ? (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                    )}
                  </div>

                  {isDowngrade && (
                    <p className="text-xs text-red-700 mt-2">
                      <strong>Lưu ý:</strong> Giảm giới hạn có thể ảnh hưởng đến hoạt động
                      của đối tác. Vui lòng thông báo trước cho họ.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Hủy
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || loading}>
            {loading ? 'Đang lưu...' : 'Áp Dụng Thay Đổi'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
