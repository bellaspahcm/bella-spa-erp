'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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

// Lazy load Chart components to avoid SSR issues
const Line = dynamic(
  () => import('react-chartjs-2').then((mod) => mod.Line),
  { ssr: false, loading: () => <div className="h-[400px] flex items-center justify-center"><RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" /></div> }
);

const Bar = dynamic(
  () => import('react-chartjs-2').then((mod) => mod.Bar),
  { ssr: false, loading: () => <div className="h-[400px] flex items-center justify-center"><RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" /></div> }
);

// Register Chart.js components on client-side only
if (typeof window !== 'undefined') {
  import('chart.js').then((ChartJS) => {
    ChartJS.Chart.register(
      ChartJS.CategoryScale,
      ChartJS.LinearScale,
      ChartJS.PointElement,
      ChartJS.LineElement,
      ChartJS.BarElement,
      ChartJS.Title,
      ChartJS.Tooltip,
      ChartJS.Legend,
      ChartJS.Filler
    );
  });
}

function ForecastDashboard() {
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

  // Fetch forecasts with retry: false to prevent infinite retries on 400 errors
  const revenueForecast = useRevenueForecast({
    tenantId,
    months: revenueHorizon,
    model: revenueModel as any,
    enabled: !!tenantId
  }, {
    retry: false,
    // Don't throw errors, just return them
    throwOnError: false
  });

  const churnForecast = useChurnForecast({
    tenantId,
    months: churnHorizon,
    enabled: !!tenantId
  }, {
    retry: false,
    throwOnError: false
  });

  const demandForecast = useDemandForecast({
    tenantId,
    months: demandHorizon,
    enabled: !!tenantId
  }, {
    retry: false,
    throwOnError: false
  });

  const forecastAccuracy = useForecastAccuracy(tenantId, {
    enabled: !!tenantId,
    retry: false,
    throwOnError: false
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
                <Select value={revenueModel} onValueChange={(value) => value && setRevenueModel(value)}>
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
                  onValueChange={(v) => v && setRevenueHorizon(parseInt(v))}
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
          {revenueForecast.error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Lỗi khi tải dữ liệu dự báo doanh thu</AlertTitle>
              <AlertDescription>
                {revenueForecast.error instanceof Error 
                  ? revenueForecast.error.message 
                  : 'API không khả dụng. Vui lòng kiểm tra backend hoặc thử lại sau.'}
              </AlertDescription>
            </Alert>
          ) : revenueForecast.data?.data && (
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Dự Báo Doanh Thu
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {Array.isArray(revenueForecast.data.data) 
                      ? `${revenueForecast.data.data.length} kết quả`
                      : formatCurrency(revenueForecast.data.data.forecasted_value)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Model: {Array.isArray(revenueForecast.data.data) 
                      ? revenueForecast.data.data[0]?.model_name 
                      : revenueForecast.data.data.model_name}
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
                    {Array.isArray(revenueForecast.data.data) && revenueForecast.data.data[0]?.accuracy_pct
                      ? `${revenueForecast.data.data[0].accuracy_pct.toFixed(1)}%`
                      : !Array.isArray(revenueForecast.data.data) && revenueForecast.data.data.accuracy_pct
                      ? `${revenueForecast.data.data.accuracy_pct.toFixed(1)}%`
                      : 'N/A'}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Accuracy
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Confidence Range
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm font-bold">
                    {!Array.isArray(revenueForecast.data.data) && (
                      <>
                        {formatCurrency(revenueForecast.data.data.confidence_lower)}
                        {' - '}
                        {formatCurrency(revenueForecast.data.data.confidence_upper)}
                      </>
                    )}
                    {Array.isArray(revenueForecast.data.data) && revenueForecast.data.data.length > 0 && (
                      <>Multi-period</>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    95% CI
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Horizon
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {revenueHorizon} tháng
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Forecast period
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
              ) : revenueForecast.error ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Lỗi khi tải dữ liệu</AlertTitle>
                  <AlertDescription>
                    {revenueForecast.error instanceof Error 
                      ? revenueForecast.error.message 
                      : 'Không thể tải dữ liệu dự báo doanh thu. Vui lòng thử lại sau.'}
                  </AlertDescription>
                </Alert>
              ) : revenueForecast.data?.data ? (
                (() => {
                  const forecastData = Array.isArray(revenueForecast.data.data) 
                    ? revenueForecast.data.data 
                    : [revenueForecast.data.data];
                  
                  return (
                    <Line
                      data={{
                        labels: forecastData.map((f: any) => f.period_end_date),
                        datasets: [
                          {
                            label: 'Dự Báo',
                            data: forecastData.map((f: any) => f.forecasted_value),
                            borderColor: 'rgb(233, 30, 99)',
                            backgroundColor: 'rgba(233, 30, 99, 0.1)',
                            fill: false,
                            tension: 0.4
                          },
                          {
                            label: 'Upper Bound (95%)',
                            data: forecastData.map((f: any) => f.confidence_upper),
                            borderColor: 'rgb(233, 30, 99)',
                            backgroundColor: 'rgba(233, 30, 99, 0.05)',
                            borderDash: [5, 5],
                            fill: '+1',
                            tension: 0.4
                          },
                          {
                            label: 'Lower Bound (95%)',
                            data: forecastData.map((f: any) => f.confidence_lower),
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
                                return `${context.dataset.label}: ${formatCurrency(context.parsed.y || 0)}`;
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
                  );
                })()
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
                  onValueChange={(v) => v && setChurnHorizon(parseInt(v))}
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
          {churnForecast.error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Lỗi khi tải dữ liệu dự báo churn</AlertTitle>
              <AlertDescription>
                {churnForecast.error instanceof Error 
                  ? churnForecast.error.message 
                  : 'API không khả dụng. Vui lòng kiểm tra backend hoặc thử lại sau.'}
              </AlertDescription>
            </Alert>
          ) : churnForecast.data?.data && (
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Dự Báo Churn
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                      {!Array.isArray(churnForecast.data.data) 
                        ? formatPercent(churnForecast.data.data.forecasted_value)
                        : `${churnForecast.data.data.length} periods`}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Model: {!Array.isArray(churnForecast.data.data) 
                        ? churnForecast.data.data.model_name
                        : churnForecast.data.data[0]?.model_name}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Confidence Range
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm font-bold">
                      {!Array.isArray(churnForecast.data.data) && (
                        <>
                          {formatPercent(churnForecast.data.data.confidence_lower)}
                          {' - '}
                          {formatPercent(churnForecast.data.data.confidence_upper)}
                        </>
                      )}
                      {Array.isArray(churnForecast.data.data) && <>Multi-period</>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">95% CI</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Accuracy
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {!Array.isArray(churnForecast.data.data) && churnForecast.data.data.accuracy_pct
                        ? formatPercent(churnForecast.data.data.accuracy_pct)
                        : 'N/A'}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Horizon
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {churnHorizon} tháng
                    </div>
                  </CardContent>
                </Card>
              </div>
          )}
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
                  onValueChange={(v) => v && setDemandHorizon(parseInt(v))}
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
          {demandForecast.error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Lỗi khi tải dữ liệu dự báo demand</AlertTitle>
              <AlertDescription>
                {demandForecast.error instanceof Error 
                  ? demandForecast.error.message 
                  : 'API không khả dụng. Vui lòng kiểm tra backend hoặc thử lại sau.'}
              </AlertDescription>
            </Alert>
          ) : demandForecast.data?.data && (
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Dự Báo Demand
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {!Array.isArray(demandForecast.data.data) 
                      ? demandForecast.data.data.forecasted_value.toFixed(0)
                      : `${demandForecast.data.data.length} periods`}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {demandHorizon} tháng tới
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Model
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm font-bold">
                    {!Array.isArray(demandForecast.data.data) 
                      ? demandForecast.data.data.model_name
                      : demandForecast.data.data[0]?.model_name}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Accuracy
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">
                    {!Array.isArray(demandForecast.data.data) && demandForecast.data.data.accuracy_pct
                      ? `${demandForecast.data.data.accuracy_pct.toFixed(1)}%`
                      : 'N/A'}
                  </div>
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
              ) : demandForecast.error ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Lỗi khi tải dữ liệu</AlertTitle>
                  <AlertDescription>
                    {demandForecast.error instanceof Error 
                      ? demandForecast.error.message 
                      : 'Không thể tải dữ liệu dự báo demand. Vui lòng thử lại sau.'}
                  </AlertDescription>
                </Alert>
              ) : demandForecast.data?.data ? (
                (() => {
                  const forecastData = Array.isArray(demandForecast.data.data) 
                    ? demandForecast.data.data 
                    : [demandForecast.data.data];
                  
                  return (
                    <Bar
                      data={{
                        labels: forecastData.map((f: any) => f.period_end_date),
                        datasets: [
                          {
                            label: 'Dự Báo Demand',
                            data: forecastData.map((f: any) => f.forecasted_value),
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
                  );
                })()
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

export default function ForecastDashboardWrapper() {
  return (
    <ErrorBoundary>
      <ForecastDashboard />
    </ErrorBoundary>
  );
}
