'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';

import { createClient as createBrowserClient } from '@/lib/supabase-client';
import { getInventoryItems, getPackageMaterials, upsertPackageMaterials } from '@/services/inventory-actions';
import {
  createPackage,
  deletePackage,
  getPackages,
  updatePackage,
  type PackageActionInput,
} from '@/services/package-actions';

import { createBlankServiceForm, PAGE_SIZE } from '../constants';
import type {
  InventoryItem,
  MaterialRow,
  ServiceModalMode,
  ServicePackage,
  ServiceStatus,
  ServiceStatusFilter,
} from '../types';

type PackageMaterialWithItem = {
  item_id: string | null;
  quantity_per_session: number | null;
  inventory_items: Pick<InventoryItem, 'id' | 'name' | 'unit'> | null;
};

const getErrorMessage = (error: unknown, fallback: string) => (
  error instanceof Error ? error.message : fallback
);

const createDefaultPackages = (tenantId: string): PackageActionInput[] => [
  {
    name: 'Gói Bầu Thư Giãn Bella',
    price: 450000,
    duration: '75 phút/buổi',
    total_sessions: 1,
    details: ['Ngâm chân thảo dược thải độc', 'Massage body thảo dược nhẹ nhàng', 'Chăm sóc da mặt cơ bản organic', 'Thư giãn vùng đầu, cổ, vai gáy'],
    offer: 'Tặng kèm trà sữa hạt organic sau liệu trình',
    status: 'inactive',
    tenant_id: tenantId,
  },
  {
    name: 'Gói Bầu VIP Toàn Diện',
    price: 690000,
    duration: '100 phút/buổi',
    total_sessions: 1,
    details: ['Rửa chân và xông chân đá muối Himalaya', 'Massage chuyên sâu thắt lưng, hông', 'Massage Thụy Điển kết hợp đá nóng bazan', 'Chăm sóc da mặt chuyên sâu sữa ong chúa', 'Gội đầu dưỡng sinh thảo dược tự nhiên'],
    offer: 'Ưu đãi trải nghiệm buổi đầu giảm 30%',
    status: 'inactive',
    tenant_id: tenantId,
  },
  {
    name: 'Gói Phục Hồi Cơ Bản',
    price: 650000,
    duration: '90 phút/buổi',
    total_sessions: 1,
    details: ['Xông tắm thảo dược Dao Đỏ tái tạo sinh lực', 'Massage thông tắc tia sữa, gọi sữa về', 'Massage bụng tống sản dịch bằng tinh dầu gừng', 'Quấn muối thảo dược giúp săn cơ bụng'],
    offer: 'Hỗ trợ tư vấn nuôi con bằng sữa mẹ miễn phí',
    status: 'inactive',
    tenant_id: tenantId,
  },
  {
    name: 'Gói Eo Thon Dáng Ngọc VIP',
    price: 950000,
    duration: '120 phút/buổi',
    total_sessions: 1,
    details: ['Chăm sóc đầy đủ gói Phục Hồi Cơ Bản', 'Đắp men rượu thuốc Bắc kết hợp chạy máy RF săn cơ', 'Đắp mặt nạ nghệ hạ thổ sáng hồng da', 'Massage body toàn thân giải tỏa trầm cảm sau sinh', 'Chăm sóc và tẩy tế bào chết body thảo mộc'],
    offer: 'Tặng 01 buổi massage mặt chuyên sâu',
    status: 'inactive',
    tenant_id: tenantId,
  },
  {
    name: 'Tắm Bé Chuẩn Y Khoa',
    price: 200000,
    duration: '45 phút/buổi',
    total_sessions: 1,
    details: ['Massage kích hoạt giác quan cơ/xương trước khi tắm', 'Tắm chuẩn y khoa, vệ sinh rốn, mắt, mũi, tai kỹ lưỡng', 'Hơ lá trầu giữ ấm ngực, thóp đầu và các khớp', 'Bôi tinh dầu tràm bảo vệ hô hấp'],
    offer: 'Tặng kèm tưa lưỡi thảo dược',
    status: 'inactive',
    tenant_id: tenantId,
  },
  {
    name: 'Gói Bé Yêu Thông Minh VIP',
    price: 350000,
    duration: '60 phút/buổi',
    total_sessions: 1,
    details: ['Massage nâng cao kích thích hệ tiêu hóa, chống đầy hơi', 'Tắm rửa sát khuẩn nước thảo dược tự nhiên', 'Hơ lá trầu ấm áp theo phương pháp cung đình', 'Bơi thủy liệu (Hydrotherapy) phát triển thể chất', 'Tập vận động phản xạ sớm nâng cao chỉ số EQ/IQ'],
    offer: 'Ưu đãi trải nghiệm giảm 20%',
    status: 'inactive',
    tenant_id: tenantId,
  },
  {
    name: 'Gói Bella Home-Care Tiêu Chuẩn',
    price: 7900000,
    duration: '90 phút/buổi',
    total_sessions: 10,
    details: ['5 buổi Chăm Sóc Phục Hồi cho mẹ sau sinh tại nhà', '5 buổi Tắm Bé & Massage chuẩn y khoa tại nhà', 'KTV là điều dưỡng có chứng chỉ hành nghề y tế'],
    offer: 'Tặng thêm 01 hũ muối thảo dược quấn bụng trị giá 350k',
    status: 'inactive',
    tenant_id: tenantId,
  },
  {
    name: 'Gói Hoàng Gia Bella Signature',
    price: 18500000,
    duration: '120 phút/buổi',
    total_sessions: 25,
    details: ['10 buổi Chăm sóc Bầu VIP thư giãn giảm đau nhức', '15 buổi Liệu trình Phục Hồi Eo Thon Dáng Ngọc sau sinh', '15 buổi Tắm Bé & Bơi Thủy Liệu VIP kích thích phát triển', 'Miễn phí tư vấn dinh dưỡng cùng Bác sĩ Sản Nhi trong suốt thai kỳ'],
    offer: 'Tặng hộp quà Premium gồm 05 tinh dầu cao cấp và 01 túi thảo dược chườm mắt',
    status: 'inactive',
    tenant_id: tenantId,
  },
];

export function useServicesPageState() {
  const [services, setServices] = useState<ServicePackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ServiceModalMode>('add');
  const [selectedService, setSelectedService] = useState<ServicePackage | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ServiceStatusFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const [form, setForm] = useState(createBlankServiceForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [materialRows, setMaterialRows] = useState<MaterialRow[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);

  const updateSearchQuery = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const updateStatusFilter = (value: ServiceStatusFilter) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const setName = (name: string) => setForm(prev => ({ ...prev, name }));
  const setPrice = (price: string) => setForm(prev => ({ ...prev, price }));
  const setDuration = (duration: string) => setForm(prev => ({ ...prev, duration }));
  const setSessions = (sessions: string) => setForm(prev => ({ ...prev, sessions }));
  const setOffer = (offer: string) => setForm(prev => ({ ...prev, offer }));
  const setDetails = (details: string) => setForm(prev => ({ ...prev, details }));
  const setKtvCommission = (ktvCommission: string) => setForm(prev => ({ ...prev, ktvCommission }));
  const setStatus = (status: ServiceStatus | ((previous: ServiceStatus) => ServiceStatus)) => {
    setForm(prev => ({
      ...prev,
      status: typeof status === 'function' ? status(prev.status) : status,
    }));
  };

  const resetForm = useCallback(() => {
    setForm(createBlankServiceForm());
    setSelectedService(null);
    setMaterialRows([]);
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const packages = await getPackages();
      setServices(packages);
    } catch (error) {
      console.error('Load data error:', error);
      toast.error('Không thể tải danh sách dịch vụ');
      setServices([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadInventoryItems = useCallback(async () => {
    try {
      const items = await getInventoryItems();
      setInventoryItems(items);
    } catch (error) {
      console.error('Load inventory items error:', error);
      toast.error(getErrorMessage(error, 'Không thể tải danh mục vật tư'));
    }
  }, []);

  const refreshData = useCallback(async () => {
    await Promise.all([loadData(), loadInventoryItems()]);
  }, [loadData, loadInventoryItems]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [refreshData]);

  const openAddModal = useCallback(() => {
    setModalMode('add');
    resetForm();
    setIsModalOpen(true);
  }, [resetForm]);

  const openEditModal = useCallback(async (service: ServicePackage) => {
    setModalMode('edit');
    setSelectedService(service);
    setForm({
      name: service.name,
      price: service.price?.toString() || '',
      duration: service.duration?.replace(/[^\d]/g, '') || '90',
      sessions: service.total_sessions?.toString() || '10',
      offer: service.offer || '',
      details: Array.isArray(service.details) ? service.details.join(', ') : (service.details || ''),
      ktvCommission: service.ktv_commission?.toString() || '150000',
      status: service.status === 'active' ? 'active' : 'inactive',
    });
    setMaterialRows([]);
    setIsModalOpen(true);

    setLoadingMaterials(true);
    try {
      const mats = await getPackageMaterials(service.id);
      const rows: MaterialRow[] = (mats as PackageMaterialWithItem[]).map(m => ({
        item_id: m.item_id || m.inventory_items?.id || '',
        quantity_per_session: Number(m.quantity_per_session) || 0,
        name: m.inventory_items?.name || undefined,
        unit: m.inventory_items?.unit || undefined,
      }));
      setMaterialRows(rows);
    } catch (error) {
      console.error('Load package materials error:', error);
      toast.error('Không tải được định mức tiêu hao của gói');
    } finally {
      setLoadingMaterials(false);
    }
  }, []);

  const addMaterialRow = () => {
    setMaterialRows(prev => [...prev, { item_id: '', quantity_per_session: '' }]);
  };

  const updateMaterialRow = (idx: number, patch: Partial<MaterialRow>) => {
    setMaterialRows(prev => prev.map((row, index) => index === idx ? { ...row, ...patch } : row));
  };

  const removeMaterialRow = (idx: number) => {
    setMaterialRows(prev => prev.filter((_, index) => index !== idx));
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa gói dịch vụ này?')) return;

    setIsLoading(true);
    try {
      const result = await deletePackage(id);
      if (result.error) throw new Error(result.error);

      toast.success('Đã xóa gói dịch vụ');
      void loadData();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Lỗi khi xóa gói dịch vụ: ' + getErrorMessage(error, 'Lỗi hệ thống khi xóa'));
    } finally {
      setIsLoading(false);
    }
  };

  const toggleServiceStatus = async (service: ServicePackage) => {
    const newStatus: ServiceStatus = service.status === 'active' ? 'inactive' : 'active';
    try {
      const result = await updatePackage(service.id, { status: newStatus });
      if (result.error) throw new Error(result.error);

      toast.success(`Đã chuyển trạng thái sang: ${newStatus === 'active' ? 'Đang hoạt động' : 'Tạm ngưng/Bản nháp'} 🌸`);
      setServices(prev => prev.map(item => item.id === service.id ? { ...item, status: newStatus } : item));
    } catch (error) {
      console.error('Toggle status error:', error);
      toast.error('Không thể cập nhật trạng thái: ' + getErrorMessage(error, 'Lỗi không xác định'));
    }
  };

  const getTenantId = async () => {
    const supabase = createBrowserClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw new Error(userError.message);
    if (!user) throw new Error('Vui lòng đăng nhập để thực hiện');

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (profileError) throw new Error(profileError.message);
    if (!profile?.tenant_id) throw new Error('Lỗi hệ thống: Không xác định được Tenant ID');

    return profile.tenant_id;
  };

  const syncDefaultPackages = async () => {
    setIsLoading(true);
    try {
      const tenantId = await getTenantId();
      const defaultPackages = createDefaultPackages(tenantId);
      const existingPackages = await getPackages();

      const existingNames = new Set((existingPackages || []).map(packageRow => packageRow.name));
      const toInsert = defaultPackages.filter(packageRow => !existingNames.has(packageRow.name));

      if (toInsert.length === 0) {
        toast.info('Tất cả các gói mặc định đã tồn tại trong ERP.');
        return;
      }

      for (const packageData of toInsert) {
        const result = await createPackage(packageData);
        if (result.error) throw new Error(result.error);
      }

      toast.success(`Đã đồng bộ ${toInsert.length} gói dịch vụ mặc định làm bản nháp thành công! 🎉`);
      void loadData();
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Lỗi đồng bộ gói dịch vụ: ' + getErrorMessage(error, 'Lỗi không xác định'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const tenantId = await getTenantId();
      const dbData: PackageActionInput = {
        name: form.name,
        price: form.price,
        duration: `${form.duration} phút/buổi`,
        total_sessions: form.sessions,
        details: form.details.split(',').map(detail => detail.trim()).filter(Boolean),
        offer: form.offer || '',
        ktv_commission: form.ktvCommission,
        status: form.status,
        tenant_id: tenantId,
      };

      let packageId: string | null = null;

      if (modalMode === 'edit' && selectedService) {
        const result = await updatePackage(selectedService.id, dbData);
        if (result.error) throw new Error(result.error);
        packageId = selectedService.id;
        toast.success('Đã cập nhật gói dịch vụ');
      } else {
        const result = await createPackage(dbData);
        if (result.error) throw new Error(result.error);
        packageId = result.data?.id || null;
        if (!packageId) throw new Error('Khong xac dinh duoc ma goi dich vu vua tao');
        toast.success('Đã thêm gói dịch vụ mới');
      }

      if (packageId && materialRows.length > 0) {
        const itemIds = materialRows
          .map(row => row.item_id)
          .filter(Boolean);
        const duplicate = itemIds.find((id, index) => itemIds.indexOf(id) !== index);
        if (duplicate) {
          toast.error('Có vật tư bị trùng trong định mức tiêu hao. Vui lòng kiểm tra lại.');
        } else {
          const payload = materialRows
            .filter(row => row.item_id && Number(row.quantity_per_session) > 0)
            .map(row => ({
              item_id: row.item_id,
              quantity_per_session: Number(row.quantity_per_session),
            }));
          const res = await upsertPackageMaterials(packageId, payload);
          if (!res.success) {
            toast.error('Lỗi lưu định mức tiêu hao: ' + (res.error || ''));
          } else if (payload.length > 0) {
            toast.success(`Đã lưu ${payload.length} định mức tiêu hao vật tư cho gói`);
          }
        }
      } else if (packageId && modalMode === 'edit' && materialRows.length === 0) {
        await upsertPackageMaterials(packageId, []);
      }

      setIsModalOpen(false);
      resetForm();
      void loadData();
    } catch (error) {
      console.error('Submit error:', error);
      toast.error('Lỗi khi lưu dữ liệu: ' + getErrorMessage(error, 'Lỗi không xác định'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredServices = useMemo(() => services
    .filter(service => {
      const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (statusFilter === 'all') return matchesSearch;
      return matchesSearch && service.status === statusFilter;
    })
    .sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (a.status !== 'active' && b.status === 'active') return 1;
      return a.name.localeCompare(b.name);
    }), [searchQuery, services, statusFilter]);

  const totalPages = Math.ceil(filteredServices.length / PAGE_SIZE) || 1;
  const paginatedServices = filteredServices.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(currentPage * PAGE_SIZE, filteredServices.length);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return {
    services,
    isLoading,
    isModalOpen,
    setIsModalOpen,
    modalMode,
    selectedService,
    searchQuery,
    setSearchQuery: updateSearchQuery,
    statusFilter,
    setStatusFilter: updateStatusFilter,
    currentPage,
    name: form.name,
    setName,
    price: form.price,
    setPrice,
    duration: form.duration,
    setDuration,
    sessions: form.sessions,
    setSessions,
    offer: form.offer,
    setOffer,
    details: form.details,
    setDetails,
    ktvCommission: form.ktvCommission,
    setKtvCommission,
    status: form.status,
    setStatus,
    isSubmitting,
    inventoryItems,
    materialRows,
    loadingMaterials,
    filteredServices,
    paginatedServices,
    totalPages,
    startIndex,
    endIndex,
    openAddModal,
    openEditModal,
    addMaterialRow,
    updateMaterialRow,
    removeMaterialRow,
    handleDelete,
    toggleServiceStatus,
    syncDefaultPackages,
    handleSubmit,
    handlePageChange,
    refreshData,
  };
}
