'use client';

import { useCallback, useState } from 'react';
import {
  saveZaloConfig,
  sendBirthdayGreeting,
  triggerBatchReminders,
  triggerZaloReminder,
} from '@/services/crm-actions';
import type { CrmZaloConfig } from '../types';

interface ZaloBatchSuccess {
  count: number;
  skipped?: number;
  messages: string[];
  quotaSkipped?: string[];
  info: string;
}
interface UseCrmPageActionsInput {
  loadData: () => Promise<void>;
  zaloConfig: CrmZaloConfig;
}

export function useCrmPageActions({ loadData, zaloConfig }: UseCrmPageActionsInput) {
  const [scanning, setScanning] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleManualScan = useCallback(async () => {
    setScanning(true);
    try {
      const res = await triggerBatchReminders();
      if ('error' in res && res.error) {
        alert('Lỗi khi quét lịch hẹn: ' + res.error);
      } else {
        const successRes = res as ZaloBatchSuccess;
        const sentDetails = successRes.count > 0
          ? `\n\nDanh sách tin đã gửi:\n${successRes.messages.join('\n')}`
          : '';
        const skippedDetails = successRes.skipped && successRes.quotaSkipped?.length
          ? `\n\nBị bỏ qua do hạn ngạch:\n${successRes.quotaSkipped.join('\n')}`
          : '';
        alert(successRes.info + sentDetails + skippedDetails);
        await loadData();
      }
    } catch (error) {
      console.error(error);
      alert('Không thể hoàn tất quét lịch hẹn.');
    } finally {
      setScanning(false);
    }
  }, [loadData]);

  const handleSendSingleReminder = useCallback(async (sessionId: string) => {
    setActionLoading(sessionId);
    try {
      const res = await triggerZaloReminder(sessionId);
      if (res.error) {
        alert(res.error);
      } else {
        alert('Đã gửi thông báo nhắc lịch qua Zalo OA thành công!\n\nNội dung:\n' + res.message);
        await loadData();
      }
    } catch (error) {
      console.error(error);
      alert('Lỗi khi gửi thông báo nhắc lịch.');
    } finally {
      setActionLoading(null);
    }
  }, [loadData]);

  const handleSendBirthday = useCallback(async (customerId: string, babyName: string) => {
    const voucherCode = 'BELLA_BABY_1ST';
    setActionLoading(customerId);
    try {
      const res = await sendBirthdayGreeting(customerId, voucherCode);
      if (res.error) {
        alert(res.error);
      } else {
        alert(`Đã gửi lời chúc mừng sinh nhật bé ${babyName} và gửi kèm voucher ${voucherCode} thành công!`);
        await loadData();
      }
    } catch (error) {
      console.error(error);
      alert('Lỗi khi gửi tin chúc mừng sinh nhật.');
    } finally {
      setActionLoading(null);
    }
  }, [loadData]);

  const handleSaveConfig = useCallback(async () => {
    setActionLoading('save_zalo_config');
    try {
      const res = await saveZaloConfig(zaloConfig);
      if (res.error) {
        alert(res.error);
      } else {
        alert('Cập nhật cấu hình kết nối Zalo thành công!');
        await loadData();
      }
    } catch (error) {
      console.error(error);
      alert('Lỗi hệ thống khi lưu cấu hình.');
    } finally {
      setActionLoading(null);
    }
  }, [loadData, zaloConfig]);

  return {
    scanning,
    actionLoading,
    handleManualScan,
    handleSendSingleReminder,
    handleSendBirthday,
    handleSaveConfig,
  };
}
