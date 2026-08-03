'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Heart, Activity } from 'lucide-react';

export function CustomerHealthScores() {
  const atRiskCustomers = [
    {
      id: '1',
      name: 'Nguyễn Văn A',
      healthScore: 35,
      status: 'at_risk',
      riskFactors: ['Không tương tác 60 ngày', 'NPS detractor (4/10)'],
      lastPurchase: '2025-01-15',
    },
    {
      id: '2',
      name: 'Trần Thị B',
      healthScore: 52,
      status: 'needs_attention',
      riskFactors: ['CSI thấp (2.8/5)', 'Không dùng dịch vụ 6 tháng'],
      lastPurchase: '2025-11-20',
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent':
        return 'bg-green-100 text-green-800';
      case 'healthy':
        return 'bg-blue-100 text-blue-800';
      case 'needs_attention':
        return 'bg-yellow-100 text-yellow-800';
      case 'at_risk':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'excellent':
        return 'Xuất sắc';
      case 'healthy':
        return 'Khỏe mạnh';
      case 'needs_attention':
        return 'Cần chú ý';
      case 'at_risk':
        return 'Nguy cơ cao';
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* Health Score Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-green-600" />
              <CardTitle className="text-sm">Xuất sắc</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">45</div>
            <p className="text-xs text-muted-foreground">≥ 80 điểm</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-600" />
              <CardTitle className="text-sm">Khỏe mạnh</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">78</div>
            <p className="text-xs text-muted-foreground">60-79 điểm</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <CardTitle className="text-sm">Cần chú ý</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">32</div>
            <p className="text-xs text-muted-foreground">40-59 điểm</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <CardTitle className="text-sm">Nguy cơ cao</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">12</div>
            <p className="text-xs text-muted-foreground">{'<'} 40 điểm</p>
          </CardContent>
        </Card>
      </div>

      {/* At-Risk Customers */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-900">
            Khách hàng cần chăm sóc khẩn cấp
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {atRiskCustomers.map((customer) => (
              <div
                key={customer.id}
                className="p-4 border rounded-lg bg-white"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">{customer.name}</span>
                      <Badge className={getStatusColor(customer.status)}>
                        {getStatusLabel(customer.status)}
                      </Badge>
                      <span className="text-2xl font-bold text-red-600">
                        {customer.healthScore}
                      </span>
                    </div>
                    <div className="mt-3 space-y-1">
                      <div className="text-sm font-medium text-red-700">
                        Risk Factors:
                      </div>
                      {customer.riskFactors.map((factor, idx) => (
                        <div
                          key={idx}
                          className="text-sm text-muted-foreground flex items-start gap-2"
                        >
                          <span className="text-red-500">•</span>
                          {factor}
                        </div>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                      Mua xe lần cuối: {new Date(customer.lastPurchase).toLocaleDateString('vi-VN')}
                    </div>
                  </div>
                  <button className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700">
                    Tạo kế hoạch chăm sóc
                  </button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Health Score Components */}
      <Card>
        <CardHeader>
          <CardTitle>Các thành phần Health Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Engagement (25%)</h4>
              <p className="text-xs text-muted-foreground">
                Tần suất tương tác, touchpoints, active journey
              </p>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 w-3/4" />
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Satisfaction (35%)</h4>
              <p className="text-xs text-muted-foreground">
                NPS và CSI scores
              </p>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 w-4/5" />
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Revenue (25%)</h4>
              <p className="text-xs text-muted-foreground">
                Mua xe, dịch vụ, tần suất chi tiêu
              </p>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 w-2/3" />
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Loyalty (15%)</h4>
              <p className="text-xs text-muted-foreground">
                Tenure, repeat business, referrals
              </p>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-yellow-500 w-1/2" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
