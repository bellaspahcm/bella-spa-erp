'use client';

import { useState, useEffect, use } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  Clock, 
  Star, 
  MapPin, 
  Phone, 
  Heart,
  ChevronRight,
  ShieldCheck,
  Gift,
  MessageSquare,
  Sparkles,
  RefreshCw,
  X
} from 'lucide-react';
import { getCustomerBookingByToken, submitCustomerRating } from '@/services/customer-actions';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';

export default function CustomerPortal({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [booking, setBooking] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const data = await getCustomerBookingByToken(token);
      setBooking(data);
    } catch (error) {
      toast.error('Không tìm thấy thông tin liệu trình');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const handleSubmitRating = async () => {
    if (!selectedSession) return;
    setIsSubmitting(true);
    try {
      await submitCustomerRating(selectedSession.id, rating, comment);
      toast.success('Cảm ơn bạn đã đánh giá!');
      setSelectedSession(null);
      fetchData();
    } catch (error) {
      toast.error('Lỗi khi gửi đánh giá');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-rose-50/30 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-rose-50/30 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg mb-6">
          <X className="w-10 h-10 text-rose-300" />
        </div>
        <h1 className="text-xl font-black text-slate-900 mb-2">Liên kết không hợp lệ</h1>
        <p className="text-slate-500 text-sm">Vui lòng kiểm tra lại đường dẫn hoặc liên hệ Spa để được hỗ trợ.</p>
      </div>
    );
  }

  const completedSessions = booking.session_logs.filter((s: any) => s.status === 'completed').length;
  const progress = (completedSessions / booking.total_sessions) * 100;

  // Tìm buổi trị liệu đã hoàn thành gần nhất chưa được đánh giá
  const pendingReviewSession = booking.session_logs.find((s: any) => s.status === 'completed' && !s.rating);

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans">
      {/* Hero Section */}
      <div className="bg-white px-6 pt-12 pb-10 rounded-b-[50px] shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-rose-100">
               <Heart className="white w-6 h-6 fill-current text-white" />
            </div>
            <div>
               <h1 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Bella Spa Portal</h1>
               <p className="text-xl sm:text-2xl font-black text-primary leading-tight">Chào mừng chị {booking.customers?.name_mother}</p>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-black text-slate-900 leading-tight">
               Liệu trình <br/>
               <span className="text-primary">{booking.package_name || 'Gói dịch vụ'}</span>
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 bg-slate-50 border border-slate-100/50 inline-block px-3 py-1.5 rounded-full">
              Mã dịch vụ: <span className="text-slate-800 font-black">#{booking.id.substring(0, 8).toUpperCase()}</span> • Đăng ký ngày: <span className="text-slate-800 font-black">{booking.created_at ? new Date(booking.created_at).toLocaleDateString('vi-VN') : 'Chưa cập nhật'}</span>
            </p>
          </div>

          {/* Progress Card */}
          <div className="bg-slate-900 rounded-[32px] p-6 text-white shadow-2xl shadow-slate-200">
             <div className="flex justify-between items-end mb-4">
                <div>
                   <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Tiến độ hoàn thành</p>
                   <p className="text-3xl font-black">{completedSessions}<span className="text-lg opacity-40">/{booking.total_sessions}</span></p>
                </div>
                <div className="text-right">
                   <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Điểm Loyalty</p>
                   <div className="flex items-center gap-1.5 text-amber-400">
                      <Gift className="w-4 h-4" />
                      <span className="text-lg font-black">{booking.customers?.loyalty_points || 0}</span>
                   </div>
                </div>
             </div>
             
             <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
                <motion.div 
                   initial={{ width: 0 }}
                   animate={{ width: `${progress}%` }}
                   className="h-full bg-primary"
                />
             </div>
             <p className="text-[10px] font-bold text-white/30 mt-3 uppercase tracking-wider text-center">
                Còn lại {booking.total_sessions - completedSessions} buổi chăm sóc chuyên sâu
             </p>
          </div>
        </div>
      </div>

      <div className="px-6 mt-10 space-y-8">
        {/* Review Request Banner - Highly Prominent Call to Action */}
        {pendingReviewSession && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-br from-amber-50/90 to-rose-50/90 border border-amber-200/60 rounded-[32px] p-6 shadow-md shadow-pink-100/50 flex flex-col md:flex-row items-center justify-between gap-5 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-400/5 rounded-full blur-xl -mr-12 -mt-12 pointer-events-none" />
            
            <div className="flex items-center gap-4 text-left relative z-10">
              <div className="w-12 h-12 bg-amber-400 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-amber-100 flex-shrink-0 animate-bounce">
                <Star className="w-6 h-6 fill-current" />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                  Đánh giá buổi chăm sóc vừa qua
                  <span className="inline-block w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                </h4>
                <p className="text-xs text-slate-600 font-bold mt-1 leading-relaxed">
                  Chị ơi, hãy dành 5s đánh giá chất lượng phục vụ của KTV <span className="text-rose-500 font-black">{pendingReviewSession.completed_by_ktv?.full_name || 'Bella Spa'}</span> ở buổi thứ <span className="text-rose-500 font-black">{pendingReviewSession.session_number}</span> để giúp Spa nâng cao chất lượng và tích điểm Loyalty nhé! 🥰
                </p>
              </div>
            </div>
            <button 
              onClick={() => setSelectedSession(pendingReviewSession)}
              className="w-full md:w-auto bg-amber-500 hover:bg-amber-600 text-white px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap relative z-10"
            >
              <Sparkles className="w-4 h-4 text-white" />
              Đánh giá ngay
            </button>
          </motion.div>
        )}

        {/* Session History */}
        <section>
          <div className="flex items-center justify-between mb-4 px-2">
             <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Nhật ký trị liệu</h3>
             <span className="text-[10px] font-black text-primary uppercase tracking-widest">Chi tiết</span>
          </div>
          
          <div className="space-y-4">
            {booking.session_logs.map((session: any) => (
              <div 
                key={session.id} 
                className={`bg-white p-5 rounded-[32px] border ${session.status === 'completed' ? 'border-emerald-100' : 'border-slate-100'} shadow-sm relative overflow-hidden`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                    session.status === 'completed' ? 'bg-emerald-50 text-emerald-500' : 'bg-slate-50 text-slate-300'
                  }`}>
                    {session.status === 'completed' ? <CheckCircle2 className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                  </div>
                  
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center justify-between gap-2">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Buổi {session.session_number}</p>
                       {session.status === 'completed' && !session.rating && (
                          <button 
                            onClick={() => setSelectedSession(session)}
                            className="bg-amber-400 hover:bg-amber-500 text-white px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-md shadow-amber-100/50 animate-bounce active:scale-95 transition-all"
                          >
                             Đánh giá ngay
                          </button>
                       )}
                       {session.rating && (
                          <div className="flex items-center gap-0.5 text-amber-400">
                             {Array.from({ length: session.rating }).map((_, i) => (
                               <Star key={i} className="w-2.5 h-2.5 fill-current" />
                             ))}
                          </div>
                       )}
                    </div>
                    <h4 className="text-sm font-black text-slate-900 mt-0.5">
                       {session.status === 'completed' ? 'Đã chăm sóc' : 'Chưa diễn ra'}
                    </h4>
                    
                    {session.status === 'completed' ? (
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500 font-bold bg-slate-50 rounded-2xl px-4 py-2 border border-slate-100/50 w-fit">
                        <span>KTV thực hiện:</span>
                        <span className="text-primary font-black">{session.completed_by_ktv?.full_name || 'Bella Spa'}</span>
                        <span className="text-slate-300 font-normal">|</span>
                        <span>Hotline:</span>
                        <a href="tel:0905123456" className="text-rose-500 hover:text-rose-600 font-black transition-colors underline decoration-dotted">0905 123 456</a>
                      </div>
                    ) : (
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500 font-bold bg-slate-50 rounded-2xl px-4 py-2 border border-slate-100/50 w-fit">
                        <span>KTV phụ trách:</span>
                        <span className="text-slate-800 font-black">{booking.assigned_ktv?.full_name || 'Đang sắp xếp KTV'}</span>
                        <span className="text-slate-300 font-normal">|</span>
                        <span>Hotline:</span>
                        <a href="tel:0905123456" className="text-rose-500 hover:text-rose-600 font-black transition-colors underline decoration-dotted">0905 123 456</a>
                      </div>
                    )}
                    
                    <p className="text-[10px] text-slate-400 font-medium mt-2">
                       {session.completed_date ? 'Chăm sóc lúc: ' : 'Thời gian dự kiến: '}
                       <span className="font-bold text-slate-600">
                         {session.completed_date 
                           ? new Date(session.completed_date).toLocaleDateString('vi-VN') 
                           : (session.assigned_date || 'Đang cập nhật')
                         }
                       </span>
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Spa Info */}
        <section className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm text-center">
           <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-primary" />
           </div>
           <h3 className="text-lg font-black text-slate-900 mb-2">Bella Spa & Healthcare</h3>
           <p className="text-slate-500 text-xs mb-6 px-4">Tận tâm chăm sóc mẹ và bé với những liệu trình chuẩn y khoa và tình yêu thương.</p>
           
           <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 text-slate-500 text-xs">
                 <MapPin className="w-4 h-4 text-primary/60" />
                 <span>Khu vực TP. Hồ Chí Minh</span>
              </div>
              <a href="tel:0905123456" className="flex items-center justify-center gap-2 text-slate-500 text-xs hover:text-primary transition-colors">
                 <Phone className="w-4 h-4 text-primary/60" />
                 <span>0905 123 456</span>
              </a>
              <a href="https://www.facebook.com/bellaspahcm" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 text-slate-500 text-xs hover:text-primary transition-colors">
                 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-primary/60"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
                 <span>facebook.com/bellaspahcm</span>
              </a>
           </div>
        </section>
      </div>

      {/* Rating Modal */}
      <AnimatePresence>
        {selectedSession && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedSession(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white w-full max-w-md rounded-t-[40px] sm:rounded-[40px] p-8 relative z-10 shadow-2xl"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                   <Star className="w-8 h-8 fill-current" />
                </div>
                <h3 className="text-xl font-black text-slate-900">Đánh giá buổi {selectedSession.session_number}</h3>
                <p className="text-slate-500 text-sm mt-1">Ý kiến của chị giúp Bella Spa phục vụ tốt hơn</p>
              </div>

              <div className="flex justify-center gap-3 mb-8">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button 
                    key={s} 
                    onClick={() => setRating(s)}
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                      rating >= s ? 'bg-amber-400 text-white shadow-lg shadow-amber-100 scale-110' : 'bg-slate-50 text-slate-300'
                    }`}
                  >
                    <Star className={`w-6 h-6 ${rating >= s ? 'fill-current' : ''}`} />
                  </button>
                ))}
              </div>

              <textarea 
                placeholder="Chị có hài lòng về dịch vụ và KTV không ạ?"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-3xl p-6 text-sm outline-none focus:ring-2 focus:ring-primary/20 min-h-[120px] mb-8"
              />

              <button 
                onClick={handleSubmitRating}
                disabled={isSubmitting}
                className="w-full bg-primary hover:bg-primary-hover text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-rose-100"
              >
                {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Gửi đánh giá
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating CTA */}
      <div className="fixed bottom-6 left-6 right-6 z-50">
         <a 
           href="tel:0905123456"
           className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 shadow-xl border border-white/10 active:scale-95 transition-all"
         >
            <Phone className="w-4 h-4" />
            Liên hệ hỗ trợ ngay
         </a>
      </div>
    </div>
  );
}
