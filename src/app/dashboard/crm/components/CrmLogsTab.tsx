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
        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Nháº­t kÃ½ tin nháº¯n gá»­i qua Zalo (ZNS)</h3>
        <p className="text-xs text-slate-400 font-medium">ÄÆ°á»£c lÆ°u trá»¯ Ä‘á»ƒ kiá»ƒm tra Ä‘á»‘i soÃ¡t cháº¥t lÆ°á»£ng dá»‹ch vá»¥ chÄƒm sÃ³c</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <th className="py-4 px-6">Thá»i gian gá»­i (GMT+7)</th>
              <th className="py-4 px-6">Loáº¡i tin nháº¯n</th>
              <th className="py-4 px-6">TiÃªu Ä‘á» log</th>
              <th className="py-4 px-6">Ná»™i dung tin nháº¯n</th>
              <th className="py-4 px-6">Tráº¡ng thÃ¡i</th>
            </tr>
          </thead>
          <tbody>
            {znsLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-slate-400 font-medium italic">
                  {loadError ? 'KhÃ´ng thá»ƒ táº£i nháº­t kÃ½ gá»­i tin nháº¯n.' : 'KhÃ´ng tÃ¬m tháº¥y nháº­t kÃ½ gá»­i tin nháº¯n nÃ o.'}
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
                      {log.type === 'zalo_zns' ? 'Zalo ZNS' : 'Sinh nháº­t / QuÃ  táº·ng'}
                    </span>
                  </td>
                  <td className="py-4 px-6 font-bold text-xs text-slate-700">{log.title}</td>
                  <td className="py-4 px-6 text-xs text-slate-600 font-medium max-w-md break-words">{log.message}</td>
                  <td className="py-4 px-6">
                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                      <CheckCircle2 className="w-3.5 h-3.5" /> ThÃ nh cÃ´ng
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
