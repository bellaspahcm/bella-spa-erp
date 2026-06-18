'use client';

import { useState, useEffect } from 'react';
import { APIKeyRotationScheduler } from '@/components/admin/partners/APIKeyRotationScheduler';
import { APIKeyLifecycleTimeline } from '@/components/admin/partners/APIKeyLifecycleTimeline';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, RotateCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import type { APIPartner } from '@/types/api-gateway';

interface PartnerSecurityTabProps {
  partner: APIPartner;
  onPartnerUpdate?: (updatedPartner: APIPartner) => void;
}

interface RotationPolicy {
  autoRotationEnabled: boolean;
  rotationInterval: '30' | '60' | '90' | 'custom';
  customIntervalDays: number | null;
  gracePeriodDays: number;
  notifyBeforeExpiryDays: number;
  notificationEmail: string;
}

interface KeyRotationEvent {
  id: string;
  eventType: 'created' | 'rotated' | 'expired' | 'revoked' | 'scheduled';
  timestamp: Date;
  oldKeyPrefix?: string;
  newKeyPrefix?: string;
  triggeredBy: 'system' | 'manual' | 'scheduled';
  reason?: string;
  gracePeriodEnded?: Date;
}

interface KeyLifecycleData {
  currentKeyCreatedAt: Date;
  currentKeyPrefix: string;
  lastRotatedAt?: Date | null;
  nextRotationDate?: Date | null;
  autoRotationEnabled: boolean;
  rotationHistory: KeyRotationEvent[];
}

export function PartnerSecurityTab({ partner, onPartnerUpdate }: PartnerSecurityTabProps) {
  const [rotationPolicy, setRotationPolicy] = useState<RotationPolicy | null>(null);
  const [lifecycleData, setLifecycleData] = useState<KeyLifecycleData | null>(null);
  const [isLoadingPolicy, setIsLoadingPolicy] = useState(true);
  const [isLoadingLifecycle, setIsLoadingLifecycle] = useState(true);
  const [showManualRotateDialog, setShowManualRotateDialog] = useState(false);
  const [manualRotateForm, setManualRotateForm] = useState({
    gracePeriodDays: 7,
    reason: '',
    notifyPartner: true,
  });
  const [isRotating, setIsRotating] = useState(false);

  // Fetch rotation policy
  useEffect(() => {
    fetchRotationPolicy();
  }, [partner.id]);

  // Fetch lifecycle data
  useEffect(() => {
    fetchLifecycleData();
  }, [partner.id]);

  const fetchRotationPolicy = async () => {
    setIsLoadingPolicy(true);
    try {
      const response = await fetch(`/api/admin/partners/${partner.id}/rotation-policy`);
      if (!response.ok) {
        throw new Error('Failed to fetch rotation policy');
      }
      const data = await response.json();
      setRotationPolicy(data.data?.policy || null);
    } catch (error) {
      console.error('Fetch rotation policy error:', error);
      toast.error('Không thể tải rotation policy');
    } finally {
      setIsLoadingPolicy(false);
    }
  };

  const fetchLifecycleData = async () => {
    setIsLoadingLifecycle(true);
    try {
      const response = await fetch(`/api/admin/partners/${partner.id}/key-lifecycle`);
      if (!response.ok) {
        throw new Error('Failed to fetch lifecycle data');
      }
      const data = await response.json();
      
      // Convert date strings to Date objects
      const lifecycleData = data.data;
      setLifecycleData({
        currentKeyCreatedAt: new Date(lifecycleData.currentKeyCreatedAt),
        currentKeyPrefix: lifecycleData.currentKeyPrefix,
        lastRotatedAt: lifecycleData.lastRotatedAt ? new Date(lifecycleData.lastRotatedAt) : null,
        nextRotationDate: lifecycleData.nextRotationDate ? new Date(lifecycleData.nextRotationDate) : null,
        autoRotationEnabled: lifecycleData.autoRotationEnabled,
        rotationHistory: lifecycleData.rotationHistory.map((event: any) => ({
          ...event,
          timestamp: new Date(event.timestamp),
          gracePeriodEnded: event.gracePeriodEnded ? new Date(event.gracePeriodEnded) : undefined,
        })),
      });
    } catch (error) {
      console.error('Fetch lifecycle data error:', error);
      toast.error('Không thể tải lifecycle data');
    } finally {
      setIsLoadingLifecycle(false);
    }
  };

  const handleSavePolicy = async (policy: RotationPolicy) => {
    // Refetch data after saving policy
    await fetchRotationPolicy();
    await fetchLifecycleData();
  };

  const handleOpenManualRotate = () => {
    setManualRotateForm({
      gracePeriodDays: rotationPolicy?.gracePeriodDays || 7,
      reason: '',
      notifyPartner: true,
    });
    setShowManualRotateDialog(true);
  };

  const handleManualRotate = async () => {
    if (!manualRotateForm.reason.trim()) {
      toast.error('Vui lòng nhập lý do rotation');
      return;
    }

    setIsRotating(true);

    try {
      const response = await fetch(`/api/admin/partners/${partner.id}/rotate-key-scheduled`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manualRotateForm),
      });

      if (!response.ok) {
        throw new Error('Failed to rotate key');
      }

      const data = await response.json();

      toast.success('API Key đã được rotate thành công!', {
        description: `Grace period: ${manualRotateForm.gracePeriodDays} ngày`,
      });

      // Refetch data
      await fetchLifecycleData();
      
      setShowManualRotateDialog(false);

      // Notify parent to refetch partner data
      if (onPartnerUpdate) {
        // In a real implementation, refetch partner data
        console.log('Partner updated, refetch data');
      }
    } catch (error) {
      console.error('Manual rotate error:', error);
      toast.error('Không thể rotate API key', {
        description: 'Vui lòng thử lại sau',
      });
    } finally {
      setIsRotating(false);
    }
  };

  if (isLoadingPolicy || isLoadingLifecycle) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Shield className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3 animate-pulse" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải security settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Security & Key Management
          </h2>
          <p className="text-muted-foreground mt-1">
            Quản lý bảo mật và tự động hóa rotation cho API keys
          </p>
        </div>
      </div>

      {/* API Key Rotation Scheduler */}
      <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-6 bg-white dark:bg-gray-950">
        <APIKeyRotationScheduler
          partnerId={partner.id}
          partnerName={partner.partner_name}
          currentPolicy={rotationPolicy}
          onSave={handleSavePolicy}
        />
      </div>

      {/* API Key Lifecycle Timeline */}
      <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-6 bg-white dark:bg-gray-950">
        {lifecycleData ? (
          <APIKeyLifecycleTimeline
            partnerId={partner.id}
            partnerName={partner.partner_name}
            currentKeyCreatedAt={lifecycleData.currentKeyCreatedAt}
            currentKeyPrefix={lifecycleData.currentKeyPrefix}
            lastRotatedAt={lifecycleData.lastRotatedAt}
            nextRotationDate={lifecycleData.nextRotationDate}
            rotationHistory={lifecycleData.rotationHistory}
            autoRotationEnabled={lifecycleData.autoRotationEnabled}
            onManualRotate={handleOpenManualRotate}
          />
        ) : (
          <div className="py-8 text-center text-gray-500 dark:text-gray-400">
            Không có dữ liệu lifecycle
          </div>
        )}
      </div>

      {/* Manual Rotate Dialog */}
      <Dialog open={showManualRotateDialog} onOpenChange={setShowManualRotateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCw className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Manual API Key Rotation
            </DialogTitle>
            <DialogDescription>
              Thay đổi API key thủ công cho <strong>{partner.partner_name}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Grace Period */}
            <div className="space-y-2">
              <Label htmlFor="grace-period">Grace Period (ngày)</Label>
              <Input
                id="grace-period"
                type="number"
                min="0"
                max="30"
                value={manualRotateForm.gracePeriodDays}
                onChange={(e) =>
                  setManualRotateForm((prev) => ({
                    ...prev,
                    gracePeriodDays: parseInt(e.target.value, 10) || 0,
                  }))
                }
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Thời gian cả old key và new key đều hoạt động (0-30 ngày)
              </p>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason">Lý do rotation *</Label>
              <Input
                id="reason"
                placeholder="Ví dụ: Security audit, Key compromised, Regular rotation..."
                value={manualRotateForm.reason}
                onChange={(e) =>
                  setManualRotateForm((prev) => ({
                    ...prev,
                    reason: e.target.value,
                  }))
                }
              />
            </div>

            {/* Warning */}
            <div className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded-md">
              <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
              <div className="text-xs text-gray-700 dark:text-gray-300">
                <strong>Lưu ý:</strong> Old API key sẽ hết hạn sau {manualRotateForm.gracePeriodDays} ngày.
                Partner cần cập nhật hệ thống sang key mới trước khi grace period kết thúc.
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowManualRotateDialog(false)}
              disabled={isRotating}
            >
              Hủy
            </Button>
            <Button
              onClick={handleManualRotate}
              disabled={isRotating || !manualRotateForm.reason.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isRotating ? (
                <>
                  <RotateCw className="mr-2 h-4 w-4 animate-spin" />
                  Đang rotate...
                </>
              ) : (
                <>
                  <RotateCw className="mr-2 h-4 w-4" />
                  Rotate Key
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
