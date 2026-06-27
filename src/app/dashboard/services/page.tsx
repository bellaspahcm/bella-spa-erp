'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Tag,
  Clock,
  DollarSign,
  X,
  Zap,
  Database,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { formatMoneyInput } from '@bella/shared';
import { cn, formatNumberWithSeparator, parseDecimalInput, parseIntegerInput,  } from '@/lib/utils';;

import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { usePageRefresh } from '@/hooks/usePageRefresh';
import { useServicesPageState } from './hooks/useServicesPageState';
import { useModuleVocabulary } from '@/hooks/useModuleVocabulary';

export default function ServicesPage() {
  const vocab = useModuleVocabulary();
  const {
    isModalOpen,
    setIsModalOpen,
    modalMode,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    moduleFilter,
    setModuleFilter,
    name,
    setName,
    price,
    setPrice,
    duration,
    setDuration,
    sessions,
    setSessions,
    offer,
    setOffer,
    details,
    setDetails,
    ktvCommission,
    setKtvCommission,
    status,
    setStatus,
    moduleKey,
    setModuleKey,
    serviceKind,
    setServiceKind,
    serviceCategory,
    setServiceCategory,
    defaultDurationMinutes,
    setDefaultDurationMinutes,
    requiresResource,
    setRequiresResource,
    defaultResourceType,
    setDefaultResourceType,
    beforeAfterRequired,
    setBeforeAfterRequired,
    careNoteTemplate,
    setCareNoteTemplate,
    enabledModules,
    hasLoadedTenantModules,
    isBeautySpaEnabled,
    bookingResources,
    loadingResources,
    resourceForm,
    setResourceName,
    setResourceType,
    setResourceStatus,
    setResourceCapacity,
    setResourceLocationNote,
    isSavingResource,
    editBookingResource,
    saveBookingResource,
    removeBookingResource,
    resetResourceForm,
    inventoryItems,
    materialRows,
    loadingMaterials,
    filteredServices,
    paginatedServices,
    totalPages,
    startIndex,
    endIndex,
    currentPage,
    isLoading,
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
  } = useServicesPageState();

  const resourceTypeLabels = {
    bed: 'Giường',
    room: 'Phòng',
    machine: 'Máy',
    chair: 'Ghế',
    other: 'Khác',
  };
  const resourceStatusLabels = {
    available: 'Sẵn sàng',
    in_use: 'Đang dùng',
    maintenance: 'Bảo trì',
    inactive: 'Ngưng dùng',
  };
  const serviceKindLabels = {
    single_service: 'Dịch vụ lẻ',
    treatment_package: 'Liệu trình / gói buổi',
    retail_product: 'Sản phẩm bán lẻ',
    consultation: 'Tư vấn',
  };
  const enabledModuleOptions = [
    ...(enabledModules.babycare
      ? [{ value: 'babycare', label: 'Bella Mother & Baby' }]
      : []),
    ...(enabledModules.beauty_spa
      ? [{ value: 'beauty_spa', label: 'Beauty Spa' }]
      : []),
    ...(enabledModules.industrial_cleaning
      ? [{ value: 'industrial_cleaning', label: 'Industrial Cleaning' }]
      : []),
  ];
  const canManageServices = hasLoadedTenantModules && enabledModuleOptions.length > 0;
  const showModuleFilter = hasLoadedTenantModules && enabledModuleOptions.length > 1;
  const currentModuleLabel = enabledModuleOptions.find(option => option.value === moduleKey)?.label
    || enabledModuleOptions[0]?.label
    || 'Module chưa cấu hình';

  usePageRefresh(refreshData);

  return (
    <div className="flex-1 overflow-auto bg-background/30 p-3 sm:p-6 md:p-10">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Quản lý dịch vụ</h1>
          <p className="text-slate-500 font-medium mt-1">Thiết lập bảng giá và các chương trình ưu đãi</p>
        </div>
        <div className="bella-toolbar flex flex-col gap-3 sm:flex-row">
          {hasLoadedTenantModules && enabledModules.babycare && (
            <button
              onClick={syncDefaultPackages}
              title="Đồng bộ các gói dịch vụ mặc định của Bella Spa từ Landing Page thành các bản nháp trong ERP"
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-700 transition-all hover:bg-slate-50 active:scale-95 sm:px-6"
            >
              <span>Đồng bộ gói mặc định</span>
            </button>
          )}
          <button 
            onClick={openAddModal}
            disabled={!canManageServices}
            title={canManageServices ? undefined : 'Dang tai cau hinh nganh kinh doanh'}
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 font-bold text-white shadow-xl shadow-rose-200 transition-all hover:bg-rose-600 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none dark:shadow-none sm:px-6"
          >
            <Plus className="w-5 h-5" />
            <span>Thêm dịch vụ mới</span>
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bella-toolbar mb-6 flex flex-col gap-3 rounded-3xl border border-slate-100 bg-white p-3 shadow-sm sm:p-4 md:mb-8 lg:flex-row lg:items-center">
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
        <div className="w-full flex-shrink-0 lg:w-64">
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
        {showModuleFilter && (
          <div className="w-full flex-shrink-0 lg:w-72">
            <PremiumSelect
              value={moduleFilter}
              options={[
                { value: 'all', label: 'Tất cả module', icon: <Tag className="h-4 w-4 text-slate-400" /> },
                { value: 'babycare', label: 'Bella Mother & Baby', icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" /> },
                { value: 'beauty_spa', label: 'Beauty Spa', icon: <Sparkles className="h-4 w-4 text-fuchsia-500" /> },
                { value: 'industrial_cleaning', label: 'Industrial Cleaning', icon: <Zap className="h-4 w-4 text-cyan-500" /> },
              ]}
              onChange={(val) => setModuleFilter(val as 'all' | 'babycare' | 'beauty_spa' | 'industrial_cleaning')}
              placeholder="Lọc module..."
            />
          </div>
        )}
      </div>

      {isBeautySpaEnabled && (
        <section className="mb-6 rounded-[2rem] border border-rose-100 bg-white p-4 shadow-sm md:mb-8 md:p-6">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900">Tài nguyên đặt lịch Beauty Spa</h2>
                <p className="text-sm font-semibold text-slate-500">
                  Quản lý giường, phòng, máy hoặc ghế dùng khi triển khai lịch hẹn Beauty Spa.
                </p>
              </div>
            </div>
            {loadingResources && (
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-4 py-2 text-xs font-black text-slate-400">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Đang tải
              </span>
            )}
          </div>

          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">
                  Tên tài nguyên
                </label>
                <input
                  value={resourceForm.name}
                  onChange={(event) => setResourceName(event.target.value)}
                  className="w-full rounded-2xl border border-slate-100 bg-white px-5 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-rose-300 focus:ring-4 focus:ring-rose-50"
                  placeholder="VD: Giường Facial 01"
                />
              </div>
              <div className="space-y-2">
                <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">
                  Loại
                </label>
                <PremiumSelect
                  value={resourceForm.resourceType}
                  onChange={(value) => setResourceType(value as keyof typeof resourceTypeLabels)}
                  options={Object.entries(resourceTypeLabels).map(([value, label]) => ({ value, label }))}
                  placeholder="Chọn loại"
                />
              </div>
              <div className="space-y-2">
                <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">
                  Trạng thái
                </label>
                <PremiumSelect
                  value={resourceForm.status}
                  onChange={(value) => setResourceStatus(value as keyof typeof resourceStatusLabels)}
                  options={Object.entries(resourceStatusLabels).map(([value, label]) => ({ value, label }))}
                  placeholder="Chọn trạng thái"
                />
              </div>
              <div className="space-y-2">
                <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">
                  Sức chứa
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={resourceForm.capacity}
                  onChange={(event) => setResourceCapacity(event.target.value)}
                  className="w-full rounded-2xl border border-slate-100 bg-white px-5 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-rose-300 focus:ring-4 focus:ring-rose-50"
                />
              </div>
              <div className="space-y-2">
                <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">
                  Ghi chú vị trí
                </label>
                <input
                  value={resourceForm.locationNote}
                  onChange={(event) => setResourceLocationNote(event.target.value)}
                  className="w-full rounded-2xl border border-slate-100 bg-white px-5 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-rose-300 focus:ring-4 focus:ring-rose-50"
                  placeholder="VD: Tầng 2"
                />
              </div>
              <div className="flex flex-col gap-2 md:col-span-2 sm:flex-row">
                <button
                  type="button"
                  onClick={saveBookingResource}
                  disabled={isSavingResource || !resourceForm.name.trim()}
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white shadow-lg shadow-rose-200 transition hover:bg-rose-600 disabled:opacity-50"
                >
                  {isSavingResource && <RefreshCw className="h-4 w-4 animate-spin" />}
                  {resourceForm.id ? 'Cập nhật tài nguyên' : 'Thêm tài nguyên'}
                </button>
                {resourceForm.id && (
                  <button
                    type="button"
                    onClick={resetResourceForm}
                    className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-500 transition hover:text-slate-800"
                  >
                    Hủy sửa
                  </button>
                )}
              </div>
            </div>

            <div className="min-w-0 overflow-x-auto overscroll-x-contain custom-scrollbar rounded-2xl border border-slate-100 bg-white">
              <table className="bella-data-table min-w-[680px] w-full text-left">
                <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <tr>
                    <th className="px-5 py-3">Tài nguyên</th>
                    <th className="px-5 py-3">Loại</th>
                    <th className="px-5 py-3">Trạng thái</th>
                    <th className="px-5 py-3">Sức chứa</th>
                    <th className="px-5 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm font-bold text-slate-700">
                  {bookingResources.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-xs font-bold italic text-slate-400">
                        Chưa có giường/phòng/máy nào. Thêm tài nguyên đầu tiên để chuẩn bị pilot Beauty Spa.
                      </td>
                    </tr>
                  ) : bookingResources.map((resource) => (
                    <tr key={resource.id}>
                      <td className="px-5 py-4">
                        <div className="text-slate-900">{resource.name}</div>
                        {resource.location_note && (
                          <div className="mt-1 text-xs text-slate-400">{resource.location_note}</div>
                        )}
                      </td>
                      <td className="px-5 py-4">{resourceTypeLabels[resource.resource_type as keyof typeof resourceTypeLabels] || 'Khác'}</td>
                      <td className="px-5 py-4">
                        <span className={cn(
                          'rounded-full px-3 py-1 text-[10px] font-black uppercase',
                          resource.status === 'available'
                            ? 'bg-emerald-50 text-emerald-600'
                            : resource.status === 'maintenance'
                              ? 'bg-amber-50 text-amber-600'
                              : 'bg-slate-100 text-slate-500',
                        )}>
                          {resourceStatusLabels[resource.status as keyof typeof resourceStatusLabels] || resource.status}
                        </span>
                      </td>
                      <td className="px-5 py-4">{resource.capacity}</td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => editBookingResource(resource)}
                            className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-black text-slate-500 transition hover:text-primary"
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            onClick={() => removeBookingResource(resource.id)}
                            className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-500 transition hover:bg-rose-100"
                          >
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Services Grid */}
      {isLoading ? (
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <RefreshCw className="h-12 w-12 animate-spin text-primary" />
            <p className="text-sm font-bold text-slate-500">Đang tải danh sách dịch vụ...</p>
          </div>
        </div>
      ) : paginatedServices.length === 0 ? (
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
              <Sparkles className="h-10 w-10 text-slate-400" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Chưa có dịch vụ nào</h3>
              <p className="mt-1 text-sm font-medium text-slate-500">
                Bấm "Thêm dịch vụ mới" để tạo gói dịch vụ đầu tiên
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:gap-6">
          {paginatedServices.map((service, idx) => (
          <motion.div 
            key={service.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="group luxury-card-white relative flex h-full flex-col overflow-hidden rounded-[2rem] transition-all lg:flex-row lg:rounded-[2.5rem]"
          >
            {/* Visual Section */}
            <div className="relative flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-rose-200 to-pink-300 p-5 dark:from-[#2D1620] dark:to-[#1A0A10] dark:border-r dark:border-[#3E3A35]/30 sm:p-8 lg:w-48">
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
            <div className="flex flex-1 flex-col p-5 sm:p-8">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="break-words text-lg font-black text-slate-900 sm:text-xl">{service.name}</h3>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border",
                      service.status === 'active' 
                        ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                        : "bg-slate-100 text-slate-400 border-slate-200"
                    )}>
                      {service.status === 'active' ? 'Đang hoạt động' : 'Tạm ngưng / Nháp'}
                    </span>
                    {service.module_key === 'beauty_spa' && (
                      <span className="rounded-full border border-fuchsia-100 bg-fuchsia-50 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-fuchsia-600">
                        Beauty Spa
                      </span>
                    )}
                  </div>
                  <div className="flex min-w-0 items-center gap-2 text-lg font-black text-primary">
                    <DollarSign className="w-4 h-4" />
                    <span className="break-words">{formatNumberWithSeparator(service.price ?? 0)}đ</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 sm:gap-3">
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
                <div className="flex min-w-0 items-center gap-3 rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-500">
                  <Clock className="h-4 w-4 shrink-0 text-primary" />
                  <span className="break-words">Thời lượng: {service.duration}</span>
                </div>
                {service.module_key === 'beauty_spa' && (
                  <div className="flex flex-wrap gap-2 text-xs font-black">
                    <span className="rounded-xl bg-fuchsia-50 px-3 py-1.5 text-fuchsia-600">
                      {serviceKindLabels[service.service_kind as keyof typeof serviceKindLabels] || 'Liệu trình'}
                    </span>
                    {service.service_category && (
                      <span className="rounded-xl bg-slate-50 px-3 py-1.5 text-slate-500">
                        {service.service_category}
                      </span>
                    )}
                    {service.requires_resource && (
                      <span className="rounded-xl bg-amber-50 px-3 py-1.5 text-amber-600">
                        Cần {resourceTypeLabels[service.default_resource_type as keyof typeof resourceTypeLabels] || 'tài nguyên'}
                      </span>
                    )}
                    {service.before_after_required && (
                      <span className="rounded-xl bg-sky-50 px-3 py-1.5 text-sky-600">
                        Ảnh trước/sau
                      </span>
                    )}
                  </div>
                )}
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Chi tiết dịch vụ</p>
                  <div className="flex flex-wrap gap-2">
                    {Array.isArray(service.details) ? service.details.map((detail: string, i: number) => (
                      <span key={i} className="break-words rounded-xl border border-slate-100 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600">
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
                <div className="min-w-0 break-words text-xs font-bold leading-relaxed text-rose-600">
                  <span className="uppercase text-[10px] block opacity-60 mb-0.5">Ưu đãi hiện có</span>
                  {service.offer}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-10 flex flex-col items-center justify-between gap-6 md:flex-row">
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">
            Hiển thị <span className="text-slate-900">{startIndex}-{endIndex}</span> trên tổng số <span className="text-slate-900">{filteredServices.length}</span> gói dịch vụ
          </p>
          
          <div className="bella-pagination">
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
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
              className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl sm:rounded-[3rem]"
            >
              <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
                {/* Header */}
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 bg-white p-5 pb-4 sm:p-10 sm:pb-6">
                  <div className="flex min-w-0 items-center gap-3 sm:gap-5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.25rem] bg-primary text-white shadow-2xl shadow-rose-200 dark:shadow-none sm:h-14 sm:w-14 sm:rounded-[1.5rem]">
                      <Zap className="w-7 h-7" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="break-words text-xl font-black tracking-tight text-slate-900 sm:text-3xl">
                        {modalMode === 'add' ? 'Thêm dịch vụ' : 'Chỉnh sửa dịch vụ'}
                      </h2>
                      <p className="text-slate-500 font-bold">
                        {modalMode === 'add' ? `Tạo ${vocab.package.singular.toLowerCase()} mới cho khách hàng` : `Cập nhật thông tin ${vocab.package.singular.toLowerCase()}`}
                      </p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="p-3 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 space-y-5 overflow-y-auto p-5 scrollbar-thin sm:space-y-6 sm:p-10 sm:py-6">
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
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
                        onChange={(e) => setPrice(formatMoneyInput(e.target.value))}
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
                      <label className="text-sm font-black text-slate-700 ml-1">Số {vocab.workUnit.plural.toLowerCase()} trong {vocab.package.singular.toLowerCase()}</label>
                      <input 
                        type="number" 
                        required
                        value={sessions}
                        onChange={(e) => {
                          const value = e.target.value;
                          setSessions(value === '' ? '' : String(parseIntegerInput(value, { min: 1, max: 100, fallback: 1 })));
                        }}
                        className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-primary/10 outline-none font-bold text-slate-700" 
                        placeholder="VD: 15" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-black text-slate-700 ml-1">Hoa hồng {vocab.worker.short} (VNĐ/{vocab.workUnit.singular.toLowerCase()})</label>
                      <input 
                        type="text" 
                        required
                        value={formatMoneyInput(ktvCommission)}
                        onChange={(e) => setKtvCommission(formatMoneyInput(e.target.value))}
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
                      placeholder={
                        vocab.worker.short === 'NVS' 
                          ? 'VD: Vệ sinh sàn nhà, Lau kính, Dọn toilet' 
                          : 'VD: Massage body, Chăm sóc da mặt, Xông hơi'
                      } 
                    />
                  </div>

                  {isBeautySpaEnabled && (
                    <div className="space-y-4 rounded-2xl border border-fuchsia-100 bg-gradient-to-br from-fuchsia-50/60 to-rose-50/50 p-4 sm:p-6">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary shadow-sm">
                          <Sparkles className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-900">Cấu hình Beauty Spa</h4>
                          <p className="mt-0.5 text-[11px] font-semibold leading-relaxed text-slate-500">
                            Chỉ dùng cho dịch vụ beauty. Gói Bella Mother & Baby giữ cấu hình mặc định.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">
                            Module
                          </label>
                          {enabledModuleOptions.length > 1 ? (
                            <PremiumSelect
                              value={moduleKey}
                              onChange={(value) => setModuleKey(value === 'beauty_spa' ? 'beauty_spa' : 'babycare')}
                              options={enabledModuleOptions}
                              placeholder="Chọn module"
                            />
                          ) : (
                            <div className="flex min-h-14 items-center rounded-2xl bg-white px-5 py-4 text-sm font-black text-slate-800 shadow-sm">
                              {currentModuleLabel}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">
                            Loại dịch vụ
                          </label>
                          <PremiumSelect
                            value={serviceKind}
                            onChange={(value) => setServiceKind(value as keyof typeof serviceKindLabels)}
                            options={Object.entries(serviceKindLabels).map(([value, label]) => ({ value, label }))}
                            placeholder="Chọn loại dịch vụ"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">
                            Nhóm dịch vụ
                          </label>
                          <input
                            value={serviceCategory}
                            onChange={(event) => setServiceCategory(event.target.value)}
                            className="w-full rounded-2xl border-none bg-white px-5 py-4 text-sm font-bold text-slate-700 outline-none transition focus:ring-4 focus:ring-primary/10"
                            placeholder="VD: facial, body, laser"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">
                            Thời lượng chuẩn (phút)
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={1440}
                            value={defaultDurationMinutes}
                            onChange={(event) => setDefaultDurationMinutes(event.target.value)}
                            className="w-full rounded-2xl border-none bg-white px-5 py-4 text-sm font-bold text-slate-700 outline-none transition focus:ring-4 focus:ring-primary/10"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="rounded-2xl bg-white p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-sm font-black text-slate-800">Cần giường/phòng/máy</p>
                              <p className="mt-1 text-xs font-bold text-slate-400">Dùng khi lên lịch Beauty Spa sau này.</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setRequiresResource(!requiresResource)}
                              disabled={moduleKey !== 'beauty_spa'}
                              className={cn(
                                'relative inline-flex h-6 w-11 shrink-0 rounded-full transition disabled:opacity-40',
                                requiresResource && moduleKey === 'beauty_spa' ? 'bg-primary' : 'bg-slate-300',
                              )}
                            >
                              <span
                                className={cn(
                                  'inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition',
                                  requiresResource && moduleKey === 'beauty_spa' ? 'translate-x-5' : 'translate-x-0.5',
                                )}
                              />
                            </button>
                          </div>
                          {requiresResource && moduleKey === 'beauty_spa' && (
                            <div className="mt-3">
                              <PremiumSelect
                                value={defaultResourceType}
                                onChange={(value) => setDefaultResourceType(value as keyof typeof resourceTypeLabels)}
                                options={Object.entries(resourceTypeLabels).map(([value, label]) => ({ value, label }))}
                                placeholder="Tài nguyên mặc định"
                              />
                            </div>
                          )}
                        </div>

                        <div className="rounded-2xl bg-white p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-sm font-black text-slate-800">Cần ảnh trước/sau</p>
                              <p className="mt-1 text-xs font-bold text-slate-400">Đánh dấu dịch vụ cần theo dõi kết quả.</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setBeforeAfterRequired(!beforeAfterRequired)}
                              disabled={moduleKey !== 'beauty_spa'}
                              className={cn(
                                'relative inline-flex h-6 w-11 shrink-0 rounded-full transition disabled:opacity-40',
                                beforeAfterRequired && moduleKey === 'beauty_spa' ? 'bg-primary' : 'bg-slate-300',
                              )}
                            >
                              <span
                                className={cn(
                                  'inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition',
                                  beforeAfterRequired && moduleKey === 'beauty_spa' ? 'translate-x-5' : 'translate-x-0.5',
                                )}
                              />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">
                          Mẫu ghi chú chăm sóc
                        </label>
                        <textarea
                          value={careNoteTemplate}
                          onChange={(event) => setCareNoteTemplate(event.target.value)}
                          className="h-20 w-full resize-none rounded-2xl border-none bg-white px-5 py-4 text-sm font-bold text-slate-700 outline-none transition focus:ring-4 focus:ring-primary/10"
                          placeholder="VD: Tình trạng da, phản ứng sau buổi, lưu ý lần hẹn tiếp theo..."
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <span className="text-sm font-black text-slate-700 block">Kích hoạt {vocab.package.singular.toLowerCase()}</span>
                      <span className="text-xs text-slate-400 font-bold">
                        {vocab.worker.short === 'NVS' 
                          ? 'Kích hoạt để hiển thị gói dịch vụ này trong danh sách'
                          : 'Kích hoạt để gói hiển thị trực tiếp trên trang chủ Landing Page'
                        }
                      </span>
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
                  <div className="space-y-4 rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50/40 to-pink-50/40 p-4 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-primary shadow-sm">
                          <Database className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-black text-slate-900">Định mức tiêu hao vật tư mỗi {vocab.workUnit.singular.toLowerCase()}</h4>
                          <p className="text-[11px] text-slate-500 font-semibold leading-relaxed mt-0.5">
                            Hệ thống sẽ tự trừ kho theo định mức này khi {vocab.worker.short} hoàn thành {vocab.workUnit.singular.toLowerCase()} <span className="text-rose-500">(nếu bật ở Cài đặt → Quản lý Tiêu hao Kho vận)</span>.
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
                                  Chưa có vật tư nào trong định mức. Bấm &quot;+ Thêm vật tư&quot; để bắt đầu.
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {/* Header */}
                                  <div className="hidden lg:grid grid-cols-[1fr_140px_60px_40px] gap-3 px-3 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                    <span>Vật tư</span>
                                    <span>SL / {vocab.workUnit.singular.toLowerCase()}</span>
                                    <span>Đơn vị</span>
                                    <span></span>
                                  </div>
                                  {materialRows.map((row, idx) => {
                                    const item = inventoryItems.find(it => it.id === row.item_id);
                                    return (
                                      <div key={idx} className="grid grid-cols-1 items-center gap-3 rounded-xl border border-rose-100 bg-white p-3 lg:grid-cols-[1fr_140px_60px_40px]">
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
                                            quantity_per_session: e.target.value === '' ? '' : parseDecimalInput(e.target.value, { min: 0 }),
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

                </div>

                {/* Footer */}
                <div className="flex shrink-0 flex-col gap-3 border-t border-slate-100 bg-slate-50/50 p-5 sm:flex-row sm:gap-4 sm:p-10 sm:pt-6">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black rounded-[2rem] transition-all uppercase tracking-widest text-xs">
                    Hủy bỏ
                  </button>
                  <button type="submit" className="flex-1 py-5 bg-primary hover:bg-rose-600 text-white font-black rounded-[2rem] shadow-2xl shadow-rose-200 dark:shadow-none transition-all uppercase tracking-widest text-xs">
                    {modalMode === 'add' ? 'Lưu dịch vụ' : 'Cập nhật dịch vụ'}
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
