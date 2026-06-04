'use client';

import { getCurrentUser } from '@/services/user-actions';
import { ALL_GUIDES,GuideListItem,isManualPermitted } from '@/services/user-manuals-utils';
import { AnimatePresence,motion } from 'framer-motion';
import {
ArrowLeft,
ArrowRight,
Calendar as CalendarIcon,
ChevronLeft,
Clock,
DollarSign,
Loader2
} from 'lucide-react';
import Link from 'next/link';
import { useEffect,useState } from 'react';

export default function KtvGuidesPage() {
  const [guides, setGuides] = useState<GuideListItem[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadGuides() {
      try {
        const user = await getCurrentUser();
        const role = user?.role ?? null;
        const permitted = ALL_GUIDES.filter((g) => isManualPermitted(role, g.slug));
        // For KTV, we only show 'ktv' and 'sop' (or whatever they are permitted)
        setGuides(permitted.filter(g => ['ktv', 'sop'].includes(g.slug)));
      } catch (err) {
        console.error('Failed to load guides for KTV:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadGuides();
  }, []);

  const activeGuide = guides.find(g => g.slug === selectedSlug);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col relative pb-20">
      <AnimatePresence>
        {!selectedSlug ? (
          // ─── HUB VIEW ───────────────────────────────────────────────────────
          <motion.div
            key="hub-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="flex-grow flex flex-col p-6 space-y-6"
          >
            {/* Header */}
            <div className="flex items-center gap-3 pt-6">
              <Link href="/ktv/dashboard" className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 active:scale-95 transition-all">
                <ChevronLeft className="w-6 h-6 text-slate-600" />
              </Link>
              <div>
                <span className="text-[9px] font-black text-primary uppercase tracking-widest block mb-0.5">Tài liệu & SOP</span>
                <h1 className="text-xl font-black text-slate-900 leading-none">Sổ tay hướng dẫn</h1>
              </div>
            </div>

            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest pt-2">Tài liệu dành cho bạn</p>

            {/* Guides list */}
            <div className="space-y-4 flex-grow">
              {guides.map((guide) => (
                <button
                  key={guide.slug}
                  onClick={() => setSelectedSlug(guide.slug)}
                  className="w-full text-left bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm hover:border-primary/20 transition-all duration-300 active:scale-[0.98] flex gap-4 items-center"
                >
                  <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center text-2xl shrink-0">
                    {guide.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[8px] font-black text-primary uppercase tracking-widest block mb-1">
                      {guide.subtitle}
                    </span>
                    <h3 className="font-black text-slate-800 text-base leading-tight mb-1">
                      {guide.title}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium line-clamp-1 leading-normal">
                      {guide.description}
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center shrink-0">
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                  </div>
                </button>
              ))}
            </div>

            {/* Bottom Nav inside Hub view */}
            <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-100 px-8 py-4 flex justify-between items-center z-40">
              <Link href="/ktv/dashboard" className="text-slate-300 hover:text-primary flex flex-col items-center gap-1 transition-colors">
                <Clock className="w-6 h-6" />
                <span className="text-[10px] font-black uppercase">Lịch ca</span>
              </Link>
              <Link href="/ktv/earnings" className="text-slate-300 hover:text-primary flex flex-col items-center gap-1 transition-colors">
                <DollarSign className="w-6 h-6" />
                <span className="text-[10px] font-black uppercase">Thu nhập</span>
              </Link>
              <Link href="/ktv/leaderboard" className="text-slate-300 hover:text-primary flex flex-col items-center gap-1 transition-colors">
                <CalendarIcon className="w-6 h-6" />
                <span className="text-[10px] font-black uppercase">Cá nhân</span>
              </Link>
            </div>
          </motion.div>
        ) : (
          // ─── READER VIEW ────────────────────────────────────────────────────
          <motion.div
            key="reader-view"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 bg-white z-50 flex flex-col h-screen"
          >
            {/* Header bar */}
            <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between shrink-0">
              <button
                onClick={() => setSelectedSlug(null)}
                className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center border border-slate-200 text-slate-600 active:scale-95 transition-all"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              
              <div className="text-center min-w-0 flex-1 px-3">
                <span className="text-[8px] font-black text-primary uppercase tracking-widest block mb-0.5">
                  {activeGuide?.subtitle || 'Tài liệu hướng dẫn'}
                </span>
                <h2 className="text-xs font-black text-slate-800 truncate">
                  {activeGuide?.title || 'Đang đọc...'}
                </h2>
              </div>
              
              <div className="w-10 h-10" /> {/* Spacer */}
            </div>

            {/* Iframe Reader viewport */}
            <div className="flex-grow bg-slate-50 overflow-hidden relative">
              <iframe
                src={`/user-manuals/${selectedSlug}.html`}
                className="w-full h-full border-none"
                title={activeGuide?.title}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
