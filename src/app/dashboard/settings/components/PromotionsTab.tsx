"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, Plus, Trash2, Calendar, Tag, Percent, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { getPromotions, createPromotion, togglePromotionActive, deletePromotion } from "@/services/promotions-actions";

export default function PromotionsTab() {
  const [promotions, setPromotions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchPromoData = async () => {
    setIsLoading(true);
    try {
      const data = await getPromotions();
      setPromotions(data);
    } catch (error: any) {
      toast.error("Không thể tải danh sách khuyến mãi: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPromoData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) {
      toast.error("Vui lòng nhập đầy đủ Tiêu đề và Mô tả!");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createPromotion({
        title,
        description,
        discount_code: discountCode || null,
        discount_percent: discountPercent ? Number(discountPercent) : null,
        start_date: startDate || null,
        end_date: endDate || null,
        is_active: true
      });

      if (res.success) {
        toast.success("Đã thêm chương trình khuyến mãi thành công!");
        // Reset form
        setTitle("");
        setDescription("");
        setDiscountCode("");
        setDiscountPercent("");
        setStartDate("");
        setEndDate("");
        // Reload
        fetchPromoData();
      } else {
        toast.error("Lỗi khi thêm: " + res.error);
      }
    } catch (err: any) {
      toast.error("Lỗi không mong muốn: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    try {
      const res = await togglePromotionActive(id, nextStatus);
      if (res.success) {
        setPromotions(promotions.map((p) => (p.id === id ? { ...p, is_active: nextStatus } : p)));
        toast.success(nextStatus ? "Đã kích hoạt chương trình!" : "Đã tạm ngưng chương trình!");
      } else {
        toast.error("Không thể cập nhật trạng thái: " + res.error);
      }
    } catch (err: any) {
      toast.error("Lỗi: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa chương trình khuyến mãi này không?")) return;

    try {
      const res = await deletePromotion(id);
      if (res.success) {
        setPromotions(promotions.filter((p) => p.id !== id));
        toast.success("Đã xóa chương trình khuyến mãi thành công!");
      } else {
        toast.error("Lỗi khi xóa: " + res.error);
      }
    } catch (err: any) {
      toast.error("Lỗi: " + err.message);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 text-center">
        <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground font-bold">
          Đang tải danh sách chương trình khuyến mãi...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex items-center gap-4 mb-2">
        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
          <Sparkles className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            Chương trình Khuyến mãi
          </h2>
          <p className="text-sm text-muted-foreground font-semibold">
            Tạo và quản lý các sự kiện ưu đãi hiển thị trên trang chủ Landing Page & Portal khách hàng
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Form Creation - Left Panel */}
        <div className="xl:col-span-1 glass-white border border-pink-50 p-6 rounded-[2rem] space-y-6 self-start">
          <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" /> Thêm ưu đãi mới
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                Tiêu đề chương trình
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Mừng Ngày Của Mẹ"
                className="w-full px-5 py-3 bg-white/50 border border-pink-100 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                Mô tả chi tiết
              </label>
              <textarea
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả quyền lợi và điều kiện áp dụng..."
                rows={3}
                className="w-full px-5 py-3 bg-white/50 border border-pink-100 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-sm resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block flex items-center gap-1">
                  <Tag className="w-3 h-3 text-slate-400" /> Mã ưu đãi
                </label>
                <input
                  type="text"
                  value={discountCode}
                  onChange={(e) => setDiscountCode(e.target.value.toUpperCase().replace(/\s+/g, ""))}
                  placeholder="MOTHER50"
                  className="w-full px-5 py-3 bg-white/50 border border-pink-100 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-black text-sm font-mono text-rose-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block flex items-center gap-1">
                  <Percent className="w-3 h-3 text-slate-400" /> % Giảm giá
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                  placeholder="10"
                  className="w-full px-5 py-3 bg-white/50 border border-pink-100 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" /> Ngày bắt đầu
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-3 bg-white/50 border border-pink-100 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" /> Ngày kết thúc
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-3 bg-white/50 border border-pink-100 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-primary hover:bg-primary-hover text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-md disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2 mt-4"
            >
              {isSubmitting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              <span>{isSubmitting ? "Đang thêm..." : "Tạo Khuyến Mãi"}</span>
            </button>
          </form>
        </div>

        {/* List of Promotions - Right Panel */}
        <div className="xl:col-span-2 space-y-6">
          <h3 className="text-lg font-black text-slate-800">
            Danh sách chương trình ({promotions.length})
          </h3>

          {promotions.length === 0 ? (
            <div className="bg-slate-50 border border-dashed border-slate-200 rounded-[2rem] p-12 text-center">
              <Sparkles className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400 font-bold text-sm">Chưa cấu hình chương trình khuyến mãi nào.</p>
              <p className="text-xs text-slate-400 mt-1">Sử dụng bảng bên trái để thêm chương trình mới hiển thị ra khách hàng.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {promotions.map((promo) => (
                <div
                  key={promo.id}
                  className={`bg-white border p-6 rounded-[2rem] flex flex-col justify-between shadow-sm relative overflow-hidden transition-all duration-300 hover:shadow-md ${
                    promo.is_active ? "border-pink-100" : "border-slate-100 opacity-75"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <h4 className="font-serif font-black text-slate-800 text-base leading-snug">
                        {promo.title}
                      </h4>
                      {promo.discount_percent && (
                        <span className="bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0">
                          -{promo.discount_percent}%
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 font-bold leading-relaxed">
                      {promo.description}
                    </p>

                    <div className="space-y-1.5 pt-2">
                      {promo.discount_code && (
                        <div className="flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Mã:</span>
                          <span className="text-xs font-black text-rose-500 font-mono tracking-wider bg-rose-50 px-1.5 py-0.5 rounded">
                            {promo.discount_code}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>Thời gian:</span>
                        {promo.start_date || promo.end_date ? (
                          <span className="text-slate-600 font-black">
                            {promo.start_date ? new Date(promo.start_date).toLocaleDateString("vi-VN") : "..."}{" - "}
                            {promo.end_date ? new Date(promo.end_date).toLocaleDateString("vi-VN") : "Vô thời hạn"}
                          </span>
                        ) : (
                          <span className="text-slate-600 font-black">Vô thời hạn</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between gap-4">
                    {/* Toggle Switch */}
                    <button
                      onClick={() => handleToggleActive(promo.id, promo.is_active)}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        promo.is_active
                          ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                    >
                      {promo.is_active ? "Đang chạy" : "Tạm ngưng"}
                    </button>

                    {/* Delete button */}
                    <button
                      onClick={() => handleDelete(promo.id)}
                      className="p-2 bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all active:scale-95"
                      title="Xóa khuyến mãi"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
