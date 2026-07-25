'use client';

import './styles.css';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  useRevenueForecast, 
  useChurnForecast, 
  useDemandForecast
} from '@/hooks/intelligence';
import { createClient } from '@/lib/supabase-client';
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  Calendar,
  RefreshCw,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';
import {
  IntelligenceLayout,
  IntelligenceLoading,
  IntelligenceError
} from '@/components/intelligence';

// Wrapper components for charts that only render on client-side
const ChartWrapper = dynamic(() => Promise.resolve(({ children }: { children: React.ReactNode }) => <>{children}</>), {
  ssr: false,
});

// Lazy load Chart components with no SSR
const Line = dynamic(
  () => import('react-chartjs-2').then((mod) => mod.Line),
  { 
    ssr: false, 
    loading: () => (
      <div className="h-[400px] flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    ) 
  }
);

const Bar = dynamic(
  () => import('react-chartjs-2').then((mod) => mod.Bar),
  { 
    ssr: false, 
    loading: () => (
      <div className="h-[400px] flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    ) 
  }
);

// Client-side only Chart.js registration
if (typeof window !== 'undefined') {
  // Use dynamic import with await to ensure synchronous execution
  Promise.resolve().then(async () => {
    const ChartJS = await import('chart.js');
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
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('revenue');
  const [themeColor, setThemeColor] = useState('#E91E63');
  const [revenueHorizon, setRevenueHorizon] = useState(12);
  const [churnHorizon, setChurnHorizon] = useState(30);
  const [demandHorizon, setDemandHorizon] = useState(2);
  const [revenueModel, setRevenueModel] = useState('exponential_smoothing');
  const [tenantId, setTenantId] = useState('');
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [chartKey, setChartKey] = useState(0);
  const [isChartReady, setIsChartReady] = useState(false);

  // Read computed primary color from document.documentElement
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const color = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
      if (color) {
        setThemeColor(color);
      }
    }
  }, []);

  const themeRgba = (alpha: number) => {
    const cleanHex = themeColor.replace('#', '');
    let r = 0, g = 0, b = 0;
    if (cleanHex.length === 3) {
      r = parseInt(cleanHex[0] + cleanHex[0], 16);
      g = parseInt(cleanHex[1] + cleanHex[1], 16);
      b = parseInt(cleanHex[2] + cleanHex[2], 16);
    } else if (cleanHex.length === 6) {
      r = parseInt(cleanHex.substring(0, 2), 16);
      g = parseInt(cleanHex.substring(2, 4), 16);
      b = parseInt(cleanHex.substring(4, 6), 16);
    } else {
      return `rgba(233, 30, 99, ${alpha})`;
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Register Chart.js on client-side mount
  useEffect(() => {
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
        setIsChartReady(true);
      });
    }
  }, []);

  // Force chart remount when tab or settings change to prevent canvas reuse errors
  useEffect(() => {
    if (isChartReady) {
      setChartKey(prev => prev + 1);
    }
  }, [activeTab, revenueHorizon, churnHorizon, demandHorizon, revenueModel, themeColor, isChartReady]);

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
    model: revenueModel as 'simple_moving_average' | 'exponential_smoothing' | 'linear_regression',
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

  const formatCurrency = (value: number | null | undefined) => {
    if (value == null || !Number.isFinite(value)) return 'N/A';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  if (isLoadingUser) {
    return (
      <IntelligenceLayout>
        <IntelligenceLoading message="Đang tải thông tin người dùng..." />
      </IntelligenceLayout>
    );
  }

  if (!tenantId) {
    return (
      <IntelligenceLayout>
        <IntelligenceError 
          title="Thiếu thông tin chi nhánh"
          message="Không thể xác định chi nhánh của người dùng hiện tại. Vui lòng đăng nhập lại."
        />
      </IntelligenceLayout>
    );
  }

  const formatPercent = (value: number | null | undefined) => {
    if (value == null || !Number.isFinite(value)) return 'N/A';
    return `${value.toFixed(1)}%`;
  };

  return (
    <IntelligenceLayout>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-12">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="w-12 h-12 bg-white/60 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-slate-200/60 text-slate-600 hover:text-primary hover:border-primary/30 active:scale-95 transition-all shadow-sm shrink-0"
            title="Quay lại trang trước"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="mb-1 flex items-center gap-2 text-primary">
              <TrendingUp className="h-4 w-4" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Intelligence & Dự Báo</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight uppercase">Dự Báo Thông Minh</h1>
            <p className="text-xs font-black text-slate-400 uppercase tracking-[0.25em] mt-1">Dự báo doanh thu, khách rời đi và nhu cầu dịch vụ sử dụng Machine Learning</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setChartKey(prev => prev + 1);
              revenueForecast.refetch();
              churnForecast.refetch();
              demandForecast.refetch();
            }}
            className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-2xl font-black transition-all active:scale-95 uppercase tracking-wider text-xs shrink-0"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Làm mới dữ liệu</span>
          </button>
        </div>
      </div>

      {/* Tabs with glassmorphism backdrop wrapper */}
      <div className="rounded-[2rem] glass-pink backdrop-blur-sm bg-white/60 border border-white/50 shadow-sm p-6 md:p-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="grid w-full grid-cols-3 bg-transparent p-0 gap-2 h-auto">
            <TabsTrigger 
              value="revenue" 
              className="flex items-center justify-center gap-2 rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-wider transition-all border data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:border-primary data-[state=inactive]:bg-slate-50 data-[state=inactive]:text-slate-500 data-[state=inactive]:border-slate-200 hover:bg-white hover:text-primary hover:border-primary/30 data-[state=active]:hover:bg-primary/85 data-[state=active]:hover:text-white"
            >
              <DollarSign className="w-5 h-5" />
              <span>Doanh Thu</span>
            </TabsTrigger>
            <TabsTrigger 
              value="churn" 
              className="flex items-center justify-center gap-2 rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-wider transition-all border data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:border-primary data-[state=inactive]:bg-slate-50 data-[state=inactive]:text-slate-500 data-[state=inactive]:border-slate-200 hover:bg-white hover:text-primary hover:border-primary/30 data-[state=active]:hover:bg-primary/85 data-[state=active]:hover:text-white"
            >
              <Users className="w-5 h-5" />
              <span>Khách Rời Đi</span>
            </TabsTrigger>
            <TabsTrigger 
              value="demand" 
              className="flex items-center justify-center gap-2 rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-wider transition-all border data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:border-primary data-[state=inactive]:bg-slate-50 data-[state=inactive]:text-slate-500 data-[state=inactive]:border-slate-200 hover:bg-white hover:text-primary hover:border-primary/30 data-[state=active]:hover:bg-primary/85 data-[state=active]:hover:text-white"
            >
              <Calendar className="w-5 h-5" />
              <span>Nhu Cầu</span>
            </TabsTrigger>
          </TabsList>

          {/* Revenue Forecast Tab */}
          <TabsContent value="revenue" className="space-y-8">
            {/* Controls */}
            <div className="glass-pink backdrop-blur-sm bg-white/60 p-6 rounded-[2rem] border border-white/50 shadow-sm relative overflow-hidden space-y-4 mb-6">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Cấu Hình Dự Báo</h2>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Mô Hình</label>
                  <Select value={revenueModel} onValueChange={(value) => value && setRevenueModel(value)}>
                    <SelectTrigger className="w-full bg-white/80 border border-slate-200/80 rounded-2xl px-4 py-2 text-sm font-bold shadow-sm h-11 focus:outline-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="simple_moving_average">Trung Bình Động Đơn Giản</SelectItem>
                      <SelectItem value="exponential_smoothing">Làm Mượt Hàm Mũ</SelectItem>
                      <SelectItem value="linear_regression">Hồi Quy Tuyến Tính</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Thời Gian Dự Báo</label>
                  <Select 
                    value={revenueHorizon.toString()} 
                    onValueChange={(v) => v && setRevenueHorizon(parseInt(v))}
                  >
                    <SelectTrigger className="w-full bg-white/80 border border-slate-200/80 rounded-2xl px-4 py-2 text-sm font-bold shadow-sm h-11 focus:outline-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 tháng</SelectItem>
                      <SelectItem value="6">6 tháng</SelectItem>
                      <SelectItem value="12">12 tháng</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

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
              <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-8">
                <div className="glass-pink backdrop-blur-sm bg-white/60 p-6 rounded-3xl border border-white/50 shadow-sm relative overflow-hidden hover:shadow-md hover:translate-y-[-1px] transition-all duration-300">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Dự Báo Doanh Thu</p>
                  <p className="text-2xl font-black text-slate-900 tracking-tight">
                    {Array.isArray(revenueForecast.data.data) 
                      ? `${revenueForecast.data.data.length} kết quả`
                      : revenueForecast.data.data?.forecasted_value
                      ? formatCurrency(revenueForecast.data.data.forecasted_value)
                      : 'N/A'}
                  </p>
                  <p className="text-[10px] font-semibold text-slate-400 mt-2">
                    Mô hình: {Array.isArray(revenueForecast.data.data) 
                      ? revenueForecast.data.data[0]?.model_name 
                      : revenueForecast.data.data.model_name}
                  </p>
                </div>

                <div className="glass-pink backdrop-blur-sm bg-white/60 p-6 rounded-3xl border border-white/50 shadow-sm relative overflow-hidden hover:shadow-md hover:translate-y-[-1px] transition-all duration-300">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Độ Chính Xác</p>
                  <p className="text-2xl font-black text-emerald-600 tracking-tight">
                    {Array.isArray(revenueForecast.data.data) && revenueForecast.data.data[0]?.accuracy_pct != null
                      ? `${revenueForecast.data.data[0].accuracy_pct.toFixed(1)}%`
                      : !Array.isArray(revenueForecast.data.data) && revenueForecast.data.data?.accuracy_pct != null
                      ? `${revenueForecast.data.data.accuracy_pct.toFixed(1)}%`
                      : 'N/A'}
                  </p>
                  <p className="text-[10px] font-semibold text-slate-400 mt-2">
                    Chỉ số độ chính xác
                  </p>
                </div>

                <div className="glass-pink backdrop-blur-sm bg-white/60 p-6 rounded-3xl border border-white/50 shadow-sm relative overflow-hidden hover:shadow-md hover:translate-y-[-1px] transition-all duration-300">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Khoảng Tin Cậy</p>
                  <div className="text-sm font-black text-slate-900 tracking-tight mt-1 min-h-[1.5rem]">
                    {!Array.isArray(revenueForecast.data.data) && revenueForecast.data.data?.confidence_lower != null && revenueForecast.data.data?.confidence_upper != null ? (
                      <>
                        {formatCurrency(revenueForecast.data.data.confidence_lower)}
                        {' - '}
                        {formatCurrency(revenueForecast.data.data.confidence_upper)}
                      </>
                    ) : null}
                    {Array.isArray(revenueForecast.data.data) && revenueForecast.data.data.length > 0 && (
                      <>Multi-period</>
                    )}
                    {!Array.isArray(revenueForecast.data.data) && (revenueForecast.data.data?.confidence_lower == null || revenueForecast.data.data?.confidence_upper == null) && (
                      <>N/A</>
                    )}
                  </div>
                  <p className="text-[10px] font-semibold text-slate-400 mt-2">
                    Độ tin cậy 95%
                  </p>
                </div>

                <div className="glass-pink backdrop-blur-sm bg-white/60 p-6 rounded-3xl border border-white/50 shadow-sm relative overflow-hidden hover:shadow-md hover:translate-y-[-1px] transition-all duration-300">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Thời Gian Dự Báo</p>
                  <p className="text-2xl font-black text-slate-900 tracking-tight">
                    {revenueHorizon} tháng
                  </p>
                  <p className="text-[10px] font-semibold text-slate-400 mt-2">
                    Khoảng thời gian dự báo
                  </p>
                </div>
              </div>
            )}

            {/* Revenue Forecast Chart */}
            <div className="glass-pink backdrop-blur-sm bg-white/60 p-8 rounded-[2rem] border border-white/50 shadow-sm relative overflow-hidden hover:shadow-xl transition-all duration-300">
              <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary/20 via-pink-300/30 to-primary/20" />
              <h2 className="text-lg font-black text-slate-900 mb-2 uppercase tracking-wider">Biểu Đồ Dự Báo Doanh Thu</h2>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Dự báo {revenueHorizon} tháng tới với khoảng tin cậy 95%</p>
              
              <div className="w-full">
                {revenueForecast.isLoading ? (
                  <div className="h-[400px] flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-wider">
                      <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                      <span>Đang tải dữ liệu...</span>
                    </div>
                  </div>
                ) : !isChartReady ? (
                  <div className="h-[400px] flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-wider">
                      <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                      <span>Đang khởi tạo biểu đồ...</span>
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
                    const forecastData = (Array.isArray(revenueForecast.data.data)
                      ? revenueForecast.data.data
                      : [revenueForecast.data.data]) as unknown as Record<string, unknown>[];
                    
                    return (
                      <ChartWrapper>
                        <Line
                          key={`revenue-chart-${chartKey}`}
                          data={{
                          labels: forecastData.map((f) => String(f.period_end_date || '')),
                          datasets: [
                            {
                              label: 'Dự Báo',
                              data: forecastData.map((f) => Number(f.forecasted_value || 0)),
                              borderColor: themeColor,
                              backgroundColor: themeRgba(0.1),
                              fill: false,
                              tension: 0.4
                            },
                            {
                              label: 'Upper Bound (95%)',
                              data: forecastData.map((f) => Number(f.confidence_upper || 0)),
                              borderColor: themeColor,
                              backgroundColor: themeRgba(0.05),
                              borderDash: [5, 5],
                              fill: '+1',
                              tension: 0.4
                            },
                            {
                              label: 'Lower Bound (95%)',
                              data: forecastData.map((f) => Number(f.confidence_lower || 0)),
                              borderColor: themeColor,
                              backgroundColor: themeRgba(0.05),
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
                              labels: {
                                color: '#94a3b8',
                                font: {
                                  weight: 'bold',
                                  size: 11
                                }
                              }
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
                              grid: {
                                color: '#f1f5f9'
                              },
                              ticks: {
                                color: '#94a3b8',
                                font: {
                                  weight: 'bold',
                                  size: 10
                                },
                                callback: (value) => formatCurrency(value as number)
                              }
                            },
                            x: {
                              grid: {
                                display: false
                              },
                              ticks: {
                                color: '#94a3b8',
                                font: {
                                  weight: 'bold',
                                  size: 10
                                }
                              }
                            }
                          }
                        }}
                        height={400}
                      />
                      </ChartWrapper>
                    );
                  })()
                ) : (
                  <Alert>
                    <AlertDescription>
                      Không có dữ liệu. Vui lòng thử lại sau.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Churn Forecast Tab */}
          <TabsContent value="churn" className="space-y-8">
            {/* Controls */}
            <div className="glass-pink backdrop-blur-sm bg-white/60 p-6 rounded-[2rem] border border-white/50 shadow-sm relative overflow-hidden space-y-4 mb-6">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Cấu Hình Dự Báo</h2>
              <div className="flex-1 max-w-xs">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Thời Gian Dự Báo</label>
                <Select 
                  value={churnHorizon.toString()} 
                  onValueChange={(v) => v && setChurnHorizon(parseInt(v))}
                >
                  <SelectTrigger className="w-full bg-white/80 border border-slate-200/80 rounded-2xl px-4 py-2 text-sm font-bold shadow-sm h-11 focus:outline-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 ngày</SelectItem>
                    <SelectItem value="60">60 ngày</SelectItem>
                    <SelectItem value="90">90 ngày</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

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
              <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-8">
                <div className="glass-pink backdrop-blur-sm bg-white/60 p-6 rounded-3xl border border-white/50 shadow-sm relative overflow-hidden hover:shadow-md hover:translate-y-[-1px] transition-all duration-300">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Dự Báo Khách Rời Đi</p>
                  <p className="text-2xl font-black text-red-600 tracking-tight">
                    {!Array.isArray(churnForecast.data.data) && churnForecast.data.data?.forecasted_value != null
                      ? formatPercent(churnForecast.data.data.forecasted_value)
                      : Array.isArray(churnForecast.data.data)
                      ? `${churnForecast.data.data.length} kỳ`
                      : 'N/A'}
                  </p>
                  <p className="text-[10px] font-semibold text-slate-400 mt-2">
                    Mô hình: {!Array.isArray(churnForecast.data.data) 
                      ? churnForecast.data.data.model_name
                      : churnForecast.data.data[0]?.model_name}
                  </p>
                </div>

                <div className="glass-pink backdrop-blur-sm bg-white/60 p-6 rounded-3xl border border-white/50 shadow-sm relative overflow-hidden hover:shadow-md hover:translate-y-[-1px] transition-all duration-300">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Khoảng Tin Cậy</p>
                  <div className="text-sm font-black text-slate-900 tracking-tight mt-1 min-h-[1.5rem]">
                    {!Array.isArray(churnForecast.data.data) && churnForecast.data.data?.confidence_lower != null && churnForecast.data.data?.confidence_upper != null ? (
                      <>
                        {formatPercent(churnForecast.data.data.confidence_lower)}
                        {' - '}
                        {formatPercent(churnForecast.data.data.confidence_upper)}
                      </>
                    ) : null}
                    {Array.isArray(churnForecast.data.data) && <>Nhiều kỳ</>}
                    {!Array.isArray(churnForecast.data.data) && (churnForecast.data.data?.confidence_lower == null || churnForecast.data.data?.confidence_upper == null) && <>N/A</>}
                  </div>
                  <p className="text-[10px] font-semibold text-slate-400 mt-2">95% CI</p>
                </div>

                <div className="glass-pink backdrop-blur-sm bg-white/60 p-6 rounded-3xl border border-white/50 shadow-sm relative overflow-hidden hover:shadow-md hover:translate-y-[-1px] transition-all duration-300">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Độ Chính Xác</p>
                  <p className="text-2xl font-black text-slate-900 tracking-tight">
                    {!Array.isArray(churnForecast.data.data) && churnForecast.data.data?.accuracy_pct != null
                      ? formatPercent(churnForecast.data.data.accuracy_pct)
                      : 'N/A'}
                  </p>
                  <p className="text-[10px] font-semibold text-slate-400 mt-2">Chỉ số độ chính xác</p>
                </div>

                <div className="glass-pink backdrop-blur-sm bg-white/60 p-6 rounded-3xl border border-white/50 shadow-sm relative overflow-hidden hover:shadow-md hover:translate-y-[-1px] transition-all duration-300">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Thời Gian Dự Báo</p>
                  <p className="text-2xl font-black text-slate-900 tracking-tight">
                    {churnHorizon} tháng
                  </p>
                  <p className="text-[10px] font-semibold text-slate-400 mt-2">Thời hạn dự báo</p>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Demand Forecast Tab */}
          <TabsContent value="demand" className="space-y-8">
            {/* Controls */}
            <div className="glass-pink backdrop-blur-sm bg-white/60 p-6 rounded-[2rem] border border-white/50 shadow-sm relative overflow-hidden space-y-4 mb-6">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Cấu Hình Dự Báo</h2>
              <div className="flex-1 max-w-xs">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Thời Gian Dự Báo</label>
                <Select 
                  value={demandHorizon.toString()} 
                  onValueChange={(v) => v && setDemandHorizon(parseInt(v))}
                >
                  <SelectTrigger className="w-full bg-white/80 border border-slate-200/80 rounded-2xl px-4 py-2 text-sm font-bold shadow-sm h-11 focus:outline-none">
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
            </div>

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
              <div className="grid gap-6 grid-cols-1 sm:grid-cols-3 mb-8">
                <div className="glass-pink backdrop-blur-sm bg-white/60 p-6 rounded-3xl border border-white/50 shadow-sm relative overflow-hidden hover:shadow-md hover:translate-y-[-1px] transition-all duration-300">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Dự Báo Nhu Cầu</p>
                  <p className="text-2xl font-black text-slate-900 tracking-tight">
                    {!Array.isArray(demandForecast.data.data) && demandForecast.data.data?.forecasted_value != null
                      ? demandForecast.data.data.forecasted_value.toFixed(0)
                      : Array.isArray(demandForecast.data.data)
                      ? `${demandForecast.data.data.length} kỳ`
                      : 'N/A'}
                  </p>
                  <p className="text-[10px] font-semibold text-slate-400 mt-2">
                    {demandHorizon} tháng tới
                  </p>
                </div>

                <div className="glass-pink backdrop-blur-sm bg-white/60 p-6 rounded-3xl border border-white/50 shadow-sm relative overflow-hidden hover:shadow-md hover:translate-y-[-1px] transition-all duration-300">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Mô Hình</p>
                  <p className="text-sm font-black text-slate-900 tracking-tight mt-2">
                    {!Array.isArray(demandForecast.data.data) 
                      ? demandForecast.data.data.model_name
                      : demandForecast.data.data[0]?.model_name}
                  </p>
                  <p className="text-[10px] font-semibold text-slate-400 mt-2">Công cụ phân tích</p>
                </div>

                <div className="glass-pink backdrop-blur-sm bg-white/60 p-6 rounded-3xl border border-white/50 shadow-sm relative overflow-hidden hover:shadow-md hover:translate-y-[-1px] transition-all duration-300">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Độ Chính Xác</p>
                  <p className="text-2xl font-black text-[#10b981] tracking-tight">
                    {!Array.isArray(demandForecast.data.data) && demandForecast.data.data?.accuracy_pct != null
                      ? `${demandForecast.data.data.accuracy_pct.toFixed(1)}%`
                      : 'N/A'}
                  </p>
                  <p className="text-[10px] font-semibold text-slate-400 mt-2">Chỉ số độ chính xác</p>
                </div>
              </div>
            )}

            {/* Demand Forecast Chart */}
            <div className="glass-pink backdrop-blur-sm bg-white/60 p-8 rounded-[2rem] border border-white/50 shadow-sm relative overflow-hidden hover:shadow-xl transition-all duration-300">
              <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary/20 via-pink-300/30 to-primary/20" />
              <h2 className="text-lg font-black text-slate-900 mb-2 uppercase tracking-wider">Biểu Đồ Dự Báo Nhu Cầu</h2>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Dự báo nhu cầu {demandHorizon} tuần tới cho các dịch vụ</p>
              
              <div className="w-full">
                {demandForecast.isLoading ? (
                  <div className="h-[400px] flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-wider">
                      <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                      <span>Đang tải dữ liệu...</span>
                    </div>
                  </div>
                ) : !isChartReady ? (
                  <div className="h-[400px] flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-wider">
                      <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                      <span>Đang khởi tạo biểu đồ...</span>
                    </div>
                  </div>
                ) : demandForecast.error ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Lỗi khi tải dữ liệu</AlertTitle>
                    <AlertDescription>
                      {demandForecast.error instanceof Error 
                        ? demandForecast.error.message 
                        : 'Không thể tải dữ liệu dự báo nhu cầu. Vui lòng thử lại sau.'}
                    </AlertDescription>
                  </Alert>
                ) : demandForecast.data?.data ? (
                  (() => {
                    const forecastData = (Array.isArray(demandForecast.data.data)
                      ? demandForecast.data.data
                      : [demandForecast.data.data]) as unknown as Record<string, unknown>[];
                    
                    return (
                      <ChartWrapper>
                        <Bar
                          key={`demand-chart-${chartKey}`}
                          data={{
                          labels: forecastData.map((f) => String(f.period_end_date || '')),
                          datasets: [
                            {
                              label: 'Dự Báo Nhu Cầu',
                              data: forecastData.map((f) => Number(f.forecasted_value || 0)),
                              backgroundColor: themeRgba(0.4),
                              borderColor: themeColor,
                              borderWidth: 2,
                              borderRadius: 8
                            }
                          ]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: {
                              position: 'top' as const,
                              labels: {
                                color: '#94a3b8',
                                font: {
                                  weight: 'bold',
                                  size: 11
                                }
                              }
                            }
                          },
                          scales: {
                            y: {
                              beginAtZero: true,
                              grid: {
                                color: '#f1f5f9'
                              },
                              ticks: {
                                color: '#94a3b8',
                                font: {
                                  weight: 'bold',
                                  size: 10
                                },
                                stepSize: 5
                              }
                            },
                            x: {
                              grid: {
                                display: false
                              },
                              ticks: {
                                color: '#94a3b8',
                                font: {
                                  weight: 'bold',
                                  size: 10
                                }
                              }
                            }
                          }
                        }}
                        height={400}
                      />
                      </ChartWrapper>
                    );
                  })()
                ) : (
                  <Alert>
                    <AlertDescription>
                      Không có dữ liệu. Vui lòng thử lại sau.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </IntelligenceLayout>
  );
}

export default function ForecastDashboardWrapper() {
  return (
    <ErrorBoundary>
      <ForecastDashboard />
    </ErrorBoundary>
  );
}
