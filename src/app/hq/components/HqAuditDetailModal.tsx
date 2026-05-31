import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { HqAuditLogRecord } from '@/types/domain';

interface AuditDiff {
  key: string;
  oldVal: unknown;
  newVal: unknown;
  type: 'insert' | 'delete' | 'update';
}

interface HqAuditDetailModalProps {
  log: HqAuditLogRecord | null;
  showRawJson: boolean;
  onClose: () => void;
  onShowRawJsonChange: (value: boolean) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatDiffValue(value: unknown) {
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function getDiffs(oldObj: unknown, newObj: unknown): AuditDiff[] {
  const oldRecord = isRecord(oldObj) ? oldObj : {};
  const newRecord = isRecord(newObj) ? newObj : {};
  const keys = Array.from(new Set([
    ...Object.keys(oldRecord),
    ...Object.keys(newRecord),
  ]));
  const diffs: AuditDiff[] = [];

  keys.forEach((key) => {
    const oldVal = oldRecord[key];
    const newVal = newRecord[key];
    const isChanged = JSON.stringify(oldVal) !== JSON.stringify(newVal);

    if (oldVal === undefined && newVal !== undefined) {
      diffs.push({ key, oldVal, newVal, type: 'insert' });
    } else if (oldVal !== undefined && newVal === undefined) {
      diffs.push({ key, oldVal, newVal, type: 'delete' });
    } else if (isChanged) {
      diffs.push({ key, oldVal, newVal, type: 'update' });
    }
  });

  return diffs;
}

export function HqAuditDetailModal({
  log,
  showRawJson,
  onClose,
  onShowRawJsonChange,
}: HqAuditDetailModalProps) {
  if (!log) return null;

  const diffs = getDiffs(log.old_data, log.new_data);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-4xl overflow-hidden text-left"
      >
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 px-8 py-6 text-white flex justify-between items-center">
          <div>
            <span className="text-[9px] bg-primary/20 text-rose-300 font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-primary/20">
              ĐỐI SOÁT THAO TÁC HỆ THỐNG
            </span>
            <h3 className="text-lg font-black uppercase tracking-tight mt-1 truncate max-w-[500px]" style={{ color: '#ffffff' }}>
              {log.tenant_name} &bull; {log.table_name}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all text-white"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-slate-50 border border-slate-100 rounded-3xl p-4 text-xs font-bold text-slate-700">
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Người thực hiện</p>
              <p className="text-slate-900 text-sm font-black">{log.user_name}</p>
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Thời gian thực hiện</p>
              <p className="text-slate-900 font-mono">{new Date(log.created_at).toLocaleString('vi-VN')}</p>
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Loại tác vụ</p>
              {log.action === 'INSERT' ? (
                <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700">Thêm mới</span>
              ) : log.action === 'UPDATE' ? (
                <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-blue-100 text-blue-700">Cập nhật</span>
              ) : (
                <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-700">Xóa bỏ</span>
              )}
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Record ID</p>
              <p className="text-slate-500 font-mono break-all select-all" title={log.record_id}>
                {log.record_id}
              </p>
            </div>
          </div>

          <div className="flex border-b border-slate-100 pb-px">
            <button
              type="button"
              onClick={() => onShowRawJsonChange(false)}
              className={`pb-3 px-4 font-black text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                !showRawJson
                  ? 'border-primary text-primary font-black'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Đối soát trực quan
            </button>
            <button
              type="button"
              onClick={() => onShowRawJsonChange(true)}
              className={`pb-3 px-4 font-black text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                showRawJson
                  ? 'border-primary text-primary font-black'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Dữ liệu nguồn (JSON)
            </button>
          </div>

          <div className="max-h-[400px] overflow-y-auto pr-1">
            {!showRawJson ? (
              <div className="space-y-4">
                {diffs.length === 0 ? (
                  <div className="py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <p className="text-slate-400 font-bold text-sm italic">
                      Không phát hiện trường thay đổi, hoặc thao tác không ảnh hưởng đến nội dung bảng.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {diffs.map((diff) => (
                      <div
                        key={diff.key}
                        className="bg-slate-50 border border-slate-100 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-7 gap-4 items-center text-xs"
                      >
                        <div className="md:col-span-2 min-w-0">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Trường dữ liệu</p>
                          <p className="font-mono font-black text-slate-800 break-all select-all">{diff.key}</p>
                        </div>

                        <div className="md:col-span-2 min-w-0 bg-white rounded-xl border border-slate-100 p-2.5 min-h-[50px] flex flex-col justify-center">
                          <p className="text-[8px] font-black text-rose-400 uppercase tracking-widest mb-1">Dữ liệu cũ (-)</p>
                          {diff.oldVal !== undefined ? (
                            <pre className="text-[10px] text-rose-650 bg-rose-50/50 p-1.5 rounded-lg font-mono break-all whitespace-pre-wrap select-all">
                              {formatDiffValue(diff.oldVal)}
                            </pre>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-bold italic">N/A</span>
                          )}
                        </div>

                        <div className="flex justify-center text-slate-350 font-black text-lg">
                          &rarr;
                        </div>

                        <div className="md:col-span-2 min-w-0 bg-white rounded-xl border border-slate-100 p-2.5 min-h-[50px] flex flex-col justify-center">
                          <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest mb-1">Dữ liệu mới (+)</p>
                          {diff.newVal !== undefined ? (
                            <pre className="text-[10px] text-emerald-650 bg-emerald-50/50 p-1.5 rounded-lg font-mono break-all whitespace-pre-wrap select-all">
                              {formatDiffValue(diff.newVal)}
                            </pre>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-bold italic">N/A</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                    Toàn bộ dữ liệu cũ (Old Object)
                  </label>
                  <pre className="bg-slate-900 text-slate-100 p-4 rounded-2xl overflow-auto text-xs font-mono max-h-[300px] border border-slate-800 select-all">
                    {log.old_data
                      ? JSON.stringify(log.old_data, null, 2)
                      : '// Không có dữ liệu cũ (INSERT hoặc không ghi nhận)'}
                  </pre>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                    Toàn bộ dữ liệu mới (New Object)
                  </label>
                  <pre className="bg-slate-900 text-slate-100 p-4 rounded-2xl overflow-auto text-xs font-mono max-h-[300px] border border-slate-800 select-all">
                    {log.new_data
                      ? JSON.stringify(log.new_data, null, 2)
                      : '// Không có dữ liệu mới (DELETE hoặc không ghi nhận)'}
                  </pre>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 cursor-pointer shadow-md"
            >
              Đóng đối soát
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
