'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Plus,
  Search,
  Filter,
  MoreVertical,
  CheckCircle2,
  Tag,
  Clock,
  DollarSign,
  ChevronRight,
  X,
  Zap,
  Database,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { toast } from 'sonner';
import { cn, formatNumberWithSeparator } from '@/lib/utils';

import { getPackages, createPackage, updatePackage, deletePackage } from '@/services/package-actions';
import { getPackageMaterials, upsertPackageMaterials, getInventoryItems } from '@/services/inventory-actions';
import { createClient as createBrowserClient } from '@/lib/supabase-client';
import { PremiumSelect } from '@/components/ui/PremiumSelect';

type MaterialRow = {
  item_id: string;
  quantity_per_session: number | '';
  // metadata cho hiển thị (không submit lên DB)
  name?: string;
  unit?: string;
};


export default function ServicesPage() {
  const [services, setServices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedService, setSelectedService] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 2;

  // Reset page on search/filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  
  // Form states
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');
  const [sessions, setSessions] = useState('');
  const [offer, setOffer] = useState('');
  const [details, setDetails] = useState('');
  const [ktvCommission, setKtvCommission] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Định mức tiêu hao vật tư (package_materials) ───────────────────────────
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [materialRows, setMaterialRows] = useState<MaterialRow[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);

  const resetForm = () => {
    setName('');
    setPrice('');
    setDuration('');
    setSessions('');
    setOffer('');
    setDetails('');
    setKtvCommission('');
    setStatus('active');
    setSelectedService(null);
    setMaterialRows([]);
  };


  const loadData = async () => {
    setIsLoading(true);
    try {
      const supabase = createBrowserClient();
      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .order('name', { ascending: true });
        
      if (error) {
        console.error('Error fetching packages:', error);
        toast.error('Không thể tải danh sách dịch vụ');
        setServices([]);
      } else {
        setServices(data || []);
      }
    } catch (err) {
      console.error('Load data error:', err);
      setServices([]);
    } finally {
      setIsLoading(false);
    }
  };


  useEffect(() => {
    loadData();
    // Tải danh mục vật tư 1 lần để dropdown chọn trong định mức tiêu hao
    getInventoryItems().then(setInventoryItems).catch(err => {
      console.error('Load inventory items error:', err);
    });
  }, []);

  const openAddModal = () => {
    setModalMode('add');
    setSelectedService(null);
    setName('');
    setPrice('');
    setDuration('');
    setSessions('');
    setOffer('');
    setDetails('');
    setKtvCommission('');
    setStatus('active');
    setMaterialRows([]);
    setIsModalOpen(true);
  };

  const openEditModal = async (service: any) => {
    setModalMode('edit');
    setSelectedService(service);
    setName(service.name);
    setPrice(service.price?.toString() || '');
    setDuration(service.duration?.replace(/[^\d]/g, '') || '90');
    setSessions(service.total_sessions?.toString() || '10');
    setOffer(service.offer || '');
    setDetails(Array.isArray(service.details) ? service.details.join(', ') : (service.details || ''));
    setKtvCommission(service.ktv_commission?.toString() || '150000');
    setStatus(service.status === 'active' ? 'active' : 'inactive');
    setMaterialRows([]);
    setIsModalOpen(true);

    // Tải định mức tiêu hao hiện hành của gói này
    setLoadingMaterials(true);
    try {
      const mats = await getPackageMaterials(service.id);
      const rows: MaterialRow[] = (mats || []).map((m: any) => ({
        item_id: m.item_id || m.inventory_items?.id,
        quantity_per_session: Number(m.quantity_per_session) || 0,
        name: m.inventory_items?.name,
        unit: m.inventory_items?.unit,
      }));
      setMaterialRows(rows);
    } catch (err) {
      console.error('Load package materials error:', err);
      toast.error('Không tải được định mức tiêu hao của gói');
    } finally {
      setLoadingMaterials(false);
    }
  };

  // ── Material row handlers ──────────────────────────────────────────────────
  const addMaterialRow = () => {
    setMaterialRows(prev => [...prev, { item_id: '', quantity_per_session: '' }]);
  };
  const updateMaterialRow = (idx: number, patch: Partial<MaterialRow>) => {
    setMaterialRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
  };
  const removeMaterialRow = (idx: number) => {
    setMaterialRows(prev => prev.filter((_, i) => i !== idx));
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa gói dịch vụ này?')) return;
    
    setIsLoading(true);
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase
        .from('packages')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting package:', error);
        toast.error('Lỗi khi xóa gói dịch vụ: ' + error.message);
      } else {
        toast.success('Đã xóa gói dịch vụ');
        loadData();
      }
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Lỗi hệ thống khi xóa');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleServiceStatus = async (service: any) => {
    const newStatus = service.status === 'active' ? 'inactive' : 'active';
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase
        .from('packages')
        .update({ status: newStatus })
        .eq('id', service.id);

      if (error) throw error;
      
      toast.success(`Đã chuyển trạng thái sang: ${newStatus === 'active' ? 'Đang hoạt động' : 'Tạm ngưng/Bản nháp'} 🌸`);
      setServices(prev => prev.map(s => s.id === service.id ? { ...s, status: newStatus } : s));
    } catch (err: any) {
      console.error('Toggle status error:', err);
      toast.error('Không thể cập nhật trạng thái: ' + err.message);
    }
  };

  const syncDefaultPackages = async () => {
    setIsLoading(true);
    try {
      const supabase = createBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Vui lòng đăng nhập để thực hiện');
        setIsLoading(false);
        return;
      }
      
      const { data: profile } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', session.user.id)
        .single();
      
      if (!profile?.tenant_id) {
        toast.error('Lỗi hệ thống: Không xác định được Tenant ID');
        setIsLoading(false);
        return;
      }
      const tenant_id = profile.tenant_id;

      // Default packages from landing page
      const defaultPackages = [
        {
          name: 'Gói Bầu Thư Giãn Bella',
          price: 450000,
          duration: '75 phút/buổi',
          total_sessions: 1,
          details: ['Ngâm chân thảo dược thải độc', 'Massage body thảo dược nhẹ nhàng', 'Chăm sóc da mặt cơ bản organic', 'Thư giãn vùng đầu, cổ, vai gáy'],
          offer: 'Tặng kèm trà sữa hạt organic sau liệu trình',
          status: 'inactive', // Saved as draft
          tenant_id
        },
        {
          name: 'Gói Bầu VIP Toàn Diện',
          price: 690000,
          duration: '100 phút/buổi',
          total_sessions: 1,
          details: ['Rửa chân và xông chân đá muối Himalaya', 'Massage chuyên sâu thắt lưng, hông', 'Massage Thụy Điển kết hợp đá nóng bazan', 'Chăm sóc da mặt chuyên sâu sữa ong chúa', 'Gội đầu dưỡng sinh thảo dược tự nhiên'],
          offer: 'Ưu đãi trải nghiệm buổi đầu giảm 30%',
          status: 'inactive', // Saved as draft
          tenant_id
        },
        {
          name: 'Gói Phục Hồi Cơ Bản',
          price: 650000,
          duration: '90 phút/buổi',
          total_sessions: 1,
          details: ['Xông tắm thảo dược Dao Đỏ tái tạo sinh lực', 'Massage thông tắc tia sữa, gọi sữa về', 'Massage bụng tống sản dịch bằng tinh dầu gừng', 'Quấn muối thảo dược giúp săn cơ bụng'],
          offer: 'Hỗ trợ tư vấn nuôi con bằng sữa mẹ miễn phí',
          status: 'inactive', // Saved as draft
          tenant_id
        },
        {
          name: 'Gói Eo Thon Dáng Ngọc VIP',
          price: 950000,
          duration: '120 phút/buổi',
          total_sessions: 1,
          details: ['Chăm sóc đầy đủ gói Phục Hồi Cơ Bản', 'Đắp men rượu thuốc Bắc kết hợp chạy máy RF săn cơ', 'Đắp mặt nạ nghệ hạ thổ sáng hồng da', 'Massage body toàn thân giải tỏa trầm cảm sau sinh', 'Chăm sóc và tẩy tế bào chết body thảo mộc'],
          offer: 'Tặng 01 buổi massage mặt chuyên sâu',
          status: 'inactive', // Saved as draft
          tenant_id
        },
        {
          name: 'Tắm Bé Chuẩn Y Khoa',
          price: 200000,
          duration: '45 phút/buổi',
          total_sessions: 1,
          details: ['Massage kích hoạt giác quan cơ/xương trước khi tắm', 'Tắm chuẩn y khoa, vệ sinh rốn, mắt, mũi, tai kỹ lưỡng', 'Hơ lá trầu giữ ấm ngực, thóp đầu và các khớp', 'Bôi tinh dầu tràm bảo vệ hô hấp'],
          offer: 'Tặng kèm tưa lưỡi thảo dược',
          status: 'inactive', // Saved as draft
          tenant_id
        },
        {
          name: 'Gói Bé Yêu Thông Minh VIP',
          price: 350000,
          duration: '60 phút/buổi',
          total_sessions: 1,
          details: ['Massage nâng cao kích thích hệ tiêu hóa, chống đầy hơi', 'Tắm rửa sát khuẩn nước thảo dược tự nhiên', 'Hơ lá trầu ấm áp theo phương pháp cung đình', 'Bơi thủy liệu (Hydrotherapy) phát triển thể chất', 'Tập vận động phản xạ sớm nâng cao chỉ số EQ/IQ'],
          offer: 'Ưu đãi trải nghiệm giảm 20%',
          status: 'inactive', // Saved as draft
          tenant_id
        },
        {
          name: 'Gói Bella Home-Care Tiêu Chuẩn',
          price: 7900000,
          duration: '90 phút/buổi',
          total_sessions: 10,
          details: ['5 buổi Chăm Sóc Phục Hồi cho mẹ sau sinh tại nhà', '5 buổi Tắm Bé & Massage chuẩn y khoa tại nhà', 'KTV là điều dưỡng có chứng chỉ hành nghề y tế'],
          offer: 'Tặng thêm 01 hũ muối thảo dược quấn bụng trị giá 350k',
          status: 'inactive', // Saved as draft
          tenant_id
        },
        {
          name: 'Gói Hoàng Gia Bella Signature',
          price: 18500000,
          duration: '120 phút/buổi',
          total_sessions: 25,
          details: ['10 buổi Chăm sóc Bầu VIP thư giãn giảm đau nhức', '15 buổi Liệu trình Phục Hồi Eo Thon Dáng Ngọc sau sinh', '15 buổi Tắm Bé & Bơi Thủy Liệu VIP kích thích phát triển', 'Miễn phí tư vấn dinh dưỡng cùng Bác sĩ Sản Nhi trong suốt thai kỳ'],
          offer: 'Tặng hộp quà Premium gồm 05 tinh dầu cao cấp và 01 túi thảo dược chườm mắt',
          status: 'inactive', // Saved as draft
          tenant_id
        }
      ];

      // Check existing names to prevent duplicates
      const { data: existingPackages } = await supabase
        .from('packages')
        .select('name');
      
      const existingNames = new Set(existingPackages?.map((p: any) => p.name) || []);
      const toInsert = defaultPackages.filter(p => !existingNames.has(p.name));

      if (toInsert.length === 0) {
        toast.info('Tất cả các gói mặc định đã tồn tại trong ERP.');
        setIsLoading(false);
        return;
      }

      const { error: insertError } = await supabase
        .from('packages')
        .insert(toInsert);

      if (insertError) throw insertError;

      toast.success(`Đã đồng bộ ${toInsert.length} gói dịch vụ mặc định làm bản nháp thành công! 🎉`);
      loadData();
    } catch (err: any) {
      console.error('Sync error:', err);
      toast.error('Lỗi đồng bộ gói dịch vụ: ' + (err.message || 'Lỗi không xác định'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const supabase = createBrowserClient();
      
      // Get current user for tenant_id if needed
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Phiên làm việc hết hạn. Vui lòng đăng nhập lại.');
        return;
      }

      // Fetch user profile to get tenant_id
      const { data: profile } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', session.user.id)
        .single();
      
      if (!profile?.tenant_id) {
        toast.error('Lỗi hệ thống: Không xác định được Tenant ID');
        return;
      }
      const tenant_id = profile.tenant_id;

      const dbData = {
        name: name,
        price: parseInt(price.toString().replace(/[^\d]/g, '') || '0'),
        duration: `${duration} phút/buổi`,
        total_sessions: parseInt(sessions.toString() || '10'),
        details: details.split(',').map(d => d.trim()).filter(d => d),
        offer: offer || '',
        ktv_commission: parseInt(ktvCommission.toString().replace(/[^\d]/g, '') || '150000'),
        status: status,
        tenant_id
      };

      let packageId: string | null = null;

      if (modalMode === 'edit' && selectedService) {
        const { error } = await supabase
          .from('packages')
          .update(dbData)
          .eq('id', selectedService.id);

        if (error) throw error;
        packageId = selectedService.id;
        toast.success('Đã cập nhật gói dịch vụ');
      } else {
        const { data: inserted, error } = await supabase
          .from('packages')
          .insert([dbData])
          .select('id')
          .single();

        if (error) throw error;
        packageId = inserted?.id || null;
        toast.success('Đã thêm gói dịch vụ mới');
      }

      // Lưu định mức tiêu hao vật tư (chỉ khi có packageId và có ít nhất 1 dòng)
      if (packageId && materialRows.length > 0) {
        // Validate: không trùng item_id
        const itemIds = materialRows
          .map(r => r.item_id)
          .filter(Boolean);
        const dup = itemIds.find((id, i) => itemIds.indexOf(id) !== i);
        if (dup) {
          toast.error('Có vật tư bị trùng trong định mức tiêu hao. Vui lòng kiểm tra lại.');
          // Không return — gói đã lưu, vẫn đóng modal, nhưng vật tư chưa lưu
        } else {
          const payload = materialRows
            .filter(r => r.item_id && Number(r.quantity_per_session) > 0)
            .map(r => ({
              item_id: r.item_id,
              quantity_per_session: Number(r.quantity_per_session),
            }));
          const res = await upsertPackageMaterials(packageId, payload);
          if (!res.success) {
            toast.error('Lỗi lưu định mức tiêu hao: ' + (res.error || ''));
          } else if (payload.length > 0) {
            toast.success(`Đã lưu ${payload.length} định mức tiêu hao vật tư cho gói`);
          }
        }
      } else if (packageId && modalMode === 'edit' && materialRows.length === 0) {
        // Edit mode + materialRows trống → xóa toàn bộ định mức cũ
        await upsertPackageMaterials(packageId, []);
      }

      setIsModalOpen(false);
      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Submit error:', error);
      toast.error('Lỗi khi lưu dữ liệu: ' + (error.message || 'Lỗi không xác định'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredServices = services
    .filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (statusFilter === 'all') return matchesSearch;
      return matchesSearch && s.status === statusFilter;
    })
    .sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (a.status !== 'active' && b.status === 'active') return 1;
      return a.name.localeCompare(b.name);
    });

  const totalPages = Math.ceil(filteredServices.length / pageSize) || 1;
  const paginatedServices = filteredServices.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, filteredServices.length);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };


  return (
    <div className="flex-1 p-6 md:p-10 bg-background/30 overflow-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Quản lý dịch vụ</h1>
          <p className="text-slate-500 font-medium mt-1">Thiết lập bảng giá và các chương trình ưu đãi</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={syncDefaultPackages}
            title="Đồng bộ các gói dịch vụ mặc định của Bella Spa từ Landing Page thành các bản nháp trong ERP"
            className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-6 py-3 rounded-2xl font-bold transition-all active:scale-95"
          >
            <span>Đồng bộ gói mặc định</span>
          </button>
          <button 
            onClick={openAddModal}
            className="flex items-center justify-center gap-2 bg-primary hover:bg-rose-600 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-rose-200 dark:shadow-none active:scale-95"
          >
            <Plus className="w-5 h-5" />
            <span>Thêm dịch vụ mới</span>
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm mb-8 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors w-5 h-5" />
          <input 
            type="text" 
            placeholder="Tìm kiếm dịch vụ..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium text-slate-700"
          />
        </div>
        <div className="w-full md:w-64 flex-shrink-0">
          <PremiumSelect
            value={statusFilter}
            options={[
              { value: 'all', label: 'Tất cả trạng thái', icon: <Filter className="w-4 h-4" /> },
              { value: 'active', label: 'Đang hoạt động', icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" /> },
              { value: 'inactive', label: 'Tạm ngưng / Nháp', icon: <X className="w-4 h-4 text-slate-400" /> }
            ]}
            onChange={(val) => setStatusFilter(val as 'all' | 'active' | 'inactive')}
            placeholder="Lọc trạng thái..."
          />
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {paginatedServices.map((service, idx) => (
          <motion.div 
            key={service.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="group luxury-card-white rounded-[2.5rem] transition-all overflow-hidden flex flex-col sm:flex-row h-full relative"
          >
            {/* Visual Section */}
            <div className="sm:w-48 bg-gradient-to-br from-rose-50 to-pink-100 dark:from-[#2D1620] dark:to-[#1A0A10] dark:border-r dark:border-[#3E3A35]/30 flex flex-col items-center justify-center p-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-20 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_70%)]" />
              </div>
              <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center shadow-lg shadow-rose-200 dark:shadow-none mb-4 z-10">
                <Sparkles className="text-primary w-8 h-8" />
              </div>
              <div className="bg-primary text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full z-10">
                {service.total_sessions} Buổi
              </div>
            </div>

            {/* Content Section */}
            <div className="flex-1 p-8 flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="text-xl font-black text-slate-900">{service.name}</h3>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border",
                      service.status === 'active' 
                        ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                        : "bg-slate-100 text-slate-400 border-slate-200"
                    )}>
                      {service.status === 'active' ? 'Đang hoạt động' : 'Tạm ngưng / Nháp'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-primary font-black text-lg">
                    <DollarSign className="w-4 h-4" />
                    {formatNumberWithSeparator(service.price)}đ
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {/* Status Toggle Switch */}
                  <button
                    onClick={() => toggleServiceStatus(service)}
                    title={service.status === 'active' ? 'Click để tạm ngưng gói' : 'Click để kích hoạt gói'}
                    className={cn(
                      "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/20",
                      service.status === 'active' ? "bg-emerald-500" : "bg-slate-300"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        service.status === 'active' ? "translate-x-4" : "translate-x-0"
                      )}
                    />
                  </button>
                  <button 
                    onClick={() => openEditModal(service)}
                    className="p-2 text-slate-400 hover:text-primary hover:bg-rose-50 rounded-xl transition-all"
                  >
                    <Zap className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => handleDelete(service.id)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="space-y-4 mb-6 flex-1">
                <div className="flex items-center gap-3 text-slate-500 text-sm font-bold bg-slate-50 p-3 rounded-2xl">
                  <Clock className="w-4 h-4 text-primary" />
                  Thời lượng: {service.duration}
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Chi tiết dịch vụ</p>
                  <div className="flex flex-wrap gap-2">
                    {Array.isArray(service.details) ? service.details.map((detail: string, i: number) => (
                      <span key={i} className="px-3 py-1.5 bg-slate-50 text-slate-600 rounded-xl text-xs font-bold border border-slate-100">
                        {detail}
                      </span>
                    )) : null}
                  </div>
                </div>
              </div>

              {/* Offer Badge */}
              <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-start gap-3">
                <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm shadow-rose-100 dark:shadow-none">
                  <Tag className="w-4 h-4 text-primary" />
                </div>
                <div className="text-xs font-bold text-rose-600 leading-relaxed">
                  <span className="uppercase text-[10px] block opacity-60 mb-0.5">Ưu đãi hiện có</span>
                  {service.offer}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">
            Hiển thị <span className="text-slate-900">{startIndex}-{endIndex}</span> trên tổng số <span className="text-slate-900">{filteredServices.length}</span> gói dịch vụ
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


      {/* Add/Edit Service Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-[#1A0A0E]/70 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl overflow-hidden"
            >
              <div className="p-10">
                <div className="flex items-center justify-between mb-10">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-primary rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl shadow-rose-200 dark:shadow-none">
                      <Zap className="w-7 h-7" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                        {modalMode === 'add' ? 'Thêm dịch vụ' : 'Chỉnh sửa dịch vụ'}
                      </h2>
                      <p className="text-slate-500 font-bold">
                        {modalMode === 'add' ? 'Tạo gói liệu trình mới cho khách hàng' : 'Cập nhật thông tin gói dịch vụ'}
                      </p>
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
                      <label className="text-sm font-black text-slate-700 ml-1">Tên dịch vụ / Gói</label>
                      <input 
                        type="text" 
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-primary/10 outline-none font-bold text-slate-700" 
                        placeholder="VD: Mẹ Bầu Toàn Diện" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-black text-slate-700 ml-1">Giá trọn gói (VNĐ)</label>
                      <input 
                        type="text" 
                        required
                        value={price}
                        onChange={(e) => setPrice(formatNumberWithSeparator(e.target.value))}
                        className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-primary/10 outline-none font-bold text-slate-700" 
                        placeholder="VD: 15,500,000" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-black text-slate-700 ml-1">Thời lượng (phút)</label>
                      <input 
                        type="text" 
                        required
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-primary/10 outline-none font-bold text-slate-700" 
                        placeholder="VD: 90" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-black text-slate-700 ml-1">Số buổi trong liệu trình</label>
                      <input 
                        type="number" 
                        required
                        value={sessions}
                        onChange={(e) => setSessions(e.target.value)}
                        className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-primary/10 outline-none font-bold text-slate-700" 
                        placeholder="VD: 15" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-black text-slate-700 ml-1">Hoa hồng KTV (VNĐ/buổi)</label>
                      <input 
                        type="text" 
                        required
                        value={ktvCommission ? formatNumberWithSeparator(ktvCommission) : ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^\d]/g, '');
                          setKtvCommission(val);
                        }}
                        className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-primary/10 outline-none font-bold text-slate-700" 
                        placeholder="VD: 150,000" 
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-black text-slate-700 ml-1">Chi tiết dịch vụ (Phân cách bằng dấu phẩy)</label>
                    <input 
                      type="text" 
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-primary/10 outline-none font-bold text-slate-700" 
                      placeholder="VD: Massage body, Chăm sóc da mặt, Xông hơi" 
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                    <div>
                      <span className="text-sm font-black text-slate-700 block">Kích hoạt gói dịch vụ</span>
                      <span className="text-xs text-slate-400 font-bold">Kích hoạt để gói hiển thị trực tiếp trên trang chủ Landing Page</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStatus(prev => prev === 'active' ? 'inactive' : 'active')}
                      className={cn(
                        "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/20",
                        status === 'active' ? "bg-emerald-500" : "bg-slate-300"
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                          status === 'active' ? "translate-x-5" : "translate-x-0"
                        )}
                      />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-black text-slate-700 ml-1">Chương trình ưu đãi (nếu có)</label>
                    <textarea
                      value={offer}
                      onChange={(e) => setOffer(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-primary/10 outline-none font-bold text-slate-700 resize-none h-24"
                      placeholder="Nhập các khuyến mãi đi kèm..."
                    ></textarea>
                  </div>

                  {/* ── Định mức tiêu hao vật tư mỗi buổi ───────────────────── */}
                  <div className="bg-gradient-to-br from-rose-50/40 to-pink-50/40 border border-rose-100 rounded-2xl p-6 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-primary shadow-sm">
                          <Database className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-900">Định mức tiêu hao vật tư mỗi buổi</h4>
                          <p className="text-[11px] text-slate-500 font-semibold leading-relaxed mt-0.5">
                            Hệ thống sẽ tự trừ kho theo định mức này khi KTV hoàn thành ca <span className="text-rose-500">(nếu bật ở Cài đặt → Quản lý Tiêu hao Kho vận)</span>.
                          </p>
                        </div>
                      </div>
                    </div>

                    {modalMode === 'add' ? (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs font-bold text-amber-700 leading-relaxed">
                        💡 Vui lòng <span className="underline">lưu gói trước</span>, sau đó mở lại để thiết lập định mức tiêu hao.
                      </div>
                    ) : loadingMaterials ? (
                      <div className="flex items-center gap-2 text-slate-400 text-xs font-bold py-4">
                        <RefreshCw className="w-4 h-4 animate-spin" /> Đang tải định mức...
                      </div>
                    ) : (
                      <>
                        {inventoryItems.length === 0 ? (
                          <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 text-xs font-bold text-slate-600 leading-relaxed">
                            ⚠️ Chưa có vật tư nào trong kho. Vui lòng vào <span className="underline">Quản lý Kho Vật Tư</span> để thêm trước.
                          </div>
                        ) : (
                          <>
                            <div className="space-y-2">
                              {materialRows.length === 0 ? (
                                <div className="text-center py-4 bg-white/60 border border-dashed border-rose-200 rounded-xl text-xs font-semibold text-slate-400 italic">
                                  Chưa có vật tư nào trong định mức. Bấm "+ Thêm vật tư" để bắt đầu.
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {/* Header */}
                                  <div className="hidden md:grid grid-cols-[1fr_140px_60px_40px] gap-3 px-3 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                    <span>Vật tư</span>
                                    <span>SL / buổi</span>
                                    <span>Đơn vị</span>
                                    <span></span>
                                  </div>
                                  {materialRows.map((row, idx) => {
                                    const item = inventoryItems.find(it => it.id === row.item_id);
                                    return (
                                      <div key={idx} className="grid grid-cols-1 md:grid-cols-[1fr_140px_60px_40px] gap-3 items-center bg-white rounded-xl p-3 border border-rose-100">
                                        <PremiumSelect
                                          value={row.item_id}
                                          onChange={(val) => {
                                            const it = inventoryItems.find(x => x.id === val);
                                            updateMaterialRow(idx, {
                                              item_id: val,
                                              name: it?.name,
                                              unit: it?.unit,
                                            });
                                          }}
                                          options={[
                                            { value: '', label: '-- Chọn vật tư --' },
                                            ...inventoryItems.map(it => ({
                                              value: it.id,
                                              label: `${it.name} (Tồn: ${it.stock_level} ${it.unit})`,
                                            })),
                                          ]}
                                          placeholder="Chọn vật tư..."
                                        />
                                        <input
                                          type="number"
                                          min={0}
                                          step="0.01"
                                          value={row.quantity_per_session === '' ? '' : row.quantity_per_session}
                                          onFocus={e => e.target.select()}
                                          onChange={e => updateMaterialRow(idx, {
                                            quantity_per_session: e.target.value === '' ? '' : Number(e.target.value),
                                          })}
                                          placeholder="0"
                                          className="w-full bg-slate-50 px-4 py-2.5 rounded-xl text-sm font-bold text-center outline-none focus:ring-2 focus:ring-primary/20"
                                        />
                                        <span className="text-xs font-black text-slate-500 text-center">
                                          {item?.unit || row.unit || '—'}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => removeMaterialRow(idx)}
                                          className="w-9 h-9 flex items-center justify-center rounded-xl text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                                          aria-label="Xóa vật tư"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={addMaterialRow}
                              className="w-full py-3 bg-white border border-dashed border-rose-300 text-rose-500 hover:bg-rose-50 hover:border-rose-400 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                            >
                              <Plus className="w-4 h-4" /> Thêm vật tư vào định mức
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>

                  <div className="pt-6 flex gap-4">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black rounded-[2rem] transition-all uppercase tracking-widest text-xs">
                      Hủy bỏ
                    </button>
                    <button type="submit" className="flex-1 py-5 bg-primary hover:bg-rose-600 text-white font-black rounded-[2rem] shadow-2xl shadow-rose-200 dark:shadow-none transition-all uppercase tracking-widest text-xs">
                      {modalMode === 'add' ? 'Lưu dịch vụ' : 'Cập nhật dịch vụ'}
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
