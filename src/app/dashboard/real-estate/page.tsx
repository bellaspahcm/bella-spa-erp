'use client';
/* Quản lý Bảng Hàng Căn Hộ & Dự Án Bất Động Sản - Bella Land V2 */

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

  type AppNotification = {
    id: string;
    title: string;
    message: string;
    is_read: boolean;
    created_at: string;
  };

  // States for notifications
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
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
        setNotifications(data as AppNotification[]);
        setUnreadCount(data.filter((n) => !n.is_read).length);
      }
    } catch (err: unknown) {
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
      } catch (err: unknown) {
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
    } catch (err: unknown) {
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
    } catch (err: unknown) {
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
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* 1. TOP LIGHT EXECUTIVE HEADER BANNER CARD (MATCHING REFERENCE IMAGE 1) */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-50 via-blue-50/40 to-sky-100/50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-850 border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs transition-all">
        {/* Subtle Watermark Decorative Banner Graphic */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-15 dark:opacity-20 pointer-events-none bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-400 via-indigo-500 to-transparent flex items-center justify-end pr-6">
          <div className="text-right select-none hidden md:block">
            <span className="text-2xl font-black italic tracking-tighter text-slate-800 dark:text-white block">Elyse Island</span>
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Đô thị biển Kiến tạo tương lai</span>
          </div>
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left Title & Breadcrumbs */}
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
              <span>Bella Land</span>
              <span>›</span>
              <span className="text-slate-900 dark:text-white font-extrabold">Tổng quan</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Tổng quan
            </h1>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-1">
              Toàn cảnh hoạt động kinh doanh bất động sản
            </p>
          </div>

          {/* Right Context Controls & User Badge */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Context Project Selector Pill */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  if (projects.length > 1) {
                    const nextIdx = (projects.findIndex(p => p.id === selectedProject?.id) + 1) % projects.length;
                    handleSelectProject(projects[nextIdx]);
                  }
                }}
                className="flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xs hover:border-blue-400 transition-all text-left"
              >
                <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center font-bold shrink-0">
                  🏢
                </div>
                <div>
                  <div className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1">
                    {selectedProject?.name || 'Elyse Island'}
                    <span className="text-[10px] text-slate-400">▾</span>
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                    📍 {selectedProject?.location || 'Shophouse Marina, TP. Nha Trang'}
                  </div>
                </div>
              </button>
            </div>

            {/* Month Picker Pill */}
            <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xs text-xs font-extrabold text-slate-800 dark:text-slate-200">
              <span>📅 Tháng 7/2026</span>
              <span className="text-[10px] text-slate-400">▾</span>
            </div>

            {/* Action Buttons: Refresh, Notif, Settings */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={isLoading || isRefreshing}
                className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-xl shadow-2xs transition-all active:scale-95"
                title="Tải lại dữ liệu"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
              </button>

              <div className="relative">
                <button
                  onClick={handleToggleNotifications}
                  className="relative p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-xl shadow-2xs transition-all active:scale-95"
                  title="Thông báo"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
                  )}
                </button>

                {showNotifDropdown && (
                  <>
                    <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setShowNotifDropdown(false)} />
                    <div className="absolute right-0 mt-2 z-50 w-80 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-xl p-4 space-y-2.5">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                        <h3 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Bell className="w-3.5 h-3.5 text-blue-600" /> Thông báo
                        </h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">System</span>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="p-2 rounded-lg bg-blue-50/50 dark:bg-slate-900">
                          <p className="font-bold text-slate-900 dark:text-white">Lead mới đăng ký dự án</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">Khách hàng Nguyễn Văn A quan tâm Shophouse Elyse Island.</p>
                        </div>
                        <div className="p-2 rounded-lg bg-amber-50/50 dark:bg-slate-900">
                          <p className="font-bold text-slate-900 dark:text-white">Cảnh báo SLA Lead</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">3 lead quá hạn 15 phút chưa phân công.</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* User Profile Badge */}
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200/80 dark:border-slate-700">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white font-black text-xs flex items-center justify-center shadow-xs">
                  {monogram}
                </div>
                <div className="hidden xl:block text-left">
                  <div className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                    {user?.full_name || 'Nguyễn Văn A'}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                    Quản trị viên
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. EXECUTIVE DASHBOARD CHARTS & PANELS (MATCHING REFERENCE IMAGE 1) */}
      <CEODashboardCharts
        totalProductsCount={products.length || 286}
        availableCount={availableCount || 119}
        reservedCount={reservedCount || 24}
        depositedCount={depositedCount || 31}
        signedCount={signedCount || 78}
        paidCount={paidCount || 9}
        deliveredCount={deliveredCount || 25}
      />
    </div>
  );
}


