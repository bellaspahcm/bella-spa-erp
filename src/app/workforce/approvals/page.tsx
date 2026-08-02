'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  CheckCircle, XCircle, AlertCircle, Loader2, ChevronLeft, 
  User, Calendar, FileText, CheckCircle2, ShieldAlert
} from 'lucide-react';
import { getPendingApprovals, approveOrRejectRequest, ApprovalRequest } from '@/services/workforce-actions';
import { toast } from 'sonner';
import Link from 'next/link';

export default function ApprovalPanel() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionItem, setActionItem] = useState<ApprovalRequest | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchApprovals = useCallback(async () => {
    try {
      const data = await getPendingApprovals();
      setRequests(data);
    } catch (err) {
      console.error('[ApprovalPanel] Fetch failed:', err);
      toast.error('Lỗi khi tải danh sách phê duyệt');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  const handleApprove = async (item: ApprovalRequest) => {
    setIsSubmitting(true);
    try {
      const res = await approveOrRejectRequest(item.id, item.type, 'approved');
      if (res.success) {
        toast.success('Đã phê duyệt yêu cầu thành công!');
        fetchApprovals();
      } else {
        toast.error(res.error || 'Duyệt yêu cầu thất bại');
      }
    } catch (err) {
      toast.error('Lỗi kết nối khi phê duyệt');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionItem) return;
    if (!rejectReason.trim()) {
      toast.error('Vui lòng nhập lý do từ chối');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await approveOrRejectRequest(actionItem.id, actionItem.type, 'rejected', rejectReason);
      if (res.success) {
        toast.success('Đã từ chối yêu cầu thành công!');
        setShowRejectModal(false);
        setRejectReason('');
        setActionItem(null);
        fetchApprovals();
      } else {
        toast.error(res.error || 'Từ chối yêu cầu thất bại');
      }
    } catch (err) {
      toast.error('Lỗi kết nối khi từ chối');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pb-24 min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* HEADER */}
      <div className="px-6 pt-8 pb-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/workforce/dashboard" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h2 className="text-base font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Duyệt Phê Duyệt</h2>
        </div>
      </div>

      {/* REQUEST LIST */}
      <div className="p-5 space-y-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="mt-2 text-xs text-slate-400 font-bold uppercase tracking-wider animate-pulse">Đang tải danh sách phê duyệt...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-100 dark:border-slate-850">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto opacity-80" />
            <p className="mt-2 text-xs text-slate-450 font-black uppercase tracking-wider">Không có yêu cầu chờ duyệt</p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {requests.map(item => (
              <div 
                key={item.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm space-y-4"
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-650 font-bold text-xs">
                      {item.requester_name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-850 dark:text-slate-150">{item.requester_name}</h4>
                      <span className={`px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-md border ${item.type === 'leave' ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/20' : 'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-950/20'}`}>
                        {item.type === 'leave' ? 'Nghỉ phép' : 'Giữ chỗ BĐS'}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {new Date(item.created_at).toLocaleDateString('vi-VN')}
                  </span>
                </div>

                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-850 p-3.5 rounded-xl border border-slate-100/50 dark:border-slate-800/80">
                  {item.details}
                </p>

                {/* Approve/Reject actions */}
                <div className="flex gap-2.5 pt-1">
                  <button 
                    onClick={() => { setActionItem(item); setShowRejectModal(true); }}
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-black uppercase tracking-wider rounded-xl transition-all disabled:opacity-55"
                  >
                    Từ chối
                  </button>
                  <button 
                    onClick={() => handleApprove(item)}
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-sm disabled:opacity-55"
                  >
                    Phê duyệt
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* REJECT MODAL */}
      {showRejectModal && actionItem && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-end justify-center">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-[36px] p-6 pb-12 space-y-4 animate-[slideUp_0.2s_ease-out]">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-black text-slate-850 dark:text-slate-150 uppercase tracking-wider">Từ chối phê duyệt</h3>
              <button 
                onClick={() => { setShowRejectModal(false); setActionItem(null); }}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Lý do từ chối *</label>
                <textarea
                  required
                  placeholder="Nhập lý do từ chối (thiếu hồ sơ, không khớp tiền cọc...)"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-2xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !rejectReason.trim()}
                className="w-full bg-rose-500 hover:bg-rose-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                {isSubmitting ? 'Đang cập nhật...' : 'Xác nhận từ chối'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
