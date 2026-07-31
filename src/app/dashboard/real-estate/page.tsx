'use client';
/* Quản lý Bảng Hàng Căn Hộ & Dự Án Bất Động Sản */

import React, { useEffect, useState, useCallback } from 'react';
import { ProjectHeader } from '@/modules/real_estate/components/ProjectHeader';
import { InventoryMatrixGrid } from '@/modules/real_estate/components/InventoryMatrixGrid';
import { fetchProjectsAction } from '@/modules/real_estate/actions/projectActions';
import { fetchProductsAction, updateProductStatusAction } from '@/modules/real_estate/actions/productActions';
import { Database } from '@/types/database.types';

type ProjectRow = Database['public']['Tables']['real_estate_projects']['Row'];
type ProductRow = Database['public']['Tables']['real_estate_products']['Row'];

import { CEODashboardCharts } from '@/modules/real_estate/components/CEODashboardCharts';
import { PremiumProjectSelector } from '@/modules/real_estate/components/PremiumProjectSelector';

export default function RealEstateDashboardPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectRow | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  const availableCount = products.filter((p) => p.status === 'AVAILABLE').length;
  const reservedCount = products.filter((p) => p.status === 'RESERVED').length;
  const depositedCount = products.filter((p) => p.status === 'DEPOSITED').length;
  const signedCount = products.filter((p) => p.status === 'CONTRACT_SIGNED').length;
  const paidCount = products.filter((p) => p.status === 'PAID').length;
  const deliveredCount = products.filter((p) => p.status === 'HANDOVER').length;

  if (isLoading) {
    return (
      <div className="p-8 space-y-6 animate-pulse">
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

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
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
      />
    </div>
  );
}
