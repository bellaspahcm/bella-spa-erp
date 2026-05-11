'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Plus, 
  Filter, 
  MoreVertical, 
  UserPlus,
  Baby,
  Phone,
  MapPin,
  Calendar,
  ChevronRight,
  X
} from 'lucide-react';

const mockCustomers = [
  { id: '1', name_mother: 'Nguyễn Thu Thủy', name_baby: 'Gia Bảo', phone: '0901234567', address: 'Quận 7, TP.HCM', status: 'active', dob_baby: '2024-03-15' },
  { id: '2', name_mother: 'Trần Thị Mai', name_baby: 'Minh Anh', phone: '0987654321', address: 'Quận 2, TP.HCM', status: 'active', dob_baby: '2024-01-20' },
  { id: '3', name_mother: 'Lê Diệu Linh', name_baby: 'Chưa sinh', phone: '0912334455', address: 'Quận 1, TP.HCM', status: 'lead', dob_expected: '2024-06-10' },
];

export default function CustomersPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="flex-1 p-6 md:p-10 bg-slate-50/30 overflow-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Khách hàng</h1>
          <p className="text-slate-500 font-medium mt-1">Quản lý hồ sơ mẹ và bé</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-rose-200"
        >
          <UserPlus className="w-5 h-5" />
          <span>Thêm khách hàng</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm mb-8 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-rose-500 transition-colors w-5 h-5" />
          <input 
            type="text" 
            placeholder="Tìm theo tên, số điện thoại..." 
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-rose-500/20 outline-none transition-all font-medium text-slate-700"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-colors font-bold text-slate-600 text-sm">
            <Filter className="w-4 h-4" />
            Bộ lọc
          </button>
          <select className="px-5 py-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-colors font-bold text-slate-600 text-sm outline-none cursor-pointer">
            <option>Tất cả trạng thái</option>
            <option>Đang sử dụng</option>
            <option>Tiềm năng</option>
            <option>Đã kết thúc</option>
          </select>
        </div>
      </div>

      {/* Customer Grid/Table */}
      <div className="grid grid-cols-1 gap-4">
        {mockCustomers.map((customer: any, idx: number) => (
          <motion.div 
            key={customer.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="group bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/40 transition-all flex flex-col md:flex-row md:items-center gap-6"
          >
            <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
              <UserPlus className="text-rose-500 w-7 h-7" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h3 className="text-lg font-bold text-slate-900 truncate">{customer.name_mother}</h3>
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  customer.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                }`}>
                  {customer.status === 'active' ? 'Đang chăm sóc' : 'Tiềm năng'}
                </span>
              </div>
              <div className="flex flex-wrap gap-y-2 gap-x-6 text-sm font-medium text-slate-500">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-slate-400" />
                  {customer.phone}
                </div>
                <div className="flex items-center gap-2">
                  <Baby className="w-4 h-4 text-slate-400" />
                  Bé: {customer.name_baby}
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  {customer.address}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 md:border-l md:pl-6 border-slate-100">
              <button className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors">
                <Calendar className="w-5 h-5" />
              </button>
              <button className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-xl font-bold transition-all text-sm">
                Chi tiết
                <ChevronRight className="w-4 h-4" />
              </button>
              <button className="p-3 text-slate-400 hover:text-slate-600">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Add Customer Modal Placeholder */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-10">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-rose-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-rose-200">
                      <UserPlus className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">Thêm khách hàng mới</h2>
                      <p className="text-slate-500 font-medium">Nhập thông tin cơ bản của mẹ và bé</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="p-3 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <form className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 ml-1">Họ tên Mẹ</label>
                      <input type="text" className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-rose-500/20 outline-none" placeholder="VD: Nguyễn Thu Thủy" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 ml-1">Số điện thoại</label>
                      <input type="text" className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-rose-500/20 outline-none" placeholder="VD: 0901234567" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 ml-1">Họ tên Bé (nếu có)</label>
                      <input type="text" className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-rose-500/20 outline-none" placeholder="VD: Gia Bảo" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 ml-1">Ngày sinh Bé / Dự sinh</label>
                      <input type="date" className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-rose-500/20 outline-none" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 ml-1">Địa chỉ</label>
                    <textarea className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-rose-500/20 outline-none resize-none h-24" placeholder="Nhập địa chỉ chi tiết..."></textarea>
                  </div>
                  
                  <div className="pt-6 flex gap-4">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl transition-all">
                      Hủy bỏ
                    </button>
                    <button type="submit" className="flex-1 py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl shadow-xl shadow-slate-200 transition-all">
                      Lưu hồ sơ
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
