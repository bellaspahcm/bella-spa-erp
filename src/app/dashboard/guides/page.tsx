'use client';

import { getCurrentUser } from '@/services/user-actions';
import { ALL_GUIDES,GuideListItem,isManualPermitted } from '@/services/user-manuals-utils';
import { motion } from 'framer-motion';
import {
ArrowRight,
Bookmark,
HelpCircle,
Loader2,
Search,
Sparkles
} from 'lucide-react';
import Link from 'next/link';
import { useEffect,useState } from 'react';

export default function UserManualsHub() {
  const [guides, setGuides] = useState<GuideListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadGuides() {
      try {
        const user = await getCurrentUser();
        const role = user?.role ?? null;
        setGuides(ALL_GUIDES.filter((g) => isManualPermitted(role, g.slug)));
      } catch (err) {
        console.error('Failed to load guides:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadGuides();
  }, []);

  const filteredGuides = guides.filter(
    (g) =>
      g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF5F7] dark:bg-[#11100F] py-12 px-6 lg:px-12 relative overflow-hidden transition-colors duration-300">
      {/* Decorative Blur Background elements */}
      <div className="absolute top-[-100px] right-[-100px] w-[400px] h-[400px] bg-pink-300/30 dark:bg-[#5D1C34]/15 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-100px] left-[-100px] w-[500px] h-[500px] bg-rose-300/20 dark:bg-[#A67D44]/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10 space-y-12">
        {/* Header Section */}
        <header className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 bg-white/80 dark:bg-[#1C1B19]/80 border border-pink-100 dark:border-[#3E3A35] px-4 py-1.5 rounded-full shadow-sm">
            <Sparkles className="w-4 h-4 text-primary dark:text-[#A67D44]" />
            <span className="text-[10px] font-black text-primary dark:text-[#CDBCAB] uppercase tracking-[0.2em]">Trung tâm tài liệu</span>
          </div>
          
          <h1 className="font-handwriting text-5xl md:text-7xl text-[#BE185D] dark:text-[#A67D44] leading-tight">
            Sổ tay hướng dẫn
          </h1>
          <p className="text-sm font-medium text-slate-500 dark:text-[#CDBCAB] leading-relaxed max-w-2xl mx-auto">
            Học quy trình SOP chuẩn hóa, quản lý nghiệp vụ tài chính, kế toán, nhân sự hoặc check-in/out kỹ thuật viên dành riêng cho vai trò của bạn.
          </p>
        </header>

        {/* Search Bar Block */}
        <div className="max-w-md mx-auto">
          <div className="relative group">
            <div className="absolute inset-0 bg-primary/10 dark:bg-[#A67D44]/10 blur-xl rounded-full scale-95 opacity-50 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative bg-white dark:bg-[#1C1B19] border border-pink-100 dark:border-[#3E3A35] rounded-2xl flex items-center px-4 py-3 shadow-[0_8px_30px_rgba(219,39,119,0.04)] dark:shadow-none focus-within:border-primary/50 dark:focus-within:border-[#A67D44]/50 transition-all duration-300">
              <Search className="w-5 h-5 text-slate-400 dark:text-[#CDBCAB] mr-3" />
              <input
                type="text"
                placeholder="Tìm quy trình, hướng dẫn sử dụng..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-sm text-slate-800 dark:text-[#EFE9E1] placeholder-slate-400 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Bento Grid layout for guides */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
          {filteredGuides.length > 0 ? (
            filteredGuides.map((guide, idx) => (
              <motion.div
                key={guide.slug}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
              >
                <Link
                  href={`/dashboard/guides/${guide.slug}`}
                  className="group block h-full bg-white dark:bg-[#1C1B19] rounded-[2rem] border border-pink-100 dark:border-[#3E3A35] p-8 shadow-[0_12px_40px_rgba(219,39,119,0.04)] dark:shadow-none hover:shadow-[0_20px_50px_rgba(219,39,119,0.12)] hover:border-primary dark:hover:border-[#A67D44] transition-all duration-300 hover:-translate-y-1.5 relative overflow-hidden"
                >
                  {/* Decorative faint glow inside card */}
                  <div className="absolute top-0 right-0 w-24 h-24 bg-pink-100/30 dark:bg-[#5D1C34]/5 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-500" />
                  
                  {/* Icon section */}
                  <div className="w-14 h-14 bg-pink-50 dark:bg-[#5D1C34]/40 rounded-2xl flex items-center justify-center text-3xl mb-6 border border-pink-100/50 dark:border-[#3E3A35]/50 group-hover:scale-105 group-hover:rotate-[-3deg] transition-all duration-300">
                    {guide.icon}
                  </div>

                  <span className="text-[10px] font-extrabold text-primary dark:text-[#A67D44] uppercase tracking-wider block mb-2">
                    {guide.subtitle}
                  </span>
                  
                  <h3 className="text-xl font-extrabold text-slate-800 dark:text-[#EFE9E1] mb-3 group-hover:text-primary dark:group-hover:text-[#A67D44] transition-colors leading-tight">
                    {guide.title}
                  </h3>
                  
                  <p className="text-xs text-slate-500 dark:text-[#CDBCAB] leading-relaxed mb-6 font-medium">
                    {guide.description}
                  </p>

                  <div className="pt-4 border-t border-slate-50 dark:border-[#3E3A35] flex items-center justify-between mt-auto">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary dark:text-[#A67D44]">
                      Đọc tài liệu
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform duration-300" />
                    </span>
                    <Bookmark className="w-4 h-4 text-slate-300 group-hover:text-primary dark:group-hover:text-[#A67D44] transition-colors" />
                  </div>
                </Link>
              </motion.div>
            ))
          ) : (
            <div className="col-span-full py-16 text-center bg-white dark:bg-[#1C1B19] rounded-[2rem] border border-pink-100 dark:border-[#3E3A35]">
              <HelpCircle className="w-12 h-12 text-slate-300 dark:text-[#CDBCAB] mx-auto mb-4 animate-bounce" />
              <h3 className="text-lg font-bold text-slate-700 dark:text-[#EFE9E1]">Không tìm thấy tài liệu phù hợp</h3>
              <p className="text-xs text-slate-400 mt-1">Vui lòng kiểm tra lại từ khóa tìm kiếm hoặc quyền hạn tài khoản của bạn.</p>
            </div>
          )}
        </div>

        {/* Footer Support Information */}
        <footer className="text-center pt-16 border-t border-pink-100/50 dark:border-[#3E3A35]/30">
          <p className="text-xs text-slate-400 dark:text-[#CDBCAB] font-bold uppercase tracking-widest">Bella Spa Group · Hỗ trợ kỹ thuật</p>
          <div className="flex justify-center gap-6 mt-4 text-xs font-bold text-primary dark:text-[#A67D44]">
            <a href="mailto:support@bellaspa.vn" className="hover:underline">support@bellaspa.vn</a>
            <span>•</span>
            <a href="tel:02899999999" className="hover:underline">(028) 9999 9999</a>
          </div>
        </footer>
      </div>
    </div>
  );
}
