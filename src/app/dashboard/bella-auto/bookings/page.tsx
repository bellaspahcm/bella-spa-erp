'use client';

import React, { useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Search,
  PlusCircle,
  CheckCircle2,
  DollarSign,
  AlertCircle,
  Car,
  User,
  CreditCard,
  X,
  FileSpreadsheet
} from 'lucide-react';
import { toast } from 'sonner';

// Mock Bookings
const INITIAL_BOOKINGS = [
  { id: 'b1', bookingNumber: 'BK-AUTO-2026-8901', customerName: 'Nguyễn Văn A', variantName: 'BMW M4 Competition', vin: 'WBA53AZ04M8F12345', totalPrice: 5599000000, depositAmount: 200000000, depositPaid: 200000000, paymentStatus: 'fully_paid', status: 'confirmed', createdAt: '2026-07-28' },
  { id: 'b2', bookingNumber: 'BK-AUTO-2026-3456', customerName: 'Trần Thị B',   variantName: 'BMW 330i Luxury Line', vin: 'WBAHF3C01L7D34567', totalPrice: 2439000000, depositAmount: 100000000, depositPaid: 50000000,  paymentStatus: 'partially_paid', status: 'pending', createdAt: '2026-07-20' },
  { id: 'b3', bookingNumber: 'BK-AUTO-2026-1102', customerName: 'Lê Hoàng C',   variantName: 'BMW X5 xDrive40i MSport', vin: 'Chưa khớp VIN',  totalPrice: 4019000000, depositAmount: 150000000, depositPaid: 0,         paymentStatus: 'unpaid',         status: 'pending', createdAt: '2026-08-01' },
];

const PAYMENT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  unpaid:         { label: 'Chưa Đóng Cọc', color: 'text-rose-600',   bg: 'bg-rose-50 dark:bg-rose-950/20' },
  partially_paid: { label: 'Đã Cọc Một Phần', color: 'text-amber-600',  bg: 'bg-amber-50 dark:bg-amber-950/20' },
  fully_paid:     { label: 'Đã Cọc Đủ',     color: 'text-emerald-600',bg: 'bg-emerald-50 dark:bg-emerald-950/20' },
};

export default function BookingDepositHubPage() {
  const [bookings, setBookings] = useState(INITIAL_BOOKINGS);
  const [search, setSearch] = useState('');
  const [isPending, startTransition] = useTransition();
  const [showAddModal, setShowAddModal] = useState(false);
  
  // States for new booking form
  const [newBooking, setNewBooking] = useState({
    customerName: '', variantName: '', totalPrice: '', depositAmount: '', vin: ''
  });

  // Ghi nhận thanh toán đặt cọc nhanh (Mô phỏng recordDepositPayment)
  const handlePayDeposit = (bookingId: string) => {
    startTransition(async () => {
      await new Promise(r => setTimeout(r, 700));
      setBookings(prev => prev.map(b => {
        if (b.id === bookingId) {
          const paid = b.depositAmount; // Giả sử thanh toán đủ số tiền cọc
          toast.success(`Ghi nhận thanh toán cọc thành công cho ${b.bookingNumber}! Đã chuyển sự kiện sang Sổ Cái Kế Toán (PACKAGE_SALE).`);
          return { ...b, depositPaid: paid, paymentStatus: 'fully_paid', status: 'confirmed' };
        }
        return b;
      }));
    });
  };

  // Tạo booking mới
  const handleCreateBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBooking.customerName || !newBooking.variantName) {
      toast.error('Vui lòng điền đủ thông tin bắt buộc');
      return;
    }

    startTransition(async () => {
      await new Promise(r => setTimeout(r, 800));
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const bNumber = `BK-AUTO-2026-${randomSuffix}`;
      
      const created = {
        id:            `b-${Date.now()}`,
        bookingNumber: bNumber,
        customerName:  newBooking.customerName,
        variantName:   newBooking.variantName,
        vin:           newBooking.vin || 'Chưa khớp VIN',
        totalPrice:    Number(newBooking.totalPrice) || 2000000000,
        depositAmount: Number(newBooking.depositAmount) || 100000000,
        depositPaid:   0,
        paymentStatus: 'unpaid' as any,
        status:        'pending' as any,
        createdAt:     new Date().toISOString().split('T')[0]
      };

      setBookings(prev => [created, ...prev]);
      setShowAddModal(false);
      setNewBooking({ customerName: '', variantName: '', totalPrice: '', depositAmount: '', vin: '' });
      toast.success(`Hợp đồng ${bNumber} đã được khởi tạo! Xe sở hữu đã được phân bổ tạm thời.`);
    });
  };

  const filtered = bookings.filter(b => 
    b.bookingNumber.includes(search.toUpperCase()) || 
    b.customerName.toLowerCase().includes(search.toLowerCase()) ||
    b.variantName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-auto bg-slate-50/50 dark:bg-slate-950 p-6 md:p-10 space-y-8" data-auto-layout>
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-slate-200/60 dark:border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <FileText className="w-8 h-8 text-indigo-600" />
            Booking & Đặt Cọc Xe
          </h1>
          <p className="text-sm text-muted-foreground font-semibold mt-1">
            Deposit & Booking Hub — Quản lý thỏa thuận đặt cọc, tình trạng thanh toán và đối soát kế toán
          </p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all text-xs shadow-sm"
        >
          <PlusCircle className="w-4 h-4" /> Ký Hợp Đồng Cọc
        </button>
      </div>

      {/* Tìm kiếm */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors w-4 h-4" />
          <input
            type="text"
            placeholder="Tìm theo số booking, tên khách hàng..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs font-semibold"
          />
        </div>
      </div>

      {/* Bảng danh sách Bookings */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/60 dark:border-slate-800 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                <th className="py-4 px-5">Số Hợp Đồng Cọc</th>
                <th className="py-4 px-5">Khách Hàng</th>
                <th className="py-4 px-5">Dòng Xe & Số VIN</th>
                <th className="py-4 px-5 text-right">Tổng Hợp Đồng</th>
                <th className="py-4 px-5 text-right">Tiền Đặt Cọc</th>
                <th className="py-4 px-5">Thanh Toán</th>
                <th className="py-4 px-5">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map(b => (
                <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-all text-xs">
                  <td className="py-4 px-5 font-bold text-indigo-600 dark:text-indigo-400">
                    {b.bookingNumber}
                    <span className="text-[10px] text-slate-400 block font-semibold mt-0.5">{b.createdAt}</span>
                  </td>
                  <td className="py-4 px-5">
                    <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      {b.customerName}
                    </div>
                  </td>
                  <td className="py-4 px-5">
                    <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Car className="w-3.5 h-3.5 text-slate-400" />
                      {b.variantName}
                    </div>
                    <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 rounded px-1 mt-1 inline-block font-bold">
                      VIN: {b.vin}
                    </span>
                  </td>
                  <td className="py-4 px-5 text-right font-bold">
                    {(b.totalPrice / 1_000_000_000).toFixed(3)}B
                  </td>
                  <td className="py-4 px-5 text-right">
                    <div className="font-bold text-slate-900 dark:text-white">{(b.depositAmount / 1_000_000).toLocaleString('vi-VN')}M</div>
                    <div className="text-[9px] text-slate-400 font-bold mt-0.5">Đã đóng: {(b.depositPaid / 1_000_000).toLocaleString('vi-VN')}M</div>
                  </td>
                  <td className="py-4 px-5">
                    <span className={`px-2 py-1 rounded-lg text-[9px] font-bold ${PAYMENT_CONFIG[b.paymentStatus].bg} ${PAYMENT_CONFIG[b.paymentStatus].color}`}>
                      {PAYMENT_CONFIG[b.paymentStatus].label}
                    </span>
                  </td>
                  <td className="py-4 px-5">
                    {b.paymentStatus !== 'fully_paid' ? (
                      <button
                        onClick={() => handlePayDeposit(b.id)}
                        disabled={isPending}
                        className="flex items-center gap-1 px-3 py-1.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-lg font-bold text-[10px] transition-colors"
                      >
                        <CreditCard className="w-3 h-3" /> Xác Nhận Đóng Cọc
                      </button>
                    ) : (
                      <span className="text-[10px] text-emerald-600 font-black flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Đối Soát Đạt
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Booking Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/60 dark:border-slate-800 w-full max-w-lg overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
                <h2 className="text-lg font-black text-slate-900 dark:text-white">Ký Thỏa Thuận Đặt Cọc Mới</h2>
                <button onClick={() => setShowAddModal(false)} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 transition-colors">
                  <X className="w-4 h-4 text-slate-600" />
                </button>
              </div>

              <form onSubmit={handleCreateBooking} className="p-6 space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Tên Khách Hàng *</label>
                  <input required value={newBooking.customerName} onChange={e => setNewBooking(f => ({ ...f, customerName: e.target.value }))} placeholder="Lê Văn D" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-750 rounded-xl outline-none text-xs font-semibold" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Phiên Bản Xe Đặt Cọc *</label>
                  <input required value={newBooking.variantName} onChange={e => setNewBooking(f => ({ ...f, variantName: e.target.value }))} placeholder="BMW M4 Competition" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-750 rounded-xl outline-none text-xs font-semibold" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Số VIN Muốn Khớp (Nếu có)</label>
                  <input value={newBooking.vin} onChange={e => setNewBooking(f => ({ ...f, vin: e.target.value.toUpperCase() }))} placeholder="WBA53AZ04..." className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-750 rounded-xl outline-none text-xs font-semibold" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Giá Thỏa Thuận (VND)</label>
                    <input type="number" value={newBooking.totalPrice} onChange={e => setNewBooking(f => ({ ...f, totalPrice: e.target.value }))} placeholder="5599000000" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-750 rounded-xl outline-none text-xs font-semibold" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Số Tiền Đặt Cọc (VND)</label>
                    <input type="number" value={newBooking.depositAmount} onChange={e => setNewBooking(f => ({ ...f, depositAmount: e.target.value }))} placeholder="200000000" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-750 rounded-xl outline-none text-xs font-semibold" />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-3">
                  <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-350 font-bold text-xs hover:bg-slate-50 transition-colors">Hủy</button>
                  <button type="submit" disabled={isPending} className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5">
                    Tạo Đặt Cọc
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
