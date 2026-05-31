import { RefreshCw, ShieldCheck } from 'lucide-react';
import type { HqAuditLogRecord } from '@/types/domain';

interface HqAuditLogLedgerProps {
  logs: HqAuditLogRecord[];
  loading: boolean;
  currentPage: number;
  onInspectLog: (log: HqAuditLogRecord) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
}

export function HqAuditLogLedger({
  logs,
  loading,
  currentPage,
  onInspectLog,
  onPreviousPage,
  onNextPage,
}: HqAuditLogLedgerProps) {
  return (
    <>
      {/* Audit Logs Table Ledger - Metallic design */}
      <section className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
              Nhật ký kiểm toán thời gian thực (Super Admin Security Audit Log)
            </h4>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">
              Ghi lại mọi hoạt động nghiệp vụ nhạy cảm, chỉnh sửa hợp đồng, điều phối vật tư của toàn chuỗi spa Bella.
            </p>
          </div>
          <span className="text-[10px] bg-indigo-50 text-indigo-650 px-3 py-1 rounded-full font-black uppercase border border-indigo-100">
            SYSTEM SECURITY AUDIT
          </span>
        </div>

        {loading ? (
          <div className="p-16 text-center space-y-3">
            <RefreshCw size={24} className="animate-spin text-primary mx-auto" />
            <p className="text-xs text-slate-400 font-bold italic">Đang trích xuất dữ liệu nhật ký kiểm toán...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-16 text-center">
            <span className="text-4xl mb-3 block">🔒</span>
            <p className="text-slate-400 font-bold text-sm italic">Chưa có nhật ký hoạt động nào phù hợp bộ lọc.</p>
            <p className="text-[10px] text-slate-400 mt-1 max-w-sm mx-auto">
              Hệ thống tự động ghi nhận mọi lệnh thao tác dữ liệu nhạy cảm. Thử xóa bớt bộ lọc để hiển thị nhiều dữ liệu hơn.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-50/50 border-b border-slate-100">
                <tr>
                  <th scope="col" className="px-8 py-5">Thời gian</th>
                  <th scope="col" className="px-6 py-5">Chi nhánh</th>
                  <th scope="col" className="px-6 py-5">Người thực hiện</th>
                  <th scope="col" className="px-6 py-5 text-center">Tác vụ</th>
                  <th scope="col" className="px-6 py-5">Bảng dữ liệu</th>
                  <th scope="col" className="px-6 py-5">Mã dòng (Record ID)</th>
                  <th scope="col" className="px-8 py-5 text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Time */}
                    <td className="px-8 py-5 text-slate-500 font-mono text-[11px]">
                      {new Date(log.created_at).toLocaleString('vi-VN')}
                    </td>

                    {/* Tenant */}
                    <td className="px-6 py-5 font-black text-slate-900">
                      {log.tenant_name || 'Tổng bộ HQ'}
                    </td>

                    {/* Changed By User */}
                    <td className="px-6 py-5 font-black text-slate-700">
                      {log.user_name}
                    </td>

                    {/* Action Badge */}
                    <td className="px-6 py-5 text-center">
                      {log.action === 'INSERT' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100">
                          Thêm (INSERT)
                        </span>
                      ) : log.action === 'UPDATE' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-50 text-blue-600 border border-blue-100">
                          Sửa (UPDATE)
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-100">
                          Xóa (DELETE)
                        </span>
                      )}
                    </td>

                    {/* Table Name */}
                    <td className="px-6 py-5 font-mono text-xs text-indigo-600 font-black">
                      {log.table_name}
                    </td>

                    {/* Record ID */}
                    <td className="px-6 py-5 font-mono text-[10px] text-slate-400 select-all" title={log.record_id}>
                      {log.record_id.slice(0, 8)}...
                    </td>

                    {/* Action detail button */}
                    <td className="px-8 py-5 text-right">
                      <button
                        onClick={() => {
                          onInspectLog(log);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-sm"
                      >
                        <ShieldCheck size={12} />
                        Đối soát thay đổi
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination controls */}
        <div className="px-8 py-5 border-t border-slate-100 flex justify-between items-center bg-slate-50/50">
          <span className="text-xs text-slate-500 font-bold">
            Trang {currentPage} | Hiển thị tối đa 15 bản ghi
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => onPreviousPage()}
              disabled={currentPage === 1 || loading}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-all active:scale-95 cursor-pointer"
            >
              Trang trước
            </button>
            <button
              onClick={() => onNextPage()}
              disabled={logs.length < 15 || loading}
              className="px-4 py-2 bg-slate-900 border border-slate-900 rounded-xl text-xs font-black uppercase tracking-wider text-white hover:bg-slate-800 disabled:opacity-40 transition-all active:scale-95 cursor-pointer"
            >
              Trang sau
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
