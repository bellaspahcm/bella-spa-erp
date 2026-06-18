'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  Clock,
  Key,
  RotateCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  History,
} from 'lucide-react';
import { formatDistanceToNow, format, differenceInDays, isPast, isFuture } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';

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

interface APIKeyLifecycleTimelineProps {
  partnerId: string;
  partnerName: string;
  currentKeyCreatedAt: Date;
  currentKeyPrefix: string;
  lastRotatedAt?: Date | null;
  nextRotationDate?: Date | null;
  rotationHistory?: KeyRotationEvent[];
  autoRotationEnabled?: boolean;
  onManualRotate?: () => void;
}

export function APIKeyLifecycleTimeline({
  partnerId,
  partnerName,
  currentKeyCreatedAt,
  currentKeyPrefix,
  lastRotatedAt,
  nextRotationDate,
  rotationHistory = [],
  autoRotationEnabled = false,
  onManualRotate,
}: APIKeyLifecycleTimelineProps) {
  const [showFullHistory, setShowFullHistory] = useState(false);

  const daysSinceCreation = differenceInDays(new Date(), currentKeyCreatedAt);
  const daysUntilRotation = nextRotationDate ? differenceInDays(nextRotationDate, new Date()) : null;
  const isRotationSoon = daysUntilRotation !== null && daysUntilRotation <= 14 && daysUntilRotation > 0;
  const isRotationOverdue = daysUntilRotation !== null && daysUntilRotation < 0;

  // Sort rotation history by timestamp (newest first)
  const sortedHistory = [...rotationHistory].sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
  );

  const displayedHistory = showFullHistory ? sortedHistory : sortedHistory.slice(0, 3);

  const getEventIcon = (eventType: KeyRotationEvent['eventType']) => {
    switch (eventType) {
      case 'created':
        return <Key className="w-4 h-4 text-green-600 dark:text-green-400" />;
      case 'rotated':
        return <RotateCw className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'expired':
        return <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />;
      case 'revoked':
        return <XCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" />;
      case 'scheduled':
        return <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      default:
        return <History className="w-4 h-4 text-gray-600 dark:text-gray-400" />;
    }
  };

  const getEventLabel = (eventType: KeyRotationEvent['eventType']) => {
    switch (eventType) {
      case 'created':
        return 'API Key được tạo';
      case 'rotated':
        return 'Key được rotate';
      case 'expired':
        return 'Key hết hạn';
      case 'revoked':
        return 'Key bị thu hồi';
      case 'scheduled':
        return 'Rotation được lên lịch';
      default:
        return 'Sự kiện không xác định';
    }
  };

  const getTriggeredByLabel = (triggeredBy: KeyRotationEvent['triggeredBy']) => {
    switch (triggeredBy) {
      case 'system':
        return 'Hệ thống';
      case 'manual':
        return 'Thủ công';
      case 'scheduled':
        return 'Tự động';
      default:
        return 'N/A';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          API Key Lifecycle Timeline
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Theo dõi vòng đời của API key cho <span className="font-medium">{partnerName}</span>
        </p>
      </div>

      {/* Current Key Status Card */}
      <div className="p-5 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border border-blue-200 dark:border-blue-900 rounded-xl shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 dark:bg-blue-500 rounded-lg flex items-center justify-center shadow-md">
              <Key className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Current API Key
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-400 font-mono mt-0.5">
                {currentKeyPrefix}...
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-semibold">
            <CheckCircle2 className="w-3 h-3" />
            Active
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Created Date */}
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Ngày tạo</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {format(currentKeyCreatedAt, 'dd/MM/yyyy', { locale: vi })}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
              {formatDistanceToNow(currentKeyCreatedAt, { addSuffix: true, locale: vi })}
            </p>
          </div>

          {/* Key Age */}
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Tuổi của Key</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {daysSinceCreation} ngày
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
              {lastRotatedAt ? 'Đã rotate' : 'Chưa rotate lần nào'}
            </p>
          </div>
        </div>
      </div>

      {/* Next Rotation Info */}
      {autoRotationEnabled && nextRotationDate && (
        <div
          className={cn(
            'p-4 border rounded-lg',
            isRotationOverdue
              ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900'
              : isRotationSoon
              ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900'
              : 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900'
          )}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              {isRotationOverdue ? (
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              ) : isRotationSoon ? (
                <Clock className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              )}
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {isRotationOverdue
                  ? '⚠️ Rotation đã quá hạn'
                  : isRotationSoon
                  ? '⏰ Rotation sắp diễn ra'
                  : '✅ Rotation đã được lên lịch'}
              </h4>
              <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                Next rotation:{' '}
                <span className="font-semibold">
                  {format(nextRotationDate, 'dd/MM/yyyy HH:mm', { locale: vi })}
                </span>
              </p>
              {daysUntilRotation !== null && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {daysUntilRotation > 0
                    ? `Còn ${daysUntilRotation} ngày nữa`
                    : `Đã quá ${Math.abs(daysUntilRotation)} ngày`}
                </p>
              )}
            </div>
            {onManualRotate && (
              <Button
                size="sm"
                onClick={onManualRotate}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <RotateCw className="w-4 h-4 mr-2" />
                Rotate ngay
              </Button>
            )}
          </div>
        </div>
      )}

      {!autoRotationEnabled && (
        <div className="p-4 bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-800 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-gray-400 dark:text-gray-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Auto-rotation chưa được bật
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Bật auto-rotation trong cấu hình policy để tự động thay đổi API key theo lịch trình
              </p>
            </div>
            {onManualRotate && (
              <Button
                size="sm"
                variant="outline"
                onClick={onManualRotate}
                className="shrink-0"
              >
                <RotateCw className="w-4 h-4 mr-2" />
                Rotate thủ công
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Rotation History Timeline */}
      {rotationHistory.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <History className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              Lịch sử Rotation ({rotationHistory.length} events)
            </h4>
            {rotationHistory.length > 3 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowFullHistory(!showFullHistory)}
                className="text-xs"
              >
                {showFullHistory ? (
                  <>
                    <ChevronUp className="w-3 h-3 mr-1" />
                    Thu gọn
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3 mr-1" />
                    Xem tất cả
                  </>
                )}
              </Button>
            )}
          </div>

          <div className="space-y-3 relative">
            {/* Vertical timeline line */}
            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-800" />

            {displayedHistory.map((event, index) => (
              <div key={event.id} className="relative pl-12">
                {/* Timeline node */}
                <div className="absolute left-2.5 top-1.5 w-5 h-5 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-700 rounded-full flex items-center justify-center">
                  {getEventIcon(event.eventType)}
                </div>

                {/* Event card */}
                <div className="p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h5 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {getEventLabel(event.eventType)}
                        </h5>
                        <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded">
                          {getTriggeredByLabel(event.triggeredBy)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {format(event.timestamp, 'dd/MM/yyyy HH:mm', { locale: vi })} •{' '}
                        {formatDistanceToNow(event.timestamp, { addSuffix: true, locale: vi })}
                      </p>
                      {event.reason && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                          Lý do: {event.reason}
                        </p>
                      )}
                      {event.oldKeyPrefix && event.newKeyPrefix && (
                        <div className="flex items-center gap-2 mt-2 text-xs">
                          <span className="font-mono text-gray-500 dark:text-gray-400">
                            {event.oldKeyPrefix}...
                          </span>
                          <span className="text-gray-400 dark:text-gray-600">→</span>
                          <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">
                            {event.newKeyPrefix}...
                          </span>
                        </div>
                      )}
                      {event.gracePeriodEnded && isFuture(event.gracePeriodEnded) && (
                        <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                          Grace period kết thúc: {format(event.gracePeriodEnded, 'dd/MM/yyyy', { locale: vi })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Show more indicator */}
            {!showFullHistory && rotationHistory.length > 3 && (
              <div className="relative pl-12">
                <div className="text-xs text-gray-500 dark:text-gray-400 italic">
                  + {rotationHistory.length - 3} sự kiện khác...
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {rotationHistory.length === 0 && (
        <div className="p-8 text-center bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-800 rounded-lg">
          <History className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Chưa có lịch sử rotation nào
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Các sự kiện rotation sẽ xuất hiện ở đây
          </p>
        </div>
      )}
    </div>
  );
}
