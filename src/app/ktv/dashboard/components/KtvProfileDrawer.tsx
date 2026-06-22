'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { KeyRound, LogOut, Mail, X } from 'lucide-react';

import { formatCurrency } from '@bella/shared';;

export type KtvProfileUser = {
  id?: string | null;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
  status?: string | null;
} | null;

export type KtvOfflineAction = {
  id: string;
  actionType?: string | null;
  localTimestamp?: string | number | Date | null;
  status?: string | null;
  errorMessage?: string | null;
};

type KtvProfileDrawerProps = {
  isOpen: boolean;
  user: KtvProfileUser;
  earnings: {
    total: number;
    sessions: number;
  };
  myRating: number | null;
  offlineActions: KtvOfflineAction[];
  isOnline: boolean;
  onClose: () => void;
  onOpenPassword: () => void;
  onLogout: () => void | Promise<void>;
  onDiscardAction: (actionId: string) => void | Promise<void>;
  onTriggerSync: () => void | Promise<void>;
};

function getRatingLabel(myRating: number | null) {
  if (myRating === null) {
    return 'Chưa có';
  }
  if (myRating >= 4.5) {
    return 'Xuất sắc';
  }
  if (myRating >= 3.5) {
    return 'Tốt';
  }
  if (myRating >= 2.5) {
    return 'Trung bình';
  }
  return 'Cần cải thiện';
}

function getRatingClass(myRating: number | null) {
  if (myRating === null) {
    return 'bg-slate-100 text-slate-400';
  }
  if (myRating >= 4.5) {
    return 'bg-emerald-50 text-emerald-600';
  }
  if (myRating >= 3.5) {
    return 'bg-blue-50 text-blue-600';
  }
  if (myRating >= 2.5) {
    return 'bg-amber-50 text-amber-600';
  }
  return 'bg-rose-50 text-rose-600';
}

function getActionName(actionType?: string | null) {
  switch (actionType) {
    case 'CHECKIN':
      return 'Bắt đầu ca chăm sóc';
    case 'CHECKOUT':
      return 'Hoàn thành ca chăm sóc';
    case 'KTV_SHIFT_CHECKIN':
      return 'Điểm danh đầu ca';
    case 'KTV_SHIFT_CHECKOUT':
      return 'Điểm danh cuối ca';
    default:
      return 'Thao tác không xác định';
  }
}

function formatActionTime(value?: string | number | Date | null) {
  if (!value) {
    return 'Chưa có thời gian';
  }

  return new Date(value).toLocaleString('vi-VN');
}

export function KtvProfileDrawer({
  isOpen,
  user,
  earnings,
  myRating,
  offlineActions,
  isOnline,
  onClose,
  onOpenPassword,
  onLogout,
  onDiscardAction,
  onTriggerSync,
}: KtvProfileDrawerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[40px] shadow-2xl p-6 z-50 max-h-[85vh] overflow-y-auto border-t border-slate-100 flex flex-col"
          >
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />

            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-widest">Hồ sơ & Thiết lập</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-900 text-white p-6 rounded-[32px] mb-6 relative overflow-hidden shadow-xl shadow-slate-200 shrink-0">
              <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-rose-500/20 rounded-full blur-[40px]" />
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 text-white font-black text-2xl">
                  {user?.full_name?.charAt(0) || 'K'}
                </div>
                <div>
                  <h3 className="font-black text-xl">{user?.full_name || 'Kỹ thuật viên'}</h3>
                  <span className="bg-rose-500 text-white text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest mt-1.5 inline-block">
                    {user?.role === 'ktv' ? 'Kỹ thuật viên' : user?.role || 'Kỹ thuật viên'}
                  </span>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-white/10 space-y-3 text-xs text-white/70">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="truncate">{user?.email || 'Chưa cập nhật email'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                  <span>Trạng thái hoạt động: <strong className="text-emerald-400 capitalize">{user?.status || 'Active'}</strong></span>
                </div>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Thống kê ca làm & KPI tháng này</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Thu nhập ước tính</p>
                  <p className="text-base font-black text-slate-800">{formatCurrency(earnings.total)}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Số ca đã chạy</p>
                  <p className="text-base font-black text-slate-800">{earnings.sessions} ca</p>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Đánh giá trung bình</p>
                  <p className="text-base font-black text-slate-800">
                    {myRating !== null ? `${Number(myRating).toFixed(1)} / 5.0 ⭐` : '— / 5.0'}
                  </p>
                </div>
                <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider ${getRatingClass(myRating)}`}>
                  {getRatingLabel(myRating)}
                </span>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Hàng chờ đồng bộ ngoại tuyến</h4>
                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                  offlineActions.length > 0 ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-500'
                }`}>
                  {offlineActions.length} Bản ghi
                </span>
              </div>

              {offlineActions.length === 0 ? (
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 text-center">
                  <p className="text-slate-400 text-[11px] font-bold italic">Không có thao tác nào đang chờ đồng bộ</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                  {offlineActions.map((action) => (
                    <div key={action.id} className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div className="min-w-0 flex-1 pr-2">
                          <h5 className="text-xs font-black text-slate-800 truncate">{getActionName(action.actionType)}</h5>
                          <span className="text-[9px] text-slate-400 font-bold block mt-0.5">
                            {formatActionTime(action.localTimestamp)}
                          </span>
                        </div>

                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider shrink-0 ${
                          action.status === 'pending' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                          action.status === 'syncing' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                          'bg-rose-50 text-rose-600 border border-rose-100'
                        }`}>
                          {action.status === 'pending' ? 'Chờ đồng bộ' :
                            action.status === 'syncing' ? 'Đang đồng bộ' :
                            'Thất bại'}
                        </span>
                      </div>

                      {action.errorMessage && (
                        <div className="bg-rose-50 border border-rose-100 text-rose-700 p-2.5 rounded-xl text-[10px] font-bold leading-normal break-words">
                          ⚠️ {action.errorMessage}
                        </div>
                      )}

                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => onDiscardAction(action.id)}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 hover:border-rose-200 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                        >
                          <span>🗑️ Hủy bỏ</span>
                        </button>
                        {isOnline && (action.status === 'pending' || action.status === 'failed') && (
                          <button
                            onClick={() => onTriggerSync()}
                            className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-pink-100 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                          >
                            <span>🔄 Đồng bộ</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3 mt-auto">
              <Link
                href="/ktv/guides"
                onClick={onClose}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all active:scale-95 border border-slate-200/80 text-center"
              >
                📖 Sổ tay & Hướng dẫn
              </Link>
              <button
                onClick={onOpenPassword}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-slate-100 dark:shadow-none"
              >
                <KeyRound className="w-4 h-4" />
                Đổi mật khẩu
              </button>
              <button
                onClick={onLogout}
                className="w-full bg-rose-500 hover:bg-rose-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-rose-100 dark:shadow-none"
              >
                <LogOut className="w-4 h-4" />
                Đăng xuất tài khoản
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
