'use client';

import { useState, useEffect } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Brain, Search, RefreshCw, TrendingUp, Package, Star, AlertCircle } from 'lucide-react';
import { 
  useServiceRecommendations,
  usePackageRecommendations,
  useUpsellRecommendations
} from '@/hooks/intelligence/use-recommendation';
import { createClient } from '@/lib/supabase-client';
import {
  IntelligenceLayout,
  IntelligenceHeader,
  IntelligenceSection,
  IntelligenceButton,
  IntelligenceLoading,
  IntelligenceError,
  IntelligenceEmpty
} from '@/components/intelligence';

function RecommendationsPage() {
  const [customerId, setCustomerId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [algorithm, setAlgorithm] = useState<'hybrid' | 'collaborative_filtering' | 'content_based' | 'rfm_based'>('hybrid');
  const [limit, setLimit] = useState(5);
  const [budget, setBudget] = useState(5000000);
  const [tenantId, setTenantId] = useState('');
  const [isLoadingTenant, setIsLoadingTenant] = useState(true);

  // Get current user's tenant ID
  useEffect(() => {
    const loadTenant = async () => {
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
        console.error('Failed to load tenant context:', error);
      } finally {
        setIsLoadingTenant(false);
      }
    };

    loadTenant();
  }, []);

  // Fetch recommendations
  const serviceRecommendations = useServiceRecommendations({
    tenantId,
    customerId: searchTerm,
    algorithm,
    limit,
    enabled: !!searchTerm && !!tenantId
  });

  const packageRecommendations = usePackageRecommendations({
    tenantId,
    customerId: searchTerm,
    limit,
    budget,
    enabled: !!searchTerm && !!tenantId
  });

  const upsellRecommendations = useUpsellRecommendations({
    tenantId,
    customerId: searchTerm,
    limit,
    enabled: !!searchTerm && !!tenantId
  });

  const handleSearch = () => {
    if (customerId.trim()) {
      setSearchTerm(customerId.trim());
    }
  };

  // Loading tenant state
  if (isLoadingTenant) {
    return (
      <IntelligenceLayout>
        <IntelligenceLoading message="Đang tải thông tin chi nhánh..." />
      </IntelligenceLayout>
    );
  }

  // Error: No tenant found
  if (!tenantId) {
    return (
      <IntelligenceLayout>
        <IntelligenceError 
          title="Thiếu thông tin chi nhánh"
          message="Không thể tải thông tin chi nhánh. Vui lòng làm mới trang hoặc liên hệ hỗ trợ."
        />
      </IntelligenceLayout>
    );
  }

  return (
    <IntelligenceLayout>
      {/* Header */}
      <IntelligenceHeader
        icon={Brain}
        label="Intelligence & Gợi Ý"
        title="Gợi Ý Thông Minh"
        description="Gợi ý dịch vụ, gói combo và cơ hội bán kèm được hỗ trợ bởi AI"
      />

      {/* Search Controls */}
      <IntelligenceSection title="Tìm Kiếm Khách Hàng" description="Nhập ID khách hàng để nhận gợi ý cá nhân hóa" className="mb-8">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex-1">
            <label className="ml-1 text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5 block">
              ID Khách Hàng
            </label>
            <Input
              placeholder="Nhập ID khách hàng..."
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="rounded-2xl border-slate-100 bg-slate-50 px-5 py-4 text-sm font-black text-slate-900 outline-none transition focus:border-rose-300 focus:bg-white focus:ring-4 focus:ring-rose-50"
            />
          </div>
          <div className="w-full sm:w-48">
            <label className="ml-1 text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5 block">
              Thuật Toán
            </label>
            <Select value={algorithm} onValueChange={(v) => v && setAlgorithm(v as any)}>
              <SelectTrigger className="rounded-2xl border-slate-100 bg-slate-50 px-5 py-4 text-sm font-black">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hybrid">Kết hợp (Hybrid)</SelectItem>
                <SelectItem value="collaborative_filtering">Lọc cộng tác</SelectItem>
                <SelectItem value="content_based">Dựa trên nội dung</SelectItem>
                <SelectItem value="rfm_based">Dựa trên RFM</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-32">
            <label className="ml-1 text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5 block">
              Số Lượng
            </label>
            <Select value={limit.toString()} onValueChange={(v) => v && setLimit(parseInt(v))}>
              <SelectTrigger className="rounded-2xl border-slate-100 bg-slate-50 px-5 py-4 text-sm font-black">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="pt-0 sm:pt-7">
            <IntelligenceButton 
              onClick={handleSearch} 
              disabled={!customerId.trim()}
              variant="primary"
              icon={Search}
              className="w-full sm:w-auto"
            >
              Tìm Kiếm
            </IntelligenceButton>
          </div>
        </div>
      </IntelligenceSection>

      {/* Results Tabs */}
      {searchTerm && (
        <Tabs defaultValue="service" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-white/60 p-2 rounded-2xl border border-slate-100 backdrop-blur-md">
            <TabsTrigger 
              value="service" 
              className="flex items-center gap-2 rounded-xl text-xs font-black uppercase tracking-wider data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-lg"
            >
              <Star className="w-4 h-4" />
              Dịch Vụ
            </TabsTrigger>
            <TabsTrigger 
              value="package" 
              className="flex items-center gap-2 rounded-xl text-xs font-black uppercase tracking-wider data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-lg"
            >
              <Package className="w-4 h-4" />
              Gói Combo
            </TabsTrigger>
            <TabsTrigger 
              value="upsell" 
              className="flex items-center gap-2 rounded-xl text-xs font-black uppercase tracking-wider data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-lg"
            >
              <TrendingUp className="w-4 h-4" />
              Bán Kèm
            </TabsTrigger>
          </TabsList>

          {/* Service Recommendations Tab */}
          <TabsContent value="service" className="space-y-6">
            {/* Service Recommendations List */}
            <IntelligenceSection title="Dịch Vụ Được Gợi Ý" description={`Top ${limit} dịch vụ phù hợp nhất cho khách hàng này`}>
              {serviceRecommendations.isLoading ? (
                <IntelligenceLoading message="Đang phân tích..." className="py-8" />
              ) : serviceRecommendations.isError ? (
                <IntelligenceError
                  title="Lỗi khi tải gợi ý"
                  message={serviceRecommendations.error instanceof Error 
                    ? serviceRecommendations.error.message 
                    : 'Không thể tải gợi ý dịch vụ. Vui lòng thử lại.'}
                />
              ) : serviceRecommendations.data?.data && serviceRecommendations.data.data.length > 0 ? (
                <div className="space-y-3">
                  {serviceRecommendations.data.data.map((rec) => (
                    <div 
                      key={rec.recommended_item_id} 
                      className="flex items-center justify-between p-5 border border-rose-100 rounded-2xl hover:bg-rose-50/30 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary font-black text-sm">
                          #{rec.rank_position}
                        </div>
                        <div>
                          <div className="font-black text-slate-900">{rec.item_name || rec.recommended_item_id}</div>
                          <div className="text-sm font-semibold text-slate-500">
                            Thuật toán: {rec.algorithm_used}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-black text-primary">
                          {(rec.relevance_score * 100).toFixed(1)}%
                        </div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Độ liên quan</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Alert>
                  <AlertDescription>
                    Không tìm thấy gợi ý dịch vụ cho khách hàng này.
                  </AlertDescription>
                </Alert>
              )}
            </IntelligenceSection>
          </TabsContent>

          {/* Package Recommendations Tab */}
          <TabsContent value="package" className="space-y-6">
            <IntelligenceSection 
              title="Gói Combo Được Gợi Ý" 
              description={`Gói combo tốt nhất cho khách hàng này (Ngân sách: ${budget.toLocaleString()} đ)`}
            >
              {packageRecommendations.isLoading ? (
                <IntelligenceLoading message="Đang phân tích..." className="py-8" />
              ) : packageRecommendations.isError ? (
                <IntelligenceError
                  title="Lỗi khi tải gợi ý"
                  message={packageRecommendations.error instanceof Error 
                    ? packageRecommendations.error.message 
                    : 'Không thể tải gợi ý gói combo. Vui lòng thử lại.'}
                />
              ) : packageRecommendations.data?.data && packageRecommendations.data.data.length > 0 ? (
                <div className="space-y-3">
                  {packageRecommendations.data.data.map((rec) => (
                    <div 
                      key={rec.recommended_item_id} 
                      className="flex items-center justify-between p-5 border border-rose-100 rounded-2xl hover:bg-rose-50/30 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary font-black text-sm">
                          #{rec.rank_position}
                        </div>
                        <div>
                          <div className="font-black text-slate-900">{rec.item_name || rec.recommended_item_id}</div>
                          <div className="text-sm font-semibold text-slate-500">
                            Thuật toán: {rec.algorithm_used}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-black text-primary">
                          {(rec.relevance_score * 100).toFixed(1)}%
                        </div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Độ liên quan</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Alert>
                  <AlertDescription>
                    Không tìm thấy gợi ý gói combo cho khách hàng này.
                  </AlertDescription>
                </Alert>
              )}
            </IntelligenceSection>
          </TabsContent>

          {/* Upsell Recommendations Tab */}
          <TabsContent value="upsell" className="space-y-6">
            <IntelligenceSection 
              title="Gợi Ý Bán Kèm" 
              description="Cơ hội bán kèm và bán chéo dựa trên lịch sử mua hàng"
            >
              {upsellRecommendations.isLoading ? (
                <IntelligenceLoading message="Đang phân tích..." className="py-8" />
              ) : upsellRecommendations.isError ? (
                <IntelligenceError
                  title="Lỗi khi tải gợi ý"
                  message={upsellRecommendations.error instanceof Error 
                    ? upsellRecommendations.error.message 
                    : 'Không thể tải gợi ý bán kèm. Vui lòng thử lại.'}
                />
              ) : upsellRecommendations.data?.data && upsellRecommendations.data.data.length > 0 ? (
                <div className="space-y-3">
                  {upsellRecommendations.data.data.map((rec) => (
                    <div 
                      key={rec.recommended_item_id} 
                      className="flex items-center justify-between p-5 border border-rose-100 rounded-2xl hover:bg-rose-50/30 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary font-black text-sm">
                          #{rec.rank_position}
                        </div>
                        <div>
                          <div className="font-black text-slate-900">{rec.item_name || rec.recommended_item_id}</div>
                          <div className="text-sm font-semibold text-slate-500">
                            Thuật toán: {rec.algorithm_used}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-black text-primary">
                          {(rec.relevance_score * 100).toFixed(1)}%
                        </div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Độ liên quan</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Alert>
                  <AlertDescription>
                    Không tìm thấy gợi ý bán kèm cho khách hàng này.
                  </AlertDescription>
                </Alert>
              )}
            </IntelligenceSection>
          </TabsContent>
        </Tabs>
      )}

      {!searchTerm && (
        <IntelligenceEmpty
          title="Bắt đầu tìm kiếm"
          message="Nhập ID khách hàng để nhận gợi ý dịch vụ, gói combo và cơ hội bán kèm được cá nhân hóa bởi AI"
          icon={<Brain className="h-8 w-8" />}
        />
      )}
    </IntelligenceLayout>
  );
}

// Wrap with ErrorBoundary to prevent full page crashes
export default function RecommendationsPageWrapper() {
  return (
    <ErrorBoundary>
      <RecommendationsPage />
    </ErrorBoundary>
  );
}
