'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Search, Filter, Download } from 'lucide-react';

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
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Tổng xe</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{stats.total.toLocaleString()}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Showroom</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyan-600">{stats.showroom.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Kho</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-600">{stats.warehouse.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Đã phân bổ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.allocated.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Đã bàn giao</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{stats.delivered.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Kho xe ({vehicles.length.toLocaleString()})</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadVehicles}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Làm mới
              </Button>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Xuất Excel
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400" />
                <Input
                  placeholder="Tìm VIN, vị trí..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="in_transit">Đang vận chuyển</SelectItem>
                <SelectItem value="warehouse">Kho</SelectItem>
                <SelectItem value="showroom">Showroom</SelectItem>
                <SelectItem value="allocated">Đã phân bổ</SelectItem>
                <SelectItem value="delivered">Đã bàn giao</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Vehicle Table */}
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-cyan-400" />
              <p className="text-slate-500 mt-2">Đang tải...</p>
            </div>
          ) : vehicles.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-500">Không tìm thấy xe</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">VIN</th>
                    <th className="text-left py-3 px-4 font-medium">Màu</th>
                    <th className="text-left py-3 px-4 font-medium">Năm</th>
                    <th className="text-left py-3 px-4 font-medium">Trạng thái</th>
                    <th className="text-left py-3 px-4 font-medium">Vị trí</th>
                    <th className="text-right py-3 px-4 font-medium">Giá niêm yết</th>
                    <th className="text-right py-3 px-4 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((vehicle) => (
                    <tr key={vehicle.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-mono text-sm">{vehicle.vin}</td>
                      <td className="py-3 px-4">{vehicle.color_exterior}</td>
                      <td className="py-3 px-4">{vehicle.model_year}</td>
                      <td className="py-3 px-4">
                        <Badge className={getStatusColor(vehicle.status)}>
                          {vehicle.status === 'in_transit' && 'Đang vận chuyển'}
                          {vehicle.status === 'warehouse' && 'Kho'}
                          {vehicle.status === 'showroom' && 'Showroom'}
                          {vehicle.status === 'allocated' && 'Đã phân bổ'}
                          {vehicle.status === 'delivered' && 'Đã bàn giao'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{vehicle.location_note || '-'}</td>
                      <td className="py-3 px-4 text-right font-medium">
                        {vehicle.list_price?.toLocaleString('vi-VN')} đ
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button variant="ghost" size="sm">
                          Chi tiết
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
