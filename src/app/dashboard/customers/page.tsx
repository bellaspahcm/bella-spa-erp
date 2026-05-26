'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import PremiumExportButton from '@/components/ui/PremiumExportButton';
import { PremiumSelect } from '@/components/ui/PremiumSelect';

import { cn, formatNumberWithSeparator, getLocalDateString } from '@/lib/utils';

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
  ChevronDown,
  ShieldCheck,
  Sparkles
} from 'lucide-react';

import { createCustomer, updateCustomer, deleteCustomer } from '@/services/customer-actions';
import { createClient as createBrowserClient } from '@/lib/supabase-client';




export default function CustomersPage() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
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
  const pageSize = 15;

  // Form states
  const [formData, setFormData] = useState({
    name_mother: '',
    phone: '',
    name_baby: '',
    dob_expected: '',
    address: '',
    notes: '',
    gender_baby: 'unknown'
  });

  const [userRole, setUserRole] = useState<'admin' | 'ktv'>('ktv');

  useEffect(() => {
    async function checkRole() {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single();
        if (userData?.role) {
          setUserRole(userData.role as any);
        }
      }
    }
    checkRole();
  }, []);


  useEffect(() => {

    loadCustomers();
    loadPackages();
  }, []);

  const loadPackages = async () => {
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
      console.error('Error loading packages:', error);
    }
  };

  const loadCustomers = async () => {
    setIsSyncing(true);
    try {
      const supabase = createBrowserClient();
      const { data, error } = await supabase
        .from('customers')
        .select('*, bookings(deposit_amount, package_name, full_price, discount_percent, created_at, is_in_care)')
        .order('name_mother', { ascending: true });
      if (error) throw error;
      
      const enrichedCustomers = (data || []).map((c: any) => {
        // Lấy booking mới nhất (nếu có)
        const latestBooking = c.bookings && c.bookings.length > 0 
          ? c.bookings.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0] 
          : null;
          
        return {
          ...c,
          deposit_amount: latestBooking?.deposit_amount || '',
          package_name: latestBooking?.package_name || '',
          is_in_care: latestBooking?.is_in_care || false,
          is_fully_paid: latestBooking?.deposit_amount >= ((latestBooking?.full_price || 999999999) * (1 - (latestBooking?.discount_percent || 0)/100))
        };
      });
      
      setCustomers(enrichedCustomers);
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setIsSyncing(false);
    }
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
      let result: any;
      if (isEditMode && editingCustomerId) {
        result = await updateCustomer(editingCustomerId, {
          ...formData
        });
      } else {
        result = await createCustomer({
          ...formData
        });
      }

      if (result.error) {
        toast.error(result.error);
      } else {
        if (result.warning) {
          toast.success('Lưu thành công các thông tin khác!');
          toast.warning(result.warning, { duration: 10000 });
        } else {
          toast.success(isEditMode ? 'Cập nhật thành công!' : 'Thêm khách hàng thành công!');
        }
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
      notes: '',
      gender_baby: 'unknown'
    });
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
      notes: customer.notes || '',
      gender_baby: customer.gender_baby || 'unknown'
    });
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

  const today = getLocalDateString();

  const toggleMenu = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setActiveMenuId(activeMenuId === id ? null : id);
  };

  const statusOptions = ['Tất cả trạng thái', 'Đang chăm sóc', 'Chờ sinh', 'Tiềm năng', 'Đã kết thúc'];

  const [searchQuery, setSearchQuery] = useState('');
  const [monthFilter, setMonthFilter]  = useState('all');
  const [yearFilter,  setYearFilter]   = useState(String(new Date().getFullYear()));
  const [sortBy, setSortBy] = useState('date_desc');

  const currentYear = new Date().getFullYear();
  const monthOptions = [
    { value: 'all', label: 'Tất cả tháng' },
    ...Array.from({length:12}, (_,i) => ({ value: String(i+1).padStart(2,'0'), label: `Tháng ${i+1}` }))
  ];
  const yearOptions = Array.from({length:4}, (_,i) => String(currentYear - i));
  const sortOptions = [
    { value: 'date_desc', label: 'Ngày tạo mới nhất' },
    { value: 'date_asc', label: 'Ngày tạo cũ nhất' },
    { value: 'name_asc', label: 'Tên A-Z' },
    { value: 'name_desc', label: 'Tên Z-A' },
  ];

  // Reset pagination when any filter changes
  useEffect(() => { setCurrentPage(1); }, [searchQuery, statusFilter, monthFilter, yearFilter, sortBy]);

  const filteredCustomers = useMemo(() => {
    let result = customers.filter(customer => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || [
        customer.name_mother,
        customer.phone,
        customer.name_baby,
        customer.dob_expected,
        customer.dob_baby,
        customer.address,
        customer.notes,
        customer.zalo_oa_id,
        customer.gender_baby === 'boy' ? 'bé trai' : customer.gender_baby === 'girl' ? 'bé gái' : '',
      ].some(f => (f || '').toLowerCase().includes(q));

      let matchesStatus = true;
      if (statusFilter !== 'Tất cả trạng thái') {
        if (statusFilter === 'Đang chăm sóc') matchesStatus = customer.status === 'active';
        else if (statusFilter === 'Chờ sinh')  matchesStatus = customer.status === 'deposit';
        else if (statusFilter === 'Tiềm năng') matchesStatus = customer.status === 'lead';
        else if (statusFilter === 'Đã kết thúc') matchesStatus = customer.status === 'paid';
      }

      let matchesDate = true;
      const ref = customer.dob_expected || customer.created_at || '';
      if (monthFilter !== 'all') matchesDate = matchesDate && ref.slice(5,7) === monthFilter;
      if (yearFilter)            matchesDate = matchesDate && ref.slice(0,4) === yearFilter;

      return matchesSearch && matchesStatus && matchesDate;
    });

    result.sort((a, b) => {
      if (sortBy === 'name_asc') {
        return (a.name_mother || '').localeCompare(b.name_mother || '');
      } else if (sortBy === 'name_desc') {
        return (b.name_mother || '').localeCompare(a.name_mother || '');
      } else if (sortBy === 'date_asc') {
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      } else { // default date_desc
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      }
    });

    return result;
  }, [customers, searchQuery, statusFilter, monthFilter, yearFilter, sortBy]);

  const totalPages = Math.ceil(filteredCustomers.length / pageSize);
  const paginatedCustomers = filteredCustomers.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, filteredCustomers.length);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    const container = document.getElementById('customers-list-container');
    if (container) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div id="customers-list-container" className="flex-1 p-6 md:p-10 bg-background/30 overflow-auto relative" onClick={() => { setActiveMenuId(null); setIsFilterOpen(false); }}>
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
            className="flex items-center justify-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-rose-200 dark:shadow-none active:scale-95"
          >
            <UserPlus className="w-5 h-5" />
            <span>Thêm khách hàng</span>
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm mb-8 flex flex-col md:flex-row gap-3 items-center flex-wrap">
        {/* Search — all fields */}
        <div className="relative flex-1 min-w-[220px] group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-rose-500 transition-colors w-5 h-5" />
          <input
            type="text"
            placeholder="Tìm tên mẹ, tên bé, SĐT, ngày sinh, gói, địa chỉ..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-rose-500/20 outline-none font-medium text-slate-700 text-sm"
          />
        </div>
        {/* Status dropdown */}
        <div className="w-full md:w-52">
          <PremiumSelect
            value={statusFilter}
            options={statusOptions.map(opt => ({ value: opt, label: opt, icon: <Filter className="w-4 h-4" /> }))}
            onChange={val => setStatusFilter(val)}
            placeholder="Trạng thái..."
          />
        </div>
        {/* Month dropdown */}
        <div className="w-full md:w-40">
          <PremiumSelect
            value={monthFilter}
            options={monthOptions}
            onChange={val => setMonthFilter(val)}
            placeholder="Tháng..."
          />
        </div>
        {/* Year dropdown */}
        <div className="w-full md:w-32">
          <PremiumSelect
            value={yearFilter}
            options={yearOptions.map(y => ({ value: y, label: y }))}
            onChange={val => setYearFilter(val)}
            placeholder="Năm..."
          />
        </div>
        {/* Sort dropdown */}
        <div className="w-full md:w-48">
          <PremiumSelect
            value={sortBy}
            options={sortOptions}
            onChange={val => setSortBy(val)}
            placeholder="Sắp xếp..."
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
              <div className="flex flex-wrap items-center gap-3 mb-1">
                <h3 className="text-lg font-bold text-slate-900 truncate">{customer.name_mother}</h3>
                
                {/* Secondary Status Badges */}
                {customer.status === 'lead' && (
                  <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-wider border border-blue-100">
                    Tiềm năng
                  </span>
                )}
                {customer.status === 'deposit' && (
                  <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black uppercase tracking-wider border border-amber-100">
                    Chờ sinh (Đã cọc)
                  </span>
                )}

                {/* Prominent Notification for Active Care */}
                {customer.is_in_care && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 bg-rose-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-lg shadow-rose-200 dark:shadow-none animate-pulse cursor-pointer"
                    onClick={() => router.push(`/dashboard/customers/${customer.id}`)}
                  >
                    <Sparkles className="w-3 h-3" />
                    Đang có gói liệu trình
                  </motion.div>
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
                  {customer.gender_baby && (
                    <span className={cn(
                      "ml-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase",
                      customer.gender_baby === 'boy' ? "bg-blue-50 text-blue-500" : 
                      customer.gender_baby === 'girl' ? "bg-rose-50 text-rose-500" : 
                      "bg-slate-50 text-slate-500"
                    )}>
                      {customer.gender_baby === 'boy' ? "Bé Trai" : 
                       customer.gender_baby === 'girl' ? "Bé Gái" : "N/A"}
                    </span>
                  )}
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
                className="flex items-center gap-2 bg-primary hover:bg-rose-600 text-white px-5 py-3 rounded-xl font-bold transition-all text-sm shadow-lg shadow-rose-200 dark:shadow-none"
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
              onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="p-3 rounded-xl bg-white border border-slate-100 text-slate-400 hover:text-primary hover:border-primary/20 disabled:opacity-30 disabled:hover:text-slate-400 disabled:hover:border-slate-100 transition-all active:scale-90 shadow-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
            </button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                if (totalPages > 7) {
                  if (page > 1 && page < totalPages && (page < currentPage - 1 || page > currentPage + 1)) {
                    if (page === currentPage - 2 || page === currentPage + 2) return <span key={page} className="px-1 text-slate-300">...</span>;
                    return null;
                  }
                }
                
                return (
                  <button 
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={cn(
                      "w-10 h-10 rounded-xl font-black text-sm transition-all active:scale-90",
                      currentPage === page 
                        ? "bg-primary text-white shadow-lg shadow-rose-200 dark:shadow-none" 
                        : "bg-white border border-slate-100 text-slate-400 hover:text-slate-600 hover:border-slate-300"
                    )}
                  >
                    {page}
                  </button>
                );
              })}
            </div>
            
            <button 
              onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="p-3 rounded-xl bg-white border border-slate-100 text-slate-400 hover:text-primary hover:border-primary/20 disabled:opacity-30 disabled:hover:text-slate-400 disabled:hover:border-slate-100 transition-all active:scale-90 shadow-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
      )}
      
      {/* Spacer for bottom navigation room */}
      <div className="h-20" />

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
                    <div className="w-12 h-12 bg-rose-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-rose-200 dark:shadow-none">
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
                          className="w-full px-3 py-3.5 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-rose-500/20 outline-none transition-all text-sm font-bold" 
                        />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 ml-1">Giới tính của Bé</label>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { id: 'boy', label: 'Bé Trai', color: 'bg-blue-50 text-blue-600 border-blue-100' },
                          { id: 'girl', label: 'Bé Gái', color: 'bg-rose-50 text-rose-600 border-rose-100' },
                          { id: 'unknown', label: 'Chưa biết', color: 'bg-slate-50 text-slate-500 border-slate-100' }
                        ].map(g => (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => setFormData({ ...formData, gender_baby: g.id })}
                            className={cn(
                              "py-3 rounded-xl font-bold text-xs transition-all border",
                              formData.gender_baby === g.id 
                                ? "bg-rose-500 text-white border-rose-500 shadow-md shadow-rose-100 dark:shadow-none" 
                                : "bg-slate-50 text-slate-400 border-slate-100 hover:border-rose-200"
                            )}
                          >
                            {g.label}
                          </button>
                        ))}
                      </div>
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
                        isSubmitting ? "bg-slate-400 cursor-not-allowed" : "bg-primary hover:bg-rose-600 shadow-rose-200 dark:shadow-none"
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
