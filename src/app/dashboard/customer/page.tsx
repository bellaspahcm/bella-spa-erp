'use client';

import { getCustomerPortalData,submitSessionRating } from '@/services/customer-actions';
import { clsx,type ClassValue } from 'clsx';
import { motion } from 'framer-motion';
import {
Calendar,
CheckCircle2,
Clock,
Flower2,
Star
} from 'lucide-react';
import { useEffect,useState } from 'react';
import { twMerge } from 'tailwind-merge';

type CustomerPortalBooking = NonNullable<Awaited<ReturnType<typeof getCustomerPortalData>>>;
type PortalSession = {
  id: string;
  number: number | null;
  date: string;
  status: string | null;
  ktv: string;
  rating: number | null;
};
type CustomerPortalDashboardData = {
  activeBooking: {
    package_name: string | null;
    completed_sessions: number | null;
    total_sessions: number | null;
    next_session?: string | null;
  };
  sessions: PortalSession[];
  message?: string;
};

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function toCustomerPortalDashboardData(booking: CustomerPortalBooking): CustomerPortalDashboardData {
  const sessions = (booking.session_logs || []).map((session) => ({
    id: session.id,
    number: session.session_number,
    date: session.assigned_date || session.completed_date || '---',
    status: session.status,
    ktv: session.completed_by_ktv?.full_name || '---',
    rating: session.rating,
  }));
  const nextSession = sessions.find((session) => session.status === 'scheduled');

  return {
    activeBooking: {
      package_name: booking.package_name,
      completed_sessions: booking.completed_sessions,
      total_sessions: booking.total_sessions,
      next_session: nextSession?.date || null,
    },
    sessions,
  };
}

export default function CustomerDashboard() {
  const [data, setData] = useState<CustomerPortalDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [ratingModal, setRatingModal] = useState<{ isOpen: boolean; sessionId: string | null }>({
    isOpen: false,
    sessionId: null
  });
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedRating, setSelectedRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      const result = await getCustomerPortalData();
      if (!result) {
        console.error('No booking data found');
      } else if ('error' in result) {
        console.error(result.error);
      } else {
        setData(toCustomerPortalDashboardData(result));
      }
      setLoading(false);
    }
    loadData();
  }, []);

  const handleRatingSubmit = async () => {
    if (!ratingModal.sessionId || selectedRating === 0) return;
    
    setSubmitting(true);
    const result = await submitSessionRating(ratingModal.sessionId, selectedRating, comment);
    setSubmitting(false);

    if (result.success) {
      // Update local state
      setData((prev) => prev ? ({
        ...prev,
        sessions: prev.sessions.map((s) =>
          s.id === ratingModal.sessionId ? { ...s, rating: selectedRating } : s
        )
      }) : prev);
      setRatingModal({ isOpen: false, sessionId: null });
      setSelectedRating(0);
      setComment('');
    } else {
      alert('Lỗi: ' + (result as { error?: string }).error);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!data || data.message) {
    return (
      <div className="p-8 text-center bg-white/50 backdrop-blur-md rounded-2xl border border-pink-100 shadow-xl">
        <p className="text-gray-600 italic">{data?.message || 'Không tìm thấy thông tin liệu trình.'}</p>
      </div>
    );
  }

  const { activeBooking, sessions } = data;
  const completedSessions = activeBooking.completed_sessions || 0;
  const totalSessions = activeBooking.total_sessions || 1;
  const progress = (completedSessions / totalSessions) * 100;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-handwriting text-primary mb-2">Chào mừng bạn quay lại!</h1>
          <p className="text-slate-500 font-medium tracking-tight italic">Theo dõi hành trình chăm sóc sức khỏe của bạn tại Bella Spa</p>
        </div>
        <div className="bg-white/80 backdrop-blur-sm px-6 py-3 rounded-2xl border border-pink-100 shadow-sm">
          <div className="text-sm text-gray-500 uppercase tracking-wider font-semibold">Gói liệu trình</div>
          <div className="text-pink-600 font-bold text-lg">{activeBooking.package_name}</div>
        </div>
      </div>

      {/* Main Progress Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-pink p-8 rounded-[2.5rem] border border-pink-100 shadow-xl relative overflow-hidden group"
      >
        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
          <Flower2 className="w-32 h-32 text-primary" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <span className="bg-primary/10 text-primary px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest">
              Liệu trình hiện tại
            </span>
            <span className="text-slate-400 font-bold text-xs">Bella Spa ERP</span>
          </div>

          <h2 className="text-3xl font-black text-slate-800 mb-8 tracking-tight">{activeBooking.package_name}</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div className="bg-white/60 backdrop-blur-sm p-6 rounded-3xl border border-white/50 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Đã hoàn thành</span>
              </div>
              <p className="text-2xl font-black text-slate-800">{completedSessions} / {totalSessions} <span className="text-sm font-medium text-slate-400 tracking-tight">buổi</span></p>
            </div>

            <div className="bg-white/60 backdrop-blur-sm p-6 rounded-3xl border border-white/50 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="w-5 h-5 text-primary" />
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Buổi tiếp theo</span>
              </div>
              <p className="text-2xl font-black text-slate-800">{activeBooking.next_session?.split(' ')[0] || '---'}</p>
            </div>

            <div className="bg-white/60 backdrop-blur-sm p-6 rounded-3xl border border-white/50 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <Star className="w-5 h-5 text-amber-400" />
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Điểm tích lũy</span>
              </div>
              <p className="text-2xl font-black text-slate-800">120 <span className="text-sm font-medium text-slate-400 tracking-tight">pts</span></p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-end mb-1">
              <span className="text-sm font-black text-primary uppercase tracking-widest">Tiến trình đạt được</span>
              <span className="text-2xl font-black text-primary">{Math.round(progress)}%</span>
            </div>
            <div className="h-4 bg-white/50 rounded-full overflow-hidden border border-white p-0.5 shadow-inner">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-primary via-rose-400 to-primary rounded-full relative"
              >
                <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:24px_24px] animate-[shimmer_2s_linear_infinite]" />
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Session History & Rating */}
      <div className="space-y-6">
        <h3 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
          Nhật ký liệu trình
          <span className="bg-slate-100 text-slate-500 text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-widest">Lịch sử</span>
        </h3>

        <div className="grid gap-4">
          {sessions.map((session, idx: number) => (
            <motion.div 
              key={session.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-6">
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner",
                  session.status === 'completed' ? "bg-emerald-50 text-emerald-500 border border-emerald-100" : "bg-primary/5 text-primary border border-primary/10"
                )}>
                  {session.number}
                </div>
                <div>
                  <h4 className="font-black text-slate-800 text-lg group-hover:text-primary transition-colors">Buổi thứ {session.number}</h4>
                  <div className="flex items-center gap-4 text-sm font-medium text-slate-500">
                    <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {session.date}</span>
                    <span className="w-1 h-1 bg-slate-200 rounded-full" />
                    <span>KTV: <span className="text-slate-800 font-bold">{session.ktv}</span></span>
                  </div>
                </div>
              </div>

              <div>
                {session.status === 'completed' ? (
                  session.rating ? (
                    <div className="flex items-center gap-1.5 bg-amber-50 text-amber-600 px-4 py-2 rounded-xl border border-amber-100">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={cn("w-4 h-4 fill-current", i < (session.rating || 0) ? "text-amber-400" : "text-amber-200")} />
                      ))}
                      <span className="ml-2 font-black text-sm">{session.rating}.0</span>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setRatingModal({ isOpen: true, sessionId: session.id })}
                      className="bg-primary text-white px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-rose-600 transition-all shadow-lg shadow-rose-100 dark:shadow-none flex items-center gap-2"
                    >
                      <Star className="w-4 h-4 fill-current" />
                      Đánh giá ngay
                    </button>
                  )
                ) : (
                  <div className="flex items-center gap-2 text-primary font-black text-sm uppercase tracking-widest px-4 py-2 rounded-xl bg-primary/5">
                    <Clock className="w-4 h-4" />
                    Sắp tới
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Rating Modal */}
      {ratingModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => !submitting && setRatingModal({ isOpen: false, sessionId: null })}
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white w-full max-w-lg rounded-[3rem] p-10 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Star className="w-32 h-32 text-primary" />
            </div>

            <div className="relative z-10 text-center space-y-8">
              <div>
                <h3 className="text-3xl font-handwriting text-primary mb-2">Đánh giá chất lượng</h3>
                <p className="text-slate-500 font-bold tracking-tight">Chị hài lòng với buổi liệu trình vừa rồi chứ?</p>
              </div>

              {/* Star Rating */}
              <div className="flex justify-center gap-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    disabled={submitting}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setSelectedRating(star)}
                    className="transition-transform active:scale-90"
                  >
                    <Star 
                      className={cn(
                        "w-12 h-12 transition-all duration-300",
                        (hoverRating || selectedRating) >= star 
                          ? "fill-amber-400 text-amber-400 scale-110 drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]" 
                          : "text-slate-200"
                      )}
                    />
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                <textarea 
                  placeholder="Để lại lời nhắn cho KTV hoặc Spa (tùy chọn)..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  disabled={submitting}
                  className="w-full bg-slate-50 border-none rounded-3xl p-6 text-slate-700 font-medium focus:ring-2 focus:ring-primary/20 h-32 resize-none transition-all outline-none"
                />
                <div className="flex gap-4">
                  <button 
                    disabled={submitting}
                    onClick={() => setRatingModal({ isOpen: false, sessionId: null })}
                    className="flex-1 px-6 py-4 rounded-2xl font-black text-sm uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all"
                  >
                    Để sau
                  </button>
                  <button 
                    onClick={handleRatingSubmit}
                    disabled={selectedRating === 0 || submitting}
                    className="flex-[2] bg-primary text-white px-6 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-rose-600 transition-all shadow-xl shadow-rose-200 dark:shadow-none disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                  >
                    {submitting ? 'Đang gửi...' : 'Gửi đánh giá'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Shimmer Animation Styles */}
      <style jsx global>{`
        @keyframes shimmer {
          0% { background-position: 0 0; }
          100% { background-position: 24px 24px; }
        }
      `}</style>
    </div>
  );
}
