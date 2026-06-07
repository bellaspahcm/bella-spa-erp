'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import {
  buildVoucherPromotionPayload,
  normalizePromotionDiscountPercent,
} from '@/lib/business-rules/promotion';
import { createPromotion, getPromotions } from '@/services/promotions-actions';
import type { Database } from '@/types/database.types';
import type { NewVoucherCampaign, VoucherCampaign } from '../types';

const DEFAULT_VOUCHER_TARGET = 'Bé tròn 1 tuổi';

const DEFAULT_NEW_VOUCHER: NewVoucherCampaign = {
  code: '',
  discount: 10,
  target: DEFAULT_VOUCHER_TARGET,
  status: 'active',
};

type PromotionRow = Database['public']['Tables']['promotions']['Row'];

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Lỗi không xác định';
}

function promotionToVoucher(promotion: PromotionRow): VoucherCampaign {
  return {
    id: promotion.id,
    code: promotion.discount_code || promotion.title,
    discount: normalizePromotionDiscountPercent(promotion.discount_percent) ?? 0,
    target: promotion.description,
    status: promotion.is_active ? 'active' : 'paused',
    usage: 0,
  };
}

export function useCrmVoucherCampaigns() {
  const [vouchers, setVouchers] = useState<VoucherCampaign[]>([]);
  const [isLoadingVouchers, setIsLoadingVouchers] = useState(true);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [newVoucher, setNewVoucher] = useState<NewVoucherCampaign>(DEFAULT_NEW_VOUCHER);

  const loadVouchers = useCallback(async () => {
    setIsLoadingVouchers(true);
    setVoucherError(null);
    try {
      const promotions = await getPromotions();
      setVouchers((promotions as PromotionRow[]).map(promotionToVoucher));
    } catch (error) {
      console.error('[useCrmVoucherCampaigns] Failed to load promotions:', error);
      setVoucherError(`Không thể tải danh sách voucher: ${getErrorMessage(error)}`);
    } finally {
      setIsLoadingVouchers(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadVouchers();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadVouchers]);

  const openVoucherModal = useCallback(() => {
    setIsVoucherModalOpen(true);
  }, []);

  const closeVoucherModal = useCallback(() => {
    setIsVoucherModalOpen(false);
  }, []);

  const handleCreateVoucher = useCallback(async (event: FormEvent) => {
    event.preventDefault();
    if (!newVoucher.code.trim()) return;

    const promotionPayload = buildVoucherPromotionPayload(newVoucher);
    if (!promotionPayload.success) {
      setVoucherError(`Không thể tạo voucher: ${promotionPayload.error}`);
      return;
    }

    const result = await createPromotion(promotionPayload.payload);
    if (!result.success) {
      setVoucherError(`Không thể tạo voucher: ${result.error || 'Lỗi không xác định'}`);
      return;
    }

    setIsVoucherModalOpen(false);
    setNewVoucher(DEFAULT_NEW_VOUCHER);
    await loadVouchers();
  }, [loadVouchers, newVoucher]);

  return {
    vouchers,
    isLoadingVouchers,
    voucherError,
    isVoucherModalOpen,
    newVoucher,
    setNewVoucher,
    openVoucherModal,
    closeVoucherModal,
    loadVouchers,
    handleCreateVoucher,
  };
}
