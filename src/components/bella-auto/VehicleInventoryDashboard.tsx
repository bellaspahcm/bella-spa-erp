'use client';

import { useState, useEffect } from 'react';
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
}

export default function VehicleInventoryDashboard({ tenantId }: { tenantId: string }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [stats, setStats] = useState({ total: 0, showroom: 0, warehouse: 0, allocated: 0, delivered: 0 });
  
  const supabase = createClient();

  const loadVehicles = async () => {
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

      let query = supabase
        .from('auto_vehicles')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (searchTerm) {
        query = query.or(`vin.ilike.%${searchTerm}%,location_note.ilike.%${searchTerm}%`);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      setVehicles(data || []);
      
      // Load stats
      const { data: statsData } = await supabase
        .from('auto_vehicles')
        .select('status')
        .eq('tenant_id', tenantId);

      if (statsData) {
        const statsCounts = {
          total: statsData.length,
          showroom: statsData.filter(v => v.status === 'showroom').length,
          warehouse: statsData.filter(v => v.status === 'warehouse').length,
          allocated: statsData.filter(v => v.status === 'allocated').length,
          delivered: statsData.filter(v => v.status === 'delivered').length,
        };
        setStats(statsCounts);
      }
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
  };

  useEffect(() => {
    loadVehicles();
  }, [tenantId, statusFilter, searchTerm]);

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
                    <th className="text-left py-3 px-4 font-semibold text-sm text-slate-700 dark:text-slate-300">VIN</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm text-slate-700 dark:text-slate-300">Màu</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm text-slate-700 dark:text-slate-300">Năm</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm text-slate-700 dark:text-slate-300">Trạng thái</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm text-slate-700 dark:text-slate-300">Vị trí</th>
                    <th className="text-right py-3 px-4 font-semibold text-sm text-slate-700 dark:text-slate-300">Giá niêm yết</th>
                    <th className="text-right py-3 px-4 font-semibold text-sm text-slate-700 dark:text-slate-300"></th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((vehicle) => (
                    <tr key={vehicle.id} className="border-b border-slate-50 dark:border-slate-900 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                      <td className="py-3 px-4 font-mono text-sm text-slate-900 dark:text-white">{vehicle.vin}</td>
                      <td className="py-3 px-4 text-sm text-slate-700 dark:text-slate-300">{vehicle.color_exterior}</td>
                      <td className="py-3 px-4 text-sm text-slate-700 dark:text-slate-300">{vehicle.model_year}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${getStatusColor(vehicle.status)}`}>
                          {vehicle.status === 'in_transit' && 'Đang vận chuyển'}
                          {vehicle.status === 'warehouse' && 'Kho'}
                          {vehicle.status === 'showroom' && 'Showroom'}
                          {vehicle.status === 'allocated' && 'Đã phân bổ'}
                          {vehicle.status === 'delivered' && 'Đã bàn giao'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">{vehicle.location_note || '-'}</td>
                      <td className="py-3 px-4 text-right font-semibold text-sm text-slate-900 dark:text-white">
                        {vehicle.list_price?.toLocaleString('vi-VN')} đ
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button className="px-3 py-1.5 rounded-lg text-sm font-medium text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/20 transition-all">
                          Chi tiết
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
