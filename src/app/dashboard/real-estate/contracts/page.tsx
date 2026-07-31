'use client';

import React, { useState } from 'react';
import { FileText, PlusCircle, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function RealEstateContractsPage() {
  const [contracts, setContracts] = useState([
    { id: 'ctr-101', customerName: 'Nguyễn Văn A', unitCode: 'Gold-A101', totalValue: 3500000000, status: 'draft', date: '2026-07-30' },
    { id: 'ctr-102', customerName: 'Trần Thị B', unitCode: 'Gold-B202', totalValue: 5000000000, status: 'signed', date: '2026-07-28' },
  ]);

  function handleSignContract(contractId: string) {
    setContracts(prev => prev.map(c => {
      if (c.id === contractId) {
        toast.success(`Đã ký hợp đồng ${c.id} thành công`);
        return { ...c, status: 'signed' as const };
      }
      return c;
    }));
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="text-primary w-7 h-7" />
            Hợp Đồng & Đặt Cọc
          </h1>
          <p className="text-sm text-slate-500">Quản lý danh sách các hợp đồng, tiến độ đặt cọc</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-500 uppercase">
              <th className="p-4">Mã Hợp Đồng</th>
              <th className="p-4">Khách Hàng</th>
              <th className="p-4">Căn Hộ</th>
              <th className="p-4">Giá Trị</th>
              <th className="p-4">Ngày Lập</th>
              <th className="p-4">Trạng Thái</th>
              <th className="p-4">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
            {contracts.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                <td className="p-4 font-semibold text-slate-900 dark:text-white">{c.id}</td>
                <td className="p-4">{c.customerName}</td>
                <td className="p-4">{c.unitCode}</td>
                <td className="p-4 font-semibold">{(c.totalValue / 1000000000).toFixed(2)} tỷ</td>
                <td className="p-4 text-slate-500">{c.date}</td>
                <td className="p-4">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    c.status === 'signed' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30' :
                    'bg-slate-100 text-slate-700 dark:bg-slate-800/30'
                  }`}>
                    {c.status === 'signed' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                    {c.status === 'signed' ? 'Đã Ký' : 'Bản Thảo'}
                  </span>
                </td>
                <td className="p-4">
                  {c.status === 'draft' && (
                    <button
                      onClick={() => handleSignContract(c.id)}
                      className="px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary-hover transition"
                    >
                      Ký Hợp Đồng
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
