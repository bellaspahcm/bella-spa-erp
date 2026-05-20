'use client';

import { motion } from 'framer-motion';
import { Heart, Zap, ArrowRight } from 'lucide-react';

export function HeroSection() {
  return (
    <section className="relative pt-32 pb-24 md:pt-40 md:pb-36 flex items-center">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full text-center">
        
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-pink-100/60 text-primary text-[10px] font-black tracking-widest uppercase mb-6 shadow-sm border border-rose-200/50"
        >
          <Zap className="w-3.5 h-3.5 text-primary fill-current" />
          PHIÊN BẢN 2.0 ĐÃ SẴN SÀNG
        </motion.div>

        {/* Big Animated Title */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="text-[1.7rem] sm:text-[2.5rem] md:text-[3.6rem] font-serif font-black text-slate-900 tracking-tight leading-[1.1] max-w-5xl mx-auto animate-fade-in"
        >
          Bella Spa - Chăm Sóc <span className="text-gradient-pink relative whitespace-nowrap">Mẹ & Bé <span className="absolute bottom-2.5 left-0 w-full h-[6px] bg-rose-200/40 rounded-full -z-10" /></span>
        </motion.h1>

        {/* Slogan */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="mt-8 mb-10"
        >
          <p className="font-handwriting text-primary text-[2.4rem] sm:text-[3.4rem] md:text-[4.4rem] font-medium tracking-wide drop-shadow-sm select-none">
            Chăm Sóc Trọn Yêu Thương
          </p>
        </motion.div>

        {/* Subtitle Description */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="text-sm sm:text-base md:text-lg text-slate-500 font-medium max-w-3xl mx-auto leading-relaxed mt-8"
        >
          Hệ thống chăm sóc và phục hồi sức khỏe chuẩn y khoa chuyên sâu dành cho Mẹ Bầu, Mẹ Sau Sinh và Bé Yêu tại nhà hoặc tại Spa. Đồng hành cùng hàng triệu gia đình nâng niu những khoảnh khắc tuyệt diệu nhất.
        </motion.p>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <a 
            href="#booking"
            className="w-full sm:w-auto bg-primary hover:bg-primary-hover text-white px-8 py-4 rounded-full shadow-xl shadow-pink-200 hover:shadow-pink-300/40 hover:-translate-y-0.5 transition-all text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 group"
          >
            Bắt đầu đặt lịch ngay
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </a>
          <a 
            href="#services"
            className="w-full sm:w-auto bg-white hover:bg-rose-50/50 text-slate-800 border-2 border-rose-100 px-8 py-4 rounded-full shadow-md hover:-translate-y-0.5 transition-all text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5"
          >
            Xem các Gói Dịch Vụ
          </a>
        </motion.div>

        {/* Image Placeholder Visual */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 1.0 }}
          className="mt-16 relative rounded-[3rem] overflow-hidden max-w-5xl mx-auto border-4 border-white shadow-2xl aspect-auto py-10 px-4 md:py-0 md:px-8 md:aspect-[16/9] bg-gradient-to-br from-rose-50 to-pink-50 flex items-center justify-center"
        >
          <div className="absolute inset-0 bg-cover bg-center mix-blend-multiply opacity-20 filter saturate-50" style={{ backgroundImage: 'url("/logo.png")' }} />
          <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent" />
          
          <div className="relative z-10 text-center flex flex-col items-center">
            <div className="w-14 h-14 md:w-20 md:h-20 bg-white rounded-full flex items-center justify-center shadow-lg border border-pink-100 animate-bounce mb-3 md:mb-4">
              <Heart className="w-7 h-7 md:w-10 md:h-10 text-rose-500 fill-rose-100" />
            </div>
            <h3 className="text-lg sm:text-xl md:text-3xl font-serif font-black text-slate-800 mb-1.5 md:mb-2 px-2">Trải nghiệm liệu trình thư giãn chuẩn Nhật Bản</h3>
            <p className="text-[10px] sm:text-xs md:text-sm text-slate-500 font-semibold max-w-lg mb-5 md:mb-6 px-4">Không gian tinh tế, thảo dược 100% tự nhiên cùng tay nghề y đức nâng niu giấc ngủ của mẹ và nụ cười của bé.</p>
            
            <div className="flex flex-wrap items-center justify-center gap-3 md:gap-6 text-slate-600 text-[9px] sm:text-[10px] font-black uppercase tracking-widest px-2">
              <span className="flex items-center gap-1 bg-white/80 backdrop-blur px-3 py-1.5 rounded-full border border-rose-50"><span className="text-emerald-500 font-bold">✓</span> 100% Chuẩn Y Khoa</span>
              <span className="flex items-center gap-1 bg-white/80 backdrop-blur px-3 py-1.5 rounded-full border border-rose-50"><span className="text-emerald-500 font-bold">✓</span> KTV Cử Nhân Y Điều Dưỡng</span>
              <span className="flex items-center gap-1 bg-white/80 backdrop-blur px-3 py-1.5 rounded-full border border-rose-50"><span className="text-emerald-500 font-bold">✓</span> Nguyên Liệu Organic Sạch</span>
            </div>
          </div>
        </motion.div>

      </div>
    </section>
  );
}
