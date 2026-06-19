import { useState, useCallback } from 'react';
import { toast } from 'sonner';

type OutboxStatus = {
  pending: number;
  retrying: number;
  dead: number;
  total: number;
  last_processed_at: string | null;
  timestamp: string;
};

type ProcessResult = {
  success: boolean;
  processed: number;
  successCount: number;
  failureCount: number;
  deadLetterCount: number;
  timestamp: string;
  triggered_by: string;
};

type ErrorResult = {
  error: string;
  details?: unknown;
};

/**
 * Hook to manage accounting outbox processing
 * 
 * Features:
 * - Get status of pending entries
 * - Manually trigger processing
 * - Show toast notifications
 * 
 * @example
 * ```tsx
 * const { status, isProcessing, processNow, refreshStatus } = useAccountingOutbox();
 * 
 * return (
 *   <div>
 *     <p>Pending: {status?.pending || 0}</p>
 *     <Button onClick={processNow} disabled={isProcessing}>
 *       Process Now
 *     </Button>
 *   </div>
 * );
 * ```
 */
export function useAccountingOutbox() {
  const [status, setStatus] = useState<OutboxStatus | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

  /**
   * Fetch current status of pending entries
   */
  const refreshStatus = useCallback(async () => {
    setIsLoadingStatus(true);
    try {
      const response = await fetch('/api/admin/accounting/process-outbox');
      if (!response.ok) {
        throw new Error('Failed to fetch status');
      }
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Failed to refresh outbox status:', error);
      toast.error('Không thể tải trạng thái', {
        description: error instanceof Error ? error.message : 'Lỗi không xác định',
      });
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  /**
   * Manually trigger accounting outbox processing
   */
  const processNow = useCallback(async () => {
    setIsProcessing(true);
    
    const processingToast = toast.loading('Đang xử lý bút toán kế toán...', {
      description: 'Vui lòng đợi trong giây lát',
    });

    try {
      const response = await fetch('/api/admin/accounting/process-outbox', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result: ProcessResult | ErrorResult = await response.json();

      if (!response.ok) {
        const error = 'error' in result ? result.error : 'Failed to process';
        throw new Error(error);
      }

      // Success notification
      if ('processed' in result && result.processed > 0) {
        toast.success('✅ Xử lý thành công!', {
          id: processingToast,
          description: `Đã xử lý ${result.processed} bút toán (${result.successCount} thành công, ${result.failureCount} lỗi)`,
          duration: 5000,
        });
      } else {
        toast.info('ℹ️ Không có bút toán cần xử lý', {
          id: processingToast,
          description: 'Tất cả bút toán đã được xử lý',
          duration: 3000,
        });
      }

      // Show errors if unknown
      if ('failureCount' in result && result.failureCount > 0) {
        toast.warning('⚠️ Một số bút toán gặp lỗi', {
          description: `${result.failureCount} bút toán không xử lý được (sẽ retry tự động)`,
          duration: 5000,
        });
      }

      // Refresh status after processing
      await refreshStatus();

      return result;
    } catch (error) {
      console.error('Failed to process outbox:', error);
      toast.error('❌ Xử lý thất bại', {
        id: processingToast,
        description: error instanceof Error ? error.message : 'Lỗi không xác định',
        duration: 5000,
      });
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [refreshStatus]);

  return {
    status,
    isProcessing,
    isLoadingStatus,
    processNow,
    refreshStatus,
  };
}
