'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Calendar, Clock, Shield, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { toast } from 'sonner';

type RotationInterval = '30' | '60' | '90' | 'custom';

interface RotationPolicy {
  autoRotationEnabled: boolean;
  rotationInterval: RotationInterval;
  customIntervalDays: number | null;
  gracePeriodDays: number;
  notifyBeforeExpiryDays: number;
  notificationEmail: string;
}

interface APIKeyRotationSchedulerProps {
  partnerId: string;
  partnerName: string;
  currentPolicy?: RotationPolicy | null;
  onSave?: (policy: RotationPolicy) => void;
}

const DEFAULT_POLICY: RotationPolicy = {
  autoRotationEnabled: false,
  rotationInterval: '90',
  customIntervalDays: null,
  gracePeriodDays: 7,
  notifyBeforeExpiryDays: 14,
  notificationEmail: '',
};

export function APIKeyRotationScheduler({
  partnerId,
  partnerName,
  currentPolicy,
  onSave,
}: APIKeyRotationSchedulerProps) {
  const [policy, setPolicy] = useState<RotationPolicy>(currentPolicy || DEFAULT_POLICY);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handleAutoRotationToggle = (enabled: boolean) => {
    setPolicy((prev) => ({ ...prev, autoRotationEnabled: enabled }));
    setHasChanges(true);
  };

  const handleIntervalChange = (value: string | null) => {
    if (!value) return;
    setPolicy((prev) => ({
      ...prev,
      rotationInterval: value as RotationInterval,
      customIntervalDays: value === 'custom' ? (prev.customIntervalDays || 180) : null,
    }));
    setHasChanges(true);
  };

  const handleCustomIntervalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (isNaN(value) || value < 1) return;
    setPolicy((prev) => ({ ...prev, customIntervalDays: value }));
    setHasChanges(true);
  };

  const handleGracePeriodChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (isNaN(value) || value < 0) return;
    setPolicy((prev) => ({ ...prev, gracePeriodDays: value }));
    setHasChanges(true);
  };

  const handleNotifyBeforeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (isNaN(value) || value < 0) return;
    setPolicy((prev) => ({ ...prev, notifyBeforeExpiryDays: value }));
    setHasChanges(true);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPolicy((prev) => ({ ...prev, notificationEmail: e.target.value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!hasChanges) {
      toast.info('Không có thay đổi nào để lưu');
      return;
    }

    // Validation
    if (policy.autoRotationEnabled && !policy.notificationEmail) {
      toast.error('Vui lòng nhập email để nhận thông báo');
      return;
    }

    if (policy.rotationInterval === 'custom' && (!policy.customIntervalDays || policy.customIntervalDays < 1)) {
      toast.error('Vui lòng nhập khoảng thời gian rotation hợp lệ (tối thiểu 1 ngày)');
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/admin/partners/${partnerId}/rotation-policy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policy),
      });

      if (!response.ok) {
        throw new Error('Failed to save rotation policy');
      }

      const data = await response.json();
      
      toast.success('Đã lưu cấu hình rotation policy thành công', {
        description: policy.autoRotationEnabled
          ? `Auto-rotation sẽ chạy mỗi ${getIntervalDays(policy)} ngày`
          : 'Auto-rotation đã tắt',
      });

      setHasChanges(false);
      onSave?.(policy);
    } catch (error) {
      console.error('Save rotation policy error:', error);
      toast.error('Không thể lưu rotation policy', {
        description: 'Vui lòng thử lại sau',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setPolicy(currentPolicy || DEFAULT_POLICY);
    setHasChanges(false);
    toast.info('Đã khôi phục cấu hình ban đầu');
  };

  const getIntervalDays = (p: RotationPolicy): number => {
    if (p.rotationInterval === 'custom') {
      return p.customIntervalDays || 0;
    }
    return parseInt(p.rotationInterval, 10);
  };

  const intervalDays = getIntervalDays(policy);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Cấu hình Rotation Policy
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Tự động thay đổi API key định kỳ để tăng cường bảo mật cho <span className="font-medium">{partnerName}</span>
          </p>
        </div>
      </div>

      {/* Auto-rotation Toggle */}
      <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            {policy.autoRotationEnabled ? (
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-gray-400 dark:text-gray-600" />
            )}
          </div>
          <div>
            <Label htmlFor="auto-rotation" className="text-sm font-semibold text-gray-900 dark:text-gray-100 cursor-pointer">
              Bật Auto-Rotation
            </Label>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Tự động tạo API key mới theo lịch trình định kỳ
            </p>
          </div>
        </div>
        <Switch
          id="auto-rotation"
          checked={policy.autoRotationEnabled}
          onCheckedChange={handleAutoRotationToggle}
        />
      </div>

      {/* Rotation Interval */}
      <div className="space-y-2">
        <Label htmlFor="rotation-interval" className="text-sm font-medium flex items-center gap-2">
          <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          Khoảng thời gian Rotation
        </Label>
        <Select
          value={policy.rotationInterval}
          onValueChange={handleIntervalChange}
          disabled={!policy.autoRotationEnabled}
        >
          <SelectTrigger id="rotation-interval" className="w-full">
            <SelectValue placeholder="Chọn khoảng thời gian" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">30 ngày (Bảo mật cao)</SelectItem>
            <SelectItem value="60">60 ngày (Khuyến nghị)</SelectItem>
            <SelectItem value="90">90 ngày (Tiêu chuẩn)</SelectItem>
            <SelectItem value="custom">Tùy chỉnh</SelectItem>
          </SelectContent>
        </Select>
        {policy.rotationInterval === 'custom' && (
          <div className="mt-2">
            <Input
              type="number"
              min="1"
              value={policy.customIntervalDays || ''}
              onChange={handleCustomIntervalChange}
              placeholder="Nhập số ngày (ví dụ: 180)"
              disabled={!policy.autoRotationEnabled}
              className="w-full"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Tối thiểu 1 ngày, khuyến nghị từ 30-180 ngày
            </p>
          </div>
        )}
      </div>

      {/* Grace Period */}
      <div className="space-y-2">
        <Label htmlFor="grace-period" className="text-sm font-medium flex items-center gap-2">
          <Clock className="w-4 h-4 text-orange-600 dark:text-orange-400" />
          Grace Period (Thời gian chuyển tiếp)
        </Label>
        <Input
          id="grace-period"
          type="number"
          min="0"
          value={policy.gracePeriodDays}
          onChange={handleGracePeriodChange}
          disabled={!policy.autoRotationEnabled}
          className="w-full"
        />
        <div className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded-md">
          <Info className="w-4 h-4 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
          <p className="text-xs text-gray-700 dark:text-gray-300">
            Trong thời gian grace period ({policy.gracePeriodDays} ngày), cả API key cũ và mới đều hợp lệ. 
            Partner có thời gian cập nhật hệ thống sang key mới mà không bị gián đoạn dịch vụ.
          </p>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-800 rounded-lg">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Cài đặt Thông báo
        </h4>

        {/* Notify Before Expiry */}
        <div className="space-y-2">
          <Label htmlFor="notify-before" className="text-sm font-medium">
            Thông báo trước khi hết hạn
          </Label>
          <Input
            id="notify-before"
            type="number"
            min="0"
            value={policy.notifyBeforeExpiryDays}
            onChange={handleNotifyBeforeChange}
            disabled={!policy.autoRotationEnabled}
            className="w-full"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Gửi email cảnh báo <strong>{policy.notifyBeforeExpiryDays} ngày</strong> trước khi API key hết hạn
          </p>
        </div>

        {/* Notification Email */}
        <div className="space-y-2">
          <Label htmlFor="notification-email" className="text-sm font-medium">
            Email nhận thông báo
          </Label>
          <Input
            id="notification-email"
            type="email"
            value={policy.notificationEmail}
            onChange={handleEmailChange}
            placeholder="admin@example.com"
            disabled={!policy.autoRotationEnabled}
            className="w-full"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Email này sẽ nhận thông báo về rotation schedule và expiry warnings
          </p>
        </div>
      </div>

      {/* Summary Card */}
      {policy.autoRotationEnabled && intervalDays > 0 && (
        <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border border-blue-200 dark:border-blue-900 rounded-lg">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            📋 Tóm tắt Policy
          </h4>
          <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400">•</span>
              <span>
                API key sẽ được tự động thay đổi mỗi <strong>{intervalDays} ngày</strong>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400">•</span>
              <span>
                Grace period: <strong>{policy.gracePeriodDays} ngày</strong> (cả old key và new key đều hoạt động)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400">•</span>
              <span>
                Email cảnh báo được gửi <strong>{policy.notifyBeforeExpiryDays} ngày</strong> trước expiry đến{' '}
                <strong>{policy.notificationEmail || '(chưa cấu hình)'}</strong>
              </span>
            </li>
          </ul>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
        <Button
          type="button"
          variant="outline"
          onClick={handleReset}
          disabled={!hasChanges || isSaving}
        >
          Reset
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isSaving ? 'Đang lưu...' : 'Lưu Policy'}
        </Button>
      </div>
    </div>
  );
}
