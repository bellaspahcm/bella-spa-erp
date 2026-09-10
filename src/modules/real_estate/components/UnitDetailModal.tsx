'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, Clock, Tag
} from 'lucide-react';
import { Database } from '@/types/database.types';

type ProductRow = Database['public']['Tables']['real_estate_products']['Row'];

interface UnitDetailModalProps {
  product: ProductRow | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateStatus: (
    productId: string,
    targetStatus: ProductRow['status'],
    ownerName?: string | null
  ) => Promise<void>;
  onUpdateDetails?: (
    productId: string,
    payload: {
      unit_price?: number;
      area?: number;
      product_code?: string;
      product_type?: 'apartment' | 'townhouse' | 'shophouse' | 'villa' | 'land_plot' | 'office';
      block?: string | null;
      floor?: string | null;
    }
  ) => Promise<void>;
}

const STATUS_CFG: Record<string, { label: string; badge: string; dot: string }> = {
  available: { label: 'KHẢ DỤNG', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800', dot: 'bg-emerald-500' },
  booked: { label: 'ĐÃ GIỮ CHỖ', badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800', dot: 'bg-amber-500' },
  deposited: { label: 'ĐÃ ĐẶT CỌC', badge: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800', dot: 'bg-orange-500' },
  contracted: { label: 'KÝ HĐMB', badge: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800', dot: 'bg-purple-500' },
  paid: { label: 'ĐÃ BÁN', badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800', dot: 'bg-blue-500' },
  handed_over: { label: 'BÀN GIAO', badge: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700', dot: 'bg-slate-400' },
  cancelled: { label: 'ĐÃ HỦY', badge: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800', dot: 'bg-rose-500' },
};

export const UnitDetailModal: React.FC<UnitDetailModalProps> = ({
  product,
  isOpen,
  onClose,
  onUpdateStatus,
  onUpdateDetails,
}) => {
  const [ownerInput, setOwnerInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Edit Mode State
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editArea, setEditArea] = useState<number>(0);
  const [editCode, setEditCode] = useState<string>('');
  const [editType, setEditType] = useState<string>('');
  const [editBlock, setEditBlock] = useState<string>('');
  const [editFloor, setEditFloor] = useState<string>('');

  useEffect(() => {
    if (product) {
      setOwnerInput('');
      setEditPrice(product.unit_price || 0);
      setEditArea(product.area || 0);
      setEditCode(product.product_code || '');
      setEditType(product.product_type || 'apartment');
      setEditBlock(product.block || '');
      setEditFloor(product.floor || '');
      setIsEditing(false);
      setErrorMsg(null);
    }
  }, [product]);

  if (!isOpen || !product) return null;

  const currentStatus = product.status || 'available';
  const cfg = STATUS_CFG[currentStatus] || STATUS_CFG.available;

  const formatBillion = (price: number, area: number) => {
    if (!price || !area) return '—';
    const total = (price * area) / 1e9;
    return `${total.toFixed(2)} tỷ`;
  };

  const formatPricePerSqm = (price: number) => {
    if (!price) return '—';
    return `${(price / 1e6).toFixed(1)} tr/m²`;
  };

  const handleAction = async (targetStatus: ProductRow['status']) => {
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await onUpdateStatus(product.id, targetStatus, ownerInput || product.owner_name);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Cập nhật thất bại');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDetails = async () => {
    if (!editCode.trim()) {
      setErrorMsg('Mã căn hộ không được bỏ trống');
      return;
    }
    if (editArea <= 0) {
      setErrorMsg('Diện tích phải lớn hơn 0');
      return;
    }
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      if (onUpdateDetails) {
        await onUpdateDetails(product.id, {
          product_code: editCode.trim(),
          product_type: editType.trim() as 'apartment' | 'townhouse' | 'shophouse' | 'villa' | 'land_plot' | 'office',
          block: editBlock.trim() || null,
          floor: editFloor.trim() || null,
          area: editArea,
          unit_price: editPrice,
        });
      }
      setIsEditing(false);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Cập nhật thất bại');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Right Sliding Drawer */}
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-300">
        
        {/* Drawer Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                CHI TIẾT INVENTORY
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${cfg.badge}`}>
                {cfg.label}
              </span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              Căn {product.product_code}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Tòa {product.block || 'A'} · Tầng {product.floor || '—'} · {product.product_type || 'Căn hộ'}
            </p>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
              <span>⚠️</span> {errorMsg}
            </div>
          )}

          {isEditing ? (
            /* Edit Form */
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Mã Căn *</label>
                  <input
                    type="text"
                    value={editCode}
                    onChange={e => setEditCode(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Loại Căn</label>
                  <input
                    type="text"
                    value={editType}
                    onChange={e => setEditType(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Tòa / Block</label>
                  <input
                    type="text"
                    value={editBlock}
                    onChange={e => setEditBlock(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Tầng</label>
                  <input
                    type="text"
                    value={editFloor}
                    onChange={e => setEditFloor(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Diện Tích (m²)</label>
                  <input
                    type="number"
                    step="any"
                    value={editArea || ''}
                    onChange={e => setEditArea(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Đơn Giá / m² (VND)</label>
                  <input
                    type="number"
                    value={editPrice || ''}
                    onChange={e => setEditPrice(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
              <div className="p-4 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-2xl">
                <span className="text-[10px] font-bold text-slate-500">TỔNG GIÁ DỰ KIẾN</span>
                <p className="text-2xl font-black text-amber-700 dark:text-amber-400 mt-0.5">
                  {formatBillion(editPrice, editArea)}
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 rounded-xl transition-all"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveDetails}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 text-xs font-black text-black bg-amber-500 hover:bg-amber-600 rounded-xl transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang lưu...' : 'Lưu Cập Nhật'}
                </button>
              </div>
            </div>
          ) : (
            /* Display Info */
            <>
              {/* Main Financial Metrics Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white shadow-lg relative overflow-hidden">
                <div className="relative z-10">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">GIÁ BÁN NIÊM YẾT</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-black tracking-tight text-amber-400">
                      {formatBillion(product.unit_price, product.area ?? 0)}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold">({formatPricePerSqm(product.unit_price)})</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-700/60 text-xs">
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Diện Tích Thông Thủy</span>
                      <span className="font-extrabold text-white text-sm">{product.area ?? '—'} m²</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Đơn Giá / m²</span>
                      <span className="font-extrabold text-white text-sm">{(product.unit_price / 1e6).toFixed(1)} tr/m²</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Transaction Countdown Box if Status is Hold / Booked */}
              {product.status === 'booked' && (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                      <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
                      THỜI GIAN GIỮ CHỖ CÒN LẠI
                    </div>
                    <span className="font-mono text-sm font-black text-amber-700 dark:text-amber-400">01:43:26</span>
                  </div>
                  <div className="text-xs text-amber-900/80 dark:text-amber-200/80 space-y-1 pt-1 border-t border-amber-200/50">
                    <p><span className="font-semibold">Khách giữ căn:</span> {(product as any).customer_display_name || product.owner_name || 'Nguyễn Văn A'}</p>
                    <p><span className="font-semibold">Sales phụ trách:</span> Trần Minh (PKD 1)</p>
                  </div>
                </div>
              )}

              {/* Additional Property Attributes */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Thông Tin Chi Tiết</h4>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                    <span className="text-[10px] text-slate-400 font-bold block mb-0.5">HƯỚNG BAN CÔNG</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">Đông Nam</span>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                    <span className="text-[10px] text-slate-400 font-bold block mb-0.5">TẦM VIEW</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">Hồ Bơi Nội Khu</span>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                    <span className="text-[10px] text-slate-400 font-bold block mb-0.5">LOẠI PHÒNG</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">2 Phòng Ngủ + 2 WC</span>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                    <span className="text-[10px] text-slate-400 font-bold block mb-0.5">BÀN GIAO</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">Hoàn Thiện Cơ Bản</span>
                  </div>
                </div>
              </div>

              {/* Promotional Policy Card */}
              <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-xl text-xs">
                <div className="flex items-center gap-1.5 font-bold text-blue-800 dark:text-blue-300 mb-1">
                  <Tag className="w-3.5 h-3.5" />
                  CHÍNH SÁCH BÁN HÀNG ÁP DỤNG
                </div>
                <p className="text-blue-900/80 dark:text-blue-200/80">
                  • Chiết khấu thanh toán sớm 3%<br />
                  • Hỗ trợ lãi suất 0% trong 18 tháng
                </p>
              </div>

              {/* Customer / Owner Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Thông Tin Khách Hàng Giao Dịch
                </label>
                <input
                  type="text"
                  placeholder={product.owner_name || 'Nhập tên khách hàng...'}
                  value={ownerInput}
                  onChange={(e) => setOwnerInput(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </>
          )}
        </div>

        {/* Drawer Footer Actions */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-2">
          {!isEditing && onUpdateDetails && (
            <button
              onClick={() => setIsEditing(true)}
              className="w-full py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs rounded-xl transition-all"
            >
              ✏️ Sửa Giá & Thông Tin Căn
            </button>
          )}

          <div className="flex gap-2">
            {currentStatus === 'available' && (
              <>
                <button
                  disabled={isSubmitting}
                  onClick={() => handleAction('booked')}
                  className="flex-1 py-3 text-xs font-black text-black bg-amber-500 hover:bg-amber-600 rounded-xl shadow-md transition-all disabled:opacity-50"
                >
                  🟡 Giữ Căn Ngay
                </button>
                <button
                  disabled={isSubmitting}
                  onClick={() => handleAction('deposited')}
                  className="flex-1 py-3 text-xs font-black text-white bg-orange-600 hover:bg-orange-700 rounded-xl shadow-md transition-all disabled:opacity-50"
                >
                  🟠 Đặt Cọc Căn
                </button>
              </>
            )}

            {currentStatus === 'booked' && (
              <>
                <button
                  disabled={isSubmitting}
                  onClick={() => handleAction('deposited')}
                  className="flex-1 py-3 text-xs font-black text-white bg-orange-600 hover:bg-orange-700 rounded-xl shadow-md transition-all disabled:opacity-50"
                >
                  🟠 Xác Nhận Đặt Cọc
                </button>
                <button
                  disabled={isSubmitting}
                  onClick={() => handleAction('available')}
                  className="px-4 py-3 text-xs font-bold text-slate-700 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 rounded-xl transition-all disabled:opacity-50"
                >
                  Hủy Giữ
                </button>
              </>
            )}

            {currentStatus === 'deposited' && (
              <button
                disabled={isSubmitting}
                onClick={() => handleAction('contracted')}
                className="w-full py-3 text-xs font-black text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-md transition-all disabled:opacity-50"
              >
                🟣 Ký Hợp Đồng Mua Bán (HĐMB)
              </button>
            )}

            {currentStatus === 'contracted' && (
              <button
                disabled={isSubmitting}
                onClick={() => handleAction('paid')}
                className="w-full py-3 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all disabled:opacity-50"
              >
                🔵 Xác Nhận Đã Thanh Toán Đủ (Đã Bán)
              </button>
            )}

            {currentStatus === 'paid' && (
              <button
                disabled={isSubmitting}
                onClick={() => handleAction('handed_over')}
                className="w-full py-3 text-xs font-black text-slate-900 bg-amber-400 hover:bg-amber-500 rounded-xl shadow-md transition-all disabled:opacity-50"
              >
                🏆 Bàn Giao Chìa Khóa Căn Hộ
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
