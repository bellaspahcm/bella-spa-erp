'use client';

import { format } from 'date-fns';
import { CheckCircle2 } from 'lucide-react';
import type { ZnsLog } from '../types';

interface CrmLogsTabProps {
  znsLogs: ZnsLog[];
  loadError: string | null;
}

export function CrmLogsTab({ znsLogs, loadError }: CrmLogsTabProps) {
  return (
    <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-100/50 border border-slate-100/80 overflow-hidden">
      <div className="p-6 border-b border-slate-50">
        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Nhật ký tin nhắn gửi qua Zalo</h3>
        <p className="text-xs text-slate-400 font-medium">Lưu trữ để kiểm tra đối soát chất lượng dịch vụ chăm sóc</p>
      </div>

      <div className="overflow-x-auto overscroll-x-contain custom-scrollbar">
        <table className="bella-data-table min-w-[72rem] text-left">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <th className="py-4 px-6">Thời gian gửi</th>
              <th className="py-4 px-6">Loại tin nhắn</th>
              <th className="py-4 px-6">Tiêu đề log</th>
              <th className="py-4 px-6">Nội dung tin nhắn</th>
              <th className="py-4 px-6">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {znsLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-slate-400 font-medium italic">
                  {loadError ? 'Không thể tải nhật ký gửi tin nhắn.' : 'Không tìm thấy nhật ký gửi tin nhắn nào.'}
                </td>
              </tr>
            ) : (
              znsLogs.map((log) => (
                <tr key={log.id} className="border-b border-slate-100/70 hover:bg-slate-50/30 transition-colors">
                  <td className="py-4 px-6 text-xs text-slate-500 whitespace-nowrap">
                    {format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm:ss')}
                  </td>
                  <td className="py-4 px-6">
                    <span className={`inline-block px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wide ${
                      log.type === 'zalo_zns'
                        ? 'bg-blue-50 text-blue-600 border border-blue-100'
                        : 'bg-pink-50 text-pink-600 border border-pink-100'
                    }`}>
                      {log.type === 'zalo_zns' ? 'Zalo ZNS' : 'Sinh nhật / quà tặng'}
                    </span>
                  </td>
                  <td className="py-4 px-6 font-bold text-xs text-slate-700">{log.title}</td>
                  <td className="py-4 px-6 text-xs text-slate-600 font-medium max-w-md break-words">{log.message}</td>
                  <td className="py-4 px-6">
                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Thành công
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
