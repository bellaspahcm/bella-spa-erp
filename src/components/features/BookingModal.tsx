'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Search, 
  Plus, 
  User, 
  Phone, 
  Calendar, 
  Package, 
  CreditCard, 
  CheckCircle2,
  ChevronRight,
  ArrowLeft,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { getCustomers } from '@/services/customer-actions';
import { createBooking } from '@/services/booking-actions';
import { MOCK_SERVICES } from '@/constants/mock-data';
import { cn, formatNumberWithSeparator } from '@/lib/utils';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BookingModal({ isOpen, onClose }: BookingModalProps) {
  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    package_id: '',
    package_name: '',
    full_price: 0,
    deposit_amount: 0,
    total_sessions: 21,
    start_date: new Date().toISOString().split('T')[0].replace('2024', '2026').replace('2025', '2026'),
  });

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSearchQuery('');
      setSelectedCustomer(null);
      fetchCustomers();
    }
  }, [isOpen]);

  async function fetchCustomers() {
    setIsLoading(true);
    try {
      const data = await getCustomers();
      setCustomers(data);
      setFilteredCustomers(data);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast.error('Không thể tải danh sách khách hàng');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredCustomers(customers);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredCustomers(
        customers.filter(c => 
          c.name_mother?.toLowerCase().includes(query) || 
          c.phone?.includes(query)
        )
      );
    }
  }, [searchQuery, customers]);

  const handleSelectService = (service: any) => {
    const price = parseInt(service.price.replace(/[^\d]/g, ''));
    setFormData({
      ...formData,
      package_id: service.id,
      package_name: service.name,
      full_price: price,
      total_sessions: service.sessions
    });
  };

  const handleSubmit = async () => {
    if (!selectedCustomer) {
      toast.error('Vui lòng chọn khách hàng');
      return;
    }
    if (!formData.package_name) {
      toast.error('Vui lòng chọn gói dịch vụ');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createBooking({
        ...formData,
        customer_id: selectedCustomer.id
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Tạo lịch hẹn thành công!');
        onClose();
      }
    } catch (error) {
      console.error('Error creating booking:', error);
      toast.error('Đã xảy ra lỗi khi tạo lịch hẹn');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        />
        
        <motion.div 
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-white"
        >
          {/* Header */}
          <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-white">
            <div className="flex items-center gap-4">
              {step === 2 && (
                <button 
                  onClick={() => setStep(1)}
                  className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400 hover:text-primary"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <div>
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                  {step === 1 ? 'Chọn khách hàng' : 'Thông tin lịch hẹn'}
                </h2>
                <p className="text-sm text-slate-500 font-bold">Bước {step} / 2</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-3 hover:bg-rose-50 rounded-2xl transition-all text-slate-400 hover:text-rose-500 group"
            >
              <X className="w-6 h-6 group-hover:rotate-90 transition-transform" />
            </button>
          </div>

          <div className="p-8 max-h-[70vh] overflow-y-auto">
            {step === 1 ? (
              <div className="space-y-6">
                {/* Search */}
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors w-5 h-5" />
                  <input 
                    type="text" 
                    placeholder="Tìm theo tên mẹ hoặc số điện thoại..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold"
                    autoFocus
                  />
                </div>

                {/* Customer List */}
                <div className="space-y-3">
                  {isLoading ? (
                    <div className="py-20 text-center">
                      <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
                      <p className="text-slate-500 font-bold">Đang tải danh sách...</p>
                    </div>
                  ) : filteredCustomers.length > 0 ? (
                    filteredCustomers.map((customer) => (
                      <button
                        key={customer.id}
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setStep(2);
                        }}
                        className="w-full flex items-center justify-between p-5 rounded-[1.5rem] border border-slate-100 hover:border-primary hover:bg-primary/5 transition-all group text-left"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                            <User className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="font-black text-slate-900 group-hover:text-primary transition-colors">{customer.name_mother}</h4>
                            <p className="text-sm text-slate-500 font-bold flex items-center gap-2">
                              <Phone className="w-4 h-4" /> {customer.phone}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                      </button>
                    ))
                  ) : (
                    <div className="py-12 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                      <p className="text-slate-400 font-bold italic mb-4">Không tìm thấy khách hàng</p>
                      <button className="px-6 py-3 bg-white border border-primary text-primary rounded-xl font-black hover:bg-primary hover:text-white transition-all flex items-center gap-2 mx-auto">
                        <Plus className="w-5 h-5" /> Thêm khách hàng mới
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Selected Customer Summary */}
                <div className="flex items-center gap-4 p-5 bg-primary/5 rounded-3xl border border-primary/10">
                  <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center text-primary">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900">{selectedCustomer?.name_mother}</h4>
                    <p className="text-sm text-slate-500 font-bold">{selectedCustomer?.phone}</p>
                  </div>
                </div>

                {/* Service Selection */}
                <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Package className="w-4 h-4" /> Chọn gói dịch vụ
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {MOCK_SERVICES.map((service) => (
                      <button
                        key={service.id}
                        onClick={() => handleSelectService(service)}
                        className={cn(
                          "p-4 rounded-2xl border text-left transition-all relative group",
                          formData.package_id === service.id 
                            ? "border-primary bg-primary/5 shadow-lg shadow-primary/5" 
                            : "border-slate-100 hover:border-primary/50"
                        )}
                      >
                        {formData.package_id === service.id && (
                          <CheckCircle2 className="absolute top-3 right-3 w-5 h-5 text-primary" />
                        )}
                        <h5 className="font-black text-slate-900 group-hover:text-primary transition-colors">{service.name}</h5>
                        <p className="text-xs text-slate-500 font-bold mt-1">{service.sessions} buổi - {service.price}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Details Form */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> Ngày bắt đầu
                    </label>
                    <input 
                      type="date" 
                      value={formData.start_date}
                      onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <CreditCard className="w-4 h-4" /> Tiền đặt cọc (VNĐ)
                    </label>
                    <div className="relative">
                      <input 
                        type="text" 
                        placeholder="0"
                        value={formData.deposit_amount ? formatNumberWithSeparator(formData.deposit_amount) : ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^\d]/g, '');
                          setFormData({...formData, deposit_amount: val ? parseInt(val) : 0});
                        }}
                        className="w-full pl-5 pr-12 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold"
                      />
                      <span className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">đ</span>
                    </div>
                  </div>
                </div>

                {/* Pricing Summary */}
                <div className="p-6 bg-slate-900 rounded-[2rem] text-white">
                  <div className="flex justify-between items-center mb-4 opacity-70">
                    <span className="font-bold">Tổng tiền gói</span>
                    <span className="font-black">{formatNumberWithSeparator(formData.full_price)}đ</span>
                  </div>
                  <div className="flex justify-between items-center pt-4 border-t border-white/10">
                    <span className="font-bold">Cần thanh toán thêm</span>
                    <span className="text-2xl font-black text-primary">
                      {formatNumberWithSeparator(formData.full_price - formData.deposit_amount)}đ
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex gap-4">
            <button 
              onClick={onClose}
              className="flex-1 px-8 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black hover:bg-slate-50 transition-all uppercase tracking-widest active:scale-95"
            >
              Hủy
            </button>
            <button 
              disabled={step === 1 || !formData.package_name || isSubmitting}
              onClick={handleSubmit}
              className={cn(
                "flex-1 px-8 py-4 bg-primary text-white rounded-2xl font-black transition-all shadow-xl shadow-primary/20 uppercase tracking-widest active:scale-95 flex items-center justify-center gap-3",
                (step === 1 || !formData.package_name || isSubmitting) && "opacity-50 cursor-not-allowed grayscale"
              )}
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
              {isSubmitting ? 'Đang lưu...' : 'Xác nhận tạo'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
