'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import {
  Cpu,
  ShieldCheck,
  BarChart3,
  ArrowRight,
  LogIn,
  Menu,
  X,
  Sparkles,
  Workflow,
  Shield,
  Activity,
  Heart,
  CheckCircle2,
  Database,
  Brain,
  ArrowUpRight,
  Percent,
  Coins
} from 'lucide-react';
import { toast } from 'sonner';

const tabVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  exit: { opacity: 0, y: -15, transition: { duration: 0.3 } }
};

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'scheduler' | 'decision' | 'finance'>('scheduler');
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Mouse move handler for spotlight glow tracking
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setMousePosition({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        });
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Hệ thống đã ghi nhận thông tin. Chuyên viên Bella EIP sẽ liên hệ tư vấn trong 15 phút. 🚀');
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
        .tech-font-wrapper {
          font-size: 1.08rem !important;
        }

        /* 8% font size scaling for standard text classes */
        .tech-font-wrapper .text-xs { font-size: calc(0.75rem * 1.08) !important; }
        .tech-font-wrapper .text-sm { font-size: calc(0.875rem * 1.08) !important; }
        .tech-font-wrapper .text-base { font-size: calc(1rem * 1.08) !important; }
        .tech-font-wrapper .text-lg { font-size: calc(1.125rem * 1.08) !important; }
        .tech-font-wrapper .text-xl { font-size: calc(1.25rem * 1.08) !important; }
        .tech-font-wrapper .text-2xl { font-size: calc(1.5rem * 1.08) !important; }
        .tech-font-wrapper .text-3xl { font-size: calc(1.875rem * 1.08) !important; }
        .tech-font-wrapper .text-4xl { font-size: calc(2.25rem * 1.08) !important; }
        .tech-font-wrapper .text-5xl { font-size: calc(3rem * 1.08) !important; }
        .tech-font-wrapper .text-6xl { font-size: calc(3.75rem * 1.08) !important; }
        .tech-font-wrapper .text-\\[62px\\] { font-size: calc(62px * 1.08) !important; }
        .tech-font-wrapper .text-\\[10px\\] { font-size: calc(10px * 1.08) !important; }
        .tech-font-wrapper .text-\\[11px\\] { font-size: calc(11px * 1.08) !important; }
        .tech-font-wrapper .text-\\[17px\\] { font-size: calc(17px * 1.08) !important; }
        .tech-font-wrapper .text-\\[8px\\] { font-size: calc(8px * 1.08) !important; }
        .tech-font-wrapper .text-\\[9px\\] { font-size: calc(9px * 1.08) !important; }

        /* Custom scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #f1f5f9;
        }
        ::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #3b82f6;
        }
      `}} />

      <div
        ref={containerRef}
        className="tech-font-wrapper min-h-screen bg-[#f8fafc] text-slate-800 relative overflow-x-hidden font-sans selection:bg-blue-600 selection:text-white"
      >

        {/* Dynamic Light Blue Interactive Mouse Glow Spotlights */}
        <div
          className="pointer-events-none absolute inset-0 transition duration-300 -z-10 opacity-60"
          style={{
            background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(59, 130, 246, 0.07), transparent 80%)`
          }}
        />

        {/* Soft elegant bright blue background glows */}
        <div className="absolute top-[-10%] left-[-10%] w-[65vw] h-[65vw] rounded-full bg-blue-600/5 blur-[160px] pointer-events-none -z-10" />
        <div className="absolute top-[25%] right-[-10%] w-[55vw] h-[55vw] rounded-full bg-cyan-400/5 blur-[140px] pointer-events-none -z-10" />
        <div className="absolute bottom-[20%] left-[-5%] w-[60vw] h-[60vw] rounded-full bg-indigo-500/5 blur-[150px] pointer-events-none -z-10" />

        {/* Global Bright Grid Pattern Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0070f305_1px,transparent_1px),linear-gradient(to_bottom,#0070f305_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_15%,white_70%,transparent_100%)] pointer-events-none -z-10" />

        {/* ── HEADER & NAVIGATION (Futuristic Glassmorphic Capsule) ── */}
        <header className="fixed top-5 left-1/2 -translate-x-1/2 w-[92%] max-w-7xl z-50 transition-all duration-500">
          <div className={`w-full rounded-full transition-all duration-500 border px-6 py-2 flex items-center justify-between shadow-[0_10px_35px_rgba(59,130,246,0.06)] ${scrolled || mobileMenuOpen
              ? 'bg-white/90 backdrop-blur-2xl border-slate-200/80 shadow-[0_12px_40px_rgba(0,0,0,0.03)]'
              : 'bg-white/40 backdrop-blur-xl border-slate-200/40'
            }`}>
            {/* Logo */}
            <Link href="/" className="flex items-center group">
              <Image
                src="/FullLogo_Transparent_NoBuffer.png?v=2"
                alt="Bella EIP Logo"
                width={150}
                height={42}
                priority
                className="h-9 w-auto object-contain group-hover:scale-105 transition-transform duration-300"
              />
            </Link>

            {/* Desktop Navigation Link items */}
            <nav className="hidden lg:flex items-center gap-8">
              <a href="#core-features" className="text-[10px] font-bold text-slate-500 hover:text-blue-600 transition-colors uppercase tracking-wider">Mô hình lõi</a>
              <a href="#workspace-preview" className="text-[10px] font-bold text-slate-500 hover:text-blue-600 transition-colors uppercase tracking-wider">Hệ thống</a>
              <a href="#solutions-grid" className="text-[10px] font-bold text-slate-500 hover:text-blue-600 transition-colors uppercase tracking-wider">Trụ cột</a>
              <a href="#security-rls" className="text-[10px] font-bold text-slate-500 hover:text-blue-600 transition-colors uppercase tracking-wider">Bảo mật</a>
            </nav>

            {/* Header Action buttons */}
            <div className="hidden lg:flex items-center gap-3">
              <Link
                href="/bellaspa"
                className="px-4.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-950 rounded-full font-bold text-[9px] uppercase tracking-wider transition-all border border-slate-200/80 active:scale-95 flex items-center gap-1.5 shadow-sm"
              >
                <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500/10" />
                Phân hệ Bella Spa
              </Link>
              <Link
                href="/login"
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-full font-black text-[9px] uppercase tracking-wider transition-all active:scale-95 shadow-[0_4px_16px_rgba(37,99,235,0.15)] flex items-center gap-1.5"
              >
                Đăng Nhập
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Mobile menu toggle */}
            <button className="lg:hidden text-slate-500 hover:text-slate-900 p-1 transition-colors" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          {/* Mobile menu panel */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="w-full bg-white/95 backdrop-blur-2xl border border-slate-200 rounded-[2rem] p-6 shadow-2xl mt-3 flex flex-col gap-5 lg:hidden text-left"
              >
                <div className="flex flex-col gap-4 border-b border-slate-100 pb-4">
                  <a href="#core-features" onClick={() => setMobileMenuOpen(false)} className="text-xs font-bold text-slate-600 hover:text-slate-900 py-1 transition-colors uppercase tracking-wider">Mô hình lõi</a>
                  <a href="#workspace-preview" onClick={() => setMobileMenuOpen(false)} className="text-xs font-bold text-slate-600 hover:text-slate-900 py-1 transition-colors uppercase tracking-wider">Hệ thống</a>
                  <a href="#solutions-grid" onClick={() => setMobileMenuOpen(false)} className="text-xs font-bold text-slate-600 hover:text-slate-900 py-1 transition-colors uppercase tracking-wider">Trụ cột</a>
                  <a href="#security-rls" onClick={() => setMobileMenuOpen(false)} className="text-xs font-bold text-slate-600 hover:text-slate-900 py-1 transition-colors uppercase tracking-wider">Bảo mật</a>
                </div>
                <div className="flex flex-col gap-3">
                  <Link
                    href="/bellaspa"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-1.5 w-full py-3 bg-slate-100 border border-slate-200 text-slate-700 rounded-full font-bold text-xs uppercase tracking-wider"
                  >
                    <Heart className="w-4 h-4 text-rose-500 fill-rose-500/10" />
                    Phân hệ Bella Spa
                  </Link>
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-1.5 w-full py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-full font-black text-xs uppercase tracking-wider shadow-md"
                  >
                    <LogIn className="w-4 h-4" />
                    Đăng Nhập
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        {/* ── HERO SECTION (Light-mode Tech Space with Banner.png Backdrop) ── */}
        <section className="relative pt-44 pb-8 flex flex-col justify-between min-h-screen overflow-hidden">

          {/* Background cityscape banner with rocket embedded - hidden on mobile/tablet, cover full screen on desktop */}
          <div className="absolute inset-0 z-0 w-full h-full overflow-hidden pointer-events-none hidden lg:block">
            <Image
              src="/Banner.png"
              alt="Bella EIP Tech Skyline Rocket Backdrop"
              fill
              priority
              sizes="100vw"
              className="object-cover object-right"
            />
            {/* Soft gradient to blend left edge of image seamlessly with the site background */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#f8fafc] via-[#f8fafc]/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-[#f8fafc]" />
          </div>

          {/* Main Grid Row (centered vertically in remaining space) */}
          <div className="flex-1 flex items-center w-full relative z-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

                {/* Left Column Content - Canh lề trái, mở rộng cân đối cột tránh dồn nút */}
                <div className="lg:col-span-7 flex flex-col items-start text-left space-y-8 max-w-2xl">

                  {/* Tech Pill Badge with pulse effect */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6 }}
                    className="inline-flex items-center gap-2.5 px-4.5 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-[10px] font-black uppercase tracking-widest shadow-sm"
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                    SYSTEM PROTOCOL: OPERATIONAL INTEGRITY
                  </motion.div>

                  {/* Giant Title Typography */}
                  <div className="space-y-4 text-left">
                    <motion.h1
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                      className="text-5xl sm:text-7xl lg:text-[86px] font-black tracking-tight leading-[1.03] text-slate-900"
                    >
                      Bella EIP
                    </motion.h1>
                    <motion.p
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                      className="text-lg sm:text-2xl font-bold tracking-wide uppercase bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 bg-clip-text text-transparent"
                    >
                      Hệ Điều Hành Thông Minh Cho Chuỗi Dịch Vụ
                    </motion.p>
                  </div>

                  {/* 3-paragraph descriptive subtext */}
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="text-slate-600 text-sm font-semibold leading-relaxed text-left max-w-xl"
                  >
                    <p>
                      Bella EIP tối ưu hóa tối đa hiệu suất vận hành của các chuỗi dịch vụ đa phân hệ quy mô lớn.
                      Hệ thống tự động hóa hoàn toàn quy trình đặt lịch phân bổ, tính toán hoa hồng kỹ thuật viên tự động,
                      đảm bảo dữ liệu lương thưởng bất biến và trích xuất báo cáo P&L chuẩn xác theo dòng tiền thực thu.
                    </p>
                  </motion.div>

                  {/* Premium CTA Row */}
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                    className="flex flex-wrap items-center gap-4 pt-2"
                  >
                    <Link
                      href="/login"
                      className="px-9 py-4.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-[0_10px_25px_rgba(37,99,235,0.25)] flex items-center gap-2 group"
                    >
                      Khởi chạy hệ thống
                      <ArrowRight className="w-4.5 h-4.5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                    <Link
                      href="/bellaspa"
                      className="px-7 py-4.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 rounded-full font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2 shadow-sm"
                    >
                      Phân hệ Bella Spa
                      <ArrowUpRight className="w-4.5 h-4.5" />
                    </Link>
                  </motion.div>

                  {/* Mobile-only inline responsive banner card */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8, delay: 0.32 }}
                    className="relative w-full h-52 sm:h-72 md:h-96 rounded-3xl overflow-hidden border border-slate-200/80 shadow-md lg:hidden my-6 bg-white"
                  >
                    <Image
                      src="/Banner.png"
                      alt="Bella EIP Tech Skyline Rocket Backdrop"
                      fill
                      priority
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      className="object-cover object-right"
                    />
                    {/* Subtle ambient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/10 via-transparent to-transparent pointer-events-none" />
                  </motion.div>

                </div>

                {/* Right Column Spacer - Chừa chỗ trống cho hình tên lửa hiển thị từ ảnh nền Banner.png */}
                <div className="lg:col-span-5 hidden lg:block" />

              </div>
            </div>
          </div>

          {/* Bottom Stats Bar - Pushed to the very bottom, sitting natively on the highway boundary */}
          <div className="w-full relative z-10 mt-auto pb-4 pt-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.35 }}
                className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full text-left max-w-3xl"
              >
                <div className="bg-white/80 backdrop-blur-md border border-slate-200/80 rounded-2xl p-5 shadow-[0_8px_30px_rgba(59,130,246,0.03)] flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[17px] font-black text-slate-900 block leading-none">99.9%</span>
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 block">Độ chính xác số liệu</span>
                  </div>
                </div>

                <div className="bg-white/80 backdrop-blur-md border border-slate-200/80 rounded-2xl p-5 shadow-[0_8px_30px_rgba(59,130,246,0.03)] flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[17px] font-black text-slate-900 block leading-none">100K+</span>
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 block">Ca làm hoàn tất</span>
                  </div>
                </div>

                <div className="bg-white/80 backdrop-blur-md border border-slate-200/80 rounded-2xl p-5 shadow-[0_8px_30px_rgba(59,130,246,0.03)] flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                    <Percent className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[17px] font-black text-slate-900 block leading-none">0%</span>
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 block">Lỗi tính hoa hồng</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── INTERACTIVE WORKSPACE PREVIEW (Stripe-style Light Console Panel) ── */}
        <section id="workspace-preview" className="py-24 bg-white relative border-t border-slate-100 overflow-hidden">
          {/* Subtle light speed background line */}
          <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/10 to-transparent" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto space-y-4 mb-20">
              <span className="text-xs font-black tracking-widest text-blue-600 uppercase">Trực Quan Hóa Quản Trị</span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Hệ Thống Phân Tích & Điều Phối Thực Tế</h2>
              <p className="text-slate-600 text-sm font-semibold leading-relaxed">
                Tích hợp toàn bộ báo cáo doanh thu thực thu, trích quỹ lương dự phòng KTV và nhật ký RLS trong một màn hình thống nhất.
              </p>
            </div>

            {/* Desktop Mock Workspace App in Light Theme */}
            <div className="relative w-full max-w-5xl mx-auto rounded-[2.5rem] border border-slate-200 bg-white shadow-[0_20px_50px_rgba(59,130,246,0.06)] overflow-hidden">
              {/* Toolbar */}
              <div className="w-full bg-slate-50 px-6 py-4.5 border-b border-slate-200/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-slate-200" />
                  <div className="w-3 h-3 rounded-full bg-slate-200" />
                  <div className="w-3 h-3 rounded-full bg-slate-200" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4 font-mono">Bella EIP Workspace v2.0</span>
                </div>
                <div className="flex items-center gap-2 bg-blue-50 px-3.5 py-1 rounded-full border border-blue-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                  <span className="text-[8px] font-bold text-blue-700 uppercase tracking-wider font-mono">SECURE (RLS ACTIVE)</span>
                </div>
              </div>

              {/* Grid content */}
              <div className="grid grid-cols-1 md:grid-cols-12 min-h-[480px]">
                {/* Sidebar */}
                <div className="md:col-span-3 border-r border-slate-200 p-5 space-y-5 text-left bg-slate-50/50">
                  <div className="space-y-2">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Module Directory</span>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 font-bold text-xs">
                        <span>AI Scheduler</span>
                        <Activity className="w-4 h-4" />
                      </div>
                      <div className="flex items-center justify-between px-3 py-2.5 rounded-lg text-slate-500 hover:bg-slate-100 font-semibold text-xs transition-colors">
                        <span>Decision Matrix</span>
                        <Brain className="w-4 h-4" />
                      </div>
                      <div className="flex items-center justify-between px-3 py-2.5 rounded-lg text-slate-500 hover:bg-slate-100 font-semibold text-xs transition-colors">
                        <span>Financial P&L</span>
                        <BarChart3 className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main panel */}
                <div className="md:col-span-9 p-8 space-y-6 text-left">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                    <div>
                      <h4 className="text-base font-black text-slate-900">Bảng Quản Trị Vận Hành Hệ Thống</h4>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5 block font-mono">Core State • Live Monitor</span>
                    </div>
                    <span className="text-[10px] bg-slate-100 text-slate-600 font-black px-3 py-1 rounded-full border border-slate-200">Operational Integrity</span>
                  </div>

                  {/* Micro dashboard cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 shadow-inner flex flex-col justify-between min-h-[90px]">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider font-mono">Tổng doanh thu thực thu</span>
                      <span className="text-lg font-black text-slate-900 mt-2">428.5 Tr</span>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 shadow-inner flex flex-col justify-between min-h-[90px]">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider font-mono">Quỹ lương KTV dự phòng</span>
                      <span className="text-lg font-black text-slate-900 mt-2">142.8 Tr</span>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 shadow-inner flex flex-col justify-between min-h-[90px]">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider font-mono">Độ Lệch Hệ Thống</span>
                      <span className="text-lg font-black text-blue-600 mt-2">0% Lệch</span>
                    </div>
                  </div>

                  {/* Terminal code logs in dark contrasted style for professional readability */}
                  <div className="p-5 bg-slate-950 rounded-2xl border border-slate-900 font-mono text-[9px] space-y-2 text-slate-300 shadow-inner">
                    <p className="text-slate-500">[INFO] Initializing recalculateAndSaveSalaryRecord Engine...</p>
                    <p className="text-blue-400">[QUERY] Fetching completed service items: status = 'completed' (Approved/Paid only)</p>
                    <p className="text-emerald-400">[SUCCESS] RLS context verified. 0 silent failures detected. Financial integrity locked.</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ── CORE FEATURES Tab Showcase (Interactive Layout) ── */}
        <section id="core-features" className="py-32 bg-[#f8fafc] relative border-t border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

            <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
              <span className="text-xs font-black tracking-widest text-blue-600 uppercase">Mô Hình Vận Hành Lõi</span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Quy Trình Tự Động Hóa Thực Tế</h2>
              <p className="text-slate-600 text-sm font-semibold leading-relaxed">
                Tự động hóa hoàn toàn quy trình xếp lịch, phân bổ ca phục vụ kỹ thuật viên và kế toán đối soát kỳ lương.
              </p>
            </div>

            {/* Interactive Control Tabs */}
            <div className="flex flex-wrap items-center justify-center gap-3 mb-12">
              <button
                onClick={() => setActiveTab('scheduler')}
                className={`flex items-center gap-2 px-6 py-3 rounded-full text-xs font-bold uppercase tracking-wider transition-all border ${activeTab === 'scheduler'
                    ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-600/20'
                    : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
              >
                <Cpu className="w-4 h-4" />
                Điều Phối AI COO
              </button>
              <button
                onClick={() => setActiveTab('decision')}
                className={`flex items-center gap-2 px-6 py-3 rounded-full text-xs font-bold uppercase tracking-wider transition-all border ${activeTab === 'decision'
                    ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-600/20'
                    : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
              >
                <Brain className="w-4 h-4" />
                Động Cơ Tính Lương
              </button>
              <button
                onClick={() => setActiveTab('finance')}
                className={`flex items-center gap-2 px-6 py-3 rounded-full text-xs font-bold uppercase tracking-wider transition-all border ${activeTab === 'finance'
                    ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-600/20'
                    : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
              >
                <BarChart3 className="w-4 h-4" />
                Quản Trị Tài Chính
              </button>
            </div>

            {/* Active tab contents */}
            <div className="bg-white/70 backdrop-blur-2xl border border-slate-200/80 rounded-[3rem] p-8 sm:p-12 shadow-[0_20px_50px_rgba(59,130,246,0.04)] min-h-[380px] flex items-center">
              <AnimatePresence mode="wait">
                {activeTab === 'scheduler' && (
                  <motion.div
                    key="scheduler"
                    variants={tabVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center w-full"
                  >
                    <div className="lg:col-span-7 space-y-6 text-left">
                      <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">AI COO: Điều phối và Sắp xếp thông minh</h3>
                      <p className="text-slate-600 text-sm font-semibold leading-relaxed">
                        Động cơ tự động phân bổ ca làm việc, thời gian phục vụ, và lộ trình di chuyển của kỹ thuật viên tối ưu theo thời gian thực. Giảm thiểu tối qua tình trạng xung đột hoặc trùng lịch hẹn.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700 font-bold">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4.5 h-4.5 text-blue-600 shrink-0" />
                          Phân bổ ca tự động theo tọa độ thực tế
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4.5 h-4.5 text-blue-600 shrink-0" />
                          Tự động cảnh báo quá tải kỹ thuật viên
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4.5 h-4.5 text-blue-600 shrink-0" />
                          Theo dõi trạng thái di chuyển KTV
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4.5 h-4.5 text-blue-600 shrink-0" />
                          Đồng bộ lịch hẹn đa kênh thời gian thực
                        </div>
                      </div>
                    </div>
                    <div className="lg:col-span-5 bg-slate-50/80 rounded-2xl p-6 border border-slate-200 space-y-3 text-left">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block font-mono">Trạng thái kỹ thuật viên</span>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center bg-white p-3.5 rounded-xl border border-slate-150">
                          <span className="text-xs font-bold text-slate-800">KTV Nguyễn Thùy Trang</span>
                          <span className="text-[9px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded font-black border border-emerald-100">Đang phục vụ</span>
                        </div>
                        <div className="flex justify-between items-center bg-white p-3.5 rounded-xl border border-slate-150">
                          <span className="text-xs font-bold text-slate-800">KTV Phạm Minh Ánh</span>
                          <span className="text-[9px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-black border border-blue-100">Đang di chuyển</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'decision' && (
                  <motion.div
                    key="decision"
                    variants={tabVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center w-full"
                  >
                    <div className="lg:col-span-7 space-y-6 text-left">
                      <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Động cơ tính Lương & Hoa hồng chuẩn xác</h3>
                      <p className="text-slate-600 text-sm font-semibold leading-relaxed">
                        Quy tắc tính toán hoa hồng chặt chẽ thừa kế cấu trúc đa cấp bậc. Đảm bảo dữ liệu lương của nhân viên/KTV chính xác 100%, tự động đồng bộ theo thời gian thực từ dữ liệu chấm công chuyên cần và KPI records.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700 font-bold">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4.5 h-4.5 text-blue-600 shrink-0" />
                          Hệ số nhân ca làm dựa trên gói VIP/Hạnh Phúc
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4.5 h-4.5 text-blue-600 shrink-0" />
                          Tính pro-rata lương cơ bản theo ngày công thực tế
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4.5 h-4.5 text-blue-600 shrink-0" />
                          Tự động đồng bộ KPI & phạt chuyên cần từ log
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4.5 h-4.5 text-blue-600 shrink-0" />
                          Khóa kỳ lương bất biến (Month-end close) bảo mật
                        </div>
                      </div>
                    </div>
                    <div className="lg:col-span-5 bg-slate-50/80 rounded-2xl p-6 border border-slate-200 space-y-3.5 text-left font-mono text-xs text-slate-700">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block font-sans">Phiếu tính lương chi tiết</span>
                      <div className="space-y-2">
                        <div className="flex justify-between border-b border-slate-200 pb-1.5">
                          <span>Lương cơ bản (22 ngày):</span>
                          <span>5.800.000đ</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-200 pb-1.5">
                          <span>Hoa hồng ca làm (VIP x2):</span>
                          <span className="text-blue-600">3.450.000đ</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-200 pb-1.5">
                          <span>KPI đồng bộ tự động:</span>
                          <span className="text-emerald-600">+500.000đ</span>
                        </div>
                        <div className="flex justify-between pt-2 text-sm font-black text-slate-900">
                          <span>TỔNG THỰC LĨNH:</span>
                          <span className="text-blue-600 font-black">9.600.000đ</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'finance' && (
                  <motion.div
                    key="finance"
                    variants={tabVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center w-full"
                  >
                    <div className="lg:col-span-7 space-y-6 text-left">
                      <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Tài chính chuỗi & Báo cáo kết quả P&L thực tế</h3>
                      <p className="text-slate-600 text-sm font-semibold leading-relaxed">
                        Phân tích sâu kết quả kinh doanh dòng tiền thực. Chỉ ghi nhận chi phí lương kỹ thuật viên thực tế và doanh thu dịch vụ đã được xác nhận (Status: Completed) để ngăn chặn rủi ro thổi phồng kết quả.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700 font-bold">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4.5 h-4.5 text-blue-600 shrink-0" />
                          Chỉ ghi nhận chi phí đã được kế toán duyệt
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4.5 h-4.5 text-blue-600 shrink-0" />
                          Trích lập dynamic lương KTV dự phòng chính xác
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4.5 h-4.5 text-blue-600 shrink-0" />
                          Theo dõi doanh thu thực thu theo thời gian thực
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4.5 h-4.5 text-blue-600 shrink-0" />
                          Báo cáo P&L đa cấp độ cơ sở/chuỗi
                        </div>
                      </div>
                    </div>
                    <div className="lg:col-span-5 bg-slate-50/80 rounded-2xl p-6 border border-slate-200 space-y-3.5 text-left">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block font-mono">Báo cáo cơ cấu P&L chi nhánh</span>
                      <div className="space-y-3 text-xs text-slate-500">
                        <div>
                          <div className="flex justify-between mb-1">
                            <span>Doanh thu thuần (Thực thu)</span>
                            <span className="text-slate-900 font-black">428.5 Tr</span>
                          </div>
                          <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 w-full" />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between mb-1">
                            <span>Quỹ lương KTV dự phòng</span>
                            <span className="text-slate-900 font-black">142.8 Tr</span>
                          </div>
                          <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-rose-500 w-[33%]" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>
        </section>

        {/* ── SOLUTIONS GRID (Luxury Bright Columns) ── */}
        <section id="solutions-grid" className="py-32 bg-white relative border-t border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

            <div className="text-center max-w-3xl mx-auto space-y-4 mb-20">
              <span className="text-xs font-black tracking-widest text-blue-600 uppercase">Trụ Cột Hệ Thống</span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">4 Giải Pháp Quản Trị Hoàn Hảo</h2>
              <p className="text-slate-600 text-sm font-semibold leading-relaxed">
                Từng mô-đun được xây dựng tuân thủ nghiêm ngặt các quy tắc an toàn dữ liệu và tối ưu hiệu suất dòng tiền.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

              {/* Feature Card 1 */}
              <div className="bg-[#f8fafc]/60 backdrop-blur-xl border border-slate-200 p-6 rounded-3xl flex flex-col justify-between min-h-[240px] text-left hover:border-blue-300 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 mb-2">Động Cơ Điều Phối AI COO</h4>
                  <p className="text-slate-500 text-[10px] font-semibold leading-relaxed">Tự động phân bổ ca làm việc của KTV tối ưu địa lý và công suất phục vụ thực tế của các cơ sở.</p>
                </div>
              </div>

              {/* Feature Card 2 */}
              <div className="bg-[#f8fafc]/60 backdrop-blur-xl border border-slate-200 p-6 rounded-3xl flex flex-col justify-between min-h-[240px] text-left hover:border-blue-300 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                  <Workflow className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 mb-2">Quy Trình Tự Động Hóa</h4>
                  <p className="text-slate-500 text-[10px] font-semibold leading-relaxed">Xây dựng và kiểm soát chuỗi công việc tự động từ lúc tiếp nhận đến khi xuất hóa đơn và trích hoa hồng.</p>
                </div>
              </div>

              {/* Feature Card 3 */}
              <div className="bg-[#f8fafc]/60 backdrop-blur-xl border border-slate-200 p-6 rounded-3xl flex flex-col justify-between min-h-[240px] text-left hover:border-blue-300 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                  <Brain className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 mb-2">Động Cơ Quyết Định Lương</h4>
                  <p className="text-slate-500 text-[10px] font-semibold leading-relaxed">Tự động áp dụng hoa hồng theo phân hạng ca dịch vụ, đảm bảo chuẩn xác không nuốt lỗi dữ liệu.</p>
                </div>
              </div>

              {/* Feature Card 4 */}
              <div className="bg-[#f8fafc]/60 backdrop-blur-xl border border-slate-200 p-6 rounded-3xl flex flex-col justify-between min-h-[240px] text-left hover:border-blue-300 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 mb-2">Báo Cáo P&L Thông Minh</h4>
                  <p className="text-slate-500 text-[10px] font-semibold leading-relaxed">Phân tích sâu cơ cấu chi phí, dòng tiền thực thu và doanh thu thực tế của chuỗi cửa hàng dịch vụ.</p>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ── SECURITY GOVERNANCE (RLS & Safety) ── */}
        <section id="security-rls" className="py-32 bg-[#f8fafc] relative overflow-hidden border-t border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="bg-white border border-slate-200/80 rounded-[3rem] p-8 sm:p-14 shadow-[0_20px_50px_rgba(59,130,246,0.03)] flex flex-col lg:flex-row items-center gap-12">
              <div className="lg:w-1/2 space-y-6 text-left">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-[10px] font-bold uppercase tracking-wider">
                  <Shield className="w-3.5 h-3.5" />
                  Bảo Mật Cơ Sở Dữ Liệu Enterprise
                </div>
                <h3 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">Tuyệt Đối An Toàn Thông Tin Doanh Nghiệp</h3>
                <p className="text-slate-600 text-sm font-semibold leading-relaxed">
                  Từng dữ liệu tài chính nhạy cảm được cách ly độc lập giữa các chi nhánh hoặc chuỗi bằng Row Level Security (RLS) ở mức cơ sở dữ liệu. Ngăn chặn triệt để mọi hành vi sửa đổi dữ liệu kỳ lương lịch sử một khi đã được chốt (finalized).
                </p>
                <div className="space-y-4 text-xs font-bold text-slate-700">
                  <div className="flex gap-3 items-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    <span>Không có lỗi nuốt ngoại lệ cơ sở dữ liệu (Zero silent DB failures).</span>
                  </div>
                  <div className="flex gap-3 items-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    <span>Bất biến dữ liệu tài chính lương đã khóa kỳ (Month-end close).</span>
                  </div>
                  <div className="flex gap-3 items-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    <span>Nhật ký log kiểm toán bất biến (Audit Trail) ghi lại mọi thay đổi nhạy cảm.</span>
                  </div>
                </div>
              </div>

              <div className="lg:w-1/2 w-full grid grid-cols-2 gap-4">
                <div className="p-6 bg-slate-50/50 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between aspect-square text-left hover:border-blue-200 transition-colors">
                  <div className="w-10 h-10 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-4 shadow-sm">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h6 className="text-sm font-black text-slate-900">Supabase RLS</h6>
                    <p className="text-[10px] text-slate-500 font-semibold mt-1 leading-normal">Cách ly dữ liệu tuyệt đối giữa các tenant ở cấp độ cơ sở dữ liệu.</p>
                  </div>
                </div>
                <div className="p-6 bg-slate-50/50 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between aspect-square text-left hover:border-blue-200 transition-colors">
                  <div className="w-10 h-10 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-4 shadow-sm">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h6 className="text-sm font-black text-slate-900">Bất Biến Dữ Liệu</h6>
                    <p className="text-[10px] text-slate-500 font-semibold mt-1 leading-normal">Khóa chặt dữ liệu kỳ lương lịch sử ngăn thay đổi ngoài ý muốn.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── CONSULTATION REGISTRATION FORM ── */}
        <section className="py-24 bg-white relative overflow-hidden border-t border-slate-100">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-8">
            <div className="space-y-4">
              <span className="text-xs font-black tracking-widest text-blue-600 uppercase block">Đăng ký trải nghiệm</span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Khởi Đầu Quản Trị Vận Hành Hiện Đại</h2>
              <p className="text-slate-600 text-sm font-semibold leading-relaxed max-w-2xl mx-auto">
                Nhập thông tin bên dưới để được đội ngũ chuyên viên liên hệ tư vấn giải pháp quản lý tối ưu phù hợp nhất với mô hình của bạn.
              </p>
            </div>

            <div className="bg-[#f8fafc] border border-slate-200/80 p-6 sm:p-10 rounded-[2.5rem] shadow-[0_20px_50px_rgba(59,130,246,0.03)] text-left max-w-xl mx-auto">
              <form onSubmit={handleContactSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Họ và tên của bạn</label>
                  <input
                    type="text"
                    required
                    className="block w-full px-4 py-3.5 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-semibold text-slate-900 text-xs"
                    placeholder="VD: Nguyễn Văn A"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Số điện thoại liên hệ</label>
                    <input
                      type="tel"
                      required
                      className="block w-full px-4 py-3.5 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-semibold text-slate-900 text-xs"
                      placeholder="09xxxxxxxx"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phân hệ doanh nghiệp</label>
                    <select
                      required
                      className="block w-full px-4 py-3.5 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-semibold text-slate-900 text-xs"
                    >
                      <option value="spa">Spa & Beauty Clinic</option>
                      <option value="fitness">Fitness & Gym Center</option>
                      <option value="homecare">Chăm sóc sức khỏe gia đình (Mẹ & Bé)</option>
                      <option value="academy">Học viện & Đào tạo nghề</option>
                      <option value="other">Dịch vụ chuỗi/Khác</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black py-4 rounded-xl shadow-md hover:shadow-lg active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2 mt-2"
                >
                  Gửi thông tin liên hệ
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="bg-slate-900 text-slate-300 pt-20 pb-10 border-t border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 pb-16 border-b border-slate-800">

              {/* Brand block */}
              <div className="space-y-6 text-left">
                <div className="flex items-center gap-3">
                  <Image
                    src="/FullLogo_Transparent_NoBuffer.png?v=2"
                    alt="Bella EIP Logo"
                    width={130}
                    height={36}
                    className="h-8.5 w-auto object-contain brightness-0 invert"
                  />
                </div>
                <p className="text-xs font-semibold leading-relaxed text-slate-400">
                  Giải pháp quản trị vận hành chuỗi dịch vụ thế hệ mới, tích hợp động cơ tính toán và bảo mật tài chính tối ưu.
                </p>
              </div>

              {/* Column 2 */}
              <div className="space-y-4 text-left">
                <h5 className="text-xs font-black text-white uppercase tracking-widest">Phân hệ EIP</h5>
                <ul className="space-y-2.5 text-xs font-semibold text-slate-400">
                  <li><Link href="/bellaspa" className="hover:text-white transition-colors">Bella Spa Mẹ & Bé</Link></li>
                  <li><a href="#" className="hover:text-white transition-colors">Bella Clinic & Y khoa</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Bella Fitness & Gym</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Học viện Đào tạo</a></li>
                </ul>
              </div>

              {/* Column 3 */}
              <div className="space-y-4 text-left">
                <h5 className="text-xs font-black text-white uppercase tracking-widest">Hệ thống</h5>
                <ul className="space-y-2.5 text-xs font-semibold text-slate-400">
                  <li><a href="#" className="hover:text-white transition-colors">Tài liệu API</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Bảo mật RLS</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Chính sách Bảo mật</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Điều khoản dịch vụ</a></li>
                </ul>
              </div>

              {/* Column 4 */}
              <div className="space-y-4 text-left">
                <h5 className="text-xs font-black text-white uppercase tracking-widest">Bản quyền</h5>
                <p className="text-xs font-semibold leading-relaxed text-slate-400">
                  © 2026 Bella EIP. Bảo lưu mọi quyền. Động cơ lõi được vận hành bảo mật trên nền tảng Supabase RLS.
                </p>
              </div>

            </div>

            <div className="pt-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold text-slate-400">
              <span>Thiết kế theo chuẩn SaaS tương lai của Bella EIP Group</span>
              <div className="flex gap-4">
                <a href="#" className="hover:text-white transition-colors">Facebook</a>
                <a href="#" className="hover:text-white transition-colors">LinkedIn</a>
                <a href="#" className="hover:text-white transition-colors">GitHub</a>
              </div>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}
