'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSupabase } from '@/lib/supabase-client';
import { registerNewTenant } from '@/services/onboarding-actions';
import Image from 'next/image';
import { 
  Store, 
  User, 
  Lock, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  Loader2, 
  Mail, 
  Phone, 
  MapPin,
  Sparkles,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Có lỗi xảy ra. Vui lòng thử lại.';
}

export default function SignupPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [spaName, setSpaName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [branchType, setBranchType] = useState<'owned' | 'franchise'>('owned');
  
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const nextStep = () => {
    if (step === 1) {
      if (!spaName || !contactPhone || !address || !email) {
        toast.error('Vui lòng điền đầy đủ thông tin chi nhánh Spa.');
        return;
      }
    } else if (step === 2) {
      if (!adminName || !adminEmail || !adminPassword) {
        toast.error('Vui lòng điền đầy đủ thông tin tài khoản Admin.');
        return;
      }
      if (adminPassword.length < 6) {
        toast.error('Mật khẩu phải chứa ít nhất 6 ký tự.');
        return;
      }
    }
    setError(null);
    setStep(prev => prev + 1);
  };

  const prevStep = () => {
    setError(null);
    setStep(prev => prev - 1);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Call server action to register and setup tenant
      const res = await registerNewTenant({
        spaName,
        contactPhone,
        address,
        email,
        adminName,
        adminEmail,
        adminPassword,
        branchType
      });

      if (!res.success) {
        setError(res.error || 'Đăng ký thất bại. Vui lòng thử lại.');
        setLoading(false);
        return;
      }

      toast.success('Khởi tạo Spa & Seed dữ liệu mẫu thành công!');

      // 2. Automatical Sign In on Client Side
      const supabase = getSupabase();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password: adminPassword
      });

      if (signInError) {
        console.error('Auto login failed:', signInError.message);
        toast.info('Hệ thống đã tạo xong, vui lòng tự đăng nhập bằng tài khoản vừa tạo.');
        window.location.href = '/login';
      } else {
        toast.success('Đang đăng nhập vào hệ thống...');
        if (process.env.NODE_ENV === 'development') {
          document.cookie = 'mock_user_email=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        }
        window.location.href = '/dashboard';
      }
    } catch (err: unknown) {
      console.error('Signup submit error:', err);
      setError(getErrorMessage(err));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-12 relative overflow-hidden bg-background">
      {/* Decorative premium background blobs */}
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-2xl z-10"
      >
        <div className="relative glass-pink shadow-2xl rounded-[3rem] p-8 md:p-12 overflow-hidden border-2 border-white">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary via-secondary to-primary" />

          {/* Header */}
          <div className="flex flex-col items-center mb-8 text-center">
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="mb-4 drop-shadow-xl"
            >
              <Image src="/logo.png" alt="Bella Spa" width={64} height={64} className="h-16 w-auto object-contain" />
            </motion.div>
            <h1 className="text-2xl font-black text-foreground tracking-tight uppercase">
              ĐĂNG KÝ HỆ THỐNG BELLA SPA
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">
              Sở hữu ngay phần mềm quản trị Spa Mẹ & Bé chuyên nghiệp trong 30 giây
            </p>
          </div>

          {/* Stepper Indicators */}
          <div className="flex justify-between items-center max-w-md mx-auto mb-10 relative">
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-pink-100 -translate-y-1/2 z-0" />
            <div 
              className="absolute top-1/2 left-0 h-0.5 bg-primary -translate-y-1/2 z-0 transition-all duration-300"
              style={{ width: `${((step - 1) / 2) * 100}%` }}
            />
            
            {[1, 2, 3].map((s) => (
              <div 
                key={s} 
                className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-xs z-10 border transition-all duration-300 ${
                  step >= s 
                    ? 'bg-primary text-white border-primary shadow-lg shadow-pink-200 dark:shadow-none' 
                    : 'bg-white text-muted-foreground border-pink-100'
                }`}
              >
                {step > s ? <CheckCircle2 size={16} /> : s}
              </div>
            ))}
          </div>

          <form onSubmit={handleSignup}>
            <AnimatePresence>
              {/* STEP 1: SPA BRANDING INFO */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 flex items-center gap-3 text-primary text-xs font-bold uppercase tracking-wider">
                    <Store size={18} />
                    <span>BƯỚC 1: KHỞI TẠO THƯƠNG HIỆU SPA CHI NHÁNH</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Hình thức chi nhánh (Owned vs Franchise) Segmented Selection */}
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">
                        Hình thức chi nhánh *
                      </label>
                      <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-100/80 dark:bg-slate-900/50 rounded-2xl border border-pink-100/10">
                        <button
                          type="button"
                          onClick={() => setBranchType('owned')}
                          className={`py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                            branchType === 'owned'
                              ? 'bg-white dark:bg-slate-800 text-primary shadow-sm border border-pink-100/20'
                              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                          }`}
                        >
                          Chi nhánh trực thuộc (Owned)
                        </button>
                        <button
                          type="button"
                          onClick={() => setBranchType('franchise')}
                          className={`py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                            branchType === 'franchise'
                              ? 'bg-white dark:bg-slate-800 text-primary shadow-sm border border-pink-100/20'
                              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                          }`}
                        >
                          Nhượng quyền (Franchise)
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">
                        Tên Thương hiệu Spa *
                      </label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                          <Store size={18} />
                        </div>
                        <input
                          type="text"
                          required
                          value={spaName}
                          onChange={(e) => setSpaName(e.target.value)}
                          className="block w-full pl-12 pr-4 py-3.5 bg-white/60 border border-border rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none text-foreground placeholder:text-muted-foreground/30 font-medium"
                          placeholder="Ví dụ: Bella Spa Quận 7"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">
                        Hotline Liên hệ *
                      </label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                          <Phone size={18} />
                        </div>
                        <input
                          type="tel"
                          required
                          value={contactPhone}
                          onChange={(e) => setContactPhone(e.target.value)}
                          className="block w-full pl-12 pr-4 py-3.5 bg-white/60 border border-border rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none text-foreground placeholder:text-muted-foreground/30 font-medium"
                          placeholder="Ví dụ: 0987654321"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">
                        Địa chỉ chi nhánh *
                      </label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                          <MapPin size={18} />
                        </div>
                        <input
                          type="text"
                          required
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          className="block w-full pl-12 pr-4 py-3.5 bg-white/60 border border-border rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none text-foreground placeholder:text-muted-foreground/30 font-medium"
                          placeholder="Ví dụ: 456 Nguyễn Thị Thập, Tân Quy, Quận 7, TP.HCM"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">
                        Email đại diện Spa *
                      </label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                          <Mail size={18} />
                        </div>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="block w-full pl-12 pr-4 py-3.5 bg-white/60 border border-border rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none text-foreground placeholder:text-muted-foreground/30 font-medium"
                          placeholder="spa@company.com"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <button
                      type="button"
                      onClick={nextStep}
                      className="bg-primary hover:bg-primary-hover text-white font-black px-8 py-4 rounded-2xl shadow-xl shadow-pink-200 dark:shadow-none transition-all active:scale-95 flex items-center gap-2 text-sm uppercase tracking-widest cursor-pointer"
                    >
                      Tiếp tục
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* STEP 2: ADMIN USER ACCOUNT */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 flex items-center gap-3 text-primary text-xs font-bold uppercase tracking-wider">
                    <User size={18} />
                    <span>BƯỚC 2: TÀI KHOẢN ADMIN QUẢN TRỊ SPA</span>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">
                        Họ và tên Chủ Spa (Admin) *
                      </label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                          <User size={18} />
                        </div>
                        <input
                          type="text"
                          required
                          value={adminName}
                          onChange={(e) => setAdminName(e.target.value)}
                          className="block w-full pl-12 pr-4 py-3.5 bg-white/60 border border-border rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none text-foreground placeholder:text-muted-foreground/30 font-medium"
                          placeholder="Ví dụ: Nguyễn Thanh Vy"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">
                        Email Đăng nhập quản trị *
                      </label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                          <Mail size={18} />
                        </div>
                        <input
                          type="email"
                          required
                          value={adminEmail}
                          onChange={(e) => setAdminEmail(e.target.value)}
                          className="block w-full pl-12 pr-4 py-3.5 bg-white/60 border border-border rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none text-foreground placeholder:text-muted-foreground/30 font-medium"
                          placeholder="admin@company.com"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">
                        Mật khẩu bảo mật *
                      </label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                          <Lock size={18} />
                        </div>
                        <input
                          type="password"
                          required
                          value={adminPassword}
                          onChange={(e) => setAdminPassword(e.target.value)}
                          className="block w-full pl-12 pr-4 py-3.5 bg-white/60 border border-border rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none text-foreground placeholder:text-muted-foreground/30 font-medium"
                          placeholder="•••••••• (Tối thiểu 6 ký tự)"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between pt-4">
                    <button
                      type="button"
                      onClick={prevStep}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-6 py-4 rounded-2xl transition-all active:scale-95 flex items-center gap-2 text-sm uppercase tracking-wider cursor-pointer"
                    >
                      <ArrowLeft size={16} />
                      Quay lại
                    </button>
                    <button
                      type="button"
                      onClick={nextStep}
                      className="bg-primary hover:bg-primary-hover text-white font-black px-8 py-4 rounded-2xl shadow-xl shadow-pink-200 dark:shadow-none transition-all active:scale-95 flex items-center gap-2 text-sm uppercase tracking-widest cursor-pointer"
                    >
                      Tiếp tục
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* STEP 3: ACTIVATION & SEED OVERVIEW */}
              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 flex items-center gap-3 text-primary text-xs font-bold uppercase tracking-wider">
                    <ShieldCheck size={18} />
                    <span>BƯỚC 3: TỔNG HỢP CẤU HÌNH & KÍCH HOẠT HỆ THỐNG</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-5 bg-white/50 border border-slate-100 rounded-3xl space-y-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Chi nhánh Spa</p>
                      <h4 className="font-black text-slate-800 text-base">{spaName}</h4>
                      <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                        <Phone size={12} /> {contactPhone}
                      </p>
                      <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                        <MapPin size={12} /> {address}
                      </p>
                      <div className="pt-2">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                          branchType === 'franchise'
                            ? 'bg-gradient-to-r from-rose-500 to-purple-600 text-white border-transparent shadow-sm'
                            : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-350 dark:border-slate-700'
                        }`}>
                          {branchType === 'franchise' ? 'Nhượng quyền (Franchise)' : 'Chi nhánh trực thuộc'}
                        </span>
                      </div>
                    </div>

                    <div className="p-5 bg-white/50 border border-slate-100 rounded-3xl space-y-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Quản trị viên</p>
                      <h4 className="font-black text-slate-800 text-base">{adminName}</h4>
                      <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                        <Mail size={12} /> {adminEmail}
                      </p>
                      <p className="text-xs text-primary font-bold flex items-center gap-1.5">
                        <ShieldCheck size={12} /> Quyền hạn: Chi nhánh Admin
                      </p>
                    </div>
                  </div>

                  {/* Seeded Data Info Card */}
                  <div className="p-6 bg-gradient-to-br from-indigo-50 to-pink-50 border border-indigo-100/50 rounded-3xl space-y-3">
                    <h5 className="text-xs font-black text-indigo-950 uppercase tracking-wider flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
                      QUÀ TẶNG: SEED DỮ LIỆU MẪU SINH ĐỘNG
                    </h5>
                    <p className="text-slate-600 text-xs font-medium leading-relaxed">
                      Để bạn trải nghiệm hệ thống mượt mà nhất ngay sau khi kích hoạt, Bella Spa Group sẽ tự động cấu hình các mục y khoa mặc định và sinh dữ liệu mẫu đầy màu sắc:
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-[11px] font-bold text-slate-700 pt-1">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                        1 Kỹ thuật viên mẫu (KTV Mai)
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                        1 Gói dịch vụ mẫu (Thông tắc tia sữa)
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                        1 Khách hàng mẫu (Chị Hương)
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                        1 Lịch hẹn điều trị mẫu
                      </div>
                    </div>
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-pink-600 text-sm font-bold bg-pink-50 p-4 rounded-2xl border border-pink-100 flex items-center gap-3"
                    >
                      <div className="w-2 h-2 bg-pink-600 rounded-full animate-pulse" />
                      {error}
                    </motion.div>
                  )}

                  <div className="flex justify-between pt-4">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={prevStep}
                      className="bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold px-6 py-4 rounded-2xl transition-all active:scale-95 flex items-center gap-2 text-sm uppercase tracking-wider cursor-pointer"
                    >
                      <ArrowLeft size={16} />
                      Quay lại
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-gradient-to-r from-primary to-secondary hover:brightness-105 disabled:brightness-95 text-white font-black px-8 py-4 rounded-2xl shadow-xl shadow-pink-200 dark:shadow-none transition-all active:scale-95 flex items-center gap-2.5 text-sm uppercase tracking-widest cursor-pointer"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="animate-spin w-5 h-5" />
                          Đang kích hoạt...
                        </>
                      ) : (
                        <>
                          <Zap size={16} className="fill-current" />
                          Kích hoạt hệ thống ngay
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </div>

        <p className="text-center mt-8 text-muted-foreground/60 text-xs font-bold uppercase tracking-widest">
          &copy; {new Date().getFullYear()} Bella Spa Group
        </p>
      </motion.div>
    </div>
  );
}
