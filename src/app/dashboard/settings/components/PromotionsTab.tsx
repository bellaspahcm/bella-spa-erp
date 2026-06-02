'use client';

import { RefreshCw, Sparkles } from 'lucide-react';
import { PromotionForm } from './promotions/PromotionForm';
import { PromotionList } from './promotions/PromotionList';
import { usePromotionsSettings } from './promotions/usePromotionsSettings';

export default function PromotionsTab() {
  const {
    promotions,
    form,
    isLoading,
    isSubmitting,
    actionId,
    updateForm,
    handleSubmit,
    handleToggleActive,
    handleDelete,
  } = usePromotionsSettings();

  if (isLoading) {
    return (
      <div className="py-20 text-center">
        <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground font-bold">Đang tải danh sách chương trình khuyến mãi...</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex items-center gap-4 mb-2">
        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
          <Sparkles className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Chương trình khuyến mãi</h2>
          <p className="text-sm text-muted-foreground font-semibold">
            Tạo và quản lý các ưu đãi hiển thị trên landing page, portal khách hàng và CRM.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <PromotionForm
          form={form}
          isSubmitting={isSubmitting}
          onChange={updateForm}
          onSubmit={handleSubmit}
        />
        <PromotionList
          promotions={promotions}
          actionId={actionId}
          onToggleActive={handleToggleActive}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
}
