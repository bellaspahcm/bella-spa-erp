'use client';

import React, { useState } from 'react';
import { ManagedLead, LeadOutcome } from '@/platform/lead-engine';
import { CheckCircle2, PhoneCall, X } from 'lucide-react';

interface LeadActionModalProps {
  lead: ManagedLead | null;
  onClose: () => void;
  onAccept: (leadId: string) => void;
  onSubmitOutcome: (leadId: string, outcome: LeadOutcome, notes: string) => void;
}

export function LeadActionModal({
  lead,
  onClose,
  onAccept,
  onSubmitOutcome,
}: LeadActionModalProps) {
  const [outcome, setOutcome] = useState<LeadOutcome>('CONTACTED');
  const [notes, setNotes] = useState('');

  if (!lead) return null;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitOutcome(lead.id, outcome, notes);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <PhoneCall className="w-5 h-5 text-violet-600" />
            Cập Nhật Chăm Sóc Lead
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl text-xs space-y-1">
          <p className="font-bold text-slate-900 dark:text-white text-sm">{lead.fullName}</p>
          <p className="text-slate-500">SĐT: {lead.phone} • Email: {lead.email || 'Chưa có'}</p>
          <p className="text-slate-500">Dự án: {lead.interestedProject || 'Chưa chọn'}</p>
        </div>

        {lead.state === 'waiting_accept' ? (
          <div className="text-center py-4 space-y-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl text-xs text-amber-800 dark:text-amber-300">
              ⚡ Lead mới được phân bổ cho bạn. Bạn có 30 phút để bấm xác nhận nhận lead!
            </div>
            <button
              onClick={() => {
                onAccept(lead.id);
                onClose();
              }}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2 active:scale-95 text-xs"
            >
              <CheckCircle2 className="w-4 h-4" />
              Xác Nhận Nhận Lead
            </button>
          </div>
        ) : (
          <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Kết Quả Chăm Sóc (Lead Outcome) *
              </label>
              <select
                value={outcome}
                onChange={e => setOutcome(e.target.value as LeadOutcome)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/30 font-medium"
              >
                <option value="CONTACTED">📞 Đã nghe máy & Trao đổi</option>
                <option value="NO_ANSWER">📵 Không nghe máy / Thuê bao (Tự động đếm lần)</option>
                <option value="CALL_BACK">⏰ Khách hẹn gọi lại sau</option>
                <option value="INTERESTED">🌟 Khách quan tâm cao / Xin thêm tài liệu</option>
                <option value="VISIT">🏠 Khách hẹn đến xem nhà mẫu / Spa</option>
                <option value="NEGOTIATING">🤝 Đang thương lượng giá / Điều khoản</option>
                <option value="BOOKING">🎉 BOOKING THÀNH CÔNG / ĐẶT CỌC</option>
                <option value="LOST">❌ Khách từ chối / Đã mua chỗ khác</option>
                <option value="NOT_INTERESTED">🚫 Khách không có nhu cầu</option>
                <option value="WRONG_NUMBER">⚠️ Sai số điện thoại</option>
                <option value="INVALID">🗑️ Lead rác / Không hợp lệ</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Ghi Chú Chi Tiết Cuộc Gọi / Phản Hồi
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Ví dụ: Khách quan tâm căn 2 phòng ngủ tầng 15, hẹn cuối tuần đi xem nhà..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/30 resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold shadow-md transition active:scale-95"
              >
                Lưu Phản Hồi
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
