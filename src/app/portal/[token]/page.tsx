'use client';

import { useCallback, useEffect, useState, use, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { 
  CheckCircle2, 
  Clock, 
  Star, 
  MapPin, 
  Phone, 
  ShieldCheck,
  Gift,
  Sparkles,
  RefreshCw,
  X,
  Copy,
  QrCode,
  CreditCard,
  AlertCircle
} from 'lucide-react';
import { getCustomerBookingByToken, submitCustomerRating } from '@/services/customer-actions';
import { toast } from 'sonner';
import { formatCurrency } from '@bella/shared';;
import PortalChatWidget from '@/components/features/portal/PortalChatWidget';
import { calculatePortalPaymentSummary } from './payment-utils';
import { TenantBrandLogo } from '@/components/common/TenantBrandLogo';
import { resolveTenantBrandIdentity } from '@/lib/business-rules/tenant-modules';
import type { CustomerPortalBooking } from '@/services/customer-actions';

type CustomerPortalSession = NonNullable<CustomerPortalBooking['session_logs']>[number];

export default function CustomerPortal({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [booking, setBooking] = useState<CustomerPortalBooking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<CustomerPortalSession | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentTab, setPaymentTab] = useState<'deposit' | 'full'>('deposit');

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Đã sao chép vào bộ nhớ tạm');
  };

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getCustomerBookingByToken(token);
      setBooking(data);
    } catch {
      toast.error('Không tìm thấy thông tin liệu trình');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmitRating = async () => {
    if (!selectedSession) return;
    setIsSubmitting(true);
    try {
      await submitCustomerRating(selectedSession.id, rating, comment);
      toast.success('Cảm ơn bạn đã đánh giá!');
      setSelectedSession(null);
      fetchData();
    } catch {
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

  const sessionLogs = booking.session_logs ?? [];
  const totalSessions = booking.total_sessions || sessionLogs.length || 1;
  const completedSessions = sessionLogs.filter((s) => s.status === 'completed').length;
  const progress = (completedSessions / totalSessions) * 100;

  // Tìm buổi chăm sóc đã hoàn thành gần nhất chưa được đánh giá
  const pendingReviewSession = sessionLogs.find((s) => s.status === 'completed' && !s.rating);
  const portalBrand = resolveTenantBrandIdentity({
    enabledModules: booking.tenants?.enabled_modules,
    brandTheme: booking.tenants?.brand_theme,
    logoUrl: booking.tenants?.logo_url,
    tenantName: booking.tenants?.name,
    surface: 'portal',
  });
  const fallbackSupportPhone = portalBrand.isBeautySpa ? '' : '0865701493';
  const supportPhone = booking.tenants?.contact_phone?.trim() || fallbackSupportPhone;
  const supportPhoneNumber = supportPhone.replace(/[^\d+]/g, '');
  const supportPhoneHref = supportPhoneNumber ? `tel:${supportPhoneNumber}` : '#';
  const displaySupportPhone = supportPhone
    ? supportPhone.replace(/^(\d{4})(\d{3})(\d+)$/, '$1 $2 $3')
    : 'Chưa cập nhật';
  const transferMemoPrefix = portalBrand.isBeautySpa
    ? (portalBrand.monogram.replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'SPA')
    : 'BELLA';
  const portalStyle = {
    '--primary': portalBrand.primaryColor,
    '--primary-hover': portalBrand.primaryHoverColor,
    '--accent': portalBrand.accentColor,
    '--ring': portalBrand.primaryColor,
  } as CSSProperties;

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans" style={portalStyle}>
      {/* Hero Section */}
      <div className="bg-white px-6 pt-12 pb-10 rounded-b-[50px] shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32" />
        
        <div className="relative z-10">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <TenantBrandLogo
                displayName={portalBrand.displayName}
                logoUrl={portalBrand.logoUrl}
                monogram={portalBrand.monogram}
                className="h-12 w-12 rounded-2xl text-sm"
              />
              <div>
                 <h1 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{portalBrand.displayName}</h1>
                 <p className="text-xl sm:text-2xl font-black text-primary leading-tight">Chào mừng chị {booking.customers?.name_mother}</p>
              </div>
            </div>

            {/* Refresh Button */}
            <button 
              onClick={() => window.location.reload()}
              className="w-10 h-10 bg-slate-50 hover:bg-slate-100 rounded-xl flex items-center justify-center border border-slate-200 text-slate-500 hover:text-primary transition-all active:scale-95 flex-shrink-0"
              title="Làm mới dữ liệu"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-black text-slate-900 leading-tight">
               Liệu trình <br/>
               <span className="text-primary">{booking.package_name || 'Gói dịch vụ'}</span>
            </h2>
            <div className="mt-2 flex flex-col gap-2">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 border border-slate-100/50 inline-block px-3 py-1.5 rounded-full">
                  Mã dịch vụ: <span className="text-slate-800 font-black">#{booking.id.substring(0, 8).toUpperCase()}</span> • Đăng ký ngày: <span className="text-slate-800 font-black">{booking.created_at ? new Date(booking.created_at).toLocaleDateString('vi-VN') : 'Chưa cập nhật'}</span>
                </p>
              </div>
              <div>
                <a href={supportPhoneHref} className="inline-flex items-center gap-1.5 text-[10px] font-black text-primary uppercase tracking-wider bg-primary/5 border border-primary/10 px-3 py-1.5 rounded-full hover:bg-primary/10 transition-all active:scale-95 shadow-sm shadow-rose-50/50 dark:shadow-none">
                  <Phone className="w-3 h-3 fill-current" />
                  <span>Hotline hỗ trợ: <strong className="font-black">{displaySupportPhone}</strong></span>
                </a>
              </div>
            </div>
          </div>

          {/* Progress Card */}
          <div className="bg-slate-900 rounded-[32px] p-6 text-white shadow-2xl shadow-slate-200">
             <div className="flex justify-between items-end mb-4">
                <div>
                   <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Tiến độ hoàn thành</p>
                   <p className="text-3xl font-black">{completedSessions}<span className="text-lg opacity-40">/{totalSessions}</span></p>
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
                Còn lại {Math.max(totalSessions - completedSessions, 0)} buổi chăm sóc chuyên sâu
             </p>
          </div>
        </div>
      <div className="px-6 mt-10 space-y-8">
        {/* Active Promotions - Subtle & Delicate Exclusive Offer */}
        {booking.active_promotions && booking.active_promotions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-gradient-to-br from-pink-500/10 via-amber-500/5 to-rose-500/10 border border-pink-100 rounded-[32px] p-6 shadow-sm shadow-pink-50 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none" />
            
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary flex-shrink-0 animate-pulse">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="flex-grow space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                    Ưu đãi độc quyền của chị
                    <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping shrink-0" />
                  </h4>
                </div>
                
                <div className="space-y-4">
                  {booking.active_promotions.map((promo) => (
                    <div key={promo.id} className="border-b border-pink-100/40 last:border-0 pb-3 last:pb-0 space-y-1.5">
                      <div className="flex items-baseline justify-between gap-4">
                        <h5 className="text-sm font-black text-primary leading-snug">{promo.title}</h5>
                        {promo.discount_percent && (
                          <span className="bg-primary hover:bg-primary-hover text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                            -{promo.discount_percent}%
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-bold leading-relaxed">{promo.description}</p>
                      
                      {promo.discount_code && (
                        <div className="flex items-center gap-2 mt-2 w-fit">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mã ưu đãi:</span>
                          <div className="flex items-center bg-white border border-pink-100 rounded-xl pl-3 pr-1.5 py-1">
                            <code className="text-xs font-black text-rose-500 tracking-wider font-mono mr-3">{promo.discount_code}</code>
                            <button
                              onClick={() => copyToClipboard(promo.discount_code || '')}
                              className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-primary active:scale-90 transition-all"
                              title="Sao chép mã"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Premium VietQR Dynamic Payment Card */}
        {(() => {
          const paymentSummary = calculatePortalPaymentSummary({
            fullPrice: Number(booking.full_price || 0),
            discountPercent: Number(booking.discount_percent || 0),
            depositAmount: Number(booking.deposit_amount || 0),
            bookingStatus: booking.status,
            revenues: booking.revenue,
            selectedTab: paymentTab,
          });
          const { priceAfterDiscount, remainingDebt, hasOutstandingDebt } = paymentSummary;

          if (!hasOutstandingDebt) {
            return (
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-[32px] p-6 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-100 flex-shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Đã thanh toán hoàn tất</h4>
                  <p className="text-xs text-slate-500 font-bold mt-1">
                    Cảm ơn chị! Liệu trình này đã được thanh toán đầy đủ ({formatCurrency(priceAfterDiscount)}).
                  </p>
                </div>
              </div>
            );
          }

          // Determine bank info
          const bankCode = booking.tenants?.qr_bank_code;
          const accountNumber = booking.tenants?.qr_account_number;
          const accountName = booking.tenants?.qr_account_name;

          if (!bankCode || !accountNumber) {
            return (
              <div className="bg-amber-50 border border-amber-200/60 rounded-[32px] p-6 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-400 text-white rounded-2xl flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Thông báo thanh toán</h4>
                  <p className="text-xs text-slate-600 font-semibold mt-1">
                    Spa chưa thiết lập tài khoản nhận thanh toán QR Code. Chị vui lòng liên hệ hotline <strong className="text-primary">{displaySupportPhone}</strong> để được hỗ trợ chuyển khoản thủ công.
                  </p>
                </div>
              </div>
            );
          }

          // Calculate payment amount based on tab
          const amountToPay = paymentSummary.amountToPay;
          const showDepositTab = paymentSummary.showDepositTab;
          const effectivePaymentTab = paymentSummary.effectiveTab;

          const transferMemo = `${transferMemoPrefix} ${booking.booking_number}`;
          const qrUrl = `https://img.vietqr.io/image/${bankCode}-${accountNumber}-compact.png?amount=${amountToPay}&addInfo=${encodeURIComponent(transferMemo)}&accountName=${encodeURIComponent(accountName || '')}`;

          return (
            <div className="bg-white/80 backdrop-blur-md rounded-[32px] p-6 border border-pink-100/50 shadow-lg shadow-pink-50/40 dark:shadow-none space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Thanh toán VietQR động</h3>
                  <p className="text-[10px] text-slate-400 font-bold">Hệ thống đối soát tự động trong 30 giây</p>
                </div>
              </div>

              {showDepositTab && (
                <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                  <button
                    onClick={() => setPaymentTab('deposit')}
                    className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                      effectivePaymentTab === 'deposit'
                        ? 'bg-white text-primary shadow-md border border-pink-50'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Cọc còn thiếu ({formatCurrency(paymentSummary.depositDue)})
                  </button>
                  <button
                    onClick={() => setPaymentTab('full')}
                    className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                      effectivePaymentTab === 'full'
                        ? 'bg-white text-primary shadow-md border border-pink-50'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Trọn gói ({formatCurrency(remainingDebt)})
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                {/* QR Code */}
                <div className="flex flex-col items-center justify-center bg-slate-50/50 border border-slate-100 p-6 rounded-[2rem] relative">
                  <div className="h-[216px] w-[216px] max-w-full bg-white rounded-3xl p-3 border border-pink-100 flex items-center justify-center shadow-md shadow-pink-50 dark:shadow-none relative overflow-hidden group">
                    <Image
                      src={qrUrl}
                      alt="VietQR Code"
                      fill
                      sizes="216px"
                      className="object-contain"
                      unoptimized
                    />
                    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex items-center justify-center">
                      <QrCode className="w-10 h-10 text-primary/35 animate-pulse" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-1.5 text-[10px] font-black text-rose-500 bg-rose-50 border border-rose-100/50 px-3 py-1.5 rounded-full uppercase tracking-wider animate-pulse">
                    <span className="w-1.5 h-1.5 bg-rose-500 rounded-full" />
                    Đang chờ quét mã...
                  </div>
                </div>

                {/* Transfer Info */}
                <div className="space-y-4">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Số tiền thanh toán</span>
                    <span className="text-2xl font-black text-primary block leading-none">{formatCurrency(amountToPay)}</span>
                  </div>

                  <div className="bg-slate-50 border border-slate-100/50 rounded-2xl p-4 space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Ngân hàng</span>
                        <strong className="text-slate-800 font-extrabold">{bankCode}</strong>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-200/50 px-2 py-1 rounded">Chuyển nhanh 24/7</span>
                    </div>

                    <div className="flex justify-between items-center text-xs border-t border-slate-200/40 pt-2.5">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Số tài khoản</span>
                        <strong className="text-slate-800 font-extrabold tracking-wide">{accountNumber}</strong>
                      </div>
                      <button
                        onClick={() => copyToClipboard(accountNumber || '')}
                        className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-800 active:scale-95 transition-all"
                        title="Sao chép số tài khoản"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex justify-between items-center text-xs border-t border-slate-200/40 pt-2.5">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Chủ tài khoản</span>
                        <strong className="text-slate-800 font-extrabold">{accountName}</strong>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-xs border-t border-slate-200/40 pt-2.5 bg-rose-50/40 p-2 rounded-xl border border-rose-100/30">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block text-rose-500/80">Nội dung chuyển khoản</span>
                        <strong className="text-primary font-black text-sm tracking-wider">{transferMemo}</strong>
                      </div>
                      <button
                        onClick={() => copyToClipboard(transferMemo)}
                        className="p-2 hover:bg-primary/10 rounded-lg text-primary active:scale-95 transition-all"
                        title="Sao chép nội dung chuyển khoản"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-rose-50/30 rounded-2xl border border-rose-100/40 text-[10px] text-slate-500 font-bold leading-relaxed flex gap-2">
                <span className="text-rose-500 font-black text-xs">💡</span>
                <span>
                  <strong>Hướng dẫn:</strong> Quét mã QR trên bằng ứng dụng ngân hàng hoặc chuyển khoản chính xác <strong>Số tài khoản</strong>, <strong>Nội dung</strong> và <strong>Số tiền</strong> ở trên để hệ thống tự động đối soát thanh toán ngay lập tức.
                </span>
              </div>
            </div>
          );
        })()}

        {/* Review Request Banner - Highly Prominent Call to Action */}
        {pendingReviewSession && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-br from-amber-50/90 to-rose-50/90 border border-amber-200/60 rounded-[32px] p-6 shadow-md shadow-pink-100/50 dark:shadow-none flex flex-col md:flex-row items-center justify-between gap-5 relative overflow-hidden"
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
                  Chị ơi, hãy dành 5s đánh giá chất lượng phục vụ của KTV <span className="text-primary font-black">{pendingReviewSession.completed_by_ktv?.full_name || portalBrand.displayName}</span> ở buổi thứ <span className="text-primary font-black">{pendingReviewSession.session_number}</span> để giúp Spa nâng cao chất lượng và tích điểm Loyalty nhé! 🥰
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
             <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Nhật ký chăm sóc</h3>
             <span className="text-[10px] font-black text-primary uppercase tracking-widest">Chi tiết</span>
          </div>
          
          <div className="space-y-4">
            {sessionLogs.map((session) => (
              <div 
                key={session.id} 
                className={`bg-white rounded-[32px] border ${session.status === 'completed' ? 'border-emerald-100' : 'border-slate-100'} shadow-sm relative overflow-hidden`}
              >
                {/* Header: Icon + Session Number + Action */}
                <div className={`px-6 pt-5 pb-4 flex items-center justify-between ${session.status === 'completed' ? 'bg-gradient-to-r from-emerald-50/60 to-white' : 'bg-gradient-to-r from-slate-50/60 to-white'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      session.status === 'completed' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-slate-200 text-slate-400'
                    }`}>
                      {session.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Buổi {session.session_number}</p>
                      <h4 className="text-sm font-black text-slate-900 leading-tight">
                        {session.status === 'completed' ? 'Đã chăm sóc' : 'Chưa diễn ra'}
                      </h4>
                    </div>
                  </div>
                  {session.status === 'completed' && !session.rating && (
                    <button 
                      onClick={() => setSelectedSession(session)}
                      className="bg-amber-400 hover:bg-amber-500 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-md shadow-amber-100/50 animate-bounce active:scale-95 transition-all"
                    >
                      ⭐ Đánh giá
                    </button>
                  )}
                  {session.rating && (
                    <div className="flex items-center gap-0.5 text-amber-400">
                      {Array.from({ length: session.rating }).map((_, i) => (
                        <Star key={i} className="w-3 h-3 fill-current" />
                      ))}
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="px-6 pb-5 space-y-3">
                  {session.status === 'completed' ? (
                    <>
                      {/* KTV Info */}
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-bold">
                        <span>KTV thực hiện:</span>
                        <span className="text-primary font-black">
                          {session.completed_by_ktv?.full_name || portalBrand.displayName}
                          {session.completed_by_ktv?.id !== booking.assigned_ktv?.id && ' (Làm thay)'}
                        </span>
                      </div>
                      
                      {/* Check-in / Check-out — full width */}
                      <div className="grid grid-cols-2 bg-slate-50 border border-slate-100/60 rounded-2xl overflow-hidden">
                        <div className="p-4 text-center">
                          <p className="text-[10px] font-black text-emerald-500 uppercase tracking-wider mb-1">📍 Check-in</p>
                          <p className="text-lg font-black text-slate-800">
                            {session.start_time ? new Date(session.start_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                          </p>
                        </div>
                        <div className="p-4 text-center border-l border-slate-200">
                          <p className="text-[10px] font-black text-rose-400 uppercase tracking-wider mb-1">🏁 Check-out</p>
                          <p className="text-lg font-black text-slate-800">
                            {session.end_time ? new Date(session.end_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                          </p>
                        </div>
                      </div>

                      {/* Date */}
                      <p className="text-[10px] text-slate-400 font-medium text-center">
                        Chăm sóc ngày <span className="font-bold text-slate-600">{session.completed_date ? new Date(session.completed_date).toLocaleDateString('vi-VN') : 'Đang cập nhật'}</span>
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-bold">
                        <span>KTV phụ trách:</span>
                        <span className="text-slate-800 font-black">{booking.assigned_ktv?.full_name || 'Đang sắp xếp KTV'}</span>
                      </div>
                      {session.completed_by_ktv && session.completed_by_ktv.id !== booking.assigned_ktv?.id && (
                        <div className="flex items-center gap-2 text-[11px] text-amber-700 font-bold bg-amber-50/70 rounded-2xl px-4 py-1.5 border border-amber-200/50 animate-pulse">
                          <span>🔄 KTV làm thay:</span>
                          <span className="text-primary font-black">{session.completed_by_ktv.full_name}</span>
                        </div>
                      )}
                      <p className="text-[10px] text-slate-400 font-medium">
                        Thời gian dự kiến: <span className="font-bold text-slate-600">{session.assigned_date || 'Đang cập nhật'}</span>
                      </p>
                    </>
                  )}
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
           <h3 className="text-lg font-black text-slate-900 mb-2">{portalBrand.displayName}</h3>
           <p className="text-slate-500 text-xs mb-6 px-4">Tận tâm chăm sóc khách hàng với những liệu trình chuyên nghiệp và dịch vụ chu đáo.</p>
           
           <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 text-slate-500 text-xs">
                 <MapPin className="w-4 h-4 text-primary/60" />
                 <span>Khu vực TP. Hồ Chí Minh</span>
              </div>
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedSession(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-[32px] p-6 sm:p-8 relative z-10 shadow-2xl max-h-[85vh] overflow-y-auto flex flex-col"
            >
              <div className="text-center mb-5 sm:mb-6">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                   <Star className="w-6 h-6 sm:w-8 sm:h-8 fill-current" />
                </div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900">Đánh giá buổi {selectedSession.session_number}</h3>
                <p className="text-slate-500 text-xs sm:text-sm mt-1">Ý kiến của chị giúp {portalBrand.displayName} phục vụ tốt hơn</p>
              </div>

              <div className="flex justify-center gap-2.5 sm:gap-3 mb-5 sm:mb-6">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button 
                    key={s} 
                    onClick={() => setRating(s)}
                    className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all ${
                      rating >= s ? 'bg-amber-400 text-white shadow-lg shadow-amber-100 scale-105' : 'bg-slate-50 text-slate-300'
                    }`}
                  >
                    <Star className={`w-5 h-5 sm:w-6 sm:h-6 ${rating >= s ? 'fill-current' : ''}`} />
                  </button>
                ))}
              </div>

              <textarea 
                placeholder="Chị có hài lòng về dịch vụ và KTV không ạ?"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-2xl p-4 sm:p-6 text-sm outline-none focus:ring-2 focus:ring-primary/20 min-h-[90px] sm:min-h-[120px] mb-5 sm:mb-6"
              />

              <button 
                onClick={handleSubmitRating}
                disabled={isSubmitting}
                className="w-full bg-primary hover:bg-primary-hover text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-rose-100 dark:shadow-none"
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
           href={supportPhoneHref}
           className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 shadow-xl border border-white/10 active:scale-95 transition-all"
         >
            <Phone className="w-4 h-4" />
            Liên hệ hỗ trợ ngay
         </a>
      </div>

      {/* Floating Chat Widget */}
      <PortalChatWidget 
        token={token} 
        customerId={booking.customer_id}
        customerName={booking.customers?.name_mother}
        brandName={portalBrand.displayName}
        phoneHotline={supportPhoneNumber}
      />
    </div>
  </div>
);
}
