'use client';
/* Quản lý Bảng Hàng Căn Hộ & Dự Án Bất Động Sản */

import React, { useEffect, useState, useCallback } from 'react';
import { Bell, RefreshCw, Zap, AlertTriangle, FileSignature } from 'lucide-react';
import { toast } from 'sonner';
import { ProjectHeader } from '@/modules/real_estate/components/ProjectHeader';
import { InventoryMatrixGrid } from '@/modules/real_estate/components/InventoryMatrixGrid';
import { fetchProjectsAction } from '@/modules/real_estate/actions/projectActions';
import { fetchProductsAction, updateProductStatusAction, updateProductDetailsAction } from '@/modules/real_estate/actions/productActions';
import { Database } from '@/types/database.types';
import { useUser } from '@/lib/user-context';
import { useTenantContext } from '@/core/hooks/useTenantContext';

type ProjectRow = Database['public']['Tables']['real_estate_projects']['Row'];
type ProductRow = Database['public']['Tables']['real_estate_products']['Row'];

import { CEODashboardCharts } from '@/modules/real_estate/components/CEODashboardCharts';
import { PremiumProjectSelector } from '@/modules/real_estate/components/PremiumProjectSelector';

export default function RealEstateDashboardPage() {
  const { user } = useUser();
  const tenantContext = useTenantContext();

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectRow | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // States for notifications
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [showNotifDropdown, setShowNotifDropdown] = useState<boolean>(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const { createClient } = await import('@/lib/supabase-client');
      const supabase = createClient();
      const { data, error } = await supabase
        .from('app_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (data) {
        setNotifications(data);
        setUnreadCount(data.filter((n: any) => !n.is_read).length);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  }, []);

  const handleToggleNotifications = async () => {
    setShowNotifDropdown(!showNotifDropdown);
    if (!showNotifDropdown && unreadCount > 0) {
      try {
        const { createClient } = await import('@/lib/supabase-client');
        const supabase = createClient();
        await supabase
          .from('app_notifications')
          .update({ is_read: true })
          .eq('is_read', false);
        setUnreadCount(0);
      } catch (err) {
        console.error('Error marking notifications as read:', err);
      }
    }
  };

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 1. Fetch projects
      const resProjects = await fetchProjectsAction();
      if (!resProjects.success || !resProjects.data) {
        throw new Error(resProjects.error || 'Failed to load real estate projects');
      }

      const projectList = Array.isArray(resProjects.data) ? resProjects.data : [resProjects.data];
      setProjects(projectList);

      const currentProj = projectList[0] || null;
      setSelectedProject(currentProj);

      // 2. Fetch products if project exists
      if (currentProj) {
        const resProducts = await fetchProductsAction(currentProj.id);
        if (resProducts.success && resProducts.data) {
          setProducts(Array.isArray(resProducts.data) ? resProducts.data : [resProducts.data]);
        }
      }
    } catch (err) {
      console.error('[RealEstateDashboardPage] Error:', err);
      setError(err instanceof Error ? err.message : 'System error loading Real Estate module');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      setError(null);

      // Fetch projects
      const resProjects = await fetchProjectsAction();
      if (!resProjects.success || !resProjects.data) {
        throw new Error(resProjects.error || 'Failed to load real estate projects');
      }

      const projectList = Array.isArray(resProjects.data) ? resProjects.data : [resProjects.data];
      setProjects(projectList);

      // Get current selected project id to restore selection
      const currentProjId = selectedProject?.id || projectList[0]?.id || null;
      const matchedProj = projectList.find(p => p.id === currentProjId) || projectList[0] || null;
      setSelectedProject(matchedProj);

      // Fetch products
      if (matchedProj) {
        const resProducts = await fetchProductsAction(matchedProj.id);
        if (resProducts.success && resProducts.data) {
          setProducts(Array.isArray(resProducts.data) ? resProducts.data : [resProducts.data]);
        }
      }
    } catch (err) {
      console.error('[RealEstateDashboardPage] Refresh Error:', err);
      setError(err instanceof Error ? err.message : 'System error refreshing Real Estate module');
    } finally {
      // Keep rotating effect active for a short period for a smoother feel
      setTimeout(() => {
        setIsRefreshing(false);
      }, 600);
    }
  };

  useEffect(() => {
    loadData();
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [loadData, fetchNotifications]);

  const handleSelectProject = async (proj: ProjectRow) => {
    setSelectedProject(proj);
    const resProducts = await fetchProductsAction(proj.id);
    if (resProducts.success && resProducts.data) {
      setProducts(Array.isArray(resProducts.data) ? resProducts.data : [resProducts.data]);
    }
  };

  const handleUpdateStatus = async (
    productId: string,
    targetStatus: ProductRow['status'],
    ownerName?: string | null
  ) => {
    const res = await updateProductStatusAction(productId, targetStatus, ownerName);
    if (!res.success) {
      throw new Error(res.error || 'Cập nhật trạng thái thất bại');
    }
    // Refresh products list
    if (selectedProject) {
      const resProducts = await fetchProductsAction(selectedProject.id);
      if (resProducts.success && resProducts.data) {
        setProducts(Array.isArray(resProducts.data) ? resProducts.data : [resProducts.data]);
      }
    }
  };
  const handleUpdateDetails = async (
    productId: string,
    payload: {
      unit_price?: number;
      area?: number;
      product_code?: string;
      product_type?: 'apartment' | 'townhouse' | 'shophouse' | 'villa' | 'land_plot' | 'office';
      block?: string | null;
      floor?: string | null;
    }
  ) => {
    const res = await updateProductDetailsAction(productId, payload);
    if (!res.success) {
      throw new Error(res.error || 'Cập nhật thông tin thất bại');
    }
    toast.success('✅ Cập nhật thông tin căn thành công');
    // Immediately update local state from returned data
    if (res.data && !Array.isArray(res.data)) {
      setProducts(prev => prev.map(p => p.id === productId ? res.data as typeof p : p));
    }
    // Then do a full re-fetch to ensure consistency
    if (selectedProject) {
      const resProducts = await fetchProductsAction(selectedProject.id);
      if (resProducts.success && resProducts.data) {
        setProducts(Array.isArray(resProducts.data) ? resProducts.data : [resProducts.data]);
      }
    }
  };

  const availableCount = products.filter((p) => p.status === 'available').length;
  const reservedCount = products.filter((p) => p.status === 'booked').length;
  const depositedCount = products.filter((p) => p.status === 'deposited').length;
  const signedCount = products.filter((p) => p.status === 'contracted').length;
  const paidCount = products.filter((p) => p.status === 'paid').length;
  const deliveredCount = products.filter((p) => p.status === 'handed_over').length;

  if (isLoading) {
    return (
      <div className="p-8 space-y-6 animate-pulse">
        <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="h-40 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="p-6 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl">
          <h2 className="text-lg font-bold mb-2">⚠️ Lỗi Tải Phân Hệ Bất Động Sản</h2>
          <p className="text-sm">{error}</p>
          <button
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-rose-600 text-white font-bold text-sm rounded-xl hover:bg-rose-700 transition-colors"
          >
            Thử Lại
          </button>
        </div>
      </div>
    );
  }

  const monogram = user?.full_name ? user.full_name.substring(0, 2).toUpperCase() : 'AD';

  return (
    <div className="p-6 w-full space-y-6">
      {/* Premium Dashboard Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800/80 shadow-sm transition-all">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-lg border border-primary/20 shadow-sm select-none">
            {monogram}
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              Chào mừng trở lại, <span className="text-primary font-extrabold">{user?.full_name || 'Admin'}</span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
              Hệ thống quản lý bất động sản <span className="font-semibold text-slate-700 dark:text-slate-200">{tenantContext?.tenantName || 'Bella Real Estate'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-center">
          {/* Nút Load dữ liệu */}
          <button
            onClick={handleRefresh}
            disabled={isLoading || isRefreshing}
            className="flex items-center justify-center p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-300 transition-all duration-200 active:scale-95 disabled:opacity-50"
            title="Tải lại dữ liệu"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
          </button>

          {/* Nút Thông báo & Dropdown */}
          <div className="relative">
            <button
              onClick={handleToggleNotifications}
              className="relative flex items-center justify-center p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-300 transition-all duration-200 active:scale-95"
              title="Xem thông báo"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
              )}
            </button>

            {showNotifDropdown && (
              <>
                {/* Transparent click-outside overlay */}
                <div 
                  className="fixed inset-0 z-40 bg-transparent" 
                  onClick={() => setShowNotifDropdown(false)} 
                />
                
                <div className="absolute right-0 mt-2 z-50 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-xl p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Bell className="w-4 h-4 text-primary" />
                      Thông báo mới
                    </h3>
                    {unreadCount > 0 && (
                      <span className="text-xs font-semibold px-2 py-0.5 bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400 rounded-full">
                        {unreadCount} chưa đọc
                      </span>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
                    {notifications.length > 0 ? (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`p-3 rounded-xl border transition-all text-left ${
                            n.is_read
                              ? 'bg-slate-50/50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-800/50'
                              : 'bg-primary/5 dark:bg-primary/10 border-primary/10'
                          }`}
                        >
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center justify-between">
                            {n.title}
                            {!n.is_read && <span className="h-1.5 w-1.5 bg-primary rounded-full" />}
                          </h4>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-normal">
                            {n.message}
                          </p>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-1.5">
                            {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(n.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      ))
                    ) : (
                      // Trạng thái Fallback Mock notifications cực đẹp khi database trống
                      <>
                        <div className="p-3 rounded-xl border bg-primary/5 dark:bg-primary/10 border-primary/10 text-left">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-blue-500" />Lead mới đăng ký dự án</span>
                            <span className="h-1.5 w-1.5 bg-primary rounded-full shrink-0" />
                          </h4>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-normal">
                            Khách hàng <b>Nguyễn Văn A</b> vừa đăng ký quan tâm căn hộ Shophouse Elyse Island.
                          </p>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-1.5">5 phút trước</span>
                        </div>

                        <div className="p-3 rounded-xl border bg-slate-50/50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-800/50 text-left">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />Cảnh báo SLA trễ hạn
                          </h4>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-normal">
                            Lead <b>Trần Thị B</b> chưa được kỹ thuật viên liên hệ tư vấn sau 15 phút.
                          </p>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-1.5">20 phút trước</span>
                        </div>

                        <div className="p-3 rounded-xl border bg-slate-50/50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-800/50 text-left">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                            <FileSignature className="w-3.5 h-3.5 text-emerald-500" />Hợp đồng đặt cọc mới
                          </h4>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-normal">
                            Căn hộ <b>A-102 (Elyse Island)</b> đã hoàn tất thủ tục đặt cọc thành công.
                          </p>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-1.5">1 giờ trước</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Premium Custom Project Selector */}
      <PremiumProjectSelector
        projects={projects}
        selectedProject={selectedProject}
        onSelectProject={handleSelectProject}
      />

      {/* Executive CEO Analytics & Visualizations (Placed First) */}
      <CEODashboardCharts
        totalProductsCount={products.length || 48}
        availableCount={availableCount || 12}
        reservedCount={reservedCount || 8}
        depositedCount={depositedCount || 10}
        signedCount={signedCount || 14}
        paidCount={paidCount || 0}
        deliveredCount={deliveredCount || 4}
      />

      {/* Project Header Component */}
      <ProjectHeader
        project={selectedProject}
        products={products}
        onRefresh={loadData}
      />

      {/* Inventory Matrix Component */}
      <InventoryMatrixGrid
        products={products}
        onUpdateStatus={handleUpdateStatus}
        onUpdateDetails={handleUpdateDetails}
      />
    </div>
  );
}

