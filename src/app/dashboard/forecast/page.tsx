'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  useRevenueForecast, 
  useChurnForecast, 
  useDemandForecast,
  useForecastAccuracy 
} from '@/hooks/intelligence';
import { createClient } from '@/lib/supabase-client';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  DollarSign, 
  Calendar,
  AlertTriangle,
  RefreshCw,
  BarChart3,
  Activity,
  AlertCircle
} from 'lucide-react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function ForecastDashboard() {
  const [activeTab, setActiveTab] = useState('revenue');
  const [revenueHorizon, setRevenueHorizon] = useState(12);
  const [churnHorizon, setChurnHorizon] = useState(30);
  const [demandHorizon, setDemandHorizon] = useState(2);
  const [revenueModel, setRevenueModel] = useState('exponential_smoothing');
  const [tenantId, setTenantId] = useState('');
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  // Get current user's tenant ID
  useEffect(() => {
    const loadUser = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const userTenantId = user.user_metadata?.tenant_id;
          
          if (userTenantId) {
            setTenantId(userTenantId);
          } else {
            const { data: profile } = await supabase
              .from('users')
              .select('tenant_id')
              .eq('id', user.id)
              .single();
            
            if (profile?.tenant_id) {
              setTenantId(profile.tenant_id);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load user context:', error);
      } finally {
        setIsLoadingUser(false);
      }
    };

    loadUser();
  }, []);

  // Fetch forecasts
  const revenueForecast = useRevenueForecast({
    tenantId,
    months: revenueHorizon,
    model: revenueModel as any,
    enabled: !!tenantId
  });

  const churnForecast = useChurnForecast({
    tenantId,
    months: churnHorizon,
    enabled: !!tenantId
  });

  const demandForecast = useDemandForecast({
    tenantId,
    months: demandHorizon,
    enabled: !!tenantId
  });

  const forecastAccuracy = useForecastAccuracy(tenantId, {
    enabled: !!tenantId
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  if (isLoadingUser) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">Đang tải thông tin người dùng...</span>
        </div>
      </div>
    );
  }

  if (!tenantId) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Không thể xác định chi nhánh của người dùng hiện tại. Vui lòng đăng nhập lại.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dự Báo Thông Minh</h1>
          <p className="text-muted-foreground mt-1">
            Dự báo doanh thu, churn và demand sử dụng Machine Learning
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => {
            revenueForecast.refetch();
            churnForecast.refetch();
            demandForecast.refetch();
          }}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Làm mới
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="revenue" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Doanh Thu
          </TabsTrigger>
          <TabsTrigger value="churn" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Churn Risk
          </TabsTrigger>
          <TabsTrigger value="demand" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Demand
          </TabsTrigger>
        </TabsList>

        {/* Revenue Forecast Tab */}
        <TabsContent value="revenue" className="space-y-6">
          {/* Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Cấu Hình Dự Báo</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Mô Hình</label>
                <Select value={revenueModel} onValueChange={setRevenueModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simple_moving_average">Simple Moving Average</SelectItem>
                    <SelectItem value="exponential_smoothing">Exponential Smoothing</SelectItem>
                    <SelectItem value="linear_regression">Linear Regression</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Thời Gian Dự Báo</label>
                <Select 
                  value={revenueHorizon.toString()} 
                  onValueChange={(v) => setRevenueHorizon(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 tháng</SelectItem>
                    <SelectItem value="6">6 tháng</SelectItem>
                    <SelectItem value="12">12 tháng</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          {revenueForecast.data?.data && (
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Tổng Dự Báo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(revenueForecast.data.data.summary.totalPredictedRevenue)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {revenueHorizon} tháng tới
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    TB / Tháng
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(revenueForecast.data.data.summary.avgMonthlyRevenue)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Trung bình
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Tăng Trưởng
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <div className="text-2xl font-bold">
                      {formatPercent(revenueForecast.data.data.summary.growthRate)}
                    </div>
                    {revenueForecast.data.data.summary.growthRate >= 0 ? (
                      <TrendingUp className="w-5 h-5 text-green-500" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {revenueForecast.data.data.summary.trend === 'increasing' ? 'Tăng' : 'Giảm'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Độ Chính Xác
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {forecastAccuracy.data?.data?.[0]?.avgAccuracyPct 
                      ? formatPercent(forecastAccuracy.data.data[0].avgAccuracyPct)
                      : 'N/A'}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Model {revenueModel}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Revenue Forecast Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Biểu Đồ Dự Báo Doanh Thu</CardTitle>
              <CardDescription>
                Dự báo {revenueHorizon} tháng tới với confidence interval 95%
              </CardDescription>
            </CardHeader>
            <CardContent>
              {revenueForecast.isLoading ? (
                <div className="h-[400px] flex items-center justify-center">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Đang tải dữ liệu...
                  </div>
                </div>
              ) : revenueForecast.data?.data ? (
                <Line
                  data={{
                    labels: revenueForecast.data.data.forecasts.map(f => f.date),
                    datasets: [
                      {
                        label: 'Dự Báo',
                        data: revenueForecast.data.data.forecasts.map(f => f.predictedRevenue),
                        borderColor: 'rgb(233, 30, 99)',
                        backgroundColor: 'rgba(233, 30, 99, 0.1)',
                        fill: false,
                        tension: 0.4
                      },
                      {
                        label: 'Upper Bound (95%)',
                        data: revenueForecast.data.data.forecasts.map(f => f.confidenceUpper),
                        borderColor: 'rgb(233, 30, 99)',
                        backgroundColor: 'rgba(233, 30, 99, 0.05)',
                        borderDash: [5, 5],
                        fill: '+1',
                        tension: 0.4
                      },
                      {
                        label: 'Lower Bound (95%)',
                        data: revenueForecast.data.data.forecasts.map(f => f.confidenceLower),
                        borderColor: 'rgb(233, 30, 99)',
                        backgroundColor: 'rgba(233, 30, 99, 0.05)',
                        borderDash: [5, 5],
                        fill: false,
                        tension: 0.4
                      }
                    ]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'top' as const,
                      },
                      tooltip: {
                        callbacks: {
                          label: (context) => {
                            return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
                          }
                        }
                      }
                    },
                    scales: {
                      y: {
                        ticks: {
                          callback: (value) => formatCurrency(value as number)
                        }
                      }
                    }
                  }}
                  height={400}
                />
              ) : (
                <Alert>
                  <AlertDescription>
                    Không có dữ liệu. Vui lòng thử lại sau.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Model Comparison */}
          {forecastAccuracy.data?.data && forecastAccuracy.data.data.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>So Sánh Các Mô Hình</CardTitle>
                <CardDescription>
                  Hiệu suất của các mô hình dự báo khác nhau
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {forecastAccuracy.data.data.map((model) => (
                    <div key={model.modelName} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">{model.modelName}</div>
                        <div className="text-sm text-muted-foreground">
                          {model.totalForecasts} dự báo
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">Độ chính xác</div>
                          <div className="font-bold text-green-600">
                            {formatPercent(model.avgAccuracyPct)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">MAPE</div>
                          <div className="font-medium">
                            {formatPercent(model.avgMape)}
                          </div>
                        </div>
                      </div>
                      {model.isBestModel && (
                        <Badge variant="default" className="ml-4">
                          Best Model
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Churn Forecast Tab */}
        <TabsContent value="churn" className="space-y-6">
          {/* Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Cấu Hình Dự Báo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex-1 max-w-xs">
                <label className="text-sm font-medium mb-2 block">Thời Gian Dự Báo</label>
                <Select 
                  value={churnHorizon.toString()} 
                  onValueChange={(v) => setChurnHorizon(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 ngày</SelectItem>
                    <SelectItem value="60">60 ngày</SelectItem>
                    <SelectItem value="90">90 ngày</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          {churnForecast.data?.data && (
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Tổng KH
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {churnForecast.data.data.summary.totalCustomers.toLocaleString()}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Dự Báo Churn
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {churnForecast.data.data.summary.predictedChurn.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatPercent(churnForecast.data.data.summary.churnRate)} tỷ lệ
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Mất Doanh Thu
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {formatCurrency(churnForecast.data.data.summary.expectedRevenueLoss)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    TB Churn Prob
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatPercent(churnForecast.data.data.summary.avgChurnProbability * 100)}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* At-Risk Customers List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Khách Hàng Có Nguy Cơ Rời Bỏ</CardTitle>
                  <CardDescription>
                    Top khách hàng có xác suất churn cao nhất trong {churnHorizon} ngày tới
                  </CardDescription>
                </div>
                <Badge variant="destructive" className="text-lg px-3 py-1">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  {churnForecast.data?.data?.customersAtRisk?.length || 0} KH
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {churnForecast.isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Đang phân tích...
                </div>
              ) : churnForecast.data?.data?.customersAtRisk && churnForecast.data.data.customersAtRisk.length > 0 ? (
                <div className="space-y-3">
                  {churnForecast.data.data.customersAtRisk.slice(0, 10).map((customer) => (
                    <div 
                      key={customer.customerId} 
                      className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h4 className="font-semibold">{customer.customerName}</h4>
                          <Badge 
                            variant={
                              customer.riskLevel === 'critical' ? 'destructive' :
                              customer.riskLevel === 'high' ? 'default' : 'secondary'
                            }
                          >
                            {customer.riskLevel === 'critical' ? 'Cực Kỳ Cao' :
                             customer.riskLevel === 'high' ? 'Cao' :
                             customer.riskLevel === 'medium' ? 'Trung Bình' : 'Thấp'}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Churn Probability:</span>
                            <span className="font-semibold ml-2 text-red-600">
                              {formatPercent(customer.churnProbability * 100)}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">LTV:</span>
                            <span className="font-semibold ml-2">
                              {formatCurrency(customer.lifetimeValue)}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Lần mua cuối:</span>
                            <span className="ml-2">{customer.daysSinceLastPurchase} ngày trước</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Mất doanh thu:</span>
                            <span className="font-semibold ml-2 text-red-600">
                              {formatCurrency(customer.expectedRevenueLoss)}
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 space-y-1">
                          <div className="text-xs font-medium text-muted-foreground">Khuyến nghị hành động:</div>
                          {customer.recommendations?.slice(0, 2).map((rec, idx) => (
                            <div key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                              <span className="text-primary">•</span>
                              <span>{rec}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Alert>
                  <Activity className="h-4 w-4" />
                  <AlertDescription>
                    Tuyệt vời! Không có khách hàng nào có nguy cơ churn cao.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Demand Forecast Tab */}
        <TabsContent value="demand" className="space-y-6">
          {/* Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Cấu Hình Dự Báo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex-1 max-w-xs">
                <label className="text-sm font-medium mb-2 block">Thời Gian Dự Báo</label>
                <Select 
                  value={demandHorizon.toString()} 
                  onValueChange={(v) => setDemandHorizon(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 tuần</SelectItem>
                    <SelectItem value="2">2 tuần</SelectItem>
                    <SelectItem value="3">3 tuần</SelectItem>
                    <SelectItem value="4">4 tuần</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          {demandForecast.data?.data && (
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Tổng Demand
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {demandForecast.data.data.summary.totalPredictedDemand.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {demandHorizon} tuần tới
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    TB / Ngày
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {demandForecast.data.data.summary.avgDailyDemand.toFixed(1)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Peak Demand
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">
                    {demandForecast.data.data.summary.peakDemandValue}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {demandForecast.data.data.summary.peakDemandDate}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Demand Forecast Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Biểu Đồ Dự Báo Demand</CardTitle>
              <CardDescription>
                Dự báo demand {demandHorizon} tuần tới cho các dịch vụ
              </CardDescription>
            </CardHeader>
            <CardContent>
              {demandForecast.isLoading ? (
                <div className="h-[400px] flex items-center justify-center">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Đang tải dữ liệu...
                  </div>
                </div>
              ) : demandForecast.data?.data ? (
                <Bar
                  data={{
                    labels: demandForecast.data.data.forecasts.map(f => f.date),
                    datasets: [
                      {
                        label: 'Dự Báo Demand',
                        data: demandForecast.data.data.forecasts.map(f => f.predictedDemand),
                        backgroundColor: 'rgba(233, 30, 99, 0.5)',
                        borderColor: 'rgb(233, 30, 99)',
                        borderWidth: 2
                      }
                    ]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'top' as const,
                      }
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: {
                          stepSize: 5
                        }
                      }
                    }
                  }}
                  height={400}
                />
              ) : (
                <Alert>
                  <AlertDescription>
                    Không có dữ liệu. Vui lòng thử lại sau.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
