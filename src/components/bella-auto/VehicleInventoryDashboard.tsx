'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase-client';
import { RefreshCw, Search, Download } from 'lucide-react';

interface Vehicle {
  id: string;
  vin: string;
  variant_id: string;
  color_exterior: string;
  model_year: number;
  status: string;
  location_note: string | null;
  list_price: number;
  // Fields from seed data (direct columns)
  brandName?: string;
  modelName?: string;
  variantName?: string;
  chassisNumber?: string | null;
  colorInterior?: string | null;
}

// Create client outside component to avoid recreating on every render
const supabase = createClient();
const ITEMS_PER_PAGE = 15;

export default function VehicleInventoryDashboard({ tenantId }: { tenantId: string }) {
  console.log('[VehicleInventoryDashboard] Component mounted with tenantId:', tenantId);
  
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [stats, setStats] = useState({ total: 0, showroom: 0, warehouse: 0, allocated: 0, delivered: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = ITEMS_PER_PAGE;

  const loadVehicles = useCallback(async () => {
    setLoading(true);
    try {
      // Check authentication first
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      
      if (authError) {
        console.error('❌ Auth error:', authError);
        throw new Error(`Authentication failed: ${authError.message}`);
      }
      
      if (!session) {
        console.warn('⚠️ No active session');
        throw new Error('No active session. Please log in.');
      }
      
      console.log('✅ Auth session active:', { userId: session.user.id, email: session.user.email });

      // Use AutoInventoryProvider JOIN query (same as vehicles page)
      let query = supabase
        .from('auto_vehicles')
        .select(`
          id, vin, chassis_number, engine_number,
          color_exterior, color_interior, model_year,
          list_price, cost_price, status, location_note,
          expected_arrival_date, actual_arrival_date,
          variant_id, created_at, updated_at,
          auto_variants!inner(name, model_id,
            auto_models!inner(name, brand_id,
              auto_brands!inner(name)
            )
          )
        `, { count: 'planned' })
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE - 1);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (searchTerm) {
        query = query.or(`vin.ilike.%${searchTerm}%,location_note.ilike.%${searchTerm}%`);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      console.log('[VehicleInventory] Loaded vehicles:', data?.length);

      // Map to interface format
      const mappedVehicles = (data || []).map((row: any) => ({
        id: row.id,
        vin: row.vin,
        variant_id: row.variant_id,
        color_exterior: row.color_exterior,
        color_interior: row.color_interior,
        model_year: row.model_year,
        status: row.status,
        location_note: row.location_note,
        list_price: Number(row.list_price),
        brandName: row.auto_variants?.auto_models?.auto_brands?.name,
        modelName: row.auto_variants?.auto_models?.name,
        variantName: row.auto_variants?.name,
        chassisNumber: row.chassis_number,
      }));

      console.log('[VehicleInventory] Sample vehicle:', mappedVehicles[0]);

      setVehicles(mappedVehicles);
      setTotalCount(count || 0);
      
      // Load stats
      const [totalRes, showroomRes, warehouseRes, allocatedRes, deliveredRes] = await Promise.all([
        supabase.from('auto_vehicles').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
        supabase.from('auto_vehicles').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'showroom'),
        supabase.from('auto_vehicles').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'warehouse'),
        supabase.from('auto_vehicles').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'allocated'),
        supabase.from('auto_vehicles').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'delivered'),
      ]);

      setStats({
        total: totalRes.count ?? 0,
        showroom: showroomRes.count ?? 0,
        warehouse: warehouseRes.count ?? 0,
        allocated: allocatedRes.count ?? 0,
        delivered: deliveredRes.count ?? 0,
      });
    } catch (error) {
      console.error('Error loading vehicles:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        raw: JSON.stringify(error, null, 2)
      });
    } finally {
      setLoading(false);
    }
  }, [tenantId, statusFilter, searchTerm, currentPage]);

  useEffect(() => {
    setCurrentPage(1); // Reset to page 1 when filters change
  }, [statusFilter, searchTerm]);

  useEffect(() => {
    void loadVehicles();
  }, [loadVehicles]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'showroom': return 'bg-cyan-100 text-cyan-800 border-cyan-200';
      case 'warehouse': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'allocated': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'delivered': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'in_transit': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards - Real Estate Style */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800/80 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Tổng xe</p>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.total.toLocaleString()}</p>
        </div>
        
        <div className="p-5 rounded-2xl bg-cyan-50 dark:bg-cyan-950/20 border border-cyan-100 dark:border-cyan-900/30 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-cyan-700 dark:text-cyan-400">Showroom</p>
          </div>
          <p className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">{stats.showroom.toLocaleString()}</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800/50 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-400">Kho</p>
          </div>
          <p className="text-3xl font-bold text-slate-600 dark:text-slate-300">{stats.warehouse.toLocaleString()}</p>
        </div>

        <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Đã phân bổ</p>
          </div>
          <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{stats.allocated.toLocaleString()}</p>
        </div>

        <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Đã bàn giao</p>
          </div>
          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{stats.delivered.toLocaleString()}</p>
        </div>
      </div>

      {/* Vehicle Table - Real Estate Style */}
      <div className="rounded-2xl bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Kho xe ({vehicles.length.toLocaleString()})</h2>
            <div className="flex gap-2">
              <button 
                onClick={loadVehicles}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 text-sm font-medium transition-all active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                Làm mới
              </button>
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 text-sm font-medium transition-all active:scale-95">
                <Download className="w-4 h-4" />
                Xuất Excel
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400" />
                <input
                  type="text"
                  placeholder="Tìm VIN, vị trí..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
                />
              </div>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
            >
              <option value="all">Tất cả</option>
              <option value="in_transit">Đang vận chuyển</option>
              <option value="warehouse">Kho</option>
              <option value="showroom">Showroom</option>
              <option value="allocated">Đã phân bổ</option>
              <option value="delivered">Đã bàn giao</option>
            </select>
          </div>
        </div>

        <div className="p-6">
          {/* Vehicle Table Content */}
          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-cyan-400 mb-4" />
              <p className="text-slate-500 dark:text-slate-400">Đang tải...</p>
            </div>
          ) : vehicles.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-500 dark:text-slate-400">Không tìm thấy xe</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <th className="text-left py-3 px-4 font-semibold text-sm text-slate-700 dark:text-slate-300">XE & PHIÊN BẢN</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm text-slate-700 dark:text-slate-300">SỐ VIN / SỐ KHUNG</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm text-slate-700 dark:text-slate-300">MÀU SẮC</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm text-slate-700 dark:text-slate-300">TRẠNG THÁI</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm text-slate-700 dark:text-slate-300">VỊ TRÍ</th>
                    <th className="text-right py-3 px-4 font-semibold text-sm text-slate-700 dark:text-slate-300">GIÁ NIÊM YẾT</th>
                    <th className="text-right py-3 px-4 font-semibold text-sm text-slate-700 dark:text-slate-300">CHI TIẾT</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((vehicle) => {
                    const brand = vehicle.brandName || '-';
                    const model = vehicle.modelName || '-';
                    const variant = vehicle.variantName || '-';
                    const vehicleName = brand !== '-' ? `${brand} ${model} ${variant}` : '-';
                    
                    return (
                    <tr key={vehicle.id} className="border-b border-slate-50 dark:border-slate-900 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium text-sm text-slate-900 dark:text-white">{vehicleName}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Năm {vehicle.model_year}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-sm text-cyan-600 dark:text-cyan-400">{vehicle.vin}</td>
                      <td className="py-3 px-4 text-sm text-slate-700 dark:text-slate-300">{vehicle.color_exterior}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${getStatusColor(vehicle.status)}`}>
                          {vehicle.status === 'in_transit' && 'Đang vận chuyển'}
                          {vehicle.status === 'warehouse' && 'Kho'}
                          {vehicle.status === 'showroom' && 'Showroom'}
                          {vehicle.status === 'allocated' && 'Đã phân bổ'}
                          {vehicle.status === 'delivered' && 'Đã bàn giao'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">{vehicle.location_note || '--'}</td>
                      <td className="py-3 px-4 text-right font-semibold text-sm text-slate-900 dark:text-white">
                        {(vehicle.list_price / 1000000000).toFixed(1)}B
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button className="px-3 py-1.5 rounded-lg text-sm font-medium text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/20 transition-all">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Pagination Controls */}
          {!loading && vehicles.length > 0 && totalCount > itemsPerPage && (
            <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Hiển thị <span className="font-semibold text-slate-900 dark:text-white">{((currentPage - 1) * itemsPerPage) + 1}</span> - <span className="font-semibold text-slate-900 dark:text-white">{Math.min(currentPage * itemsPerPage, totalCount)}</span> trong tổng số <span className="font-semibold text-slate-900 dark:text-white">{totalCount}</span> xe
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  ← Trước
                </button>
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 px-2">
                  Trang {currentPage} / {Math.ceil(totalCount / itemsPerPage)}
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalCount / itemsPerPage), p + 1))}
                  disabled={currentPage >= Math.ceil(totalCount / itemsPerPage)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Tiếp →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
