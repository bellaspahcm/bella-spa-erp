'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, History, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface TemporalResult {
  id: string;
  vin: string;
  status: string;
  color_exterior: string;
  model_year: number;
  location_note: string | null;
}

export default function TemporalQueryBuilder({ tenantId }: { tenantId: string }) {
  const [asOfDate, setAsOfDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [results, setResults] = useState<TemporalResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const supabase = createClient();

  const executeQuery = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const asOfTime = new Date(asOfDate + 'T00:00:00Z').toISOString();
      
      const { data, error: rpcError } = await supabase.rpc('get_temporal_vehicle_inventory', {
        p_tenant_id: tenantId,
        p_as_of_time: asOfTime,
      });

      if (rpcError) throw rpcError;
      
      setResults(data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const presetDates = [
    { label: 'Hôm nay', days: 0 },
    { label: '1 tuần trước', days: 7 },
    { label: '1 tháng trước', days: 30 },
    { label: '3 tháng trước', days: 90 },
    { label: '1 năm trước', days: 365 },
    { label: '5 năm trước', days: 1825 },
  ];

  const setPresetDate = (daysAgo: number) => {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    setAsOfDate(date.toISOString().split('T')[0]);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <History className="w-5 h-5 text-cyan-600" />
            Time Travel Query - Truy vấn lịch sử
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Chọn thời điểm</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400" />
                <Input
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  className="pl-10"
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
              <Button onClick={executeQuery} disabled={loading}>
                <Search className="w-4 h-4 mr-2" />
                {loading ? 'Đang truy vấn...' : 'Truy vấn'}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-slate-600 font-medium">Nhanh:</span>
            {presetDates.map((preset) => (
              <Button
                key={preset.days}
                variant="outline"
                size="sm"
                onClick={() => setPresetDate(preset.days)}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">❌ Lỗi: {error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Kết quả: {results.length.toLocaleString()} xe tại thời điểm {new Date(asOfDate).toLocaleDateString('vi-VN')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">VIN</th>
                    <th className="text-left py-3 px-4 font-medium">Màu</th>
                    <th className="text-left py-3 px-4 font-medium">Năm</th>
                    <th className="text-left py-3 px-4 font-medium">Trạng thái</th>
                    <th className="text-left py-3 px-4 font-medium">Vị trí</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((vehicle) => (
                    <tr key={vehicle.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-mono text-sm">{vehicle.vin}</td>
                      <td className="py-3 px-4">{vehicle.color_exterior}</td>
                      <td className="py-3 px-4">{vehicle.model_year}</td>
                      <td className="py-3 px-4">
                        <Badge>{vehicle.status}</Badge>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{vehicle.location_note || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && results.length === 0 && asOfDate && (
        <Card>
          <CardContent className="py-8 text-center text-slate-500">
            <History className="w-12 h-12 mx-auto mb-4 text-cyan-300" />
            <p>Chưa có dữ liệu tại thời điểm này</p>
            <p className="text-sm mt-1">Lịch sử sẽ được ghi nhận khi có thay đổi</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
