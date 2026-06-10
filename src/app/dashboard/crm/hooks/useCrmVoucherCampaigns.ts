'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import {
  buildVoucherPromotionPayload,
  normalizePromotionDiscountPercent,
} from '@/lib/business-rules/promotion';
import type { TenantModuleKey } from '@/lib/business-rules/tenant-modules';
import { createPromotion, getPromotions } from '@/services/promotions-actions';
import type { Database } from '@/types/database.types';
import type { NewVoucherCampaign, VoucherCampaign } from '../types';

const BABYCARE_DEFAULT_VOUCHER_TARGET = 'Bé tròn 1 tuổi';
const BEAUTY_DEFAULT_VOUCHER_TARGET = 'Khách chăm sóc da định kỳ';
const NEUTRAL_DEFAULT_VOUCHER_TARGET = 'Khách cần chăm sóc lại';

const MODULE_DEFAULT_TARGETS = new Set([
  BABYCARE_DEFAULT_VOUCHER_TARGET,
  BEAUTY_DEFAULT_VOUCHER_TARGET,
  NEUTRAL_DEFAULT_VOUCHER_TARGET,
]);

function getDefaultVoucherTarget(moduleKey: TenantModuleKey | null | undefined) {
  if (moduleKey === 'babycare') return BABYCARE_DEFAULT_VOUCHER_TARGET;
  if (moduleKey === 'beauty_spa') return BEAUTY_DEFAULT_VOUCHER_TARGET;
  return NEUTRAL_DEFAULT_VOUCHER_TARGET;
}

function createDefaultNewVoucher(moduleKey: TenantModuleKey | null | undefined): NewVoucherCampaign {
  return {
    code: '',
    discount: 10,
    target: getDefaultVoucherTarget(moduleKey),
    status: 'active',
  };
}

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

export function useCrmVoucherCampaigns(tenantModuleKey?: TenantModuleKey | null) {
  const [vouchers, setVouchers] = useState<VoucherCampaign[]>([]);
  const [isLoadingVouchers, setIsLoadingVouchers] = useState(true);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [newVoucher, setNewVoucher] = useState<NewVoucherCampaign>(() => createDefaultNewVoucher(tenantModuleKey));

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

  useEffect(() => {
    setNewVoucher((current) => {
      if (current.code.trim() || !MODULE_DEFAULT_TARGETS.has(current.target)) {
        return current;
      }

      return { ...current, target: getDefaultVoucherTarget(tenantModuleKey) };
    });
  }, [tenantModuleKey]);

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
    setNewVoucher(createDefaultNewVoucher(tenantModuleKey));
    await loadVouchers();
  }, [loadVouchers, newVoucher, tenantModuleKey]);

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
