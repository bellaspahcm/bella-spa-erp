'use client';

import { createClient } from '@/lib/supabase-client';
import { resolvePackageName } from '@bella/shared';
import { cn } from '@/lib/utils';
import { reusePackage, completeSession, getSessionLogs, getSessionsWithDetails, saveSessionNote } from '@/core/services/order';
import { getPendingLeaveRequests } from '@/services/attendance-actions';
import { useUser } from '@/lib/user-context';
import { useProgressiveLoad } from '@/hooks/useProgressiveLoad';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar as CalendarIcon, CheckCircle2, Download, Filter, Loader2, Plus, Search, ShieldCheck, TrendingUp, UserCircle } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { usePageRefresh } from '@/hooks/usePageRefresh';
import { useTenantModuleKey } from '@/hooks/useTenantModuleKey';
import { useModuleVocabulary } from '@/lib/business-rules/module-vocabulary';
import { LeaveRequest, SessionBooking } from './types';
import dynamic from 'next/dynamic';
import { TimelineKtvView } from './components/TimelineKtvView';
import { MonthCalendarView } from './components/MonthCalendarView';

const LeaveApprovalModal = dynamic(
  () => import('./components/LeaveApprovalModal').then(m => m.LeaveApprovalModal),
  { ssr: false }
);

const SessionLogsDetailsModal = dynamic(
  () => import('./components/SessionLogsDetailsModal').then(m => m.SessionLogsDetailsModal),
  { ssr: false }
);

const BookingModal = dynamic(
  () => import('@/components/features/BookingModal').then(m => m.BookingModal),
  { ssr: false }
);

function getErrorMessage(error: unknown, fallback = 'Lỗi không xác định') {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === 'string') return error || fallback;
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
}

function SessionsContent() {
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialBookingId = searchParams.get('bookingId') || '';

  const [viewMode, setViewMode] = useState<'timeline' | 'month'>('timeline');
  const [sessions, setSessions] = useState<SessionBooking[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<SessionBooking | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  const { tenantModuleKey, refreshTenantModuleKey } = useTenantModuleKey();
  const vocab = useModuleVocabulary(tenantModuleKey);

  // Admin Leave Approval States
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([]);
  const [isLeavesOpen, setIsLeavesOpen] = useState(false);

  const loadPendingLeaves = useCallback(async () => {
    try {
      const leaves = await getPendingLeaveRequests() as LeaveRequest[];
      setPendingLeaves(leaves);
    } catch (err: unknown) {
      console.error("Failed to load pending leaves:", err);
    }
  }, []);

  const loadSessions = useCallback(async () => {
    setIsSyncing(true);
    try {
      const data = await getSessionsWithDetails() as SessionBooking[];
      setSessions(data || []);
      return data;
    } catch (error: unknown) {
      console.error('Failed to load sessions:', error);
      setSessions([]);
      toast.error('Không thể tải danh sách lịch hẹn: ' + getErrorMessage(error));
      return [];
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const { criticalReady } = useProgressiveLoad({
    critical: async () => {
      await loadSessions();
    },
    secondary: async () => {
      if (user?.role?.toLowerCase() === 'admin') {
        await loadPendingLeaves();
      }
    },
    deps: [loadSessions, loadPendingLeaves, user],
  });

  const handleSoftRefresh = useCallback(async () => {
    await Promise.all([
      loadSessions(),
      refreshTenantModuleKey(),
      user?.role?.toLowerCase() === 'admin' ? loadPendingLeaves() : Promise.resolve(),
    ]);
  }, [loadPendingLeaves, loadSessions, refreshTenantModuleKey, user]);

  usePageRefresh(handleSoftRefresh);

  const handleCloseModal = () => {
    setSelectedBooking(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('bookingId');
    const newPath = params.toString() ? `/dashboard/sessions?${params.toString()}` : '/dashboard/sessions';
    router.replace(newPath, { scroll: false });
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-100/70 p-4 sm:p-6 md:p-8 relative">
      {/* Sync indicator */}
      <AnimatePresence>
        {isSyncing && (
          <motion.div 
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500 origin-left z-50"
            transition={{ duration: 0.5 }}
          />
        )}
      </AnimatePresence>

      {/* ── Top Header Bar matching Image 1 & Image 2 ── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Lịch hẹn</h1>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-0.5">
            Điều phối và theo dõi lịch liệu trình
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap w-full md:w-auto">
          {/* View Mode Switcher Pills matching Image 1 & 2 */}
          <div className="flex items-center p-1 bg-slate-200/80 rounded-2xl border border-slate-200">
            <button
              onClick={() => setViewMode('timeline')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all",
                viewMode === 'timeline'
                  ? "bg-white text-slate-900 shadow-md shadow-slate-900/10"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <CalendarIcon className="w-3.5 h-3.5 text-emerald-600" />
              <span>Timeline KTV</span>
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all",
                viewMode === 'month'
                  ? "bg-white text-slate-900 shadow-md shadow-slate-900/10"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <CalendarIcon className="w-3.5 h-3.5 text-blue-600" />
              <span>Lịch tháng</span>
            </button>
          </div>

          <button className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Xuất dữ liệu ∨
          </button>

          <button
            onClick={() => setIsBookingModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-950 text-white font-black text-xs hover:bg-slate-800 transition-all shadow-md active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Đặt lịch mới</span>
          </button>
        </div>
      </div>

      {/* ── Active View Rendering ── */}
      {!criticalReady ? (
        <div className="flex items-center justify-center p-20">
          <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
        </div>
      ) : viewMode === 'timeline' ? (
        <TimelineKtvView
          sessions={sessions}
          onSelectBooking={setSelectedBooking}
          onOpenBookingModal={() => setIsBookingModalOpen(true)}
        />
      ) : (
        <MonthCalendarView
          sessions={sessions}
          onSelectBooking={setSelectedBooking}
          onOpenBookingModal={() => setIsBookingModalOpen(true)}
        />
      )}

      {/* Detail Modal */}
      <SessionLogsDetailsModal
        isOpen={!!selectedBooking}
        activeBooking={selectedBooking}
        onClose={handleCloseModal}
        onSuccess={loadSessions}
        userRole={user?.role?.toLowerCase() === 'admin' ? 'admin' : 'KTV'}
        tenantModuleKey={tenantModuleKey}
      />

      {/* Leave Approval Panel */}
      <LeaveApprovalModal
        isOpen={isLeavesOpen}
        onClose={() => {
          setIsLeavesOpen(false);
          loadPendingLeaves();
        }}
        onSuccess={loadSessions}
        userRole={user?.role?.toLowerCase() === 'admin' ? 'admin' : 'KTV'}
      />

      {/* Booking Modal */}
      <BookingModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        onSuccess={loadSessions}
      />
    </div>
  );
}

export default function SessionsPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 p-10 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
      </div>
    }>
      <SessionsContent />
    </Suspense>
  );
}
