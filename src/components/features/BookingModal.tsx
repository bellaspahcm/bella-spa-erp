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
  Loader2,
  Tag
} from 'lucide-react';
import { toast } from 'sonner';
import { getCustomers, createCustomer } from '@/services/customer-actions';
import { createBooking, getDraftBooking } from '@/services/booking-actions';
import { createClient as createBrowserClient } from '@/lib/supabase-client';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { formatNumberWithSeparator, cn } from '@/lib/utils';


interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  preselectedCustomer?: any;
}

export function BookingModal({ isOpen, onClose, onSuccess, preselectedCustomer }: BookingModalProps) {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<'search' | 'new'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newCustomer, setNewCustomer] = useState({
    name_mother: '',
    phone: '',
    address: '',
  });

  const [ktvs, setKtvs] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [draftBooking, setDraftBooking] = useState<any>(null);
  const [originalPrice, setOriginalPrice] = useState<number>(0);
  const [discountPercent, setDiscountPercent] = useState<string>('');

  const [formData, setFormData] = useState({
    package_id: '',
    package_name: '',
    full_price: 0,
    deposit_amount: 0,
    total_sessions: 21,
    start_date: new Date().toISOString().split('T')[0],
    preferred_time: '08:00',
    assigned_ktv_id: '',
  });

  useEffect(() => {
    if (isOpen) {
      if (preselectedCustomer) {
        setSelectedCustomer(preselectedCustomer);
        setStep(2);
        setMode('search');
      } else {
        setStep(1);
        setMode('search');
        setSelectedCustomer(null);
      }
      setSearchQuery('');
      setNewCustomer({ name_mother: '', phone: '', address: '' });
      setOriginalPrice(0);
      setDiscountPercent('');
      fetchCustomers();
      fetchKtvs();
      fetchPackages();
    }
  }, [isOpen, preselectedCustomer]);

  async function fetchPackages() {
    try {
      const supabase = createBrowserClient();
      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .eq('status', 'active')
        .order('name', { ascending: true });
        
      if (error) throw error;
      setPackages(data || []);
    } catch (error) {
      console.error('Error fetching packages:', error);
    }
  }

  async function fetchKtvs() {
    try {
      const supabase = createBrowserClient();
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'ktv')
        .eq('status', 'active')
        .order('full_name', { ascending: true });
        
      if (error) throw error;
      setKtvs(data || []);
    } catch (error) {
      console.error('Error fetching KTVs:', error);
    }
  }


  // Load draft booking when customer is selected
  useEffect(() => {
    if (selectedCustomer?.id) {
      const loadDraft = async () => {
        const draft = await getDraftBooking(selectedCustomer.id);
        if (draft) {
          setDraftBooking(draft);
          // Pre-fill form data if draft exists
          setFormData(prev => ({
            ...prev,
            package_name: draft.package_name || '',
            full_price: draft.full_price || 0,
            deposit_amount: draft.deposit_amount || 0,
            total_sessions: draft.total_sessions || 21,
            start_date: draft.start_date || prev.start_date,
            preferred_time: draft.preferred_time || prev.preferred_time,
            assigned_ktv_id: draft.assigned_ktv_id || '',
          }));
          
          setOriginalPrice(draft.full_price || 0);
          
          if (draft.package_name) {
            toast.success(`Đã tự động nạp thông tin gói "${draft.package_name}" và số tiền cọc cũ.`);
          } else if (draft.deposit_amount > 0) {
            toast.info(`Khách hàng có số tiền cọc chờ: ${formatNumberWithSeparator(draft.deposit_amount)}đ. Vui lòng chọn gói dịch vụ.`);
          }
        } else {
          setDraftBooking(null);
          // Clear if no draft (unless it was already set by user selection)
          if (step === 1) {
            setFormData({
              package_id: '',
              package_name: '',
              full_price: 0,
              deposit_amount: 0,
              total_sessions: 21,
              start_date: new Date().toISOString().split('T')[0],
              preferred_time: '08:00',
              assigned_ktv_id: '',
            });
            setOriginalPrice(0);
            setDiscountPercent('');
          }
        }
      };
      loadDraft();
    }
  }, [selectedCustomer, step]);

  async function fetchCustomers() {
    setIsLoading(true);
    try {
      const supabase = createBrowserClient();
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('status', 'active')
        .order('name_mother', { ascending: true });
        
      if (error) throw error;
      setCustomers(data || []);
      setFilteredCustomers(data || []);
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

  const handleSelectService = (pkg: any) => {
    const pkgPrice = Number(pkg.price || pkg.full_price || 0);
    setOriginalPrice(pkgPrice);
    
    const discount = Number(discountPercent) || 0;
    const finalPrice = pkgPrice - (pkgPrice * discount / 100);

    setFormData({
      ...formData,
      package_id: pkg.id,
      package_name: pkg.name,
      full_price: finalPrice,
      total_sessions: Number(pkg.total_sessions || 10)
    });
  };

  const handleDiscountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '' || (Number(val) >= 0 && Number(val) <= 100)) {
       setDiscountPercent(val);
       const discount = Number(val) || 0;
       const finalPrice = originalPrice - (originalPrice * discount / 100);
       setFormData(prev => ({ ...prev, full_price: finalPrice }));
    }
  };

  const handleSubmit = async () => {
    const isCustomerSelected = mode === 'new' 
      ? (newCustomer.name_mother && newCustomer.phone)
      : selectedCustomer;

    if (!isCustomerSelected) {
      toast.error('Vui lòng chọn khách hàng');
      return;
    }

    if (!formData.package_name) {
      toast.error('Vui lòng chọn gói dịch vụ');
      return;
    }

    setIsSubmitting(true);
    try {
      let customerId = selectedCustomer?.id;

      // 1. If new customer, create them first
      if (mode === 'new') {
        const customerResult = await createCustomer({
          ...newCustomer,
          address: newCustomer.address || 'Chưa cập nhật'
        });

        if (customerResult.error) {
          toast.error('Lỗi khi tạo khách hàng: ' + customerResult.error);
          setIsSubmitting(false);
          return;
        }
        customerId = customerResult.data.id;
      }

      // 2. Create the booking
      const result = await createBooking({
        ...formData,
        customer_id: customerId
      });

      console.log('[BookingModal] createBooking result:', result);

      if (result?.error) {
        toast.error('Lỗi tạo lịch hẹn: ' + result.error);
      } else {
        toast.success('Tạo lịch hẹn thành công!');
        if (onSuccess) {
          onSuccess();
        } else {
          onClose();
        }
      }
    } catch (error: any) {
      console.error('[BookingModal] Exception in handleSubmit:', error);
      toast.error('Lỗi: ' + (error?.message || 'Không rõ nguyên nhân. Kiểm tra console để biết thêm.'));
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
          className="absolute inset-0 bg-[#1A0A0E]/70 backdrop-blur-sm"
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
                {/* Mode Toggle */}
                <div className="flex p-1.5 bg-slate-100 rounded-2xl">
                  <button 
                    onClick={() => setMode('search')}
                    className={cn(
                      "flex-1 py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2",
                      mode === 'search' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    <Search className="w-4 h-4" /> Khách cũ
                  </button>
                  <button 
                    onClick={() => setMode('new')}
                    className={cn(
                      "flex-1 py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2",
                      mode === 'new' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    <Plus className="w-4 h-4" /> Khách mới
                  </button>
                </div>

                {mode === 'search' ? (
                  <>
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
                          <button 
                            onClick={() => setMode('new')}
                            className="px-6 py-3 bg-white border border-primary text-primary rounded-xl font-black hover:bg-primary hover:text-white transition-all flex items-center gap-2 mx-auto"
                          >
                            <Plus className="w-5 h-5" /> Thêm khách hàng mới
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <User className="w-4 h-4" /> Tên mẹ
                      </label>
                      <input 
                        type="text" 
                        placeholder="Nhập tên mẹ..." 
                        value={newCustomer.name_mother}
                        onChange={(e) => setNewCustomer({...newCustomer, name_mother: e.target.value})}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Phone className="w-4 h-4" /> Số điện thoại
                      </label>
                      <input 
                        type="text" 
                        placeholder="Nhập số điện thoại..." 
                        value={newCustomer.phone}
                        onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Search className="w-4 h-4" /> Địa chỉ
                      </label>
                      <input 
                        type="text" 
                        placeholder="Nhập địa chỉ..." 
                        value={newCustomer.address}
                        onChange={(e) => setNewCustomer({...newCustomer, address: e.target.value})}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-8">
                {/* Selected Customer Summary */}
                <div className="flex items-center gap-4 p-5 bg-primary/5 rounded-3xl border border-primary/10">
                  <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center text-primary">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900">
                      {mode === 'new' ? newCustomer.name_mother : selectedCustomer?.name_mother}
                    </h4>
                    <p className="text-sm text-slate-500 font-bold">
                      {mode === 'new' ? newCustomer.phone : selectedCustomer?.phone}
                    </p>
                  </div>
                  {mode === 'new' && (
                    <span className="ml-auto bg-primary/10 text-primary text-[10px] px-2 py-1 rounded-full font-black uppercase">Mới</span>
                  )}
                </div>

                {/* Service Selection */}
                <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Package className="w-4 h-4" /> Chọn gói dịch vụ
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {packages.map((pkg) => (
                      <button
                        key={pkg.id}
                        onClick={() => handleSelectService(pkg)}
                        className={cn(
                          "p-4 rounded-2xl border text-left transition-all relative group",
                          formData.package_id === pkg.id 
                            ? "border-primary bg-primary/5 shadow-lg shadow-primary/5" 
                            : "border-slate-100 hover:border-primary/50"
                        )}
                      >
                        {(formData.package_id === pkg.id || formData.package_name === pkg.name) && (
                          <CheckCircle2 className="absolute top-3 right-3 w-5 h-5 text-primary" />
                        )}
                        <h5 className="font-black text-slate-900 group-hover:text-primary transition-colors">{pkg.name}</h5>
                        <p className="text-xs text-slate-500 font-bold mt-1">{pkg.total_sessions} buổi - {formatNumberWithSeparator(pkg.price)}đ</p>
                      </button>
                    ))}
                    {packages.length === 0 && !isLoading && (
                      <p className="col-span-2 text-center py-4 text-slate-400 italic font-bold">
                        Chưa có dữ liệu gói dịch vụ trong hệ thống.
                      </p>
                    )}
                  </div>
                </div>

                {/* KTV & Date Form */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <User className="w-4 h-4" /> Kỹ thuật viên phụ trách
                    </label>
                    <div className="relative">
                      <PremiumSelect 
                        value={formData.assigned_ktv_id}
                        options={[
                          { value: '', label: 'Chưa phân công' },
                          ...ktvs.map(k => ({ value: k.id, label: k.full_name }))
                        ]}
                        onChange={(val) => setFormData({...formData, assigned_ktv_id: val})}
                        className="w-full"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> Ngày bắt đầu
                    </label>
                    <input 
                      type="date" 
                      value={formData.start_date}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> Giờ làm mặc định
                    </label>
                    <input 
                      type="time" 
                      value={formData.preferred_time}
                      onChange={(e) => setFormData({...formData, preferred_time: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Package className="w-4 h-4" /> Số buổi liệu trình
                    </label>
                    <div className="relative">
                      <input 
                        type="number" 
                        min="1"
                        max="100"
                        value={formData.total_sessions}
                        onChange={(e) => setFormData({...formData, total_sessions: parseInt(e.target.value) || 1})}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold text-sm"
                      />
                    </div>
                  </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <CreditCard className="w-4 h-4" /> Tiền đặt cọc bổ sung (VNĐ) {draftBooking?.deposit_amount > 0 && <span className="text-primary normal-case">(Đã cọc trước: {formatNumberWithSeparator(draftBooking.deposit_amount)}đ)</span>}
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

                <div className="space-y-2 mb-6">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Tag className="w-4 h-4" /> Ưu đãi giảm giá (%)
                  </label>
                  <div className="relative">
                    <input 
                      type="number" 
                      placeholder="0"
                      min="0"
                      max="100"
                      value={discountPercent}
                      onChange={handleDiscountChange}
                      className="w-full pl-5 pr-12 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none font-bold"
                    />
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                  </div>
                </div>

                {/* Pricing Summary */}
                <div className="p-6 luxury-card-pink rounded-[2rem]">
                  <div className="flex justify-between items-center mb-4 opacity-70">
                    <span className="font-bold">Tổng tiền gói</span>
                    <span className="font-bold">{formatNumberWithSeparator(formData.full_price)}đ</span>
                  </div>
                  <div className="flex justify-between items-center mb-4 opacity-70">
                    <span className="font-bold">Tiền đã đặt cọc (Tổng)</span>
                    <span className="font-bold">-{formatNumberWithSeparator((draftBooking?.deposit_amount || 0) + formData.deposit_amount)}đ</span>
                  </div>
                  <div className="flex justify-between items-center pt-4 border-t border-white/10">
                    <span className="font-bold">Cần thanh toán thêm</span>
                    <span className="text-2xl font-bold text-primary">
                      {formatNumberWithSeparator(Math.max(0, formData.full_price - (draftBooking?.deposit_amount || 0) - formData.deposit_amount))}đ
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
              disabled={
                (step === 1 && mode === 'search') || 
                (step === 1 && mode === 'new' && (!newCustomer.name_mother || !newCustomer.phone)) ||
                (step === 2 && (!formData.package_name || isSubmitting))
              }
              onClick={() => {
                if (step === 1) setStep(2);
                else handleSubmit();
              }}
              className={cn(
                "flex-1 px-8 py-4 bg-primary text-white rounded-2xl font-black transition-all shadow-xl shadow-primary/20 uppercase tracking-widest active:scale-95 flex items-center justify-center gap-3",
                ((step === 1 && mode === 'search') || 
                 (step === 1 && mode === 'new' && (!newCustomer.name_mother || !newCustomer.phone)) ||
                 (step === 2 && (!formData.package_name || isSubmitting))) && "opacity-50 cursor-not-allowed grayscale"
              )}
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : step === 1 ? (
                <ChevronRight className="w-5 h-5" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
              {isSubmitting ? 'Đang lưu...' : step === 1 ? 'Tiếp tục' : 'Xác nhận tạo'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
