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
import { cn, formatNumberWithSeparator } from '@/lib/utils';

import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { useServicesPageState } from './hooks/useServicesPageState';

export default function ServicesPage() {
  const {
    isModalOpen,
    setIsModalOpen,
    modalMode,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
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
    inventoryItems,
    materialRows,
    loadingMaterials,
    filteredServices,
    paginatedServices,
    totalPages,
    startIndex,
    endIndex,
    currentPage,
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
  } = useServicesPageState();

  return (
    <div className="flex-1 overflow-auto bg-background/30 p-3 sm:p-6 md:p-10">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Quản lý dịch vụ</h1>
          <p className="text-slate-500 font-medium mt-1">Thiết lập bảng giá và các chương trình ưu đãi</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button 
            onClick={syncDefaultPackages}
            title="Đồng bộ các gói dịch vụ mặc định của Bella Spa từ Landing Page thành các bản nháp trong ERP"
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-700 transition-all hover:bg-slate-50 active:scale-95 sm:px-6"
          >
            <span>Đồng bộ gói mặc định</span>
          </button>
          <button 
            onClick={openAddModal}
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 font-bold text-white shadow-xl shadow-rose-200 transition-all hover:bg-rose-600 active:scale-95 dark:shadow-none sm:px-6"
          >
            <Plus className="w-5 h-5" />
            <span>Thêm dịch vụ mới</span>
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="mb-6 flex flex-col gap-3 rounded-3xl border border-slate-100 bg-white p-3 shadow-sm sm:p-4 md:mb-8 lg:flex-row lg:items-center">
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
      </div>

      {/* Services Grid */}
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

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-10 flex flex-col items-center justify-between gap-6 md:flex-row">
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">
            Hiển thị <span className="text-slate-900">{startIndex}-{endIndex}</span> trên tổng số <span className="text-slate-900">{filteredServices.length}</span> gói dịch vụ
          </p>
          
          <div className="flex max-w-full items-center gap-2 overflow-x-auto pb-1">
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
                        {modalMode === 'add' ? 'Tạo gói liệu trình mới cho khách hàng' : 'Cập nhật thông tin gói dịch vụ'}
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

                  <div className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
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
                  <div className="space-y-4 rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50/40 to-pink-50/40 p-4 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-primary shadow-sm">
                          <Database className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
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
                                  Chưa có vật tư nào trong định mức. Bấm &quot;+ Thêm vật tư&quot; để bắt đầu.
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {/* Header */}
                                  <div className="hidden lg:grid grid-cols-[1fr_140px_60px_40px] gap-3 px-3 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                    <span>Vật tư</span>
                                    <span>SL / buổi</span>
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
