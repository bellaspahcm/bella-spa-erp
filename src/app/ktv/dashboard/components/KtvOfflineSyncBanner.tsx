'use client';

type KtvOfflineSyncBannerProps = {
  isOnline: boolean;
  pendingCount: number;
  onTriggerSync: () => void | Promise<void>;
};

export function KtvOfflineSyncBanner({
  isOnline,
  pendingCount,
  onTriggerSync,
}: KtvOfflineSyncBannerProps) {
  if (isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <div className="px-6 mt-4">
      <div className="bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-pink-500/10 border border-amber-200/50 backdrop-blur-md rounded-[32px] p-5 shadow-sm flex gap-4 items-start relative overflow-hidden animate-pulse">
        <div className="absolute top-[-20%] right-[-10%] w-24 h-24 bg-amber-500/10 rounded-full blur-2xl" />
        <div className="w-10 h-10 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-600 shrink-0 relative z-10">
          <span className="text-lg">⚡</span>
        </div>
        <div className="space-y-1 relative z-10 flex-grow">
          <h4 className="text-xs font-black text-amber-800 uppercase tracking-wider">
            {!isOnline ? 'Đang hoạt động Ngoại tuyến' : 'Đang chờ đồng bộ'}
          </h4>
          <p className="text-[11px] text-amber-700/80 leading-normal font-bold">
            {!isOnline
              ? `Đang lưu tạm ${pendingCount} thao tác (Check-in/Start/Complete ca). Mọi hoạt động của bạn được lưu an toàn cục bộ và sẽ tự đồng bộ khi có mạng lại.`
              : `Có ${pendingCount} thao tác đang chờ đẩy lên hệ thống. Đang tự động kết nối và đồng bộ...`}
          </p>
          {pendingCount > 0 && isOnline && (
            <button
              onClick={() => onTriggerSync()}
              className="mt-2 text-[10px] font-black text-primary uppercase tracking-wider flex items-center gap-1 bg-white/60 hover:bg-white px-3 py-1 rounded-full border border-pink-100 transition-all active:scale-95 cursor-pointer"
            >
              <span>🔄 Đồng bộ ngay lập tức</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
