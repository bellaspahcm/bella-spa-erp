'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  useServiceRecommendations, 
  usePackageRecommendations, 
  useUpsellRecommendations 
} from '@/hooks/intelligence';
import { createClient } from '@/lib/supabase-client';
import { 
  Sparkles, 
  TrendingUp, 
  Package, 
  Star,
  Users,
  Search,
  RefreshCw,
  CheckCircle2,
  ArrowRight,
  AlertCircle
} from 'lucide-react';

export default function RecommendationDashboard() {
  const [activeTab, setActiveTab] = useState('service');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [algorithm, setAlgorithm] = useState('hybrid');
  const [limit, setLimit] = useState(5);
  const [tenantId, setTenantId] = useState('');
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  // Get current user's tenant ID
  useEffect(() => {
    const loadUser = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // Try to get tenant_id from user metadata or profile
          const userTenantId = user.user_metadata?.tenant_id;
          
          if (userTenantId) {
            setTenantId(userTenantId);
          } else {
            // Fallback: fetch from users table
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

  // Fetch recommendations
  const serviceRecommendations = useServiceRecommendations({
    tenantId,
    customerId: selectedCustomerId,
    limit,
    algorithm: algorithm as any,
    enabled: !!selectedCustomerId && !!tenantId
  });

  const packageRecommendations = usePackageRecommendations({
    tenantId,
    customerId: selectedCustomerId,
    limit: 3,
    algorithm: algorithm as any,
    enabled: !!selectedCustomerId && !!tenantId
  });

  const upsellRecommendations = useUpsellRecommendations({
    tenantId,
    customerId: selectedCustomerId,
    limit: 3,
    enabled: !!selectedCustomerId && !!tenantId
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const getRatingStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
      />
    ));
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="w-8 h-8 text-primary" />
            Gợi Ý Thông Minh
          </h1>
          <p className="text-muted-foreground mt-1">
            Gợi ý dịch vụ, gói và upsell sử dụng AI & Machine Learning
          </p>
        </div>
      </div>

      {/* Customer Search */}
      <Card>
        <CardHeader>
          <CardTitle>Tìm Kiếm Khách Hàng</CardTitle>
          <CardDescription>
            Nhập ID hoặc tên khách hàng để xem gợi ý cá nhân hóa
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Nhập ID khách hàng hoặc tên..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button 
              onClick={() => setSelectedCustomerId(customerSearch)}
              disabled={!customerSearch}
            >
              <Search className="w-4 h-4 mr-2" />
              Tìm kiếm
            </Button>
          </div>

          {selectedCustomerId && (
            <Alert>
              <Users className="h-4 w-4" />
              <AlertDescription>
                Đang hiển thị gợi ý cho khách hàng: <strong>{selectedCustomerId}</strong>
                <Button 
                  variant="link" 
                  size="sm" 
                  onClick={() => {
                    serviceRecommendations.refetch();
                    packageRecommendations.refetch();
                    upsellRecommendations.refetch();
                  }}
                  className="ml-2"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Làm mới
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {!selectedCustomerId ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Chưa Chọn Khách Hàng</h3>
            <p className="text-muted-foreground mb-6">
              Vui lòng tìm kiếm và chọn một khách hàng để xem gợi ý cá nhân hóa
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Algorithm Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Cấu Hình Thuật Toán</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Thuật Toán</label>
                <Select value={algorithm} onValueChange={setAlgorithm}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hybrid">Hybrid (Recommended)</SelectItem>
                    <SelectItem value="collaborative_filtering">Collaborative Filtering</SelectItem>
                    <SelectItem value="content_based">Content-Based</SelectItem>
                    <SelectItem value="rfm_based">RFM-Based</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Số Lượng Gợi Ý</label>
                <Select value={limit.toString()} onValueChange={(v) => setLimit(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 gợi ý</SelectItem>
                    <SelectItem value="5">5 gợi ý</SelectItem>
                    <SelectItem value="10">10 gợi ý</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="service" className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Dịch Vụ
              </TabsTrigger>
              <TabsTrigger value="package" className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                Gói
              </TabsTrigger>
              <TabsTrigger value="upsell" className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Upsell
              </TabsTrigger>
            </TabsList>

            {/* Service Recommendations Tab */}
            <TabsContent value="service" className="space-y-6">
              {/* Metrics */}
              {serviceRecommendations.data?.data && (
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Relevance Score
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatPercent(serviceRecommendations.data.data.relevanceScore)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Độ liên quan tổng thể
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Confidence Score
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatPercent(serviceRecommendations.data.data.confidenceScore)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Độ tin cậy
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Diversity Score
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatPercent(serviceRecommendations.data.data.diversityScore)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Độ đa dạng danh mục
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Service Recommendations List */}
              <Card>
                <CardHeader>
                  <CardTitle>Dịch Vụ Gợi Ý</CardTitle>
                  <CardDescription>
                    Top {limit} dịch vụ phù hợp nhất cho khách hàng này
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {serviceRecommendations.isLoading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Đang phân tích...
                    </div>
                  ) : serviceRecommendations.data?.data?.recommendations && 
                       serviceRecommendations.data.data.recommendations.length > 0 ? (
                    <div className="space-y-4">
                      {serviceRecommendations.data.data.recommendations.map((rec: any, idx: number) => (
                        <div 
                          key={rec.itemId} 
                          className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                        >
                          {/* Rank Badge */}
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold">
                            #{idx + 1}
                          </div>

                          {/* Service Info */}
                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h4 className="font-semibold text-lg">{rec.itemName}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline">{rec.metadata.category}</Badge>
                                  <div className="flex items-center gap-1">
                                    {getRatingStars(Math.round(rec.metadata.avgRating))}
                                    <span className="text-sm text-muted-foreground ml-1">
                                      ({rec.metadata.totalReviews})
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-2xl font-bold text-primary">
                                  {formatCurrency(rec.metadata.price)}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {rec.metadata.duration} phút
                                </div>
                              </div>
                            </div>

                            {/* Scores */}
                            <div className="flex gap-6 mb-3">
                              <div>
                                <span className="text-xs text-muted-foreground">Relevance:</span>
                                <div className="flex items-center gap-2">
                                  <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-primary rounded-full"
                                      style={{ width: `${rec.score * 100}%` }}
                                    />
                                  </div>
                                  <span className="text-sm font-semibold">
                                    {formatPercent(rec.score)}
                                  </span>
                                </div>
                              </div>
                              <div>
                                <span className="text-xs text-muted-foreground">Confidence:</span>
                                <div className="flex items-center gap-2">
                                  <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-green-500 rounded-full"
                                      style={{ width: `${rec.confidence * 100}%` }}
                                    />
                                  </div>
                                  <span className="text-sm font-semibold">
                                    {formatPercent(rec.confidence)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Reason */}
                            <div className="bg-accent/30 px-3 py-2 rounded-md">
                              <p className="text-sm text-muted-foreground">
                                <span className="font-semibold text-foreground">Lý do:</span> {rec.reason}
                              </p>
                            </div>

                            {/* Match Factors */}
                            <div className="flex gap-2 mt-3">
                              {rec.matchFactors.similarCustomersPurchased && (
                                <Badge variant="secondary" className="text-xs">
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  KH tương tự đã mua
                                </Badge>
                              )}
                              {rec.matchFactors.matchesPreferences && (
                                <Badge variant="secondary" className="text-xs">
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Phù hợp sở thích
                                </Badge>
                              )}
                              {rec.matchFactors.trending && (
                                <Badge variant="secondary" className="text-xs">
                                  <TrendingUp className="w-3 h-3 mr-1" />
                                  Đang trending
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Alert>
                      <AlertDescription>
                        Không tìm thấy gợi ý phù hợp. Thử thay đổi thuật toán hoặc tăng số lượng gợi ý.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Package Recommendations Tab */}
            <TabsContent value="package" className="space-y-6">
              {/* Package Recommendations List */}
              <Card>
                <CardHeader>
                  <CardTitle>Gói Gợi Ý</CardTitle>
                  <CardDescription>
                    Các gói phù hợp nhất với sở thích và ngân sách của khách hàng
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {packageRecommendations.isLoading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Đang phân tích...
                    </div>
                  ) : packageRecommendations.data?.data?.recommendations && 
                       packageRecommendations.data.data.recommendations.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {packageRecommendations.data.data.recommendations.map((rec: any, idx: number) => (
                        <Card key={rec.itemId} className="hover:shadow-lg transition-shadow">
                          <CardHeader>
                            <div className="flex items-start justify-between">
                              <Badge className="mb-2">#{idx + 1} Best Fit</Badge>
                              <Badge variant="outline" className="bg-green-50">
                                Tiết kiệm {rec.metadata.savingsPercentage}%
                              </Badge>
                            </div>
                            <CardTitle className="text-xl">{rec.itemName}</CardTitle>
                            <CardDescription>
                              {rec.metadata.totalSessions} buổi • {formatCurrency(rec.metadata.pricePerSession)}/buổi
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {/* Price */}
                            <div className="flex items-baseline justify-between">
                              <div>
                                <div className="text-sm text-muted-foreground">Giá gói</div>
                                <div className="text-2xl font-bold text-primary">
                                  {formatCurrency(rec.metadata.price)}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                {getRatingStars(Math.round(rec.metadata.avgRating))}
                                <span className="text-sm text-muted-foreground ml-1">
                                  ({rec.metadata.totalReviews})
                                </span>
                              </div>
                            </div>

                            {/* Fit Scores */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Overall Fit:</span>
                                <span className="font-semibold">{formatPercent(rec.fitScore.overall)}</span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Budget Fit:</span>
                                <span className="font-semibold">{formatPercent(rec.fitScore.budgetFit)}</span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Preference Fit:</span>
                                <span className="font-semibold">{formatPercent(rec.fitScore.preferenceFit)}</span>
                              </div>
                            </div>

                            {/* Included Services */}
                            <div>
                              <div className="text-xs font-medium text-muted-foreground mb-2">Bao gồm:</div>
                              <div className="space-y-1">
                                {rec.metadata.includedServices.slice(0, 3).map((service: any) => (
                                  <div key={service.serviceId} className="text-xs flex items-center gap-2">
                                    <CheckCircle2 className="w-3 h-3 text-primary" />
                                    <span>{service.serviceName} x{service.quantity}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Reason */}
                            <div className="bg-accent/30 px-3 py-2 rounded-md">
                              <p className="text-xs text-muted-foreground">{rec.reason}</p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Alert>
                      <AlertDescription>
                        Không tìm thấy gói phù hợp.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Upsell Recommendations Tab */}
            <TabsContent value="upsell" className="space-y-6">
              {/* Upsell Recommendations List */}
              <Card>
                <CardHeader>
                  <CardTitle>Upsell Recommendations</CardTitle>
                  <CardDescription>
                    Dịch vụ/sản phẩm thường được mua cùng (Market Basket Analysis)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {upsellRecommendations.isLoading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Đang phân tích...
                    </div>
                  ) : upsellRecommendations.data?.data?.recommendations && 
                       upsellRecommendations.data.data.recommendations.length > 0 ? (
                    <div className="space-y-4">
                      {upsellRecommendations.data.data.recommendations.map((rec: any, idx: number) => (
                        <div 
                          key={rec.itemId} 
                          className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                        >
                          <ArrowRight className="w-6 h-6 text-primary flex-shrink-0" />

                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h4 className="font-semibold text-lg">{rec.itemName}</h4>
                                <p className="text-sm text-muted-foreground mt-1">{rec.reason}</p>
                              </div>
                              <div className="text-right">
                                <div className="text-xl font-bold text-primary">
                                  {formatCurrency(rec.metadata.price)}
                                </div>
                                <div className="flex items-center gap-1 justify-end mt-1">
                                  {getRatingStars(Math.round(rec.metadata.avgRating))}
                                </div>
                              </div>
                            </div>

                            {/* Market Basket Metrics */}
                            <div className="grid grid-cols-3 gap-4 mt-3">
                              <div className="bg-blue-50 dark:bg-blue-950 px-3 py-2 rounded-md">
                                <div className="text-xs text-muted-foreground">Support</div>
                                <div className="text-lg font-bold">
                                  {formatPercent(rec.basketAnalysis.support)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {rec.basketAnalysis.support * 100}% giao dịch
                                </div>
                              </div>

                              <div className="bg-green-50 dark:bg-green-950 px-3 py-2 rounded-md">
                                <div className="text-xs text-muted-foreground">Confidence</div>
                                <div className="text-lg font-bold text-green-600">
                                  {formatPercent(rec.basketAnalysis.confidence)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Tỷ lệ mua cùng
                                </div>
                              </div>

                              <div className="bg-purple-50 dark:bg-purple-950 px-3 py-2 rounded-md">
                                <div className="text-xs text-muted-foreground">Lift</div>
                                <div className="text-lg font-bold text-purple-600">
                                  {rec.basketAnalysis.lift.toFixed(2)}x
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Tăng khả năng
                                </div>
                              </div>
                            </div>

                            {/* Additional Info */}
                            <div className="flex gap-4 mt-3 text-sm">
                              <div>
                                <span className="text-muted-foreground">Co-purchase rate:</span>
                                <span className="font-semibold ml-2">
                                  {rec.metadata.coPurchaseRate}%
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Avg revenue increase:</span>
                                <span className="font-semibold ml-2 text-green-600">
                                  {formatCurrency(rec.metadata.avgRevenueIncrease)}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Acceptance rate:</span>
                                <span className="font-semibold ml-2">
                                  {formatPercent(rec.metadata.acceptanceRate)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Alert>
                      <AlertDescription>
                        Không có dữ liệu upsell. Cần có lịch sử mua hàng để phân tích.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
