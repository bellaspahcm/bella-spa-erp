'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Sparkles, Loader2, Award, UserCheck, ShieldAlert, Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getKtvSuggestions, applyKtvSuggestion, KtvSuggestion } from '../../../../modules/bookings/actions/ktv-suggestion-actions';

interface KtvSuggestionPanelProps {
  bookingId: string;
  tenantId: string;
  requestedDate: string;
  requestedStartTime: string;
  durationMinutes: number;
  onKtvAssigned: (ktvId: string, ktvName: string) => void;
}

export function KtvSuggestionPanel({
  bookingId,
  tenantId,
  requestedDate,
  requestedStartTime,
  durationMinutes,
  onKtvAssigned,
}: KtvSuggestionPanelProps) {
  const [suggestions, setSuggestions] = useState<KtvSuggestion[]>([]);
  const [metadata, setMetadata] = useState<{
    algorithmVersion: string;
    totalCandidates: number;
    eligibleCandidates: number;
    executionTimeMs: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [applyingKtvId, setApplyingKtvId] = useState<string | null>(null);

  const fetchSuggestions = async () => {
    if (!bookingId || !tenantId || !requestedDate || !requestedStartTime) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getKtvSuggestions({
        bookingId,
        tenantId,
        requestedDate,
        requestedStartTime,
        durationMinutes,
      });

      if (result.success) {
        setSuggestions(result.suggestions);
        if (result.evaluationMetadata) {
          setMetadata(result.evaluationMetadata);
        }
      } else {
        setError(result.error || 'Không tìm thấy đề xuất KTV.');
        setSuggestions([]);
      }
    } catch (err) {
      console.error(err);
      setError('Lỗi khi kết nối với Decision Engine.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, [bookingId, tenantId, requestedDate, requestedStartTime, durationMinutes]);

  const handleSelect = async (ktvId: string, ktvName: string) => {
    setApplyingKtvId(ktvId);
    startTransition(async () => {
      try {
        const res = await applyKtvSuggestion(bookingId, ktvId, tenantId);
        if (res.success) {
          toast.success(`Đã chỉ định KTV ${ktvName} thành công! 🎉`);
          onKtvAssigned(ktvId, ktvName);
        } else {
          toast.error(res.error || 'Có lỗi xảy ra khi lưu chỉ định.');
        }
      } catch (err) {
        console.error(err);
        toast.error('Lỗi kết nối máy chủ.');
      } finally {
        setApplyingKtvId(null);
      }
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-white/80 backdrop-blur-md rounded-3xl border border-slate-100 shadow-sm h-64 min-h-[300px]">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">AI Decision Engine đang chấm điểm KTV...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-50/50 backdrop-blur-md rounded-3xl border border-rose-100 shadow-sm space-y-4">
        <div className="flex items-center gap-3 text-rose-700 font-black uppercase text-[10px] tracking-widest">
          <ShieldAlert className="w-4 h-4 text-rose-500" />
          AI Đề xuất lỗi
        </div>
        <p className="text-xs font-semibold text-rose-600 leading-relaxed">
          {error}
        </p>
        <button
          onClick={fetchSuggestions}
          className="text-[9px] font-black text-rose-800 uppercase tracking-wider hover:underline"
        >
          Thử lại
        </button>
      </div>
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500 animate-bounce" />
          AI Đề xuất KTV tối ưu
        </h3>
        {metadata && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded-lg text-[9px] font-mono font-bold text-slate-500" title="Engine Performance Profile">
            <Cpu className="w-3.5 h-3.5" />
            <span>v{metadata.algorithmVersion} • {metadata.executionTimeMs}ms</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {suggestions.map((suggestion) => {
          const isApplying = applyingKtvId === suggestion.ktvId;
          return (
            <div
              key={suggestion.ktvId}
              className={cn(
                "relative bg-white p-5 rounded-[2rem] border transition-all duration-300 flex flex-col justify-between group shadow-sm hover:shadow-md",
                suggestion.isRecommended
                  ? "border-amber-200 bg-gradient-to-b from-amber-50/20 to-white shadow-amber-50/40 hover:border-amber-300"
                  : "border-slate-100 hover:border-slate-200"
              )}
            >
              {suggestion.isRecommended && (
                <span className="absolute -top-3 left-4 px-3 py-1 bg-amber-500 text-white text-[8px] font-black uppercase tracking-widest rounded-full flex items-center gap-1 shadow-sm leading-none">
                  <Award className="w-3 h-3" /> Tối ưu nhất
                </span>
              )}

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black text-slate-900 group-hover:text-primary transition-colors">
                      {suggestion.ktvName}
                    </h4>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                      Kỹ thuật viên
                    </p>
                  </div>
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center font-mono font-black text-sm",
                    suggestion.isRecommended
                      ? "bg-amber-100 text-amber-800"
                      : "bg-slate-100 text-slate-700"
                  )}>
                    {suggestion.score}
                  </div>
                </div>

                {/* Micro Score Breakdown Charts */}
                <div className="space-y-2 border-t border-slate-50 pt-3">
                  <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 uppercase">
                    <span>Độ phù hợp kỹ năng</span>
                    <span className="font-mono text-slate-600">{suggestion.breakdown.skillMatch}/25</span>
                  </div>
                  <div className="w-full bg-slate-50 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full transition-all duration-500"
                      style={{ width: `${(suggestion.breakdown.skillMatch / 25) * 100}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 uppercase">
                    <span>Độ trống ca (Cân bằng tải)</span>
                    <span className="font-mono text-slate-600">{suggestion.breakdown.workloadBalance}/20</span>
                  </div>
                  <div className="w-full bg-slate-50 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${(suggestion.breakdown.workloadBalance / 20) * 100}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 uppercase">
                    <span>Khách quen & Yêu thích</span>
                    <span className="font-mono text-slate-600">{suggestion.breakdown.customerPreference}/10</span>
                  </div>
                  <div className="w-full bg-slate-50 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-sky-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${(suggestion.breakdown.customerPreference / 10) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleSelect(suggestion.ktvId, suggestion.ktvName)}
                disabled={isPending || isApplying}
                className={cn(
                  "w-full mt-5 py-2.5 rounded-xl font-black uppercase text-[9px] tracking-widest flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50",
                  suggestion.isRecommended
                    ? "bg-amber-500 text-white hover:bg-amber-600 shadow-lg shadow-amber-100"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100"
                )}
              >
                {isApplying ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <UserCheck className="w-3.5 h-3.5" />
                )}
                Chọn KTV
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
