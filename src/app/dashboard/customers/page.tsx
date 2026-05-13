'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import PremiumExportButton from '@/components/ui/PremiumExportButton';
import { PremiumSelect } from '@/components/ui/PremiumSelect';

import { cn, formatNumberWithSeparator } from '@/lib/utils';

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
  X,
  Edit2,
  Trash2,
  MessageCircle,
  ClipboardList,
  ChevronDown
} from 'lucide-react';

import { MOCK_CUSTOMERS } from '@/constants/mock-data';
import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from '@/services/customer-actions';



export default function CustomersPage() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>(MOCK_CUSTOMERS);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('Tất cả trạng thái');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState('');
  const [depositAmount, setDepositAmount] = useState('');

  // Edit states
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Form states
  const [formData, setFormData] = useState({
    name_mother: '',
    phone: '',
    name_baby: '',
    dob_expected: '',
    address: '',
    notes: ''
  });

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setIsSyncing(true);
    const data = await getCustomers();
    if (data && data.length > 0) {
      setCustomers(data);
    }
    setIsSyncing(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // Fix: Limit year to 4 digits for date inputs to prevent errors like 20245
    if (e.target.type === 'date' && value) {
      const year = value.split('-')[0];
      if (year && year.length > 4) return;
    }
    
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      let result;
      if (isEditMode && editingCustomerId) {
        result = await updateCustomer(editingCustomerId, {
          ...formData,
          deposit_amount: depositAmount,
          package_name: selectedPackage
        });
      } else {
        result = await createCustomer({
          ...formData,
          deposit_amount: depositAmount,
          package_name: selectedPackage
        });
      }

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(isEditMode ? 'Cập nhật thành công!' : 'Thêm khách hàng thành công!');
        setIsModalOpen(false);
        // Reset form
        resetForm();
        loadCustomers();
      }
    } catch (error) {
      toast.error('Có lỗi xảy ra khi lưu dữ liệu');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name_mother: '',
      phone: '',
      name_baby: '',
      dob_expected: '',
      address: '',
      notes: ''
    });
    setDepositAmount('');
    setSelectedPackage('');
    setIsEditMode(false);
    setEditingCustomerId(null);
  };

  const handleEdit = (customer: any) => {
    setFormData({
      name_mother: customer.name_mother || '',
      phone: customer.phone || '',
      name_baby: customer.name_baby || '',
      dob_expected: customer.dob_expected || '',
      address: customer.address || '',
      notes: customer.notes || ''
    });
    setDepositAmount(customer.deposit_amount?.replace(/[^\d]/g, '') || '');
    setSelectedPackage(customer.package_name || '');
    setIsEditMode(true);
    setEditingCustomerId(customer.id);
    setIsModalOpen(true);
    setActiveMenuId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa hồ sơ này? Hành động này không thể hoàn tác.')) return;
    
    try {
      const result = await deleteCustomer(id);
      if (result.success) {
        toast.success('Xóa hồ sơ thành công');
        loadCustomers();
      } else {
        toast.error('Lỗi khi xóa hồ sơ');
      }
    } catch (error) {
      toast.error('Có lỗi xảy ra');
    }
    setActiveMenuId(null);
  };

  const handleZalo = (phone: string) => {
    const cleanPhone = phone.replace(/[^\d]/g, '');
    const zaloUrl = `https://zalo.me/${cleanPhone}`;
    window.open(zaloUrl, '_blank');
    setActiveMenuId(null);
  };

  const handleAddNew = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const today = new Date().toISOString().split('T')[0];

  const toggleMenu = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setActiveMenuId(activeMenuId === id ? null : id);
  };

  const statusOptions = ['Tất cả trạng thái', 'Đang chăm sóc', 'Chờ sinh', 'Tiềm năng', 'Đã kết thúc'];

  const [searchQuery, setSearchQuery] = useState('');

  // Reset pagination when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const filteredCustomers = customers.filter(customer => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      (customer.name_mother || '').toLowerCase().includes(q) || 
      (customer.phone || '').toLowerCase().includes(q);
    
    let matchesStatus = true;
    if (statusFilter !== 'Tất cả trạng thái') {
      if (statusFilter === 'Đang chăm sóc') matchesStatus = customer.status === 'active';
      else if (statusFilter === 'Chờ sinh') matchesStatus = customer.status === 'deposit';
      else if (statusFilter === 'Tiềm năng') matchesStatus = customer.status === 'potential';
      else if (statusFilter === 'Đã kết thúc') matchesStatus = customer.status === 'completed';
    }
    
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredCustomers.length / pageSize);
  const paginatedCustomers = filteredCustomers.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, filteredCustomers.length);

  return (
    <div className="flex-1 p-6 md:p-10 bg-slate-50/30 overflow-auto relative" onClick={() => { setActiveMenuId(null); setIsFilterOpen(false); }}>
      {/* Non-intrusive loading bar */}
      <AnimatePresence>
        {isSyncing && (
          <motion.div 
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-rose-400 to-primary origin-left z-50"
            transition={{ duration: 0.5 }}
          />
        )}
      </AnimatePresence>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Khách hàng</h1>
          <p className="text-slate-500 font-medium mt-1">Quản lý hồ sơ mẹ và bé</p>
        </div>
        <div className="flex items-center gap-3">
          <PremiumExportButton />
          <button 
            onClick={handleAddNew}
            className="flex items-center justify-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-rose-200 active:scale-95"
          >
            <UserPlus className="w-5 h-5" />
            <span>Thêm khách hàng</span>
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm mb-8 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-rose-500 transition-colors w-5 h-5" />
          <input 
            type="text" 
            placeholder="Tìm theo tên, số điện thoại..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-rose-500/20 outline-none transition-all font-medium text-slate-700"
          />
        </div>
          <div className="w-full md:w-64">
            <PremiumSelect 
              value={statusFilter}
              options={statusOptions.map(opt => ({
                value: opt,
                label: opt,
                icon: <Filter className="w-4 h-4" />
              }))}
              onChange={(val) => setStatusFilter(val)}
              placeholder="Trạng thái..."
            />
          </div>
      </div>

      {/* Customer Grid/Table */}
      <div className="grid grid-cols-1 gap-4">
        {isLoading && customers.length === 0 ? (
          <div className="bg-white rounded-3xl p-20 text-center border border-slate-100 shadow-sm">
            <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Đang tải dữ liệu...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="bg-white rounded-3xl p-20 text-center border border-dashed border-slate-200">
            <Search className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-bold">Không tìm thấy khách hàng nào khớp với bộ lọc</p>
          </div>
        ) : paginatedCustomers.map((customer: any, idx: number) => (
          <motion.div 
            key={customer.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="group luxury-card-white p-6 rounded-3xl transition-all flex flex-col md:flex-row md:items-center gap-6 relative"
          >
            <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
              <UserPlus className="text-rose-500 w-7 h-7" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h3 className="text-lg font-bold text-slate-900 truncate">{customer.name_mother}</h3>
                <span className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                  customer.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 
                  customer.status === 'deposit' ? 'bg-amber-50 text-amber-600' :
                  'bg-blue-50 text-blue-600'
                )}>
                  {customer.status === 'active' ? 'Đang chăm sóc' : 
                   customer.status === 'deposit' ? 'Chờ sinh (Đã cọc)' : 
                   'Tiềm năng'}
                </span>
                {customer.deposit_amount && (
                  <span className="px-3 py-1 bg-rose-50 text-rose-500 rounded-full text-[10px] font-black uppercase tracking-wider">
                    Cọc: {customer.deposit_amount}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-y-2 gap-x-6 text-sm font-medium text-slate-500">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-slate-400" />
                  {customer.phone}
                </div>
                <div className="flex items-center gap-2">
                  <Baby className="w-4 h-4 text-slate-400" />
                  {customer.status === 'deposit' ? `Dự sinh: ${customer.dob_expected}` : `Bé: ${customer.name_baby}`}
                </div>
                {customer.package_name && (
                  <div className="flex items-center gap-2 text-rose-500/80">
                    <ClipboardList className="w-4 h-4" />
                    Gói: {customer.package_name}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  {customer.address}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 md:border-l md:pl-6 border-slate-100 relative">
              <button 
                onClick={() => router.push(`/dashboard/bookings?customer=${customer.name_mother}`)}
                className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors shadow-sm"
                title="Xem lịch hẹn"
              >
                <Calendar className="w-5 h-5" />
              </button>
              <button 
                onClick={() => router.push(`/dashboard/customers/${customer.id}`)}
                className="flex items-center gap-2 bg-primary hover:bg-rose-600 text-white px-5 py-3 rounded-xl font-bold transition-all text-sm shadow-lg shadow-rose-200"
              >
                Chi tiết
                <ChevronRight className="w-4 h-4" />
              </button>
              <div className="relative">
                <button 
                  onClick={(e) => toggleMenu(e, customer.id)}
                  className={cn(
                    "p-3 rounded-xl transition-all",
                    activeMenuId === customer.id ? "bg-rose-500 text-white" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
                
                <AnimatePresence>
                  {activeMenuId === customer.id && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      className="absolute right-0 top-full mt-4 w-64 bg-white/95 backdrop-blur-xl rounded-[2rem] shadow-[0_20px_70px_rgba(0,0,0,0.15)] border border-white/20 z-50 overflow-hidden p-2.5"
                    >
                      <div className="space-y-1">
                        <button 
                          onClick={() => handleEdit(customer)}
                          className="flex items-center gap-3 w-full px-5 py-3.5 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-rose-500 rounded-2xl transition-all group/item"
                        >
                          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center group-hover/item:bg-blue-100 transition-colors">
                            <Edit2 className="w-4 h-4 text-blue-500" />
                          </div>
                          Chỉnh sửa
                        </button>
                        <button 
                          onClick={() => router.push(`/dashboard/customers/${customer.id}`)}
                          className="flex items-center gap-3 w-full px-5 py-3.5 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-rose-500 rounded-2xl transition-all group/item"
                        >
                          <div className="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center group-hover/item:bg-pink-100 transition-colors">
                            <ClipboardList className="w-4 h-4 text-rose-500" />
                          </div>
                          Thẻ liệu trình
                        </button>
                        <button 
                          onClick={() => handleZalo(customer.phone)}
                          className="flex items-center gap-3 w-full px-5 py-3.5 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-rose-500 rounded-2xl transition-all group/item"
                        >
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center group-hover/item:bg-emerald-100 transition-colors">
                            <MessageCircle className="w-4 h-4 text-emerald-500" />
                          </div>
                          Gửi Zalo
                        </button>
                        <div className="h-px bg-slate-100/50 mx-4 my-2" />
                        <button 
                          onClick={() => handleDelete(customer.id)}
                          className="flex items-center gap-3 w-full px-5 py-3.5 text-sm font-bold text-rose-500 hover:bg-rose-50 rounded-2xl transition-all group/item"
                        >
                          <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center group-hover/item:bg-rose-200 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </div>
                          Xóa hồ sơ
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">
            Hiển thị <span className="text-slate-900">{startIndex}-{endIndex}</span> trên tổng số <span className="text-slate-900">{filteredCustomers.length}</span> khách hàng
          </p>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-3 rounded-xl bg-white border border-slate-100 text-slate-400 hover:text-primary hover:border-primary/20 disabled:opacity-30 disabled:hover:text-slate-400 disabled:hover:border-slate-100 transition-all active:scale-90"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
            </button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                // Show only a few pages if too many
                if (totalPages > 7) {
                  if (page > 1 && page < totalPages && (page < currentPage - 1 || page > currentPage + 1)) {
                    if (page === currentPage - 2 || page === currentPage + 2) return <span key={page} className="px-1 text-slate-300">...</span>;
                    return null;
                  }
                }
                
                return (
                  <button 
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={cn(
                      "w-10 h-10 rounded-xl font-black text-sm transition-all active:scale-90",
                      currentPage === page 
                        ? "bg-primary text-white shadow-lg shadow-rose-200" 
                        : "bg-white border border-slate-100 text-slate-400 hover:text-slate-600 hover:border-slate-300"
                    )}
                  >
                    {page}
                  </button>
                );
              })}
            </div>
            
            <button 
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-3 rounded-xl bg-white border border-slate-100 text-slate-400 hover:text-primary hover:border-primary/20 disabled:opacity-30 disabled:hover:text-slate-400 disabled:hover:border-slate-100 transition-all active:scale-90"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
      )}

      {/* Add Customer Modal Placeholder */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-[#1A0A0E]/70 backdrop-blur-sm"
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
                      <h2 className="text-2xl font-bold text-slate-900">{isEditMode ? 'Cập nhật thông tin' : 'Thêm khách hàng mới'}</h2>
                      <p className="text-slate-500 font-medium">{isEditMode ? 'Chỉnh sửa hồ sơ mẹ và bé' : 'Nhập thông tin cơ bản của mẹ và bé'}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="p-3 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 ml-1">Họ tên Mẹ</label>
                      <input 
                        type="text" 
                        name="name_mother"
                        required
                        value={formData.name_mother}
                        onChange={handleInputChange}
                        className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-rose-500/20 outline-none" 
                        placeholder="VD: Nguyễn Thu Thủy" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 ml-1">Số điện thoại</label>
                      <input 
                        type="text" 
                        name="phone"
                        required
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-rose-500/20 outline-none" 
                        placeholder="VD: 0901234567" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 ml-1">Họ tên Bé / Tên thân mật</label>
                      <input 
                        type="text" 
                        name="name_baby"
                        value={formData.name_baby}
                        onChange={handleInputChange}
                        className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-rose-500/20 outline-none transition-all" 
                        placeholder="VD: Gia Bảo" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 ml-1">Ngày sinh Bé / Dự sinh</label>
                        <input 
                          type="date" 
                          name="dob_expected"
                          min={today}
                          max="9999-12-31"
                          value={formData.dob_expected}
                          onChange={handleInputChange}
                          className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-rose-500/20 outline-none transition-all" 
                        />
                    </div>
                    <div className="space-y-2 relative">
                      <label className="text-sm font-bold text-slate-700 ml-1">Gói dịch vụ đăng ký</label>
                      <div className="relative">
                        <button 
                          type="button"
                          onClick={(e) => { e.preventDefault(); setIsServiceDropdownOpen(!isServiceDropdownOpen); }}
                          className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-rose-500/20 outline-none text-left font-bold text-slate-600"
                        >
                          <span>{selectedPackage || 'Chọn gói...'}</span>
                          <motion.div animate={{ rotate: isServiceDropdownOpen ? 180 : 0 }}>
                            <ChevronDown className="w-4 h-4" />
                          </motion.div>
                        </button>
                        
                        <AnimatePresence>
                          {isServiceDropdownOpen && (
                            <motion.div 
                              initial={{ opacity: 0, y: 10, scale: 0.95 }}
                              animate={{ opacity: 1, y: 4, scale: 1 }}
                              exit={{ opacity: 0, y: 10, scale: 0.95 }}
                              className="absolute top-full left-0 right-0 mt-2 bg-white rounded-3xl shadow-2xl border border-slate-100 z-[60] overflow-hidden p-2"
                            >
                              {['Mẹ Bầu Toàn Diện', 'Phục Hồi Sau Sinh', 'Chăm Sóc Bé Pro'].map((pkg) => (
                                <button
                                  key={pkg}
                                  type="button"
                                  onClick={() => { setSelectedPackage(pkg); setIsServiceDropdownOpen(false); }}
                                  className={cn(
                                    "w-full text-left px-4 py-3 rounded-2xl text-sm font-bold transition-all",
                                    selectedPackage === pkg ? "bg-rose-500 text-white shadow-lg shadow-rose-100" : "text-slate-600 hover:bg-slate-50"
                                  )}
                                >
                                  {pkg}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 ml-1">Số tiền đặt cọc (VNĐ)</label>
                      <input 
                        type="text" 
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(formatNumberWithSeparator(e.target.value))}
                        className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-rose-500/20 outline-none transition-all" 
                        placeholder="VD: 2,000,000" 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 ml-1">Địa chỉ</label>
                    <textarea 
                      name="address"
                      required
                      value={formData.address}
                      onChange={handleInputChange}
                      className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-rose-500/20 outline-none resize-none h-24" 
                      placeholder="Nhập địa chỉ chi tiết..."
                    ></textarea>
                  </div>
                  
                  <div className="pt-6 flex gap-4">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl transition-all">
                      Hủy bỏ
                    </button>
                    <button 
                      type="submit" 
                      disabled={isSubmitting}
                      className={cn(
                        "flex-1 py-4 text-white font-bold rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2",
                        isSubmitting ? "bg-slate-400 cursor-not-allowed" : "bg-primary hover:bg-rose-600 shadow-rose-200"
                      )}
                    >
                      {isSubmitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                      {isSubmitting ? (isEditMode ? 'Đang cập nhật...' : 'Đang lưu...') : (isEditMode ? 'Cập nhật hồ sơ' : 'Lưu hồ sơ')}
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
