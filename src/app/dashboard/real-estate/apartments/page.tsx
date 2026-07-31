'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { fetchProjectsAction } from '@/modules/real_estate/actions/projectActions';
import { fetchProductsAction, updateProductStatusAction } from '@/modules/real_estate/actions/productActions';
import { Database } from '@/types/database.types';
import { Grid, Building, Loader2, ArrowRightLeft, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

type ProjectRow = Database['public']['Tables']['real_estate_projects']['Row'];
type ProductRow = Database['public']['Tables']['real_estate_products']['Row'];

export default function RealEstateApartmentsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectRow | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    const resProjects = await fetchProjectsAction();
    if (resProjects.success && resProjects.data) {
      const projectList = Array.isArray(resProjects.data) ? resProjects.data : [resProjects.data];
      setProjects(projectList);
      if (projectList.length > 0) {
        setSelectedProject(projectList[0]);
        await loadProducts(projectList[0].id);
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  async function loadProducts(projectId: string) {
    const resProducts = await fetchProductsAction(projectId);
    if (resProducts.success && resProducts.data) {
      setProducts(Array.isArray(resProducts.data) ? resProducts.data : [resProducts.data]);
    }
  }

  async function handleProjectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const projId = e.target.value;
    const proj = projects.find(p => p.id === projId) || null;
    setSelectedProject(proj);
    if (proj) {
      setIsLoading(true);
      await loadProducts(proj.id);
      setIsLoading(false);
    }
  }

  async function handleStatusTransition(productId: string, currentStatus: ProductRow['status'], targetStatus: ProductRow['status']) {
    setIsUpdating(productId);
    const ownerName = targetStatus === 'booked' ? 'Khách hàng đặt cọc' : null;
    const res = await updateProductStatusAction(productId, targetStatus, ownerName);
    if (res.success) {
      toast.success('Chuyển trạng thái căn hộ thành công');
      if (selectedProject) {
        await loadProducts(selectedProject.id);
      }
    } else {
      toast.error(res.error || 'Không hợp lệ hoặc sai ranh giới nghiệp vụ');
    }
    setIsUpdating(null);
  }

  if (isLoading && projects.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Grid className="text-primary w-7 h-7" />
            Bảng Hàng Căn Hộ
          </h1>
          <p className="text-sm text-slate-500">Xem sơ đồ, trạng thái và cập nhật căn hộ theo block</p>
        </div>
        <div className="flex items-center gap-3">
          <Building className="w-5 h-5 text-slate-400" />
          <select
            value={selectedProject?.id || ''}
            onChange={handleProjectChange}
            className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold"
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {products.map((prod) => (
          <div key={prod.id} className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-4 hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 dark:text-white">{prod.product_code}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                prod.status === 'available' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30' :
                prod.status === 'booked' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30' :
                'bg-rose-50 text-rose-700 dark:bg-rose-950/30'
              }`}>
                {prod.status === 'available' ? 'Trống' :
                 prod.status === 'booked' ? 'Đã Giữ Chỗ' : 'Đã bán'}
              </span>
            </div>

            <div className="text-xs text-slate-500 space-y-1">
              <p>Tầng: {prod.floor || 'Chưa cập nhật'}</p>
              <p>Block: {prod.block || 'Chưa cập nhật'}</p>
              <p>Diện tích: {prod.area} m²</p>
              <p className="font-semibold text-slate-950 dark:text-white">Giá: {(prod.unit_price / 1000000).toLocaleString()} triệu</p>
              {prod.owner_name && <p className="text-primary flex items-center gap-1"><UserCheck className="w-3.5 h-3.5" /> {prod.owner_name}</p>}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex gap-2">
              {prod.status === 'available' && (
                <button
                  disabled={isUpdating === prod.id}
                  onClick={() => handleStatusTransition(prod.id, 'available', 'booked')}
                  className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1"
                >
                  {isUpdating === prod.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Đặt Giữ Chỗ'}
                </button>
              )}
              {prod.status === 'booked' && (
                <>
                  <button
                    disabled={isUpdating === prod.id}
                    onClick={() => handleStatusTransition(prod.id, 'booked', 'available')}
                    className="flex-1 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-bold transition"
                  >
                    Hủy Giữ
                  </button>
                  <button
                    disabled={isUpdating === prod.id}
                    onClick={() => handleStatusTransition(prod.id, 'booked', 'deposited')}
                    className="flex-1 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-bold transition"
                  >
                    Xác Nhận Đặt Cọc
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
