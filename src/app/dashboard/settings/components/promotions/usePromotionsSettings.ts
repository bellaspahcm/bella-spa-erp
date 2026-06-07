'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { buildPromotionPayload } from '@/lib/business-rules/promotion';
import {
  createPromotion,
  deletePromotion,
  getPromotions,
  togglePromotionActive,
} from '@/services/promotions-actions';
import {
  EMPTY_PROMOTION_FORM,
  type Promotion,
  type PromotionFormState,
} from './types';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function usePromotionsSettings() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [form, setForm] = useState<PromotionFormState>(EMPTY_PROMOTION_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const loadPromotions = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getPromotions();
      setPromotions(data as Promotion[]);
    } catch (error) {
      toast.error(`Không thể tải danh sách khuyến mãi: ${getErrorMessage(error)}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadPromotions();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadPromotions]);

  const updateForm = useCallback((patch: Partial<PromotionFormState>) => {
    setForm((currentForm) => ({ ...currentForm, ...patch }));
  }, []);

  const handleSubmit = useCallback(async (event: FormEvent) => {
    event.preventDefault();

    if (!form.title.trim() || !form.description.trim()) {
      toast.error('Vui lòng nhập đầy đủ tiêu đề và mô tả.');
      return;
    }

    setIsSubmitting(true);
    try {
      const promotionPayload = buildPromotionPayload({
        title: form.title.trim(),
        description: form.description.trim(),
        discount_code: form.discountCode.trim() || null,
        discount_percent: form.discountPercent,
        start_date: form.startDate || null,
        end_date: form.endDate || null,
        is_active: true,
      });

      if (!promotionPayload.success) {
        toast.error(promotionPayload.error);
        return;
      }

      const result = await createPromotion(promotionPayload.payload);

      if (!result.success) {
        toast.error(`Lỗi khi thêm khuyến mãi: ${result.error}`);
        return;
      }

      toast.success('Đã thêm chương trình khuyến mãi thành công.');
      setForm(EMPTY_PROMOTION_FORM);
      await loadPromotions();
    } catch (error) {
      toast.error(`Lỗi không mong muốn: ${getErrorMessage(error)}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [form, loadPromotions]);

  const handleToggleActive = useCallback(async (promotion: Promotion) => {
    const nextStatus = !promotion.is_active;
    setActionId(promotion.id);
    try {
      const result = await togglePromotionActive(promotion.id, nextStatus);
      if (!result.success) {
        toast.error(`Không thể cập nhật trạng thái: ${result.error}`);
        return;
      }

      setPromotions((currentPromotions) =>
        currentPromotions.map((item) =>
          item.id === promotion.id ? { ...item, is_active: nextStatus } : item
        )
      );
      toast.success(nextStatus ? 'Đã kích hoạt chương trình.' : 'Đã tạm ngưng chương trình.');
    } catch (error) {
      toast.error(`Lỗi: ${getErrorMessage(error)}`);
    } finally {
      setActionId(null);
    }
  }, []);

  const handleDelete = useCallback(async (promotion: Promotion) => {
    if (!confirm('Bạn có chắc chắn muốn xóa chương trình khuyến mãi này không?')) return;

    setActionId(promotion.id);
    try {
      const result = await deletePromotion(promotion.id);
      if (!result.success) {
        toast.error(`Lỗi khi xóa khuyến mãi: ${result.error}`);
        return;
      }

      setPromotions((currentPromotions) =>
        currentPromotions.filter((item) => item.id !== promotion.id)
      );
      toast.success('Đã xóa chương trình khuyến mãi thành công.');
    } catch (error) {
      toast.error(`Lỗi: ${getErrorMessage(error)}`);
    } finally {
      setActionId(null);
    }
  }, []);

  return {
    promotions,
    form,
    isLoading,
    isSubmitting,
    actionId,
    updateForm,
    handleSubmit,
    handleToggleActive,
    handleDelete,
  };
}
