'use client';

import React, { useState } from 'react';
import { 
  Car, 
  Search, 
  SlidersHorizontal, 
  PlusCircle, 
  ArrowUpDown, 
  Download,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface VehicleInventoryItem {
  id: string;
  vin: string;
  brand: string;
  model: string;
  variant: string;
  color: string;
  status: 'InTransit' | 'Warehouse' | 'Showroom' | 'Allocated' | 'Delivered';
  price: string;
  receivedAt: string;
}

export default function VehicleInventoryPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const inventory: VehicleInventoryItem[] = [
    { id: '1', vin: 'WBAHF3C01L7D34567', brand: 'BMW', model: '3 Series', variant: '330i Luxury Line', color: 'Alpine White', status: 'Showroom', price: '2,439,000,000đ', receivedAt: '2026-07-15' },
    { id: '2', vin: 'WBACR6C09L7E98765', brand: 'BMW', model: 'X5', variant: 'xDrive40i MSport', color: 'Carbon Black', status: 'Allocated', price: '4,019,000,000đ', receivedAt: '2026-07-20' },
    { id: '3', vin: 'WBA53AZ04M8F12345', brand: 'BMW', model: 'M4', variant: 'Competition Coupe', color: 'Sao Paulo Yellow', status: 'Warehouse', price: '5,599,000,000đ', receivedAt: '2026-07-28' },
    { id: '4', vin: 'WBA53AZ04M8F54321', brand: 'BMW', model: '5 Series', variant: '520i M Sport', color: 'Phytonic Blue', status: 'InTransit', price: '2,639,000,000đ', receivedAt: 'Đang vận chuyển' },
    { id: '5', vin: 'WBAHF3C01L7D99999', brand: 'BMW', model: '3 Series', variant: '320i Sport Line', color: 'Black Sapphire', status: 'Delivered', price: '1,899,000,000đ', receivedAt: '2026-06-10' }
  ];

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.model.toLowerCase().includes(search.toLowerCase()) || 
                          item.vin.toLowerCase().includes(search.toLowerCase()) ||
                          item.variant.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex-1 overflow-auto bg-slate-50/50 dark:bg-slate-950 p-6 md:p-10 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200/60 dark:border-slate-800 pb-6">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight uppercase flex items-center gap-3">
            <Car className="w-10 h-10 text-indigo-600" />
            Quản Lý Kho Xe & Số Khung (VIN)
          </h1>
          <p className="text-muted-foreground font-semibold mt-1">
            Vehicle Lifecycle Center — Quản lý danh mục, số khung VIN, và trạng thái bàn giao xe
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => toast.success('Mở form nhập VIN mới...')}
            className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all text-sm shadow-md"
          >
            <PlusCircle className="w-4 h-4" />
            Nhập Kho Xe Mới
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-indigo-600 transition-colors w-4 h-4" />
          <input 
            type="text" 
            placeholder="Tìm kiếm dòng xe, số VIN..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-semibold"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none text-sm font-bold text-slate-600 dark:text-slate-200"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="InTransit">Đang Vận Chuyển (In Transit)</option>
            <option value="Warehouse">Tổng Kho (Warehouse)</option>
            <option value="Showroom">Trưng Bày (Showroom)</option>
            <option value="Allocated">Đã Phân Bổ (Allocated)</option>
            <option value="Delivered">Đã Giao Xe (Delivered)</option>
          </select>
          <button 
            onClick={() => toast.success('Đang xuất báo cáo excel danh sách kho xe...')}
            className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all text-sm"
          >
            <Download className="w-4 h-4" />
            Xuất Excel
          </button>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200/60 dark:border-slate-800 text-xs font-black uppercase text-slate-400 tracking-wider">
                <th className="py-4 px-6">Dòng Xe & Phiên Bản</th>
                <th className="py-4 px-6">Mã Số Khung (VIN)</th>
                <th className="py-4 px-6">Màu Sắc</th>
                <th className="py-4 px-6">Trạng Thái</th>
                <th className="py-4 px-6 text-right">Giá Niêm Yết</th>
                <th className="py-4 px-6">Ngày Nhập Kho</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredInventory.length > 0 ? (
                filteredInventory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-all text-sm">
                    <td className="py-4 px-6">
                      <div className="font-bold text-slate-900 dark:text-white">{item.brand} {item.model}</div>
                      <div className="text-xs text-slate-400 font-semibold">{item.variant}</div>
                    </td>
                    <td className="py-4 px-6 font-mono font-bold text-xs tracking-wider text-slate-600 dark:text-slate-300">
                      {item.vin}
                    </td>
                    <td className="py-4 px-6 text-slate-600 dark:text-slate-300 font-semibold">
                      {item.color}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold border ${
                        item.status === 'Showroom' ? 'bg-emerald-50 text-emerald-600 border-emerald-100/50 dark:bg-emerald-950/20' :
                        item.status === 'Allocated' ? 'bg-indigo-50 text-indigo-600 border-indigo-100/50 dark:bg-indigo-950/20' :
                        item.status === 'InTransit' ? 'bg-amber-50 text-amber-600 border-amber-100/50 dark:bg-amber-950/20' :
                        item.status === 'Warehouse' ? 'bg-blue-50 text-blue-600 border-blue-100/50 dark:bg-blue-950/20' :
                        'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                      }`}>
                        {item.status === 'Showroom' ? 'Trưng Bày' :
                         item.status === 'Allocated' ? 'Đã Phân Bổ' :
                         item.status === 'InTransit' ? 'Đang Vận Chuyển' :
                         item.status === 'Warehouse' ? 'Tổng Kho' : 'Đã Bàn Giao'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right font-black text-slate-900 dark:text-white">
                      {item.price}
                    </td>
                    <td className="py-4 px-6 text-slate-400 font-semibold text-xs">
                      {item.receivedAt}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-400 font-bold italic">Không tìm thấy xe nào trong kho khớp với điều kiện lọc</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
